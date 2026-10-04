"""A brand's imagery pool and share card: build, check and measure (0014-design-systems FR-037, FR-043).

`build` writes each piece's WebP files for the web (the widths imagery/catalog.json lists under "web"),
images/share-card.png (the brand's lockup centered on its surface, 1200x630), and the app icons tokens.json lists
with images/favicon.ico (the icon-only mark on the surface, never enlarged). `check` returns every problem: an
incomplete catalog entry, a master absent or not at pixel_size with real transparency and the content_box it
states, WebP files absent or off size, a master not catalogued, a share card absent or not 1200x630. `measure`
reports a candidate piece's pixel_size and content_box for the catalog, whether it has real transparency, and
how much of the drawn art carries color.

Standard library and Pillow (a pinned package of the assurance and brand groups' locks; imported where it is used, so that
a process holding no lock can still load this module). Pillow writes the WebP files, the PNGs and the icon, with the
encoder it ships, so the bytes depend on its locked version and on nothing the host has (0025-tooling-environment FR-026).
"""
from __future__ import annotations

import colorsys
import io
import json
from pathlib import Path

REQUIRED = ["id", "name", "file", "environment", "description", "visual_anchor", "route", "built_structures",
            "infrastructure_type", "colored_elements", "water", "metaphors", "suggested_subjects", "source",
            "pixel_size", "content_box", "web"]
SHARE_CARD = ("images/share-card.png", 1200, 630)
# A pixel counts as colored when its saturation and value are above these (0-1): engraved grayscale land
# stays under them, painted structures and water go over.
SATURATION_MIN, VALUE_MIN = 60 / 255, 40 / 255


def _image():
    from PIL import Image
    return Image


def _open(path: Path):
    """A file read to RGBA, closed again."""
    Image = _image()
    with Image.open(path) as im:
        return im.convert("RGBA")


def size(path: Path) -> list[int]:
    with _image().open(path) as im:
        return list(im.size)


def measure(path: Path) -> dict:
    im = _open(path)
    w, h = im.size
    alpha = im.getchannel("A")
    # The content box is where the alpha is above 6.3% of full (16 of 255), as the catalog has always stated it.
    box = alpha.point(lambda v: 255 if v > 16 else 0).getbbox() or (0, 0, 0, 0)
    alpha_min = alpha.getextrema()[0] / 255
    small = im.convert("RGBa").resize((max(1, round(w * 0.25)), max(1, round(h * 0.25))), _image().LANCZOS).convert("RGBA")
    raw = small.tobytes()
    drawn = colored = 0
    for i in range(0, len(raw), 4):
        r, g, b, a = raw[i:i + 4]
        if a <= 16:
            continue
        drawn += 1
        _, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        colored += s > SATURATION_MIN and v > VALUE_MIN
    return {"pixel_size": [w, h], "content_box": list(box), "transparent": alpha_min < 16 / 255,
            "colored_share": colored / drawn if drawn else 0.0}


def _resized(im, width: int, height: int):
    """`im` resized to exactly width x height with Lanczos, premultiplied so a transparent edge does not bleed."""
    return im.convert("RGBa").resize((width, height), _image().LANCZOS).convert("RGBA")


def _flat_on(color: str, w: int, h: int, art, left: int, top: int):
    """A w x h canvas of `color` with `art` composited at (left, top)."""
    Image = _image()
    canvas = Image.new("RGBA", (w, h), color)
    canvas.alpha_composite(art, (left, top))
    return canvas.convert("RGB")


def _png(im) -> bytes:
    buf = io.BytesIO()
    im.save(buf, format="PNG", compress_level=9)
    return buf.getvalue()


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


