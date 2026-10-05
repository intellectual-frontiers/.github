"""TinyTeX, a TeX Live 2025 distribution of about 200 MB: XeLaTeX and LuaLaTeX with their formats (0042-agora FR-030).

TinyTeX's release is the address; its packages beyond what it holds are the `tex-packages` entry. There is no `latexmk`: it
is a Perl program and a host supplies only python3 and uv, so the print harness runs the engine again itself until the
cross-references settle.
"""
from __future__ import annotations

import tempfile
from pathlib import Path

from agora.core.toolchain import Archive, Entry, Resolved, ToolchainError, run_program

NAME = "tinytex"
VERSION = "2026.03"
RELEASE = f"https://github.com/rstudio/tinytex-releases/releases/download/v{VERSION}"
BIN = {"linux-x86_64": "bin/x86_64-linux", "linux-aarch64": "bin/aarch64-linux",
       "macos-arm64": "bin/universal-darwin", "macos-x86_64": "bin/universal-darwin"}
PROGRAMS = ("xelatex", "lualatex", "pdflatex", "xetex", "luatex", "kpsewhich")

LINUX = Archive(f"{RELEASE}/TinyTeX-v{VERSION}.tar.gz", "3bb654f650582508155ea2027fc0fd6b2fdc3cd7413f986a66714662cff8bdc2",
                "tar.gz", prefix=".TinyTeX", size=197200827)
MACOS = Archive(f"{RELEASE}/TinyTeX-v{VERSION}.tgz", "f08a1dab6c49d58226a058ebaa0573100f401fc7a1bb94d3b288893b3e7fe2ec",
                "tar.gz", prefix="TinyTeX", size=262986974)


def provides(platform: str) -> dict[str, str]:
    return {p: f"{BIN[platform]}/{p}" for p in PROGRAMS}


def env(r: Resolved, path: Path, platform: str) -> dict[str, str]:
    """The directory of the engines first on PATH. An override names that directory itself."""
    return {"PATH": str(path if r.is_overridden(NAME) else path / BIN[platform])}


SMOKE = r"""\documentclass{article}
\usepackage{fontspec}
\begin{document}
Self-installed TeX: Hello, world.\\
\ifdefined\directlua LuaTeX\else XeTeX\fi
\end{document}
"""


def check(r: Resolved) -> str:
    env_ = r.env()
    done = []
    with tempfile.TemporaryDirectory(prefix="agora-check-") as tmp:
        work = Path(tmp)
        (work / "smoke.tex").write_text(SMOKE, encoding="utf-8")
        for engine in ("xelatex", "lualatex"):
            code, out = run_program([str(r.path_of(engine)), "-interaction=nonstopmode", "-halt-on-error", "smoke.tex"], env_, cwd=work)
            if code != 0 or not (work / "smoke.pdf").is_file():
                raise ToolchainError(f"{engine} did not compile a document: {out[-600:]}", entries=[NAME], fetchable=False)
            (work / "smoke.pdf").unlink()
            done.append(engine)
    return f"{' and '.join(done)} compiled a document"


ENTRY = Entry(NAME, VERSION, "TinyTeX (TeX Live 2025): XeLaTeX, LuaLaTeX and their formats",
              {"linux-x86_64": (LINUX,), "macos-arm64": (MACOS,), "macos-x86_64": (MACOS,)}, provides,
              override_hint="a directory holding xelatex and lualatex", check=check, env=env)
