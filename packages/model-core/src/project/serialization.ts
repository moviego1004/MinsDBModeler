import { parse as yamlParse, stringify as yamlStringify } from 'yaml';
import type { Attribute, Entity, Relationship, SubtypeSet } from '../types.js';
import {
  ALL_CONCEPTUAL_DIAGRAM_ID,
  ALL_LOGICAL_DIAGRAM_ID,
  createEmptyProject,
  PROJECT_FORMAT_VERSION,
  PROJECT_MARKER_FILE,
  type ConceptualEntity,
  type DiagramView,
  type ModelProject,
  type ProjectConfig,
} from './types.js';

/*
 * Folder layout (one project = one folder = one Git repository):
 *
 *   minsmodeler.yaml                 project config + marker
 *   model/entities/<entityId>.yaml   one logical entity per file
 *   model/relationships.yaml
 *   model/subtype-sets.yaml
 *   model/rules.yaml
 *   conceptual/entities.yaml
 *   conceptual/relationships.yaml
 *   diagrams/<diagramId>.yaml        views: members + positions only
 *   standards/dictionary.yaml
 *   standards/domains.yaml
 *   physical/overrides.yaml
 *   output/**                        generated DDL / specs
 */

export const MANAGED_PREFIXES = ['model/', 'conceptual/', 'diagrams/', 'standards/', 'physical/', 'output/'];

export function isManagedPath(path: string): boolean {
  return path === PROJECT_MARKER_FILE || MANAGED_PREFIXES.some((p) => path.startsWith(p));
}

const dump = (value: unknown) =>
  yamlStringify(JSON.parse(JSON.stringify(value)), { indent: 2, lineWidth: 0, aliasDuplicateObjects: false });

const empty = (v: unknown) =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length === 0);

/** Copy `obj` keeping `order` first, dropping empty values — stable output for Git diffs. */
function ordered<T extends object>(obj: T, order: string[]): Record<string, unknown> {
  const src = obj as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  [...order, ...Object.keys(src).filter((k) => !order.includes(k)).sort()].forEach((k) => {
    if (k in src && !empty(src[k])) out[k] = src[k];
  });
  return out;
}

/** Drop `false` flags whose absence already means false (keeps files short). */
function dropFalse(o: Record<string, unknown>, keys: string[]) {
  keys.forEach((k) => {
    if (o[k] === false) delete o[k];
  });
  return o;
}

const ATTR_ORDER = ['id', 'name', 'physicalName', 'alias', 'domain', 'required', 'identifier', 'keyType', 'fk', 'defaultValue', 'description'];
const ENTITY_ORDER = [
  'id', 'name', 'physicalName', 'alias', 'type', 'classification', 'level', 'supertype', 'discriminator', 'identifier',
  'purpose', 'volume', 'attributes', 'subtype_sets', 'key_attributes', 'business_rules', 'realizes',
];
const REL_ORDER = [
  'id', 'name', 'parent', 'child', 'parent_to_child', 'child_to_parent', 'cardinality', 'parent_participation',
  'child_participation', 'identifying', 'fk_attributes', 'recursive', 'barker_sentence', 'ri_rule',
];

const serializeAttribute = (a: Attribute) => {
  const o = dropFalse(ordered(a, ATTR_ORDER), ['required', 'identifier', 'fk']);
  if (a.keyType === 'NORMAL') delete o.keyType;
  return o;
};
const serializeEntity = (e: Entity) => ({
  ...ordered(e, ENTITY_ORDER),
  ...(e.attributes?.length ? { attributes: e.attributes.map(serializeAttribute) } : {}),
});
const serializeRelationship = (r: Relationship) => dropFalse(ordered(r, REL_ORDER), ['identifying', 'recursive']);

function serializeDiagram(d: DiagramView) {
  const positions: Record<string, unknown> = {};
  Object.keys(d.positions || {})
    .sort()
    .forEach((k) => {
      const p = d.positions[k];
      positions[k] = ordered({ x: Math.round(p.x), y: Math.round(p.y), width: p.width, height: p.height }, ['x', 'y', 'width', 'height']);
    });
  return {
    ...dropFalse(ordered({ id: d.id, name: d.name, level: d.level, description: d.description, includeAll: d.includeAll }, ['id', 'name', 'level', 'description', 'includeAll']), ['includeAll']),
    ...(d.includeAll ? {} : { members: d.members }),
    positions,
  };
}

