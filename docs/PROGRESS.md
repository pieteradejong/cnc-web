# Progress

Where this project actually stands, what has been verified and how, and what is still open.
Append at the top of "Session log" as work happens; keep "Current state" rewritten to the present.

The roadmap this tracks against is [`PLAN.md`](PLAN.md); decisions that closed off an alternative
are in [`../DECISIONS.md`](../DECISIONS.md).

## Current state — 2026-09-20

**Phases 0–3 of the plan are complete. Phase 4 (the WebAssembly engine port) has not started.**

| Phase                             | Scope                                                            | State                                     |
| --------------------------------- | ---------------------------------------------------------------- | ----------------------------------------- |
| 0 — Scaffold                      | Vite + TS, GPL LICENSE, `.gitignore`, CI, COOP/COEP              | Done                                      |
| 1 — Playable via js-dos           | DOSBox-wasm backend, generated `dosbox.conf`, `initFs` injection | Done, not yet run against real game files |
| 2 — Asset ingestion               | OPFS/IndexedDB store, folder/zip/ISO import, install validation  | Done                                      |
| 3 — Shell and deploy              | Library UI, per-game settings, save export/import, host headers  | Done, not deployed anywhere               |
| 4 — Vanilla Conquer → WebAssembly | Emscripten port behind the same seam                             | Not started                               |

Repository: <https://github.com/pieteradejong/cnc-web> — public, `main`, GPL-3.0.

### What works

- Two game cards (Tiberian Dawn, Red Alert). Each reports whether the stored files amount to a
  playable install, which executable will run, and which optional files are absent.
- Import from a dropped folder, a `.zip` of an install, or a CD `.iso` (own ISO-9660 reader).
  Names are flattened to upper-case base names and filtered to files the games actually read.
- Files persist in OPFS, falling back to IndexedDB, under `cnc-web/<game>/` with saves in
  `cnc-web/<game>/saves/`.
- Play launches DOSBox-in-WebAssembly with the stored files injected as an in-memory filesystem
  plus a generated `dosbox.conf` that mounts them as `C:` and runs the executable.
- Saves are read back out of the emulator on exit, stored, and re-injected on the next launch;
  export and import move them as a zip.
- `?engine=js-dos` / `?engine=vanilla-conquer` selects a backend; the second reports itself
  unsupported rather than being special-cased away.

### What is verified, and how

| Claim                                                    | Verification                                                                                                                                                                                              | Date       |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Formatting, types, unit tests, production build all pass | `npm run lint` → "All matched files use Prettier code style!"; `npm run typecheck` → no output; `npx vitest run` → "Test Files 2 passed (2) / Tests 13 passed (13)"; `npm run build` → "✓ built in 133ms" | 2026-09-20 |
| CI is green on the pushed head                           | `gh run list --repo pieteradejong/cnc-web --limit 1` → `success cc9058a` ([run](https://github.com/pieteradejong/cnc-web/actions/runs/34381778076))                                                       | 2026-09-20 |
| Repo is public, `main`, GPL-3.0                          | `gh repo view --json visibility,defaultBranchRef,licenseInfo` → `visibility=PUBLIC branch=main license=gpl-3.0`                                                                                           | 2026-09-20 |
| No game data or secrets tracked                          | `git ls-files \| grep -icE '\.(mix\|iso\|vqa\|jsdos)$'` → `0`; `git grep -iInE 'api[_-]?key\|secret\|password\|token'` → only a LICENSE prose match                                                       | 2026-09-09 |
| Commit identity is the noreply address                   | `git log --format='%ae'` → `pieteradejong@users.noreply.github.com` on all commits                                                                                                                        | 2026-09-20 |
| The page is cross-origin isolated                        | Headless Chrome via CDP, `crossOriginIsolated` → `true`                                                                                                                                                   | 2026-09-09 |
| A valid install flips the card to playable               | Synthetic install written into OPFS at `cnc-web/td/`; card reported "5 files, 170 B", "9 optional files not found", Play enabled                                                                          | 2026-09-09 |
| The emulator boots and runs the stored executable        | DOSBox mounted `C:`, ran `C:\CNC\C&C.EXE` (a hand-assembled DOS `MZ` binary) and printed its output; canvas 640×400                                                                                       | 2026-09-09 |
| Saves survive a session                                  | A second synthetic executable wrote `SAVEGAME.001` inside DOSBox; on "Save & exit" the app reported "Kept 1 save file(s)" and OPFS held `saves/SAVEGAME.001` = `SAVE-OK`                                  | 2026-09-09 |

The browser checks were driven by a throwaway Chrome DevTools Protocol script in the session
scratchpad, which no longer exists — **they are not reproducible as they stand**. See "Open" below.

### What is NOT verified

- **No real game has ever been run.** Every end-to-end check used synthetic files. The manifest
  lists, the DOSBox cycle defaults and the save-file patterns are grounded in Vanilla Conquer's
  `init.cpp` and in the DOS releases' conventions, not in a working copy of either game.
- **Red Alert has never been exercised at all**, even synthetically — only Tiberian Dawn.
- **Never deployed.** `vercel.json` and `public/_headers` carry the COOP/COEP headers, but no host
  has served the build, so cross-origin isolation is proven only for `vite dev`.
- **Rendering and audio are unproven on real hardware.** The headless runs had no GPU or audio
  device, so js-dos fell back from WebGL and logged `sampleRate === 0`. Scaling, aspect ratio and
  sound have not been seen working.
- **Executable names for Red Alert are a guess.** `RA.EXE` / `REDALERT.EXE` / `RA95.EXE` are
  candidates; the fallback ("use the only `.EXE` present") is what actually protects this.

### Open

1. Run both games from a real install — the outstanding "done when" for phase 1.
2. Phase 4 spike, timeboxed 2–3 days: build Vanilla Conquer natively on macOS ARM first, then
   `emcmake cmake` with `-sUSE_SDL=2 -lopenal`, then `-sASYNCIFY` for the blocking main loop.
   Go/no-go before committing to the rest of the port.
3. Rebuild the browser end-to-end harness inside the repo (fixture builder + CDP driver under
   `scripts/`), so the claims above can be re-run instead of trusted.
4. Decide whether to deploy, and where.

## Session log

### 2026-09-20 — documentation and CI hardening

- Added this file and `DECISIONS.md`; recorded the five decisions from the previous session that
  closed off an alternative.
- Added the shared gitleaks job to CI, per the workspace rule that every repo's CI includes it.

### 2026-09-09 — built phases 0–3, published

- Researched the landscape before choosing an approach: EA's February 2025 GPL source releases
  (`CnC_Tiberian_Dawn`, `CnC_Red_Alert` — code, no assets), Vanilla Conquer as the portable
  CMake/SDL2 build of both, and the absence of any public WebAssembly build of it. Rejected `cncjs`
  (partial TypeScript reimplementation), OpenRA (.NET desktop) and Chrono Divide (RA2, closed).
- Built the runtime seam, the js-dos backend, the asset store, the importer with an ISO-9660
  reader, the shell, settings and save handling.
- Verified end to end in headless Chrome with a synthetic install, including the save round-trip.
- Published to GitHub as a public GPL-3.0 repo after rewriting both commits onto the noreply
  identity. First CI run failed on `npm run lint` — `docs/PLAN.md` had been committed without
  running Prettier over it; fixed in `cc9058a`.
