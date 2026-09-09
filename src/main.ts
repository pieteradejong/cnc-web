import './style.css';
import { openStore } from './gamedata/store.ts';
import { selectRuntime } from './runtime/index.ts';
import { App } from './shell/app.ts';

async function boot(): Promise<void> {
  const root = document.querySelector<HTMLDivElement>('#app');
  if (!root) throw new Error('#app is missing from index.html');

  const engine = new URLSearchParams(location.search).get('engine');
  const [store, runtime] = await Promise.all([openStore(), selectRuntime(engine)]);
  await new App(root, store, runtime).mount();
}

boot().catch((error: unknown) => {
  const root = document.querySelector('#app');
  if (root) root.textContent = `Failed to start: ${(error as Error).message}`;
  console.error(error);
});
