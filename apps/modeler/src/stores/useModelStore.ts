import { create } from 'zustand';
import type { 
  LogicalModel, 
  Entity, 
  Attribute, 
  Relationship, 
  ValidationError 
} from '@barker-modeler/model-core';
import { 
  parseModel, 
  stringifyModel, 
  validateModel 
} from '@barker-modeler/model-core';

interface ModelState {
  yamlText: string;
  model: LogicalModel;
  validationErrors: ValidationError[];
  selectedEntityName: string | null;
  selectedRelationshipId: string | null;
  viewMode: 'logical' | 'physical';

  // Actions
  setYamlText: (yaml: string) => void;
  setModel: (model: LogicalModel) => void;
  selectEntity: (name: string | null) => void;
  selectRelationship: (id: string | null) => void;
  setViewMode: (mode: 'logical' | 'physical') => void;
  
  // Entity CRUD
  updateEntity: (entityName: string, patch: Partial<Entity>) => void;
  addEntity: (entity: Entity) => void;
  deleteEntity: (entityName: string) => void;
  
  // Attribute CRUD
  addAttribute: (entityName: string, attribute: Attribute) => void;
  updateAttribute: (entityName: string, attrName: string, patch: Partial<Attribute>) => void;
  deleteAttribute: (entityName: string, attrName: string) => void;

  // Relationship CRUD
  addRelationship: (rel: Relationship) => void;
  updateRelationship: (id: string, patch: Partial<Relationship>) => void;
  deleteRelationship: (id: string) => void;
}

export const useModelStore = create<ModelState>((set, get) => ({
  yamlText: '',
  model: { subject_area: '', entities: [], relationships: [] },
  validationErrors: [],
  selectedEntityName: null,
  selectedRelationshipId: null,
  viewMode: 'logical',

  setYamlText: (yaml: string) => {
    try {
      const parsed = parseModel(yaml);
      const errors = validateModel(parsed);
      set({ yamlText: yaml, model: parsed, validationErrors: errors });
    } catch {
      // In case of syntax error during typing, keep the text
      set({ yamlText: yaml });
    }
  },

  setModel: (model: LogicalModel) => {
    const yaml = stringifyModel(model);
    const errors = validateModel(model);
    set({ model, yamlText: yaml, validationErrors: errors });
  },

  selectEntity: (name: string | null) => {
    set({ selectedEntityName: name, selectedRelationshipId: null });
  },

  selectRelationship: (id: string | null) => {
    set({ selectedRelationshipId: id, selectedEntityName: null });
  },

  setViewMode: (viewMode: 'logical' | 'physical') => {
    set({ viewMode });
  },

  updateEntity: (entityName: string, patch: Partial<Entity>) => {
    const { model } = get();
    const updatedEntities = model.entities.map(e => 
      e.name === entityName ? { ...e, ...patch } : e
    );
    const updatedModel = { ...model, entities: updatedEntities };
    get().setModel(updatedModel);
  },

  addEntity: (entity: Entity) => {
    const { model } = get();
    const updatedModel = {
      ...model,
      entities: [...model.entities, entity],
    };
    get().setModel(updatedModel);
  },

  deleteEntity: (entityName: string) => {
    const { model } = get();
    const updatedEntities = model.entities.filter(e => e.name !== entityName);
    const updatedRelationships = model.relationships.filter(
      r => r.parent !== entityName && r.child !== entityName
    );
    const updatedModel = {
      ...model,
      entities: updatedEntities,
      relationships: updatedRelationships,
    };
    get().setModel(updatedModel);
  },

  addAttribute: (entityName: string, attribute: Attribute) => {
    const { model } = get();
    const updatedEntities = model.entities.map(e => {
      if (e.name !== entityName) return e;
      return {
        ...e,
        attributes: [...e.attributes, attribute],
      };
    });
    get().setModel({ ...model, entities: updatedEntities });
  },

  updateAttribute: (entityName: string, attrName: string, patch: Partial<Attribute>) => {
    const { model } = get();
    const updatedEntities = model.entities.map(e => {
      if (e.name !== entityName) return e;
      return {
        ...e,
        attributes: e.attributes.map(a => a.name === attrName ? { ...a, ...patch } : a),
      };
    });
    get().setModel({ ...model, entities: updatedEntities });
  },

  deleteAttribute: (entityName: string, attrName: string) => {
    const { model } = get();
    const updatedEntities = model.entities.map(e => {
      if (e.name !== entityName) return e;
      return {
        ...e,
        attributes: e.attributes.filter(a => a.name !== attrName),
      };
    });
    get().setModel({ ...model, entities: updatedEntities });
  },

  addRelationship: (rel: Relationship) => {
    const { model } = get();
    get().setModel({
      ...model,
      relationships: [...model.relationships, rel],
    });
  },

  updateRelationship: (id: string, patch: Partial<Relationship>) => {
    const { model } = get();
    const updatedRelationships = model.relationships.map(r => 
      r.id === id ? { ...r, ...patch } : r
    );
    get().setModel({ ...model, relationships: updatedRelationships });
  },

  deleteRelationship: (id: string) => {
    const { model } = get();
    const updatedRelationships = model.relationships.filter(r => r.id !== id);
    get().setModel({ ...model, relationships: updatedRelationships });
  },
}));
