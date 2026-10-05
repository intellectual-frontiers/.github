"""Node, an entry of agora's toolchain (`node`, installed by `ws-host`; 0042-agora FR-030).

The browser harnesses, the course's script tests and Paragon's CLI run on the Node the `node` entry pins, never on a Node that happens to be on the host's
PATH, so that what they print does not depend on the machine: a command that needs it names `node` among its toolchain entries, and the environment it runs
the harness in carries that Node first on PATH. Standard library only.
"""
from __future__ import annotations

import os
import shutil


def node_path(env: dict[str, str] | None = None) -> str | None:
    """The node first on the given environment's PATH, or None."""
    return shutil.which("node", path=(os.environ if env is None else env).get("PATH"))
