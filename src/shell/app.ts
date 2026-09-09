/**
 * The shell: pick a game, import your own copy of it, play it, keep the saves.
 *
 * Deliberately backend-agnostic — everything here talks to `GameRuntime`, so the
 * DOSBox backend and the future native-engine backend present the same app.
 */

import type { GameId, InstallCheck } from '../gamedata/manifests.ts';
import { GAME_IDS, MANIFESTS, checkInstall } from '../gamedata/manifests.ts';
import type { AssetStore } from '../gamedata/store.ts';
import { formatBytes } from '../gamedata/store.ts';
import { filesFromDataTransfer, importFiles } from '../gamedata/import.ts';
import type { GameRuntime, GameSession } from '../runtime/types.ts';
import { getSettings, saveSettings } from './settings.ts';
import { exportSaves, importSaves } from './saves.ts';
import { clear, downloadBlob, el, pickFiles } from './dom.ts';

interface GameState {
  readonly id: GameId;
  readonly files: string[];
  readonly check: InstallCheck;
  readonly saveCount: number;
  readonly bytes: number;
}

export class App {
  private states = new Map<GameId, GameState>();
  private session: GameSession | null = null;
  private readonly library = el('main', { class: 'library' });
  private readonly status = el('p', { class: 'status', role: 'status' });
  private readonly player = el('div', { class: 'player hidden' });

  private readonly root: HTMLElement;
  private readonly store: AssetStore;
  private readonly runtime: GameRuntime;

  constructor(root: HTMLElement, store: AssetStore, runtime: GameRuntime) {
    this.root = root;
    this.store = store;
    this.runtime = runtime;
  }

  async mount(): Promise<void> {
    clear(this.root);
    this.root.append(this.header(), this.status, this.library, this.player);
    this.installDropTarget();
    await this.refresh();
  }

  /* ------------------------------------------------------------- chrome */

  private header(): HTMLElement {
    return el(
      'header',
      { class: 'top' },
      el('h1', {}, 'Command & Conquer in the browser'),
      el(
        'p',
        { class: 'sub' },
        'Tiberian Dawn and Red Alert, running on ',
        el('strong', {}, this.runtime.label),
        '. Bring your own game files — they stay in this browser.',
      ),
    );
  }

  private say(message: string, tone: 'info' | 'error' = 'info'): void {
    this.status.textContent = message;
    this.status.dataset.tone = tone;
  }

  /* -------------------------------------------------------------- state */

  private async refresh(): Promise<void> {
    for (const id of GAME_IDS) {
      const files = await this.store.list(id);
      const saves = await this.store.list(id, 'saves');
      const stored = await this.store.readAll(id).catch(() => []);
      this.states.set(id, {
        id,
        files,
        check: checkInstall(MANIFESTS[id], files),
        saveCount: saves.length,
        bytes: stored.reduce((total, file) => total + file.bytes.length, 0),
      });
    }
    this.render();
  }

  private render(): void {
    clear(this.library);
    for (const id of GAME_IDS) this.library.appendChild(this.card(this.states.get(id)!));
    void this.renderUsage();
  }

  private async renderUsage(): Promise<void> {
    const { usage, quota } = await this.store.usage();
    const footer = el(
      'footer',
      { class: 'usage' },
      `Stored in this browser (${this.store.kind}): ${formatBytes(usage)}`,
      quota > 0 ? ` of about ${formatBytes(quota)} available.` : '.',
    );
    this.library.appendChild(footer);
  }

  /* --------------------------------------------------------------- card */

