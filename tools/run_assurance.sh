#!/usr/bin/env bash
# Runs every design system's assurance harness headlessly (0014-design-systems FR-015, FR-017): each web design
# system once under every brand here (FR-039) in a browser, each print design system under every brand here on TeX
# (its run.py does the brand loop), every other design system once. Fails if any run fails or any design system has
# no harness.
#
#   tools/run_assurance.sh            everything
#   tools/run_assurance.sh --browser  only the browser harnesses (needs Node, Playwright and Chromium)
#   tools/run_assurance.sh --tex      only the TeX harnesses (needs TeX Live with XeLaTeX, LuaLaTeX, latexmk, poppler)
#
# CI runs each half in its own job (.github/workflows/design-systems.yml).
set -uo pipefail
cd "$(dirname "$0")/.."
only="${1:-}"
status=0
brands=()
for dir in design-systems/*/; do [[ -f "$dir/brand.css" ]] && brands+=("$(basename "$dir")"); done
for dir in design-systems/*/; do
  slug=$(basename "$dir")
  if [[ -f "$dir/assurance/run.py" ]]; then
    [[ "$only" == "--browser" ]] && continue
    echo "── $slug, themed by every brand"
    python3 "$dir/assurance/run.py" || status=1
  elif [[ -f "$dir/assurance/run.mjs" ]]; then
    [[ "$only" == "--tex" ]] && continue
    if [[ -f "$dir/css/bundle.txt" ]]; then
      for brand in "${brands[@]}"; do
        echo "── $slug, themed by $brand"
        node "$dir/assurance/run.mjs" --brand "$brand" || status=1
      done
    else
      echo "── $slug"
      node "$dir/assurance/run.mjs" || status=1
    fi
  else
    echo "❎ $slug has no assurance harness, assurance/run.mjs or assurance/run.py (0014-design-systems FR-015)"
    status=1
  fi
done
exit $status
