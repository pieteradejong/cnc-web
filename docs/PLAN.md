# Plan: Command & Conquer (Tiberian Dawn) + Red Alert in the browser

## Context

`/Users/pieterdejong/dev/projects/games` is empty. The goal is a Vite + TypeScript web app in which
the original C&C (Tiberian Dawn) and Red Alert are playable — single-player campaigns — with the
player supplying their own game files, which never enter the repo.

Two things make this tractable now:

- EA released both games' full source under GPLv3 (Feb 2025: `electronicarts/CnC_Tiberian_Dawn`,
  `electronicarts/CnC_Red_Alert`; earlier, 2020, the Remastered DLL sources). **No assets** were
  released — code only.
- `TheAssemblyArmada/Vanilla-Conquer` already turned that source into a clean, portable CMake +
  SDL2 + OpenAL build of _both_ games. No public WebAssembly build of it exists — that is the gap
  this project fills.

Research found no shortcut to a web-native TD/RA: `cncjs` is a partial TS reimplementation, OpenRA is
.NET desktop, Chrono Divide is RA2 and closed-source. So the plan is staged: get genuinely playable
in days via DOSBox-in-wasm, behind a runtime seam that a real WebAssembly port of Vanilla Conquer can
later slot into without rewriting the app around it.

**Decisions locked with the user:** emulator shell first → WASM port second; scope is single-player
campaigns; game files are user-supplied and stored locally in the browser.

## Licensing (decide before the first commit)

The app ships/loads GPL binaries either way — DOSBox (GPL-2.0-or-later) in phase 1, Vanilla Conquer
(GPLv3) in phase 4. **License this repo GPLv3**, not the workspace-default MIT, and say why in the
README. Copyright line per workspace convention: `Copyright (c) 2026 Pieter de Jong`.

`.gitignore` from the first commit must exclude game data: `*.mix`, `*.MIX`, `*.iso`, `*.jsdos`,
`*.vqa`, `public/bundles/`, `assets/game-data/`, plus the usual `node_modules/`, `dist/`, `.env*`,
`.DS_Store`. No game bytes in git, ever — they are copyrighted and large.

## Architecture: one seam, two backends

Everything except the emulator/engine is shared between phases. Define the seam first:

```ts
// src/runtime/types.ts
export type GameId = 'td' | 'ra';

export interface GameRuntime {
  readonly id: 'js-dos' | 'vanilla-conquer';
  available(game: GameId, store: AssetStore): Promise<boolean>; // required files present?
  start(host: HTMLElement, game: GameId, store: AssetStore): Promise<GameSession>;
}

export interface GameSession {
  pause(): void;
  resume(): void;
  screenshot(): Promise<Blob>;
  dispose(): Promise<void>;
}
```

Phase 1 implements `JsDosRuntime`; phase 4 implements `VanillaConquerRuntime`. The shell, asset
store, manifest validation, save management, and UI never learn which one is running.

```
src/
  main.ts               # boots shell, picks runtime via ?engine= or feature detect
  shell/                # game picker, asset importer, settings, save manager (vanilla TS + CSS)
  assets/
    store.ts            # OPFS-first, IndexedDB fallback
    manifests.ts        # required/optional file list per game
    import.ts           # drag-drop + <input type=file webkitdirectory>, ISO/zip handling
  runtime/
    types.ts
    js-dos.ts
    vanilla-conquer.ts  # phase 4
  saves/                # export/import save games to disk
```

## Phase 0 — Scaffold (½ day)

- `npm create vite@latest . -- --template vanilla-ts`, `git init`, GPLv3 `LICENSE`, `.gitignore`,
  README stating the "bring your own game files" requirement.
- Vanilla TS, no UI framework — the app is a canvas plus modest chrome, and workspace policy favours
  dependency-light projects. Add Vitest for the asset/manifest logic (the only genuinely testable part).
- Pin exact dependency versions (no `^`/`~`), per workspace convention.
- `.github/workflows/ci.yml`: typecheck, lint, test, build — copy the shape used by `templates/ts-web`.
- **Cross-origin isolation**: js-dos's worker/threaded backend needs `SharedArrayBuffer`. Set
  `server.headers` and `preview.headers` in `vite.config.ts` to `Cross-Origin-Opener-Policy:
same-origin` and `Cross-Origin-Embedder-Policy: require-corp` from day one, and mirror them in
  whatever host config is used later. Getting this wrong late is a confusing class of bug.

## Phase 1 — Playable via js-dos (1–2 days)

- `npm i js-dos` (v8.x, DOSBox + DOSBox-X backends, OPFS persistence, WebGL renderer).
- `JsDosRuntime.start()` mounts `Dos(hostEl, { ... })` against a bundle assembled at runtime from the
  user's files — js-dos v8 exposes an `initFs` option for injecting files into the emulator FS;
  confirm its exact shape from the installed package's typings (`node_modules/js-dos`) rather than
  from docs, then build the `.jsdos`-equivalent in memory: a generated `dosbox.conf` (cycles, sound
  blaster, mouse) plus the game directory.
