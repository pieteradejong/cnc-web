/**
 * What a valid Tiberian Dawn / Red Alert install looks like.
 *
 * The file lists are derived from Vanilla Conquer's own startup code
 * (tiberiandawn/init.cpp and redalert/init.cpp, `new MFCD(...)` calls), which is
 * the same engine source the phase-4 WebAssembly port will use — so both
 * backends agree on what "installed" means.
 *
 * Requirements are deliberately split: `required` is the minimum that identifies
 * a real install and without which the game cannot start, `recommended` is
 * everything else the engine looks for (music, movies, speech, expansions). A
 * missing recommended file is a warning, never a block — installs vary a lot
 * between the CD, the freeware release and the various re-releases.
 */

export type GameId = 'td' | 'ra';

/** A group where any one member satisfies the requirement (e.g. LOCAL.MIX vs CCLOCAL.MIX). */
export type RequiredGroup = string[];

export interface GameManifest {
  readonly id: GameId;
  readonly title: string;
  readonly subtitle: string;
  /** Directory the files are mounted into, i.e. C:\<dir> inside DOSBox. */
  readonly dir: string;
  readonly required: readonly RequiredGroup[];
  readonly recommended: readonly string[];
  /** Known executable names, best first. Any other .EXE is offered as a fallback. */
  readonly executables: readonly string[];
  /** DOSBox cycles that run this game at roughly its intended speed. */
  readonly cycles: number;
}

export const MANIFESTS: Record<GameId, GameManifest> = {
  td: {
    id: 'td',
    title: 'Command & Conquer',
    subtitle: 'Tiberian Dawn (1995)',
    dir: 'CNC',
    required: [['CONQUER.MIX'], ['GENERAL.MIX'], ['SOUNDS.MIX'], ['LOCAL.MIX', 'CCLOCAL.MIX']],
    recommended: [
      'TRANSIT.MIX',
      'SPEECH.MIX',
      'SCORES.MIX',
      'MOVIES.MIX',
      'DESERT.MIX',
      'TEMPERAT.MIX',
      'WINTER.MIX',
      'UPDATE.MIX',
      'UPDATEC.MIX',
    ],
    executables: ['C&C.EXE', 'CC.EXE', 'CNC.EXE', 'C&C95.EXE'],
    cycles: 20000,
  },
  ra: {
    id: 'ra',
    title: 'Command & Conquer: Red Alert',
    subtitle: 'Red Alert (1996)',
    dir: 'RA',
    required: [['MAIN.MIX', 'REDALERT.MIX'], ['LOCAL.MIX'], ['SOUNDS.MIX']],
    recommended: [
      'CONQUER.MIX',
      'SPEECH.MIX',
      'SCORES.MIX',
      'GENERAL.MIX',
      'TRANSIT.MIX',
      'HIRES.MIX',
      'LORES.MIX',
      'RUSSIAN.MIX',
      'ALLIES.MIX',
      'EXPAND.MIX',
      'EXPAND2.MIX',
      'MOVIES1.MIX',
      'MOVIES2.MIX',
    ],
    executables: ['RA.EXE', 'REDALERT.EXE', 'RA95.EXE'],
    cycles: 30000,
  },
};

export const GAME_IDS: readonly GameId[] = ['td', 'ra'];

export interface InstallCheck {
  /** True when every required group is satisfied and an executable was found. */
  readonly playable: boolean;
  /** Required groups with no member present, rendered as "A.MIX or B.MIX". */
  readonly missingRequired: string[];
  readonly missingRecommended: string[];
  /** Executable that will be launched, or null when none was found. */
  readonly executable: string | null;
  /** Every .EXE in the install, so the user can override the choice. */
  readonly executables: string[];
}

/** DOS filenames are case-insensitive; imported dumps are not consistent about it. */
export function normalizeName(name: string): string {
  const base = name.replace(/\\/g, '/').split('/').pop() ?? name;
  return base.toUpperCase();
}

export function checkInstall(manifest: GameManifest, fileNames: readonly string[]): InstallCheck {
  const present = new Set(fileNames.map(normalizeName));

  const missingRequired = manifest.required
    .filter((group) => !group.some((name) => present.has(name)))
    .map((group) => group.join(' or '));

  const missingRecommended = manifest.recommended.filter((name) => !present.has(name));

  const executables = [...present].filter((name) => name.endsWith('.EXE')).sort();
  const known = manifest.executables.find((name) => present.has(name)) ?? null;
  // Prefer a known name; otherwise fall back to whatever single executable exists.
  const executable = known ?? (executables.length > 0 ? executables[0]! : null);

  return {
    playable: missingRequired.length === 0 && executable !== null,
    missingRequired,
    missingRecommended,
    executable,
    executables,
  };
}

/** Files worth keeping out of an import: source dumps carry a lot of noise. */
const KEPT_EXTENSIONS = new Set([
  '.MIX',
  '.EXE',
  '.COM',
  '.BAT',
  '.INI',
  '.CFG',
  '.DAT',
  '.SAV',
  '.PAL',
  '.ENG',
  '.FNT',
  '.DLL',
]);

export function isGameFile(name: string): boolean {
  const upper = normalizeName(name);
  if (upper.startsWith('.')) return false; // .DS_Store and friends
  const dot = upper.lastIndexOf('.');
  if (dot < 0) return false;
  if (/^SAVEGAME\./.test(upper)) return true;
  return KEPT_EXTENSIONS.has(upper.slice(dot));
}
