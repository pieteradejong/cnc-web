/**
 * Placeholder for the phase-4 backend: Vanilla Conquer (the GPL Tiberian Dawn /
 * Red Alert source, SDL2 + OpenAL) compiled to WebAssembly with Emscripten.
 *
 * It exists now so the seam is exercised by two implementations rather than
 * one — the shell already routes through `?engine=vanilla-conquer` and reports
 * this backend as unsupported instead of special-casing js-dos anywhere.
 */

import type { GameRuntime, GameSession, StartOptions } from './types.ts';

export class VanillaConquerRuntime implements GameRuntime {
  readonly id = 'vanilla-conquer' as const;
  readonly label = 'Vanilla Conquer (native engine, not built yet)';

  async supported(): Promise<boolean> {
    return false;
  }

  async start(_host: HTMLElement, _options: StartOptions): Promise<GameSession> {
    throw new Error('The Vanilla Conquer WebAssembly engine is not built yet — see phase 4 of the plan.');
  }
}
