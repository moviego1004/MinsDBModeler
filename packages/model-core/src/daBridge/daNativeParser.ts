import type { LogicalModel, Entity, Attribute } from '../types.js';
import { autoDiscoverRelationships } from '../relationshipDiscovery.js';

/**
 * Reads the 'Contents' stream from a Microsoft Compound File (CFBF / OLE2) binary.
 * If buffer is not an OLE file (e.g. .damx raw stream), returns buffer as is.
 * Zero external dependencies: works in Node.js, browser, and Tauri.
 */
export function extractOleContentsOrRaw(buffer: Uint8Array): Uint8Array {
  // CFBF Magic: D0 CF 11 E0 A1 B1 1A E1
  const isOle = buffer.length > 512 &&
    buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0 &&
    buffer[4] === 0xa1 && buffer[5] === 0xb1 && buffer[6] === 0x1a && buffer[7] === 0xe1;

  if (!isOle) {
    return buffer;
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const sectorShift = view.getUint16(30, true);
  const sectorSize = 1 << sectorShift; // Standard: 512
  const dirSector = view.getUint32(48, true);
  const numFatSectors = view.getUint32(44, true);

  // Read DIFAT in header (offset 76..512)
  const fatSectors: number[] = [];
  const maxHeaderFat = Math.min(numFatSectors, 109);
  for (let i = 0; i < maxHeaderFat; i++) {
    fatSectors.push(view.getUint32(76 + i * 4, true));
  }

  // Read FAT table
  const fat: number[] = [];
  for (const fs of fatSectors) {
    const offset = (fs + 1) * sectorSize;
    if (offset + sectorSize > buffer.byteLength) break;
    for (let j = 0; j < sectorSize; j += 4) {
      fat.push(view.getUint32(offset + j, true));
    }
  }

  // Read Directory Sectors
  const dirBytes: number[] = [];
  let currDirS = dirSector;
  let safety = 0;
  while (currDirS !== 0xfffffffe && currDirS < fat.length && safety++ < 1000) {
    const offset = (currDirS + 1) * sectorSize;
    if (offset + sectorSize > buffer.byteLength) break;
    for (let j = 0; j < sectorSize; j++) {
      dirBytes.push(buffer[offset + j]);
    }
    currDirS = fat[currDirS];
  }

  const dirArray = new Uint8Array(dirBytes);
  const dirView = new DataView(dirArray.buffer, dirArray.byteOffset, dirArray.byteLength);
  const decoder = new TextDecoder('utf-16le');

  // Find 'Contents' entry (128 bytes per entry)
  let contentsStart: number | null = null;
  let contentsSize: number = 0;

  for (let i = 0; i + 128 <= dirArray.byteLength; i += 128) {
    const nameLen = dirView.getUint16(i + 64, true);
    if (nameLen > 0 && nameLen <= 64) {
      const name = decoder.decode(dirArray.subarray(i, i + nameLen)).replace(/\0/g, '');
      if (name === 'Contents') {
        contentsStart = dirView.getUint32(i + 116, true);
        contentsSize = Number(dirView.getBigUint64 ? dirView.getBigUint64(i + 120, true) : dirView.getUint32(i + 120, true));
        break;
      }
    }
  }

  if (contentsStart === null || contentsSize <= 0) {
    return buffer;
  }

  // Read stream sectors
  const streamResult = new Uint8Array(contentsSize);
  let bytesWritten = 0;
  let currS = contentsStart;
  safety = 0;

  while (currS !== 0xfffffffe && currS < fat.length && bytesWritten < contentsSize && safety++ < 50000) {
    const offset = (currS + 1) * sectorSize;
    if (offset >= buffer.byteLength) break;
    const toRead = Math.min(sectorSize, contentsSize - bytesWritten);
    streamResult.set(buffer.subarray(offset, offset + toRead), bytesWritten);
    bytesWritten += toRead;
    currS = fat[currS];
  }

  return streamResult;
}

/**
 * Parses native DA# 4 (.dax) and DA# 5 (.damx) binary files into a LogicalModel.
 * Zero external dependencies: works in Node.js, browser, and Tauri.
 */
export function parseDaNativeFile(buffer: Uint8Array, fileName?: string): LogicalModel {
  const data = extractOleContentsOrRaw(buffer);
  const decoder = new TextDecoder('utf-16le');
  const tokens: string[] = [];

  let pos = 0;
  while (pos < data.length - 4) {
    if (data[pos] === 0xff && data[pos + 1] === 0xfe && data[pos + 2] === 0xff) {
      let strLen = data[pos + 3];
      let strStart = pos + 4;
      if (strLen === 0xff) {
        strLen = data[pos + 4] | (data[pos + 5] << 8);
        strStart = pos + 6;
      }
      const byteLen = strLen * 2;
      if (strStart + byteLen <= data.length) {
        try {
          const s = decoder.decode(data.subarray(strStart, strStart + byteLen));
          tokens.push(s);
        } catch {}
        pos = strStart + byteLen;
        continue;
      }
    }
    pos++;
  }

  const guidRegex = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;
  const ignored = new Set([
    '', '맑은 고딕', 'PROPS', 'ALTNAME', 'SYNONYM', 'BUILD_PROPS', 
    'RANKSQUE', 'KEYGRPCNT', 'PrimaryKey', 'DA Modeler 4.0', '새모델', 
    'ORACLE', 'TIBERO', 'MYSQL', 'POSTGRESQL'
  ]);

  // 1. Build GUID -> Name dictionary
  const guidToName = new Map<string, string>();
  for (let i = 0; i < tokens.length - 1; i++) {
    const t1 = tokens[i];
    const t2 = tokens[i + 1];
    if (guidRegex.test(t1) && t2 && !ignored.has(t2) && !guidRegex.test(t2) && !t2.startsWith('K_MDL_')) {
      guidToName.set(t1.toUpperCase(), t2);
    }
  }

  // 2. Extract Entities and Attributes
  const rawEntities: { name: string; attributes: string[] }[] = [];

  if (tokens.includes('KEYGRPCNT')) {
    // DA# 4 format: Block structure (PROPS ... EntityName ... Attributes ... KEYGRPCNT)
    let currentEntity: { name: string; attributes: string[] } | null = null;
    let i = 0;
    while (i < tokens.length) {
      const s = tokens[i];
      if (s === 'PROPS') {
        let j = i + 1;
        while (j < tokens.length && (ignored.has(tokens[j]) || guidRegex.test(tokens[j]))) {
          j++;
        }
        if (j < tokens.length) {
          const entName = tokens[j];
          if (entName && !ignored.has(entName) && !guidRegex.test(entName) && !entName.startsWith('K_')) {
            const existing = rawEntities.find(e => e.name === entName);
            if (existing) {
              currentEntity = existing;
            } else {
              currentEntity = { name: entName, attributes: [] };
              rawEntities.push(currentEntity);
            }
            i = j;
          }
        }
      } else if (currentEntity && !ignored.has(s) && !guidRegex.test(s) && !s.startsWith('K_')) {
        if (s !== currentEntity.name && !currentEntity.attributes.includes(s)) {
          currentEntity.attributes.push(s);
        }
      } else if (s === 'KEYGRPCNT') {
        currentEntity = null;
      }
      i++;
    }
  } else {
    // DA# 5 format: Entity definition followed by attribute GUID references
    const seenEnts = new Set<string>();
    for (let i = 0; i < tokens.length - 1; i++) {
      const s = tokens[i];
      if (s && !ignored.has(s) && !guidRegex.test(s) && !s.startsWith('K_')) {
        const prevIsGuid = i > 0 && guidRegex.test(tokens[i - 1]);
        if (prevIsGuid && !seenEnts.has(s)) {
          const attrs: string[] = [];
          let j = i + 1;
          while (j < Math.min(tokens.length, i + 50)) {
            const cand = tokens[j];
            if (guidRegex.test(cand)) {
              const matchedName = guidToName.get(cand.toUpperCase());
              if (matchedName && matchedName !== s && !attrs.includes(matchedName)) {
                attrs.push(matchedName);
              }
            } else if (cand && !ignored.has(cand) && !cand.startsWith('K_')) {
              break;
            }
            j++;
          }
          if (attrs.length > 0) {
            rawEntities.push({ name: s, attributes: attrs });
            seenEnts.add(s);
          }
        }
      }
    }
  }

  // Filter out invalid entities
  const filtered = rawEntities.filter(e => 
    e.name && 
    !e.name.startsWith('K_') && 
    !ignored.has(e.name) && 
    !guidRegex.test(e.name)
  );

  // Convert to LogicalModel Entity objects
  const entities: Entity[] = filtered.map(raw => {
    const entId = `ent_${raw.name.replace(/\s+/g, '_')}`;
    const attrs: Attribute[] = raw.attributes.map((attrName, idx) => {
      // Guess PK: first attribute or attributes ending in ID/번호/코드
      const isPk = idx === 0 || 
                   attrName.endsWith('ID') || 
                   attrName.endsWith('번호') || 
                   attrName.endsWith('코드') || 
                   attrName.endsWith('일련번호');

      return {
        id: `att_${raw.name}_${attrName}`.replace(/\s+/g, '_'),
        name: attrName,
        required: isPk,
        identifier: isPk,
        keyType: isPk ? 'PK' : 'NORMAL',
        domain: isPk ? 'VARCHAR(20)' : 'VARCHAR(100)',
      };
    });

    const pkAttrNames = attrs.filter(a => a.identifier).map(a => a.name);

    return {
      id: entId,
      name: raw.name,
      type: 'entity',
      identifier: pkAttrNames.length === 1 ? pkAttrNames[0] : pkAttrNames,
      attributes: attrs,
    };
  });

  // Automatically discover 1:N foreign key relationships using PK-matching
  const discoveredRels = autoDiscoverRelationships(entities, []);

  const subjectArea = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'DA# Imported Model';

  return {
    subject_area: subjectArea,
    notation: 'Barker logical model',
    entities,
    relationships: discoveredRels,
  };
}
