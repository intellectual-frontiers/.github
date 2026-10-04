"""A small public root holding one brand, for the brand, imagery, ink, decoration and generator tests."""
from __future__ import annotations

import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from .helpers import HOME, run_json

HAS_MAGICK = bool(shutil.which("convert") and shutil.which("identify"))


def webp_works() -> bool:
    if not HAS_MAGICK:
        return False
    with tempfile.TemporaryDirectory() as d:
        return subprocess.run(["convert", "-size", "4x4", "xc:white", str(Path(d, "t.webp"))], capture_output=True).returncode == 0


def png(path: Path, size: str = "40x30", transparent: bool = False, color: str = "white") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if HAS_MAGICK:
        args = ["convert", "-size", size, "xc:none" if transparent else f"xc:{color}"]
        if transparent:
            args += ["-fill", "#c0392b", "-draw", "rectangle 6,5 24,20"]
        subprocess.run([*args, f"png:{path}"], check=True, capture_output=True)
    else:
        path.write_bytes(b"\x89PNG\r\n\x1a\n")


def _files(o, out: list[str]) -> list[str]:
    if isinstance(o, dict):
        for k, v in o.items():
            out.append(v) if k == "file" and isinstance(v, str) else _files(v, out)
    elif isinstance(o, list):
        for v in o:
            _files(v, out)
    return out


def make_repo(root: Path, name: str = "mini-brand", openedx: bool = False) -> Path:
    """tools/agora, and design-systems/<name>: frontiers-brand's tokens without its units, wordmark or app icons, every
    file they name present, and the web fonts the Open edX package carries."""
    shutil.copytree(HOME / "tools" / "agora", root / "tools" / "agora", ignore=shutil.ignore_patterns("__pycache__", "tests"))
    b = root / "design-systems" / name
    tokens = json.loads((HOME / "design-systems" / "frontiers-brand" / "tokens.json").read_text(encoding="utf-8"))
    logo = tokens["$extensions"]["com.intellectualfrontiers.logo"]
    for k in ("units", "app-icons"):
        logo.pop(k, None)
    tokens["$extensions"]["com.intellectualfrontiers.decoration"].pop("wordmark", None)
    b.mkdir(parents=True)
    (b / "tokens.json").write_text(json.dumps(tokens, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (b / "brand.css").write_text("/* placeholder */\n", encoding="utf-8")
    for f in _files(logo, []):
        if f.endswith(".png"):
            png(b / f)
        else:
            (b / f).parent.mkdir(parents=True, exist_ok=True)
            (b / f).write_bytes(b"x")
    (b / "images").mkdir(exist_ok=True)
    (b / "images" / "favicon.ico").write_bytes(b"ico")
    if openedx:
        (b / "openedx").mkdir()
        fonts = root / "design-systems" / "frontiers-course" / "web" / "fonts"
        fonts.mkdir(parents=True)
        for f in ("inter-variable-latin.woff2", "source-serif-4-variable-latin.woff2", "LICENSES.md", "OFL-1.1.txt"):
            (fonts / f).write_text(f"{f}\n", encoding="utf-8")
    return b


def tree(root: Path) -> dict[str, bytes]:
    return {str(p.relative_to(root)): p.read_bytes() for p in sorted(root.rglob("*")) if p.is_file() and "__pycache__" not in p.parts}


FAKE_CONVERT = """#!{py}
import sys
a = sys.argv[1:]
if "pgm:-" in a:
    sys.stdout.buffer.write(b"P5\\n8 8\\n255\\n" + bytes(([0] * 4 + [255] * 4) * 8))
else:
    open(a[-1], "wb").write(b"fake")
"""
FAKE_IDENTIFY = "#!{py}\nprint('40 10')\n"
FAKE_POTRACE = """#!{py}
print('<svg version="1.0" viewBox="0 0 160 40"><metadata>m</metadata><g transform="scale(1)" fill="#000000" stroke="none"><path d="M0 0h10v10z"/></g></svg>')
"""
FAKE_RSVG = "#!{py}\nimport sys\nsys.stdout.buffer.write(b'png')\n"


class Repo(unittest.TestCase):
    """A temporary public root with one brand. `go` runs agora with it as its home."""

    openedx = False

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.brand = make_repo(self.root, openedx=self.openedx)

    def go(self, *argv: str, plan: str | None = None, env: dict[str, str] | None = None) -> tuple[int, dict]:
        """A command in this root. `plan` names the group whose locked environment the process stands in, as a worker's
        does, so that a command of a group that pins packages runs here and does not re-run itself."""
        return run_json(list(argv), home=self.root, env={**({"AGORA_PLAN_GROUP": plan} if plan else {}), **(env or {})})

    def fake_programs(self, *names: str) -> Path:
        """Stand-ins for programs the host may lack, first on PATH for the test."""
        d = self.root / "fakebin"
        d.mkdir(exist_ok=True)
        scripts = {"convert": FAKE_CONVERT, "identify": FAKE_IDENTIFY, "potrace": FAKE_POTRACE, "rsvg-convert": FAKE_RSVG}
        for n in names:
            f = d / n
            f.write_text(scripts[n].format(py=sys.executable), encoding="utf-8")
            f.chmod(f.stat().st_mode | stat.S_IEXEC)
        p = mock.patch.dict(os.environ, {"PATH": str(d)})
        p.start()
        self.addCleanup(p.stop)
        return d

    def generate(self) -> None:
        self.assertEqual(self.go("brand", "generate")[0], 0)
