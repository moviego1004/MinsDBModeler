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
  FolderOpen
} from 'lucide-react';
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
import CustomBarkerEdge from './components/CustomBarkerEdge.js';

const nodeTypes = {
  entityNode: CustomEntityNode,
  supertypeGroup: CustomGroupNode,
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
  const [projectFiles, setProjectFiles] = useState<{ name: string; handle: any; content: string }[]>([]);
  const [activeFileName, setActiveFileName] = useState<string | null>(null);
  const [dirHandle, setDirHandle] = useState<any>(null);
  const [refineTargetFile, setRefineTargetFile] = useState<string>('');

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);

  const nodesRef = useRef<any>([]);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Auto-save to disk when yamlText changes
  useEffect(() => {
    if (!activeFileName) return;
    const fileObj = projectFiles.find(f => f.name === activeFileName);
    if (fileObj && fileObj.handle) {
      const timeout = setTimeout(() => {
        fileObj.handle.createWritable().then((writable: any) => {
          writable.write(yamlText).then(() => writable.close());
        }).catch((err: any) => console.log('Auto-save write deferred or failed', err));
      }, 1000); // 1s debounce
      return () => clearTimeout(timeout);
    }
  }, [yamlText, activeFileName, projectFiles]);

  // Open directory picker
  const handleOpenProjectFolder = useCallback(async () => {
    try {
      const handle = await (window as any).showDirectoryPicker();
      setDirHandle(handle);
      
      const files: { name: string; handle: any; content: string }[] = [];
      for await (const entry of handle.values()) {
        if (entry.kind === 'file' && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
          const file = await entry.getFile();
          const content = await file.text();
          files.push({ name: entry.name, handle: entry, content });
        }
      }
      
      setProjectFiles(files);
      if (files.length > 0) {
        const sorted = [...files].sort((a, b) => {
          if (a.name.includes('user') && !b.name.includes('user')) return -1;
          if (!a.name.includes('user') && b.name.includes('user')) return 1;
          return a.name.localeCompare(b.name);
        });
        
        const firstFile = sorted[0];
        setActiveFileName(firstFile.name);
        setYamlText(firstFile.content);
        const parsed = parseModel(firstFile.content);
        setModel(parsed);
        setValidationErrors(validateModel(parsed, { allowUndefinedEntities: true }));
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        alert(`프로젝트 폴더를 여는데 실패했습니다: ${err.message}`);
      }
    }
  }, []);

  // Switch active file
  const handleSelectFile = useCallback((name: string) => {
    const fileObj = projectFiles.find(f => f.name === name);
    if (!fileObj) return;

    setActiveFileName(name);
    setYamlText(fileObj.content);
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
  }, [projectFiles]);

  // Create new file in project
  const handleNewFile = useCallback(async () => {
    if (!dirHandle) return;
    
    const name = prompt('새 모델 파일 이름을 입력하세요 (예: qvi-billing-logical.yaml):');
    if (!name) return;
    
    const filename = name.endsWith('.yaml') || name.endsWith('.yml') ? name : `${name}.yaml`;
    
    if (projectFiles.some(f => f.name === filename)) {
      alert('이미 존재하는 파일 이름입니다.');
      return;
    }
    
    try {
      const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
      const initialYaml = `subject_area: ${filename.replace(/[-_]/g, ' ').replace('.yaml', '')}
notation: Barker logical model
version: 0.1
status: draft
entities: []
relationships: []
`;
      
      const writable = await fileHandle.createWritable();
      await writable.write(initialYaml);
      await writable.close();
      
      const newFileObj = { name: filename, handle: fileHandle, content: initialYaml };
      setProjectFiles(prev => [...prev, newFileObj]);
      
      // Select the new file
      setActiveFileName(filename);
      setYamlText(initialYaml);
      const parsed = parseModel(initialYaml);
      setModel(parsed);
      setValidationErrors([]);
    } catch (err: any) {
      alert(`새 파일을 생성하는 데 실패했습니다: ${err.message}`);
    }
  }, [dirHandle, projectFiles]);

  // Refine conceptual entity into detailed logical model
  const handleRefineEntity = useCallback(async (entityName: string, targetFileName: string) => {
    if (!targetFileName) {
      alert('대상 상세 모델 파일을 선택해 주세요.');
      return;
    }

    const conceptualEntity = model.entities.find(e => e.name === entityName);
    if (!conceptualEntity) return;

    const fileObj = projectFiles.find(f => f.name === targetFileName);
    if (!fileObj) return;

    try {
      const targetModel = parseModel(fileObj.content);
      
      // Check if entity already exists
      if (targetModel.entities.some(e => e.name === entityName)) {
        alert(`대상 파일 "${targetFileName}"에 이미 "${entityName}" 엔터티가 존재합니다.`);
        return;
      }

      // Convert key_attributes to detailed attributes if available
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
      
      // Save updated target file to project state
      setProjectFiles(prev => prev.map(f => f.name === targetFileName ? { ...f, content: yaml } : f));
      
      // Auto-save to target file on disk
      if (fileObj.handle) {
        const writable = await fileObj.handle.createWritable();
        await writable.write(yaml);
        await writable.close();
      }

      // Switch to the target file
      handleSelectFile(targetFileName);
      setSelectedEntityName(entityName);
      
      alert(`"${entityName}" 엔터티를 "${targetFileName}" 상세 모델로 성공적으로 상세화(Refine)하여 이동했습니다!`);
    } catch (e: any) {
      alert(`상세화 처리 중 오류가 발생했습니다: ${e.message}`);
    }
  }, [model, projectFiles, handleSelectFile]);

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
      
      // Auto-save memory state of project file
      if (activeFileName) {
        setProjectFiles(prev => prev.map(f => f.name === activeFileName ? { ...f, content: yaml } : f));
      }
      
      const errors = validateModel(updatedModel, { allowUndefinedEntities: true });
      setValidationErrors(errors);
    } catch (err) {
      console.error('Failed to stringify model', err);
    }
  }, [activeFileName]);

  // Gather all entities defined in any project files
  const allProjectEntities = useMemo(() => {
    const entities: Entity[] = [];
    const addedNames = new Set<string>();
    projectFiles.forEach(f => {
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
    const layoutDetails = new Map<string, { width: number; height: number; localY: number }>();

    // Helper to calculate size of a branch
    function getBranchSize(name: string): { width: number; height: number } {
      const ent = entityMap.get(name);
      if (!ent) return { width: NODE_WIDTH, height: 100 };

      const selfAttrHeight = HEADER_HEIGHT + ent.attributes.length * ATTR_HEIGHT + 10;
      const children = parentToChildren.get(name) || [];

      if (children.length === 0) {
        const size = { width: NODE_WIDTH + PADDING * 2, height: selfAttrHeight + PADDING * 2 };
        layoutDetails.set(name, { ...size, localY: 0 });
        return size;
      }

      // If it has subtypes, we stack them vertically inside the supertype container
      let totalChildrenHeight = 0;
      let maxWidth = NODE_WIDTH;

      const childrenSizes = children.map(childName => {
        const size = getBranchSize(childName);
        if (size.width > maxWidth) {
          maxWidth = size.width;
        }
        return { name: childName, ...size };
      });

      // Calculate vertical positions for child nodes
      let currentY = selfAttrHeight + PADDING * 2;
      childrenSizes.forEach(child => {
        layoutDetails.set(child.name, {
          width: child.width,
          height: child.height,
          localY: currentY,
        });
        currentY += child.height + PADDING;
      });

      totalChildrenHeight = currentY;

      const finalSize = {
        width: maxWidth + PADDING * 2,
        height: totalChildrenHeight,
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

    // Map existing positions to preserve them if not resetting
    const existingPositions = new Map<string, { x: number; y: number }>();
    const isReset = lastProcessedLayoutTrigger.current !== layoutTrigger;
    
    if (isReset) {
      lastProcessedLayoutTrigger.current = layoutTrigger;
    } else {
      nodesRef.current.forEach((n: any) => {
        existingPositions.set(n.id, n.position);
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

      const layout = layouts.get(name) || { width: NODE_WIDTH, height: 100, localY: 0 };
      const children = parentToChildren.get(name) || [];
      const isExternal = !activeNames.has(name);

      const ancestorAttrs = getAncestorAttributeNames(name);
      const filteredAttributes = ent.attributes.filter(a => !ancestorAttrs.has(a.name));

      // If it is a supertype, we render a Group Node container, and place the Attributes Node inside it
      if (children.length > 0) {
        const groupId = `group-${name}`;
        
        // 1. Add the Supertype Group Container Node
        rfNodes.push({
          id: groupId,
          parentId: parentId || undefined,
          type: 'supertypeGroup',
          position: parentId ? { x: PADDING, y: layout.localY } : { x: globalX, y: globalY },
          style: { width: layout.width, height: layout.height },
          data: { label: name },
        });

        // 2. Add the Supertype Attribute Node inside this Group
        rfNodes.push({
          id: name,
          parentId: groupId,
          type: 'entityNode',
          position: { x: PADDING, y: PADDING + 10 },
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

        // 3. Add Subtypes recursively inside the Group
        children.forEach(childName => {
          buildNodes(childName, groupId, 0, 0);
        });

      } else {
        // If it is a leaf entity / subtype / external entity
        rfNodes.push({
          id: name,
          parentId: parentId || undefined,
          type: 'entityNode',
          position: parentId ? { x: PADDING, y: layout.localY } : { x: globalX, y: globalY },
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

    // Masonry Packing Layout for roots
    const colX = [50, 480, 910];
    const colY = [50, 50, 50];

    roots.forEach((root) => {
      const layout = layouts.get(root) || { width: NODE_WIDTH + PADDING * 2, height: 200 };
      const children = parentToChildren.get(root) || [];
      const hasGroup = children.length > 0;
      const targetId = hasGroup ? `group-${root}` : root;

      let x = 0;
      let y = 0;

      if (existingPositions.has(targetId)) {
        const pos = existingPositions.get(targetId)!;
        x = pos.x;
        y = pos.y;
      } else {
        // Masonry Calculation
        let minColIdx = 0;
        let minColY = colY[0];
        for (let i = 1; i < colY.length; i++) {
          if (colY[i] < minColY) {
            minColY = colY[i];
            minColIdx = i;
          }
        }
        x = colX[minColIdx];
        y = minColY;
        
        // Update column height
        colY[minColIdx] += layout.height + 80; // 80px gap
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
  }, [model, selectedRelationshipId, computeHierarchyLayouts, setNodes, setEdges, layoutTrigger, allProjectEntities]);

  // Sync node dragging position back to model if saved in diagrams
  const onNodeDragStop = useCallback((_event: any, node: any) => {
    // Only update position if we are drag-moving a root node or root group
    if (!node.parentId) {
      // In Barker modeler, we can save positions in model.diagrams
      // Let's implement diagram saving or just leave it local for the web view
    }
  }, []);

  // Double click handler for nodes: switches files for external entities or jumps from conceptual to detailed logical models
  const onNodeDoubleClick = useCallback((_event: any, node: any) => {
    const entityName = node.id.replace('group-', '');
    
    // Search other files in the project first for a matching entity name or subject area
    const otherFiles = projectFiles.filter(f => f.name !== activeFileName);
    const definingFile = otherFiles.find(f => {
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
        <div className="header-title-section">
          <Database size={20} className="text-blue-500" />
          <h1>MinsDBModeler</h1>
          <span>{model.subject_area}</span>
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
          <button 
            className="btn"
            onClick={() => setLayoutTrigger(prev => prev + 1)}
          >
            <RefreshCw size={16} /> Auto Layout
          </button>

          <button className="btn btn-secondary" onClick={handleOpenProjectFolder}>
            <FolderOpen size={16} /> Open Project
          </button>

          <label className="btn btn-secondary">
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
            <h3>
              Project Workspace
              {dirHandle ? (
                <button 
                  className="btn btn-icon" 
                  style={{ padding: '2px 6px', fontSize: '0.75rem' }} 
                  onClick={handleNewFile}
                >
                  <Plus size={14} /> New
                </button>
              ) : null}
            </h3>
            
            {!dirHandle ? (
              <div style={{ padding: '8px 0' }}>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleOpenProjectFolder}>
                  Open Project Folder
                </button>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'center' }}>
                  Select folder containing YAML models
                </div>
              </div>
            ) : (
              <div className="entity-list" style={{ maxHeight: '160px' }}>
                {projectFiles.map(file => (
                  <div 
                    key={file.name} 
                    className="entity-list-item"
                    onClick={() => handleSelectFile(file.name)}
                    style={{
                      borderColor: activeFileName === file.name ? 'var(--accent-color)' : undefined,
                      backgroundColor: activeFileName === file.name ? 'rgba(59, 130, 246, 0.05)' : undefined,
                      fontWeight: activeFileName === file.name ? 'bold' : 'normal'
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📄 {file.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
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
          </div>

          {/* Monaco Editor Pane (Visible only in Split View) */}
          {activeTab === 'split' && (
            <div className="editor-pane">
              <div className="editor-pane-header">
                YAML Schema Source Code (Round-trip)
              </div>
              <div style={{ flex: 1 }}>
                <Editor
                  height="100%"
                  language="yaml"
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
                      .filter(f => f.name !== activeFileName && !f.name.includes('conceptual'))
                      .map(f => (
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
    </div>
  );
}