def build_icons(brand: Path, dest: Path | None = None) -> int:
    """Each app icon (frontiers-brand FR-018): the icon-only mark centered on the brand's surface, inside the share of
    the canvas its purpose keeps clear (a maskable icon's mark fits the 80% circle a platform may crop it to), never
    enlarged past its master; and favicon.ico at 16, 32 and 48px. Written under `dest` (the brand's own directory by default)."""
    dest = dest or brand
    master = icon_master(brand)
    mw, mh = size(master)
    art = _open(master)
    bg = surface(brand)
    for icon in app_icons(brand):
        w, h = icon["width"], icon["height"]
        if icon["purpose"] == "maskable":
            fit = 0.8 * min(w, h) / (mw ** 2 + mh ** 2) ** 0.5
        else:
            fit = 0.86 * min(w / mw, h / mh)
        scale = min(fit, 1.0)
        out = dest / icon["file"]
        out.parent.mkdir(parents=True, exist_ok=True)
        aw, ah = round(mw * scale), round(mh * scale)
        out.write_bytes(_png(_flat_on(bg, w, h, _resized(art, aw, ah), (w - aw) // 2, (h - ah) // 2)))
    ico = dest / "images" / "favicon.ico"
    ico.parent.mkdir(parents=True, exist_ok=True)
    ico.write_bytes(favicon_bytes(master))
    return len(app_icons(brand)) + 1


def favicon_bytes(master: Path) -> bytes:
    """favicon.ico at 48, 32 and 16 px: the mark fitted inside 48x48 and centered on a transparent square."""
    Image = _image()
    im = _open(master)
    s = min(48 / im.width, 48 / im.height)
    fw, fh = max(1, round(im.width * s)), max(1, round(im.height * s))
    square = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    square.alpha_composite(_resized(im, fw, fh), ((48 - fw) // 2, (48 - fh) // 2))
    buf = io.BytesIO()
    square.save(buf, format="ICO", sizes=[(48, 48), (32, 32), (16, 16)])
    return buf.getvalue()


def build(brand: Path, dest: Path | None = None) -> dict:
    """Write every derived file, under `dest` (the brand's own directory by default); the masters are read from `brand`."""
    dest = dest or brand
    cat = catalog(brand)
    for piece in (cat or {}).get("pieces", []):
        master = brand / "imagery" / piece["file"]
        for web in piece["web"]:
            out = dest / "imagery" / web["file"]
            out.parent.mkdir(parents=True, exist_ok=True)
            _resized(_open(master), web["width"], web["height"]).save(
                out, format="WEBP", quality=82, alpha_quality=90, method=6)
    bg = surface(brand)
    logo = lockup(brand, "light" if luminance(bg) > 0.5 else "dark")
    path, w, h = SHARE_CARD
    (dest / path).parent.mkdir(parents=True, exist_ok=True)
    art = _open(logo)
    lw = w * 46 // 100
    lh = max(1, round(art.height * lw / art.width))
    (dest / path).write_bytes(_png(_flat_on(bg, w, h, _resized(art, lw, lh), (w - lw) // 2, (h - lh) // 2)))
    icons = build_icons(brand, dest) if app_icons(brand) else 0
    return {"webp": sum(len(p["web"]) for p in (cat or {}).get("pieces", [])), "share_card": path, "app_icons": icons}


def derived(brand: Path) -> list[str]:
    """The paths, inside the brand, that `build` writes."""
    cat = catalog(brand)
    out = [f"imagery/{w['file']}" for p in (cat or {}).get("pieces", []) for w in p["web"]]
    out.append(SHARE_CARD[0])
    if app_icons(brand):
        out += [i["file"] for i in app_icons(brand)] + ["images/favicon.ico"]
    return out


def build_changes(brand: Path) -> dict[Path, bytes]:
    """Every file `build` writes, built in a scratch directory: path and bytes."""
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        build(brand, Path(tmp))
        return {brand / rel: (Path(tmp) / rel).read_bytes() for rel in derived(brand)}


def pieces(brand: Path) -> list[dict]:
    return (catalog(brand) or {}).get("pieces", [])


def piece_names(root: Path, brands: list[str]) -> list[str]:
    return [f"{b}/{p['id']}" for b in brands for p in pieces(root / "design-systems" / b)]


WEB_WIDTHS = (2, 1)  # a piece's WebP files: half and full width (imagery/README.md)
ID_RE = r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*"


def new_piece(master: Path, fields: dict) -> dict:
    """The catalog entry for a master being added: its measured fields, its WebP files at half and full width, and the
    descriptive fields it is given. The id is the master's file name without .png."""
    pid = master.name[:-4]
    m = measure(master)
    w, h = m["pixel_size"]
    web = [{"file": f"web/{pid}-{w // d}.webp", "width": w // d, "height": round(h / d)} for d in WEB_WIDTHS]
    entry = {"id": pid, "name": fields["name"], "file": f"{pid}.png", "environment": fields["environment"],
             "description": fields["description"], "visual_anchor": fields["visual_anchor"], "route": fields["route"],
             "built_structures": fields["built_structures"], "infrastructure_type": fields["infrastructure_type"],
             "colored_elements": fields["colored_elements"], "water": fields["water"], "metaphors": fields["metaphors"],
             "suggested_subjects": fields["suggested_subjects"], "source": fields["source"],
             "pixel_size": m["pixel_size"], "content_box": m["content_box"], "web": web}
    return {"entry": entry, "measure": m}


def dumps(cat: dict) -> str:
    return json.dumps(cat, indent=2, ensure_ascii=False) + "\n"


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
