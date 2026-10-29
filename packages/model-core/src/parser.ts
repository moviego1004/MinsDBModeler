import { parse as yamlParse, stringify as yamlStringify } from 'yaml';
import { LogicalModel, Entity, Attribute, Relationship, SubtypeSet, Participation } from './types.js';

export function parseModel(yamlContent: string): LogicalModel {
  const raw = yamlParse(yamlContent) as any;
  if (!raw) {
    throw new Error('Invalid YAML content');
  }

  const model: LogicalModel = {
    subject_area: raw.subject_area || 'Unnamed Subject Area',
    notation: raw.notation,
    version: raw.version,
    status: raw.status,
    source_document: raw.source_document,
    standard_document: raw.standard_document,
    entities: [],
    subtype_sets: [],
    relationships: [],
    rules: raw.rules || [],
    relationship_rules: raw.relationship_rules || [],
    diagrams: raw.diagrams || [],
  };

  // Parse Entities
  if (Array.isArray(raw.entities)) {
    model.entities = raw.entities.map((ent: any, entIndex: number) => {
      const entityId = ent.id || `ent_${ent.name ? encodeURIComponent(ent.name) : entIndex + 1}`;
      return {
        id: entityId,
        name: ent.name,
        physicalName: ent.physicalName || ent.physical_name || ent.table_name,
        alias: ent.alias,
        type: ent.type || 'entity',
        classification: ent.classification,
        level: ent.level,
        volume: ent.volume,
        supertype: ent.supertype,
        identifier: ent.identifier || [],
        discriminator: ent.discriminator,
        attributes: Array.isArray(ent.attributes)
          ? ent.attributes.map((attr: any, attrIndex: number) => ({
              id: attr.id || `${entityId}_attr_${attr.name ? encodeURIComponent(attr.name) : attrIndex + 1}`,
              name: attr.name,
              physicalName: attr.physicalName || attr.physical_name || attr.column_name,
              alias: attr.alias,
              domain: attr.domain,
              required: attr.required ?? false,
              identifier: attr.identifier ?? false,
              keyType: attr.keyType || (attr.identifier ? 'PK' : attr.fk ? 'FK' : 'NORMAL'),
              fk: attr.fk ?? false,
              description: attr.description,
              defaultValue: attr.defaultValue,
            }))
          : [],
        subtype_sets: ent.subtype_sets,
        key_attributes: ent.key_attributes,
        purpose: ent.purpose,
        business_rules: ent.business_rules,
      };
    });
  }

  // Parse Subtype Sets
  if (Array.isArray(raw.subtype_sets)) {
    model.subtype_sets = raw.subtype_sets.map((set: any) => ({
      id: set.id,
      name: set.name,
      supertype: set.supertype,
      subtypes: set.subtypes || [],
      total: set.total ?? true,
      disjoint: set.disjoint ?? true,
      discriminator: set.discriminator,
      description: set.description,
    }));
  }

  // Parse Relationships
  if (Array.isArray(raw.relationships)) {
    model.relationships = raw.relationships.map((rel: any, index: number) => {
      // Handle alternative format (from/to/optionality)
      if (rel.from && rel.to) {
        const cardinality = rel.cardinality || 'one_to_many';
        const parent = rel.from;
        const child = rel.to;
        
        let parentPart: Participation = '0..M';
        let childPart: Participation = '1..1';

        const optFrom = rel.optionality?.from || 'optional';
        const optTo = rel.optionality?.to || 'mandatory';

        if (cardinality === 'one_to_many') {
          parentPart = optFrom === 'mandatory' ? '1..M' : '0..M';
          childPart = optTo === 'mandatory' ? '1..1' : '0..1';
        } else if (cardinality === 'one_to_one') {
          parentPart = optFrom === 'mandatory' ? '1..1' : '0..1';
          childPart = optTo === 'mandatory' ? '1..1' : '0..1';
        }

        return {
          id: rel.id || `R-GEN-${index + 1}`,
          name: rel.name,
          parent,
          child,
          cardinality,
          parent_participation: parentPart,
          child_participation: childPart,
          identifying: rel.identifying ?? false,
          fk_attributes: rel.fk_attributes,
          description: rel.description,
        };
      }

      // Handle standard format
      return {
        id: rel.id || `R-GEN-${index + 1}`,
        name: rel.name || rel.parent_to_child,
        parent: rel.parent,
        child: rel.child,
        parent_to_child: rel.parent_to_child,
        child_to_parent: rel.child_to_parent,
        cardinality: rel.cardinality || 'one_to_many',
        parent_participation: rel.parent_participation || '0..M',
        child_participation: rel.child_participation || '1..1',
        identifying: rel.identifying ?? false,
        fk_attributes: rel.fk_attributes,
        barker_sentence: rel.barker_sentence,
        recursive: rel.recursive,
      };
    });
  }

  return model;
}

