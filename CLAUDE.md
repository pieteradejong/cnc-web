# CLAUDE.md

Guidance for AI coding assistants working in this repository.

## Overview

A Vite + TypeScript web app that plays **Command & Conquer: Tiberian Dawn** and **Red Alert** in the
browser using game files the user supplies themselves. Today the games run under js-dos (DOSBox
compiled to WebAssembly); the intended next step is compiling the GPL game source
([Vanilla Conquer](https://github.com/TheAssemblyArmada/Vanilla-Conquer)) to WebAssembly and running
that instead, behind the same interface. The staged plan lives in
[`docs/PLAN.md`](docs/PLAN.md), current state and what is (and is not) verified in
[`docs/PROGRESS.md`](docs/PROGRESS.md), and choices that closed off an alternative in
[`DECISIONS.md`](DECISIONS.md).

## Commands

```bash
npm install          # also runs sync:js-dos via postinstall
npm run dev          # http://localhost:5173, with COOP/COEP headers
npm run build        # sync + tsc --noEmit + vite build
npm run preview      # serve dist/ with the same headers
npm test             # vitest run
npm run typecheck    # tsc --noEmit
npm run lint         # prettier --check .
npm run format       # prettier --write .
npm run sync:js-dos  # re-copy the js-dos runtime from node_modules into public/js-dos/
```

## Architecture

- `src/runtime/types.ts` is the seam. `GameRuntime.start()` returns a `GameSession`; the shell, the
  store and the save handling depend only on this. `src/runtime/js-dos.ts` is the working backend,
  `src/runtime/vanilla-conquer.ts` the placeholder for the WebAssembly engine port. `?engine=<id>`
  selects one.
- `src/gamedata/manifests.ts` defines what a valid install is. Required files are grouped: any member
  of a group satisfies it (`LOCAL.MIX` or `CCLOCAL.MIX`). The lists are derived from Vanilla
  Conquer's `init.cpp` — keep them in step with that source, not with guesswork, since the phase-4
  backend will enforce the same set.
- `src/gamedata/store.ts` picks OPFS, falling back to IndexedDB. Layout is `cnc-web/<game>/<FILE>`
  with saves in `cnc-web/<game>/saves/`.
- The emulator is fed an in-memory filesystem (`initFs`, an array of `{path, contents}`) plus a
  generated `dosbox.conf` (`src/runtime/dosbox-conf.ts`) that mounts it as `C:` and runs the
  executable. Nothing is packaged into a `.jsdos` bundle.
- Saves are read back out of the emulator's filesystem on exit (`GameSession.harvestSaves`) and
  injected again on the next launch.

## Gotchas

- **Cross-origin isolation is mandatory.** js-dos runs the emulator on a worker with
  `SharedArrayBuffer`. `vite.config.ts` sets COOP/COEP for dev and preview; `vercel.json` and
  `public/_headers` cover hosting. Without them the emulator never starts, and the failure is not
  obviously about headers.
- **js-dos is not importable as a module.** The npm package has no `exports`/`main`; it ships a
  bundle that assigns `window.Dos`. It is copied into `public/js-dos/` by `scripts/sync-js-dos.mjs`
  and loaded as a classic script. Its API is described by hand in `src/types/js-dos.ts` — check that
  file against `node_modules/js-dos` after any version bump.
- **`erasableSyntaxOnly` is on** in `tsconfig.json`: no constructor parameter properties, no enums.
- **Never commit game data.** `.gitignore` blocks `*.mix`, `*.iso`, `*.vqa` and `public/js-dos/`.
  Game files are copyrighted and large; they belong in the user's browser, not in git.
- The repo is **GPL-3.0-or-later**, not the workspace-default MIT, because it links GPL code
  (js-dos, and later Vanilla Conquer).

## Testing without game files

The unit tests cover manifest matching and the ISO-9660 reader. For end-to-end checks, a synthetic
"install" works: four small files named after the required `.MIX`es plus a hand-built DOS `MZ`
executable named `C&C.EXE`. Writing them into OPFS at `cnc-web/td/` makes the card playable and
proves the whole path — mount, `cd CNC`, exec, and save harvesting — without any copyrighted asset.
