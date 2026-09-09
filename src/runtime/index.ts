import type { GameRuntime, RuntimeId } from './types.ts';
import { JsDosRuntime } from './js-dos.ts';
import { VanillaConquerRuntime } from './vanilla-conquer.ts';

const RUNTIMES: GameRuntime[] = [new JsDosRuntime(), new VanillaConquerRuntime()];

export function listRuntimes(): readonly GameRuntime[] {
  return RUNTIMES;
}

/** `?engine=` picks a backend; the default is the first supported one. */
export async function selectRuntime(requested?: string | null): Promise<GameRuntime> {
  if (requested) {
    const match = RUNTIMES.find((runtime) => runtime.id === (requested as RuntimeId));
    if (match) return match;
  }
  for (const runtime of RUNTIMES) {
    if (await runtime.supported()) return runtime;
  }
  throw new Error('No game runtime is supported in this browser');
}
