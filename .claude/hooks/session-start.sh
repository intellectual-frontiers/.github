#!/bin/sh
# The bootstrap of 0025-tooling-environment FR-033, for a Claude Code cloud session: it adds ws-host to a session that has uv, and enables this
# clone as a provider, so the commands that name a toolchain entry run too. `./agora` runs without it (every command that names no toolchain
# entry needs only uv), so a bootstrap that fails (no network to GitHub, say) is reported and never stops the session. The same lines are in
# the CI workflows and in AGENTS.md. `--yes` is the committed answer of the person who wrote this file. Safe to run again.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi
export PATH="$HOME/.local/bin:$PATH"
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$CLAUDE_ENV_FILE"
fi
if ! command -v uv >/dev/null 2>&1; then
  echo "session-start: uv is not on PATH, and ./agora needs it (https://docs.astral.sh/uv/getting-started/installation/)" >&2
fi
if ! command -v ws-host >/dev/null 2>&1; then
  curl -fsSL https://raw.githubusercontent.com/intellectual-frontiers/workspaces-host/main/install.sh | WS_HOST_NO_APT=1 WS_HOST_NO_ADVANCE=1 sh ||
    echo "session-start: ws-host could not be installed; ./agora still runs every command that names no toolchain entry (./agora doctor says which)" >&2
fi
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || exit 0
if command -v ws-host >/dev/null 2>&1; then
  ws-host provider add "$PWD" --yes || echo "session-start: ws-host could not enable this clone; ./agora runs without it" >&2
fi
exit 0
