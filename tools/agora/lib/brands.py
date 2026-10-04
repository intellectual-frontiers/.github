"""A brand's facts for `brand`, `ink` and `decoration`: read from its tokens.json and its files (0014-design-systems FR-028,
FR-047; frontiers-brand FR-017). Standard library only."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from agora.lib import brand_specimen, brand_theme, decoration, imagery

LOGO = "com.intellectualfrontiers.logo"


def brand_dir(root: Path, name: str) -> Path:
    return root / "design-systems" / name


def tokens_of(brand: Path) -> dict[str, Any]:
    return json.loads((brand / "tokens.json").read_text(encoding="utf-8"))


def generated(brand: Path) -> dict[Path, str]:
    """Every file `brand generate` writes for a brand: the theme files and the specimen."""
    return {**brand_theme.generate(brand), **brand_specimen.generate(brand)}


def summary(root: Path, name: str) -> dict[str, Any]:
    """A brand in one row."""
    b = brand_dir(root, name)
    t = tokens_of(b)
    kit = decoration.kit_of(t)
    inks = kit.get("inks", {})
    return {"name": name, "palette": len([k for k in t["color"] if not k.startswith("$")]), "roles": len(t["role"]),
            "lockups": len(t["$extensions"][LOGO]["lockup"]["files"]), "pieces": len(imagery.pieces(b)),
            "openedx": (b / "openedx").is_dir(), "decoration": bool(kit),
            "inks": f"{sum(1 for i in inks.values() if i.get('verified'))}/{len(inks)} verified" if inks else "none"}


def detail(root: Path, name: str) -> dict[str, Any]:
    """Everything `brand show` says about a brand."""
    b = brand_dir(root, name)
    t = tokens_of(b)
    logo = t["$extensions"][LOGO]
    roles = {k: brand_theme.resolve(t, v["$value"]) for k, v in t["role"].items()}
    files = []
    for path, text in sorted(generated(b).items()):
        files.append({"path": str(path.relative_to(root)),
                      "state": "current" if path.is_file() and path.read_text(encoding="utf-8") == text else
                      "stale" if path.is_file() else "missing"})
    return {"name": name, "path": f"design-systems/{name}",
            "description": t.get("$description", ""),
            "palette": {k: v["$value"] for k, v in t["color"].items() if not k.startswith("$")},
            "roles": roles,
            "lockup files": [{"file": f["file"], "size": f"{f['width']}x{f['height']}", "background": f.get("background", "")}
                             for f in logo["lockup"]["files"]],
            "icon files": [{"file": f["file"], "size": f"{f['width']}x{f['height']}"} for f in logo["icon"]["files"]],
            "generated": files,
            "imagery": {"pieces": len(imagery.pieces(b)), "environments": (imagery.catalog(b) or {}).get("environments", [])},
            "openedx": (b / "openedx").is_dir(),
            "decoration": {"parts": [p for p in ("lockup", "icon", "wordmark") if p in decoration.kit_of(t)],
                           "inks": sorted(decoration.kit_of(t).get("inks", {}))}}


def ink_names(root: Path, brands: list[str]) -> list[str]:
    return [f"{b}/{r}" for b in brands for r in sorted(decoration.kit_of(tokens_of(brand_dir(root, b))).get("inks", {}))]


def ink_row(role: str, entry: dict[str, Any], color: str | None) -> dict[str, Any]:
    spot, thread = entry.get("spot", {}), entry.get("thread", {})
    return {"role": role, "color": color or "", "spot": f"{spot.get('system', '')}: {spot.get('name', '')}",
            "thread": f"{thread.get('system', '')}: {thread.get('number', '')}"
                      + (f" {thread['name']}" if thread.get("name") else ""),
            "verified": bool(entry.get("verified")), "verified-by": entry.get("verified-by", ""),
            "verified-on": entry.get("verified-on", "")}
