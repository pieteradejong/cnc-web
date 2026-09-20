# Decisions

Append-only. An entry is owed when a choice closes off an alternative someone could reasonably
reopen. Supersede an entry with a new one that links back; never edit one in place.

## 1. Ship an emulator shell first, port the engine second

**Date:** 2026-09-09
**Context:** EA released the source of Tiberian Dawn and Red Alert under the GPL in February 2025,
and Vanilla Conquer already builds both from it with CMake + SDL2 + OpenAL — but no public
WebAssembly build of it exists. A port is weeks of C++ and toolchain work with real risk (blocking
main loop, threads, file I/O) before anything is playable.
**Decision:** Build the app around a backend seam (`src/runtime/types.ts`) and implement it first
with js-dos (DOSBox compiled to WebAssembly) running the original DOS executables. The Emscripten
port of Vanilla Conquer becomes a second implementation of the same interface. Rejected: going
straight at the port (nothing playable for weeks, and a stalled spike leaves nothing); an
emulator-only product (caps fidelity at DOSBox forever); a from-scratch TypeScript engine
(months to a playable mission, cncjs-style).
**Verified:** `?engine=vanilla-conquer` resolves to the placeholder backend and reports itself
unsupported rather than being special-cased; `npx vitest run` → "Tests 13 passed (13)" and the
js-dos backend booted a DOS executable in headless Chrome on the same seam. See
[`docs/PROGRESS.md`](docs/PROGRESS.md) § What is verified.

## 2. Players supply their own game files; none are fetched or shipped

**Date:** 2026-09-09
**Context:** EA released code, not assets. The games' data is copyrighted and large. Freeware
mirrors (OpenRA/CnCNet-style) exist and would be more convenient.
**Decision:** The user imports their own copy — folder, `.zip` or CD `.iso` — and it is stored in
their browser (OPFS, IndexedDB fallback). Nothing is downloaded at runtime and nothing enters the
repo. Rejected: fetching the freeware releases from a third-party mirror (depends on someone else's
host and on freeware terms worth reading first).
**Verified:** `git ls-files | grep -icE '\.(mix|iso|vqa|jsdos)$'` → `0`; `.gitignore` blocks
`*.mix`, `*.iso`, `*.vqa`, `*.jsdos`.

## 3. GPL-3.0-or-later, not the workspace-default MIT

**Date:** 2026-09-09
**Context:** Workspace policy defaults code repos to MIT. This app loads GPL binaries either way:
js-dos/DOSBox (GPL-2.0-or-later) today, Vanilla Conquer (GPL-3.0) after the port.
**Decision:** License the repo GPL-3.0-or-later, with the LICENSE in the first commit and
`package.json` agreeing. Rejected: MIT (misstates the terms of the combined work).
**Verified:** `gh repo view pieteradejong/cnc-web --json licenseInfo` → `license=gpl-3.0`;
`package.json` `"license": "GPL-3.0-or-later"`.

## 4. Self-host the js-dos runtime instead of loading it from the CDN

**Date:** 2026-09-09
**Context:** js-dos defaults to `https://v8.js-dos.com/latest/emulators/`, and its npm package has
no `exports`/`main` — it ships a bundle that assigns `window.Dos`, so it cannot simply be imported.
**Decision:** `scripts/sync-js-dos.mjs` copies the DOSBox subset (~2.5 MB) out of `node_modules`
into `public/js-dos/` on install and build; the app loads it as a classic script and sets
`pathPrefix` at itself. `public/js-dos/` is gitignored. Rejected: the CDN default (a third-party
request on every load, and a runtime dependency on someone else's uptime); vendoring the files into
git (build artifacts, and DOSBox-X alone is another ~15 MB).
**Verified:** `npm run sync:js-dos` → "copied 2.5 MB to public/js-dos/"; the emulator booted in
headless Chrome with no external requests.

## 5. Feed the emulator an in-memory filesystem rather than building a bundle

**Date:** 2026-09-09
**Context:** The usual js-dos integration loads a prepared `.jsdos` bundle by URL. Here the
"install" only exists in the user's browser and differs per user.
**Decision:** Pass `dosboxConf` (generated per game: mount `C:`, `cd` into the game directory, run
the executable) together with `initFs` as `{path, contents}` entries built from the stored files.
No bundle is assembled, on disk or in memory. Rejected: zipping a bundle at runtime (a second copy
of every byte, for nothing).
**Verified:** In headless Chrome, DOSBox mounted the injected filesystem as `C:` and ran
`C:\CNC\C&C.EXE`, printing its output; the save it wrote was read back out afterwards.
