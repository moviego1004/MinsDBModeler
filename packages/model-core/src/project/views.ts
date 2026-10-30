import type { Entity, LogicalModel, Relationship, SubtypeSetRef } from '../types.js';
import type { ConceptualEntity, DiagramView, ModelLevel, ModelProject, ShapePosition } from './types.js';
import { newId } from './types.js';

/*
 * Views translate between the ID-based repository and the name-based LogicalModel
 * that the canvas, editors, linter, exporters etc. already understand.
 *
 *   repository ──deriveView()──▶ LogicalModel (names)  ──edit──▶ LogicalModel'
 *   repository ◀──applyViewEdits(before, after)──────────────────────┘
 *
 * Entity identity survives renames because every derived entity carries its `id`.
 */

type AnyEntity = Entity & { id: string };

interface LevelData {
  entities: AnyEntity[];
  relationships: Relationship[];
}

function levelData(project: ModelProject, level: ModelLevel): LevelData {
  return level === 'conceptual'
    ? { entities: project.conceptual.entities, relationships: project.conceptual.relationships }
    : { entities: project.entities, relationships: project.relationships };
}

/** Members of a diagram, plus every (transitive) subtype of a member — subtypes live inside their supertype. */
export function diagramMemberIds(project: ModelProject, diagram: DiagramView): Set<string> {
  const { entities } = levelData(project, diagram.level);
  if (diagram.includeAll) return new Set(entities.map((e) => e.id));
  const ids = new Set(diagram.members.filter((id) => entities.some((e) => e.id === id)));
  const subsOf = (id: string) => {
    const out = new Set<string>();
    entities.forEach((e) => {
      if (e.supertype === id) out.add(e.id);
    });
    entities.find((e) => e.id === id)?.subtype_sets?.forEach((s) => s.subtypes.forEach((x) => out.add(x)));
    if (diagram.level === 'logical') project.subtypeSets.filter((s) => s.supertype === id).forEach((s) => s.subtypes.forEach((x) => out.add(x)));
    return out;
  };
  const queue = [...ids];
  while (queue.length) {
    const id = queue.shift()!;
    subsOf(id).forEach((sub) => {
      if (!ids.has(sub) && entities.some((e) => e.id === sub)) {
        ids.add(sub);
        queue.push(sub);
      }
    });
  }
  return ids;
}

const mapSets = (sets: SubtypeSetRef[] | undefined, map: (id: string) => string | undefined) =>
  sets?.map((s) => ({ ...s, subtypes: s.subtypes.map((x) => map(x)).filter((x): x is string => !!x) }));

/** Name-based model for one diagram. Entities keep their `id` so edits can be written back. */
export function deriveView(project: ModelProject, diagram: DiagramView): LogicalModel {
  const { entities, relationships } = levelData(project, diagram.level);
  const ids = diagramMemberIds(project, diagram);
  const nameOf = new Map(entities.map((e) => [e.id, e.name]));
  const inView = (id: string) => ids.has(id);

  const viewEntities = entities
    .filter((e) => inView(e.id))
    .map((e) => {
      const copy: any = {
        ...e,
        supertype: e.supertype ? nameOf.get(e.supertype) : undefined,
        subtype_sets: mapSets(e.subtype_sets, (id) => (inView(id) ? nameOf.get(id) : undefined)),
      };
      if (diagram.level === 'conceptual') {
        // Conceptual entities show their key attributes as rows.
        if (!copy.attributes?.length && Array.isArray(copy.key_attributes)) {
          copy.attributes = copy.key_attributes.map((n: string, i: number) => ({ name: n, required: true, identifier: i === 0 }));
          copy.__derivedAttributes = true;
        }
        delete copy.realizes;
      }
      return copy as Entity;
    });

  const viewRels = relationships
    .filter((r) => inView(r.parent) && inView(r.child))
    .map((r) => ({ ...r, parent: nameOf.get(r.parent)!, child: nameOf.get(r.child)!, parentEntityId: r.parent, childEntityId: r.child }));

  const subtype_sets =
    diagram.level === 'logical'
      ? project.subtypeSets
          .filter((s) => inView(s.supertype))
          .map((s) => ({ ...s, supertype: nameOf.get(s.supertype)!, subtypes: s.subtypes.filter(inView).map((x) => nameOf.get(x)!) }))
      : [];

  return {
    subject_area: diagram.name,
    notation: 'Barker logical model',
    version: project.config.version,
    entities: viewEntities,
    subtype_sets,
    relationships: viewRels,
    rules: diagram.level === 'logical' ? project.rules : [],
  };
}

