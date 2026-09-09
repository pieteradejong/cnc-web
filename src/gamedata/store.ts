/**
 * Local storage for user-supplied game data.
 *
 * Game files never leave the browser and never enter the repo: they are the
 * user's own copy of a game they own. OPFS is used where available (fast, no
 * size ceiling beyond the origin quota, streams to disk); IndexedDB is the
 * fallback for browsers without it. Layout is flat per game:
 *
 *   <root>/<gameId>/<FILENAME>
 *   <root>/<gameId>/saves/<FILENAME>
 */

import type { GameId } from './manifests.ts';
import { normalizeName } from './manifests.ts';

export interface StoredFile {
  readonly name: string;
  readonly bytes: Uint8Array;
}

export interface StoreUsage {
  readonly usage: number;
  readonly quota: number;
}

export interface AssetStore {
  readonly kind: 'opfs' | 'indexeddb';
  list(game: GameId, folder?: 'game' | 'saves'): Promise<string[]>;
  read(game: GameId, name: string, folder?: 'game' | 'saves'): Promise<Uint8Array | null>;
  readAll(game: GameId, folder?: 'game' | 'saves'): Promise<StoredFile[]>;
  write(
    game: GameId,
    files: StoredFile[],
    folder?: 'game' | 'saves',
    onProgress?: (done: number, total: number, name: string) => void,
  ): Promise<void>;
  clear(game: GameId, folder?: 'game' | 'saves'): Promise<void>;
  usage(): Promise<StoreUsage>;
}

const ROOT = 'cnc-web';

type Folder = 'game' | 'saves';

/* ------------------------------------------------------------------ OPFS */

class OpfsStore implements AssetStore {
  readonly kind = 'opfs' as const;

  private async dir(
    game: GameId,
    folder: Folder,
    create: boolean,
  ): Promise<FileSystemDirectoryHandle | null> {
    try {
      const root = await navigator.storage.getDirectory();
      const app = await root.getDirectoryHandle(ROOT, { create });
      const gameDir = await app.getDirectoryHandle(game, { create });
      return folder === 'saves' ? await gameDir.getDirectoryHandle('saves', { create }) : gameDir;
    } catch (e) {
      if (!create && (e as DOMException).name === 'NotFoundError') return null;
      throw e;
    }
  }

  async list(game: GameId, folder: Folder = 'game'): Promise<string[]> {
    const dir = await this.dir(game, folder, false);
    if (!dir) return [];
    const names: string[] = [];
    for await (const [name, handle] of dir as unknown as AsyncIterable<[string, FileSystemHandle]>) {
      if (handle.kind === 'file') names.push(name);
    }
    return names.sort();
  }

  async read(game: GameId, name: string, folder: Folder = 'game'): Promise<Uint8Array | null> {
    const dir = await this.dir(game, folder, false);
    if (!dir) return null;
    try {
      const file = await (await dir.getFileHandle(normalizeName(name))).getFile();
      return new Uint8Array(await file.arrayBuffer());
    } catch {
      return null;
    }
  }

  async readAll(game: GameId, folder: Folder = 'game'): Promise<StoredFile[]> {
    const dir = await this.dir(game, folder, false);
    if (!dir) return [];
    const out: StoredFile[] = [];
    for await (const [name, handle] of dir as unknown as AsyncIterable<[string, FileSystemHandle]>) {
      if (handle.kind !== 'file') continue;
      const file = await (handle as FileSystemFileHandle).getFile();
      out.push({ name, bytes: new Uint8Array(await file.arrayBuffer()) });
    }
    return out;
  }

  async write(
    game: GameId,
    files: StoredFile[],
    folder: Folder = 'game',
    onProgress?: (done: number, total: number, name: string) => void,
  ): Promise<void> {
    const dir = await this.dir(game, folder, true);
    if (!dir) throw new Error('OPFS unavailable');
    let done = 0;
    for (const file of files) {
      const name = normalizeName(file.name);
      const handle = await dir.getFileHandle(name, { create: true });
      const writable = await handle.createWritable();
      await writable.write(file.bytes as unknown as BufferSource);
      await writable.close();
      onProgress?.(++done, files.length, name);
    }
  }

