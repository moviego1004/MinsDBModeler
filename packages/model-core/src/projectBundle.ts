import { parse as yamlParse, stringify as yamlStringify } from 'yaml';
import type { LogicalModel, Entity, Relationship, Diagram } from './types.js';
import { parseModel, stringifyModel } from './parser.js';

export interface ProjectBundleFiles {
  'project.yaml': string;
  [filepath: string]: string;
}

/**
 * Splits a unified LogicalModel into a modular, Git-friendly multi-file structure.
 */
export function exportProjectBundle(model: LogicalModel, projectName?: string): Record<string, string> {
  const files: Record<string, string> = {};

  // 1. project.yaml (General project info)
  const projectMeta = {
    project_name: projectName || model.subject_area,
    subject_area: model.subject_area,
    notation: model.notation || 'Barker logical model',
    version: model.version || '1.0.0',
    status: model.status || 'draft',
    source_document: model.source_document,
    standard_document: model.standard_document,
    rules: model.rules?.length ? model.rules : undefined,
    relationship_rules: model.relationship_rules?.length ? model.relationship_rules : undefined,
  };
  files['project.yaml'] = yamlStringify(projectMeta, { indent: 2, lineWidth: 0 });

  // 2. entities/*.yaml (One file per entity for clean Git diffs)
  for (const ent of model.entities) {
    const filename = `entities/${ent.name.replace(/[/\\?%*:|"<>]/g, '_')}.yaml`;
    files[filename] = yamlStringify(ent, { indent: 2, lineWidth: 0 });
  }

  // 3. relationships.yaml
  if (model.relationships?.length) {
    files['relationships.yaml'] = yamlStringify(model.relationships, { indent: 2, lineWidth: 0 });
  }

  // 4. subtype_sets.yaml
  if (model.subtype_sets?.length) {
    files['subtype_sets.yaml'] = yamlStringify(model.subtype_sets, { indent: 2, lineWidth: 0 });
  }

  // 5. diagrams/*.yaml (Visual coordinates separated from business definitions)
  if (model.diagrams?.length) {
    for (let i = 0; i < model.diagrams.length; i++) {
      const diag = model.diagrams[i];
      const diagName = diag.subject_area ? diag.subject_area.replace(/[/\\?%*:|"<>]/g, '_') : `diagram_${i + 1}`;
      files[`diagrams/${diagName}.yaml`] = yamlStringify(diag, { indent: 2, lineWidth: 0 });
    }
  }

  return files;
}

/**
 * Reconstructs a unified LogicalModel from a modular multi-file bundle.
 */
export function importProjectBundle(files: Record<string, string>): LogicalModel {
  // If a single unified model YAML is passed (e.g. legacy model.yaml)
  if (files['model.yaml'] && !files['project.yaml']) {
    return parseModel(files['model.yaml']);
  }

  let projectMeta: any = {};
  if (files['project.yaml']) {
    projectMeta = yamlParse(files['project.yaml']) || {};
  }

  const entities: Entity[] = [];
  const diagrams: Diagram[] = [];
  let relationships: Relationship[] = [];
  let subtype_sets: any[] = [];

  for (const [path, content] of Object.entries(files)) {
    if (!content || typeof content !== 'string') continue;

    if (path.startsWith('entities/') && path.endsWith('.yaml')) {
      try {
        const ent = yamlParse(content);
        if (ent && ent.name) {
          entities.push(ent);
        }
      } catch (e) {
        console.error(`Failed to parse entity file ${path}:`, e);
      }
    } else if (path === 'relationships.yaml') {
      try {
        const parsed = yamlParse(content);
        if (Array.isArray(parsed)) {
          relationships = parsed;
        }
      } catch (e) {
        console.error(`Failed to parse relationships.yaml:`, e);
      }
    } else if (path === 'subtype_sets.yaml') {
      try {
        const parsed = yamlParse(content);
        if (Array.isArray(parsed)) {
          subtype_sets = parsed;
        }
      } catch (e) {
        console.error(`Failed to parse subtype_sets.yaml:`, e);
      }
    } else if (path.startsWith('diagrams/') && path.endsWith('.yaml')) {
      try {
        const diag = yamlParse(content);
        if (diag) {
          diagrams.push(diag);
        }
      } catch (e) {
        console.error(`Failed to parse diagram file ${path}:`, e);
      }
    }
  }

  return {
    subject_area: projectMeta.subject_area || projectMeta.project_name || 'Unnamed Subject Area',
    notation: projectMeta.notation,
    version: projectMeta.version,
    status: projectMeta.status,
    source_document: projectMeta.source_document,
    standard_document: projectMeta.standard_document,
    rules: projectMeta.rules || [],
    relationship_rules: projectMeta.relationship_rules || [],
    entities,
    relationships,
    subtype_sets,
    diagrams,
  };
}
