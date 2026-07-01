import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Panel,
} from '@xyflow/react';
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
  BookOpen
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
} from '@barker-modeler/model-core';
import type {
  LogicalModel,
  Entity,
  Attribute,
  Relationship,
  ValidationError
} from '@barker-modeler/model-core';

import { DEFAULT_MODEL_YAML } from './defaultModel.js';
import CustomEntityNode from './components/CustomEntityNode.js';
import CustomGroupNode from './components/CustomGroupNode.js';
import CustomSubtypeSetNode from './components/CustomSubtypeSetNode.js';
import CustomBarkerEdge from './components/CustomBarkerEdge.js';
import DictionaryManager from './components/DictionaryManager.js';
import PhysicalTransformWizard from './components/PhysicalTransformWizard.js';

const nodeTypes = {
  entityNode: CustomEntityNode,
  supertypeGroup: CustomGroupNode,
  subtypeSetGroup: CustomSubtypeSetNode,
};

const edgeTypes = {
  barkerEdge: CustomBarkerEdge,
};

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
  const [activeTab, setActiveTab] = useState<'canvas' | 'split'>('split');
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

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);

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

    // Map existing positions to preserve them if not resetting
    const existingPositions = new Map<string, { x: number; y: number }>();
    const isReset = lastProcessedLayoutTrigger.current !== layoutTrigger;
    
    if (isReset) {
      lastProcessedLayoutTrigger.current = layoutTrigger;
      // Do not load any existing or saved positions, recalculate fresh!
    } else {
      // 1. Populate from viewport positions
      nodesRef.current.forEach((n: any) => {
        existingPositions.set(n.id, n.position);
      });
      // 2. Fallback to saved positions from the file
      Object.keys(savedLayout).forEach(id => {
        if (!existingPositions.has(id)) {
          existingPositions.set(id, savedLayout[id]);
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

      const layout = layouts.get(name) || { width: NODE_WIDTH, height: 100, localX: PADDING, localY: 0 };
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

      // If it is a supertype, we render it directly as a Group Node container containing attributes
      if (sets.length > 0) {
        rfNodes.push({
          id: name,
          parentId: parentId || undefined,
          type: 'supertypeGroup',
          position: parentId 
            ? { x: layout.localX ?? PADDING, y: layout.localY } 
            : { x: globalX, y: globalY },
          style: { width: layout.width, height: layout.height },
          data: {
            ...ent,
            label: name,
            attributes: filteredAttributes,
            isExternal,
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

          // 1. Add Subtype Set Box
          rfNodes.push({
            id: setId,
            parentId: name, // parent is the Supertype Node
            type: 'subtypeSetGroup',
            position: { x: setLayout.localX ?? PADDING, y: setLayout.localY },
            style: { width: setLayout.width, height: setLayout.height },
            data: { label: set.name },
          });

          // 2. Add child Subtypes inside the Subtype Set Box recursively
          set.subtypes.forEach(subName => {
            buildNodes(subName, setId, 0, 0); // parent is the Subtype Set Node
          });
        });

      } else {
        // If it is a leaf entity / subtype / external entity
        rfNodes.push({
          id: name,
          parentId: parentId || undefined,
          type: 'entityNode',
          position: parentId 
            ? { x: layout.localX ?? PADDING, y: layout.localY } 
            : { x: globalX, y: globalY },
          style: { width: NODE_WIDTH },
          data: {
            ...ent,
            attributes: filteredAttributes,
            isExternal,
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

    // Row-based wrapping layout for roots (collision-free & responsive to wide supertypes)
    let currentX = 50;
    let currentY = 50;
    let currentRowHeight = 0;
    const MAX_CANVAS_WIDTH = 1350; // Wrap coordinates when exceeding this width

    roots.forEach((root) => {
      const layout = layouts.get(root) || { width: NODE_WIDTH + PADDING * 2, height: 200 };

      let x = 0;
      let y = 0;

      if (existingPositions.has(root)) {
        const pos = existingPositions.get(root)!;
        x = pos.x;
        y = pos.y;
      } else {
        // If node width causes it to overflow row width, wrap to a new row
        if (currentX + layout.width > MAX_CANVAS_WIDTH && currentX > 50) {
          currentX = 50;
          currentY += currentRowHeight + 100; // 100px vertical gap
          currentRowHeight = 0;
        }

        x = currentX;
        y = currentY;

        // Advance horizontal position
        currentX += layout.width + 100; // 100px horizontal gap
        if (layout.height > currentRowHeight) {
          currentRowHeight = layout.height;
        }
      }

      buildNodes(root, null, x, y);
    });

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

    setNodes(rfNodes);
    setEdges(rfEdges);

    // Save calculated coordinates on Auto Layout (Reset) so they are preserved
    if (isReset && activeProjectId && activeFileName && rfNodes.length > 0) {
      const layoutMap: Record<string, { x: number; y: number }> = {};
      rfNodes.forEach((n: any) => {
        layoutMap[n.id] = { x: n.position.x, y: n.position.y };
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
  }, [model, selectedRelationshipId, computeHierarchyLayouts, setNodes, setEdges, layoutTrigger, allProjectEntities, activeProjectId, activeFileName, yamlText, pushHistory]);

  // Sync node dragging position back to project files in localStorage and track history
  const onNodeDragStop = useCallback((_event: any, _node: any, latestNodes: any[]) => {
    if (!activeProjectId || !activeFileName) return;

    // Gather coordinates of all nodes from latest nodes array passed by React Flow
    const layoutMap: Record<string, { x: number; y: number }> = {};
    latestNodes.forEach((n: any) => {
      layoutMap[n.id] = { x: n.position.x, y: n.position.y };
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

  // Double click handler for nodes: switches files for external entities or jumps from conceptual to detailed logical models
  const onNodeDoubleClick = useCallback((_event: any, node: any) => {
    const entityName = node.id.replace('group-', '');
    
    // Search other files in the project first for a matching entity name or subject area
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
    
    // Default fallback: select it locally
    setSelectedEntityName(entityName);
    setSelectedRelationshipId(null);
  }, [projectFiles, activeFileName, handleSelectFile]);

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

  // File Upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setYamlText(text);
      updateModelFromYaml(text);
    };
    reader.readAsText(file);
  }, [updateModelFromYaml]);

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

          <label className="btn btn-secondary" title="Load YAML to overwrite current active file">
            <Upload size={16} /> Load YAML
            <input 
              type="file" 
              accept=".yaml,.yml" 
              onChange={handleFileUpload} 
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

          {activeFileName && (activeFileName.endsWith('.yaml') || activeFileName.endsWith('.yml')) && (
            <button 
              className="btn btn-secondary" 
              title="상세논리모델을 물리 테이블 모델 및 DDL로 전환"
              onClick={() => setIsTransformOpen(true)}
              style={{ border: '1px solid var(--accent-color)', color: 'var(--accent-color)' }}
            >
              <Database size={16} /> 물리 전환
            </button>
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
                {/* Import local file into active project */}
                <label className="btn btn-icon" style={{ padding: '2px 6px', fontSize: '0.75rem', cursor: 'pointer', border: '1px solid var(--border-color)', height: '24px', display: 'flex', alignItems: 'center' }} title="Import File">
                  <Upload size={12} />
                  <input 
                    type="file" 
                    accept=".yaml,.yml,.sql,.ddl" 
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file || !activeProjectId) return;
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
            
            <div className="entity-list" style={{ maxHeight: '200px' }}>
              {projectFiles.map((file: any) => (
                <div 
                  key={file.name} 
                  className="entity-list-item"
                  onClick={() => handleSelectFile(file.name)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderColor: activeFileName === file.name ? 'var(--accent-color)' : undefined,
                    backgroundColor: activeFileName === file.name ? 'rgba(59, 130, 246, 0.05)' : undefined,
                    fontWeight: activeFileName === file.name ? 'bold' : 'normal',
                    paddingRight: '6px'
                  }}
                >
                  <span style={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {file.name.endsWith('.sql') || file.name.endsWith('.ddl') ? '📜' : '📄'} {file.name}
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
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeDragStop={onNodeDragStop}
                onSelectionChange={onSelectionChange}
                onNodeDoubleClick={onNodeDoubleClick}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
              >
                <Background color="#cbd5e1" gap={20} size={1} />
                <Controls />
                <MiniMap 
                  nodeStrokeColor={(n) => n.type === 'supertypeGroup' ? '#cbd5e1' : '#94a3b8'}
                  nodeColor={(n) => n.type === 'supertypeGroup' ? 'rgba(241, 245, 249, 0.4)' : '#ffffff'}
                  style={{ backgroundColor: 'var(--bg-sidebar)' }} 
                />
                
                <Panel position="bottom-left" style={{ background: 'var(--bg-sidebar)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                  <strong>Barker Notation Guide:</strong> Dotted line = Non-Identifying/Optional. Solid = Identifying/Mandatory. Crow's foot = Many.
                </Panel>
              </ReactFlow>
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
                <label>Entity Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={selectedEntity.name}
                  onChange={(e) => handleUpdateEntity({ ...selectedEntity, name: e.target.value })}
                />
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
                        <option key={f.name} value={f.name}>{f.name}</option>
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
                      <div className="form-group" style={{ marginBottom: '8px' }}>
                        <input 
                          type="text" 
                          className="form-control" 
                          style={{ fontWeight: 'bold' }}
                          value={attr.name}
                          onChange={(e) => handleUpdateAttribute(idx, { ...attr, name: e.target.value })}
                        />
                      </div>
                      
                      <div className="form-row" style={{ marginBottom: '8px' }}>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="Domain / Type"
                          value={attr.domain || ''}
                          onChange={(e) => handleUpdateAttribute(idx, { ...attr, domain: e.target.value || undefined })}
                        />
                      </div>

                      <div className="form-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                        <label className="form-checkbox">
                          <input 
                            type="checkbox" 
                            checked={attr.identifier || false}
                            onChange={(e) => handleUpdateAttribute(idx, { ...attr, identifier: e.target.checked, required: e.target.checked ? true : attr.required })}
                          />
                          PK (#)
                        </label>
                        <label className="form-checkbox">
                          <input 
                            type="checkbox" 
                            checked={attr.required || false}
                            onChange={(e) => handleUpdateAttribute(idx, { ...attr, required: e.target.checked })}
                            disabled={attr.identifier} // PK must be required
                          />
                          Req (*)
                        </label>
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
        <DictionaryManager model={model} onClose={() => setIsDictOpen(false)} />
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
    </div>
  );
}
