"""A small public root holding one brand, for the brand, imagery, ink, decoration and generator tests."""
from __future__ import annotations

import importlib.util
import json
import shutil
import tempfile
import unittest
from pathlib import Path

from agora.core.registry import Registry

from .helpers import HOME, run_json

HAS_PILLOW = importlib.util.find_spec("PIL") is not None


def webp_works() -> bool:
    if not HAS_PILLOW:
        return False
    from PIL import features
    return bool(features.check("webp"))


def png(path: Path, size: str = "40x30", transparent: bool = False, color: str = "white") -> None:
    """A PNG of `size` (WxH): a flat color, or transparent with a colored rectangle, drawn with Pillow."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if HAS_PILLOW:
        from PIL import Image, ImageDraw
        w, h = (int(v) for v in size.split("x"))
        im = Image.new("RGBA", (w, h), (0, 0, 0, 0) if transparent else color)
        if transparent:
            ImageDraw.Draw(im).rectangle((6, 5, min(24, w - 1), min(20, h - 1)), fill="#c0392b")
        im.save(path, format="PNG")
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
        does, so that a command of a group that pins packages runs here and does not re-run itself; by default it is the
        group of the command, whose packages the tests' own environment holds (the selftest group)."""
        if plan is None:
            found, _ = Registry.load(self.root).lookup(list(argv))
            plan = found.group if found is not None else None
        return run_json(list(argv), home=self.root, env={**({"AGORA_PLAN_GROUP": plan} if plan else {}), **(env or {})})

    def generate(self) -> None:
        self.assertEqual(self.go("brand", "generate")[0], 0)
