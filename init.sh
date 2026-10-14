#!/usr/bin/env bash
# init.sh — everything needed to work on cnc-web; exit 0 = ready. Idempotent.
# npm ci is the one network step; its postinstall copies the js-dos runtime from
# node_modules into public/js-dos/ (scripts/sync-js-dos.mjs), no further download.
#   ./init.sh            npm ci (reuses node_modules/ when present)
#   ./init.sh --clean    remove node_modules/ and public/js-dos/ first
set -euo pipefail
cd "$(dirname "$0")"
case "${1:-}" in
    -h|--help) sed -n '2,6p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    --clean) rm -rf node_modules public/js-dos ;;
    '') ;;
    *) echo "Unknown option: $1 (see ./init.sh --help)" >&2; exit 2 ;;
esac
command -v node >/dev/null 2>&1 || { echo "node is required (nvm install 22)" >&2; exit 1; }
echo "== node $(node -v)"
if [ -d node_modules ]; then
    echo "== node_modules present, reusing (./init.sh --clean to rebuild)"
    [ -f public/js-dos/js-dos.js ] || { echo "== sync js-dos runtime"; node scripts/sync-js-dos.mjs; }
else
    echo "== npm ci"
    npm ci --no-fund --no-audit
fi
echo "ready: ./run.sh (vite dev) · ./test.sh"
