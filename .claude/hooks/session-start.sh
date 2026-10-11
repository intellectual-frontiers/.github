#!/bin/sh
# The bootstrap of 0025-tooling-environment FR-033, for a Claude Code cloud session: it installs ws-host and enables this clone as a
# provider, so `./agora` runs. The same lines are in the CI workflows and in AGENTS.md. `--yes` is the committed answer of the person
# who wrote this file. Safe to run again.
set -eu
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi
curl -fsSL https://raw.githubusercontent.com/intellectual-frontiers/workspaces-host/main/install.sh | WS_HOST_NO_APT=1 WS_HOST_NO_ADVANCE=1 sh
export PATH="$HOME/.local/bin:$PATH"
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$CLAUDE_ENV_FILE"
fi
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"
ws-host provider add "$PWD" --yes
