"""agora, the public root's command line (0042-agora)."""


import os as _os
import sys as _sys

# archon (workspaces-host's command runner) is importable because `archon run` puts it on PYTHONPATH; a process started with a PYTHONPATH of its own
# (a test, a worker) finds it where `archon run` said it is (ARCHON_PATH).
try:
    import archon  # noqa: F401
except ModuleNotFoundError:
    _where = _os.environ.get("ARCHON_PATH") or _os.environ.get("ARCHON_FROM")
    if _where and _where not in _sys.path:
        _sys.path.append(_where)
