/**
 * The seam between the shell and whatever is actually executing the game.
 *
 * Two implementations are planned: `js-dos` (DOSBox compiled to WebAssembly,
 * running the original DOS executables) and, later, `vanilla-conquer` (the GPL
 * game source itself compiled to WebAssembly). The shell, the asset store and
 * the save handling are shared and know nothing about which one is running.
 */

import type { GameId, GameManifest } from '../gamedata/manifests.ts';
import type { StoredFile } from '../gamedata/store.ts';

export type RuntimeId = 'js-dos' | 'vanilla-conquer';

export interface RuntimeSettings {
  /** DOSBox cycles; ignored by native-engine backends. */
  cycles: number;
  imageRendering: 'pixelated' | 'smooth';
  aspect: 'AsIs' | '4/3' | 'Fit';
  volume: number;
  mouseCapture: boolean;
}

export interface StartOptions {
  readonly manifest: GameManifest;
  readonly executable: string;
  readonly files: readonly StoredFile[];
  readonly saves: readonly StoredFile[];
  readonly settings: RuntimeSettings;
  readonly onStatus?: (message: string) => void;
}

export interface GameSession {
  readonly game: GameId;
  pause(): void;
  resume(): void;
  setVolume(volume: number): void;
  /** Reads back save games and config written inside the emulator. */
  harvestSaves(): Promise<StoredFile[]>;
  screenshot(): Promise<Blob | null>;
  dispose(): Promise<void>;
}

export interface GameRuntime {
  readonly id: RuntimeId;
  readonly label: string;
  /** Whether this backend can run at all in this browser. */
  supported(): Promise<boolean>;
  start(host: HTMLElement, options: StartOptions): Promise<GameSession>;
}

export const DEFAULT_SETTINGS: RuntimeSettings = {
  cycles: 20000,
  imageRendering: 'pixelated',
  aspect: '4/3',
  volume: 0.6,
  mouseCapture: true,
};

/** Files worth pulling back out of the emulator when a session ends. */
export const SAVE_PATTERNS = [/^SAVEGAME\./i, /\.SAV$/i, /^CONQUER\.INI$/i, /^REDALERT\.INI$/i, /^RA\.INI$/i];

export function isSaveFile(name: string): boolean {
  return SAVE_PATTERNS.some((pattern) => pattern.test(name));
}
