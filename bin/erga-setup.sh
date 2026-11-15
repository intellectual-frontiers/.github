#!/bin/sh
# erga-setup.sh: the setup of one account alone, with no administrator rights, is now `erga-bootstrap.sh --setup` (TypeScript, erga's 009-machine-bootstrap).
# Kept so that `curl -fsSL https://raw.githubusercontent.com/intellectual-frontiers/.github/main/bin/erga-setup.sh | sh` keeps working: it runs that, with your options.
set -eu
case $0 in */erga-setup.sh | erga-setup.sh) exec sh "$(cd "$(dirname "$0")" && pwd -P)/erga-bootstrap.sh" --setup "$@" ;; esac
curl -fsSL "${BOOTSTRAP_URL:-https://raw.githubusercontent.com/intellectual-frontiers/.github/main}/bin/erga-bootstrap.sh" | sh -s -- --setup "$@"
