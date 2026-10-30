import type { Attribute, Entity } from '../types.js';
import { addToDiagram } from './views.js';
import { ALL_LOGICAL_DIAGRAM_ID, newId, type ConceptualEntity, type ModelProject } from './types.js';

/*
 * Trace links between levels.
 *   conceptual entity ──realizes──▶ logical entity (1:N)
 *   logical entity ──(derived)──▶ physical table ──(generated)──▶ DDL
 * Only the conceptual→logical link is stored; the rest is derived.
 */

export function logicalRealizations(project: ModelProject, conceptualId: string) {
  const c = project.conceptual.entities.find((e) => e.id === conceptualId);
  return (c?.realizes || []).map((id) => project.entities.find((e) => e.id === id)).filter((e): e is Entity & { id: string } => !!e);
}

export function conceptualSources(project: ModelProject, logicalId: string): ConceptualEntity[] {
  return project.conceptual.entities.filter((c) => c.realizes?.includes(logicalId));
}

export function linkRealization(project: ModelProject, conceptualId: string, logicalId: string): ModelProject {
  return {
    ...project,
    conceptual: {
      ...project.conceptual,
      entities: project.conceptual.entities.map((c) =>
        c.id !== conceptualId || c.realizes?.includes(logicalId) ? c : { ...c, realizes: [...(c.realizes || []), logicalId] }
      ),
    },
  };
}

export function unlinkRealization(project: ModelProject, conceptualId: string, logicalId: string): ModelProject {
  return {
    ...project,
    conceptual: {
      ...project.conceptual,
      entities: project.conceptual.entities.map((c) => (c.id !== conceptualId ? c : { ...c, realizes: c.realizes?.filter((id) => id !== logicalId) })),
    },
  };
}

/**
 * 상세화 (refine): turn a conceptual entity into a logical one.
 * Reuses an existing same-named logical entity, otherwise creates one from the key attributes.
 * The new link is recorded and the entity is added to `targetDiagramId` (default: 전체 논리 모델).
 */
export function refineConceptualEntity(
  project: ModelProject,
  conceptualId: string,
  targetDiagramId: string = ALL_LOGICAL_DIAGRAM_ID
): { project: ModelProject; logicalId: string | null } {
  const c = project.conceptual.entities.find((e) => e.id === conceptualId);
  if (!c) return { project, logicalId: null };

  let next = project;
  let logical = project.entities.find((e) => e.name === c.name);
  if (!logical) {
    const keyNames = c.key_attributes?.length ? c.key_attributes : (c.attributes || []).map((a) => a.name);
    const attributes: Attribute[] = keyNames.map((name, i) => ({ name, required: true, identifier: i === 0, keyType: i === 0 ? 'PK' : 'NORMAL' }));
    // a conceptual supertype maps to the logical entity realizing it, when there is one
    const superLogical = c.supertype ? logicalRealizations(project, c.supertype)[0]?.id : undefined;
    logical = {
      id: newId('ent'),
      name: c.name,
      type: superLogical ? 'subtype' : c.type === 'supertype' ? 'supertype' : 'entity',
      supertype: superLogical,
      identifier: attributes.filter((a) => a.identifier).map((a) => a.name),
      purpose: c.purpose,
      attributes,
    };
    next = { ...next, entities: [...next.entities, logical] };
  }
  next = linkRealization(next, conceptualId, logical.id);
  next = addToDiagram(next, targetDiagramId, [logical.id]);
  return { project: next, logicalId: logical.id };
}

/** Adds a brand-new entity (logical or conceptual) and puts it on the given diagram. */
export function createEntity(project: ModelProject, level: 'logical' | 'conceptual', name: string, diagramId?: string): { project: ModelProject; id: string } {
  const id = newId(level === 'conceptual' ? 'cent' : 'ent');
  const entity: Entity & { id: string } =
    level === 'conceptual'
      ? { id, name, type: 'entity', identifier: [], attributes: [], key_attributes: [] }
      : { id, name, type: 'entity', identifier: [`${name}ID`], attributes: [{ name: `${name}ID`, required: true, identifier: true, keyType: 'PK' }] };
  let next: ModelProject =
    level === 'conceptual'
      ? { ...project, conceptual: { ...project.conceptual, entities: [...project.conceptual.entities, entity as ConceptualEntity] } }
      : { ...project, entities: [...project.entities, entity] };
  if (diagramId) next = addToDiagram(next, diagramId, [id]);
  return { project: next, id };
}
