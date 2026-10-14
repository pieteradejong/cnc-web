#!/usr/bin/env bash
# run.sh — the project's entry points. Run ./init.sh once first.
#   ./run.sh [dev]       Vite dev server on http://localhost:5173 (default)
#   ./run.sh build       production build to dist/
#   ./run.sh preview     serve the production build
#   ./run.sh lint        prettier --check
#   ./run.sh format      prettier --write
#   ./run.sh type-check  tsc --noEmit
#   ./run.sh test [...]  every check (./test.sh)
set -euo pipefail
cd "$(dirname "$0")"
cmd="${1:-dev}"
[ $# -gt 0 ] && shift
case "$cmd" in
    -h|--help|help) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    test) exec ./test.sh "$@" ;;
    type-check) cmd=typecheck ;;
    dev|build|preview|lint|format) ;;
    *) echo "Unknown command: $cmd (see ./run.sh --help)" >&2; exit 2 ;;
esac
[ -d node_modules ] || { echo "node_modules missing: run ./init.sh first" >&2; exit 1; }
exec npm run "$cmd" --silent -- "$@"
