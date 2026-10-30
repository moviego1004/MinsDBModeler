import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import {
  Undo2,
  Redo2,
  RefreshCw,
  Database,
  CheckCircle,
  FileCode,
  BookOpen,
  ShieldCheck,
  Network,
  FileSpreadsheet,
  FileText,
  Sparkles,
  Upload,
  FolderOpen,
  FolderPlus,
  Home,
  Link2,
  ArrowRight,
  Plus,
  X,
} from 'lucide-react';
import {
  parseModel,
  stringifyModel,
  validateModel,
  parseDdl,
  exportExcelXml,
  exportMarkdownReport,
  parseDaNativeFile,
  layoutBarkerDiagram,
  deserializeProject,
  serializeProject,
  diffProjectFiles,
  deriveView,
  applyViewEdits,
  positionsByName,
  positionsById,
  setDiagramPositions,
  diagramMemberIds,
  diagramsContaining,
  addToDiagram,
  removeFromDiagram,
  mergeModelInto,
  refineConceptualEntity,
  logicalRealizations,
  conceptualSources,
  linkRealization,
  unlinkRealization,
  createEntity,
  newId,
  ALL_CONCEPTUAL_DIAGRAM_ID,
  ALL_LOGICAL_DIAGRAM_ID,
  PROJECT_MARKER_FILE,
} from '@barker-modeler/model-core';
import type {
  LogicalModel,
  Entity,
  Attribute,
  Relationship,
  BarkerDiagramLayout,
  SavedShapePosition,
  ModelLevel,
  ModelProject,
} from '@barker-modeler/model-core';
import { parse as yamlParse } from 'yaml';

import KonvaModelerCanvas from './components/KonvaModelerCanvas.js';
import PropertiesPanel from './components/PropertiesPanel.js';
import ProjectExplorer from './components/ProjectExplorer.js';
import StartScreen from './components/StartScreen.js';
import DdlPane from './components/DdlPane.js';
import DictionaryManager from './components/DictionaryManager.js';
import PhysicalTransformWizard from './components/PhysicalTransformWizard.js';
import ModelLinterModal from './components/ModelLinterModal.js';
import RelationshipDiscoveryModal from './components/RelationshipDiscoveryModal.js';
import DaBridgeModal from './components/DaBridgeModal.js';
import { getDictionary, translateLogicalName, resolveDataType } from './services/dictionaryStorage.js';
import { canvasTextMeasurer } from './services/textMeasure.js';
import { projectFs, rememberRecentProject } from './services/projectFs.js';
import { useWorkspace, type WorkLevel } from './stores/workspaceStore.js';

/* ========================================================================== *
 * App: start screen ↔ workspace
 * ========================================================================== */

async function openProjectAt(root: string) {
  const files = await projectFs.read(root);
  if (!files[PROJECT_MARKER_FILE]) {
    throw new Error(`MinsDBModeler 프로젝트 폴더가 아닙니다 (${PROJECT_MARKER_FILE} 없음): ${root}`);
  }
  const { project, warnings } = deserializeProject(files);
  useWorkspace.getState().open(root, project, files);
  rememberRecentProject(project.config.name, root);
  if (warnings.length) alert(`일부 파일을 읽지 못했습니다:\n${warnings.join('\n')}`);
}

export default function App() {
  const hasProject = useWorkspace((s) => !!s.project && !!s.root);
  if (!hasProject) {
    return (
      <StartScreen
        onOpen={openProjectAt}
        onCreated={(root, project, files, notice) => {
          useWorkspace.getState().open(root, project, files);
          rememberRecentProject(project.config.name, root);
          if (notice) setTimeout(() => alert(notice), 50);
        }}
      />
    );
  }
  return <Workspace />;
}

/* ========================================================================== *
 * Autosave: serialize → diff against the folder → write only what changed
 * ========================================================================== */

function useAutosave() {
  const project = useWorkspace((s) => s.project);
  useEffect(() => {
    if (!project) return;
    const t = setTimeout(async () => {
      const ws = useWorkspace.getState();
      if (!ws.root || ws.project !== project) return;
      const files = serializeProject(project);
      const { writes, deletes } = diffProjectFiles(ws.savedFiles, files);
      if (!Object.keys(writes).length && !deletes.length) {
        if (ws.saveState === 'pending') useWorkspace.setState({ saveState: 'saved' });
        return;
      }
      ws.markSaving();
      try {
        await projectFs.write(ws.root, writes, deletes);
        useWorkspace.getState().markSaved(files);
      } catch (e: any) {
        useWorkspace.getState().markSaveError(e?.message || String(e));
      }
    }, 400);
    return () => clearTimeout(t);
  }, [project]);
}

const LEVEL_TABS: { id: WorkLevel; label: string; hint: string }[] = [
  { id: 'conceptual', label: '개념', hint: '업무 개념 엔터티와 관계' },
  { id: 'logical', label: '논리', hint: 'Barker 논리 모델 (원본)' },
  { id: 'physical', label: '물리', hint: '논리 모델에서 자동 변환된 테이블/컬럼' },
  { id: 'ddl', label: 'DDL', hint: '생성된 DDL·물리 사양 산출물' },
];

/* ========================================================================== *
 * Workspace
 * ========================================================================== */

