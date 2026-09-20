# Command & Conquer in the browser

Play **Command & Conquer: Tiberian Dawn** (1995) and **Command & Conquer: Red Alert** (1996) in a
browser tab, using your own copy of the games. Nothing is installed, no server is involved, and the
game files never leave your machine.

> No game data ships with this project. EA released the _source code_ of both games under the GPL in
> February 2025 — not the assets. You supply the game files yourself, from your own CD, the freeware
> release, or another copy you own.

## Quick start

```bash
npm install     # also copies the js-dos runtime into public/js-dos/
npm run dev     # http://localhost:5173
```

Then, in the page: drop a game folder, a `.zip` of an install, or a CD `.iso` onto the card for the
game, and press **Play**. Files are stored in the browser (OPFS, or IndexedDB where OPFS is
unavailable) and stay there across reloads.

What counts as a valid install:

|                   | Required                                                                                   | Also used if present                                                            |
| ----------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| **Tiberian Dawn** | `CONQUER.MIX`, `GENERAL.MIX`, `SOUNDS.MIX`, `LOCAL.MIX` (or `CCLOCAL.MIX`), the executable | `TRANSIT.MIX`, `SPEECH.MIX`, `SCORES.MIX`, `MOVIES.MIX`, theater mixes, updates |
| **Red Alert**     | `MAIN.MIX` (or `REDALERT.MIX`), `LOCAL.MIX`, `SOUNDS.MIX`, the executable                  | `SPEECH.MIX`, `SCORES.MIX`, `HIRES.MIX`, `EXPAND.MIX`, `EXPAND2.MIX`, movies    |

The required lists come from the engine's own startup code in
[Vanilla Conquer](https://github.com/TheAssemblyArmada/Vanilla-Conquer) (`init.cpp`). Missing optional
files cost you music, speech, movies or expansions — the game still runs.

## Saves

Save games are read back out of the emulator when you leave a session and stored alongside the game
data, then injected again on the next launch. **Export saves** writes them to a zip you can keep or
move to another machine; **Import saves** reads one back. Browser storage is not a backup — clearing
site data deletes everything, so export anything you care about.

## Scripts

```bash
npm run dev         # dev server (sets the COOP/COEP headers js-dos needs)
npm run build       # typecheck + production build
npm run preview     # serve the build, with the same headers
npm test            # Vitest: manifest matching, ISO reading
npm run typecheck   # tsc --noEmit
npm run lint        # prettier --check .
npm run format      # prettier --write .
npm run sync:js-dos # re-copy the js-dos runtime from node_modules
```

## How it works

```
src/
  gamedata/    manifests (what a valid install is), OPFS/IndexedDB store, importer, ISO-9660 reader
  runtime/     the backend seam: GameRuntime / GameSession, the js-dos backend, dosbox.conf builder
  shell/       library UI, settings, save import/export
  types/       js-dos v8 API declarations
```

Everything the app does — importing, storing, validating, saving, the UI — is independent of what
actually runs the game. That is the point of `src/runtime/types.ts`: today the only working backend
is **js-dos** (DOSBox compiled to WebAssembly, running the original DOS executables); the next one is
**Vanilla Conquer** (the GPL game source itself, built with Emscripten), which slots in behind the
same interface. `?engine=js-dos` / `?engine=vanilla-conquer` selects between them.

Game files are handed to the emulator as an in-memory filesystem (`initFs`) together with a generated
`dosbox.conf` that mounts them as `C:` and runs the executable, so no bundle is ever built on disk.

## Deploying

The app is fully static, but js-dos runs the emulator on a worker thread with `SharedArrayBuffer`,
which requires a cross-origin-isolated page. The host must send:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

`vite.config.ts` sets these for `dev` and `preview`; production hosting must set them too, or the
emulator will fail to start.

## Project docs

- [`docs/PROGRESS.md`](docs/PROGRESS.md) — what is built, what is verified and how, what is open
- [`docs/PLAN.md`](docs/PLAN.md) — the staged plan, including the phase-4 engine port
- [`DECISIONS.md`](DECISIONS.md) — choices that closed off an alternative

## License

GPL-3.0-or-later — see [LICENSE](LICENSE). This project links against
[js-dos](https://github.com/caiiiycuk/js-dos) (GPL-2.0) and is designed to host the Vanilla Conquer
engine (GPL-3.0), so it carries the same terms.

Copyright (c) 2026 Pieter de Jong.

Command & Conquer, Red Alert and Westwood Studios are trademarks of Electronic Arts. This project is
not affiliated with or endorsed by EA, and distributes none of their assets.