export function stringifyModel(model: LogicalModel): string {
  // Convert standard structure to standard yaml output format
  const exportObject = {
    subject_area: model.subject_area,
    notation: model.notation || 'Barker logical model',
    version: model.version,
    status: model.status,
    source_document: model.source_document,
    standard_document: model.standard_document,
    rules: model.rules?.length ? model.rules : undefined,
    entities: model.entities.map(ent => ({
      id: ent.id || undefined,
      name: ent.name,
      physicalName: ent.physicalName || undefined,
      alias: ent.alias || undefined,
      type: ent.type,
      classification: ent.classification || undefined,
      level: ent.level || undefined,
      volume: ent.volume || undefined,
      supertype: ent.supertype || undefined,
      identifier: ent.identifier,
      discriminator: ent.discriminator || undefined,
      attributes: ent.attributes && ent.attributes.length > 0
        ? ent.attributes.map(attr => ({
            id: attr.id || undefined,
            name: attr.name,
            physicalName: attr.physicalName || undefined,
            alias: attr.alias || undefined,
            domain: attr.domain || undefined,
            required: attr.required,
            identifier: attr.identifier ? true : undefined,
            keyType: attr.keyType !== 'NORMAL' ? attr.keyType : undefined,
            fk: attr.fk ? true : undefined,
            description: attr.description || undefined,
            defaultValue: attr.defaultValue || undefined,
          }))
        : undefined,
      subtype_sets: ent.subtype_sets || undefined,
      key_attributes: ent.key_attributes || undefined,
      purpose: ent.purpose || undefined,
      business_rules: ent.business_rules?.length ? ent.business_rules : undefined,
    })),
    subtype_sets: model.subtype_sets?.length
      ? model.subtype_sets.map(set => ({
          id: set.id || undefined,
          name: set.name || undefined,
          supertype: set.supertype,
          subtypes: set.subtypes,
          total: set.total,
          disjoint: set.disjoint,
          discriminator: set.discriminator || undefined,
          description: set.description || undefined,
        }))
      : undefined,
    relationships: model.relationships.map(rel => ({
      id: rel.id,
      name: rel.name || undefined,
      parent: rel.parent,
      child: rel.child,
      parent_to_child: rel.parent_to_child || undefined,
      child_to_parent: rel.child_to_parent || undefined,
      cardinality: rel.cardinality,
      parent_participation: rel.parent_participation,
      child_participation: rel.child_participation,
      identifying: rel.identifying || undefined,
      fk_attributes: rel.fk_attributes || undefined,
      barker_sentence: rel.barker_sentence || undefined,
      recursive: rel.recursive || undefined,
    })),
    relationship_rules: model.relationship_rules?.length ? model.relationship_rules : undefined,
    diagrams: model.diagrams?.length ? model.diagrams : undefined,
  };

  // Filter undefined properties
  const cleanObject = JSON.parse(JSON.stringify(exportObject));

  return yamlStringify(cleanObject, {
    indent: 2,
    lineWidth: 0,
    aliasDuplicateObjects: false,
  });
}