/** Project → { relative path: file content }. Pure; the caller writes it to disk. */
export function serializeProject(project: ModelProject): Record<string, string> {
  const files: Record<string, string> = {};
  const c = project.config;
  files[PROJECT_MARKER_FILE] = dump(
    ordered({ ...c, formatVersion: PROJECT_FORMAT_VERSION }, ['formatVersion', 'name', 'description', 'version', 'targetDbms', 'namingCase', 'subtypeStrategy'])
  );

  project.entities.forEach((e) => {
    files[`model/entities/${e.id}.yaml`] = dump(serializeEntity(e));
  });
  files['model/relationships.yaml'] = dump({ relationships: project.relationships.map(serializeRelationship) });
  if (project.subtypeSets.length) {
    files['model/subtype-sets.yaml'] = dump({
      subtype_sets: project.subtypeSets.map((s) => ordered(s, ['id', 'name', 'supertype', 'discriminator', 'disjoint', 'total', 'subtypes', 'description'])),
    });
  }
  if (project.rules.length) files['model/rules.yaml'] = dump({ rules: project.rules });

  files['conceptual/entities.yaml'] = dump({ entities: project.conceptual.entities.map(serializeEntity) });
  files['conceptual/relationships.yaml'] = dump({ relationships: project.conceptual.relationships.map(serializeRelationship) });

  project.diagrams.forEach((d) => {
    files[`diagrams/${d.id}.yaml`] = dump(serializeDiagram(d));
  });

  files['standards/dictionary.yaml'] = project.standards.dictionary;
  files['standards/domains.yaml'] = project.standards.domains;
  files['physical/overrides.yaml'] = project.physical.overrides;
  Object.entries(project.outputs).forEach(([path, content]) => {
    files[path.startsWith('output/') ? path : `output/${path}`] = content;
  });
  return files;
}

const safeParse = (text: string | undefined): any => {
  if (!text) return undefined;
  try {
    return yamlParse(text);
  } catch {
    return undefined;
  }
};

function normalizeAttribute(a: any, entityId: string, index: number): Attribute {
  return {
    ...a,
    id: a.id || `${entityId}_attr_${index + 1}`,
    name: String(a.name ?? ''),
    required: !!a.required || !!a.identifier || a.keyType === 'PK',
    identifier: !!a.identifier || a.keyType === 'PK',
    keyType: a.keyType || (a.identifier ? 'PK' : a.fk ? 'FK' : 'NORMAL'),
    fk: !!a.fk || a.keyType === 'FK',
  };
}

export function normalizeEntity<T extends Entity>(raw: any): T & { id: string } {
  const id = String(raw.id);
  return {
    ...raw,
    id,
    name: String(raw.name ?? id),
    type: raw.type || 'entity',
    identifier: raw.identifier ?? [],
    attributes: Array.isArray(raw.attributes) ? raw.attributes.map((a: any, i: number) => normalizeAttribute(a, id, i)) : [],
  };
}

function normalizeRelationship(r: any, i: number): Relationship {
  return {
    ...r,
    id: String(r.id || `rel_${i + 1}`),
    cardinality: r.cardinality || 'one_to_many',
    parent_participation: r.parent_participation || '0..M',
    child_participation: r.child_participation || '1..1',
    identifying: !!r.identifying,
  };
}

export interface DeserializeResult {
  project: ModelProject;
  warnings: string[];
}

