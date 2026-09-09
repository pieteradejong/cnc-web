/**
 * Types for the js-dos v8 global.
 *
 * The npm package ships a bundle that assigns `window.Dos` and carries no
 * `exports`/`types` entry, so it is loaded as a classic script from
 * `public/js-dos/` (synced from node_modules by scripts/sync-js-dos.mjs) and
 * described here. Mirrors src/public/types.ts in caiiiycuk/js-dos 8.4.1, cut
 * down to the parts this app uses.
 */

export interface InitFileEntry {
  path: string;
  contents: Uint8Array;
}

export interface FsNode {
  name: string;
  size: number | null;
  nodes: FsNode[] | null;
}

export interface CommandInterface {
  width(): number;
  height(): number;
  screenshot(): Promise<ImageData>;
  pause(): void;
  resume(): void;
  mute(): void;
  unmute(): void;
  exit(): Promise<void>;
  fsTree(): Promise<FsNode>;
  fsReadFile(file: string): Promise<Uint8Array>;
  fsWriteFile(file: string, contents: Uint8Array): Promise<void>;
  getRunningProgram(): Promise<string>;
}

export type DosEvent = 'emu-ready' | 'ci-ready' | 'bnd-play' | 'open-key' | 'fullscreen-change';

export interface DosOptions {
  url: string;
  dosboxConf: string;
  jsdosConf: unknown;
  initFs: InitFileEntry[];
  pathPrefix: string;
  pathSuffix: string;
  theme: string;
  lang: 'en' | 'ru';
  backend: 'dosbox' | 'dosboxX';
  backendLocked: boolean;
  workerThread: boolean;
  offscreenCanvas: boolean;
  mouseCapture: boolean;
  onEvent: (event: DosEvent, arg?: CommandInterface | boolean) => void;
  autoStart: boolean;
  countDownStart: number;
  autoSave: boolean;
  kiosk: boolean;
  imageRendering: 'pixelated' | 'smooth';
  renderBackend: 'webgl' | 'canvas';
  renderAspect: 'AsIs' | '1/1' | '5/4' | '4/3' | '16/10' | '16/9' | 'Fit';
  mouseSensitivity: number;
  noCursor: boolean;
  volume: number;
  thinSidebar: boolean;
  noCloud: boolean;
}

export interface DosProps {
  getVersion(): [string, string];
  setVolume(volume: number): void;
  setPaused(paused: boolean): void;
  setFullScreen(fullScreen: boolean): void;
  setMouseCapture(capture: boolean): void;
  setImageRendering(rendering: DosOptions['imageRendering']): void;
  setRenderAspect(aspect: DosOptions['renderAspect']): void;
  save(): Promise<boolean>;
  stop(): Promise<void>;
}

declare global {
  interface Window {
    Dos?: (element: HTMLDivElement, options: Partial<DosOptions>) => DosProps;
  }
}
