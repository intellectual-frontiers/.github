#!/usr/bin/env bash
# Runs every design system's assurance harness headlessly (0014-design-systems FR-015, FR-017): each web design
# system once under every brand here (FR-039), every other design system once. Fails if any run fails or any
# design system has no harness. Needs Node and Playwright with Chromium; CI installs both
# (.github/workflows/design-systems.yml).
set -uo pipefail
cd "$(dirname "$0")/.."
status=0
brands=()
for dir in design-systems/*/; do [[ -f "$dir/brand.css" ]] && brands+=("$(basename "$dir")"); done
for dir in design-systems/*/; do
  slug=$(basename "$dir")
  if [[ ! -f "$dir/assurance/run.mjs" ]]; then
    echo "❎ $slug has no assurance/run.mjs (0014-design-systems FR-015)"
    status=1
    continue
  fi
  if [[ -f "$dir/css/bundle.txt" ]]; then
    for brand in "${brands[@]}"; do
      echo "── $slug, themed by $brand"
      node "$dir/assurance/run.mjs" --brand "$brand" "$@" || status=1
    done
  else
    echo "── $slug"
    node "$dir/assurance/run.mjs" "$@" || status=1
  fi
done
exit $status
