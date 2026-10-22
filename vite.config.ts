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

/**
 * Stamps the commit Vercel built into the page, so the CI `live` job can prove
 * production serves the deployed commit (dotfiles docs/deploy-pipeline.md).
 * Empty outside Vercel.
 */
const buildCommit = {
  name: 'build-commit',
  transformIndexHtml: (html: string) =>
    html.replace(
      '</head>',
      `  <meta name="build-commit" content="${process.env.VERCEL_GIT_COMMIT_SHA ?? ''}" />\n  </head>`,
    ),
};

export default defineConfig({
  plugins: [buildCommit],
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
  build: { target: 'es2022' },
});
