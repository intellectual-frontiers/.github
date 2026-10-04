"""A brand's Open edX brand package: write its sources from tokens.json, build it with Paragon, and check it
(frontiers-brand spec FR-020; 0014-design-systems FR-038).

The package follows openedx/brand-openedx, the interface Open edX applications load a brand through, for
Paragon 23's design tokens: logo.svg, logo-white.svg, logo-trademark.svg (the brand's own lockup PNGs, wrapped
unchanged, never redrawn), favicon.ico, paragon/images/card-imagecap-fallback.png (the brand's share card), the
brand's web fonts, and token overrides under paragon/tokens/ that Paragon's `build-tokens` merges over its own:

    color.primary, secondary, brand (the accent), success, info, warning, danger   the brand's roles
    color.light, color.dark                                                       paper, text
    color.gray.100 to 900                                                         text mixed into surface, each at
                                                                                  the luminance of Paragon's gray
    color.bg.base, body, headings, link                                          surface, text, text, link
    typography.font.family.sans.serif and serif                                  the brand's font roles

`write` writes the package's sources; `build` also runs Paragon's CLI (the paragon executable, such as
node_modules/.bin/paragon) to write dist/, the CSS and files an Open edX instance or a managed host loads; `check`
returns where the committed package differs from what `write` (and, given Paragon, `build`) would write, and every
pair of built colors that misses 4.5:1. Standard library only; Pillow only for a brand without a favicon.ico.
"""
from __future__ import annotations

import base64
import filecmp
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
FONTS = ROOT / "design-systems" / "frontiers-course" / "web" / "fonts"
WEB_FONTS = {"Inter": ("inter-variable-latin.woff2", "400 800"), "Source Serif 4": ("source-serif-4-variable-latin.woff2", "400 500")}
# Paragon 23's light grays (tokens/src/themes/light/global/color.json); each is replaced by the brand's text mixed
# into its surface at the same luminance, so every contrast Paragon was designed around holds.
PARAGON_GRAYS = {"100": "#EBEBEB", "200": "#CCCCCC", "300": "#ADADAD", "400": "#8F8F8F", "500": "#707070",
                 "600": "#5C5C5C", "700": "#454545", "800": "#333333", "900": "#212529"}
# The Paragon the committed dist/ is built with; CI installs the same (.github/workflows/design-systems.yml).
PARAGON_VERSION = "23.23.0"
SANS_FALLBACK = ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "Noto Sans", "sans-serif"]
SERIF_FALLBACK = ["Georgia", "serif"]
# Built pairs that must meet 4.5:1 (custom property names in dist/light.css).
PAIRS = [("color-body-base", "color-body-bg"), ("color-headings-base", "color-body-bg"), ("color-link-base", "color-body-bg"),
         ("color-text-muted", "color-body-bg"), ("color-gray-700", "color-body-bg"), ("color-gray-500", "color-body-bg")]
PAIRS += [(f"color-btn-text-{v}", f"color-btn-bg-{v}") for v in ("primary", "secondary", "brand", "success", "danger", "info", "warning", "light", "dark")]


def resolve(tokens: dict, value):
    for _ in range(10):
        if not (isinstance(value, str) and value.startswith("{")):
            return value
        group, key = value[1:-1].split(".", 1)
        value = tokens[group][key]["$value"]
    return value


def role(tokens: dict, name: str) -> str:
    return str(resolve(tokens, tokens["role"][name]["$value"]))


