"""The TeX Live packages the print design system loads that TinyTeX does not hold, pinned (0042-agora FR-030).

Each is one container, `<package>.tar.xz`, of TeX Live 2025's final, frozen repository (`tlnet-final`), the one TinyTeX's
own packages come from. The revision is therefore fixed, and the checksum below is the container's own: every file is
verified before it is unpacked, which `tlmgr` run against a mirror does not give (a mirror's signature can fail, and a
mirror moves on). They unpack into one tree that this entry puts on TEXMFHOME.

To add a package: find its name (`tlmgr info`, or the file the log says is missing), add its row (name, revision, SHA-256 of
the container, bytes) and its dependencies that TinyTeX lacks, and commit it alone with `agora toolchain ensure tex-packages`
passing (0041-command-line FR-068).
"""
from __future__ import annotations

import tempfile
from pathlib import Path

from agora.core.toolchain import Archive, Entry, Resolved, ToolchainError, run_program

NAME = "tex-packages"
VERSION = "2026.03"  # the TinyTeX release these packages sit beside
REPOSITORY = "https://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2025/tlnet-final/archive"

# `microtype` is here although TinyTeX holds it: the bundle's 3.2c (r78193) stops at `\begin{document}` when titletoc is
# loaded after it ("Undefined control sequence ... \MT@patch@name"), and the frozen repository's r78231 does not. TEXMFHOME
# comes before TinyTeX's own tree, so this copy is the one TeX reads.
# (package, revision, SHA-256 of <package>.tar.xz, bytes)
PACKAGES: tuple[tuple[str, int, str, int], ...] = (
    ("contour", 77677, "eba00e2e57f443fdc1fedf4c78cd1edf9a9db07132dd1aeac77ada68ac54ec01", 2668),
    ("fvextra", 78177, "dda52979465c78211c0654eb1766e39da2fc3d26b769a2f6f4e0ac80784a56eb", 16912),
    ("luacode", 77677, "63d15329afca2b7dba467abeab4399062ae8a1fa3127172cf2579f9efaa98848", 2176),
    ("marginfix", 77677, "7fa32c7db9de8b412d0090dbd2b395d0639ca5cf343aec6a425ec5594615353b", 3772),
    ("microtype", 78231, "57b380b27006b34c5cc8fe20a0ceb0e3da848f397c5607b40f2c270055197ebe", 59200),
    ("newunicodechar", 77677, "e819735ecd3bfd6711520e949a21aa59eadcb7709adb34d4dd1ccac1f3f22285", 2108),
    ("textpos", 77677, "0948cc29ff8bcea56667362073c96c8ae381c4d719ede44690885fbb24439e36", 4240),
    ("xurl", 77677, "6f5ab54b384710ed7a9c1f43cb6f4fbb8e7f8564a545ec16c565375ceb4dd95e", 1612),
)

# A container is rooted at texmf-dist; what it carries beside what TeX reads (doc, source, tlpkg) is left out.
READ = ("tex", "fonts", "bibtex", "scripts", "makeindex", "dvips", "metapost")
ARCHIVES = tuple(Archive(f"{REPOSITORY}/{name}.tar.xz", sha, "tar.xz", dest="texmf-dist", only=READ, size=size)
                 for name, _revision, sha, size in PACKAGES)
LUA_ONLY = ("luacode",)  # loaded by the check under LuaLaTeX, the others under XeLaTeX


def provides(platform: str) -> dict[str, str]:
    return {"texmf-tree": "texmf-dist"}


def env(r: Resolved, path: Path, platform: str) -> dict[str, str]:
    """TEXMFHOME, which TeX searches before its own tree. An override names a tree that holds texmf-dist or is one."""
    if r.is_overridden(NAME) and not (path / "texmf-dist").is_dir():
        return {"TEXMFHOME": str(path)}
    return {"TEXMFHOME": str(path / "texmf-dist")}


def check(r: Resolved) -> str:
    env_ = r.env()
    with tempfile.TemporaryDirectory(prefix="agora-check-") as tmp:
        work = Path(tmp)
        for engine, names in (("xelatex", [p for p, *_ in PACKAGES if p not in LUA_ONLY]), ("lualatex", list(LUA_ONLY))):
            uses = "\n".join(f"\\usepackage{{{p}}}" for p in names)
            (work / f"{engine}.tex").write_text(f"\\documentclass{{article}}\n{uses}\n\\begin{{document}}ok\\end{{document}}\n",
                                                encoding="utf-8")
            code, out = run_program([str(r.path_of(engine)), "-interaction=nonstopmode", "-halt-on-error", f"{engine}.tex"],
                                    env_, cwd=work)
            if code != 0:
                raise ToolchainError(f"{engine} could not load the pinned packages: {out[-500:]}", entries=[NAME], fetchable=False)
    return f"xelatex and lualatex loaded {len(PACKAGES)} packages"


ENTRY = Entry(NAME, VERSION, "the TeX Live 2025 packages the print design system loads that TinyTeX lacks, pinned by checksum",
              {p: ARCHIVES for p in ("linux-x86_64", "linux-aarch64", "macos-arm64", "macos-x86_64")}, provides,
              needs=("tinytex",), override_hint="a TeX tree (its texmf-dist) holding the same packages", check=check, env=env)