/** { relative path: content } → Project. Tolerant: unreadable files are reported, never fatal. */
export function deserializeProject(files: Record<string, string>): DeserializeResult {
  const warnings: string[] = [];
  const cfgRaw = safeParse(files[PROJECT_MARKER_FILE]) || {};
  if (!files[PROJECT_MARKER_FILE]) warnings.push(`${PROJECT_MARKER_FILE} 이(가) 없어 기본 설정을 사용합니다.`);
  const base = createEmptyProject({ name: cfgRaw.name || '이름 없는 프로젝트' });
  const config: ProjectConfig = { ...base.config, ...cfgRaw, formatVersion: PROJECT_FORMAT_VERSION };

  const entities: (Entity & { id: string })[] = [];
  Object.keys(files)
    .filter((p) => p.startsWith('model/entities/') && /\.ya?ml$/.test(p))
    .forEach((p) => {
      const raw = safeParse(files[p]);
      if (!raw || typeof raw !== 'object') return warnings.push(`${p}: YAML을 읽을 수 없습니다.`);
      if (!raw.id) raw.id = p.replace(/^model\/entities\//, '').replace(/\.ya?ml$/, '');
      entities.push(normalizeEntity(raw));
    });
  entities.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  const relsRaw = safeParse(files['model/relationships.yaml']);
  const relationships = (relsRaw?.relationships || []).map(normalizeRelationship);
  const setsRaw = safeParse(files['model/subtype-sets.yaml']);
  const subtypeSets: SubtypeSet[] = (setsRaw?.subtype_sets || []).map((s: any) => ({
    ...s,
    subtypes: s.subtypes || [],
    total: s.total ?? true,
    disjoint: s.disjoint ?? true,
  }));
  const rules: string[] = safeParse(files['model/rules.yaml'])?.rules || [];

  const cEntRaw = safeParse(files['conceptual/entities.yaml'])?.entities || [];
  const conceptualEntities: ConceptualEntity[] = cEntRaw.filter((e: any) => e && e.id).map((e: any) => normalizeEntity<ConceptualEntity>(e));
  const conceptualRelationships = (safeParse(files['conceptual/relationships.yaml'])?.relationships || []).map(normalizeRelationship);

  const diagrams: DiagramView[] = [];
  Object.keys(files)
    .filter((p) => p.startsWith('diagrams/') && /\.ya?ml$/.test(p))
    .forEach((p) => {
      const raw = safeParse(files[p]);
      if (!raw || typeof raw !== 'object') return warnings.push(`${p}: YAML을 읽을 수 없습니다.`);
      diagrams.push({
        id: String(raw.id || p.replace(/^diagrams\//, '').replace(/\.ya?ml$/, '')),
        name: String(raw.name || raw.id || p),
        level: raw.level === 'conceptual' ? 'conceptual' : 'logical',
        description: raw.description,
        includeAll: !!raw.includeAll,
        members: Array.isArray(raw.members) ? raw.members.map(String) : [],
        positions: raw.positions && typeof raw.positions === 'object' ? raw.positions : {},
      });
    });
  // Every project always has the two "전체" views.
  [ALL_CONCEPTUAL_DIAGRAM_ID, ALL_LOGICAL_DIAGRAM_ID].forEach((id) => {
    if (!diagrams.some((d) => d.id === id)) diagrams.push(base.diagrams.find((d) => d.id === id)!);
  });
  diagrams.sort((a, b) => Number(!!b.includeAll) - Number(!!a.includeAll) || a.name.localeCompare(b.name, 'ko'));

  const outputs: Record<string, string> = {};
  Object.keys(files)
    .filter((p) => p.startsWith('output/'))
    .forEach((p) => (outputs[p] = files[p]));

  return {
    project: {
      config,
      entities,
      relationships,
      subtypeSets,
      rules,
      conceptual: { entities: conceptualEntities, relationships: conceptualRelationships },
      diagrams,
      standards: {
        dictionary: files['standards/dictionary.yaml'] ?? base.standards.dictionary,
        domains: files['standards/domains.yaml'] ?? base.standards.domains,
      },
      physical: { overrides: files['physical/overrides.yaml'] ?? base.physical.overrides },
      outputs,
    },
    warnings,
  };
}

/** What has to be written / deleted to turn the folder state `previous` into `next`. */
export function diffProjectFiles(previous: Record<string, string>, next: Record<string, string>) {
  const writes: Record<string, string> = {};
  const deletes: string[] = [];
  Object.entries(next).forEach(([p, c]) => {
    if (previous[p] !== c) writes[p] = c;
  });
  Object.keys(previous).forEach((p) => {
    if (!(p in next) && isManagedPath(p)) deletes.push(p);
  });
  return { writes, deletes };
}