  private card(state: GameState): HTMLElement {
    const manifest = MANIFESTS[state.id];
    const settings = getSettings(state.id);
    const { check } = state;
    const executable = settings.executable ?? check.executable;
    const ready = check.playable && executable !== null;

    const card = el(
      'section',
      { class: `card${ready ? ' ready' : ''}`, dataset: { game: state.id } },
      el('h2', {}, manifest.title),
      el('p', { class: 'sub' }, manifest.subtitle),
    );

    if (state.files.length === 0) {
      card.appendChild(
        el(
          'p',
          { class: 'hint' },
          'No game files yet. Drop the game folder, a .zip of an install, or the CD .iso here.',
        ),
      );
    } else {
      card.appendChild(
        el(
          'p',
          { class: 'hint' },
          `${state.files.length} files, ${formatBytes(state.bytes)}` +
            (state.saveCount > 0 ? ` · ${state.saveCount} saved file(s)` : ''),
        ),
      );
      if (check.missingRequired.length > 0) {
        card.appendChild(el('p', { class: 'missing' }, `Missing: ${check.missingRequired.join(', ')}`));
      }
      if (check.missingRecommended.length > 0) {
        card.appendChild(
          el(
            'details',
            { class: 'optional' },
            el('summary', {}, `${check.missingRecommended.length} optional files not found`),
            el(
              'p',
              {},
              `${check.missingRecommended.join(', ')} — music, speech, movies and expansions live in these. ` +
                'The game runs without them.',
            ),
          ),
        );
      }
      if (check.executables.length > 1) {
        card.appendChild(this.executablePicker(state, executable));
      } else if (executable) {
        card.appendChild(el('p', { class: 'hint' }, `Runs ${executable}`));
      } else {
        card.appendChild(el('p', { class: 'missing' }, 'No executable found in the imported files.'));
      }
    }

    const actions = el('div', { class: 'actions' });
    actions.append(
      el(
        'button',
        { class: 'primary', disabled: !ready, onClick: () => void this.play(state.id) },
        ready ? 'Play' : 'Needs game files',
      ),
      el('button', { onClick: () => void this.importInto(state.id, { directory: true }) }, 'Add folder…'),
      el('button', { onClick: () => void this.importInto(state.id, {}) }, 'Add files…'),
    );
    if (state.files.length > 0) {
      actions.append(
        el('button', { onClick: () => void this.exportSaves(state.id) }, 'Export saves'),
        el('button', { onClick: () => void this.importSaves(state.id) }, 'Import saves'),
        el('button', { class: 'danger', onClick: () => void this.forget(state.id) }, 'Remove'),
      );
    }
    card.appendChild(actions);
    card.appendChild(this.settingsPanel(state.id));
    return card;
  }

  private executablePicker(state: GameState, current: string | null): HTMLElement {
    const select = el(
      'select',
      {
        onChange: (event: Event) => {
          saveSettings(state.id, { executable: (event.target as HTMLSelectElement).value });
          this.render();
        },
      },
      ...state.check.executables.map((name) =>
        el('option', { value: name, selected: name === current }, name),
      ),
    );
    return el('label', { class: 'field' }, 'Executable ', select);
  }

  private settingsPanel(game: GameId): HTMLElement {
    const settings = getSettings(game);
    const cycles = el('input', {
      type: 'range',
      min: '5000',
      max: '60000',
      step: '1000',
      value: String(settings.cycles),
      onChange: (event: Event) => {
        saveSettings(game, { cycles: Number((event.target as HTMLInputElement).value) });
        this.render();
      },
    });
    const smoothing = el('input', {
      type: 'checkbox',
      checked: settings.imageRendering === 'smooth',
      onChange: (event: Event) => {
        const smooth = (event.target as HTMLInputElement).checked;
        saveSettings(game, { imageRendering: smooth ? 'smooth' : 'pixelated' });
        this.render();
      },
    });
    return el(
      'details',
      { class: 'settings' },
      el('summary', {}, 'Settings'),
      el('label', { class: 'field' }, `CPU speed (${settings.cycles} cycles) `, cycles),
      el('label', { class: 'field' }, 'Smooth scaling ', smoothing),
    );
  }

  /* ------------------------------------------------------------- import */

