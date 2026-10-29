export interface Attribute {
  id?: string;
  name: string;
  physicalName?: string;
  domain?: string;
  required: boolean;
  identifier?: boolean;
  keyType?: 'PK' | 'AK' | 'FK' | 'NORMAL';
  fk?: boolean;
  description?: string;
  defaultValue?: string;
  alias?: string;
}

export interface SubtypeSetRef {
  name: string;
  disjoint: boolean;
  total: boolean;
  subtypes: string[];
}

export interface EntityVolumeInfo {
  period?: 'daily' | 'monthly' | 'yearly' | 'on_demand';
  monthlyQuantity?: number;
  retentionMonths?: number;
  totalQuantity?: number;
}

export interface Entity {
  id?: string;
  name: string;
  physicalName?: string;
  alias?: string;
  type: 'entity' | 'supertype' | 'subtype';
  classification?: 'KEY' | 'MAIN' | 'ACTION';
  level?: 1 | 2 | 3;
  volume?: EntityVolumeInfo;
  supertype?: string;
  identifier: string | string[];
  discriminator?: string;
  attributes: Attribute[];
  subtype_sets?: SubtypeSetRef[];
  key_attributes?: string[];
  purpose?: string;
  business_rules?: string[];
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
  parentEntityId?: string;
  childEntityId?: string;
  parent_to_child?: string;
  child_to_parent?: string;
  cardinality: 'one_to_one' | 'one_to_many' | 'many_to_many';
  parent_participation: Participation;
  child_participation: Participation;
  identifying: boolean;
  fk_attributes?: string[];
  barker_sentence?: string;
  recursive?: boolean;
  ri_rule?: {
    on_update?: 'CASCADE' | 'RESTRICT' | 'SET_NULL' | 'NO_ACTION';
    on_delete?: 'CASCADE' | 'RESTRICT' | 'SET_NULL' | 'NO_ACTION';
  };
}

export interface DiagramObject {
  id: string;
  modelRef: string; // References Entity name or Entity id
  entityId?: string;
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
