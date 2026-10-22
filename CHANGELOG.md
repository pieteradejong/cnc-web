# Changelog

Behaviour-relevant changes, newest first, in [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
shape. History before this file: `git log`.

## [Unreleased]

### Added

- Deployed on Vercel (project `cnc-web-padj`) through the workspace deploy pipeline: a push to `main`
  deploys production once `tests` and `security` pass, previews need a Vercel login, and the CI
  `live` job checks that production serves the deployed commit (DECISIONS #6).
- `security.yml` calls the shared security workflow (gitleaks over full history plus the commit
  gate). It replaces the gitleaks-only job in `ci.yml`.
- Pages carry `<meta name="build-commit">` with the commit Vercel built.

### Changed
- `NOTICE` names the copyright holder and carries the GPL notice; `LICENSE` stays the verbatim GPL-3.0 text (dotfiles D43).

- CI: actions pinned by commit SHA, Node from the new `.nvmrc` (22), `npm ci --ignore-scripts`,
  and the job runs `./test.sh` under the name `tests`.

### Security

- `vite` 8.2.2 → 8.3.5 and `vitest` 5.0.0 → 5.0.5, clearing the high-severity Vite dev-server
  advisories and the moderate `@vitest/mocker` and high `source-map-js` ones (`npm audit`: 0).
