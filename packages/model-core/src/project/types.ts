import type { Entity, Relationship, SubtypeSet } from '../types.js';

/**
 * Project repository — the single source of truth for a MinsDBModeler project.
 *
 * Every model object is defined exactly once and referenced by an immutable ID.
 * Diagrams (subject areas) are *views*: a list of member IDs plus positions.
 * Physical model and DDL are derived from the logical model; only explicit
 * overrides and generated outputs are stored.
 *
 * In memory all cross references use IDs:
 *   entity.supertype, subtype_sets[].subtypes, relationship.parent/child,
 *   subtypeSet.supertype/subtypes, conceptual.realizes, diagram.members/positions
 */

export const PROJECT_FORMAT_VERSION = 1;
export const PROJECT_MARKER_FILE = 'minsmodeler.yaml';

export type DbmsType = 'ORACLE' | 'POSTGRESQL' | 'MYSQL';
export type NamingCase = 'UPPER_SNAKE' | 'LOWER_SNAKE';
export type SubtypeStrategy = 'ROLL_UP' | 'ROLL_DOWN' | 'IDENTITY';
export type ModelLevel = 'conceptual' | 'logical';

export interface ProjectConfig {
  formatVersion: number;
  name: string;
  description?: string;
  version: string;
  targetDbms: DbmsType;
  namingCase: NamingCase;
  subtypeStrategy: SubtypeStrategy;
}

/** A conceptual (business) entity. `realizes` traces it to the logical entities that implement it (1:N). */
export interface ConceptualEntity extends Entity {
  id: string;
  realizes?: string[];
}

export interface ShapePosition {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

/** A diagram is a view over the repository (DA# "주제영역 다이어그램"). */
export interface DiagramView {
  id: string;
  name: string;
  level: ModelLevel;
  description?: string;
  /** Show every object of the level (the "전체" diagram). */
  includeAll?: boolean;
  /** Member object IDs (ignored when includeAll). Subtypes of members are shown automatically. */
  members: string[];
  /** Root shape positions keyed by object ID. */
  positions: Record<string, ShapePosition>;
}

export interface ModelProject {
  config: ProjectConfig;
  entities: (Entity & { id: string })[];
  relationships: Relationship[];
  subtypeSets: SubtypeSet[];
  rules: string[];
  conceptual: {
    entities: ConceptualEntity[];
    relationships: Relationship[];
  };
  diagrams: DiagramView[];
  /** Standardization dictionary, stored verbatim (its editors own the format). */
  standards: { dictionary: string; domains: string };
  physical: { overrides: string };
  /** Generated artifacts (DDL, physical specs): path under output/ -> content. */
  outputs: Record<string, string>;
}

export const DEFAULT_PROJECT_CONFIG: Omit<ProjectConfig, 'name'> = {
  formatVersion: PROJECT_FORMAT_VERSION,
  version: '0.1.0',
  targetDbms: 'ORACLE',
  namingCase: 'UPPER_SNAKE',
  subtypeStrategy: 'ROLL_UP',
};

export const ALL_LOGICAL_DIAGRAM_ID = 'dgm_all_logical';
export const ALL_CONCEPTUAL_DIAGRAM_ID = 'dgm_all_conceptual';

export function createEmptyProject(config: Partial<ProjectConfig> & { name: string }): ModelProject {
  return {
    config: { ...DEFAULT_PROJECT_CONFIG, ...config, formatVersion: PROJECT_FORMAT_VERSION },
    entities: [],
    relationships: [],
    subtypeSets: [],
    rules: [],
    conceptual: { entities: [], relationships: [] },
    diagrams: [
      { id: ALL_CONCEPTUAL_DIAGRAM_ID, name: '전체 개념 모델', level: 'conceptual', includeAll: true, members: [], positions: {} },
      { id: ALL_LOGICAL_DIAGRAM_ID, name: '전체 논리 모델', level: 'logical', includeAll: true, members: [], positions: {} },
    ],
    standards: { dictionary: 'words: []\nterms: []\n', domains: 'domains: []\n' },
    physical: { overrides: 'table_overrides: []\n' },
    outputs: {},
  };
}

/** Deterministic short hash (FNV-1a, base36) — stable IDs for imported objects. */
export function stableHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).padStart(7, '0');
}

let counter = 0;
/** Fresh unique ID for objects created in the editor. */
export function newId(prefix: string): string {
  counter = (counter + 1) % 1296;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36).padStart(2, '0')}${Math.floor(Math.random() * 1296)
    .toString(36)
    .padStart(2, '0')}`;
}
