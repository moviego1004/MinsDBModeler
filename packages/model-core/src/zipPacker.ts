/**
 * Zero-dependency PKZip encoder and decoder for in-browser and Node.js
 * modular Git project bundle exports.
 */

function crc32(buf: Uint8Array): number {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ -1) >>> 0;
}

/**
 * Creates a standard uncompressed PKZip archive as a Uint8Array.
 */
export function createZipBundle(files: Record<string, string | Uint8Array>): Uint8Array {
  const encoder = new TextEncoder();
  const fileEntries: {
    nameBytes: Uint8Array;
    dataBytes: Uint8Array;
    crc: number;
    offset: number;
  }[] = [];

  const localParts: Uint8Array[] = [];
  let currentOffset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name.replace(/\\/g, '/'));
    const dataBytes = typeof content === 'string' ? encoder.encode(content) : content;
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    // Local file header (30 bytes)
    const lh = new Uint8Array(30);
    const lhView = new DataView(lh.buffer);
    lhView.setUint32(0, 0x04034b50, true); // signature
    lhView.setUint16(4, 20, true);         // version needed
    lhView.setUint16(6, 0, true);          // flags
    lhView.setUint16(8, 0, true);          // compression 0 = stored
    lhView.setUint16(10, 0, true);         // mod time
    lhView.setUint16(12, 0, true);         // mod date
    lhView.setUint32(14, crc, true);       // crc-32
    lhView.setUint32(18, size, true);      // compressed size
    lhView.setUint32(22, size, true);      // uncompressed size
    lhView.setUint16(26, nameBytes.length, true); // filename length
    lhView.setUint16(28, 0, true);         // extra field length

    fileEntries.push({
      nameBytes,
      dataBytes,
      crc,
      offset: currentOffset,
    });

    localParts.push(lh, nameBytes, dataBytes);
    currentOffset += 30 + nameBytes.length + size;
  }

  // Central directory
  const cdOffset = currentOffset;
  const cdParts: Uint8Array[] = [];
  let cdSize = 0;

  for (const entry of fileEntries) {
    const cd = new Uint8Array(46);
    const cdView = new DataView(cd.buffer);
    cdView.setUint32(0, 0x02014b50, true); // central header signature
    cdView.setUint16(4, 20, true);         // version made by
    cdView.setUint16(6, 20, true);         // version needed
    cdView.setUint16(8, 0, true);          // flags
    cdView.setUint16(10, 0, true);         // compression = 0
    cdView.setUint16(12, 0, true);         // mod time
    cdView.setUint16(14, 0, true);         // mod date
    cdView.setUint32(16, entry.crc, true); // crc-32
    cdView.setUint32(20, entry.dataBytes.length, true); // comp size
    cdView.setUint32(24, entry.dataBytes.length, true); // uncomp size
    cdView.setUint16(28, entry.nameBytes.length, true); // filename len
    cdView.setUint16(30, 0, true);         // extra len
    cdView.setUint16(32, 0, true);         // comment len
    cdView.setUint16(34, 0, true);         // disk number
    cdView.setUint16(36, 0, true);         // internal file attrs
    cdView.setUint32(38, 0, true);         // external file attrs
    cdView.setUint32(42, entry.offset, true); // relative offset of local header

    cdParts.push(cd, entry.nameBytes);
    cdSize += 46 + entry.nameBytes.length;
  }

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true); // EOCD signature
  eocdView.setUint16(4, 0, true);          // disk number
  eocdView.setUint16(6, 0, true);          // start disk
  eocdView.setUint16(8, fileEntries.length, true);  // entries on disk
  eocdView.setUint16(10, fileEntries.length, true); // total entries
  eocdView.setUint32(12, cdSize, true);    // central dir size
  eocdView.setUint32(16, cdOffset, true);  // central dir offset
  eocdView.setUint16(20, 0, true);         // comment len

  // Combine all buffers
  const totalLength = cdOffset + cdSize + 22;
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const p of [...localParts, ...cdParts, eocd]) {
    result.set(p, pos);
    pos += p.length;
  }

  return result;
}

/**
 * Extracts text files from a standard stored (uncompressed) PKZip archive.
 */
export function readZipBundle(buffer: Uint8Array): Record<string, string> {
  const result: Record<string, string> = {};
  const decoder = new TextDecoder('utf-8');
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  let pos = 0;
  while (pos + 30 <= buffer.byteLength) {
    const sig = view.getUint32(pos, true);
    if (sig !== 0x04034b50) break; // Not a local file header

    const compMethod = view.getUint16(pos + 8, true);
    const size = view.getUint32(pos + 18, true);
    const nameLen = view.getUint16(pos + 26, true);
    const extraLen = view.getUint16(pos + 28, true);

    const nameOffset = pos + 30;
    const dataOffset = nameOffset + nameLen + extraLen;

    if (dataOffset + size > buffer.byteLength) break;

    const name = decoder.decode(buffer.subarray(nameOffset, nameOffset + nameLen));
    
    // Only process stored (method 0) files; skip directory markers
    if (!name.endsWith('/') && compMethod === 0) {
      const content = decoder.decode(buffer.subarray(dataOffset, dataOffset + size));
      result[name] = content;
    }

    pos = dataOffset + size;
  }

  return result;
}
