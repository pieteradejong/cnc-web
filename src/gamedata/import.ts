/**
 * Turning whatever the user dropped on the page into a set of game files.
 *
 * Accepts: a folder (drag-drop or the directory picker), loose files, a .zip of
 * an install, and a .iso of the CD. Everything is flattened to base names,
 * upper-cased, and filtered down to files the games actually read — a dropped
 * install directory otherwise brings along readmes, installers and OS cruft.
 */

import { unzipSync } from 'fflate';
import { isGameFile, normalizeName } from './manifests.ts';
import { looksLikeIso, readIso } from './iso9660.ts';
import type { StoredFile } from './store.ts';

export interface ImportResult {
  readonly files: StoredFile[];
  /** Names that were read but discarded as not game data, for the report. */
  readonly skipped: string[];
  readonly sources: string[];
}

const ARCHIVE_LIMIT = 4 * 1024 * 1024 * 1024;

export async function importFiles(
  inputs: File[],
  onProgress?: (name: string) => void,
): Promise<ImportResult> {
  const files = new Map<string, Uint8Array>();
  const skipped: string[] = [];
  const sources: string[] = [];

  const add = (name: string, bytes: Uint8Array) => {
    const normalized = normalizeName(name);
    if (!isGameFile(normalized)) {
      skipped.push(normalized);
      return;
    }
    // Later wins: a CD image dropped after a partial folder should complete it.
    files.set(normalized, bytes);
  };

  for (const input of inputs) {
    onProgress?.(input.name);
    const lower = input.name.toLowerCase();

    if (lower.endsWith('.zip')) {
      sources.push(input.name);
      if (input.size > ARCHIVE_LIMIT) throw new Error(`${input.name} is too large to unpack in the browser`);
      const entries = unzipSync(new Uint8Array(await input.arrayBuffer()));
      for (const [path, bytes] of Object.entries(entries)) {
        if (path.endsWith('/')) continue;
        add(path, bytes);
      }
      continue;
    }

    if (lower.endsWith('.iso') || lower.endsWith('.bin') || lower.endsWith('.img')) {
      const bytes = new Uint8Array(await input.arrayBuffer());
      if (looksLikeIso(bytes)) {
        sources.push(input.name);
        for (const entry of readIso(bytes)) add(entry.path, entry.bytes);
        continue;
      }
    }

    add(input.name, new Uint8Array(await input.arrayBuffer()));
  }

  return {
    files: [...files].map(([name, bytes]) => ({ name, bytes })).sort((a, b) => a.name.localeCompare(b.name)),
    skipped,
    sources,
  };
}

/** Flattens a drag-and-drop payload, walking directories where the browser exposes them. */
export async function filesFromDataTransfer(transfer: DataTransfer): Promise<File[]> {
  const entries: FileSystemEntry[] = [];
  const plain: File[] = [];

  for (const item of Array.from(transfer.items)) {
    if (item.kind !== 'file') continue;
    const entry = item.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
    else {
      const file = item.getAsFile();
      if (file) plain.push(file);
    }
  }

  if (entries.length === 0) return plain.length > 0 ? plain : Array.from(transfer.files);

  const out: File[] = [];
  for (const entry of entries) await walkEntry(entry, out);
  return out;
}

async function walkEntry(entry: FileSystemEntry, out: File[], depth = 0): Promise<void> {
  if (depth > 8) return;
  if (entry.isFile) {
    const file = await new Promise<File | null>((resolve) =>
      (entry as FileSystemFileEntry).file(resolve, () => resolve(null)),
    );
    if (file) out.push(file);
    return;
  }
  if (!entry.isDirectory) return;

  const reader = (entry as FileSystemDirectoryEntry).createReader();
  // readEntries returns at most 100 entries per call and must be drained.
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve) =>
      reader.readEntries(resolve, () => resolve([])),
    );
    if (batch.length === 0) break;
    for (const child of batch) await walkEntry(child, out, depth + 1);
  }
}
