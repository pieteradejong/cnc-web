---
# This repo's page on the portfolio site. `public` is the only switch: true lists it, false
# keeps it off (the app stays hosted either way). The portfolio repo pulls this file in with
# scripts/sync-projects.sh; the other fields follow its project schema.
public: false
title: "Command & Conquer in the browser"
description: "Tiberian Dawn and Red Alert in a browser tab, from game files you supply yourself, with nothing installed and no server involved"
techStack: ["TypeScript", "Vite", "WebAssembly", "js-dos", "OPFS"]
githubUrl: "https://github.com/pieteradejong/cnc-web"
demoUrl: "https://cnc-web-padj.vercel.app"
keyFeatures:
  [
    "Drop a game folder, a .zip of an install or a CD .iso onto a card; an ISO-9660 reader written for this pulls the files out in the browser",
    "Each card says whether the stored files make a playable install, which executable will run and which optional files are missing",
    "Saves are read back out of the emulator after every session and can be exported to a zip and imported elsewhere",
  ]
technicalHighlights:
  [
    "One seam, GameRuntime: js-dos (DOSBox in WebAssembly) runs today, and a Vanilla Conquer WebAssembly port can replace it without touching the shell",
    "Install rules come from the engine's own startup code (Vanilla Conquer init.cpp), so the future port enforces the same file set",
    "Game files persist in the Origin Private File System, with IndexedDB as the fallback, and never leave the machine",
    "Cross-origin isolation (COOP/COEP) on every response, which SharedArrayBuffer and the emulator's worker require",
  ]
impact: "Two 1990s strategy games run from a URL on a user's own copy, with no game data shipped and no backend."
tags: ["webassembly", "emulation", "typescript", "browser-storage", "games"]
status: "active"
order: 6
startDate: "2026-09"
hero: "docs/portfolio-hero.png"
heroAlt: "The app's library: two cards, Command & Conquer and Red Alert, each asking for game files with Add folder and Add files buttons"
---

EA released the source code of Command & Conquer and Red Alert under the GPL in February 2025, but
not the game assets. This project plays both games in the browser from files the player already
owns, a CD, an ISO or an old install, without installing anything or sending a byte to a server.

Today the games run under js-dos, DOSBox compiled to WebAssembly, fed an in-memory filesystem and a
generated `dosbox.conf`. The planned next step is compiling the released engine source (Vanilla
Conquer) to WebAssembly behind the same interface.

Status: the import, storage, validation and save handling are tested end to end with synthetic
files; no copyrighted asset is used in testing.
