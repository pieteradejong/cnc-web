/** Per-game shell settings, kept in localStorage — nothing here is worth a backend. */

import type { GameId } from '../gamedata/manifests.ts';
import { MANIFESTS } from '../gamedata/manifests.ts';
import type { RuntimeSettings } from '../runtime/types.ts';
import { DEFAULT_SETTINGS } from '../runtime/types.ts';

const KEY = 'cnc-web:settings';

export interface GameSettings extends RuntimeSettings {
  /** Executable the user picked, when the install has more than one. */
  executable: string | null;
}

type AllSettings = Partial<Record<GameId, Partial<GameSettings>>>;

function readAll(): AllSettings {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as AllSettings;
  } catch {
    return {};
  }
}

export function getSettings(game: GameId): GameSettings {
  const stored = readAll()[game] ?? {};
  return {
    ...DEFAULT_SETTINGS,
    cycles: MANIFESTS[game].cycles,
    executable: null,
    ...stored,
  };
}

export function saveSettings(game: GameId, patch: Partial<GameSettings>): GameSettings {
  const all = readAll();
  const next = { ...getSettings(game), ...patch };
  all[game] = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Private windows can refuse writes; settings just fall back to defaults next load.
  }
  return next;
}