def lum(h: str) -> float:
    c = [int(h.lstrip("#")[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def contrast(a: str, b: str) -> float:
    x, y = sorted((lum(a), lum(b)), reverse=True)
    return (x + 0.05) / (y + 0.05)


def mix(a: str, b: str, w: float) -> str:
    ca, cb = (int(a.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)), (int(b.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
    return "#" + "".join(f"{round(w * x + (1 - w) * y):02X}" for x, y in zip(ca, cb))


def gray(text: str, surface: str, target: str) -> str:
    """text mixed into surface at target's luminance."""
    lo, hi = 0.0, 1.0
    for _ in range(40):
        mid = (lo + hi) / 2
        if lum(mix(text, surface, mid)) > lum(target):
            lo = mid
        else:
            hi = mid
    return mix(text, surface, (lo + hi) / 2)


def tok(source: str, value) -> dict:
    return {"source": source, "$value": value}


def color_tokens(tokens: dict) -> dict:
    r = {k: role(tokens, k) for k in ("text", "surface", "primary", "secondary", "accent", "success", "info", "warning", "danger", "paper")}
    c = {"$type": "color"}
    for name, rl in (("primary", "primary"), ("secondary", "secondary"), ("brand", "accent"), ("success", "success"),
                     ("info", "info"), ("warning", "warning"), ("danger", "danger"), ("light", "paper"), ("dark", "text")):
        c[name] = {"base": tok(f"${name}", r[rl].upper())}
    c["gray"] = {k: tok(f"$gray-{k}", gray(r["text"], r["surface"], v)) for k, v in PARAGON_GRAYS.items() if k != "500"}
    c["gray"]["base"] = tok("$gray", gray(r["text"], r["surface"], PARAGON_GRAYS["500"]))
    return {"color": c}


def files(brand: Path, package: str) -> dict[str, bytes | str]:
    """Every source file of the package, by path inside it."""
    tokens = json.loads((brand / "tokens.json").read_text(encoding="utf-8"))
    name = brand.name
    logo = tokens["$extensions"]["com.intellectualfrontiers.logo"]
    lockups = logo["lockup"]["files"]

    def lockup(background: str) -> dict:
        pick = [f for f in lockups if f["file"].endswith(".png") and f.get("background") == background and f["height"] >= 72]
        return min(pick or [max((f for f in lockups if f.get("background") == background), key=lambda f: f["width"])], key=lambda f: f["width"])

    def wrap(f: dict) -> str:
        data = base64.b64encode((brand / f["file"]).read_bytes()).decode()
        return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{f["width"]}" height="{f["height"]}" '
                f'viewBox="0 0 {f["width"]} {f["height"]}" role="img"><title>{name}</title>'
                f'<image width="{f["width"]}" height="{f["height"]}" href="data:image/png;base64,{data}"/></svg>\n')
    light, dark = lockup("light"), lockup("dark")
    out: dict[str, bytes | str] = {
        "logo.svg": wrap(light), "logo-trademark.svg": wrap(light), "logo-white.svg": wrap(dark),
        "logo.png": (brand / light["file"]).read_bytes(), "logo-trademark.png": (brand / light["file"]).read_bytes(),
        "logo-white.png": (brand / dark["file"]).read_bytes(),
        "favicon.ico": favicon(brand),
        "paragon/images/card-imagecap-fallback.png": (brand / logo["share-card"]["file"]).read_bytes(),
    }
    sans, serif = role(tokens, "font-sans"), role(tokens, "font-serif")
    faces = []
    for family in (sans, serif):
        if family in WEB_FONTS:
            file, weights = WEB_FONTS[family]
            out[f"paragon/fonts/{file}"] = (FONTS / file).read_bytes()
            faces.append(f'@font-face {{\n  font-family: "{family}";\n  font-style: normal;\n  font-weight: {weights};\n'
                         f'  font-display: swap;\n  src: url("./fonts/{file}") format("woff2");\n}}\n')
    for lic in ("LICENSES.md", "OFL-1.1.txt"):
        out[f"paragon/fonts/{lic}"] = (FONTS / lic).read_bytes()
    out["paragon/_fonts.scss"] = "// The brand's web fonts, served beside the built CSS (dist/fonts/). Written by `agora openedx generate`.\n" + "\n".join(faces)
    out["paragon/core.scss"] = ("// Assembled by `paragon build-scss` into dist/core.css. Written by `agora openedx generate`.\n"
                                '@use "./fonts";\n@use "./build/core/variables";\n')
    out["paragon/tokens/core/global/typography.json"] = {"typography": {"font": {"family": {
        "$type": "fontFamily",
        "sans": {"serif": tok("$font-family-sans-serif", [sans, *SANS_FALLBACK])},
        "serif": tok("$font-family-serif", [serif, *SERIF_FALLBACK])}}}}
    out["paragon/tokens/themes/light/global/color.json"] = color_tokens(tokens)
    out["paragon/tokens/themes/light/alias/color.json"] = {"color": {"$type": "color", "bg": {"base": {"$value": role(tokens, "surface").upper()}}}}
    out["paragon/tokens/themes/light/components/general/body.json"] = {"color": {"$type": "color", "body": {"base": tok("$body-color", "{color.dark.base}")}}}
    out["paragon/tokens/themes/light/components/general/headings.json"] = {"color": {"$type": "color", "headings": {"base": tok("$headings-color", "{color.dark.base}")}}}
    link = role(tokens, "link").upper()
    out["paragon/tokens/themes/light/components/general/link.json"] = {"color": {"$type": "color", "link": {
        "base": tok("$link-color", link), "inline": {"base": tok("$inline-link-color", link)}}}}
    out["package.json"] = {
        "name": package, "version": "1.0.0", "private": True,
        "description": f"{name}'s Open edX brand package, written by `agora openedx generate` from its tokens.json.",
        "exports": {"./*": "./dist/*"}, "files": ["dist"],
        "scripts": {"build": "make build", "build-tokens": "make build-tokens", "build-scss": "make build-scss"},
        "license": "SEE LICENSE IN LICENSE.md", "devDependencies": {"@openedx/paragon": PARAGON_VERSION}}
    out["Makefile"] = (".PHONY: build build-tokens build-scss dist clean\n"
                       "PARAGON ?= npx paragon\n"
                       "build: clean dist build-tokens build-scss\n\tcp *.svg *.png *.ico dist/\n\tcp -r paragon/images dist/paragon/\n\tcp -r paragon/fonts dist/fonts\n\n"
                       "dist:\n\tmkdir -p dist/paragon\n\n"
                       "build-tokens:\n\t$(PARAGON) build-tokens --source ./paragon/tokens/ --build-dir ./paragon/build -t light\n\n"
                       "build-scss: dist\n\t$(PARAGON) build-scss --corePath ./paragon/core.scss --themesPath ./paragon/build/themes --outDir ./dist\n\n"
                       "clean:\n\trm -rf dist paragon/build\n")
    out["LICENSE.md"] = (f"# Licence\n\nThe logos, favicon and share card are {name}'s marks and imagery: all rights reserved, for use only to "
                         "present its own courses. The fonts in `paragon/fonts/` are under the SIL Open Font License 1.1 (see "
                         "`paragon/fonts/LICENSES.md`). The token files and build scripts may be reused freely.\n")
    out["README.md"] = (f"# {package}\n\n{name}'s brand for Open edX, in the shape of "
                        "[openedx/brand-openedx](https://github.com/openedx/brand-openedx) for Paragon 23's design tokens. "
                        "Written by `agora openedx generate` from the brand's `tokens.json`; do not edit, rewrite it.\n\n"
                        "- `dist/` is the built package: `core.css` and `light.css` (with `.min.css` and maps), "
                        "`theme-urls.json`, the logos, favicon and fonts. A managed host that takes a theme by URL can be "
                        "given `dist/` as it is.\n"
                        "- To rebuild: `npm install`, then `make build` (or `agora openedx build "
                        "<brand> --paragon node_modules/.bin/paragon` from the repository).\n"
                        "- To install in a Tutor instance: publish or pack this directory (`npm pack`) and install it in "
                        "place of `@openedx/brand-openedx`, as Tutor's MFE plugin documents.\n")
    return out


def favicon(brand: Path) -> bytes:
    ico = brand / "images" / "favicon.ico"
    if ico.is_file():
        return ico.read_bytes()
    from io import BytesIO
    from PIL import Image
    buf = BytesIO()
    Image.open(brand / "images" / "favicon.png").save(buf, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    return buf.getvalue()


def write(brand: Path, out: Path, package: str) -> None:
    for sub in ("paragon", "logo.svg"):
        if (out / sub).is_dir():
            shutil.rmtree(out / sub)
    for path, data in files(brand, package).items():
        dst = out / path
        dst.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(data, (dict, list)):
            dst.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        elif isinstance(data, str):
            dst.write_text(data, encoding="utf-8")
        else:
            dst.write_bytes(data)


def build(out: Path, paragon: Path) -> None:
    """Paragon's build-tokens and build-scss, then the files dist/ carries, as the Makefile does."""
    shutil.rmtree(out / "dist", ignore_errors=True)
    shutil.rmtree(out / "paragon" / "build", ignore_errors=True)
    (out / "dist" / "paragon").mkdir(parents=True)
    run = lambda *a: subprocess.run([str(paragon), *a], cwd=out, check=True, capture_output=True, text=True)  # noqa: E731
    run("build-tokens", "--source", "./paragon/tokens/", "--build-dir", "./paragon/build", "-t", "light")
    run("build-scss", "--corePath", "./paragon/core.scss", "--themesPath", "./paragon/build/themes", "--outDir", "./dist")
    for f in sorted(out.glob("*")):
        if f.suffix in (".svg", ".png", ".ico"):
            shutil.copy(f, out / "dist" / f.name)
    shutil.copytree(out / "paragon" / "images", out / "dist" / "paragon" / "images")
    shutil.copytree(out / "paragon" / "fonts", out / "dist" / "fonts")
    shutil.rmtree(out / "paragon" / "build")
    for css in (out / "dist").rglob("*.css"):
        css.write_text(re.sub(r"(?m)^ \* (?:Generated|Built) (?:on|at) .*\n", "", css.read_text(encoding="utf-8")), encoding="utf-8")


def variables(css: str) -> dict[str, str]:
    out = dict(re.findall(r"--pgn-([\w-]+):\s*([^;]+);", css))
    for _ in range(10):
        for k, v in out.items():
            m = re.fullmatch(r"var\(--pgn-([\w-]+)\)", v.strip())
            if m and m.group(1) in out:
                out[k] = out[m.group(1)]
    return {k: v.strip() for k, v in out.items()}


def hexcolor(v: str) -> str | None:
    v = v.strip().lower()
    if re.fullmatch(r"#[0-9a-f]{6}(?:ff)?", v):
        return v[:7]
    if re.fullmatch(r"#[0-9a-f]{3}", v):
        return "#" + "".join(c * 2 for c in v[1:])
    if m := re.fullmatch(r"rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*1(?:\.0+)?)?\)", v):
        return "#" + "".join(f"{int(x):02x}" for x in m.groups())
    return {"white": "#ffffff", "black": "#000000"}.get(v)


def contrast_problems(dist: Path) -> list[str]:
    vars_ = {**variables((dist / "core.css").read_text(encoding="utf-8")),
             **variables(next(dist.glob("themes/light/light.css"), dist / "light.css").read_text(encoding="utf-8"))}
    out = []
    for fg, bg in PAIRS:
        a, b = hexcolor(vars_.get(fg, "")), hexcolor(vars_.get(bg, ""))
        if not (a and b):
            out.append(f"--pgn-{fg} or --pgn-{bg} is not a color in the built CSS: {vars_.get(fg)!r}, {vars_.get(bg)!r}")
        elif contrast(a, b) < 4.5:
            out.append(f"--pgn-{fg} on --pgn-{bg} is {contrast(a, b):.2f}:1, under 4.5:1")
    return out


def check(brand: Path, out: Path, package: str, paragon: Path | None) -> list[str]:
    problems = []
    with tempfile.TemporaryDirectory() as tmp:
        fresh = Path(tmp) / "pkg"
        write(brand, fresh, package)
        if paragon:
            build(fresh, paragon)
        cmp = filecmp.dircmp(fresh, out, ignore=["node_modules", "package-lock.json"] + ([] if paragon else ["dist"]))

        def walk(d, rel=""):
            for f in d.left_only:
                problems.append(f"{rel}{f} is missing; run `agora openedx {'build' if paragon else 'generate'} {brand.name}`")
            for f in d.right_only:
                problems.append(f"{rel}{f} is not written by `agora openedx generate`")
            for f in d.diff_files:
                problems.append(f"{rel}{f} differs from what `agora openedx generate` writes")
            for name, sub in d.subdirs.items():
                walk(sub, f"{rel}{name}/")
        if out.is_dir():
            walk(cmp)
        else:
            problems.append(f"{out} does not exist; run `agora openedx generate {brand.name}`")
        if paragon:
            problems += contrast_problems(fresh / "dist")
    r = {k: role(json.loads((brand / "tokens.json").read_text(encoding="utf-8")), k) for k in ("text", "surface", "link")}
    for fg in ("text", "link"):
        if contrast(r[fg], r["surface"]) < 4.5:
            problems.append(f"{fg} on surface is under 4.5:1")
    return problems
