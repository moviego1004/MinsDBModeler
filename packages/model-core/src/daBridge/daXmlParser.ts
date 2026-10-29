import type { LogicalModel, Entity, Attribute, Relationship } from '../types.js';

/**
 * Parses XML text from DA# (ERwin XML, CWM XMI, or generic ERD XML)
 * into a normalized LogicalModel.
 * Zero external dependencies: works in Node.js, browser, and Tauri.
 */
export function parseDaXml(xmlText: string): LogicalModel {
  const entities: Entity[] = [];
  const relationships: Relationship[] = [];

  // 1. Extract Subject Area / Model Name if present
  let subjectArea = 'DA# Imported Model';
  const modelMatch = xmlText.match(/<(?:Model|ERwin|Schema|Project)[^>]*?(?:name|Name|subject_area)=["']([^"']+)["']/i);
  if (modelMatch && modelMatch[1]) {
    subjectArea = modelMatch[1].trim();
  } else {
    const titleTagMatch = xmlText.match(/<(?:Model_Name|Project_Name|Name)>([^<]+)<\//i);
    if (titleTagMatch && titleTagMatch[1]) {
      subjectArea = titleTagMatch[1].trim();
    }
  }

  // 2. Parse Entities (supports <Entity ...>, <Entity_Proxy ...>, <Table ...>)
  const entityRegex = /<(?:Entity|Entity_Proxy|Table)\b([^>]*)>([\s\S]*?)<\/(?:Entity|Entity_Proxy|Table)>/gi;
  let entMatch: RegExpExecArray | null;

  while ((entMatch = entityRegex.exec(xmlText)) !== null) {
    const entAttrsStr = entMatch[1];
    const entBody = entMatch[2];

    const entName = getXmlAttr(entAttrsStr, 'name') || 
                    getXmlAttr(entAttrsStr, 'Name') || 
                    getXmlTagContent(entBody, 'Name') || 
                    getXmlTagContent(entBody, 'name') || 
                    getXmlAttr(entAttrsStr, 'id') ||
                    `Entity_${entities.length + 1}`;

    const physicalName = getXmlAttr(entAttrsStr, 'physicalName') || 
                         getXmlAttr(entAttrsStr, 'Physical_Name') || 
                         getXmlAttr(entAttrsStr, 'table_name') || 
                         getXmlTagContent(entBody, 'Physical_Name') || 
                         getXmlTagContent(entBody, 'physicalName');

    const purpose = getXmlAttr(entAttrsStr, 'purpose') || 
                    getXmlAttr(entAttrsStr, 'definition') || 
                    getXmlTagContent(entBody, 'Definition') || 
                    getXmlTagContent(entBody, 'Comment') ||
                    getXmlTagContent(entBody, 'purpose');

    const classificationStr = (getXmlAttr(entAttrsStr, 'classification') || getXmlTagContent(entBody, 'Classification') || '').toUpperCase();
    const classification = (classificationStr === 'KEY' || classificationStr === 'MAIN' || classificationStr === 'ACTION')
      ? classificationStr
      : undefined;

    // Parse Attributes within this Entity (supports both <Attribute ... /> and <Attribute ...>...</Attribute>)
    const attributes: Attribute[] = [];
    const attrRegex = /<(?:Attribute|Column|Field)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:Attribute|Column|Field)>)/gi;
    let colMatch: RegExpExecArray | null;

    while ((colMatch = attrRegex.exec(entBody)) !== null) {
      const colAttrs = colMatch[1];
      const colBody = colMatch[2] || '';

      const colName = getXmlAttr(colAttrs, 'name') || 
                      getXmlAttr(colAttrs, 'Name') || 
                      getXmlTagContent(colBody, 'Name') || 
                      getXmlTagContent(colBody, 'name') || 
                      `attr_${attributes.length + 1}`;

      const colPhysName = getXmlAttr(colAttrs, 'physicalName') || 
                          getXmlAttr(colAttrs, 'Physical_Name') || 
                          getXmlAttr(colAttrs, 'column_name') || 
                          getXmlTagContent(colBody, 'Physical_Name');

      const domain = getXmlAttr(colAttrs, 'domain') || 
                     getXmlAttr(colAttrs, 'datatype') || 
                     getXmlAttr(colAttrs, 'DataType') || 
                     getXmlTagContent(colBody, 'Datatype') || 
                     getXmlTagContent(colBody, 'DataType') || 
                     getXmlTagContent(colBody, 'Domain');

      const pkAttr = getXmlAttr(colAttrs, 'primaryKey') || getXmlAttr(colAttrs, 'Primary_Key') || getXmlAttr(colAttrs, 'pk');
      const isPk = pkAttr === 'true' || pkAttr === '1' || /<Primary_Key>true<\/Primary_Key>/i.test(colBody);

      const reqAttr = getXmlAttr(colAttrs, 'required') || getXmlAttr(colAttrs, 'Null_Option') || getXmlAttr(colAttrs, 'notNull');
      const isRequired = isPk || reqAttr === 'true' || reqAttr === 'NOT NULL' || reqAttr === '1' || /<Null_Option>NOT NULL<\/Null_Option>/i.test(colBody);

      const fkAttr = getXmlAttr(colAttrs, 'fk') || getXmlAttr(colAttrs, 'foreignKey') || getXmlAttr(colAttrs, 'Foreign_Key');
      const isFk = fkAttr === 'true' || fkAttr === '1' || /<Foreign_Key>true<\/Foreign_Key>/i.test(colBody);

      attributes.push({
        id: `att_${entName}_${colName}`.replace(/\s+/g, '_'),
        name: colName,
        physicalName: colPhysName || undefined,
        domain: domain || undefined,
        required: isRequired,
        identifier: isPk,
        keyType: isPk ? 'PK' : isFk ? 'FK' : 'NORMAL',
        fk: isFk,
      });
    }

    entities.push({
      id: `ent_${entName.replace(/\s+/g, '_')}`,
      name: entName,
      physicalName: physicalName || undefined,
      type: 'entity',
      classification,
      purpose: purpose || undefined,
      identifier: attributes.filter(a => a.identifier).map(a => a.name),
      attributes,
    });
  }

  // 3. Parse Relationships (supports both <Relationship ... /> and <Relationship ...>...</Relationship>)
  const relRegex = /<(?:Relationship|Reference)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:Relationship|Reference)>)/gi;
  let rMatch: RegExpExecArray | null;

  while ((rMatch = relRegex.exec(xmlText)) !== null) {
    const rAttrs = rMatch[1];
    const rBody = rMatch[2] || '';

    const relId = getXmlAttr(rAttrs, 'id') || `R_${relationships.length + 1}`;
    const relName = getXmlAttr(rAttrs, 'name') || getXmlTagContent(rBody, 'Name') || relId;
    const parent = getXmlAttr(rAttrs, 'parent') || 
                   getXmlAttr(rAttrs, 'Parent_Entity') || 
                   getXmlAttr(rAttrs, 'parentEntity') || 
                   getXmlTagContent(rBody, 'Parent_Entity') || 
                   getXmlTagContent(rBody, 'parent');

    const child = getXmlAttr(rAttrs, 'child') || 
                  getXmlAttr(rAttrs, 'Child_Entity') || 
                  getXmlAttr(rAttrs, 'childEntity') || 
                  getXmlTagContent(rBody, 'Child_Entity') || 
                  getXmlTagContent(rBody, 'child');

    const cardAttr = (getXmlAttr(rAttrs, 'cardinality') || getXmlTagContent(rBody, 'Cardinality') || '').toLowerCase();
    const isOneToOne = cardAttr.includes('1:1') || cardAttr.includes('one_to_one');

    const identAttr = getXmlAttr(rAttrs, 'type') || getXmlAttr(rAttrs, 'identifying') || getXmlTagContent(rBody, 'Type');
    const isIdentifying = identAttr === 'Identifying' || identAttr === 'true' || identAttr === '1';

    if (parent && child) {
      relationships.push({
        id: relId,
        name: relName,
        parent,
        child,
        cardinality: isOneToOne ? 'one_to_one' : 'one_to_many',
        parent_participation: '0..M',
        child_participation: '1..1',
        identifying: isIdentifying,
      });
    }
  }

  return {
    subject_area: subjectArea,
    notation: 'Barker logical model',
    entities,
    relationships,
  };
}

/**
 * Extracts attribute value by name from an XML open-tag string.
 */
function getXmlAttr(tagStr: string, attrName: string): string | null {
  const regex = new RegExp(`(?:^|\\s)${attrName}=["']([^"']*)["']`, 'i');
  const m = tagStr.match(regex);
  return m ? m[1].trim() : null;
}

/**
 * Extracts inner text of an XML tag from a body string.
 */
function getXmlTagContent(bodyStr: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}\\b[^>]*>([^<]*)<\\/${tagName}>`, 'i');
  const m = bodyStr.match(regex);
  return m ? m[1].trim() : null;
}
