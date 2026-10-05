"""The TeX Live packages the print design system loads that TinyTeX does not hold, pinned (0042-agora FR-030).

Each is one `tex-<package>` entry: one container of TeX Live 2025's final, frozen repository (`tlnet-final`), whose checksum `ws-host` verifies before it
unpacks anything; each entry sets TEXMFHOME to its own tree and `ws-host` joins them. `microtype` is among them although TinyTeX holds it: the bundle's
3.2c stops at `\\begin{document}` when titletoc is loaded after it, and the frozen repository's r78231 does not. TEXMFHOME comes before TinyTeX's own tree,
so this copy is the one TeX reads.

To add a package: find its name (`tlmgr info`, or the file the log says is missing), add `.workspaces-host/toolchain.d/tex-<name>.toml` with the
SHA-256 of the container, run `ws-host toolchain generate agora`, and commit it alone with `agora check toolchain --functional` passing.
"""
from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

from agora.core.toolchain import Resolved, ToolchainError, run_program

NAME = "tex-packages"
LUA_ONLY = ("luacode",)  # loaded by the check under LuaLaTeX, the others under XeLaTeX


def check(r: Resolved) -> str:
    env_ = r.env()
    packages = sorted(n.removeprefix("tex-") for n in r.dirs if n.startswith("tex-"))
    with tempfile.TemporaryDirectory(prefix="agora-check-") as tmp:
        work = Path(tmp)
        for engine, names in (("xelatex", [p for p in packages if p not in LUA_ONLY]), ("lualatex", [p for p in packages if p in LUA_ONLY])):
            uses = "\n".join(f"\\usepackage{{{p}}}" for p in names)
            (work / f"{engine}.tex").write_text(f"\\documentclass{{article}}\n{uses}\n\\begin{{document}}ok\\end{{document}}\n", encoding="utf-8")
            exe = shutil.which(engine, path=env_["PATH"])
            code, out = run_program([exe or engine, "-interaction=nonstopmode", "-halt-on-error", f"{engine}.tex"], env_, cwd=work)
            if code != 0:
                raise ToolchainError(f"{engine} could not load the pinned packages: {out[-500:]}", entries=[NAME], fetchable=False)
    return f"xelatex and lualatex loaded {len(packages)} packages"
