#!/usr/bin/env bash
# test.sh — every check in one place, the same steps CI runs; exit 0 = green.
# `./run.sh test` runs this script.
#   ./test.sh            deps, no tracked .env, shell, prettier --check, tsc, vitest, build
#   ./test.sh --quick    skip the production build
set -euo pipefail
cd "$(dirname "$0")"
QUICK=0
for arg in "$@"; do
    case "$arg" in
        -h|--help) sed -n '2,5p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        --quick) QUICK=1 ;;
        *) echo "Unknown option: $arg (see ./test.sh --help)" >&2; exit 2 ;;
    esac
done
[ -d node_modules ] || { echo "node_modules missing: run ./init.sh first" >&2; exit 1; }

echo "== deps match package-lock.json"
npm ls --depth=0 >/dev/null

echo "== no tracked .env"
tracked="$(git ls-files | grep -E '(^|/)\.env(\..+)?$' | grep -vE '\.env\.(example|template)$' || true)"
[ -z "$tracked" ] || { echo "tracked env files:"; echo "$tracked"; exit 1; }

echo "== shell"
for f in ./*.sh; do bash -n "$f"; /bin/bash -n "$f"; done
if command -v shellcheck >/dev/null 2>&1; then shellcheck -S warning ./*.sh; else echo "   shellcheck not installed (brew install shellcheck); syntax-checked only"; fi

echo "== lint (prettier --check)"
npm run lint --silent

echo "== types (tsc --noEmit)"
npm run typecheck --silent

echo "== unit (vitest run)"
npm test --silent

if [ "$QUICK" -eq 1 ]; then
    echo "== build — skipped (--quick)"
else
    echo "== build"
    npm run build --silent
fi
echo "== all green"
