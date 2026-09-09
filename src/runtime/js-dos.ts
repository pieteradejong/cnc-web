/**
 * js-dos backend: the original DOS executables under DOSBox compiled to
 * WebAssembly.
 *
 * The player's files are injected straight into the emulator filesystem
 * (`initFs`) together with a generated dosbox.conf, so nothing is pre-packaged
 * and nothing is fetched from a third party — js-dos itself is served from
 * public/js-dos/, synced out of node_modules at build time.
 */

import type { CommandInterface, DosProps, InitFileEntry } from '../types/js-dos.ts';
import type { GameRuntime, GameSession, StartOptions } from './types.ts';
import type { GameId } from '../gamedata/manifests.ts';
import { isSaveFile } from './types.ts';
import type { StoredFile } from '../gamedata/store.ts';
import { buildDosboxConf } from './dosbox-conf.ts';

const JS_DOS_BASE = `${import.meta.env.BASE_URL}js-dos/`;

let loading: Promise<void> | null = null;

function loadJsDos(): Promise<void> {
  if (window.Dos) return Promise.resolve();
  if (loading) return loading;

  loading = new Promise<void>((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${JS_DOS_BASE}js-dos.css`;
    document.head.appendChild(css);

    const script = document.createElement('script');
    script.src = `${JS_DOS_BASE}js-dos.js`;
    script.async = true;
    script.onload = () =>
      window.Dos ? resolve() : reject(new Error('js-dos loaded but window.Dos is missing'));
    script.onerror = () =>
      reject(new Error(`Could not load ${JS_DOS_BASE}js-dos.js — run "npm run sync:js-dos"`));
    document.head.appendChild(script);
  });
  return loading;
}

class JsDosSession implements GameSession {
  readonly game: GameId;
  private ci: CommandInterface | null = null;
  private readonly dir: string;
  private readonly props: DosProps;
  private readonly container: HTMLDivElement;

  constructor(
    game: GameId,
    dir: string,
    props: DosProps,
    container: HTMLDivElement,
    ciPromise: Promise<CommandInterface>,
  ) {
    this.game = game;
    this.dir = dir;
    this.props = props;
    this.container = container;
    void ciPromise.then((ci) => (this.ci = ci)).catch(() => undefined);
  }

  pause(): void {
    this.props.setPaused(true);
  }

  resume(): void {
    this.props.setPaused(false);
  }

  setVolume(volume: number): void {
    this.props.setVolume(volume);
  }

  async harvestSaves(): Promise<StoredFile[]> {
    if (!this.ci) return [];
    const tree = await this.ci.fsTree();
    const found: StoredFile[] = [];

    // The mount root is C:; the game lives one level down in its own directory.
    const paths: string[] = [];
    collect(tree, '', paths);
    for (const path of paths) {
      const name = path.split('/').pop() ?? path;
      if (!isSaveFile(name)) continue;
      if (!path.toUpperCase().includes(this.dir.toUpperCase())) continue;
      try {
        found.push({ name, bytes: await this.ci.fsReadFile(path) });
      } catch {
        // A file listed but unreadable (still open, or a directory) is not fatal.
      }
    }
    return found;
  }

  async screenshot(): Promise<Blob | null> {
    if (!this.ci) return null;
    const image = await this.ci.screenshot();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext('2d')?.putImageData(image, 0, 0);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  async dispose(): Promise<void> {
    try {
      await this.props.stop();
    } catch {
      // stop() rejects if the emulator never finished booting; the container is removed anyway.
    }
    this.ci = null;
    this.container.remove();
  }
}

function collect(node: { name: string; nodes: unknown }, prefix: string, out: string[]): void {
  const path = prefix ? `${prefix}/${node.name}` : node.name;
  const children = (node as { nodes: { name: string; nodes: unknown }[] | null }).nodes;
  if (children === null) {
    out.push(path.replace(/^\/+/, ''));
    return;
  }
  for (const child of children) collect(child, path, out);
}

export class JsDosRuntime implements GameRuntime {
  readonly id = 'js-dos' as const;
  readonly label = 'DOSBox (WebAssembly)';

  async supported(): Promise<boolean> {
    return typeof WebAssembly !== 'undefined';
  }

  async start(host: HTMLElement, options: StartOptions): Promise<GameSession> {
    const { manifest, executable, files, saves, settings, onStatus } = options;

    onStatus?.('Loading emulator…');
    await loadJsDos();

    const initFs: InitFileEntry[] = [
      ...files.map((file) => entry(manifest.dir, file)),
      ...saves.map((file) => entry(manifest.dir, file)),
    ];

    const container = document.createElement('div');
    container.className = 'dos-container';
    host.appendChild(container);

    onStatus?.('Starting game…');
    let resolveCi: (ci: CommandInterface) => void = () => undefined;
    const ciPromise = new Promise<CommandInterface>((resolve) => (resolveCi = resolve));

    const props = window.Dos!(container, {
      dosboxConf: buildDosboxConf({
        dir: manifest.dir,
        executable,
        cycles: settings.cycles,
      }),
      initFs,
      pathPrefix: `${JS_DOS_BASE}emulators/`,
      backend: 'dosbox',
      backendLocked: true,
      workerThread: true,
      autoStart: true,
      countDownStart: 0,
      autoSave: false,
      noCloud: true,
      kiosk: true,
      thinSidebar: true,
      mouseCapture: settings.mouseCapture,
      imageRendering: settings.imageRendering,
      renderAspect: settings.aspect,
      volume: settings.volume,
      theme: 'dracula',
      onEvent: (event, arg) => {
        if (event === 'ci-ready' && arg) resolveCi(arg as CommandInterface);
      },
    });

    return new JsDosSession(manifest.id, manifest.dir, props, container, ciPromise);
  }
}

function entry(dir: string, file: StoredFile): InitFileEntry {
  return { path: `${dir}/${file.name}`, contents: file.bytes };
}
