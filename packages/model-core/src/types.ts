export interface Attribute {
  name: string;
  domain?: string;
  required: boolean;
  identifier?: boolean;
  fk?: boolean;
  description?: string;
  defaultValue?: string;
}

export interface SubtypeSetRef {
  name: string;
  disjoint: boolean;
  total: boolean;
  subtypes: string[];
}

export interface Entity {
  name: string;
  type: 'entity' | 'supertype' | 'subtype';
  supertype?: string;
  identifier: string | string[];
  discriminator?: string;
  attributes: Attribute[];
  subtype_sets?: SubtypeSetRef[];
  key_attributes?: string[];
  purpose?: string;
}

export interface SubtypeSet {
  id?: string;
  name?: string;
  supertype: string;
  subtypes: string[];
  total: boolean;
  disjoint: boolean;
  discriminator?: string;
  description?: string;
}

export type Participation = '0..1' | '1..1' | '0..M' | '1..M';

export interface Relationship {
  id: string;
  name?: string;
  parent: string;
  child: string;
  parent_to_child?: string;
  child_to_parent?: string;
  cardinality: 'one_to_one' | 'one_to_many' | 'many_to_many';
  parent_participation: Participation;
  child_participation: Participation;
  identifying: boolean;
  fk_attributes?: string[];
  barker_sentence?: string;
  recursive?: boolean;
}

export interface DiagramObject {
  id: string;
  modelRef: string; // References Entity name
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
  collapsed?: boolean;
  locked?: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface DiagramConnector {
  id: string;
  relationshipId: string;
  sourceObjectId: string;
  targetObjectId: string;
  sourcePort?: 'top' | 'bottom' | 'left' | 'right';
  targetPort?: 'top' | 'bottom' | 'left' | 'right';
  waypoints?: Point[];
}

export interface Diagram {
  id: string;
  subject_area?: string;
  objects: DiagramObject[];
  connectors: DiagramConnector[];
  zoom?: number;
  pan?: Point;
  canvas_size?: { width: number; height: number };
}

export interface LogicalModel {
  subject_area: string;
  notation?: string;
  version?: string | number;
  status?: string;
  source_document?: string;
  standard_document?: string;
  entities: Entity[];
  subtype_sets?: SubtypeSet[];
  relationships: Relationship[];
  rules?: string[];
  relationship_rules?: string[];
  diagrams?: Diagram[];
}
