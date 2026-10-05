"""TinyTeX, a TeX Live 2025 distribution of about 200 MB: XeLaTeX and LuaLaTeX with their formats (0042-agora FR-030).

There is no `latexmk`: it is a Perl program, and the print harness runs the engine again itself until the cross-references settle.
"""
from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

from agora.core.toolchain import Resolved, ToolchainError, run_program

NAME = "tinytex"
PROGRAMS = ("xelatex", "lualatex", "pdflatex", "xetex", "luatex", "kpsewhich")
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
            exe = shutil.which(engine, path=env_["PATH"])
            code, out = run_program([exe or engine, "-interaction=nonstopmode", "-halt-on-error", "smoke.tex"], env_, cwd=work)
            if code != 0 or not (work / "smoke.pdf").is_file():
                raise ToolchainError(f"{engine} did not compile a document: {out[-600:]}", entries=[NAME], fetchable=False)
            (work / "smoke.pdf").unlink()
            done.append(engine)
    return f"{' and '.join(done)} compiled a document"
