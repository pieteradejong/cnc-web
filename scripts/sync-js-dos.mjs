/**
 * Copies the js-dos runtime out of node_modules into public/js-dos/.
 *
 * The npm package has no `exports`/`main` — it ships a bundle that assigns
 * `window.Dos` plus the emulator wasm next to it — so it is served as a static
 * asset rather than imported. Self-hosting also means no third-party CDN call
 * at runtime. Only the DOSBox backend is copied; DOSBox-X adds ~15 MB and is
 * only needed for Windows 9x titles, which these are not.
 */

import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, 'node_modules', 'js-dos', 'dist');
const dest = join(root, 'public', 'js-dos');

const TOP_LEVEL = ['js-dos.js', 'js-dos.css'];
const EMULATORS = [
  'emulators.js',
  'wdosbox.js',
  'wdosbox.wasm',
  'wlibzip.js',
  'wlibzip.wasm',
  'file-explorer.js',
  'file-explorer.css',
  'fileexplorer_sprites.png',
  'fileexplorer_actions.woff',
];

async function copyInto(fromDir, toDir, names) {
  await mkdir(toDir, { recursive: true });
  let bytes = 0;
  for (const name of names) {
    const from = join(fromDir, name);
    try {
      await copyFile(from, join(toDir, name));
      bytes += (await stat(from)).size;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn(`sync-js-dos: ${name} not found in the installed js-dos — skipped`);
        continue;
      }
      throw error;
    }
  }
  return bytes;
}

try {
  await readdir(src);
} catch {
  console.error('sync-js-dos: node_modules/js-dos/dist is missing — run npm install first');
  process.exit(1);
}

const bytes =
  (await copyInto(src, dest, TOP_LEVEL)) +
  (await copyInto(join(src, 'emulators'), join(dest, 'emulators'), EMULATORS));

console.log(`sync-js-dos: copied ${(bytes / 1024 / 1024).toFixed(1)} MB to public/js-dos/`);
