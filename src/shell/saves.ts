/**
 * Save games move in and out of the browser as zip files.
 *
 * Browser storage is not a backup — a cleared origin takes the campaign with
 * it — so exporting saves has to be one click, and an exported zip has to be
 * importable on another machine.
 */

import { unzipSync, zipSync } from 'fflate';
import type { GameId } from '../gamedata/manifests.ts';
import { normalizeName } from '../gamedata/manifests.ts';
import type { AssetStore, StoredFile } from '../gamedata/store.ts';
import { isSaveFile } from '../runtime/types.ts';

export async function exportSaves(store: AssetStore, game: GameId): Promise<Blob | null> {
  const files = await store.readAll(game, 'saves');
  if (files.length === 0) return null;
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) entries[file.name] = file.bytes;
  return new Blob([zipSync(entries) as unknown as BlobPart], { type: 'application/zip' });
}

export async function importSaves(store: AssetStore, game: GameId, zip: File): Promise<number> {
  const entries = unzipSync(new Uint8Array(await zip.arrayBuffer()));
  const files: StoredFile[] = [];
  for (const [path, bytes] of Object.entries(entries)) {
    const name = normalizeName(path);
    if (path.endsWith('/') || !isSaveFile(name)) continue;
    files.push({ name, bytes });
  }
  if (files.length > 0) await store.write(game, files, 'saves');
  return files.length;
}