  private installDropTarget(): void {
    const stop = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };
    this.root.addEventListener('dragover', (event) => {
      stop(event);
      this.root.classList.add('dragging');
    });
    this.root.addEventListener('dragleave', (event) => {
      stop(event);
      this.root.classList.remove('dragging');
    });
    this.root.addEventListener('drop', (event) => {
      stop(event);
      this.root.classList.remove('dragging');
      const card = (event.target as HTMLElement).closest?.('.card') as HTMLElement | null;
      const game = (card?.dataset.game as GameId | undefined) ?? null;
      if (!event.dataTransfer) return;
      void this.ingest(game, filesFromDataTransfer(event.dataTransfer));
    });
  }

  private async importInto(game: GameId, options: { directory?: boolean }): Promise<void> {
    await this.ingest(game, pickFiles(options));
  }

  /**
   * Files are routed to a game by which card they were dropped on; a drop on the
   * page background is matched by content instead, since the two games' file
   * sets are distinctive enough to tell apart.
   */
  private async ingest(game: GameId | null, pending: Promise<File[]>): Promise<void> {
    try {
      const input = await pending;
      if (input.length === 0) return;
      this.say(`Reading ${input.length} file(s)…`);

      const result = await importFiles(input, (name) => this.say(`Reading ${name}…`));
      if (result.files.length === 0) {
        this.say('Nothing usable in there — expected .MIX files and the game executable.', 'error');
        return;
      }

      const target = game ?? guessGame(result.files.map((file) => file.name));
      if (!target) {
        this.say('Could not tell which game these files are for — use the Add buttons on a card.', 'error');
        return;
      }

      await this.store.write(target, result.files, 'game', (done, total) =>
        this.say(`Storing ${done}/${total} files…`),
      );
      await this.refresh();

      const check = this.states.get(target)!.check;
      this.say(
        check.playable
          ? `${MANIFESTS[target].title} is ready to play (${result.files.length} files imported).`
          : `Imported ${result.files.length} files, but ${MANIFESTS[target].title} still needs: ${check.missingRequired.join(', ')}.`,
        check.playable ? 'info' : 'error',
      );
    } catch (error) {
      this.say(`Import failed: ${(error as Error).message}`, 'error');
    }
  }

  /* -------------------------------------------------------------- saves */

  private async exportSaves(game: GameId): Promise<void> {
    const blob = await exportSaves(this.store, game);
    if (!blob) {
      this.say('No saves stored yet — they are collected when you leave a game.', 'error');
      return;
    }
    downloadBlob(blob, `${game}-saves.zip`);
    this.say('Saves exported.');
  }

  private async importSaves(game: GameId): Promise<void> {
    const [file] = await pickFiles({ accept: '.zip' });
    if (!file) return;
    const count = await importSaves(this.store, game, file);
    await this.refresh();
    this.say(
      count > 0 ? `Imported ${count} save file(s).` : 'That zip held no save games.',
      count > 0 ? 'info' : 'error',
    );
  }

  private async forget(game: GameId): Promise<void> {
    const title = MANIFESTS[game].title;
    if (!confirm(`Remove all stored ${title} files from this browser? Saves are deleted too.`)) return;
    await this.store.clear(game);
    await this.refresh();
    this.say(`${title} data removed.`);
  }

  /* --------------------------------------------------------------- play */

  private async play(game: GameId): Promise<void> {
    const state = this.states.get(game)!;
    const settings = getSettings(game);
    const executable = settings.executable ?? state.check.executable;
    if (!executable) return;

    this.player.classList.remove('hidden');
    clear(this.player);
    const stage = el('div', { class: 'stage' });
    const bar = el('div', { class: 'playbar' });
    this.player.append(bar, stage);
    document.body.classList.add('playing');

    const banner = el('span', { class: 'playing-label' }, `${MANIFESTS[game].title} — starting…`);
    bar.append(
      el('button', { onClick: () => void this.stop() }, 'Save & exit'),
      el('button', { onClick: () => void this.snapshot() }, 'Screenshot'),
      banner,
    );

    try {
      const [files, saves] = await Promise.all([this.store.readAll(game), this.store.readAll(game, 'saves')]);
      this.session = await this.runtime.start(stage, {
        manifest: MANIFESTS[game],
        executable,
        files,
        saves,
        settings,
        onStatus: (message) => (banner.textContent = `${MANIFESTS[game].title} — ${message}`),
      });
      banner.textContent = MANIFESTS[game].title;
    } catch (error) {
      this.say(`Could not start: ${(error as Error).message}`, 'error');
      await this.stop();
    }
  }

  private async snapshot(): Promise<void> {
    const blob = await this.session?.screenshot();
    if (blob) downloadBlob(blob, `cnc-${Date.now()}.png`);
  }

  private async stop(): Promise<void> {
    const session = this.session;
    this.session = null;

    if (session) {
      try {
        const saves = await session.harvestSaves();
        if (saves.length > 0) {
          await this.store.write(session.game, saves, 'saves');
          this.say(`Kept ${saves.length} save file(s) from that session.`);
        }
      } catch (error) {
        this.say(`Could not read saves back: ${(error as Error).message}`, 'error');
      }
      await session.dispose();
    }

    document.body.classList.remove('playing');
    this.player.classList.add('hidden');
    clear(this.player);
    await this.refresh();
  }
}

/** Red Alert ships REDALERT.MIX; Tiberian Dawn ships the theater mixes. */
function guessGame(names: string[]): GameId | null {
  const present = new Set(names);
  if (present.has('REDALERT.MIX') || present.has('EXPAND.MIX') || present.has('RUSSIAN.MIX')) return 'ra';
  if (present.has('DESERT.MIX') || present.has('CCLOCAL.MIX') || present.has('UPDATEC.MIX')) return 'td';
  return null;
}
