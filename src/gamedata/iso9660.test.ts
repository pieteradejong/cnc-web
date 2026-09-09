import { describe, expect, it } from 'vitest';
import { looksLikeIso, readIso } from './iso9660.ts';

const SECTOR = 2048;

interface Record {
  name: string;
  lba: number;
  size: number;
  dir: boolean;
}

/**
 * Builds the smallest ISO-9660 image that exercises the reader: a primary
 * volume descriptor, a root directory holding one subdirectory, and one file
 * inside it.
 */
function buildIso(): Uint8Array {
  const image = new Uint8Array(24 * SECTOR);
  const view = new DataView(image.buffer);

  // Primary volume descriptor at sector 16, with the root record at offset 156.
  const pvd = 16 * SECTOR;
  image[pvd] = 1;
  image.set(new TextEncoder().encode('CD001'), pvd + 1);
  writeRecord(image, view, pvd + 156, { name: '\0', lba: 17, size: SECTOR, dir: true });

  // Root directory at sector 17: '.', '..', then the CNC directory at sector 18.
  let offset = 17 * SECTOR;
  offset += writeRecord(image, view, offset, { name: '\0', lba: 17, size: SECTOR, dir: true });
  offset += writeRecord(image, view, offset, { name: '', lba: 17, size: SECTOR, dir: true });
  writeRecord(image, view, offset, { name: 'CNC', lba: 18, size: SECTOR, dir: true });

  // CNC directory at sector 18 holding CONQUER.MIX (4 bytes at sector 20).
  offset = 18 * SECTOR;
  offset += writeRecord(image, view, offset, { name: '\0', lba: 18, size: SECTOR, dir: true });
  offset += writeRecord(image, view, offset, { name: '', lba: 17, size: SECTOR, dir: true });
  writeRecord(image, view, offset, { name: 'CONQUER.MIX;1', lba: 20, size: 4, dir: false });

  image.set([1, 2, 3, 4], 20 * SECTOR);
  return image;
}

function writeRecord(image: Uint8Array, view: DataView, offset: number, entry: Record): number {
  const name = new TextEncoder().encode(entry.name);
  const unpadded = 33 + name.length;
  const length = unpadded + (unpadded % 2);
  image[offset] = length;
  view.setUint32(offset + 2, entry.lba, true);
  view.setUint32(offset + 10, entry.size, true);
  image[offset + 25] = entry.dir ? 0x02 : 0x00;
  image[offset + 32] = name.length;
  image.set(name, offset + 33);
  return length;
}

describe('iso9660', () => {
  it('recognises an ISO-9660 image by its CD001 signature', () => {
    expect(looksLikeIso(buildIso())).toBe(true);
    expect(looksLikeIso(new Uint8Array(64))).toBe(false);
  });

  it('walks directories and strips the version suffix from file names', () => {
    const entries = readIso(buildIso());
    expect(entries.map((entry) => entry.path)).toEqual(['CNC/CONQUER.MIX']);
    expect(Array.from(entries[0]!.bytes)).toEqual([1, 2, 3, 4]);
  });

  it('rejects data that is not an image', () => {
    expect(() => readIso(new Uint8Array(1024))).toThrow(/ISO-9660/);
  });
});
