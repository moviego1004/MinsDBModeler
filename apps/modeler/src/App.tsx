import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import KonvaModelerCanvas from './components/KonvaModelerCanvas.js';
import Editor from '@monaco-editor/react';
import { 
  Upload, 
  Download, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Database,
  CheckCircle,
  FileCode,
  Edit2,
  Undo2,
  Redo2,
  BookOpen,
  ShieldCheck,
  Network,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  Package,
  Sparkles
} from 'lucide-react';
import {
  getProjects,
  saveProjects,
  getActiveProjectId,
  setActiveProjectId,
  createProject,
  renameProject,
  deleteProject
} from './services/projectStorage.js';
import type { Project } from './services/projectStorage.js';
import {
  parseModel,
  stringifyModel,
  validateModel,
  parseDdl,
  exportExcelXml,
  exportMarkdownReport,
  exportProjectBundle,
  importProjectBundle,
  createZipBundle,
  readZipBundle,
  parseDaNativeFile,
} from '@barker-modeler/model-core';
import type {
  LogicalModel,
  Entity,
  Attribute,
  Relationship,
  ValidationError
} from '@barker-modeler/model-core';

import { DEFAULT_MODEL_YAML } from './defaultModel.js';

import DictionaryManager from './components/DictionaryManager.js';
import PhysicalTransformWizard from './components/PhysicalTransformWizard.js';
import ModelLinterModal from './components/ModelLinterModal.js';
import RelationshipDiscoveryModal from './components/RelationshipDiscoveryModal.js';
import DaBridgeModal from './components/DaBridgeModal.js';
import { parse as yamlParse } from 'yaml';
import { 
  getDictionary, 
  translateLogicalName, 
  resolveDataType 
} from './services/dictionaryStorage.js';



// Default layout offsets and sizes
const NODE_WIDTH = 250;
const ATTR_HEIGHT = 24;
const HEADER_HEIGHT = 36;
const PADDING = 20;

