"""A brand's imagery pool and share card: build, check and measure (0014-design-systems FR-037, FR-043).

`build` writes each piece's WebP files for the web (the widths imagery/catalog.json lists under "web"),
images/share-card.png (the brand's lockup centered on its surface, 1200x630), and the app icons tokens.json lists
with images/favicon.ico (the icon-only mark on the surface, never enlarged). `check` returns every problem: an
incomplete catalog entry, a master absent or not at pixel_size with real transparency and the content_box it
states, WebP files absent or off size, a master not catalogued, a share card absent or not 1200x630. `measure`
reports a candidate piece's pixel_size and content_box for the catalog, whether it has real transparency, and
how much of the drawn art carries color.

Standard library and ImageMagick (`convert`, `identify`) only.
"""
from __future__ import annotations

import colorsys
import json
import subprocess
from pathlib import Path

REQUIRED = ["id", "name", "file", "environment", "description", "visual_anchor", "route", "built_structures",
            "infrastructure_type", "colored_elements", "water", "metaphors", "suggested_subjects", "source",
            "pixel_size", "content_box", "web"]
SHARE_CARD = ("images/share-card.png", 1200, 630)
# A pixel counts as colored when its saturation and value are above these (0-1): engraved grayscale land
# stays under them, painted structures and water go over.
SATURATION_MIN, VALUE_MIN = 60 / 255, 40 / 255


def magick(*args: str) -> bytes:
    return subprocess.run(["convert", *args], check=True, capture_output=True).stdout


def size(path: Path) -> list[int]:
    out = subprocess.run(["identify", "-format", "%w %h", str(path)], check=True, capture_output=True, text=True).stdout
    return [int(v) for v in out.split()]


def measure(path: Path) -> dict:
    w, h = size(path)
    trim = magick(str(path), "-alpha", "extract", "-threshold", "6.3%", "-format", "%@", "info:").decode()
    tw, rest = trim.split("x")
    th, x, y = (int(v) for v in rest.split("+"))
    alpha_min = float(magick(str(path), "-alpha", "extract", "-format", "%[fx:minima]", "info:").decode())
    raw = magick(str(path), "-resize", "25%", "-alpha", "on", "rgba:-")
    drawn = colored = 0
    for i in range(0, len(raw), 4):
        r, g, b, a = raw[i:i + 4]
        if a <= 16:
            continue
        drawn += 1
        _, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        colored += s > SATURATION_MIN and v > VALUE_MIN
    return {"pixel_size": [w, h], "content_box": [x, y, x + int(tw), y + th], "transparent": alpha_min < 16 / 255,
            "colored_share": colored / drawn if drawn else 0.0}


def catalog(brand: Path) -> dict | None:
    path = brand / "imagery" / "catalog.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def lockup(brand: Path, background: str) -> Path:
    tokens = json.loads((brand / "tokens.json").read_text(encoding="utf-8"))
    files = tokens["$extensions"]["com.intellectualfrontiers.logo"]["lockup"]["files"]
    widest = max((f for f in files if f["background"] == background and f["file"].endswith(".png")), key=lambda f: f["width"])
    return brand / widest["file"]


def surface(brand: Path) -> str:
    tokens = json.loads((brand / "tokens.json").read_text(encoding="utf-8"))
    value = tokens["role"]["surface"]["$value"]
    while value.startswith("{"):
        group, name = value[1:-1].split(".", 1)
        value = tokens[group][name]["$value"]
    return value


def luminance(hex_color: str) -> float:
    c = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    c = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def icon_master(brand: Path) -> Path:
    tokens = json.loads((brand / "tokens.json").read_text(encoding="utf-8"))
    files = tokens["$extensions"]["com.intellectualfrontiers.logo"]["icon"]["files"]
    return brand / max(files, key=lambda f: f["width"])["file"]


def app_icons(brand: Path) -> list[dict]:
    tokens = json.loads((brand / "tokens.json").read_text(encoding="utf-8"))
    return tokens["$extensions"]["com.intellectualfrontiers.logo"].get("app-icons", {}).get("files", [])


def build_icons(brand: Path) -> int:
    """Each app icon (frontiers-brand FR-018): the icon-only mark centered on the brand's surface, inside the share of
    the canvas its purpose keeps clear (a maskable icon's mark fits the 80% circle a platform may crop it to), never
    enlarged past its master; and favicon.ico at 16, 32 and 48px."""
    master = icon_master(brand)
    mw, mh = size(master)
    bg = surface(brand)
    for icon in app_icons(brand):
        w, h = icon["width"], icon["height"]
        if icon["purpose"] == "maskable":
            fit = 0.8 * min(w, h) / (mw ** 2 + mh ** 2) ** 0.5
        else:
            fit = 0.86 * min(w / mw, h / mh)
        scale = min(fit, 1.0)
        out = brand / icon["file"]
        out.parent.mkdir(parents=True, exist_ok=True)
        magick("-size", f"{w}x{h}", f"xc:{bg}", "(", str(master), "-resize", f"{round(mw * scale)}x{round(mh * scale)}!", ")",
               "-gravity", "center", "-composite", "-strip", str(out))
    ico = brand / "images" / "favicon.ico"
    magick(str(master), "-background", "none", "-resize", "48x48", "-gravity", "center", "-extent", "48x48",
           "-define", "icon:auto-resize=48,32,16", str(ico))
    return len(app_icons(brand)) + 1