export function parseDdl(ddlText: string): LogicalModel {
  // 1. Extract COMMENT ON TABLE and COMMENT ON COLUMN before stripping comments
  const tableComments = new Map<string, string>();
  const columnComments = new Map<string, string>();

  const commentRegex = /COMMENT\s+ON\s+(TABLE|COLUMN)\s+([a-zA-Z0-9_\."`\[\]]+)\s+IS\s+'([^']*)'/gi;
  let cMatch: RegExpExecArray | null;
  while ((cMatch = commentRegex.exec(ddlText)) !== null) {
    const type = cMatch[1].toUpperCase();
    const rawTarget = cMatch[2].replace(/["`\[\]]/g, '');
    const comment = cMatch[3].trim();
    if (!comment) continue;

    if (type === 'TABLE') {
      const tbl = rawTarget.split('.').pop() || rawTarget;
      tableComments.set(tbl.toUpperCase(), comment);
    } else if (type === 'COLUMN') {
      const parts = rawTarget.split('.');
      if (parts.length >= 2) {
        const col = parts.pop()!;
        const tbl = parts.pop()!;
        columnComments.set(`${tbl.toUpperCase()}.${col.toUpperCase()}`, comment);
      }
    }
  }

  const cleanDdl = ddlText
    .replace(/--.*$/gm, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

  const statements = cleanDdl.split(';');
  const entities: Entity[] = [];
  const relationships: Relationship[] = [];
  const relationshipRules: string[] = [];
  const tablePhysicalToLogical = new Map<string, string>();

  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (!trimmed) continue;

    // Match CREATE TABLE
    const createTableMatch = trimmed.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_\."`\[\]]+)\s*\(([\s\S]*)\)/i);
    if (!createTableMatch) continue;

    // Clean table name (remove quotes, schema prefix)
    let rawTableName = createTableMatch[1];
    const cleanedTableName = rawTableName.replace(/["`\[\]]/g, '').split('.').pop() || rawTableName;
    const logicalTableName = tableComments.get(cleanedTableName.toUpperCase()) || cleanedTableName;
    tablePhysicalToLogical.set(cleanedTableName.toUpperCase(), logicalTableName);

    const body = createTableMatch[2];

    // Smart split body by comma, ignoring commas inside parentheses
    const elements: string[] = [];
    let current = '';
    let depth = 0;
    for (let char of body) {
      if (char === '(') depth++;
      else if (char === ')') depth--;
      
      if (char === ',' && depth === 0) {
        elements.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) {
      elements.push(current.trim());
    }

    const attributes: Attribute[] = [];
    const pkColumns: string[] = [];
    const tableFks: { cols: string[]; refTable: string; refCols: string[] }[] = [];

    for (const element of elements) {
      const cleanedElement = element.replace(/\s+/g, ' ').trim();
      const upper = cleanedElement.toUpperCase();

      // Check for table level PRIMARY KEY constraint
      if (upper.startsWith('PRIMARY KEY') || (upper.startsWith('CONSTRAINT') && upper.includes('PRIMARY KEY'))) {
        const pkMatch = cleanedElement.match(/PRIMARY\s+KEY\s*\((.*?)\)/i);
        if (pkMatch) {
          const cols = pkMatch[1].split(',').map(c => c.replace(/["`\[\]]/g, '').trim());
          pkColumns.push(...cols);
        }
        continue;
      }

      // Check for table level FOREIGN KEY constraint
      if (upper.startsWith('FOREIGN KEY') || (upper.startsWith('CONSTRAINT') && upper.includes('FOREIGN KEY'))) {
        const fkMatch = cleanedElement.match(/(?:FOREIGN\s+KEY\s*\((.*?)\)\s+)?REFERENCES\s+([a-zA-Z0-9_\."`\[\]]+)\s*\((.*?)\)/i);
        if (fkMatch) {
          let cols: string[] = [];
          if (fkMatch[1]) {
            cols = fkMatch[1].split(',').map(c => c.replace(/["`\[\]]/g, '').trim());
          } else {
            // If it started with CONSTRAINT name FOREIGN KEY (cols)
            const constraintFkMatch = cleanedElement.match(/FOREIGN\s+KEY\s*\((.*?)\)\s+REFERENCES/i);
            if (constraintFkMatch) {
              cols = constraintFkMatch[1].split(',').map(c => c.replace(/["`\[\]]/g, '').trim());
            }
          }
          let refTable = fkMatch[2].replace(/["`\[\]]/g, '').split('.').pop() || fkMatch[2];
          let refCols = fkMatch[3].split(',').map(c => c.replace(/["`\[\]]/g, '').trim());

          if (cols.length > 0) {
            tableFks.push({ cols, refTable, refCols });
          }
        }
        continue;
      }

      // Skip other constraints (like UNIQUE, CHECK)
      if (upper.startsWith('CONSTRAINT') || upper.startsWith('UNIQUE') || upper.startsWith('CHECK')) {
        continue;
      }

      // Parse column definition
      const parts = cleanedElement.split(' ');
      if (parts.length < 2) continue;

      const colName = parts[0].replace(/["`\[\]]/g, '');
      const colType = parts[1];

      const isRequired = upper.includes('NOT NULL');
      const isPk = upper.includes('PRIMARY KEY');
      
      if (isPk) {
        pkColumns.push(colName);
      }

      const logicalColName = columnComments.get(`${cleanedTableName.toUpperCase()}.${colName.toUpperCase()}`) || colName;

      attributes.push({
        id: `att_${logicalTableName}_${logicalColName}`.replace(/\s+/g, '_'),
        name: logicalColName,
        physicalName: colName,
        domain: colType,
        required: isRequired || isPk, // PK is always required
        identifier: isPk,
        keyType: isPk ? 'PK' : 'NORMAL',
        fk: false, // Will resolve below
      });
    }

    // Apply primary key flags
    for (const attr of attributes) {
      if (pkColumns.includes(attr.physicalName || attr.name)) {
        attr.identifier = true;
        attr.required = true;
        attr.keyType = 'PK';
      }
    }

    // Process table level FKs for this entity
    for (const fk of tableFks) {
      // Mark local attributes as FK
      for (const attr of attributes) {
        if (fk.cols.includes(attr.physicalName || attr.name)) {
          attr.fk = true;
          if (attr.keyType !== 'PK') attr.keyType = 'FK';
        }
      }

      // Check if this FK is identifying (all FK columns are part of PK)
      const isIdentifying = fk.cols.every(c => pkColumns.includes(c));

      // Determine participation
      const anyFkNullable = attributes.some(attr => fk.cols.includes(attr.physicalName || attr.name) && !attr.required);
      const childParticipation = anyFkNullable ? '0..1' : '1..1';

      const parentRefLogical = tableComments.get(fk.refTable.toUpperCase()) || fk.refTable;

      relationships.push({
        id: `R-DDL-${relationships.length + 1}`,
        name: `R_${logicalTableName}_${parentRefLogical}`,
        parent: parentRefLogical,
        child: logicalTableName,
        cardinality: 'one_to_many',
        parent_participation: '0..M',
        child_participation: childParticipation,
        identifying: isIdentifying,
        fk_attributes: fk.cols,
      });
    }

    const pkAttrNames = attributes.filter(a => a.identifier).map(a => a.name);

    entities.push({
      id: `ent_${logicalTableName.replace(/\s+/g, '_')}`,
      name: logicalTableName,
      physicalName: cleanedTableName,
      type: 'entity',
      identifier: pkAttrNames.length === 1 ? pkAttrNames[0] : pkAttrNames,
      attributes,
    });
  }

  // Also parse standalone ALTER TABLE ... ADD FOREIGN KEY
  const alterFkRegex = /ALTER\s+TABLE\s+([a-zA-Z0-9_\."`\[\]]+)\s+ADD\s+(?:CONSTRAINT\s+[a-zA-Z0-9_\."`\[\]]+\s+)?FOREIGN\s+KEY\s*\((.*?)\)\s+REFERENCES\s+([a-zA-Z0-9_\."`\[\]]+)\s*\((.*?)\)/gi;
  let aMatch: RegExpExecArray | null;
  while ((aMatch = alterFkRegex.exec(cleanDdl)) !== null) {
    const rawChild = aMatch[1].replace(/["`\[\]]/g, '').split('.').pop() || aMatch[1];
    const rawParent = aMatch[3].replace(/["`\[\]]/g, '').split('.').pop() || aMatch[3];
    const childName = tablePhysicalToLogical.get(rawChild.toUpperCase()) || rawChild;
    const parentName = tablePhysicalToLogical.get(rawParent.toUpperCase()) || rawParent;

    const exists = relationships.some(r => r.parent === parentName && r.child === childName);
    if (!exists) {
      relationships.push({
        id: `R-DDL-${relationships.length + 1}`,
        name: `R_${childName}_${parentName}`,
        parent: parentName,
        child: childName,
        cardinality: 'one_to_many',
        parent_participation: '0..M',
        child_participation: '1..1',
        identifying: false,
      });
    }
  }

  return {
    subject_area: 'Imported from DDL',
    notation: 'Barker logical model',
    entities,
    relationships,
    relationship_rules: relationshipRules,
  };
}