export default function App() {
  const [yamlText, setYamlText] = useState<string>(DEFAULT_MODEL_YAML);
  const [model, setModel] = useState<LogicalModel>(() => parseModel(DEFAULT_MODEL_YAML));
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [selectedEntityName, setSelectedEntityName] = useState<string | null>(null);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'canvas' | 'split'>('canvas');
  const [isDdlModalOpen, setIsDdlModalOpen] = useState(false);
  const [ddlImportText, setDdlImportText] = useState('');
  const [layoutTrigger, setLayoutTrigger] = useState(0);
  const lastProcessedLayoutTrigger = useRef(-1);

  // Project state
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const [activeFileName, setActiveFileName] = useState<string | null>(null);
  const [refineTargetFile, setRefineTargetFile] = useState<string>('');
  const [isDictOpen, setIsDictOpen] = useState(false);
  const [isTransformOpen, setIsTransformOpen] = useState(false);
  const [isLinterOpen, setIsLinterOpen] = useState(false);
  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
  const [isDaBridgeOpen, setIsDaBridgeOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'logical' | 'physical'>('logical');

  // Undo/Redo history state
  const [historyState, setHistoryState] = useState<{
    history: { yaml: string; layout?: Record<string, { x: number; y: number }> }[];
    index: number;
  }>({ history: [], index: -1 });

  const isUndoRedoAction = useRef(false);

  const initHistory = useCallback((yaml: string, layout?: Record<string, { x: number; y: number }>) => {
    setHistoryState({
      history: [{ yaml, layout }],
      index: 0
    });
  }, []);

  const pushHistory = useCallback((yaml: string, layout?: Record<string, { x: number; y: number }>) => {
    setHistoryState(prev => {
      // Truncate future states if we had performed Undos
      const truncatedHistory = prev.history.slice(0, prev.index + 1);
      
      // Avoid duplicate consecutive entries
      const last = truncatedHistory[truncatedHistory.length - 1];
      if (last && last.yaml === yaml && JSON.stringify(last.layout) === JSON.stringify(layout)) {
        return prev;
      }
      
      const newHistory = [...truncatedHistory, { yaml, layout }];
      if (newHistory.length > 50) {
        newHistory.shift();
      }
      return {
        history: newHistory,
        index: newHistory.length - 1
      };
    });
  }, []);

  // Konva Canvas state
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);

  const onNodesChange = useCallback((changes: any[]) => {
    setNodes((nds) => {
      let updated = [...nds];
      changes.forEach((change) => {
        if (change.type === 'position') {
          updated = updated.map((node) =>
            node.id === change.id
              ? { ...node, position: { ...node.position, ...change.position } }
              : node
          );
        } else if (change.type === 'dimensions') {
          updated = updated.map((node) =>
            node.id === change.id
              ? { ...node, width: change.dimensions.width, height: change.dimensions.height }
              : node
          );
        }
      });
      return updated;
    });
  }, []);


  const nodesRef = useRef<any>([]);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Load projects from storage on mount
  useEffect(() => {
    const loadedProjects = getProjects();
    setProjects(loadedProjects);
    let activeId = getActiveProjectId();
    if (!activeId || !loadedProjects.some(p => p.id === activeId)) {
      activeId = loadedProjects[0]?.id || null;
      setActiveProjectId(activeId);
    }
    setActiveProjectIdState(activeId);
  }, []);

  const activeProject = useMemo(() => {
    return projects.find(p => p.id === activeProjectId) || null;
  }, [projects, activeProjectId]);

  const projectFiles = useMemo(() => {
    return activeProject ? activeProject.files : [];
  }, [activeProject]);

  const getFileDisplayName = (file: any) => {
    if (!file) return '';
    const filename = file.name;
    
    if (filename === 'standardization/dictionary.yaml') {
      return '표준 단어/용어 사전';
    }
    if (filename === 'standardization/domains.yaml') {
      return '표준 도메인 정의서';
    }
    if (filename === 'dbproject.yaml') {
      return '프로젝트 환경 설정';
    }

    if (filename.endsWith('.sql') || filename.endsWith('.ddl')) {
      const base = filename.split('/').pop() || filename;
      return `SQL DDL 추출 사양서 (${base})`;
    }

    if (filename.endsWith('.yaml') || filename.endsWith('.yml')) {
      try {
        const subjectAreaMatch = file.content.match(/subject_area\s*:\s*['"]?([^'"\n\r]+)['"]?/);
        if (subjectAreaMatch && subjectAreaMatch[1]) {
          return subjectAreaMatch[1].trim();
        }
        const subjectMatch = file.content.match(/subject\s*:\s*['"]?([^'"\n\r]+)['"]?/);
        if (subjectMatch && subjectMatch[1]) {
          return subjectMatch[1].trim();
        }
      } catch {}
    }

    return filename.split('/').pop() || filename;
  };

  const getFolderDisplayName = (folder: string) => {
    const mapping: Record<string, string> = {
      conceptual: '개념 모델링 (Conceptual)',
      logical: '논리 모델링 / 주제 영역 (Logical)',
      physical: '물리 테이블 사양 / DDL (Physical)',
      standardization: '데이터 표준화 정의 (Standardization)',
    };
    return mapping[folder.toLowerCase()] || folder;
  };

  const groupedFiles = useMemo(() => {
    const groups: Record<string, any[]> = {};
    const rootFiles: any[] = [];

    projectFiles.forEach((file: any) => {
      if (file.name.includes('/')) {
        const parts = file.name.split('/');
        const folder = parts[0];
        if (!groups[folder]) {
          groups[folder] = [];
        }
        groups[folder].push(file);
      } else {
        rootFiles.push(file);
      }
    });

    return { groups, rootFiles };
  }, [projectFiles]);

  const isActiveFileSql = useMemo(() => {
    return activeFileName ? (activeFileName.endsWith('.sql') || activeFileName.endsWith('.ddl')) : false;
  }, [activeFileName]);

  // Set activeFileName when active project changes
  useEffect(() => {
    if (activeProject) {
      if (activeProject.activeFileName && activeProject.files.some((f: any) => f.name === activeProject.activeFileName)) {
        setActiveFileName(activeProject.activeFileName);
      } else if (activeProject.files.length > 0) {
        setActiveFileName(activeProject.files[0].name);
      } else {
        setActiveFileName(null);
      }
    } else {
      setActiveFileName(null);
    }
  }, [activeProjectId, activeProject]);

  // Load file content when activeFileName changes
  useEffect(() => {
    if (!activeFileName || !activeProject) return;
    const fileObj = activeProject.files.find((f: any) => f.name === activeFileName);
    if (fileObj) {
      isUndoRedoAction.current = true; // Prevent pushing loaded content as new history state
      setYamlText(fileObj.content);
      initHistory(fileObj.content, fileObj.layout);
      setViewMode('logical');

      if (activeFileName.endsWith('.yaml') || activeFileName.endsWith('.yml')) {
        try {
          const parsed = parseModel(fileObj.content);
          setModel(parsed);
          setValidationErrors(validateModel(parsed, { allowUndefinedEntities: true }));
        } catch (err: any) {
          setValidationErrors([
            {
              path: 'YAML Parser',
              message: err.message || 'Syntax error in YAML',
              severity: 'error',
            },
          ]);
        }
      } else {
        setValidationErrors([]);
      }
    }
  }, [activeFileName, activeProjectId, initHistory]);

  // Auto-save to localStorage when yamlText changes
  useEffect(() => {
    if (!activeProjectId || !activeFileName) return;
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      // Gather current layout from view state
      const layoutMap: Record<string, { x: number; y: number }> = {};
      nodesRef.current.forEach((n: any) => {
        layoutMap[n.id] = { x: n.position.x, y: n.position.y };
      });

      setProjects(prevProjects => {
        const updated = prevProjects.map(proj => {
          if (proj.id === activeProjectId) {
            const filesUpdated = proj.files.map((f: any) => {
              if (f.name === activeFileName) {
                return { ...f, content: yamlText, layout: layoutMap };
              }
              return f;
            });
            return { ...proj, files: filesUpdated, activeFileName };
          }
          return proj;
        });
        saveProjects(updated);
        return updated;
      });

      // Track this state in Undo/Redo history
      pushHistory(yamlText, layoutMap);
    }, 500); // 500ms debounce
    return () => clearTimeout(timeout);
  }, [yamlText, activeFileName, activeProjectId, pushHistory]);

  // Switch active file
  const handleSelectFile = useCallback((name: string) => {
    setActiveFileName(name);
    if (activeProjectId) {
      setProjects(prevProjects => {
        const updated = prevProjects.map(proj => {
          if (proj.id === activeProjectId) {
            return { ...proj, activeFileName: name };
          }
          return proj;
        });
        saveProjects(updated);
        return updated;
      });
    }
  }, [activeProjectId]);

  // Create new file in project
  const handleNewFile = useCallback(() => {
    if (!activeProjectId) return;
    
    const name = prompt('새 파일 이름을 입력하세요 (예: qvi-billing-logical.yaml 또는 schema.sql):');
    if (!name) return;
    
    const hasExtension = name.endsWith('.yaml') || name.endsWith('.yml') || name.endsWith('.sql') || name.endsWith('.ddl');
    const filename = hasExtension ? name : `${name}.yaml`;
    
    if (projectFiles.some((f: any) => f.name === filename)) {
      alert('이미 존재하는 파일 이름입니다.');
      return;
    }
    
    const isSql = filename.endsWith('.sql') || filename.endsWith('.ddl');
    const initialContent = isSql ? `-- New SQL DDL File\n\n` : `subject_area: ${filename.replace(/[-_]/g, ' ').replace('.yaml', '').replace('.yml', '')}
notation: Barker logical model
version: 0.1
status: draft
entities: []
relationships: []
`;
    
    setProjects(prevProjects => {
      const updated = prevProjects.map(proj => {
        if (proj.id === activeProjectId) {
          return {
            ...proj,
            activeFileName: filename,
            files: [...proj.files, { name: filename, content: initialContent }]
          };
        }
        return proj;
      });
      saveProjects(updated);
      return updated;
    });
    
    setActiveFileName(filename);
    setYamlText(initialContent);
  }, [activeProjectId, projectFiles]);

  // Rename file in project
  const handleRenameFile = useCallback((oldName: string) => {
    if (!activeProjectId) return;
    const newName = prompt('새 파일 이름을 입력하세요:', oldName);
    if (!newName || newName === oldName) return;

    if (projectFiles.some((f: any) => f.name === newName)) {
      alert('이미 존재하는 파일 이름입니다.');
      return;
    }

    setProjects(prevProjects => {
      const updated = prevProjects.map(proj => {
        if (proj.id === activeProjectId) {
          const filesUpdated = proj.files.map((f: any) => {
            if (f.name === oldName) {
              return { ...f, name: newName };
            }
            return f;
          });
          const nextActiveFile = proj.activeFileName === oldName ? newName : proj.activeFileName;
          return {
            ...proj,
            activeFileName: nextActiveFile,
            files: filesUpdated
          };
        }
        return proj;
      });
      saveProjects(updated);
      return updated;
    });

    if (activeFileName === oldName) {
      setActiveFileName(newName);
    }
  }, [activeProjectId, projectFiles, activeFileName]);

  // Delete file from project
  const handleDeleteFile = useCallback((filename: string) => {
    if (!activeProjectId) return;
    if (projectFiles.length <= 1) {
      alert('프로젝트에 최소 하나의 파일은 존재해야 합니다.');
      return;
    }
    if (!confirm(`"${filename}" 파일을 정말 삭제하시겠습니까?`)) return;

    setProjects(prevProjects => {
      const updated = prevProjects.map(proj => {
        if (proj.id === activeProjectId) {
          const filesUpdated = proj.files.filter((f: any) => f.name !== filename);
          const nextActiveFile = proj.activeFileName === filename ? filesUpdated[0]?.name : proj.activeFileName;
          return {
            ...proj,
            activeFileName: nextActiveFile,
            files: filesUpdated
          };
        }
        return proj;
      });
      saveProjects(updated);
      return updated;
    });
  }, [activeProjectId, projectFiles]);

  // Refine conceptual entity into detailed logical model
  const handleRefineEntity = useCallback(async (entityName: string, targetFileName: string) => {
    if (!targetFileName) {
      alert('대상 상세 모델 파일을 선택해 주세요.');
      return;
    }

    const conceptualEntity = model.entities.find(e => e.name === entityName);
    if (!conceptualEntity) return;

    const fileObj = projectFiles.find((f: any) => f.name === targetFileName);
    if (!fileObj) return;

    try {
      const targetModel = parseModel(fileObj.content);
      
      if (targetModel.entities.some(e => e.name === entityName)) {
        alert(`대상 파일 "${targetFileName}"에 이미 "${entityName}" 엔터티가 존재합니다.`);
        return;
      }

      const newAttributes: Attribute[] = [];
      if (Array.isArray(conceptualEntity.key_attributes)) {
        conceptualEntity.key_attributes.forEach((attrName, index) => {
          const isPk = index === 0 || attrName.endsWith('번호') || attrName.endsWith('식별자') || attrName.endsWith('ID') || attrName.endsWith('id');
          newAttributes.push({
            name: attrName,
            domain: isPk ? '번호' : '구분',
            required: true,
            identifier: isPk ? true : undefined,
          });
        });
      }

      const newEntity: Entity = {
        name: entityName,
        type: conceptualEntity.type || 'entity',
        supertype: conceptualEntity.supertype,
        identifier: newAttributes.filter(a => a.identifier).map(a => a.name),
        attributes: newAttributes,
      };

      const updatedTargetModel = {
        ...targetModel,
        entities: [...targetModel.entities, newEntity],
      };

      const yaml = stringifyModel(updatedTargetModel);
      
      setProjects(prevProjects => {
        const updated = prevProjects.map(proj => {
          if (proj.id === activeProjectId) {
            const filesUpdated = proj.files.map((f: any) => {
              if (f.name === targetFileName) {
                return { ...f, content: yaml };
              }
              return f;
            });
            return { ...proj, files: filesUpdated };
          }
          return proj;
        });
        saveProjects(updated);
        return updated;
      });

      handleSelectFile(targetFileName);
      setSelectedEntityName(entityName);
      
      alert(`"${entityName}" 엔터티를 "${targetFileName}" 상세 모델로 성공적으로 상세화(Refine)하여 이동했습니다!`);
    } catch (e: any) {
      alert(`상세화 처리 중 오류가 발생했습니다: ${e.message}`);
    }
  }, [model, projectFiles, handleSelectFile, activeProjectId]);

  // Parse YAML to Model and run validation
  const updateModelFromYaml = useCallback((yaml: string) => {
    try {
      const parsed = parseModel(yaml);
      setModel(parsed);
      const errors = validateModel(parsed, { allowUndefinedEntities: true });
      setValidationErrors(errors);
      return parsed;
    } catch (err: any) {
      setValidationErrors([
        {
          path: 'YAML Parser',
          message: err.message || 'Syntax error in YAML',
          severity: 'error',
        },
      ]);
      return null;
    }
  }, []);

  // Undo implementation
  const handleUndo = useCallback(() => {
    if (historyState.index <= 0) return;
    
    const prevIndex = historyState.index - 1;
    const targetState = historyState.history[prevIndex];
    
    isUndoRedoAction.current = true;
    setYamlText(targetState.yaml);
    updateModelFromYaml(targetState.yaml);
    
    if (activeProjectId && activeFileName) {
      setProjects(prevProjects => {
        const updated = prevProjects.map(proj => {
          if (proj.id === activeProjectId) {
            const filesUpdated = proj.files.map((f: any) => {
              if (f.name === activeFileName) {
                return { ...f, content: targetState.yaml, layout: targetState.layout };
              }
              return f;
            });
            return { ...proj, files: filesUpdated };
          }
          return proj;
        });
        saveProjects(updated);
        return updated;
      });
    }
    
    setHistoryState(prev => ({ ...prev, index: prevIndex }));
  }, [historyState, activeProjectId, activeFileName, updateModelFromYaml]);

  // Redo implementation
  const handleRedo = useCallback(() => {
    if (historyState.index >= historyState.history.length - 1) return;
    
    const nextIndex = historyState.index + 1;
    const targetState = historyState.history[nextIndex];
    
    isUndoRedoAction.current = true;
    setYamlText(targetState.yaml);
    updateModelFromYaml(targetState.yaml);
    
    if (activeProjectId && activeFileName) {
      setProjects(prevProjects => {
        const updated = prevProjects.map(proj => {
          if (proj.id === activeProjectId) {
            const filesUpdated = proj.files.map((f: any) => {
              if (f.name === activeFileName) {
                return { ...f, content: targetState.yaml, layout: targetState.layout };
              }
              return f;
            });
            return { ...proj, files: filesUpdated };
          }
          return proj;
        });
        saveProjects(updated);
        return updated;
      });
    }
    
    setHistoryState(prev => ({ ...prev, index: nextIndex }));
  }, [historyState, activeProjectId, activeFileName, updateModelFromYaml]);

  // Sync editor changes with model
  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setYamlText(value);
      updateModelFromYaml(value);
    }
  }, [updateModelFromYaml]);

  // Sync model changes back to editor text
  const syncModelToYaml = useCallback((updatedModel: LogicalModel) => {
    try {
      const yaml = stringifyModel(updatedModel);
      setYamlText(yaml);
      setModel(updatedModel);
      
      // Update in projects list
      if (activeProjectId && activeFileName) {
        setProjects(prevProjects => {
          const updated = prevProjects.map(proj => {
            if (proj.id === activeProjectId) {
              const filesUpdated = proj.files.map((f: any) => {
                if (f.name === activeFileName) {
                  return { ...f, content: yaml };
                }
                return f;
              });
              return { ...proj, files: filesUpdated };
            }
            return proj;
          });
          saveProjects(updated);
          return updated;
        });
      }
      
      const errors = validateModel(updatedModel, { allowUndefinedEntities: true });
      setValidationErrors(errors);
    } catch (err) {
      console.error('Failed to stringify model', err);
    }
  }, [activeProjectId, activeFileName]);

  // Gather all entities defined in any project files
  const allProjectEntities = useMemo(() => {
    const entities: Entity[] = [];
    const addedNames = new Set<string>();
    projectFiles.forEach((f: any) => {
      try {
        const parsed = parseModel(f.content);
        parsed.entities.forEach(ent => {
          if (!addedNames.has(ent.name)) {
            entities.push(ent);
            addedNames.add(ent.name);
          }
        });
      } catch (e) {
        // ignore
      }
    });
    return entities;
  }, [projectFiles]);

  // Compute nested layouts for Barker subtypes recursively
  const computeHierarchyLayouts = useCallback((
    entityMap: Map<string, Entity>,
    parentToChildren: Map<string, string[]>,
    roots: string[]
  ) => {
    const layoutDetails = new Map<string, { width: number; height: number; localX?: number; localY: number }>();

    // Helper to calculate size of a branch
    function getBranchSize(name: string): { width: number; height: number } {
      const ent = entityMap.get(name);
      if (!ent) return { width: NODE_WIDTH, height: 100 };

      const selfAttrHeight = HEADER_HEIGHT + ent.attributes.length * ATTR_HEIGHT + 10;
      
      // Determine subtype sets
      let sets: { name: string; subtypes: string[] }[] = [];
      if (ent.subtype_sets && ent.subtype_sets.length > 0) {
        sets = ent.subtype_sets;
      } else {
        // Fallback: collect all subtypes in the active model that list this entity as supertype
        const childNames = parentToChildren.get(name) || [];
        if (childNames.length > 0) {
          sets = [{
            name: ent.discriminator || '구분',
            subtypes: childNames
          }];
        }
      }

      if (sets.length === 0) {
        // Leaf entity
        const size = { width: NODE_WIDTH + PADDING * 2, height: selfAttrHeight + PADDING * 2 };
        layoutDetails.set(name, { ...size, localY: 0 });
        return size;
      }

      // If it has subtype sets, we lay them out vertically inside the supertype
      let currentSetY = selfAttrHeight + PADDING * 2;
      let maxSetWidth = NODE_WIDTH;
      let totalSetsHeight = selfAttrHeight + PADDING * 2;

      sets.forEach(set => {
        // For each subtype in the set, get its size
        const subSizes = set.subtypes.map(subName => {
          return { name: subName, ...getBranchSize(subName) };
        });

        // Arrange subtypes horizontally inside the set
        let setWidth = PADDING * 2;
        let maxSubHeight = 60;
        subSizes.forEach(sub => {
          setWidth += sub.width + PADDING;
          if (sub.height > maxSubHeight) {
            maxSubHeight = sub.height;
          }
        });
        setWidth -= PADDING; // remove trailing padding
        if (setWidth < NODE_WIDTH) {
          setWidth = NODE_WIDTH;
        }

        const LABEL_HEIGHT = 24;
        const setHeight = maxSubHeight + LABEL_HEIGHT + PADDING * 2;

        // Position subtypes horizontally inside this set
        let currentSubX = PADDING;
        subSizes.forEach(sub => {
          layoutDetails.set(sub.name, {
            width: sub.width,
            height: sub.height,
            localX: currentSubX,
            localY: LABEL_HEIGHT + PADDING
          });
          currentSubX += sub.width + PADDING;
        });

        // Save layout size for the subtype set box itself
        const setId = `set-${name}-${set.name}`;
        layoutDetails.set(setId, {
          width: setWidth,
          height: setHeight,
          localX: PADDING,
          localY: currentSetY
        });

        currentSetY += setHeight + PADDING;
        if (setWidth > maxSetWidth) {
          maxSetWidth = setWidth;
        }
      });

      totalSetsHeight = currentSetY;

      const finalSize = {
        width: maxSetWidth + PADDING * 2,
        height: totalSetsHeight
      };
      layoutDetails.set(name, { ...finalSize, localY: 0 });
      return finalSize;
    }

    // Run size calculations for all roots
    roots.forEach(root => getBranchSize(root));
    return layoutDetails;
  }, []);

  // Generate React Flow Nodes and Edges from the logical model
  useEffect(() => {
    const entityMap = new Map<string, Entity>();
    
    // 1. Add active entities to map
    model.entities.forEach(ent => entityMap.set(ent.name, ent));

    // 2. Scan relationships for external entities in projectFiles
    const activeNames = new Set(model.entities.map(e => e.name));
    
    model.relationships.forEach(rel => {
      // Check parent
      if (!activeNames.has(rel.parent)) {
        const extEnt = allProjectEntities.find(e => e.name === rel.parent);
        if (extEnt && !entityMap.has(rel.parent)) {
          entityMap.set(rel.parent, {
            ...extEnt,
            type: 'entity',
            attributes: extEnt.attributes.map(a => ({ ...a })),
            subtype_sets: undefined
          });
        }
      }
      
      // Check child
      if (!activeNames.has(rel.child)) {
        const extEnt = allProjectEntities.find(e => e.name === rel.child);
        if (extEnt && !entityMap.has(rel.child)) {
          entityMap.set(rel.child, {
            ...extEnt,
            type: 'entity',
            attributes: extEnt.attributes.map(a => ({ ...a })),
            subtype_sets: undefined
          });
        }
      }
    });

    // Parse project dictionary and target DB config for physical rendering
    const dictionaryFile = projectFiles.find(f => f.name === 'standardization/dictionary.yaml');
    const domainsFile = projectFiles.find(f => f.name === 'standardization/domains.yaml');
    let activeDict = getDictionary();
    if (dictionaryFile || domainsFile) {
      try {
        const dictYaml = dictionaryFile ? (yamlParse(dictionaryFile.content) as any) || {} : {};
        const domainsYaml = domainsFile ? (yamlParse(domainsFile.content) as any) || {} : {};
        
        const words = Array.isArray(dictYaml.words) 
          ? dictYaml.words.map((w: any) => ({
              logicalName: w.logicalName || w.logical || '',
              physicalAbbr: w.physicalAbbr || w.physical || ''
            }))
          : [];

        const terms = Array.isArray(dictYaml.terms)
          ? dictYaml.terms.map((t: any) => ({
              logicalName: t.logicalName || t.logical || '',
              physicalName: t.physicalName || t.physical || ''
            }))
          : [];

        const domains = Array.isArray(domainsYaml.domains)
          ? domainsYaml.domains.map((d: any) => ({
              logicalName: d.logicalName || d.logical || d.name || '',
              physicalName: d.physicalName || d.physical || d.type || ''
            }))
          : [];

        activeDict = {
          domains,
          words,
          terms,
          codes: dictYaml.codes || []
        };
      } catch {}
    }

    const configFile = projectFiles.find(f => f.name === 'dbproject.yaml');
    let dbType: 'ORACLE' | 'POSTGRES' | 'MYSQL' = 'ORACLE';
    if (configFile) {
      try {
        const configYaml = yamlParse(configFile.content) || {};
        const target = String(configYaml.target_db || '').toUpperCase();
        if (target.includes('POSTGRES')) dbType = 'POSTGRES';
        else if (target.includes('MYSQL')) dbType = 'MYSQL';
      } catch {}
    }

    // Map parent to children subtypes (only for active ones, as external ones are root in this context)
    const parentToChildren = new Map<string, string[]>();
    model.entities.forEach(ent => {
      if (ent.supertype) {
        const list = parentToChildren.get(ent.supertype) || [];
        list.push(ent.name);
        parentToChildren.set(ent.supertype, list);
      }
    });

    // Identify roots of hierarchy (entities that are not subtypes in the active model, or are external)
    const roots = Array.from(entityMap.keys()).filter(name => {
      const ent = entityMap.get(name);
      return ent ? !ent.supertype : true;
    });

    // Compute layout sizes
    const layouts = computeHierarchyLayouts(entityMap, parentToChildren, roots);

    const activeFile = projectFiles.find((f: any) => f.name === activeFileName);
    const savedLayout = activeFile?.layout || {};

    // Map existing positions & sizes to preserve them if not resetting
    const existingPositions = new Map<string, { x: number; y: number; width?: number; height?: number }>();
    const isReset = lastProcessedLayoutTrigger.current !== layoutTrigger;
    
    if (isReset) {
      lastProcessedLayoutTrigger.current = layoutTrigger;
      // Do not load any existing or saved positions, recalculate fresh!
    } else {
      // 1. Populate from saved positions from the file (Priority 1)
      Object.keys(savedLayout).forEach(id => {
        const item = savedLayout[id] as any;
        if (item && typeof item.x === 'number' && !isNaN(item.x) && typeof item.y === 'number' && !isNaN(item.y)) {
          const validated: any = { x: item.x, y: item.y };
          if (typeof item.width === 'number' && !isNaN(item.width)) validated.width = item.width;
          if (typeof item.height === 'number' && !isNaN(item.height)) validated.height = item.height;
          existingPositions.set(id, validated);
        }
      });
      // 2. Populate from viewport positions (Priority 2)
      nodesRef.current.forEach((n: any) => {
        if (!existingPositions.has(n.id) && n?.position) {
          existingPositions.set(n.id, {
            x: n.position.x ?? 0,
            y: n.position.y ?? 0,
            width: n.width,
            height: n.height
          });
        }
      });
    }

    // Helper to gather all attributes from supertype ancestors
    const getAncestorAttributeNames = (entName: string): Set<string> => {
      const names = new Set<string>();
      let current = entityMap.get(entName);
      while (current && current.supertype) {
        const parent = entityMap.get(current.supertype);
        if (parent) {
          parent.attributes.forEach(a => names.add(a.name));
          current = parent;
        } else {
          break;
        }
      }
      return names;
    };

    const rfNodes: any[] = [];
    const rfEdges: any[] = [];

    // Helper to recursively place nodes on the canvas
    function buildNodes(
      name: string,
      parentId: string | null,
      globalX: number,
      globalY: number
    ) {
      const ent = entityMap.get(name);
      if (!ent) return;

      const layout = { ...(layouts.get(name) || { width: NODE_WIDTH, height: 100, localX: PADDING, localY: 0 }) };
      
      // Calculate absolute positions for 2D Canvas rendering
      let absoluteX = globalX;
      let absoluteY = globalY;
      if (parentId) {
        absoluteX = globalX + (layout.localX ?? PADDING);
        absoluteY = globalY + (layout.localY ?? 0);
      }

      if (existingPositions.has(name)) {
        const cached = existingPositions.get(name)!;
        if (cached.width) layout.width = cached.width;
        if (cached.height) layout.height = cached.height;
        if (cached.x !== undefined && !isNaN(cached.x)) absoluteX = cached.x;
        if (cached.y !== undefined && !isNaN(cached.y)) absoluteY = cached.y;
      }

      const children = parentToChildren.get(name) || [];
      const isExternal = !activeNames.has(name);

      const ancestorAttrs = getAncestorAttributeNames(name);
      const filteredAttributes = ent.attributes.filter(a => !ancestorAttrs.has(a.name));

      // Determine subtype sets
      let sets: { name: string; subtypes: string[] }[] = [];
      if (ent.subtype_sets && ent.subtype_sets.length > 0) {
        sets = ent.subtype_sets;
      } else {
        if (children.length > 0) {
          sets = [{
            name: ent.discriminator || '구분',
            subtypes: children
          }];
        }
      }

      // Convert logical names to physical specifications if in physical viewMode
      let displayName = name;
      let displayType = ent.type;
      let displayAttributes = filteredAttributes;
      let shortName = '';

      if (viewMode === 'physical') {
        const rawPhysicalName = translateLogicalName(name, activeDict, 'UPPER').physicalName;
        const segments = rawPhysicalName.split('_');
        if (segments.length > 0) {
          const lastIndex = segments.length - 1;
          const lastWord = segments[lastIndex];
          
          let pluralLastWord = lastWord;
          if (lastWord !== 'HIST' && lastWord !== 'STATUS' && lastWord !== 'CONTENT' && lastWord !== 'AUDIT') {
            if (lastWord.endsWith('Y')) {
              pluralLastWord = lastWord.substring(0, lastWord.length - 1) + 'IES';
            } else if (lastWord.endsWith('S') || lastWord.endsWith('CH') || lastWord.endsWith('SH') || lastWord.endsWith('X') || lastWord.endsWith('Z')) {
              pluralLastWord = lastWord + 'ES';
            } else {
              pluralLastWord = lastWord + 'S';
            }
          }
          segments[lastIndex] = pluralLastWord;
        }
        
        const pTable = ent.physicalName || `TB_${segments.join('_')}`;
        displayName = pTable;
        displayType = 'entity';
        
        if (segments.length >= 2) {
          const f = segments[0][0] || '';
          const s = segments[1][0] || '';
          const l = segments[segments.length - 1][segments[segments.length - 1].length - 1] || '';
          shortName = (f + s + l).toUpperCase();
        } else if (segments.length === 1) {
          const word = segments[0];
          if (word.length <= 3) {
            shortName = word.toUpperCase();
          } else {
            const f = word[0] || '';
            const s = word[1] || '';
            const l = word[word.length - 1] || '';
            shortName = (f + s + l).toUpperCase();
          }
        }

        displayAttributes = filteredAttributes.map(attr => {
          const pCol = attr.physicalName || translateLogicalName(attr.name, activeDict, 'UPPER').physicalName;
          const pType = resolveDataType(attr.domain, attr.name, dbType, activeDict);
          return {
            ...attr,
            name: pCol,
            domain: pType,
            fk: attr.fk || attr.keyType === 'FK' || (attr as any).foreign_key || false
          };
        });
      }

      // If it is a supertype, we render it directly as a Group Node container containing attributes
      if (sets.length > 0) {
        rfNodes.push({
          id: name,
          parentId: parentId || undefined,
          type: 'supertypeGroup',
          position: { x: absoluteX, y: absoluteY },
          width: layout.width,
          height: layout.height,
          style: { width: layout.width, height: layout.height },
          data: {
            ...ent,
            label: displayName,
            name: displayName,
            type: displayType,
            attributes: displayAttributes,
            isExternal,
            isPhysical: viewMode === 'physical',
            shortName,
            onAttributeClick: (_attr: Attribute) => {
              setSelectedEntityName(name);
            },
            onAddAttributeClick: () => {
              setSelectedEntityName(name);
            }
          },
        });

        // Add Subtype Sets and Subtypes inside this Supertype Group
        sets.forEach(set => {
          const setId = `set-${name}-${set.name}`;
          const setLayout = layouts.get(setId) || { width: NODE_WIDTH, height: 100, localX: PADDING, localY: 100 };
          const setAbsoluteX = absoluteX + (setLayout.localX ?? PADDING);
          const setAbsoluteY = absoluteY + (setLayout.localY ?? 100);

          // 1. Add Subtype Set Box
          rfNodes.push({
            id: setId,
            parentId: name,
            type: 'subtypeSetGroup',
            position: { x: setAbsoluteX, y: setAbsoluteY },
            width: setLayout.width,
            height: setLayout.height,
            style: { width: setLayout.width, height: setLayout.height },
            data: { label: set.name },
          });

          // 2. Add child Subtypes inside the Subtype Set Box recursively
          set.subtypes.forEach(subName => {
            buildNodes(subName, setId, setAbsoluteX, setAbsoluteY);
          });
        });

      } else {
        // If it is a leaf entity / subtype / external entity
        rfNodes.push({
          id: name,
          parentId: parentId || undefined,
          type: 'entityNode',
          position: { x: absoluteX, y: absoluteY },
          width: layout.width || NODE_WIDTH,
          height: layout.height || 120,
          style: { width: layout.width || NODE_WIDTH, height: layout.height || 120 },
          data: {
            ...ent,
            label: displayName,
            name: displayName,
            type: displayType,
            attributes: displayAttributes,
            isExternal,
            isPhysical: viewMode === 'physical',
            shortName,
            onAttributeClick: (_attr: Attribute) => {
              setSelectedEntityName(name);
            },
            onAddAttributeClick: () => {
              setSelectedEntityName(name);
            }
          },
        });
      }
    }

    // Topological Layering Layout for global roots (parents on top, children below)
    const rootEdges: [string, string][] = [];
    
    const getRootAncestor = (name: string): string => {
      let current = name;
      let safety = 0;
      while (safety < 20) {
        const ent = entityMap.get(current);
        if (ent && ent.supertype && entityMap.has(ent.supertype)) {
          current = ent.supertype;
          safety++;
        } else {
          break;
        }
      }
      return current;
    };

    model.relationships.forEach(rel => {
      const parentRoot = getRootAncestor(rel.parent);
      const childRoot = getRootAncestor(rel.child);
      if (parentRoot !== childRoot && roots.includes(parentRoot) && roots.includes(childRoot)) {
        rootEdges.push([parentRoot, childRoot]);
      }
    });

    const ranks = new Map<string, number>();
    roots.forEach(r => ranks.set(r, 0));
    
    // Relax ranks to establish vertical hierarchy layer indexes
    for (let i = 0; i < roots.length; i++) {
      let changed = false;
      rootEdges.forEach(([u, v]) => {
        const rankU = ranks.get(u) || 0;
        const rankV = ranks.get(v) || 0;
        if (rankU + 1 > rankV) {
          ranks.set(v, rankU + 1);
          changed = true;
        }
      });
      if (!changed) break;
    }

    const rootsByRank = new Map<number, string[]>();
    roots.forEach(root => {
      const r = ranks.get(root) || 0;
      const list = rootsByRank.get(r) || [];
      list.push(root);
      rootsByRank.set(r, list);
    });

    const maxRank = Math.max(...Array.from(rootsByRank.keys()), 0);
    let layerY = 50;

    for (let r = 0; r <= maxRank; r++) {
      const rootsInRank = rootsByRank.get(r) || [];
      if (rootsInRank.length === 0) continue;

      let layerX = 50;
      let maxLayerHeight = 0;

      rootsInRank.forEach(root => {
        const layout = layouts.get(root) || { width: NODE_WIDTH + PADDING * 2, height: 200 };
        
        let x = 0;
        let y = 0;

        if (existingPositions.has(root)) {
          const pos = existingPositions.get(root)!;
          x = pos.x;
          y = pos.y;
        } else {
          x = layerX;
          y = layerY;
          layerX += layout.width + 180; // horizontal gap
        }

        if (layout.height > maxLayerHeight) {
          maxLayerHeight = layout.height;
        }

        buildNodes(root, null, x, y);
      });

      const hasAnyExisting = rootsInRank.some(root => existingPositions.has(root));
      if (!hasAnyExisting) {
        layerY += maxLayerHeight + 180; // vertical gap between layers
      }
    }

    // Populate Edges
    model.relationships.forEach(rel => {
      rfEdges.push({
        id: rel.id,
        source: rel.parent,
        target: rel.child,
        type: 'barkerEdge',
        selected: selectedRelationshipId === rel.id,
        data: rel,
      });
    });

    console.log("🔴 [App] Setting nodes and edges. Active File:", activeFileName, "Nodes:", rfNodes.length, "Edges:", rfEdges.length, "isReset:", isReset);

    setNodes(rfNodes);
    setEdges(rfEdges);

    // Save calculated coordinates on Auto Layout (Reset) so they are preserved
    if (isReset && activeProjectId && activeFileName && rfNodes.length > 0) {
      console.log("🔴 [App] Auto Layout coordinates auto-saved in state.");
      const layoutMap: Record<string, { x: number; y: number; width?: number; height?: number }> = {};
      rfNodes.forEach((n: any) => {
        layoutMap[n.id] = { 
          x: n.position.x, 
          y: n.position.y,
          width: n.width,
          height: n.height
        };
      });

      setProjects(prevProjects => {
        const updated = prevProjects.map(proj => {
          if (proj.id === activeProjectId) {
            const filesUpdated = proj.files.map((f: any) => {
              if (f.name === activeFileName) {
                return { ...f, layout: layoutMap };
              }
              return f;
            });
            return { ...proj, files: filesUpdated };
          }
          return proj;
        });
        saveProjects(updated);
        return updated;
      });

      pushHistory(yamlText, layoutMap);
    }
  }, [model, selectedRelationshipId, computeHierarchyLayouts, setNodes, setEdges, layoutTrigger, allProjectEntities, activeProjectId, activeFileName, yamlText, pushHistory, viewMode, projectFiles]);

  // Sync node dragging position and size back to project files in localStorage and track history
  const onNodeDragStop = useCallback((_event: any, _node: any, latestNodes: any[]) => {
    if (!activeProjectId || !activeFileName) return;

    // Gather coordinates and dimensions of all nodes
    const layoutMap: Record<string, { x: number; y: number; width?: number; height?: number }> = {};
    latestNodes.forEach((n: any) => {
      layoutMap[n.id] = { 
        x: n.position.x, 
        y: n.position.y,
        width: n.width,
        height: n.height
      };
    });

    setProjects(prevProjects => {
      const updated = prevProjects.map(proj => {
        if (proj.id === activeProjectId) {
          const filesUpdated = proj.files.map((f: any) => {
            if (f.name === activeFileName) {
              return { ...f, layout: layoutMap };
            }
            return f;
          });
          return { ...proj, files: filesUpdated };
        }
        return proj;
      });
      saveProjects(updated);
      return updated;
    });

    // Save state to Undo/Redo history
    pushHistory(yamlText, layoutMap);
  }, [activeProjectId, activeFileName, yamlText, pushHistory]);

  // Save generated physical specification / DDL file back to the project state
  const handleSavePhysicalFile = useCallback((filename: string, content: string) => {
    if (!activeProjectId) return;
    
    setProjects(prevProjects => {
      const updated = prevProjects.map(proj => {
        if (proj.id === activeProjectId) {
          const exists = proj.files.some((f: any) => f.name === filename);
          let filesUpdated;
          if (exists) {
            filesUpdated = proj.files.map((f: any) => f.name === filename ? { ...f, content } : f);
          } else {
            filesUpdated = [...proj.files, { name: filename, content }];
          }
          return { ...proj, files: filesUpdated, activeFileName: filename };
        }
        return proj;
      });
      saveProjects(updated);
      return updated;
    });

    setActiveFileName(filename);
    setYamlText(content);
  }, [activeProjectId]);

  const handleUpdateProjectFile = useCallback((filename: string, content: string) => {
    if (!activeProjectId) return;
    
    setProjects(prevProjects => {
      const updated = prevProjects.map(proj => {
        if (proj.id === activeProjectId) {
          const exists = proj.files.some((f: any) => f.name === filename);
          let filesUpdated;
          if (exists) {
            filesUpdated = proj.files.map((f: any) => f.name === filename ? { ...f, content } : f);
          } else {
            filesUpdated = [...proj.files, { name: filename, content }];
          }
          return { ...proj, files: filesUpdated };
        }
        return proj;
      });
      saveProjects(updated);
      return updated;
    });
  }, [activeProjectId]);

  // Double click handler for nodes: switches files for external entities or jumps from conceptual to detailed logical models
  const onNodeDoubleClick = useCallback((_event: any, node: any) => {
    const entityName = node.id.replace('group-', '');
    
    // 1. If currently in conceptual model, drill down to logical model
    if (activeFileName?.includes('conceptual')) {
      const otherFiles = projectFiles.filter((f: any) => f.name !== activeFileName);
      const definingFile = otherFiles.find((f: any) => {
        try {
          const parsed = parseModel(f.content);
          const matchesSubjectArea = parsed.subject_area && parsed.subject_area.toLowerCase().replace(/\s+/g, '').includes(entityName.toLowerCase().replace(/\s+/g, ''));
          const hasEntity = parsed.entities.some(e => e.name === entityName);
          const isNotConceptual = !f.name.includes('conceptual') && (parsed as any).modeling_level !== 'conceptual' && parsed.subject_area !== 'QVI 개념 모델';
          return (matchesSubjectArea || hasEntity) && isNotConceptual;
        } catch {
          return false;
        }
      });
      
      if (definingFile) {
        handleSelectFile(definingFile.name);
        setSelectedEntityName(entityName);
        return;
      }
    }
    // 2. If currently in logical model, drill down to physical (switch viewMode to physical)
    else if (activeFileName?.includes('logical')) {
      setViewMode('physical');
      setSelectedEntityName(entityName);
      return;
    }
    
    // Default fallback: select it locally
    setSelectedEntityName(entityName);
    setSelectedRelationshipId(null);
  }, [projectFiles, activeFileName, handleSelectFile]);

  const onPaneDoubleClick = useCallback((event: any) => {
    const target = event.target as HTMLElement;
    const isPane = target && (target.classList.contains('react-flow__pane') || target.closest('.react-flow__pane'));
    
    if (isPane && activeFileName?.includes('logical')) {
      if (viewMode === 'physical') {
        // If in physical mode, double-clicking pane goes back to logical
        setViewMode('logical');
      } else {
        // If in logical mode, double-clicking pane goes up to conceptual
        const conceptualFile = projectFiles.find((f: any) => f.name.includes('conceptual'));
        if (conceptualFile) {
          handleSelectFile(conceptualFile.name);
        }
      }
    }
  }, [activeFileName, projectFiles, handleSelectFile, viewMode]);

  // Selection handlers
  const onSelectionChange = useCallback(({ nodes: selectedNodes, edges: selectedEdges }: any) => {
    if (selectedNodes.length > 0) {
      const selectedNode = selectedNodes[0];
      // If it's a group node, set selection to the entity itself
      const name = selectedNode.id.startsWith('group-') 
        ? selectedNode.id.replace('group-', '') 
        : selectedNode.id;
      
      setSelectedEntityName(name);
      setSelectedRelationshipId(null);
    } else if (selectedEdges.length > 0) {
      setSelectedRelationshipId(selectedEdges[0].id);
      setSelectedEntityName(null);
    } else {
      // If nothing selected, show model level info
      setSelectedEntityName(null);
      setSelectedRelationshipId(null);
    }
  }, []);

  // Create Entity
  const handleAddEntity = useCallback(() => {
    const name = prompt('새 엔터티 이름을 입력하세요:');
    if (!name) return;

    if (model.entities.some(e => e.name === name)) {
      alert('이미 존재하는 엔터티 이름입니다.');
      return;
    }

    const newEntity: Entity = {
      name,
      type: 'entity',
      identifier: 'id',
      attributes: [
        { name: 'id', domain: 'ID', required: true, identifier: true }
      ]
    };

    const updated = {
      ...model,
      entities: [...model.entities, newEntity],
    };
    syncModelToYaml(updated);
    setSelectedEntityName(name);
  }, [model, syncModelToYaml]);

  // Delete Entity
  const handleDeleteEntity = useCallback((name: string) => {
    if (!confirm(`"${name}" 엔터티를 정말 삭제하시겠습니까?`)) return;

    const updatedEntities = model.entities.filter(e => e.name !== name);
    // Also remove any relationships referencing this entity
    const updatedRelationships = model.relationships.filter(
      r => r.parent !== name && r.child !== name
    );

    const updated = {
      ...model,
      entities: updatedEntities,
      relationships: updatedRelationships,
    };
    syncModelToYaml(updated);
    setSelectedEntityName(null);
  }, [model, syncModelToYaml]);

  // Update Entity Info
  const handleUpdateEntity = useCallback((updatedEntity: Entity) => {
    const updatedEntities = model.entities.map(e => 
      e.name === selectedEntityName ? updatedEntity : e
    );

    // If name changed, we need to update supertype references and relationships
    if (updatedEntity.name !== selectedEntityName && selectedEntityName) {
      updatedEntities.forEach(e => {
        if (e.supertype === selectedEntityName) {
          e.supertype = updatedEntity.name;
        }
      });
      model.relationships.forEach(r => {
        if (r.parent === selectedEntityName) r.parent = updatedEntity.name;
        if (r.child === selectedEntityName) r.child = updatedEntity.name;
      });
      setSelectedEntityName(updatedEntity.name);
    }

    const updated = {
      ...model,
      entities: updatedEntities,
    };
    syncModelToYaml(updated);
  }, [model, selectedEntityName, syncModelToYaml]);

  // Add Attribute to Selected Entity
  const handleAddAttribute = useCallback(() => {
    if (!selectedEntityName) return;
    const ent = model.entities.find(e => e.name === selectedEntityName);
    if (!ent) return;

    const newAttr: Attribute = {
      name: `속성_${ent.attributes.length + 1}`,
      domain: 'VARCHAR',
      required: false,
    };

    const updatedEntity = {
      ...ent,
      attributes: [...ent.attributes, newAttr],
    };

    handleUpdateEntity(updatedEntity);
  }, [model, selectedEntityName, handleUpdateEntity]);

  // Update Attribute
  const handleUpdateAttribute = useCallback((index: number, updatedAttr: Attribute) => {
    if (!selectedEntityName) return;
    const ent = model.entities.find(e => e.name === selectedEntityName);
    if (!ent) return;

    const updatedAttrs = ent.attributes.map((attr, idx) => 
      idx === index ? updatedAttr : attr
    );

    // If identifier changed to true, update entity identifier
    let newIdentifier = ent.identifier;
    if (updatedAttr.identifier) {
      if (Array.isArray(ent.identifier)) {
        if (!ent.identifier.includes(updatedAttr.name)) {
          newIdentifier = [...ent.identifier, updatedAttr.name];
        }
      } else if (ent.identifier !== updatedAttr.name) {
        newIdentifier = [ent.identifier, updatedAttr.name];
      }
    }

    const updatedEntity = {
      ...ent,
      attributes: updatedAttrs,
      identifier: newIdentifier,
    };

    handleUpdateEntity(updatedEntity);
  }, [model, selectedEntityName, handleUpdateEntity]);

  // Delete Attribute
  const handleDeleteAttribute = useCallback((index: number) => {
    if (!selectedEntityName) return;
    const ent = model.entities.find(e => e.name === selectedEntityName);
    if (!ent) return;

    const updatedAttrs = ent.attributes.filter((_, idx) => idx !== index);
    const updatedEntity = {
      ...ent,
      attributes: updatedAttrs,
    };

    handleUpdateEntity(updatedEntity);
  }, [model, selectedEntityName, handleUpdateEntity]);

  // Create Relationship
  const handleAddRelationship = useCallback(() => {
    const parent = prompt('부모 엔터티(One) 이름을 입력하세요:');
    if (!parent || !model.entities.some(e => e.name === parent)) {
      alert('올바른 부모 엔터티 이름을 입력해 주세요.');
      return;
    }

    const child = prompt('자식 엔터티(Many) 이름을 입력하세요:');
    if (!child || !model.entities.some(e => e.name === child)) {
      alert('올바른 자식 엔터티 이름을 입력해 주세요.');
      return;
    }

    const id = `R-UAC-${String(model.relationships.length + 1).padStart(3, '0')}`;
    const newRel: Relationship = {
      id,
      name: `R_${parent}_${child}`,
      parent,
      child,
      cardinality: 'one_to_many',
      parent_participation: '0..M',
      child_participation: '1..1',
      identifying: false,
    };

    const updated = {
      ...model,
      relationships: [...model.relationships, newRel],
    };
    syncModelToYaml(updated);
    setSelectedRelationshipId(id);
  }, [model, syncModelToYaml]);

  // Update Relationship
  const handleUpdateRelationship = useCallback((updatedRel: Relationship) => {
    const updatedRelationships = model.relationships.map(r => 
      r.id === selectedRelationshipId ? updatedRel : r
    );

    const updated = {
      ...model,
      relationships: updatedRelationships,
    };
    syncModelToYaml(updated);
  }, [model, selectedRelationshipId, syncModelToYaml]);

  // Delete Relationship
  const handleDeleteRelationship = useCallback((id: string) => {
    if (!confirm('관계를 삭제하시겠습니까?')) return;

    const updatedRelationships = model.relationships.filter(r => r.id !== id);
    const updated = {
      ...model,
      relationships: updatedRelationships,
    };
    syncModelToYaml(updated);
    setSelectedRelationshipId(null);
  }, [model, syncModelToYaml]);

  // Update Subject Area or general details
  const handleUpdateModelMeta = useCallback((key: keyof LogicalModel, value: any) => {
    const updated = {
      ...model,
      [key]: value,
    };
    syncModelToYaml(updated);
  }, [model, syncModelToYaml]);

  // File Upload (Supports YAML, DA# .dax, and .damx)
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.dax') || lowerName.endsWith('.damx')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const buffer = event.target?.result as ArrayBuffer;
          const uint8 = new Uint8Array(buffer);
          const loadedModel = parseDaNativeFile(uint8, file.name);
          if (loadedModel.entities.length === 0) {
            throw new Error('선택한 DA# 파일에서 엔터티를 추출할 수 없습니다.');
          }
          syncModelToYaml(loadedModel);
          alert(`DA# 파일 "${file.name}" 로드 완료! (${loadedModel.entities.length}개 엔터티, ${loadedModel.relationships.length}개 관계)`);
        } catch (err: any) {
          alert(`DA# 파일 열기 실패: ${err.message || String(err)}`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setYamlText(text);
        updateModelFromYaml(text);
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  }, [syncModelToYaml, updateModelFromYaml]);

  // Dedicated Native DA# binary upload (.dax / .damx)
  const handleDaNativeUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const uint8 = new Uint8Array(buffer);
        const loadedModel = parseDaNativeFile(uint8, file.name);
        if (loadedModel.entities.length === 0) {
          throw new Error('선택한 DA# 파일에서 엔터티를 추출할 수 없습니다.');
        }
        syncModelToYaml(loadedModel);
        alert(`DA# 파일 "${file.name}" 로드 완료! (${loadedModel.entities.length}개 엔터티, ${loadedModel.relationships.length}개 관계)`);
      } catch (err: any) {
        alert(`DA# 파일 열기 실패: ${err.message || String(err)}`);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  }, [syncModelToYaml]);

  // Export YAML File
  const handleExportYaml = useCallback(() => {
    const blob = new Blob([yamlText], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${model.subject_area.replace(/\s+/g, '_')}_logical.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  }, [yamlText, model.subject_area]);

  // Export Excel XML Specification
  const handleExportExcel = useCallback(() => {
    try {
      const xml = exportExcelXml(model);
      const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (model.subject_area || 'model').replace(/\s+/g, '_');
      a.download = `${safeName}_정의서.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Excel 정의서 생성 중 오류가 발생했습니다: ' + (err.message || String(err)));
    }
  }, [model]);

  // Export Markdown Specification
  const handleExportMarkdown = useCallback(() => {
    try {
      const md = exportMarkdownReport(model);
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (model.subject_area || 'model').replace(/\s+/g, '_');
      a.download = `${safeName}_명세서.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Markdown 명세서 생성 중 오류가 발생했습니다: ' + (err.message || String(err)));
    }
  }, [model]);

  // Export Git-friendly Modular Project Bundle (.zip)
  const handleExportGitBundle = useCallback(() => {
    try {
      const projectName = activeProject?.name || model.subject_area || 'project';
      const bundleFiles = exportProjectBundle(model, projectName);
      const zipBytes = createZipBundle(bundleFiles);
      const blob = new Blob([zipBytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = projectName.replace(/\s+/g, '_');
      a.download = `${safeName}_git_bundle.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Git 번들 내보내기 실패: ' + (err.message || String(err)));
    }
  }, [model, activeProject]);

  // Import Git-friendly Modular Project Bundle (.zip)
  const handleImportGitBundle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const uint8 = new Uint8Array(arrayBuffer);
        const extractedFiles = readZipBundle(uint8);
        if (Object.keys(extractedFiles).length === 0) {
          throw new Error('ZIP 파일에서 유효한 번들 파일(project.yaml 또는 entities/*.yaml)을 찾을 수 없습니다.');
        }
        const loadedModel = importProjectBundle(extractedFiles);
        syncModelToYaml(loadedModel);
        alert(`Git 번들로부터 "${loadedModel.subject_area || '모델'}" (${loadedModel.entities.length}개 엔터티, ${loadedModel.relationships.length}개 관계)을 성공적으로 불러왔습니다.`);
      } catch (err: any) {
        alert('Git 번들 가져오기 실패: ' + (err.message || String(err)));
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset file input value
    e.target.value = '';
  }, [syncModelToYaml]);

  // Handle entity selection from Linter
  const handleSelectEntityFromLinter = useCallback((entityName: string) => {
    setSelectedEntityName(entityName);
    setIsLinterOpen(false);
  }, []);

  // Handle applying auto-discovered relationships
  const handleApplyDiscoveredRelationships = useCallback((newRels: Relationship[]) => {
    if (newRels.length === 0) return;
    const updatedModel = {
      ...model,
      relationships: [...model.relationships, ...newRels],
    };
    syncModelToYaml(updatedModel);
    setIsDiscoveryOpen(false);
  }, [model, syncModelToYaml]);

  // Handle Loading Model from DA# Bridge
  const handleLoadModelFromDaBridge = useCallback((loadedModel: LogicalModel, sourceName: string) => {
    syncModelToYaml(loadedModel);
    setIsDaBridgeOpen(false);
    alert(`"${sourceName}" 모델을 성공적으로 불러와 현재 캔버스에 반영했습니다! (${loadedModel.entities.length}개 엔터티, ${loadedModel.relationships.length}개 관계)`);
  }, [syncModelToYaml]);

  // Import DDL Handler
  const handleDdlImport = useCallback(() => {
    try {
      const parsed = parseDdl(ddlImportText);
      setModel(parsed);
      const yaml = stringifyModel(parsed);
      setYamlText(yaml);
      setValidationErrors([]);
      setIsDdlModalOpen(false);
      setDdlImportText('');
    } catch (err: any) {
      alert(`DDL 파싱 실패: ${err.message}`);
    }
  }, [ddlImportText]);

  // Lookup selected entity data
  const selectedEntity = useMemo(() => {
    return model.entities.find(e => e.name === selectedEntityName) || null;
  }, [model, selectedEntityName]);

  const isConceptual = useMemo(() => {
    return (model as any).modeling_level === 'conceptual' || activeFileName?.includes('conceptual') || model.subject_area?.includes('개념');
  }, [model, activeFileName]);

  const refinementFile = useMemo(() => {
    if (!isConceptual || !selectedEntityName) return null;
    return projectFiles.find((f: any) => {
      if (!f.name.startsWith('logical/') || !f.name.endsWith('.yaml')) return false;
      try {
        const parsed = parseModel(f.content);
        return (parsed.entities || []).some(e => e.name === selectedEntityName);
      } catch {
        return false;
      }
    });
  }, [isConceptual, selectedEntityName, projectFiles]);

  // Lookup selected relationship data
  const selectedRelationship = useMemo(() => {
    return model.relationships.find(r => r.id === selectedRelationshipId) || null;
  }, [model, selectedRelationshipId]);

  return (
    <div className="modeler-container">
      {/* Top Header */}
      <header className="modeler-header">
        <div className="header-title-section" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Database size={20} className="text-blue-500" />
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>MinsDBModeler</h1>
          
          {/* Project Selector & Actions */}
          <div className="project-selector-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px', paddingLeft: '12px', borderLeft: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Project:</span>
            <select
              className="form-control"
              style={{ padding: '4px 8px', fontSize: '0.85rem', width: '180px', height: '32px' }}
              value={activeProjectId || ''}
              onChange={(e) => {
                const id = e.target.value;
                setActiveProjectId(id);
                setActiveProjectIdState(id);
              }}
            >
              {projects.map(proj => (
                <option key={proj.id} value={proj.id}>{proj.name}</option>
              ))}
            </select>
            
            <button 
              className="btn btn-icon" 
              style={{ padding: '6px', height: '32px' }} 
              title="Rename Project"
              onClick={() => {
                if (!activeProjectId || !activeProject) return;
                const newName = prompt('프로젝트 이름을 입력하세요:', activeProject.name);
                if (newName && newName !== activeProject.name) {
                  const updated = renameProject(activeProjectId, newName);
                  setProjects(updated);
                }
              }}
            >
              <Edit2 size={14} />
            </button>
            
            <button 
              className="btn btn-icon" 
              style={{ padding: '6px', height: '32px' }} 
              title="Create New Project"
              onClick={() => {
                const name = prompt('새 프로젝트 이름을 입력하세요:');
                if (name) {
                  const newProj = createProject(name);
                  setProjects(getProjects());
                  setActiveProjectId(newProj.id);
                  setActiveProjectIdState(newProj.id);
                }
              }}
            >
              <Plus size={14} />
            </button>
            
            <button 
              className="btn btn-icon" 
              style={{ padding: '6px', height: '32px', color: 'var(--danger)' }} 
              title="Delete Project"
              onClick={() => {
                if (!activeProjectId || !activeProject) return;
                if (confirm(`"${activeProject.name}" 프로젝트를 정말 삭제하시겠습니까?`)) {
                  const updated = deleteProject(activeProjectId);
                  setProjects(updated);
                  const nextId = updated[0]?.id || null;
                  setActiveProjectId(nextId);
                  setActiveProjectIdState(nextId);
                }
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <div className="header-actions">
          <button 
            className={`btn ${activeTab === 'split' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('split')}
          >
            <FileCode size={16} /> Split View
          </button>
          <button 
            className={`btn ${activeTab === 'canvas' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('canvas')}
          >
            Canvas Only
          </button>
          {/* Undo/Redo Controls */}
          <div style={{ display: 'flex', gap: '4px', marginRight: '6px', borderRight: '1px solid var(--border-color)', paddingRight: '10px', alignItems: 'center' }}>
            <button 
              className="btn btn-icon" 
              title="되돌리기 (Undo)"
              disabled={historyState.index <= 0}
              onClick={handleUndo}
              style={{ opacity: historyState.index <= 0 ? 0.4 : 1, cursor: historyState.index <= 0 ? 'not-allowed' : 'pointer', height: '32px', width: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Undo2 size={16} />
            </button>
            <button 
              className="btn btn-icon" 
              title="다시 실행 (Redo)"
              disabled={historyState.index >= historyState.history.length - 1}
              onClick={handleRedo}
              style={{ opacity: historyState.index >= historyState.history.length - 1 ? 0.4 : 1, cursor: historyState.index >= historyState.history.length - 1 ? 'not-allowed' : 'pointer', height: '32px', width: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Redo2 size={16} />
            </button>
          </div>

          <button 
            className="btn"
            onClick={() => setLayoutTrigger(prev => prev + 1)}
          >
            <RefreshCw size={16} /> Auto Layout
          </button>

          {/* Git-friendly Modular Project Bundle (ZIP) */}
          <button 
            className="btn btn-secondary" 
            title="엔터티별 개별 YAML 파일 및 관계를 Git 최적화 ZIP 번들로 내보내기"
            onClick={handleExportGitBundle}
          >
            <FolderArchive size={16} /> Git 번들 (ZIP)
          </button>

          <label className="btn btn-secondary" title="Git 번들 ZIP 파일 불러오기">
            <Package size={16} /> 번들 열기
            <input 
              type="file" 
              accept=".zip" 
              className="hidden-file-input" 
              onChange={handleImportGitBundle} 
            />
          </label>

          {/* Import/Export Project Backup */}
          <button 
            className="btn btn-secondary" 
            title="Export Entire Project to JSON"
            onClick={() => {
              if (!activeProjectId || !activeProject) return;
              const jsonStr = JSON.stringify(activeProject, null, 2);
              const blob = new Blob([jsonStr], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${activeProject.name.replace(/\s+/g, '_')}_project.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download size={16} /> Export Proj
          </button>

          <label className="btn btn-secondary" title="Import Project from JSON">
            <Upload size={16} /> Import Proj
            <input 
              type="file" 
              accept=".json" 
              className="hidden-file-input" 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                  try {
                    const projectData = JSON.parse(event.target?.result as string);
                    if (!projectData.name || !Array.isArray(projectData.files)) {
                      throw new Error('올바른 프로젝트 파일 형식(JSON)이 아닙니다.');
                    }
                    projectData.id = `proj_${Date.now()}`;
                    const currentProjects = getProjects();
                    currentProjects.push(projectData);
                    saveProjects(currentProjects);
                    setProjects(currentProjects);
                    setActiveProjectId(projectData.id);
                    setActiveProjectIdState(projectData.id);
                    alert(`"${projectData.name}" 프로젝트를 성공적으로 가져왔습니다.`);
                  } catch (err: any) {
                    alert(`프로젝트 가져오기 실패: ${err.message}`);
                  }
                };
                reader.readAsText(file);
              }}
            />
          </label>

          <label className="btn btn-secondary" title="YAML 또는 DA# 원본 파일(.dax, .damx) 불러오기">
            <Upload size={16} /> 모델 열기 (YAML / DA#)
            <input 
              type="file" 
              accept=".yaml,.yml,.dax,.damx" 
              onChange={handleFileUpload} 
              className="hidden-file-input" 
            />
          </label>

          <label 
            className="btn btn-secondary" 
            title="DA# 원본 파일(.dax / .damx) 직접 열기"
            style={{ border: '1px solid #8b5cf6', color: '#8b5cf6', fontWeight: 600 }}
          >
            <Sparkles size={16} /> DA# 열기 (.dax, .damx)
            <input 
              type="file" 
              accept=".dax,.damx" 
              onChange={handleDaNativeUpload} 
              className="hidden-file-input" 
            />
          </label>

          <button className="btn" onClick={() => setIsDdlModalOpen(true)}>
            <Database size={16} /> Import DDL
          </button>

          {/* Standardization & Physical Mapping Actions */}
          <button 
            className="btn btn-secondary" 
            title="표준 도메인/단어/용어 사전 관리"
            onClick={() => setIsDictOpen(true)}
          >
            <BookOpen size={16} /> 표준화 사전
          </button>

          {/* Quality Review & Automation Actions (DA# style) */}
          <button 
            className="btn btn-secondary" 
            title="DA# 5 모델(ERwin XML, 엑셀 정의서, DDL) 불러오기 및 상호 편집"
            onClick={() => setIsDaBridgeOpen(true)}
            style={{ border: '1px solid #8b5cf6', color: '#8b5cf6', fontWeight: 'bold' }}
          >
            <Sparkles size={16} /> DA# 호환 브릿지
          </button>

          <button 
            className="btn btn-secondary" 
            title="모델 품질 4대 영역 검토 (기본, 표준화, 관계 일관성, 물리 무결성)"
            onClick={() => setIsLinterOpen(true)}
            style={{ border: '1px solid #10b981', color: '#10b981' }}
          >
            <ShieldCheck size={16} /> 모델 검토
          </button>

          <button 
            className="btn btn-secondary" 
            title="PK-속성 기반 1:N 외래키 관계 자동 발견"
            onClick={() => setIsDiscoveryOpen(true)}
            style={{ border: '1px solid #6366f1', color: '#6366f1' }}
          >
            <Network size={16} /> 관계 찾기
          </button>

          <button 
            className="btn btn-secondary" 
            title="엔터티/테이블/컬럼/관계 정의서 Excel XML 내보내기"
            onClick={handleExportExcel}
          >
            <FileSpreadsheet size={16} /> 정의서 (Excel)
          </button>

          <button 
            className="btn btn-secondary" 
            title="Markdown 포맷 모델 설계 명세서 내보내기"
            onClick={handleExportMarkdown}
          >
            <FileText size={16} /> 명세서 (MD)
          </button>

          {activeFileName && activeFileName.startsWith('logical/') && (
            <>
              {viewMode === 'logical' ? (
                <button 
                  className="btn btn-secondary" 
                  title="다이어그램을 물리 모델(테이블/컬럼)로 전환"
                  onClick={() => setViewMode('physical')}
                  style={{ border: '1px solid var(--accent-color)', color: 'var(--accent-color)', fontWeight: 'bold' }}
                >
                  <Database size={16} /> 물리 전환
                </button>
              ) : (
                <>
                  <button 
                    className="btn btn-secondary" 
                    title="다이어그램을 원래 논리 모델(엔터티/속성)로 복구"
                    onClick={() => setViewMode('logical')}
                    style={{ border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}
                  >
                    <RefreshCw size={16} /> 논리 전환
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    title="물리 테이블 설계 사양서 및 DDL 생성 마법사 열기"
                    onClick={() => setIsTransformOpen(true)}
                    style={{ border: '1px solid var(--accent-color)', color: 'var(--accent-color)', fontWeight: 'bold' }}
                  >
                    <FileCode size={16} /> DDL/물리사양 추출
                  </button>
                </>
              )}
            </>
          )}

          <button className="btn btn-primary" onClick={handleExportYaml}>
            <Download size={16} /> Export YAML
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="modeler-workspace">
        {/* Left Sidebar - Entities List & Validations */}
        <aside className="modeler-sidebar">
          {/* Project Explorer Section */}
          <div className="sidebar-section">
            <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Project Files
              <div style={{ display: 'flex', gap: '4px' }}>
                {/* Import local file into active project (YAML, DDL, DA# .dax/.damx) */}
                <label className="btn btn-icon" style={{ padding: '2px 6px', fontSize: '0.75rem', cursor: 'pointer', border: '1px solid var(--border-color)', height: '24px', display: 'flex', alignItems: 'center' }} title="Import File (YAML, DDL, DA#)">
                  <Upload size={12} />
                  <input 
                    type="file" 
                    accept=".yaml,.yml,.sql,.ddl,.dax,.damx" 
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file || !activeProjectId) return;
                      const lower = file.name.toLowerCase();

                      if (lower.endsWith('.dax') || lower.endsWith('.damx')) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          try {
                            const buffer = event.target?.result as ArrayBuffer;
                            const uint8 = new Uint8Array(buffer);
                            const parsed = parseDaNativeFile(uint8, file.name);
                            if (parsed.entities.length === 0) {
                              throw new Error('DA# 파일에서 엔터티를 추출할 수 없습니다.');
                            }
                            const targetFilename = `${file.name.replace(/\.(dax|damx)$/i, '')}.yaml`;
                            const content = stringifyModel(parsed);

                            setProjects(prevProjects => {
                              const updated = prevProjects.map(proj => {
                                if (proj.id === activeProjectId) {
                                  const existingIdx = proj.files.findIndex((f: any) => f.name === targetFilename);
                                  const newFiles = existingIdx >= 0 
                                    ? proj.files.map((f: any, i: number) => i === existingIdx ? { ...f, content } : f)
                                    : [...proj.files, { name: targetFilename, content }];
                                  return {
                                    ...proj,
                                    activeFileName: targetFilename,
                                    files: newFiles
                                  };
                                }
                                return proj;
                              });
                              saveProjects(updated);
                              return updated;
                            });
                            setActiveFileName(targetFilename);
                            setYamlText(content);
                            setModel(parsed);
                            alert(`DA# 파일 "${file.name}"이(가) "${targetFilename}"으로 프로젝트에 성공적으로 추가되었습니다!`);
                          } catch (err: any) {
                            alert(`DA# 파일 가져오기 실패: ${err.message || String(err)}`);
                          }
                        };
                        reader.readAsArrayBuffer(file);
                      } else {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const content = event.target?.result as string;
                          if (projectFiles.some((f: any) => f.name === file.name)) {
                            alert('이미 같은 이름의 파일이 프로젝트에 존재합니다.');
                            return;
                          }
                          setProjects(prevProjects => {
                            const updated = prevProjects.map(proj => {
                              if (proj.id === activeProjectId) {
                                return {
                                  ...proj,
                                  activeFileName: file.name,
                                  files: [...proj.files, { name: file.name, content }]
                                };
                              }
                              return proj;
                            });
                            saveProjects(updated);
                            return updated;
                          });
                          setActiveFileName(file.name);
                          setYamlText(content);
                        };
                        reader.readAsText(file);
                      }
                      e.target.value = '';
                    }} 
                  />
                </label>
                
                <button 
                  className="btn btn-icon" 
                  style={{ padding: '2px 6px', fontSize: '0.75rem', height: '24px' }} 
                  onClick={handleNewFile}
                  title="Create New File"
                >
                  <Plus size={12} /> New
                </button>
              </div>
            </h3>
            <div className="entity-list" style={{ maxHeight: '250px', overflowY: 'auto' }}>
              {/* Render Groups (Folders) */}
              {Object.entries(groupedFiles.groups).map(([folderName, files]) => (
                <div key={folderName} style={{ marginBottom: '8px' }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    padding: '4px 6px', 
                    fontWeight: 'bold', 
                    fontSize: '0.75rem', 
                    color: 'var(--text-muted)',
                    backgroundColor: 'rgba(0, 0, 0, 0.02)',
                    borderRadius: '4px'
                  }}>
                    📂 <span>{getFolderDisplayName(folderName)}</span>
                  </div>
                  <div style={{ paddingLeft: '12px' }}>
                    {files.map((file: any) => (
                      <div 
                        key={file.name} 
                        className="entity-list-item"
                        onClick={() => handleSelectFile(file.name)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderColor: activeFileName === file.name ? 'var(--accent-color)' : 'transparent',
                          backgroundColor: activeFileName === file.name ? 'rgba(59, 130, 246, 0.05)' : undefined,
                          fontWeight: activeFileName === file.name ? 'bold' : 'normal',
                          padding: '4px 6px',
                          margin: '2px 0',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        <span style={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {file.name.endsWith('.sql') || file.name.endsWith('.ddl') ? '📜' : '📄'} {getFileDisplayName(file)}
                        </span>
                        
                        {/* File actions */}
                        <div className="file-actions" style={{ display: 'flex', gap: '2px' }}>
                          <button
                            className="btn btn-icon"
                            style={{ padding: '2px', border: 'none', background: 'transparent' }}
                            title="Rename File"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRenameFile(file.name);
                            }}
                          >
                            <Edit2 size={10} style={{ color: 'var(--text-muted)' }} />
                          </button>
                          <button
                            className="btn btn-icon"
                            style={{ padding: '2px', border: 'none', background: 'transparent' }}
                            title="Delete File"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFile(file.name);
                            }}
                          >
                            <Trash2 size={10} style={{ color: 'var(--danger)' }} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Render Root Files */}
              {groupedFiles.rootFiles.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  {groupedFiles.rootFiles.map((file: any) => (
                    <div 
                      key={file.name} 
                      className="entity-list-item"
                      onClick={() => handleSelectFile(file.name)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderColor: activeFileName === file.name ? 'var(--accent-color)' : 'transparent',
                        backgroundColor: activeFileName === file.name ? 'rgba(59, 130, 246, 0.05)' : undefined,
                        fontWeight: activeFileName === file.name ? 'bold' : 'normal',
                        padding: '4px 6px',
                        margin: '2px 0',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {file.name.endsWith('.sql') || file.name.endsWith('.ddl') ? '📜' : '📄'} {getFileDisplayName(file)}
                      </span>
                      
                      <div className="file-actions" style={{ display: 'flex', gap: '2px' }}>
                        <button
                          className="btn btn-icon"
                          style={{ padding: '2px', border: 'none', background: 'transparent' }}
                          title="Rename File"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRenameFile(file.name);
                          }}
                        >
                          <Edit2 size={10} style={{ color: 'var(--text-muted)' }} />
                        </button>
                        <button
                          className="btn btn-icon"
                          style={{ padding: '2px', border: 'none', background: 'transparent' }}
                          title="Delete File"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFile(file.name);
                          }}
                        >
                          <Trash2 size={10} style={{ color: 'var(--danger)' }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Entity List */}
          <div className="sidebar-section">
            <h3>
              Entities 
              <button 
                className="btn btn-icon" 
                style={{ padding: '2px 6px', fontSize: '0.75rem' }} 
                onClick={handleAddEntity}
              >
                <Plus size={14} /> Add
              </button>
            </h3>
            <div className="entity-list">
              {model.entities.map(ent => (
                <div 
                  key={ent.name} 
                  className="entity-list-item"
                  onClick={() => {
                    setSelectedEntityName(ent.name);
                    setSelectedRelationshipId(null);
                  }}
                  style={{
                    borderColor: selectedEntityName === ent.name ? 'var(--accent-color)' : undefined,
                    backgroundColor: selectedEntityName === ent.name ? 'rgba(59, 130, 246, 0.05)' : undefined,
                  }}
                >
                  <span>{ent.name}</span>
                  <span className="item-badge">{ent.type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Relationship List */}
          <div className="sidebar-section">
            <h3>
              Relationships
              <button 
                className="btn btn-icon" 
                style={{ padding: '2px 6px', fontSize: '0.75rem' }} 
                onClick={handleAddRelationship}
              >
                <Plus size={14} /> Add
              </button>
            </h3>
            <div className="relationship-list">
              {model.relationships.map(rel => (
                <div 
                  key={rel.id} 
                  className="relationship-list-item"
                  onClick={() => {
                    setSelectedRelationshipId(rel.id);
                    setSelectedEntityName(null);
                  }}
                  style={{
                    borderColor: selectedRelationshipId === rel.id ? 'var(--accent-color)' : undefined,
                    backgroundColor: selectedRelationshipId === rel.id ? 'rgba(59, 130, 246, 0.05)' : undefined,
                  }}
                >
                  <span style={{ fontSize: '0.75rem' }}>{rel.name || rel.id}</span>
                  <span className="item-badge" style={{ fontSize: '0.65rem' }}>
                    {rel.cardinality === 'one_to_many' ? '1:M' : '1:1'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Validation Warnings/Errors */}
          <div className="sidebar-section" style={{ flex: 1 }}>
            <h3>Validation Info</h3>
            <div className="validation-list">
              {validationErrors.length === 0 ? (
                <div className="validation-card" style={{ borderLeftColor: 'var(--success)', color: 'var(--success)' }}>
                  <CheckCircle size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                  Model is valid!
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

        {/* Main Work Area */}
        <div className="main-canvas-area">
          {/* Canvas Pane */}
          <div className="canvas-pane">
            {isActiveFileSql ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                backgroundColor: 'var(--bg-sidebar)',
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: '24px',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                margin: '12px'
              }}>
                <Database size={48} style={{ color: 'var(--accent-color)', marginBottom: '16px', opacity: 0.7 }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '8px' }}>
                  SQL DDL File
                </h3>
                <p style={{ maxWidth: '400px', fontSize: '0.85rem', marginBottom: '24px', lineHeight: '1.5' }}>
                  "{activeFileName}" is a SQL DDL script. Use the code editor on the right to edit the script. Visual canvas editing is only available for YAML logical models.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setDdlImportText(yamlText);
                    setIsDdlModalOpen(true);
                  }}
                >
                  Import DDL to Logical Model
                </button>
              </div>
            ) : (
              <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <KonvaModelerCanvas
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onNodeDragStop={onNodeDragStop}
                  onSelectionChange={onSelectionChange}
                  onNodeDoubleClick={onNodeDoubleClick}
                  onPaneDoubleClick={onPaneDoubleClick}
                  selectedEntityName={selectedEntityName}
                  selectedRelationshipId={selectedRelationshipId}
                  viewMode={viewMode}
                />
                
                <div style={{ position: 'absolute', bottom: '16px', left: '16px', zIndex: 10, background: 'var(--bg-sidebar)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                  <strong>Barker Notation Guide:</strong> Dotted line = Non-Identifying/Optional. Solid = Identifying/Mandatory. Crow's foot = Many.
                </div>

                {/* Drill Up Floating Panel */}
                {activeFileName?.includes('logical') && projectFiles.some((f: any) => f.name.includes('conceptual')) && (
                  <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
                    <button 
                      className="btn btn-secondary"
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        fontSize: '0.8rem', 
                        padding: '6px 12px', 
                        background: 'var(--bg-main)', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '4px', 
                        cursor: 'pointer', 
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        fontWeight: 'bold',
                        color: 'var(--accent-color)'
                      }}
                      onClick={() => {
                        const conceptualFile = projectFiles.find((f: any) => f.name.includes('conceptual'));
                        if (conceptualFile) {
                          handleSelectFile(conceptualFile.name);
                        }
                      }}
                    >
                      ⬆️ Drill Up (개념 모델로)
                    </button>
                  </div>
                )}

                {/* Conceptual Model Indicator Badge */}
                {isConceptual && (
                  <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.8rem',
                      padding: '6px 12px',
                      background: 'rgba(234, 179, 8, 0.1)',
                      border: '1px solid rgba(234, 179, 8, 0.3)',
                      color: '#b45309',
                      borderRadius: '4px',
                      fontWeight: 'bold',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}>
                      💡 개념 모델링 단계 (Conceptual Stage)
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Monaco Editor Pane (Visible only in Split View) */}
          {activeTab === 'split' && (
            <div className="editor-pane">
              <div className="editor-pane-header">
                {isActiveFileSql ? 'SQL DDL Code Editor' : 'YAML Schema Source Code (Round-trip)'}
              </div>
              <div style={{ flex: 1 }}>
                <Editor
                  height="100%"
                  language={isActiveFileSql ? 'sql' : 'yaml'}
                  theme="light"
                  value={yamlText}
                  onChange={handleEditorChange}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 12,
                    lineNumbers: 'on',
                    wordWrap: 'on',
                    automaticLayout: true,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Detail Editor Panel */}
        <aside className="modeler-detail-panel">
          {selectedEntity ? (
            // Entity Editor
            <div>
              <div className="detail-header">
                <h2>Entity Details</h2>
                <p>Edit metadata and attributes of the selected entity.</p>
              </div>

              <div className="form-group">
                <label>Entity Name (논리명)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={selectedEntity.name}
                  onChange={(e) => handleUpdateEntity({ ...selectedEntity, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Physical Table Name (물리 테이블명)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. TB_USER_INFO"
                  value={selectedEntity.physicalName || ''}
                  onChange={(e) => handleUpdateEntity({ ...selectedEntity, physicalName: e.target.value.toUpperCase() || undefined })}
                />
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem' }}>Classification (성격)</label>
                  <select 
                    className="form-control"
                    style={{ fontSize: '0.75rem' }}
                    value={selectedEntity.classification || ''}
                    onChange={(e) => handleUpdateEntity({ ...selectedEntity, classification: (e.target.value || undefined) as any })}
                  >
                    <option value="">-- 분류 없음 --</option>
                    <option value="KEY">KEY (핵심 엔터티)</option>
                    <option value="MAIN">MAIN (기본 엔터티)</option>
                    <option value="ACTION">ACTION (행위 엔터티)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem' }}>Level (관리 중요도)</label>
                  <select 
                    className="form-control"
                    style={{ fontSize: '0.75rem' }}
                    value={selectedEntity.level || ''}
                    onChange={(e) => handleUpdateEntity({ ...selectedEntity, level: e.target.value ? Number(e.target.value) as any : undefined })}
                  >
                    <option value="">-- 레벨 미지정 --</option>
                    <option value="1">Level 1 (전사 핵심)</option>
                    <option value="2">Level 2 (주제영역 주요)</option>
                    <option value="3">Level 3 (단위 업무/보조)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Type</label>
                <select 
                  className="form-control"
                  value={selectedEntity.type}
                  onChange={(e) => handleUpdateEntity({ ...selectedEntity, type: e.target.value as any })}
                >
                  <option value="entity">Standard Entity</option>
                  <option value="supertype">Supertype (Container)</option>
                  <option value="subtype">Subtype (Nested)</option>
                </select>
              </div>

              {/* Volume Estimation Section */}
              <div style={{ marginTop: '12px', marginBottom: '12px', padding: '10px', backgroundColor: 'var(--bg-main)', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>
                  📊 예상 볼륨 산정 (Volume Info)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>발생 주기</span>
                    <select
                      className="form-control"
                      style={{ fontSize: '0.75rem', height: '28px', padding: '2px 6px' }}
                      value={selectedEntity.volume?.period || ''}
                      onChange={(e) => handleUpdateEntity({
                        ...selectedEntity,
                        volume: { ...(selectedEntity.volume || {}), period: (e.target.value || undefined) as any }
                      })}
                    >
                      <option value="">-- 주기 선택 --</option>
                      <option value="daily">일별 (Daily)</option>
                      <option value="monthly">월별 (Monthly)</option>
                      <option value="yearly">연별 (Yearly)</option>
                      <option value="on_demand">수시 (On Demand)</option>
                    </select>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>월 발생량(건)</span>
                    <input
                      type="number"
                      className="form-control"
                      style={{ fontSize: '0.75rem', height: '28px', padding: '2px 6px' }}
                      placeholder="0"
                      value={selectedEntity.volume?.monthlyQuantity ?? ''}
                      onChange={(e) => handleUpdateEntity({
                        ...selectedEntity,
                        volume: { ...(selectedEntity.volume || {}), monthlyQuantity: e.target.value ? Number(e.target.value) : undefined }
                      })}
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>보존기한(개월)</span>
                    <input
                      type="number"
                      className="form-control"
                      style={{ fontSize: '0.75rem', height: '28px', padding: '2px 6px' }}
                      placeholder="개월 수"
                      value={selectedEntity.volume?.retentionMonths ?? ''}
                      onChange={(e) => handleUpdateEntity({
                        ...selectedEntity,
                        volume: { ...(selectedEntity.volume || {}), retentionMonths: e.target.value ? Number(e.target.value) : undefined }
                      })}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>총 누적건수</span>
                    <input
                      type="number"
                      className="form-control"
                      style={{ fontSize: '0.75rem', height: '28px', padding: '2px 6px' }}
                      placeholder="0"
                      value={selectedEntity.volume?.totalQuantity ?? ''}
                      onChange={(e) => handleUpdateEntity({
                        ...selectedEntity,
                        volume: { ...(selectedEntity.volume || {}), totalQuantity: e.target.value ? Number(e.target.value) : undefined }
                      })}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>Purpose / Description (정의/설명)</label>
                <textarea
                  className="form-control"
                  style={{ height: '54px', fontSize: '0.75rem', resize: 'vertical' }}
                  placeholder="엔터티의 비즈니스 정의 및 주요 설명..."
                  value={selectedEntity.purpose || ''}
                  onChange={(e) => handleUpdateEntity({ ...selectedEntity, purpose: e.target.value || undefined })}
                />
              </div>

              {selectedEntity.type === 'subtype' && (
                <div className="form-group">
                  <label>Supertype Entity</label>
                  <select
                    className="form-control"
                    value={selectedEntity.supertype || ''}
                    onChange={(e) => handleUpdateEntity({ ...selectedEntity, supertype: e.target.value || undefined })}
                  >
                    <option value="">-- Select Supertype --</option>
                    {model.entities
                      .filter(e => e.name !== selectedEntity.name)
                      .map(e => (
                        <option key={e.name} value={e.name}>{e.name}</option>
                      ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Discriminator Attribute (Optional)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={selectedEntity.discriminator || ''}
                  onChange={(e) => handleUpdateEntity({ ...selectedEntity, discriminator: e.target.value || undefined })}
                  placeholder="e.g. 이용자구분코드"
                />
              </div>

              {/* Refinement Panel (Visible only in conceptual model) */}
              {isConceptual && (
                refinementFile ? (
                  <div className="form-group" style={{ 
                    marginTop: '16px', 
                    padding: '12px', 
                    backgroundColor: 'rgba(16, 185, 129, 0.08)', 
                    border: '1px solid rgba(16, 185, 129, 0.2)', 
                    borderRadius: '6px' 
                  }}>
                    <label style={{ color: 'var(--success)', fontWeight: 'bold', display: 'block', marginBottom: '6px', fontSize: '0.8rem' }}>
                      🔗 상세 논리 모델 연결됨
                    </label>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-main)', marginBottom: '8px' }}>
                      이 엔터티는 <strong>{getFileDisplayName(refinementFile)}</strong> 주제 영역에 상세화되어 있습니다.
                    </div>
                    <button 
                      className="btn" 
                      style={{ 
                        width: '100%', 
                        fontSize: '0.75rem', 
                        padding: '6px', 
                        borderColor: 'var(--success)', 
                        color: 'var(--success)',
                        fontWeight: 'bold',
                        background: 'transparent'
                      }}
                      onClick={() => {
                        handleSelectFile(refinementFile.name);
                        setSelectedEntityName(selectedEntity.name);
                      }}
                    >
                      상세 논리 다이어그램으로 이동
                    </button>
                  </div>
                ) : (
                  <div className="form-group" style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.2)', borderRadius: '6px' }}>
                    <label style={{ color: '#b45309', fontWeight: 'bold', display: 'block', marginBottom: '6px', fontSize: '0.8rem' }}>
                      상세 논리 모델로 상세화 (Refine)
                    </label>
                    <select
                      className="form-control"
                      style={{ marginBottom: '8px', fontSize: '0.75rem' }}
                      value={refineTargetFile}
                      onChange={(e) => setRefineTargetFile(e.target.value)}
                    >
                      <option value="">-- 대상 상세 모델 파일 선택 --</option>
                      {projectFiles
                        .filter((f: any) => f.name !== activeFileName && !f.name.includes('conceptual'))
                        .map((f: any) => (
                          <option key={f.name} value={f.name}>{getFileDisplayName(f)}</option>
                        ))}
                    </select>
                    <button 
                      className="btn btn-primary" 
                      style={{ width: '100%', fontSize: '0.75rem', padding: '6px', backgroundColor: 'var(--accent-color)', borderColor: 'var(--accent-color)' }}
                      disabled={!refineTargetFile}
                      onClick={() => handleRefineEntity(selectedEntity.name, refineTargetFile)}
                    >
                      상세 모델로 상세화 진행
                    </button>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'center' }}>
                      * 주요 속성(key_attributes)이 상세 모델의 속성으로 자동 변환됩니다.
                    </div>
                  </div>
                )
              )}

              {/* Attributes Section */}
              <div style={{ marginTop: '20px' }}>
                <h3 style={{ fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Attributes
                  <button className="btn" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={handleAddAttribute}>
                    <Plus size={12} /> Add
                  </button>
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                  {selectedEntity.attributes.map((attr, idx) => (
                    <div key={idx} style={{ backgroundColor: 'var(--bg-main)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                      <div className="form-group" style={{ marginBottom: '6px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                          <div>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>논리 속성명</span>
                            <input 
                              type="text" 
                              className="form-control" 
                              style={{ fontWeight: 'bold', fontSize: '0.75rem' }}
                              value={attr.name}
                              onChange={(e) => handleUpdateAttribute(idx, { ...attr, name: e.target.value })}
                            />
                          </div>
                          <div>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>물리 컬럼명</span>
                            <input 
                              type="text" 
                              className="form-control" 
                              placeholder="e.g. USER_ID"
                              style={{ fontSize: '0.75rem' }}
                              value={attr.physicalName || ''}
                              onChange={(e) => handleUpdateAttribute(idx, { ...attr, physicalName: e.target.value.toUpperCase() || undefined })}
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                        <div>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Domain / Type</span>
                          <input 
                            type="text" 
                            className="form-control" 
                            style={{ fontSize: '0.75rem' }}
                            placeholder="Domain / Type"
                            value={attr.domain || ''}
                            onChange={(e) => handleUpdateAttribute(idx, { ...attr, domain: e.target.value || undefined })}
                          />
                        </div>
                        <div>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Key Type</span>
                          <select
                            className="form-control"
                            style={{ fontSize: '0.75rem' }}
                            value={attr.keyType || (attr.identifier ? 'PK' : attr.fk ? 'FK' : 'NORMAL')}
                            onChange={(e) => {
                              const kt = e.target.value as any;
                              handleUpdateAttribute(idx, {
                                ...attr,
                                keyType: kt,
                                identifier: kt === 'PK',
                                fk: kt === 'FK',
                                required: kt === 'PK' ? true : attr.required
                              });
                            }}
                          >
                            <option value="NORMAL">일반 속성</option>
                            <option value="PK">PK (주식별자)</option>
                            <option value="AK">AK (대체키/UK)</option>
                            <option value="FK">FK (외래키)</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <label className="form-checkbox" style={{ fontSize: '0.75rem' }}>
                            <input 
                              type="checkbox" 
                              checked={attr.identifier || attr.keyType === 'PK'}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                handleUpdateAttribute(idx, {
                                  ...attr,
                                  identifier: checked,
                                  keyType: checked ? 'PK' : (attr.keyType === 'PK' ? 'NORMAL' : attr.keyType),
                                  required: checked ? true : attr.required
                                });
                              }}
                            />
                            PK (#)
                          </label>
                          <label className="form-checkbox" style={{ fontSize: '0.75rem' }}>
                            <input 
                              type="checkbox" 
                              checked={attr.required || false}
                              onChange={(e) => handleUpdateAttribute(idx, { ...attr, required: e.target.checked })}
                              disabled={attr.identifier || attr.keyType === 'PK'}
                            />
                            Req (*)
                          </label>
                        </div>
                        <button 
                          className="btn btn-icon" 
                          style={{ color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)' }}
                          onClick={() => handleDeleteAttribute(idx)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                className="btn btn-secondary" 
                style={{ width: '100%', marginTop: '24px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                onClick={() => handleDeleteEntity(selectedEntity.name)}
              >
                <Trash2 size={16} /> Delete Entity
              </button>
            </div>
          ) : selectedRelationship ? (
            // Relationship Editor
            <div>
              <div className="detail-header">
                <h2>Relationship Details</h2>
                <p>Edit cardinality and optionality of the selected connection.</p>
              </div>

              <div className="form-group">
                <label>Relationship ID</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={selectedRelationship.id}
                  disabled
                />
              </div>

              <div className="form-group">
                <label>Relationship Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={selectedRelationship.name || ''}
                  onChange={(e) => handleUpdateRelationship({ ...selectedRelationship, name: e.target.value || undefined })}
                />
              </div>

              <div className="form-group">
                <label>Parent (One / Source)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={selectedRelationship.parent}
                  disabled
                />
              </div>

              <div className="form-group">
                <label>Child (Many / Target)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={selectedRelationship.child}
                  disabled
                />
              </div>

              <div className="form-group">
                <label>Cardinality</label>
                <select 
                  className="form-control"
                  value={selectedRelationship.cardinality}
                  onChange={(e) => handleUpdateRelationship({ ...selectedRelationship, cardinality: e.target.value as any })}
                >
                  <option value="one_to_many">One to Many (1:M)</option>
                  <option value="one_to_one">One to One (1:1)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Parent Participation (toward Child)</label>
                <select 
                  className="form-control"
                  value={selectedRelationship.parent_participation}
                  onChange={(e) => handleUpdateRelationship({ ...selectedRelationship, parent_participation: e.target.value as any })}
                >
                  <option value="0..M">0..M (Optional Many)</option>
                  <option value="1..M">1..M (Mandatory Many)</option>
                  <option value="0..1">0..1 (Optional One)</option>
                  <option value="1..1">1..1 (Mandatory One)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Child Participation (toward Parent)</label>
                <select 
                  className="form-control"
                  value={selectedRelationship.child_participation}
                  onChange={(e) => handleUpdateRelationship({ ...selectedRelationship, child_participation: e.target.value as any })}
                >
                  <option value="1..1">1..1 (Mandatory One)</option>
                  <option value="0..1">0..1 (Optional One)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-checkbox">
                  <input 
                    type="checkbox" 
                    checked={selectedRelationship.identifying}
                    onChange={(e) => handleUpdateRelationship({ ...selectedRelationship, identifying: e.target.checked })}
                  />
                  Identifying Relationship (Solid Line)
                </label>
              </div>

              <div className="quick-tips">
                <strong>Barker Rendering Tips:</strong>
                <p>- <strong>Identifying:</strong> Solid middle line segment.</p>
                <p>- <strong>Non-Identifying:</strong> Dashed middle line segment.</p>
                <p>- <strong>Optional:</strong> Dashed endpoint segment near the optional side.</p>
              </div>

              <button 
                className="btn btn-secondary" 
                style={{ width: '100%', marginTop: '24px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                onClick={() => handleDeleteRelationship(selectedRelationship.id)}
              >
                <Trash2 size={16} /> Delete Relationship
              </button>
            </div>
          ) : (
            // General Model Meta Editor
            <div>
              <div className="detail-header">
                <h2>Model Metadata</h2>
                <p>Logical model metadata details and global business rules.</p>
              </div>

              <div className="form-group">
                <label>Subject Area</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={model.subject_area}
                  onChange={(e) => handleUpdateModelMeta('subject_area', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Notation</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={model.notation || ''}
                  onChange={(e) => handleUpdateModelMeta('notation', e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Version</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={model.version || ''}
                    onChange={(e) => handleUpdateModelMeta('version', e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Status</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={model.status || ''}
                    onChange={(e) => handleUpdateModelMeta('status', e.target.value)}
                  />
                </div>
              </div>

              {/* Rules List */}
              <div style={{ marginTop: '20px' }}>
                <h3 style={{ fontSize: '0.9rem' }}>Business Rules</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                  {model.rules && model.rules.map((rule, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        backgroundColor: 'var(--bg-main)', 
                        padding: '10px', 
                        borderRadius: '6px', 
                        border: '1px solid var(--border-light)',
                        fontSize: '0.8rem',
                        position: 'relative'
                      }}
                    >
                      <p>{rule}</p>
                      <button 
                        style={{ position: 'absolute', top: '6px', right: '6px', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                        onClick={() => {
                          const updatedRules = model.rules?.filter((_, i) => i !== idx);
                          handleUpdateModelMeta('rules', updatedRules);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  
                  <button 
                    className="btn" 
                    style={{ fontSize: '0.8rem', width: '100%', justifyContent: 'center' }}
                    onClick={() => {
                      const newRule = prompt('새 비즈니스 규칙을 입력하세요:');
                      if (newRule) {
                        const updatedRules = [...(model.rules || []), newRule];
                        handleUpdateModelMeta('rules', updatedRules);
                      }
                    }}
                  >
                    <Plus size={14} /> Add Business Rule
                  </button>
                </div>
              </div>

              <div className="quick-tips" style={{ marginTop: '24px' }}>
                <strong>Quick Tips:</strong>
                <p>1. Double-click on any entity or relationship to open its details panel.</p>
                <p>2. Editing YAML code directly in the split editor immediately synchronizes the canvas model.</p>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* DDL Import Modal */}
      {isDdlModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Import from SQL DDL</h3>
              <button className="btn" style={{ padding: '4px 8px' }} onClick={() => setIsDdlModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                SQL DDL 코드(CREATE TABLE, PRIMARY KEY, FOREIGN KEY 문)를 붙여넣어 논리 모델로 일괄 반환합니다.
              </p>
              <textarea
                className="form-control"
                style={{ height: '240px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
                placeholder={`CREATE TABLE USERS (
  USER_ID INT PRIMARY KEY,
  USERNAME VARCHAR(50) NOT NULL
);`}
                value={ddlImportText}
                onChange={(e) => setDdlImportText(e.target.value)}
              />
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setIsDdlModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleDdlImport}>
                <Database size={14} /> Import Model
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standardization Dictionary Manager Modal */}
      {isDictOpen && (
        <DictionaryManager 
          model={model} 
          projectFiles={projectFiles}
          onUpdateFile={handleUpdateProjectFile}
          onClose={() => setIsDictOpen(false)} 
        />
      )}

      {/* Physical Transform Wizard Modal */}
      {isTransformOpen && activeFileName && (
        <PhysicalTransformWizard 
          model={model} 
          projectFiles={projectFiles}
          activeFileName={activeFileName} 
          onClose={() => setIsTransformOpen(false)} 
          onSavePhysicalFile={handleSavePhysicalFile}
        />
      )}

      {/* Model Linter (4 Pillars Quality Review) Modal */}
      <ModelLinterModal
        isOpen={isLinterOpen}
        onClose={() => setIsLinterOpen(false)}
        model={model}
        onSelectEntity={handleSelectEntityFromLinter}
      />

      {/* Auto-Relationship Discovery Modal */}
      <RelationshipDiscoveryModal
        isOpen={isDiscoveryOpen}
        onClose={() => setIsDiscoveryOpen(false)}
        model={model}
        onApplyRelationships={handleApplyDiscoveredRelationships}
      />

      {/* DA# 5 Interoperability Bridge Modal */}
      <DaBridgeModal
        isOpen={isDaBridgeOpen}
        onClose={() => setIsDaBridgeOpen(false)}
        currentModel={model}
        onLoadModel={handleLoadModelFromDaBridge}
      />
    </div>
  );
}