def build(brand: Path) -> dict:
    cat = catalog(brand)
    for piece in (cat or {}).get("pieces", []):
        master = brand / "imagery" / piece["file"]
        for web in piece["web"]:
            out = brand / "imagery" / web["file"]
            out.parent.mkdir(parents=True, exist_ok=True)
            magick(str(master), "-resize", f'{web["width"]}x{web["height"]}!', "-quality", "82",
                   "-define", "webp:alpha-quality=90", "-define", "webp:method=6", str(out))
    bg = surface(brand)
    logo = lockup(brand, "light" if luminance(bg) > 0.5 else "dark")
    path, w, h = SHARE_CARD
    (brand / path).parent.mkdir(parents=True, exist_ok=True)
    magick("-size", f"{w}x{h}", f"xc:{bg}", "(", str(logo), "-resize", f"{w * 46 // 100}x", ")",
           "-gravity", "center", "-composite", "-strip", str(brand / path))
    icons = build_icons(brand) if app_icons(brand) else 0
    return {"webp": sum(len(p["web"]) for p in (cat or {}).get("pieces", [])), "share_card": path, "app_icons": icons}


def check(brand: Path) -> list[str]:
    problems = []
    path, w, h = SHARE_CARD
    if not (brand / path).exists():
        problems.append(f"{path}: missing (run `agora imagery build {brand.name}`)")
    elif size(brand / path) != [w, h]:
        problems.append(f"{path}: {size(brand / path)}, not [{w}, {h}]")
    for icon in app_icons(brand):
        f = brand / icon["file"]
        if not f.is_file():
            problems.append(f"{icon['file']}: missing (run `agora imagery build {brand.name}`)")
        elif size(f) != [icon["width"], icon["height"]]:
            problems.append(f"{icon['file']}: {size(f)}, not [{icon['width']}, {icon['height']}]")
    if app_icons(brand) and not (brand / "images" / "favicon.ico").is_file():
        problems.append(f"images/favicon.ico: missing (run `agora imagery build {brand.name}`)")
    cat = catalog(brand)
    if cat is None:
        return problems
    environments = set(cat.get("environments", []))
    seen = set()
    for piece in cat.get("pieces", []):
        pid = piece.get("id")
        missing = [k for k in REQUIRED if piece.get(k) in (None, "", [])]
        if missing:
            problems.append(f"{pid}: missing {', '.join(missing)}")
        if pid in seen:
            problems.append(f"{pid}: duplicate id")
        seen.add(pid)
        if piece.get("file") != f"{pid}.png":
            problems.append(f"{pid}: file should be {pid}.png")
        if piece.get("environment") not in environments:
            problems.append(f"{pid}: environment {piece.get('environment')!r} is not in the catalog's environments")
        master = brand / "imagery" / (piece.get("file") or "")
        if not master.is_file():
            problems.append(f"{pid}: {piece.get('file')} not found")
            continue
        m = measure(master)
        for key in ("pixel_size", "content_box"):
            if m[key] != piece.get(key):
                problems.append(f"{pid}: {key} {piece.get(key)}, the file measures {m[key]}")
        if not m["transparent"]:
            problems.append(f"{pid}: no real transparency; the master was flattened")
        for web in piece.get("web") or []:
            f = brand / "imagery" / web["file"]
            if not f.is_file():
                problems.append(f"{pid}: {web['file']} not found (run `agora imagery build {brand.name}`)")
            elif size(f) != [web["width"], web["height"]]:
                problems.append(f"{pid}: {web['file']} is {size(f)}, not [{web['width']}, {web['height']}]")
    catalogued = {p.get("file") for p in cat.get("pieces", [])}
    for f in sorted((brand / "imagery").glob("*.png")):
        if f.name not in catalogued:
            problems.append(f"imagery/{f.name}: not in catalog.json")
    listed = {w["file"] for p in cat.get("pieces", []) for w in p.get("web") or []}
    for f in sorted((brand / "imagery" / "web").glob("*")):
        if f"web/{f.name}" not in listed:
            problems.append(f"imagery/web/{f.name}: not in catalog.json")
    return problems
