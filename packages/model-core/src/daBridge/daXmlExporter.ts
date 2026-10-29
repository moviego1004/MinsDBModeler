import type { LogicalModel } from '../types.js';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Exports a LogicalModel into a DA# 5-compatible ERwin XML format.
 * Can be opened directly in DA# 5 via [열기] -> [ERWin 파일 가져오기 (.xml)].
 */
export function exportDaXml(model: LogicalModel): string {
  const lines: string[] = [];
  const subjectArea = model.subject_area || 'DA# Export Model';

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<Model name="${escapeXml(subjectArea)}" version="7.3" target_db="Oracle">`);
  lines.push('  <Properties>');
  lines.push(`    <Property name="Author" value="MinsDBModeler" />`);
  lines.push(`    <Property name="SubjectArea" value="${escapeXml(subjectArea)}" />`);
  lines.push(`    <Property name="Notation" value="${escapeXml(model.notation || 'Barker')}" />`);
  lines.push('  </Properties>');

  // 1. Entities
  lines.push('  <Entities>');
  for (const ent of model.entities) {
    const entId = ent.id || `ent_${ent.name.replace(/\s+/g, '_')}`;
    const pName = ent.physicalName ? ` Physical_Name="${escapeXml(ent.physicalName)}"` : '';
    const classAttr = ent.classification ? ` Classification="${escapeXml(ent.classification)}"` : '';
    const purpose = ent.purpose ? ` Definition="${escapeXml(ent.purpose)}"` : '';

    lines.push(`    <Entity id="${escapeXml(entId)}" name="${escapeXml(ent.name)}"${pName}${classAttr}${purpose}>`);
    lines.push('      <Attributes>');

    for (const attr of ent.attributes) {
      const attrId = attr.id || `att_${ent.name}_${attr.name}`.replace(/\s+/g, '_');
      const attrPName = attr.physicalName ? ` Physical_Name="${escapeXml(attr.physicalName)}"` : '';
      const domainAttr = attr.domain ? ` Datatype="${escapeXml(attr.domain)}"` : ' Datatype="VARCHAR(100)"';
      const pkAttr = attr.identifier || attr.keyType === 'PK' ? ' Primary_Key="true"' : '';
      const nullAttr = attr.required ? ' Null_Option="NOT NULL"' : ' Null_Option="NULL"';
      const fkAttr = attr.fk || attr.keyType === 'FK' ? ' Foreign_Key="true"' : '';

      lines.push(`        <Attribute id="${escapeXml(attrId)}" name="${escapeXml(attr.name)}"${attrPName}${domainAttr}${pkAttr}${nullAttr}${fkAttr} />`);
    }

    lines.push('      </Attributes>');
    lines.push('    </Entity>');
  }
  lines.push('  </Entities>');

  // 2. Relationships
  lines.push('  <Relationships>');
  if (model.relationships?.length) {
    for (const rel of model.relationships) {
      const relId = rel.id || `R_${rel.parent}_${rel.child}`;
      const relName = rel.name || relId;
      const isIdent = rel.identifying ? ' Identifying="true"' : ' Identifying="false"';
      const card = rel.cardinality === 'one_to_one' ? ' Cardinality="1:1"' : ' Cardinality="1:N"';

      lines.push(`    <Relationship id="${escapeXml(relId)}" name="${escapeXml(relName)}" Parent_Entity="${escapeXml(rel.parent)}" Child_Entity="${escapeXml(rel.child)}"${isIdent}${card} />`);
    }
  }
  lines.push('  </Relationships>');

  lines.push('</Model>');
  return lines.join('\n');
}
