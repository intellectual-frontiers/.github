"""The look of a UI: a design system's stylesheets and script, themed by a brand (0042-agora FR-019).

Which design system and which brand a UI uses is declared in its manifest (`[uis.<name>]`), not written here. The files
are served from the design systems' own directories, never copied (0014-design-systems FR-005), under `/ds/`.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any

LOGO = "com.intellectualfrontiers.logo"
ASSETS = Path(__file__).resolve().parents[2]  # tools/agora
DATASTAR = ASSETS / "vendor" / "datastar.js"
APP_CSS = Path(__file__).resolve().parent / "agora.css"


def declared(registry: Any) -> dict[str, dict[str, Any]]:
    """The UIs the groups' manifests declare (0041 FR-025): name -> its table."""
    out: dict[str, dict[str, Any]] = {}
    for g in registry.groups.values():
        out.update(g.manifest.get("uis", {}))
    return out


@dataclass
class Theme:
    home: Path
    system: str  # the design system whose markup and style the UI uses
    brand: str  # the brand that themes it

    @property
    def root(self) -> Path:
        return self.home / "design-systems"

    def stylesheets(self) -> list[str]:
        """The brand's theme first, then the design system's stylesheets in the order css/bundle.txt gives."""
        bundle = self.root / self.system / "css" / "bundle.txt"
        names = ([l.strip() for l in bundle.read_text(encoding="utf-8").splitlines() if l.strip() and not l.startswith("#")]
                 if bundle.is_file() else [])
        return [f"/ds/{self.brand}/brand.css", *(f"/ds/{self.system}/css/{n}" for n in names), "/static/agora.css"]

    @property
    def script(self) -> str:
        return f"/ds/{self.system}/js/console.js"

    def allows(self, rel: str) -> bool:
        """What of the two design systems a UI serves: the system's css, js and fonts, and the brand's theme and logos."""
        p = PurePosixPath(rel)
        if len(p.parts) < 2:
            return False
        slug, rest = p.parts[0], p.parts[1:]
        if slug == self.system:
            return rest[0] in ("css", "js", "fonts")
        if slug == self.brand:
            return rest == ("brand.css",) or rest[0] in ("logos", "images")
        return False

    def brand_assets(self) -> dict[str, Any]:
        """The brand's logo and favicon, as its tokens.json lists them."""
        try:
            t = json.loads((self.root / self.brand / "tokens.json").read_text(encoding="utf-8"))
            logo = t["$extensions"][LOGO]
            lock = sorted((f for f in logo["lockup"]["files"] if f.get("background") == "light"), key=lambda f: abs(f["width"] - 150))[0]
            return {"logo": f"/ds/{self.brand}/{lock['file']}", "width": lock["width"], "height": lock["height"],
                    "favicon": f"/ds/{self.brand}/{logo['favicon']['file']}"}
        except (OSError, KeyError, IndexError, ValueError):
            return {}