function Workspace() {
  useAutosave();
  const ws = useWorkspace();
  const project = ws.project as ModelProject;
  const { level, activeDiagram, selectedEntityId, selectedRelationshipId, commit } = ws;

  const modelLevel: ModelLevel = level === 'conceptual' ? 'conceptual' : 'logical';
  const diagram =
    project.diagrams.find((d) => d.id === activeDiagram[modelLevel]) ||
    project.diagrams.find((d) => d.level === modelLevel)!;

  const [activeTab, setActiveTab] = useState<'canvas' | 'split'>('canvas');
  const [isDdlModalOpen, setIsDdlModalOpen] = useState(false);
  const [ddlImportText, setDdlImportText] = useState('');
  const [isDictOpen, setIsDictOpen] = useState(false);
  const [isTransformOpen, setIsTransformOpen] = useState(false);
  const [isLinterOpen, setIsLinterOpen] = useState(false);
  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
  const [isDaBridgeOpen, setIsDaBridgeOpen] = useState(false);
  const [ddlFocus, setDdlFocus] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${project.config.name} - MinsDBModeler`;
  }, [project.config.name]);

  /* ----------------------------- current view ----------------------------- */
  const model = useMemo(() => deriveView(project, diagram), [project, diagram]);
  const validationErrors = useMemo(() => validateModel(model, { allowUndefinedEntities: true }), [model]);

  const selectedEntity = useMemo(
    () => (selectedEntityId ? model.entities.find((e) => e.id === selectedEntityId) || null : null),
    [model, selectedEntityId]
  );
  const selectedEntityName = selectedEntity?.name ?? null;
  const selectedRelationship = useMemo(
    () => model.relationships.find((r) => r.id === selectedRelationshipId) || null,
    [model, selectedRelationshipId]
  );
  const idOfName = useCallback((name: string | null) => (name ? model.entities.find((e) => e.name === name)?.id ?? null : null), [model]);

  /** Apply an edited copy of the current view back into the repository. */
  const applyModel = useCallback(
    (after: LogicalModel, coalesce?: string) =>
      commit(
        (prev) => {
          const d = prev.diagrams.find((x) => x.id === diagram.id)!;
          return applyViewEdits(prev, d, deriveView(prev, d), after);
        },
        { coalesce }
      ),
    [commit, diagram.id]
  );

  /* ------------------------------ navigation ------------------------------ */
  const navigateTo = useCallback(
    (lv: ModelLevel, id: string, preferDiagram?: string) => {
      const p = useWorkspace.getState().project!;
      const current = p.diagrams.find((d) => d.id === (preferDiagram || useWorkspace.getState().activeDiagram[lv]));
      const target = current && diagramMemberIds(p, current).has(id) ? current.id : lv === 'conceptual' ? ALL_CONCEPTUAL_DIAGRAM_ID : ALL_LOGICAL_DIAGRAM_ID;
      const st = useWorkspace.getState();
      st.setActiveDiagram(target);
      st.setLevel(lv === 'conceptual' ? 'conceptual' : st.level === 'physical' ? 'physical' : 'logical');
      st.selectEntity(id);
    },
    []
  );

  /** Switching tabs carries the selection across levels through the trace links. */
  const switchLevel = useCallback(
    (next: WorkLevel) => {
      const st = useWorkspace.getState();
      const from = st.level;
      const sel = st.selectedEntityId;
      const crossing = (from === 'conceptual') !== (next === 'conceptual') && next !== 'ddl' && from !== 'ddl';
      if (crossing && sel) {
        const p = st.project!;
        const target = next === 'conceptual' ? conceptualSources(p, sel)[0]?.id : logicalRealizations(p, sel)[0]?.id;
        if (target) {
          navigateTo(next === 'conceptual' ? 'conceptual' : 'logical', target);
          useWorkspace.getState().setLevel(next);
          return;
        }
        st.selectEntity(null);
      }
      st.setLevel(next);
    },
    [navigateTo]
  );

  /* ------------------------------- editing -------------------------------- */
  const handleAddEntity = useCallback(() => {
    const name = prompt(modelLevel === 'conceptual' ? '새 개념 엔터티 이름:' : '새 엔터티 이름:');
    if (!name) return;
    const all = modelLevel === 'conceptual' ? project.conceptual.entities : project.entities;
    if (all.some((e) => e.name === name)) return alert('이미 존재하는 엔터티 이름입니다.');
    const res = createEntity(project, modelLevel, name, diagram.includeAll ? undefined : diagram.id);
    commit(res.project);
    ws.selectEntity(res.id);
  }, [project, modelLevel, diagram, commit, ws]);

  const handleDeleteEntity = useCallback(
    (name: string) => {
      if (!confirm(`"${name}" 엔터티를 모델에서 삭제할까요?\n모든 다이어그램과 관계에서 함께 사라집니다. (다이어그램에서만 빼려면 '현재 다이어그램에서 제거'를 사용하세요)`)) return;
      applyModel({
        ...model,
        entities: model.entities.filter((e) => e.name !== name),
        relationships: model.relationships.filter((r) => r.parent !== name && r.child !== name),
      });
      ws.selectEntity(null);
    },
    [model, applyModel, ws]
  );

  const handleUpdateEntity = useCallback(
    (updatedEntity: Entity) => {
      const current = selectedEntityName;
      const entities = model.entities.map((e) => (e.name === current ? updatedEntity : { ...e }));
      let relationships = model.relationships;
      if (current && updatedEntity.name !== current) {
        entities.forEach((e) => {
          if (e.supertype === current) e.supertype = updatedEntity.name;
          e.subtype_sets = e.subtype_sets?.map((s) => ({ ...s, subtypes: s.subtypes.map((x) => (x === current ? updatedEntity.name : x)) }));
        });
        relationships = model.relationships.map((r) => ({
          ...r,
          parent: r.parent === current ? updatedEntity.name : r.parent,
          child: r.child === current ? updatedEntity.name : r.child,
        }));
      }
      applyModel({ ...model, entities, relationships }, `entity:${updatedEntity.id}`);
    },
    [model, selectedEntityName, applyModel]
  );

  const handleAddAttribute = useCallback(() => {
    if (!selectedEntity) return;
    handleUpdateEntity({
      ...selectedEntity,
      attributes: [...selectedEntity.attributes, { name: `속성_${selectedEntity.attributes.length + 1}`, domain: 'VARCHAR', required: false }],
    });
  }, [selectedEntity, handleUpdateEntity]);

  const handleUpdateAttribute = useCallback(
    (index: number, updatedAttr: Attribute) => {
      if (!selectedEntity) return;
      const ent = selectedEntity;
      let identifier = ent.identifier;
      if (updatedAttr.identifier) {
        if (Array.isArray(ent.identifier)) {
          if (!ent.identifier.includes(updatedAttr.name)) identifier = [...ent.identifier, updatedAttr.name];
        } else if (ent.identifier !== updatedAttr.name) identifier = ent.identifier ? [ent.identifier, updatedAttr.name] : [updatedAttr.name];
      }
      handleUpdateEntity({ ...ent, identifier, attributes: ent.attributes.map((a, i) => (i === index ? updatedAttr : a)) });
    },
    [selectedEntity, handleUpdateEntity]
  );

  const handleDeleteAttribute = useCallback(
    (index: number) => {
      if (!selectedEntity) return;
      handleUpdateEntity({ ...selectedEntity, attributes: selectedEntity.attributes.filter((_, i) => i !== index) });
    },
    [selectedEntity, handleUpdateEntity]
  );

  const handleAddRelationship = useCallback(() => {
    const parent = prompt('부모 엔터티(One) 이름:', selectedEntityName || '');
    if (!parent || !model.entities.some((e) => e.name === parent)) return alert('현재 다이어그램에 있는 부모 엔터티 이름을 입력하세요.');
    const child = prompt('자식 엔터티(Many) 이름:');
    if (!child || !model.entities.some((e) => e.name === child)) return alert('현재 다이어그램에 있는 자식 엔터티 이름을 입력하세요.');
    const rel: Relationship = {
      id: newId('rel'),
      name: `${parent}_${child}`,
      parent,
      child,
      cardinality: 'one_to_many',
      parent_participation: '0..M',
      child_participation: '1..1',
      identifying: false,
    };
    applyModel({ ...model, relationships: [...model.relationships, rel] });
    ws.selectRelationship(rel.id);
  }, [model, selectedEntityName, applyModel, ws]);

  const handleUpdateRelationship = useCallback(
    (updatedRel: Relationship) => applyModel({ ...model, relationships: model.relationships.map((r) => (r.id === updatedRel.id ? updatedRel : r)) }, `rel:${updatedRel.id}`),
    [model, applyModel]
  );

  const handleDeleteRelationship = useCallback(
    (id: string) => {
      if (!confirm('관계를 삭제하시겠습니까?')) return;
      applyModel({ ...model, relationships: model.relationships.filter((r) => r.id !== id) });
      ws.selectRelationship(null);
    },
    [model, applyModel, ws]
  );

  const handleUpdateModelMeta = useCallback(
    (key: keyof LogicalModel, value: any) => {
      if (key === 'subject_area') {
        commit((p) => ({ ...p, diagrams: p.diagrams.map((d) => (d.id === diagram.id ? { ...d, name: value } : d)) }), { coalesce: `dgm-name:${diagram.id}` });
      } else if (key === 'version') {
        commit((p) => ({ ...p, config: { ...p.config, version: value } }), { coalesce: 'version' });
      } else if (key === 'rules') {
        commit((p) => ({ ...p, rules: value || [] }));
      }
    },
    [commit, diagram.id]
  );

  /* -------------------------------- diagrams ------------------------------- */
  const createDiagram = (lv: ModelLevel) => {
    const name = prompt(`새 ${lv === 'conceptual' ? '개념' : '논리'} 다이어그램(주제영역) 이름:`);
    if (!name) return;
    const id = newId('dgm');
    commit((p) => ({ ...p, diagrams: [...p.diagrams, { id, name, level: lv, members: [], positions: {} }] }));
    ws.setActiveDiagram(id);
  };
  const renameDiagram = (id: string) => {
    const d = project.diagrams.find((x) => x.id === id);
    const name = d && prompt('다이어그램 이름:', d.name);
    if (name && d) commit((p) => ({ ...p, diagrams: p.diagrams.map((x) => (x.id === id ? { ...x, name } : x)) }));
  };
  const deleteDiagram = (id: string) => {
    const d = project.diagrams.find((x) => x.id === id);
    if (!d || d.includeAll || !confirm(`"${d.name}" 다이어그램을 삭제할까요? (엔터티와 관계는 모델에 남습니다)`)) return;
    commit((p) => ({ ...p, diagrams: p.diagrams.filter((x) => x.id !== id) }));
    if (activeDiagram[d.level] === id) ws.setActiveDiagram(d.level === 'conceptual' ? ALL_CONCEPTUAL_DIAGRAM_ID : ALL_LOGICAL_DIAGRAM_ID);
  };

  /* -------------------------- physical projection -------------------------- */
  const physicalContext = useMemo(() => {
    let dict = getDictionary();
    try {
      const d = (yamlParse(project.standards.dictionary) as any) || {};
      const m = (yamlParse(project.standards.domains) as any) || {};
      dict = {
        words: (d.words || []).map((w: any) => ({ logicalName: w.logicalName || w.logical || '', physicalAbbr: w.physicalAbbr || w.physical || '' })),
        terms: (d.terms || []).map((t: any) => ({ logicalName: t.logicalName || t.logical || '', physicalName: t.physicalName || t.physical || '' })),
        domains: (m.domains || []).map((x: any) => ({ logicalName: x.logicalName || x.logical || x.name || '', physicalName: x.physicalName || x.physical || x.type || '' })),
        codes: d.codes || [],
      };
    } catch {}
    const dbType = project.config.targetDbms === 'POSTGRESQL' ? 'POSTGRES' : project.config.targetDbms;
    return { dict, dbType: dbType as 'ORACLE' | 'POSTGRES' | 'MYSQL' };
  }, [project.standards, project.config.targetDbms]);

  const physicalTableName = useCallback(
    (ent: Entity): string => {
      if (ent.physicalName) return ent.physicalName;
      const segments = translateLogicalName(ent.name, physicalContext.dict, 'UPPER').physicalName.split('_');
      const last = segments.length - 1;
      const word = segments[last];
      if (word && !['HIST', 'STATUS', 'CONTENT', 'AUDIT'].includes(word)) {
        if (word.endsWith('Y')) segments[last] = word.slice(0, -1) + 'IES';
        else if (/(S|CH|SH|X|Z)$/.test(word)) segments[last] = word + 'ES';
        else segments[last] = word + 'S';
      }
      const name = `TB_${segments.join('_')}`;
      return project.config.namingCase === 'LOWER_SNAKE' ? name.toLowerCase() : name;
    },
    [physicalContext, project.config.namingCase]
  );

  const physicalAttributes = useCallback(
    (ent: Entity): Attribute[] =>
      ent.attributes.map((attr) => {
        const col = attr.physicalName || translateLogicalName(attr.name, physicalContext.dict, 'UPPER').physicalName;
        return {
          ...attr,
          name: project.config.namingCase === 'LOWER_SNAKE' ? col.toLowerCase() : col,
          domain: resolveDataType(attr.domain, attr.name, physicalContext.dbType, physicalContext.dict),
        };
      }),
    [physicalContext, project.config.namingCase]
  );

  /* ------------------------------ diagram layout ------------------------------ */
  const [livePositions, setLivePositions] = useState<Record<string, SavedShapePosition>>({});
  useEffect(() => setLivePositions({}), [diagram.id]);
  const savedPositions = useMemo(() => positionsByName(project, diagram), [project, diagram]);

  const layoutFor = useCallback(
    (positions: Record<string, SavedShapePosition>) =>
      layoutBarkerDiagram(model, {
        positions,
        measureText: canvasTextMeasurer,
        labelOf: level === 'physical' ? physicalTableName : undefined,
        attributesOf: level === 'physical' ? physicalAttributes : undefined,
        showDomains: level === 'physical',
      }),
    [model, level, physicalTableName, physicalAttributes]
  );
  const diagramLayout = useMemo(() => layoutFor({ ...savedPositions, ...livePositions }), [layoutFor, savedPositions, livePositions]);

  const rootPositionsOf = (layout: BarkerDiagramLayout, sized: Record<string, SavedShapePosition>) => {
    const map: Record<string, SavedShapePosition> = {};
    layout.roots.forEach((r) => {
      const s = sized[r.entity];
      map[r.entity] = { x: r.x, y: r.y };
      if (s?.width && s.width > r.minWidth) map[r.entity].width = r.width;
      if (s?.height && s.height > r.minHeight) map[r.entity].height = r.height;
    });
    return map;
  };

  const persistPositions = useCallback(
    (byName: Record<string, SavedShapePosition>, history = true) => {
      commit(
        (p) => {
          const d = p.diagrams.find((x) => x.id === diagram.id)!;
          return setDiagramPositions(p, d.id, { ...d.positions, ...positionsById(p, d, byName) });
        },
        { history }
      );
      setLivePositions({});
    },
    [commit, diagram.id]
  );

  // Freeze automatically placed shapes once so later additions don't reshuffle the diagram.
  useEffect(() => {
    if (Object.keys(livePositions).length) return;
    if (diagramLayout.roots.some((r) => !savedPositions[r.entity])) persistPositions(rootPositionsOf(diagramLayout, savedPositions), false);
  }, [diagramLayout, savedPositions, livePositions, persistPositions]);

  const handleRootMove = useCallback(
    (name: string, pos: { x: number; y: number }, final: boolean) => {
      const current = { ...savedPositions, ...livePositions };
      const next = { ...current, [name]: { ...current[name], x: pos.x, y: pos.y } };
      if (!final) return setLivePositions((prev) => ({ ...prev, [name]: next[name] }));
      persistPositions(rootPositionsOf(layoutFor(next), next));
    },
    [savedPositions, livePositions, layoutFor, persistPositions]
  );

  const handleRootResize = useCallback(
    (name: string, size: { width: number; height: number }, final: boolean) => {
      const shape = diagramLayout.shapes.get(name);
      if (!shape) return;
      const next = { ...savedPositions, ...livePositions, [name]: { x: shape.x, y: shape.y, width: Math.round(size.width), height: Math.round(size.height) } };
      if (!final) return setLivePositions((prev) => ({ ...prev, [name]: next[name] }));
      persistPositions(rootPositionsOf(layoutFor(next), next));
    },
    [savedPositions, livePositions, diagramLayout, layoutFor, persistPositions]
  );

  const handleAutoLayout = () => persistPositions(rootPositionsOf(layoutFor({}), {}));

  /* ------------------------------- imports -------------------------------- */
  const importIntoProject = useCallback(
    (imported: LogicalModel, sourceName: string) => {
      const name = imported.subject_area && imported.subject_area !== 'Unnamed Subject Area' ? imported.subject_area : sourceName;
      const res = mergeModelInto(useWorkspace.getState().project!, imported, 'logical', { diagramName: name });
      commit(res.project);
      if (res.diagramId) ws.setActiveDiagram(res.diagramId);
      const r = res.report;
      alert(
        `"${name}" 가져오기 완료\n새 엔터티 ${r.addedEntities}개, 기존 엔터티 보강 ${r.mergedEntities}개, 관계 ${r.addedRelationships}개` +
          (r.skippedRelationships.length ? `\n건너뛴 관계 ${r.skippedRelationships.length}건` : '')
      );
    },
    [commit, ws]
  );

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    if (/\.(dax|damx)$/i.test(file.name)) {
      reader.onload = (ev) => {
        try {
          const loaded = parseDaNativeFile(new Uint8Array(ev.target?.result as ArrayBuffer), file.name);
          if (!loaded.entities.length) throw new Error('DA# 파일에서 엔터티를 추출할 수 없습니다.');
          importIntoProject(loaded, file.name.replace(/\.[^.]+$/, ''));
        } catch (err: any) {
          alert(`DA# 파일 열기 실패: ${err.message || err}`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (/\.(sql|ddl)$/i.test(file.name)) {
      reader.onload = (ev) => {
        setDdlImportText(String(ev.target?.result || ''));
        setIsDdlModalOpen(true);
      };
      reader.readAsText(file);
    } else {
      reader.onload = (ev) => {
        try {
          importIntoProject(parseModel(String(ev.target?.result || '')), file.name.replace(/\.[^.]+$/, ''));
        } catch (err: any) {
          alert(`YAML 파싱 실패: ${err.message || err}`);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleDdlImport = () => {
    try {
      importIntoProject(parseDdl(ddlImportText), 'DDL 리버스');
      setIsDdlModalOpen(false);
      setDdlImportText('');
    } catch (err: any) {
      alert(`DDL 파싱 실패: ${err.message}`);
    }
  };

  /* ------------------------------- exports -------------------------------- */
  const download = (content: string, type: string, filename: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  const safeName = (model.subject_area || 'model').replace(/[\s/\\]+/g, '_');

  /* ----------------------- modals fed from the repository ----------------------- */
  const legacyFiles = useMemo(() => {
    if (!isDictOpen && !isTransformOpen) return [];
    const all = project.diagrams.find((d) => d.id === ALL_LOGICAL_DIAGRAM_ID)!;
    return [
      { name: 'standardization/dictionary.yaml', content: project.standards.dictionary },
      { name: 'standardization/domains.yaml', content: project.standards.domains },
      {
        name: 'dbproject.yaml',
        content: `project_name: ${project.config.name}\ntarget_db: ${project.config.targetDbms}\nsubtype_strategy: ${project.config.subtypeStrategy}\n`,
      },
      { name: 'logical/model.yaml', content: stringifyModel(deriveView(project, all)) },
    ];
  }, [project, isDictOpen, isTransformOpen]);

  const handleUpdateStandardsFile = (filename: string, content: string) => {
    if (filename.endsWith('dictionary.yaml')) commit((p) => ({ ...p, standards: { ...p.standards, dictionary: content } }));
    if (filename.endsWith('domains.yaml')) commit((p) => ({ ...p, standards: { ...p.standards, domains: content } }));
  };

  const outputBase = `output/${(diagram.includeAll ? project.config.name : diagram.name).replace(/[\s/\\:*?"<>|]+/g, '_')}.yaml`;
  const handleSaveOutput = (filename: string, content: string) => {
    const path = filename.startsWith('output/') ? filename : `output/${filename.replace(/^.*\//, '')}`;
    commit((p) => ({ ...p, outputs: { ...p.outputs, [path]: content } }));
    if (/\.(sql|ddl)$/i.test(path)) {
      setDdlFocus(path);
      ws.setLevel('ddl');
    }
  };

  /* ------------------------------ YAML editor ------------------------------ */
  const derivedYaml = useMemo(() => (activeTab === 'split' ? stringifyModel(model) : ''), [model, activeTab]);
  const [yamlDraft, setYamlDraft] = useState<string | null>(null);
  const [yamlError, setYamlError] = useState<string | null>(null);
  const yamlTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    setYamlDraft(null);
    setYamlError(null);
  }, [diagram.id, level]);
  const handleYamlChange = (value: string | undefined) => {
    if (value === undefined) return;
    setYamlDraft(value);
    clearTimeout(yamlTimer.current);
    yamlTimer.current = setTimeout(() => {
      try {
        applyModel(parseModel(value), 'yaml');
        setYamlError(null);
      } catch (e: any) {
        setYamlError(e?.message || String(e));
      }
    }, 600);
  };

  /* ------------------------------ shortcuts ------------------------------ */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, .monaco-editor')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) useWorkspace.getState().redo();
        else useWorkspace.getState().undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        useWorkspace.getState().redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ------------------------- trace & membership UI ------------------------- */
  const refine = (conceptualId: string) => {
    const res = refineConceptualEntity(project, conceptualId, activeDiagram.logical);
    if (!res.logicalId) return;
    commit(res.project);
    navigateTo('logical', res.logicalId, activeDiagram.logical);
  };

  const handleEntityDoubleClick = (name: string) => {
    const id = idOfName(name);
    if (!id) return;
    if (modelLevel === 'conceptual') {
      const target = logicalRealizations(project, id)[0];
      if (target) navigateTo('logical', target.id);
      else if (confirm(`"${name}"을(를) 논리 모델로 상세화할까요?`)) refine(id);
    } else ws.selectEntity(id);
  };

  const entityExtras = selectedEntity && (
    <>
      {modelLevel === 'conceptual' ? (
        <TraceBox title="논리 모델 연결 (상세화)">
          {logicalRealizations(project, selectedEntity.id!).map((e) => (
            <span key={e.id} className="trace-chip">
              <button onClick={() => navigateTo('logical', e.id)}>
                {e.name} <ArrowRight size={10} />
              </button>
              <button title="연결 해제" onClick={() => commit((p) => unlinkRealization(p, selectedEntity.id!, e.id))}>
                <X size={10} />
              </button>
            </span>
          ))}
          <button className="btn btn-primary trace-action" onClick={() => refine(selectedEntity.id!)}>
            {logicalRealizations(project, selectedEntity.id!).length ? '같은 이름의 논리 엔터티로 이동/생성' : '논리 모델로 상세화'}
          </button>
          <LinkSelect
            label="기존 논리 엔터티 연결…"
            options={project.entities.filter((e) => !logicalRealizations(project, selectedEntity.id!).some((x) => x.id === e.id))}
            onPick={(id) => commit((p) => linkRealization(p, selectedEntity.id!, id))}
          />
        </TraceBox>
      ) : (
        <TraceBox title="개념 모델 연결">
          {conceptualSources(project, selectedEntity.id!).map((c) => (
            <span key={c.id} className="trace-chip">
              <button onClick={() => navigateTo('conceptual', c.id)}>
                {c.name} <ArrowRight size={10} />
              </button>
              <button title="연결 해제" onClick={() => commit((p) => unlinkRealization(p, c.id, selectedEntity.id!))}>
                <X size={10} />
              </button>
            </span>
          ))}
          {!conceptualSources(project, selectedEntity.id!).length && <div className="trace-empty">연결된 개념 엔터티가 없습니다.</div>}
          <LinkSelect
            label="개념 엔터티 연결…"
            options={project.conceptual.entities.filter((c) => !c.realizes?.includes(selectedEntity.id!))}
            onPick={(id) => commit((p) => linkRealization(p, id, selectedEntity.id!))}
          />
        </TraceBox>
      )}
      <TraceBox title="포함된 다이어그램">
        {diagramsContaining(project, modelLevel, selectedEntity.id!).map((d) => (
          <span key={d.id} className="trace-chip">
            <button onClick={() => navigateTo(modelLevel, selectedEntity.id!, d.id)} style={{ fontWeight: d.id === diagram.id ? 700 : 400 }}>
              {d.name}
            </button>
          </span>
        ))}
        <LinkSelect
          label="다른 다이어그램에 추가…"
          options={project.diagrams
            .filter((d) => d.level === modelLevel && !d.includeAll && !diagramMemberIds(project, d).has(selectedEntity.id!))
            .map((d) => ({ id: d.id, name: d.name }))}
          onPick={(id) => commit((p) => addToDiagram(p, id, [selectedEntity.id!]))}
        />
        {!diagram.includeAll && diagram.members.includes(selectedEntity.id!) && (
          <button
            className="btn trace-action"
            onClick={() => {
              commit((p) => removeFromDiagram(p, diagram.id, [selectedEntity.id!]));
              ws.selectEntity(null);
            }}
          >
            현재 다이어그램에서 제거 (모델에는 유지)
          </button>
        )}
      </TraceBox>
    </>
  );

  const modelExtras = (
    <div className="quick-tips" style={{ marginTop: 24 }}>
      <strong>사용법</strong>
      <p>• 엔터티는 프로젝트에 한 번만 정의되고, 다이어그램은 그 엔터티를 보여 주는 뷰입니다.</p>
      <p>• 상단 탭으로 개념 → 논리 → 물리 → DDL을 오가면 선택한 엔터티가 연결된 단계로 따라갑니다.</p>
      <p>• 개념 엔터티를 더블클릭하면 연결된 논리 엔터티로 이동하거나 상세화합니다.</p>
    </div>
  );

  /* -------------------------------- render -------------------------------- */
  const canUndo = ws.past.length > 0;
  const canRedo = ws.future.length > 0;
  const saveLabel = { saved: '저장됨', pending: '변경됨', saving: '저장 중…', error: '저장 실패' }[ws.saveState];

  return (
    <div className="modeler-container">
      <header className="modeler-header">
        <div className="header-title-section" style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <Database size={20} />
          <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>MinsDBModeler</h1>
          <div className="project-badge" title={ws.root || ''}>
            <strong>{project.config.name}</strong>
            <span className={`save-state ${ws.saveState}`} title={ws.saveError || ws.root || ''}>
              {saveLabel}
            </span>
          </div>
          <button className="btn btn-icon" title="새 프로젝트" onClick={() => ws.close()}>
            <FolderPlus size={15} />
          </button>
          <button
            className="btn btn-icon"
            title="다른 프로젝트 열기"
            onClick={async () => {
              const root = await projectFs.pickFolder('프로젝트 폴더 열기');
              if (root) openProjectAt(root).catch((e) => alert(e?.message || String(e)));
            }}
          >
            <FolderOpen size={15} />
          </button>
          <button className="btn btn-icon" title="시작 화면" onClick={() => ws.close()}>
            <Home size={15} />
          </button>
        </div>
        <div className="header-actions">
          <button className="btn btn-icon" title="되돌리기 (Ctrl+Z)" disabled={!canUndo} onClick={ws.undo} style={{ opacity: canUndo ? 1 : 0.4 }}>
            <Undo2 size={16} />
          </button>
          <button className="btn btn-icon" title="다시 실행 (Ctrl+Y)" disabled={!canRedo} onClick={ws.redo} style={{ opacity: canRedo ? 1 : 0.4 }}>
            <Redo2 size={16} />
          </button>
          <span className="header-sep" />
          <button className={`btn ${activeTab === 'split' ? 'btn-primary' : ''}`} onClick={() => setActiveTab(activeTab === 'split' ? 'canvas' : 'split')}>
            <FileCode size={16} /> YAML
          </button>
          <button className="btn" onClick={handleAutoLayout} disabled={level === 'ddl'}>
            <RefreshCw size={16} /> 자동 배치
          </button>
          <span className="header-sep" />
          <label className="btn btn-secondary" title="YAML, DA#(.dax/.damx), DDL(.sql) 파일을 프로젝트로 가져오기 (새 다이어그램 생성)">
            <Upload size={16} /> 가져오기
            <input type="file" accept=".yaml,.yml,.dax,.damx,.sql,.ddl" className="hidden-file-input" onChange={handleFileImport} />
          </label>
          <button className="btn btn-secondary" onClick={() => setIsDdlModalOpen(true)}>
            <Database size={16} /> DDL 리버스
          </button>
          <button className="btn btn-secondary" onClick={() => setIsDaBridgeOpen(true)} style={{ color: '#8b5cf6', borderColor: '#8b5cf6' }}>
            <Sparkles size={16} /> DA# 브릿지
          </button>
          <span className="header-sep" />
          <button className="btn btn-secondary" onClick={() => setIsDictOpen(true)}>
            <BookOpen size={16} /> 표준화 사전
          </button>
          <button className="btn btn-secondary" onClick={() => setIsLinterOpen(true)} style={{ color: '#10b981', borderColor: '#10b981' }}>
            <ShieldCheck size={16} /> 모델 검토
          </button>
          <button className="btn btn-secondary" onClick={() => setIsDiscoveryOpen(true)} disabled={modelLevel !== 'logical'}>
            <Network size={16} /> 관계 찾기
          </button>
          <button className="btn btn-secondary" onClick={() => download(exportExcelXml(model), 'application/vnd.ms-excel;charset=utf-8', `${safeName}_정의서.xml`)}>
            <FileSpreadsheet size={16} /> 정의서
          </button>
          <button className="btn btn-secondary" onClick={() => download(exportMarkdownReport(model), 'text/markdown;charset=utf-8', `${safeName}_명세서.md`)}>
            <FileText size={16} /> 명세서
          </button>
        </div>
      </header>

      <div className="modeler-workspace">
        <aside className="modeler-sidebar">
          <ProjectExplorer
            project={project}
            level={modelLevel}
            activeDiagramId={diagram.id}
            selectedEntityId={selectedEntityId}
            onSelectDiagram={(id) => ws.setActiveDiagram(id)}
            onCreateDiagram={createDiagram}
            onRenameDiagram={renameDiagram}
            onDeleteDiagram={deleteDiagram}
            onSelectEntity={(lv, id) => navigateTo(lv, id)}
            onAddEntity={handleAddEntity}
          />

          <div className="sidebar-section">
            <h3>
              관계 <span className="tree-meta">{model.relationships.length}</span>
              <button className="btn btn-icon" style={{ padding: '2px 6px', fontSize: '0.75rem' }} onClick={handleAddRelationship}>
                <Plus size={14} /> 추가
              </button>
            </h3>
            <div className="relationship-list">
              {model.relationships.map((rel) => (
                <div
                  key={rel.id}
                  className="relationship-list-item"
                  onClick={() => ws.selectRelationship(rel.id)}
                  style={{
                    borderColor: selectedRelationshipId === rel.id ? 'var(--accent-color)' : undefined,
                    backgroundColor: selectedRelationshipId === rel.id ? 'rgba(59, 130, 246, 0.05)' : undefined,
                  }}
                >
                  <span style={{ fontSize: '0.75rem' }}>{rel.name || `${rel.parent} → ${rel.child}`}</span>
                  <span className="item-badge" style={{ fontSize: '0.65rem' }}>
                    {rel.cardinality === 'one_to_many' ? '1:M' : '1:1'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="sidebar-section" style={{ flex: 1 }}>
            <h3>검증</h3>
            <div className="validation-list">
              {validationErrors.length === 0 ? (
                <div className="validation-card" style={{ borderLeftColor: 'var(--success)', color: 'var(--success)' }}>
                  <CheckCircle size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                  문제 없음
                </div>
              ) : (
                validationErrors.map((err, idx) => (
                  <div key={idx} className={`validation-card ${err.severity}`}>
                    <div className="validation-card-path">{err.path}</div>
                    <div>{err.message}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        <div className="main-canvas-area">
          <div className="canvas-pane" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="level-bar">
              <div className="level-tabs">
                {LEVEL_TABS.map((t) => (
                  <button key={t.id} className={`level-tab ${level === t.id ? 'active' : ''}`} title={t.hint} onClick={() => switchLevel(t.id)}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="level-context">
                {level === 'ddl' ? (
                  <span>대상 DBMS · {project.config.targetDbms}</span>
                ) : (
                  <>
                    <span className="level-diagram">{diagram.name}</span>
                    <span className="tree-meta">
                      엔터티 {model.entities.length} · 관계 {model.relationships.length}
                    </span>
                    {level === 'physical' && (
                      <button className="btn btn-secondary" style={{ height: 26 }} onClick={() => setIsTransformOpen(true)}>
                        <FileCode size={13} /> DDL 생성
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
              {level === 'ddl' ? (
                <DdlPane
                  outputs={project.outputs}
                  targetDbms={project.config.targetDbms}
                  focusPath={ddlFocus}
                  onGenerate={() => {
                    ws.setActiveDiagram(ALL_LOGICAL_DIAGRAM_ID);
                    ws.setLevel('ddl');
                    setIsTransformOpen(true);
                  }}
                  onChange={(path, content) => commit((p) => ({ ...p, outputs: { ...p.outputs, [path]: content } }), { coalesce: `out:${path}` })}
                  onDelete={(path) =>
                    commit((p) => {
                      const outputs = { ...p.outputs };
                      delete outputs[path];
                      return { ...p, outputs };
                    })
                  }
                />
              ) : (
                <KonvaModelerCanvas
                  layout={diagramLayout}
                  relationships={model.relationships}
                  selectedEntityName={selectedEntityName}
                  selectedRelationshipId={selectedRelationshipId}
                  viewMode={level === 'physical' ? 'physical' : 'logical'}
                  onSelectEntity={(name) => ws.selectEntity(idOfName(name))}
                  onSelectRelationship={(id) => ws.selectRelationship(id)}
                  onEntityDoubleClick={handleEntityDoubleClick}
                  onRootMove={handleRootMove}
                  onRootResize={handleRootResize}
                />
              )}
              {level !== 'ddl' && model.entities.length === 0 && (
                <div className="canvas-empty">
                  <p>
                    {diagram.includeAll
                      ? `아직 ${modelLevel === 'conceptual' ? '개념 ' : ''}엔터티가 없습니다.`
                      : '이 다이어그램에 엔터티가 없습니다. 왼쪽 목록에서 엔터티를 고른 뒤 "다른 다이어그램에 추가"로 넣거나 새로 만드세요.'}
                  </p>
                  <button className="btn btn-primary" onClick={handleAddEntity}>
                    <Plus size={14} /> 엔터티 추가
                  </button>
                </div>
              )}
            </div>
          </div>

          {activeTab === 'split' && level !== 'ddl' && (
            <div className="editor-pane">
              <div className="editor-pane-header">
                {diagram.name} — YAML (편집하면 모델에 반영)
                {yamlError && <span style={{ color: 'var(--danger)', marginLeft: 8 }}>⚠ {yamlError.split('\n')[0]}</span>}
              </div>
              <div style={{ flex: 1 }}>
                <Editor
                  height="100%"
                  language="yaml"
                  theme="light"
                  value={yamlDraft ?? derivedYaml}
                  onChange={handleYamlChange}
                  options={{ minimap: { enabled: false }, fontSize: 12, lineNumbers: 'on', wordWrap: 'on', automaticLayout: true }}
                />
              </div>
            </div>
          )}
        </div>

        <aside className="modeler-detail-panel">
          <PropertiesPanel
            model={model}
            selectedEntity={selectedEntity}
            selectedRelationship={selectedRelationship}
            handleUpdateEntity={handleUpdateEntity}
            handleAddAttribute={handleAddAttribute}
            handleUpdateAttribute={handleUpdateAttribute}
            handleDeleteAttribute={handleDeleteAttribute}
            handleDeleteEntity={handleDeleteEntity}
            handleUpdateRelationship={handleUpdateRelationship}
            handleDeleteRelationship={handleDeleteRelationship}
            handleUpdateModelMeta={handleUpdateModelMeta}
            entityExtras={entityExtras}
            modelExtras={modelExtras}
          />
        </aside>
      </div>

      {isDdlModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>DDL 리버스 (SQL → 논리 모델)</h3>
              <button className="btn" style={{ padding: '4px 8px' }} onClick={() => setIsDdlModalOpen(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                CREATE TABLE / PRIMARY KEY / FOREIGN KEY / COMMENT ON 구문을 붙여넣으면 프로젝트에 병합하고 새 다이어그램을 만듭니다. 같은 이름의 엔터티는 하나로 합쳐집니다.
              </p>
              <textarea
                className="form-control"
                style={{ height: 240, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
                placeholder={'CREATE TABLE USERS (\n  USER_ID INT PRIMARY KEY,\n  USERNAME VARCHAR(50) NOT NULL\n);'}
                value={ddlImportText}
                onChange={(e) => setDdlImportText(e.target.value)}
              />
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setIsDdlModalOpen(false)}>
                취소
              </button>
              <button className="btn btn-primary" onClick={handleDdlImport}>
                <Database size={14} /> 가져오기
              </button>
            </div>
          </div>
        </div>
      )}

      {isDictOpen && <DictionaryManager model={model} projectFiles={legacyFiles} onUpdateFile={handleUpdateStandardsFile} onClose={() => setIsDictOpen(false)} />}

      {isTransformOpen && (
        <PhysicalTransformWizard
          model={deriveView(project, project.diagrams.find((d) => d.id === activeDiagram.logical) || project.diagrams.find((d) => d.id === ALL_LOGICAL_DIAGRAM_ID)!)}
          projectFiles={legacyFiles}
          activeFileName={outputBase}
          onClose={() => setIsTransformOpen(false)}
          onSavePhysicalFile={handleSaveOutput}
        />
      )}

      <ModelLinterModal
        isOpen={isLinterOpen}
        onClose={() => setIsLinterOpen(false)}
        model={model}
        onSelectEntity={(name) => {
          ws.selectEntity(idOfName(name));
          setIsLinterOpen(false);
        }}
      />

      <RelationshipDiscoveryModal
        isOpen={isDiscoveryOpen}
        onClose={() => setIsDiscoveryOpen(false)}
        model={model}
        onApplyRelationships={(rels) => {
          if (rels.length) applyModel({ ...model, relationships: [...model.relationships, ...rels] });
          setIsDiscoveryOpen(false);
        }}
      />

      <DaBridgeModal
        isOpen={isDaBridgeOpen}
        onClose={() => setIsDaBridgeOpen(false)}
        currentModel={model}
        onLoadModel={(loaded, source) => {
          setIsDaBridgeOpen(false);
          importIntoProject(loaded, source);
        }}
      />
    </div>
  );
}

/* ========================================================================== */

function TraceBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="trace-box">
      <label>
        <Link2 size={12} /> {title}
      </label>
      <div className="trace-body">{children}</div>
    </div>
  );
}

function LinkSelect({ label, options, onPick }: { label: string; options: { id: string; name: string }[]; onPick: (id: string) => void }) {
  if (!options.length) return null;
  return (
    <select
      className="form-control trace-select"
      value=""
      onChange={(e) => {
        if (e.target.value) onPick(e.target.value);
      }}
    >
      <option value="">{label}</option>
      {[...options]
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
        .map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
    </select>
  );
}