/** Diagram positions keyed by entity name (what the layout engine consumes). */
export function positionsByName(project: ModelProject, diagram: DiagramView): Record<string, ShapePosition> {
  const { entities } = levelData(project, diagram.level);
  const out: Record<string, ShapePosition> = {};
  entities.forEach((e) => {
    const p = diagram.positions[e.id];
    if (p) out[e.name] = p;
  });
  return out;
}

/** Name-keyed positions → ID-keyed positions for the diagram. */
export function positionsById(project: ModelProject, diagram: DiagramView, byName: Record<string, ShapePosition>): Record<string, ShapePosition> {
  const { entities } = levelData(project, diagram.level);
  const idOf = new Map(entities.map((e) => [e.name, e.id]));
  const out: Record<string, ShapePosition> = {};
  Object.entries(byName).forEach(([name, p]) => {
    const id = idOf.get(name);
    if (id && p && Number.isFinite(p.x) && Number.isFinite(p.y)) out[id] = p;
  });
  return out;
}

/**
 * Writes the difference between two derived views back into the repository.
 *  - entities/relationships present in `after` are upserted (by id; new ones get an id)
 *  - entities/relationships that disappeared from the view are deleted from the model
 *    (use removeFromDiagram() to only hide something from one diagram)
 *  - new entities become members of the diagram
 *  - objects outside the view are untouched
 */
export function applyViewEdits(project: ModelProject, diagram: DiagramView, before: LogicalModel, after: LogicalModel): ModelProject {
  const level = diagram.level;
  const data = levelData(project, level);

  // Resolve names to ids: entities in `after`, then `before`, then anywhere in the level.
  const existingIds = new Set(data.entities.map((e) => e.id));
  const afterEntities: AnyEntity[] = after.entities.map((e) => {
    // keep a known id; otherwise match an existing entity by name (e.g. id lines removed in YAML);
    // otherwise accept the parser's id or mint a new one
    const byName = data.entities.find((x) => x.name === e.name)?.id;
    const id = e.id && existingIds.has(e.id) ? e.id : byName || e.id || newId(level === 'conceptual' ? 'cent' : 'ent');
    return { ...e, id } as AnyEntity;
  });
  const nameToId = new Map<string, string>();
  data.entities.forEach((e) => nameToId.set(e.name, e.id));
  before.entities.forEach((e) => e.id && nameToId.set(e.name, e.id));
  afterEntities.forEach((e) => nameToId.set(e.name, e.id));
  const idOf = (name: string | undefined) => (name ? nameToId.get(name) : undefined);

  const existing = new Map(data.entities.map((e) => [e.id, e]));
  const upserted = afterEntities.map((e) => {
    const prev = existing.get(e.id) as ConceptualEntity | undefined;
    const out: any = {
      ...e,
      supertype: idOf(e.supertype),
      subtype_sets: mapSets(e.subtype_sets, (n) => idOf(n)),
    };
    if (level === 'conceptual') {
      if (out.__derivedAttributes || (prev && !prev.attributes?.length && prev.key_attributes)) {
        // rows were synthesised from key_attributes — write them back there
        out.key_attributes = (e.attributes || []).map((a) => a.name);
        out.attributes = [];
      }
      out.realizes = prev?.realizes;
    }
    delete out.__derivedAttributes;
    if (!out.supertype) delete out.supertype;
    return out as AnyEntity;
  });

  const beforeIds = new Set(before.entities.map((e) => e.id).filter(Boolean) as string[]);
  const afterIds = new Set(upserted.map((e) => e.id));
  const removed = new Set([...beforeIds].filter((id) => !afterIds.has(id)));

  const upsertMap = new Map(upserted.map((e) => [e.id, e]));
  const entities = [
    ...data.entities.filter((e) => !removed.has(e.id)).map((e) => upsertMap.get(e.id) || e),
    ...upserted.filter((e) => !existing.has(e.id)),
  ];

  // Relationships
  const beforeRelIds = new Set(before.relationships.map((r) => r.id));
  const afterRels = after.relationships
    .map((r) => {
      const parent = idOf(r.parent);
      const child = idOf(r.child);
      if (!parent || !child) return null;
      const { parentEntityId: _p, childEntityId: _c, ...rest } = r;
      return { ...rest, parent, child } as Relationship;
    })
    .filter((r): r is Relationship => !!r);
  const afterRelIds = new Set(afterRels.map((r) => r.id));
  const relMap = new Map(afterRels.map((r) => [r.id, r]));
  const relationships = [
    ...data.relationships
      .filter((r) => !(beforeRelIds.has(r.id) && !afterRelIds.has(r.id)))
      .filter((r) => !removed.has(r.parent) && !removed.has(r.child))
      .map((r) => relMap.get(r.id) || r),
    ...afterRels.filter((r) => !data.relationships.some((x) => x.id === r.id)),
  ];

  // Diagram membership: new entities join this diagram; deleted ones leave every diagram.
  const added = upserted.filter((e) => !existing.has(e.id)).map((e) => e.id);
  const diagrams = project.diagrams.map((d) => {
    let members = d.members.filter((id) => !removed.has(id));
    if (d.id === diagram.id && !d.includeAll) members = [...members, ...added.filter((id) => !members.includes(id))];
    const positions = { ...d.positions };
    removed.forEach((id) => delete positions[id]);
    return { ...d, members, positions };
  });

  let next: ModelProject = { ...project, diagrams };
  if (level === 'conceptual') {
    next.conceptual = { entities: entities as ConceptualEntity[], relationships };
    // a deleted logical/conceptual entity must not stay referenced by trace links
  } else {
    next.entities = entities;
    next.relationships = relationships;
    next.rules = after.rules || project.rules;
    next.subtypeSets = mergeSubtypeSets(project, after, idOf, removed);
    if (removed.size) {
      next.conceptual = {
        ...project.conceptual,
        entities: project.conceptual.entities.map((c) => ({ ...c, realizes: c.realizes?.filter((id) => !removed.has(id)) })),
      };
    }
  }
  return next;
}

