#!/usr/bin/env bash
# Runs every design system's assurance harness headlessly (0014-design-systems FR-015, FR-017): each web design
# system once under every brand here (FR-039) in a browser, each print and merchandise design system under every
# brand here in Python (its run.py does the brand loop), every other design system once. Fails if any run fails or any design system has
# no harness.
#
#   tools/run_assurance.sh            everything
#   tools/run_assurance.sh --browser  only the browser harnesses (needs Node, Playwright and Chromium)
#   tools/run_assurance.sh --tex      only the Python harnesses: print (needs TeX Live with XeLaTeX, LuaLaTeX, latexmk,
#                                     poppler) and merchandise (standard library)
#   tools/run_assurance.sh --images   only each brand's imagery pool and share card (needs ImageMagick with WebP)
#
# CI runs each half in its own job (.github/workflows/design-systems.yml).
set -uo pipefail
cd "$(dirname "$0")/.."
only="${1:-}"
status=0
brands=()
for dir in design-systems/*/; do [[ -f "$dir/brand.css" ]] && brands+=("$(basename "$dir")"); done
if [[ -z "$only" || "$only" == "--images" ]]; then
  for brand in "${brands[@]}"; do
    echo "── $brand's imagery and share card"
    python3 tools/brand_imagery.py check "design-systems/$brand" || status=1
  done
  [[ "$only" == "--images" ]] && exit $status
fi
for dir in design-systems/*/; do
  slug=$(basename "$dir")
  if [[ -f "$dir/assurance/run.py" ]]; then
    [[ "$only" == "--browser" || "$only" == "--images" ]] && continue
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
