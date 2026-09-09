/**
 * Minimal read-only ISO-9660 reader.
 *
 * The freeware and CD releases of both games are usually handed around as .iso
 * images, so importing one directly saves the user a mount-and-copy step. Only
 * what is needed to list and extract files is implemented: primary volume
 * descriptor, directory records, plain extents. No Joliet, no Rock Ridge, no
 * multi-extent files — DOS-era discs have 8.3 names and contiguous extents.
 */

const SECTOR = 2048;
const PVD_SECTOR = 16;

export interface IsoEntry {
  /** Path inside the image, '/'-separated, upper case, version suffix stripped. */
  readonly path: string;
  readonly bytes: Uint8Array;
}

interface DirRecord {
  readonly name: string;
  readonly lba: number;
  readonly size: number;
  readonly isDir: boolean;
}

export function looksLikeIso(bytes: Uint8Array): boolean {
  if (bytes.length < (PVD_SECTOR + 1) * SECTOR) return false;
  const at = PVD_SECTOR * SECTOR + 1;
  return (
    String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!, bytes[at + 4]!) ===
    'CD001'
  );
}

export function readIso(bytes: Uint8Array): IsoEntry[] {
  if (!looksLikeIso(bytes)) throw new Error('Not an ISO-9660 image');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // Root directory record sits at offset 156 of the primary volume descriptor.
  const root = readRecord(view, bytes, PVD_SECTOR * SECTOR + 156);
  if (!root) throw new Error('ISO has no root directory');

  const out: IsoEntry[] = [];
  walk(view, bytes, root, '', out, 0);
  return out;
}

function walk(
  view: DataView,
  bytes: Uint8Array,
  dir: DirRecord,
  prefix: string,
  out: IsoEntry[],
  depth: number,
): void {
  if (depth > 8) return; // DOS discs are shallow; this only guards against a malformed image
  for (const record of readDirectory(view, bytes, dir)) {
    if (record.name === '.' || record.name === '..') continue;
    const path = prefix ? `${prefix}/${record.name}` : record.name;
    if (record.isDir) {
      walk(view, bytes, record, path, out, depth + 1);
    } else {
      const start = record.lba * SECTOR;
      out.push({ path, bytes: bytes.subarray(start, start + record.size) });
    }
  }
}

function readDirectory(view: DataView, bytes: Uint8Array, dir: DirRecord): DirRecord[] {
  const records: DirRecord[] = [];
  const start = dir.lba * SECTOR;
  const end = Math.min(start + dir.size, bytes.length);
  let offset = start;
  while (offset < end) {
    const length = bytes[offset] ?? 0;
    if (length === 0) {
      // Records never straddle a sector boundary; a zero length means "skip to the next".
      offset = (Math.floor(offset / SECTOR) + 1) * SECTOR;
      continue;
    }
    const record = readRecord(view, bytes, offset);
    if (record) records.push(record);
    offset += length;
  }
  return records;
}

function readRecord(view: DataView, bytes: Uint8Array, offset: number): DirRecord | null {
  const length = bytes[offset] ?? 0;
  if (length < 33 || offset + length > bytes.length) return null;
  const lba = view.getUint32(offset + 2, true);
  const size = view.getUint32(offset + 10, true);
  const flags = bytes[offset + 25] ?? 0;
  const nameLength = bytes[offset + 32] ?? 0;

  let name: string;
  if (nameLength === 1 && (bytes[offset + 33] === 0 || bytes[offset + 33] === 1)) {
    name = bytes[offset + 33] === 0 ? '.' : '..';
  } else {
    name = new TextDecoder('latin1')
      .decode(bytes.subarray(offset + 33, offset + 33 + nameLength))
      .toUpperCase()
      .replace(/;\d+$/, '');
  }

  return { name, lba, size, isDir: (flags & 0x02) !== 0 };
}
