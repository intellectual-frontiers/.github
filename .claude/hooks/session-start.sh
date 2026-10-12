#!/bin/sh
# The session hook of 0025-tooling-environment FR-033, for a Claude Code cloud session: the launcher is the whole bootstrap. `./agora` fetches archon
# (workspaces-host's command runner) with uv and archon makes whatever a command names available, so nothing is installed here. All this does is
# put uv's usual folder on PATH and say so when uv is missing. Safe to run again.
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
exit 0
