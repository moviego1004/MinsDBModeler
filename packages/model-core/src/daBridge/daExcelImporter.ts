import type { LogicalModel, Entity, Attribute, Relationship } from '../types.js';

/**
 * Imports a LogicalModel from a Microsoft Excel XML Spreadsheet (.xml).
 * Compatible with MinsDBModeler Excel output and DA# table/column specification sheets.
 */
export function importExcelXml(xmlText: string): LogicalModel {
  const entityMap = new Map<string, Entity>();
  const relationships: Relationship[] = [];
  let subjectArea = 'Excel Imported Model';

  // Parse Worksheets
  const worksheetRegex = /<Worksheet\s+ss:Name=["']([^"']+)["']>([\s\S]*?)<\/Worksheet>/gi;
  let wsMatch: RegExpExecArray | null;

  while ((wsMatch = worksheetRegex.exec(xmlText)) !== null) {
    const sheetName = wsMatch[1].trim();
    const sheetBody = wsMatch[2];

    const rows = parseSheetRows(sheetBody);
    if (rows.length < 2) continue; // Needs at least header + 1 data row

    const headers = rows[0].map(h => h.trim());

    if (sheetName.includes('테이블') || sheetName.includes('Table') || sheetName.includes('엔터티')) {
      // Parse Table / Entity sheet
      const entNameIdx = findHeaderIndex(headers, ['엔터티명', '테이블명(한글)', '엔터티(한글)', '논리명', 'Entity']);
      const physNameIdx = findHeaderIndex(headers, ['물리 테이블명', '테이블명(영문)', '테이블명', '물리명', 'Table']);
      const classIdx = findHeaderIndex(headers, ['성격 분류', '분류', 'Classification']);
      const purposeIdx = findHeaderIndex(headers, ['설명/정의', '정의', '설명', '비고', 'Description']);

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const entName = entNameIdx !== -1 ? row[entNameIdx]?.trim() : '';
        const physName = physNameIdx !== -1 ? row[physNameIdx]?.trim() : '';
        const name = entName || physName;
        if (!name) continue;

        if (!entityMap.has(name)) {
          const classVal = classIdx !== -1 ? (row[classIdx]?.trim().toUpperCase() as any) : undefined;
          const classification = (classVal === 'KEY' || classVal === 'MAIN' || classVal === 'ACTION') ? classVal : undefined;
          const purpose = purposeIdx !== -1 ? row[purposeIdx]?.trim() : undefined;

          entityMap.set(name, {
            id: `ent_${name.replace(/\s+/g, '_')}`,
            name,
            physicalName: physName || undefined,
            type: 'entity',
            classification,
            purpose: purpose || undefined,
            identifier: [],
            attributes: [],
          });
        }
      }
    } else if (sheetName.includes('컬럼') || sheetName.includes('Column') || sheetName.includes('속성')) {
      // Parse Column / Attribute sheet
      const entNameIdx = findHeaderIndex(headers, ['엔터티명', '테이블명(한글)', '엔터티', '논리테이블명']);
      const physTableIdx = findHeaderIndex(headers, ['물리 테이블명', '테이블명(영문)', '테이블명']);
      const attrNameIdx = findHeaderIndex(headers, ['속성명', '컬럼명(한글)', '속성(한글)', '논리컬럼명', 'Attribute']);
      const colPhysIdx = findHeaderIndex(headers, ['물리 컬럼명', '컬럼명(영문)', '컬럼명', 'Column']);
      const domainIdx = findHeaderIndex(headers, ['데이터 타입 / 도메인', '타입', '데이터타입', '도메인', 'DataType']);
      const pkIdx = findHeaderIndex(headers, ['PK (#)', 'PK', 'Primary Key', '주식별자']);
      const reqIdx = findHeaderIndex(headers, ['필수 (*)', 'NOT NULL', 'Required', '필수여부']);
      const keyTypeIdx = findHeaderIndex(headers, ['키 유형', 'Key Type', '구분']);
      const descIdx = findHeaderIndex(headers, ['설명', '비고', 'Comment']);

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const entName = (entNameIdx !== -1 ? row[entNameIdx]?.trim() : '') ||
                        (physTableIdx !== -1 ? row[physTableIdx]?.trim() : '');
        const attrName = (attrNameIdx !== -1 ? row[attrNameIdx]?.trim() : '') ||
                         (colPhysIdx !== -1 ? row[colPhysIdx]?.trim() : '');
        if (!entName || !attrName) continue;

        let ent = entityMap.get(entName);
        if (!ent) {
          ent = {
            id: `ent_${entName.replace(/\s+/g, '_')}`,
            name: entName,
            physicalName: physTableIdx !== -1 ? row[physTableIdx]?.trim() : undefined,
            type: 'entity',
            identifier: [],
            attributes: [],
          };
          entityMap.set(entName, ent);
        }

        const colPhys = colPhysIdx !== -1 ? row[colPhysIdx]?.trim() : undefined;
        const domain = domainIdx !== -1 ? row[domainIdx]?.trim() : undefined;
        const pkRaw = pkIdx !== -1 ? row[pkIdx]?.trim().toUpperCase() : '';
        const isPk = pkRaw === 'Y' || pkRaw === 'YES' || pkRaw === 'TRUE' || pkRaw === 'O' || pkRaw === '#';

        const reqRaw = reqIdx !== -1 ? row[reqIdx]?.trim().toUpperCase() : '';
        const isReq = isPk || reqRaw === 'Y' || reqRaw === 'YES' || reqRaw === 'TRUE' || reqRaw === 'O' || reqRaw === '*';

        const ktRaw = (keyTypeIdx !== -1 ? row[keyTypeIdx]?.trim().toUpperCase() : '') || (isPk ? 'PK' : 'NORMAL');
        const keyType = (ktRaw === 'PK' || ktRaw === 'AK' || ktRaw === 'FK') ? ktRaw : 'NORMAL';

        const desc = descIdx !== -1 ? row[descIdx]?.trim() : undefined;

        ent.attributes.push({
          id: `att_${entName}_${attrName}`.replace(/\s+/g, '_'),
          name: attrName,
          physicalName: colPhys || undefined,
          domain: domain || undefined,
          required: isReq,
          identifier: isPk,
          keyType,
          fk: keyType === 'FK',
          description: desc || undefined,
        });

        if (isPk) {
          if (Array.isArray(ent.identifier)) {
            if (!ent.identifier.includes(attrName)) ent.identifier.push(attrName);
          } else {
            ent.identifier = [attrName];
          }
        }
      }
    } else if (sheetName.includes('관계') || sheetName.includes('Relationship')) {
      // Parse Relationship sheet
      const parentIdx = findHeaderIndex(headers, ['부모 엔터티 (Parent)', '부모엔터티', '부모', 'Parent']);
      const childIdx = findHeaderIndex(headers, ['자식 엔터티 (Child)', '자식엔터티', '자식', 'Child']);
      const cardIdx = findHeaderIndex(headers, ['관계 카디널리티', '카디널리티', '관계', 'Cardinality']);
      const identIdx = findHeaderIndex(headers, ['식별 관계 여부', '식별여부', '식별', 'Identifying']);
      const nameIdx = findHeaderIndex(headers, ['관계명 (ID)', '관계명', 'ID', 'Name']);

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const parent = parentIdx !== -1 ? row[parentIdx]?.trim() : '';
        const child = childIdx !== -1 ? row[childIdx]?.trim() : '';
        if (!parent || !child) continue;

        const relId = (nameIdx !== -1 ? row[nameIdx]?.trim() : '') || `R_${parent}_${child}`;
        const cardRaw = cardIdx !== -1 ? row[cardIdx]?.trim() : '';
        const isOneToOne = cardRaw.includes('1:1') || cardRaw.includes('일대일');
        const identRaw = identIdx !== -1 ? row[identIdx]?.trim().toUpperCase() : '';
        const isIdent = identRaw === 'Y' || identRaw === 'YES' || identRaw === '식별';

        relationships.push({
          id: relId,
          name: relId,
          parent,
          child,
          cardinality: isOneToOne ? 'one_to_one' : 'one_to_many',
          parent_participation: '0..M',
          child_participation: '1..1',
          identifying: isIdent,
        });
      }
    }
  }

  return {
    subject_area: subjectArea,
    notation: 'Barker logical model',
    entities: Array.from(entityMap.values()),
    relationships,
  };
}

function parseSheetRows(sheetXml: string): string[][] {
  const rows: string[][] = [];
  const rowRegex = /<Row[^>]*>([\s\S]*?)<\/Row>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    const rowBody = rowMatch[1];
    const cells: string[] = [];
    const cellRegex = /<Cell[^>]*>[\s\S]*?<Data[^>]*>([\s\S]*?)<\/Data>[\s\S]*?<\/Cell>/gi;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRegex.exec(rowBody)) !== null) {
      cells.push(cellMatch[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"'));
    }
    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  return rows;
}

function findHeaderIndex(headers: string[], candidates: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase();
    for (const c of candidates) {
      if (h === c.toLowerCase() || h.includes(c.toLowerCase())) {
        return i;
      }
    }
  }
  return -1;
}