  async clear(game: GameId, folder?: Folder): Promise<void> {
    const root = await navigator.storage.getDirectory();
    const app = await root.getDirectoryHandle(ROOT, { create: true });
    if (!folder) {
      await app.removeEntry(game, { recursive: true }).catch(() => undefined);
      return;
    }
    const dir = await this.dir(game, folder, false);
    if (!dir) return;
    for await (const [name] of dir as unknown as AsyncIterable<[string, FileSystemHandle]>) {
      await dir.removeEntry(name, { recursive: true }).catch(() => undefined);
    }
  }

  async usage(): Promise<StoreUsage> {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota };
  }
}

/* ------------------------------------------------------------- IndexedDB */

const DB_NAME = 'cnc-web';
const DB_STORE = 'files';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

class IdbStore implements AssetStore {
  readonly kind = 'indexeddb' as const;

  private key(game: GameId, folder: Folder, name = ''): string {
    return `${game}/${folder}/${name}`;
  }

  private async keys(game: GameId, folder: Folder): Promise<string[]> {
    const db = await openDb();
    const tx = db.transaction(DB_STORE, 'readonly');
    const prefix = this.key(game, folder);
    const range = IDBKeyRange.bound(prefix, prefix + '￿');
    const keys = await idbRequest(tx.objectStore(DB_STORE).getAllKeys(range));
    db.close();
    return (keys as string[]).filter((k) => k.slice(prefix.length).length > 0);
  }

  async list(game: GameId, folder: Folder = 'game'): Promise<string[]> {
    const prefix = this.key(game, folder);
    return (await this.keys(game, folder)).map((k) => k.slice(prefix.length)).sort();
  }

  async read(game: GameId, name: string, folder: Folder = 'game'): Promise<Uint8Array | null> {
    const db = await openDb();
    const tx = db.transaction(DB_STORE, 'readonly');
    const value = await idbRequest(tx.objectStore(DB_STORE).get(this.key(game, folder, normalizeName(name))));
    db.close();
    return (value as Uint8Array | undefined) ?? null;
  }

  async readAll(game: GameId, folder: Folder = 'game'): Promise<StoredFile[]> {
    const names = await this.list(game, folder);
    const out: StoredFile[] = [];
    for (const name of names) {
      const bytes = await this.read(game, name, folder);
      if (bytes) out.push({ name, bytes });
    }
    return out;
  }

  async write(
    game: GameId,
    files: StoredFile[],
    folder: Folder = 'game',
    onProgress?: (done: number, total: number, name: string) => void,
  ): Promise<void> {
    const db = await openDb();
    let done = 0;
    for (const file of files) {
      const name = normalizeName(file.name);
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(file.bytes, this.key(game, folder, name));
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      onProgress?.(++done, files.length, name);
    }
    db.close();
  }

  async clear(game: GameId, folder?: Folder): Promise<void> {
    const folders: Folder[] = folder ? [folder] : ['game', 'saves'];
    const db = await openDb();
    for (const f of folders) {
      const keys = await this.keys(game, f);
      const tx = db.transaction(DB_STORE, 'readwrite');
      for (const key of keys) tx.objectStore(DB_STORE).delete(key);
      await new Promise<void>((resolve) => {
        tx.oncomplete = () => resolve();
      });
    }
    db.close();
  }

  async usage(): Promise<StoreUsage> {
    const { usage = 0, quota = 0 } = (await navigator.storage?.estimate?.()) ?? {};
    return { usage, quota };
  }
}

let cached: AssetStore | null = null;

export async function openStore(): Promise<AssetStore> {
  if (cached) return cached;
  if (typeof navigator !== 'undefined' && navigator.storage?.getDirectory) {
    try {
      await navigator.storage.getDirectory();
      cached = new OpfsStore();
      return cached;
    } catch {
      // Firefox private windows and some embedded webviews expose the API but reject it.
    }
  }
  cached = new IdbStore();
  return cached;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}