- Target the **DOS** releases of both games — they are what DOSBox runs cleanly. Keep the DOSBox-X
  backend in mind only as a fallback for Win95 (`C&C95.EXE`) installs; do not build for it in phase 1.
- Wire pause/resume/screenshot/dispose through js-dos's event and API surface.

**Done when:** a mission in each game is playable start-to-finish in Chrome with sound and mouse control.

## Phase 2 — Asset ingestion and storage (1–2 days)

- `AssetStore`: OPFS (`navigator.storage.getDirectory()`), IndexedDB fallback, namespaced per game.
  Report quota via `navigator.storage.estimate()` — a full RA install with movies is hundreds of MB.
- `manifests.ts`: per-game required and optional file lists (TD: `CONQUER.MIX`, `GENERAL.MIX`,
  terrain `.MIX`es, `SOUNDS.MIX`, `SPEECH.MIX`, the executable; RA: `MAIN.MIX`, `REDALERT.MIX`,
  `LOCAL.MIX`, `SOUNDS.MIX`, `SPEECH.MIX`, `HIRES.MIX`, expansions). **Derive the authoritative lists
  from Vanilla Conquer's own required-file checks** rather than from memory — that repo is the
  reference, and it must agree with phase 4 anyway.
- Import UI: drag a folder or an ISO/zip onto the page. Handle a mounted-CD directory, a zip, and an
  ISO (ISO-9660 read is ~200 lines, or a small library — check for one already used in `/projects`
  before adding a dependency). Case-insensitive matching: DOS filenames are uppercase, user dumps
  vary.
- Clear diagnostics: list which required files are missing, and what a valid install looks like.
- Vitest covers manifest matching, case folding, and archive extraction against small synthetic fixtures.

**Done when:** a fresh browser profile goes from empty → drop files → both games listed as playable,
and the install survives a reload.

## Phase 3 — Shell polish and deploy (1–2 days)

- Game picker, per-game settings (scale/filter, cycles, audio), fullscreen, keyboard capture.
- Save games: export the emulator's save directory to a downloadable `.zip`, and re-import it —
  browser storage is not a backup, and the user should be able to move saves between machines.
- Static deploy with the COOP/COEP headers set (Vercel `vercel.ts` `headers`, or any static host that
  allows custom headers). Nothing server-side is needed; all data stays in the browser.

**Done when:** deployed URL, fresh profile, both campaigns playable, saves round-trip through export/import.

## Phase 4 — WebAssembly port of Vanilla Conquer (the real goal; 3–6 weeks, spike first)

Do a **timeboxed 2–3 day spike before committing to the rest.** Order matters — each step is a
go/no-go:

1. Fork/vendor `TheAssemblyArmada/Vanilla-Conquer` as a submodule under `engine/`. Confirm the SDL2 +
   OpenAL build works natively on macOS ARM first, so later breakage is attributable to Emscripten.
2. `emcmake cmake` with `-sUSE_SDL=2 -lopenal`. Expect the first failures in platform code, not game
   code. Build one game (TD) only.
3. **The main-loop problem is the crux**: the C&C loop is blocking (`while (!done) …`), which a
   browser cannot run. Try `-sASYNCIFY` first (cheap, no restructuring, costs size and some speed).
   Only if Asyncify is too slow, restructure `Main_Loop` around `emscripten_set_main_loop`.
4. Filesystem: mount the phase-2 OPFS/IDBFS install at the path the engine expects; saves write back
   to the same store.
5. Then RA (same codebase, second target), then VQA video playback, then audio timing, then input edge
   cases (right-click, drag-select, edge scrolling).

`VanillaConquerRuntime` implements the same `GameRuntime` interface; a `?engine=` flag switches
backends so both stay runnable side by side and can be compared directly.

**Known risks, in order of likelihood:** Asyncify performance; residual x86 assembly or 32-bit
pointer assumptions in the legacy code; threading in the audio layer; VQA movie playback; total wasm
size. Any of these can stall the port — which is exactly why phases 1–3 ship something playable
first, and why none of that work is discarded if phase 4 stalls.

## Verification

- Per phase, the "Done when" line above, exercised manually in a real browser (Chrome MCP tools can
  drive it and capture screenshots for the record).
- `npm run test` (Vitest) for asset/manifest logic; `npm run build && npm run preview` for the
  production path — the COOP/COEP headers must be verified in preview, not just dev.
- Before any push to a public repo: run `dotaudit`, and confirm no `.mix`/`.iso`/save data is tracked
  (`git ls-files | grep -iE '\.(mix|iso|vqa|jsdos)$'` must be empty).

## Out of scope (explicitly)

Skirmish vs AI, multiplayer, mobile/touch controls, the Remastered Collection's HD assets, and
Tiberian Sun / Red Alert 2. The seam leaves room for skirmish and for js-dos's WebRTC IPX stack
later, but nothing in this plan builds toward them.
