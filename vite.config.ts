import { defineConfig } from 'vite';

/**
 * js-dos runs the emulator on a worker thread with SharedArrayBuffer, which the
 * browser only hands out to a cross-origin-isolated page. These headers must be
 * set by whatever serves the built app too — see README "Deploying".
 */
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

export default defineConfig({
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
  build: { target: 'es2022' },
});
