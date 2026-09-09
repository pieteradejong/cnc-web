import { describe, expect, it } from 'vitest';
import { MANIFESTS, checkInstall, isGameFile, normalizeName } from './manifests.ts';

const TD_MINIMUM = ['CONQUER.MIX', 'GENERAL.MIX', 'SOUNDS.MIX', 'LOCAL.MIX', 'C&C.EXE'];

describe('normalizeName', () => {
  it('reduces a path to an upper-case base name', () => {
    expect(normalizeName('Install/CnC/conquer.mix')).toBe('CONQUER.MIX');
    expect(normalizeName('CNC\\LOCAL.MIX')).toBe('LOCAL.MIX');
  });
});

describe('checkInstall', () => {
  it('accepts a minimal Tiberian Dawn install regardless of case', () => {
    const check = checkInstall(
      MANIFESTS.td,
      TD_MINIMUM.map((name) => name.toLowerCase()),
    );
    expect(check.playable).toBe(true);
    expect(check.executable).toBe('C&C.EXE');
    expect(check.missingRequired).toEqual([]);
  });

  it('reports required files that are absent', () => {
    const check = checkInstall(MANIFESTS.td, ['CONQUER.MIX', 'C&C.EXE']);
    expect(check.playable).toBe(false);
    expect(check.missingRequired).toContain('GENERAL.MIX');
    expect(check.missingRequired).toContain('LOCAL.MIX or CCLOCAL.MIX');
  });

  it('treats either member of an any-of group as satisfying it', () => {
    const withCclocal = TD_MINIMUM.map((name) => (name === 'LOCAL.MIX' ? 'CCLOCAL.MIX' : name));
    expect(checkInstall(MANIFESTS.td, withCclocal).missingRequired).toEqual([]);
  });

  it('is not playable without an executable, even with every data file', () => {
    const check = checkInstall(MANIFESTS.td, [...MANIFESTS.td.recommended, ...TD_MINIMUM.slice(0, 4)]);
    expect(check.playable).toBe(false);
    expect(check.executable).toBeNull();
  });

  it('lists missing optional files as recommendations, not blockers', () => {
    const check = checkInstall(MANIFESTS.td, TD_MINIMUM);
    expect(check.playable).toBe(true);
    expect(check.missingRecommended).toContain('SPEECH.MIX');
  });

  it('prefers a known executable over an unrelated one', () => {
    const check = checkInstall(MANIFESTS.ra, ['MAIN.MIX', 'LOCAL.MIX', 'SOUNDS.MIX', 'SETUP.EXE', 'RA.EXE']);
    expect(check.executable).toBe('RA.EXE');
    expect(check.executables).toEqual(['RA.EXE', 'SETUP.EXE']);
  });

  it('falls back to the only executable present when none is recognised', () => {
    const check = checkInstall(MANIFESTS.ra, ['REDALERT.MIX', 'LOCAL.MIX', 'SOUNDS.MIX', 'GAME.EXE']);
    expect(check.executable).toBe('GAME.EXE');
    expect(check.playable).toBe(true);
  });
});

describe('isGameFile', () => {
  it('keeps game data and executables', () => {
    for (const name of ['CONQUER.MIX', 'C&C.EXE', 'CONQUER.INI', 'SAVEGAME.001', 'INSTALL.BAT']) {
      expect(isGameFile(name), name).toBe(true);
    }
  });

  it('drops documentation and OS cruft', () => {
    for (const name of ['README.TXT', '.DS_Store', 'manual.pdf', 'cover.jpg', 'NOEXTENSION']) {
      expect(isGameFile(name), name).toBe(false);
    }
  });
});
