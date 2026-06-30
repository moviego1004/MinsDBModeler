import { LogicalModel, Entity, Relationship, SubtypeSet, Participation } from './types.js';

export interface ValidationError {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationOptions {
  allowUndefinedEntities?: boolean;
}

export function validateModel(model: LogicalModel, options: ValidationOptions = {}): ValidationError[] {
  const errors: ValidationError[] = [];
  const entityMap = new Map<string, Entity>();
  const allowUndefined = options.allowUndefinedEntities ?? false;

  // 1. Validate Entities Unique Names
  for (let i = 0; i < model.entities.length; i++) {
    const entity = model.entities[i];
    if (entityMap.has(entity.name)) {
      errors.push({
        path: `entities[${i}]`,
        message: `Duplicate entity name: "${entity.name}"`,
        severity: 'error',
      });
    } else {
      entityMap.set(entity.name, entity);
    }
  }

  // 2. Validate Entity Hierarchy
  for (let i = 0; i < model.entities.length; i++) {
    const entity = model.entities[i];
    const path = `entities[${i}] (${entity.name})`;

    if (entity.type === 'subtype') {
      if (!entity.supertype) {
        errors.push({
          path,
          message: `Subtype "${entity.name}" must specify a supertype.`,
          severity: 'error',
        });
      } else {
        const superEntity = entityMap.get(entity.supertype);
        if (!superEntity) {
          errors.push({
            path,
            message: `Supertype "${entity.supertype}" declared for subtype "${entity.name}" does not exist.`,
            severity: allowUndefined ? 'warning' : 'error',
          });
        } else if (superEntity.type !== 'supertype' && superEntity.type !== 'subtype') {
          errors.push({
            path,
            message: `Supertype "${entity.supertype}" must be of type 'supertype' or 'subtype', found '${superEntity.type}'.`,
            severity: 'error',
          });
        }
      }
    }
  }

  // 3. Validate Subtype Sets
  const subtypeSets = model.subtype_sets || [];
  
  // Also collect inline subtype sets from entities
  for (const entity of model.entities) {
    if (entity.subtype_sets) {
      for (const set of entity.subtype_sets) {
        subtypeSets.push({
          supertype: entity.name,
          subtypes: set.subtypes,
          total: set.total,
          disjoint: set.disjoint,
          name: set.name
        });
      }
    }
  }

  for (let i = 0; i < subtypeSets.length; i++) {
    const set = subtypeSets[i];
    const setPath = `subtype_sets[${i}] (${set.name || 'Unnamed'})`;

    const superEntity = entityMap.get(set.supertype);
    if (!superEntity) {
      errors.push({
        path: setPath,
        message: `Subtype set supertype "${set.supertype}" does not exist.`,
        severity: allowUndefined ? 'warning' : 'error',
      });
    }

    for (const subName of set.subtypes) {
      const subEntity = entityMap.get(subName);
      if (!subEntity) {
        errors.push({
          path: setPath,
          message: `Subtype "${subName}" in subtype set does not exist.`,
          severity: allowUndefined ? 'warning' : 'error',
        });
      } else {
        if (subEntity.supertype !== set.supertype) {
          errors.push({
            path: setPath,
            message: `Subtype "${subName}" must declare "${set.supertype}" as its supertype (found: "${subEntity.supertype || 'none'}").`,
            severity: 'error',
          });
        }
      }
    }
  }

  // 4. Validate Relationships
  const validParticipations: Participation[] = ['0..1', '1..1', '0..M', '1..M'];

  for (let i = 0; i < model.relationships.length; i++) {
    const rel = model.relationships[i];
    const relPath = `relationships[${i}] (${rel.id || rel.name || 'Unnamed'})`;

    if (!entityMap.has(rel.parent)) {
      errors.push({
        path: relPath,
        message: `Parent entity "${rel.parent}" in relationship does not exist.`,
        severity: allowUndefined ? 'warning' : 'error',
      });
    }

    if (!entityMap.has(rel.child)) {
      errors.push({
        path: relPath,
        message: `Child entity "${rel.child}" in relationship does not exist.`,
        severity: allowUndefined ? 'warning' : 'error',
      });
    }

    if (!validParticipations.includes(rel.parent_participation)) {
      errors.push({
        path: relPath,
        message: `Invalid parent participation "${rel.parent_participation}". Must be one of: ${validParticipations.join(', ')}`,
        severity: 'error',
      });
    }

    if (!validParticipations.includes(rel.child_participation)) {
      errors.push({
        path: relPath,
        message: `Invalid child participation "${rel.child_participation}". Must be one of: ${validParticipations.join(', ')}`,
        severity: 'error',
      });
    }

    // Barker-specific checks
    if (rel.cardinality === 'one_to_many') {
      if (!rel.parent_participation.endsWith('M')) {
        errors.push({
          path: relPath,
          message: `Parent participation for one_to_many must end with 'M' (e.g. 0..M or 1..M), found "${rel.parent_participation}".`,
          severity: 'error',
        });
      }
      if (!rel.child_participation.endsWith('1')) {
        errors.push({
          path: relPath,
          message: `Child participation for one_to_many must end with '1' (e.g. 0..1 or 1..1), found "${rel.child_participation}".`,
          severity: 'error',
        });
      }
    } else if (rel.cardinality === 'one_to_one') {
      if (!rel.parent_participation.endsWith('1') || !rel.child_participation.endsWith('1')) {
        errors.push({
          path: relPath,
          message: `Both participations for one_to_one must end with '1', found parent: "${rel.parent_participation}", child: "${rel.child_participation}".`,
          severity: 'error',
        });
      }
    }
  }

  return errors;
}
