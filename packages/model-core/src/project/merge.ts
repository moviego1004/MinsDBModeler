import { parse as yamlParse } from 'yaml';
import type { Attribute, Entity, LogicalModel, Relationship } from '../types.js';
import { parseModel } from '../parser.js';
import {
  ALL_CONCEPTUAL_DIAGRAM_ID,
  createEmptyProject,
  stableHash,
  type ConceptualEntity,
  type DbmsType,
  type DiagramView,
  type ModelLevel,
  type ModelProject,
  type ShapePosition,
} from './types.js';

export interface MergeReport {
  addedEntities: number;
  mergedEntities: number;
  addedRelationships: number;
  skippedRelationships: string[];
}

export interface MergeOptions {
  /** Create a diagram for the merged objects (subject area). */
  diagramName?: string;
  /** Positions keyed by entity name for the new diagram. */
  positions?: Record<string, ShapePosition>;
}

const emptyReport = (): MergeReport => ({ addedEntities: 0, mergedEntities: 0, addedRelationships: 0, skippedRelationships: [] });

function uniqueId(base: string, taken: Set<string>): string {
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}_${n++}`;
  taken.add(id);
  return id;
}

/** Union of attributes by name; existing order first. */
function mergeAttributes(a: Attribute[], b: Attribute[]): Attribute[] {
  const names = new Set(a.map((x) => x.name));
  return [...a, ...b.filter((x) => !names.has(x.name))];
}

/** Fill fields missing on `base` from `extra`. */
function fillMissing<T extends object>(base: T, extra: T): T {
  const out: any = { ...base };
  Object.entries(extra).forEach(([k, v]) => {
    const cur = out[k];
    const missing = cur === undefined || cur === null || cur === '' || (Array.isArray(cur) && cur.length === 0);
    if (missing && v !== undefined) out[k] = v;
  });
  return out;
}

/**
 * Merges a name-based model (YAML file, DA# import, DDL reverse, legacy file …) into the
 * repository of the given level. Entities are matched by name: existing ones are enriched
 * (missing attributes/fields filled in), new ones get a stable ID. Duplicate relationships
 * are skipped. Optionally creates a diagram containing everything the source model showed.
 */
export function mergeModelInto(
  project: ModelProject,
  model: LogicalModel,
  level: ModelLevel,
  options: MergeOptions = {}
): { project: ModelProject; diagramId?: string; report: MergeReport } {
  const report = emptyReport();
  const isC = level === 'conceptual';
  const entities: (Entity & { id: string })[] = (isC ? project.conceptual.entities : project.entities).map((e) => ({ ...e }));
  const relationships: Relationship[] = [...(isC ? project.conceptual.relationships : project.relationships)];

  const takenIds = new Set([...project.entities.map((e) => e.id), ...project.conceptual.entities.map((e) => e.id)]);
  const byName = new Map(entities.map((e) => [e.name, e]));
  const prefix = isC ? 'cent' : 'ent';

  // 1. entities
  const sourceNames = new Set<string>();
  model.entities.forEach((src) => {
    if (!src?.name) return;
    sourceNames.add(src.name);
    const cur = byName.get(src.name);
    if (cur) {
      const richer = (src.attributes?.length || 0) > (cur.attributes?.length || 0);
      const merged = richer ? fillMissing({ ...src, id: cur.id }, cur) : fillMissing(cur, { ...src, id: cur.id });
      merged.attributes = richer ? mergeAttributes(src.attributes || [], cur.attributes || []) : mergeAttributes(cur.attributes || [], src.attributes || []);
      Object.assign(cur, merged);
      report.mergedEntities++;
    } else {
      const id = uniqueId(`${prefix}_${stableHash(src.name)}`, takenIds);
      const fresh = { ...src, id } as Entity & { id: string };
      entities.push(fresh);
      byName.set(src.name, fresh);
      report.addedEntities++;
    }
  });

  // 2. name references → ids (supertype / embedded subtype sets) for entities touched by this merge
  const idOf = (name?: string) => (name ? byName.get(name)?.id : undefined);
  entities.forEach((e) => {
    if (!sourceNames.has(e.name)) return;
    // parser-generated attribute ids are URL-encoded names; replace them with short stable ids
    e.attributes = (e.attributes || []).map((a) =>
      !a.id || a.id.includes('_attr_') || a.id.includes('%') ? { ...a, id: `att_${stableHash(`${e.id}:${a.name}`)}` } : a
    );
    const sup = e.supertype && !takenIdsHas(entities, e.supertype) ? idOf(e.supertype) : e.supertype;
    e.supertype = sup;
    if (!e.supertype) delete e.supertype;
    e.subtype_sets = e.subtype_sets?.map((s) => ({
      ...s,
      subtypes: s.subtypes.map((n) => (takenIdsHas(entities, n) ? n : idOf(n))).filter((x): x is string => !!x),
    }));
  });

  // 3. relationships (dedupe by endpoints + fk + name)
  const keyOf = (r: Relationship) => `${r.parent}|${r.child}|${(r.fk_attributes || []).join(',')}|${r.name || ''}`;
  const keys = new Set(relationships.map(keyOf));
  const relIds = new Set(relationships.map((r) => r.id));
  model.relationships.forEach((src) => {
    const parent = idOf(src.parent);
    const child = idOf(src.child);
    if (!parent || !child) {
      report.skippedRelationships.push(`${src.id}: ${src.parent} → ${src.child} (엔터티 없음)`);
      return;
    }
    const { parentEntityId: _p, childEntityId: _c, ...rest } = src;
    const rel = { ...rest, parent, child } as Relationship;
    if (keys.has(keyOf(rel))) return;
    keys.add(keyOf(rel));
    rel.id = relIds.has(rel.id) ? uniqueId(`${rel.id}_${stableHash(keyOf(rel))}`, relIds) : (relIds.add(rel.id), rel.id);
    relationships.push(rel);
    report.addedRelationships++;
  });

  let next: ModelProject = { ...project };
  if (isC) {
    // trace: conceptual entity realizes the logical entity of the same name
    const logicalByName = new Map(project.entities.map((e) => [e.name, e.id]));
    next.conceptual = {
      entities: (entities as ConceptualEntity[]).map((c) => {
        const match = logicalByName.get(c.name);
        const realizes = c.realizes?.length ? c.realizes : match ? [match] : undefined;
        return { ...c, realizes };
      }),
      relationships,
    };
  } else {
    next.entities = entities;
    next.relationships = relationships;
    // model-level subtype sets
    const sets = [...project.subtypeSets];
    (model.subtype_sets || []).forEach((s) => {
      const sup = idOf(s.supertype);
      if (!sup) return;
      const subs = s.subtypes.map((n) => idOf(n)).filter((x): x is string => !!x);
      const existing = sets.find((x) => x.supertype === sup && (x.name || '') === (s.name || ''));
      if (existing) existing.subtypes = [...new Set([...existing.subtypes, ...subs])];
      else sets.push({ ...s, supertype: sup, subtypes: subs });
    });
    next.subtypeSets = sets;
    (model.rules || []).forEach((r) => {
      if (!next.rules.includes(r)) next.rules = [...next.rules, r];
    });
    // conceptual entities with the same name now have something to realize
    const logicalByName = new Map(entities.map((e) => [e.name, e.id]));
    next.conceptual = {
      ...project.conceptual,
      entities: project.conceptual.entities.map((c) =>
        c.realizes?.length || !logicalByName.has(c.name) ? c : { ...c, realizes: [logicalByName.get(c.name)!] }
      ),
    };
  }

  let diagramId: string | undefined;
  if (options.diagramName) {
    const members = [...sourceNames].map((n) => idOf(n)).filter((x): x is string => !!x);
    // also show entities referenced by the source's relationships (as the source file did)
    model.relationships.forEach((r) => [r.parent, r.child].forEach((n) => {
      const id = idOf(n);
      if (id && !members.includes(id)) members.push(id);
    }));
    const positions: Record<string, ShapePosition> = {};
    Object.entries(options.positions || {}).forEach(([name, p]) => {
      const id = idOf(name);
      if (id) positions[id] = p;
    });
    const taken = new Set(next.diagrams.map((d) => d.id));
    diagramId = uniqueId(`dgm_${stableHash(`${level}:${options.diagramName}`)}`, taken);
    const diagram: DiagramView = { id: diagramId, name: options.diagramName, level, members, positions };
    next.diagrams = [...next.diagrams, diagram];
  }
  return { project: next, diagramId, report };
}

function takenIdsHas(entities: { id: string }[], value: string) {
  return entities.some((e) => e.id === value);
}

/* --------------------------- legacy migration ---------------------------- */

export interface LegacyProjectFile {
  name: string;
  content: string;
  layout?: Record<string, any>;
}

export interface LegacyImportReport extends MergeReport {
  diagrams: number;
  conceptualEntities: number;
  outputs: number;
  warnings: string[];
}

const looksConceptual = (file: LegacyProjectFile, raw: any) =>
  file.name.startsWith('conceptual/') || raw?.modeling_level === 'conceptual';

/**
 * Converts a pre-repository project (one YAML file per subject area, entities duplicated
 * across files, kept in localStorage) into a repository project.
 *  - every logical file becomes a diagram; its entities are merged into one definition each
 *  - the conceptual file becomes conceptual entities traced to same-named logical entities
 *  - dictionary/domains/overrides/DDL are carried over
 */
export function importLegacyProject(legacy: { name: string; files: LegacyProjectFile[] }): { project: ModelProject; report: LegacyImportReport } {
  const report: LegacyImportReport = { ...emptyReport(), diagrams: 0, conceptualEntities: 0, outputs: 0, warnings: [] };

  const cfgFile = legacy.files.find((f) => f.name === 'dbproject.yaml');
  const cfg = cfgFile ? (safeYaml(cfgFile.content) || {}) : {};
  const target = String(cfg.target_db || '').toUpperCase();
  const targetDbms: DbmsType = target.includes('POSTGRES') ? 'POSTGRESQL' : target.includes('MYSQL') ? 'MYSQL' : 'ORACLE';
  let project = createEmptyProject({
    name: legacy.name,
    targetDbms,
    subtypeStrategy: ['ROLL_UP', 'ROLL_DOWN', 'IDENTITY'].includes(cfg.subtype_strategy) ? cfg.subtype_strategy : 'ROLL_UP',
  });

  const modelFiles = legacy.files.filter((f) => /\.ya?ml$/.test(f.name) && !f.name.startsWith('standardization/') && f.name !== 'dbproject.yaml');
  // logical first so conceptual entities can trace to them
  const ordered = [...modelFiles].sort((a, b) => Number(looksConceptual(a, safeYaml(a.content))) - Number(looksConceptual(b, safeYaml(b.content))));

  // Pass 1: entities of every file, so relationships/supertypes can reference entities defined in other files.
  ordered.forEach((file) => {
    const raw = safeYaml(file.content);
    if (!raw || !Array.isArray(raw.entities)) return;
    try {
      const model = parseModel(file.content);
      const res = mergeModelInto(project, { ...model, relationships: [], subtype_sets: [] }, looksConceptual(file, raw) ? 'conceptual' : 'logical');
      project = res.project;
      if (looksConceptual(file, raw)) report.conceptualEntities += res.report.addedEntities;
      else {
        report.addedEntities += res.report.addedEntities;
        report.mergedEntities += res.report.mergedEntities;
      }
    } catch {
      /* reported in pass 2 */
    }
  });

  // Pass 2: full content (references, relationships) + one diagram per logical file.
  ordered.forEach((file) => {
    const raw = safeYaml(file.content);
    if (!raw || !Array.isArray(raw.entities)) {
      if (file.name.startsWith('physical/') && file.name !== 'physical/overrides.yaml') {
        project.outputs[`output/legacy/${file.name.split('/').pop()}`] = file.content;
        report.outputs++;
      }
      return;
    }
    let model: LogicalModel;
    try {
      model = parseModel(file.content);
    } catch (e: any) {
      report.warnings.push(`${file.name}: ${e.message}`);
      return;
    }
    const conceptual = looksConceptual(file, raw);
    const positions = file.layout && file.layout.__engine === 'barker-v1' ? stripMarker(file.layout) : undefined;
    const name = model.subject_area || file.name.replace(/^.*\//, '').replace(/\.ya?ml$/, '');
    const res = mergeModelInto(project, model, conceptual ? 'conceptual' : 'logical', {
      diagramName: conceptual ? undefined : name,
      positions,
    });
    project = res.project;
    if (conceptual) {
      if (positions) {
        project.diagrams = project.diagrams.map((d) => (d.id === ALL_CONCEPTUAL_DIAGRAM_ID ? { ...d, positions: namesToIds(project.conceptual.entities, positions) } : d));
      }
    } else {
      report.diagrams++;
    }
    report.addedRelationships += res.report.addedRelationships;
    report.skippedRelationships.push(...res.report.skippedRelationships.map((s) => `${file.name} ${s}`));
  });

  const dict = legacy.files.find((f) => f.name === 'standardization/dictionary.yaml');
  const domains = legacy.files.find((f) => f.name === 'standardization/domains.yaml');
  const overrides = legacy.files.find((f) => f.name === 'physical/overrides.yaml');
  if (dict) project.standards.dictionary = dict.content;
  if (domains) project.standards.domains = domains.content;
  if (overrides) project.physical.overrides = overrides.content;
  legacy.files
    .filter((f) => /\.(sql|ddl)$/i.test(f.name))
    .forEach((f) => {
      project.outputs[`output/legacy/${f.name.split('/').pop()}`] = f.content;
      report.outputs++;
    });

  return { project, report };
}

function safeYaml(text: string): any {
  try {
    return yamlParse(text);
  } catch {
    return undefined;
  }
}

function stripMarker(layout: Record<string, any>): Record<string, ShapePosition> {
  const out: Record<string, ShapePosition> = {};
  Object.entries(layout).forEach(([k, v]) => {
    if (k !== '__engine' && v && Number.isFinite(v.x) && Number.isFinite(v.y)) out[k] = v;
  });
  return out;
}

function namesToIds(entities: { id: string; name: string }[], byName: Record<string, ShapePosition>) {
  const out: Record<string, ShapePosition> = {};
  entities.forEach((e) => {
    if (byName[e.name]) out[e.id] = byName[e.name];
  });
  return out;
}
