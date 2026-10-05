"""Node, from the `nodejs-wheel-binaries` package (0042-agora FR-030; 0025-tooling-environment FR-007).

The browser harnesses, the course's script tests and Paragon's CLI run on the Node the locked package carries, never on a
Node that happens to be on the host's PATH, so that what they print does not depend on the machine. A person may name a
Node of their own with AGORA_NODE (0025-tooling-environment FR-019); a command that runs with it says so, and `doctor`
lists it. Standard library only: the package is found, not imported.
"""
from __future__ import annotations

import importlib.util
import os
from pathlib import Path

OVERRIDE = "AGORA_NODE"
PACKAGE = "nodejs-wheel-binaries"


def override(env: dict[str, str] | None = None) -> str | None:
    """The host's node the person named, or None."""
    value = (os.environ if env is None else env).get(OVERRIDE)
    return str(Path(value).expanduser()) if value else None


def wheel_node() -> str | None:
    """The node the locked package carries, or None where this interpreter does not hold the package."""
    spec = importlib.util.find_spec("nodejs_wheel")
    if spec is None or not spec.submodule_search_locations:
        return None
    for base in spec.submodule_search_locations:
        for name in ("node.exe", "node"):
            found = Path(base) / "bin" / name
            if found.is_file():
                return str(found)
        found = Path(base) / "node.exe"
        if found.is_file():
            return str(found)
    return None


def node_path(env: dict[str, str] | None = None) -> str | None:
    """The node a command runs: the person's override if they set one, else the locked package's."""
    own = override(env)
    return own if own and Path(own).is_file() else None if own else wheel_node()


def with_node(env: dict[str, str]) -> dict[str, str]:
    """`env` with the directory of node (and the npm and npx beside it) first on PATH, so a script whose shebang is
    `#!/usr/bin/env node`, such as Paragon's CLI, finds this node and not the host's."""
    node = node_path(env)
    if node is None:
        return dict(env)
    here = str(Path(node).parent)
    return {**env, "PATH": here + os.pathsep + env.get("PATH", "")}


def npm_argv(*args: str, env: dict[str, str] | None = None) -> list[str] | None:
    """The command line that runs npm on this node. The package's own `bin/npm` and `bin/npx` are symbolic links in its
    wheel, which uv unpacks as copies that cannot find their library, so npm is started as `node npm-cli.js`."""
    here = node_path(env)
    if here is None:
        return None
    cli = Path(here).parent.parent / "lib" / "node_modules" / "npm" / "bin" / "npm-cli.js"
    return [here, str(cli), *args] if cli.is_file() else None


def locate(home: Path, env: dict[str, str] | None = None, *, offline: bool = False) -> str:
    """The node a core command that holds no package runs, as `toolchain ensure` does to install the npm tree: the person's
    override, the package's own where this interpreter has it, else the package's in the locked environment of the group
    that pins it (created by uv from the committed lock, as for any command that needs it). Raises a ToolchainError."""
    import subprocess

    from agora.core import plan
    from agora.core.registry import Registry
    from agora.core.toolchain import ToolchainError

    env = dict(os.environ if env is None else env)
    found = node_path(env)
    if found:
        return found
    if override(env):
        raise ToolchainError(f"{OVERRIDE} names {override(env)}, which is not a file", fetchable=False)
    reg = Registry.load(home)
    group = next((g.name for g in reg.groups.values() if PACKAGE in {p.lower() for p in g.packages}), None)
    if group is None:
        raise ToolchainError(f"no group of this command line pins {PACKAGE}, the package that supplies node", fetchable=False)
    py = plan.prepare(reg, group, offline=offline, command="toolchain ensure")
    done = subprocess.run([str(py), "-c", "from agora.lib import node; print(node.wheel_node() or '')"], capture_output=True,
                          text=True, env={**env, "PYTHONPATH": str(home / "tools"), "PYTHONDONTWRITEBYTECODE": "1"})
    path = done.stdout.strip()
    if done.returncode != 0 or not path:
        raise ToolchainError(f"the locked environment of group {group} holds no node: {done.stderr.strip()[-300:]}", fetchable=False)
    return path