function mergeSubtypeSets(project: ModelProject, after: LogicalModel, idOf: (n?: string) => string | undefined, removed: Set<string>) {
  const fromView = (after.subtype_sets || [])
    .map((s) => ({ ...s, supertype: idOf(s.supertype) || '', subtypes: s.subtypes.map((n) => idOf(n)).filter((x): x is string => !!x) }))
    .filter((s) => s.supertype);
  const touched = new Set(fromView.map((s) => s.supertype));
  return [
    ...project.subtypeSets
      .filter((s) => !touched.has(s.supertype) && !removed.has(s.supertype))
      .map((s) => ({ ...s, subtypes: s.subtypes.filter((x) => !removed.has(x)) })),
    ...fromView,
  ];
}

/* ------------------------------ diagram ops ------------------------------ */

export function addToDiagram(project: ModelProject, diagramId: string, ids: string[]): ModelProject {
  return {
    ...project,
    diagrams: project.diagrams.map((d) =>
      d.id !== diagramId || d.includeAll ? d : { ...d, members: [...d.members, ...ids.filter((id) => !d.members.includes(id))] }
    ),
  };
}

export function removeFromDiagram(project: ModelProject, diagramId: string, ids: string[]): ModelProject {
  const drop = new Set(ids);
  return {
    ...project,
    diagrams: project.diagrams.map((d) => {
      if (d.id !== diagramId || d.includeAll) return d;
      const positions = { ...d.positions };
      ids.forEach((id) => delete positions[id]);
      return { ...d, members: d.members.filter((id) => !drop.has(id)), positions };
    }),
  };
}

export function diagramsContaining(project: ModelProject, level: ModelLevel, id: string): DiagramView[] {
  return project.diagrams.filter((d) => d.level === level && diagramMemberIds(project, d).has(id));
}

export function setDiagramPositions(project: ModelProject, diagramId: string, positions: Record<string, ShapePosition>): ModelProject {
  return { ...project, diagrams: project.diagrams.map((d) => (d.id === diagramId ? { ...d, positions } : d)) };
}
