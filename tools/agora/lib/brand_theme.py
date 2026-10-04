"""A brand design system's theme files, from its tokens.json (0014-design-systems FR-028, FR-037; 0042-agora FR-015).

`agora brand generate` writes them and `agora fresh brand-theme` proves them current. brand.css declares every theme role as a --brand-<role> custom property in the `theme` cascade layer, for the
web. brand.tex declares every color role as an xcolor color brand-<role>, the font roles as \\brandfontsans and
\\brandfontserif, and the widest lockups and icon as \\brandlockuplight, \\brandlockupdark and \\brandicon, for
print. Both are derived from tokens.json and nothing else; each brand's harness checks they agree with it.
Standard library only.
"""
from __future__ import annotations

import json
from pathlib import Path

GENERATOR = "brand-theme"


def resolve(tokens: dict, value):
    for _ in range(10):
        if not (isinstance(value, str) and value.startswith("{")):
            return value
        group, key = value[1:-1].split(".", 1)
        value = tokens[group][key]["$value"]
    return value


def roles(tokens: dict) -> list[tuple[str, str, str]]:
    """(role, $type, resolved value), in tokens.json order."""
    return [(k, v["$type"], str(resolve(tokens, v["$value"]))) for k, v in tokens["role"].items()]


def brand_css(name: str, tokens: dict) -> str:
    lines = [f'    --brand-{r}: {json.dumps(v) if t == "fontFamily" else v};' for r, t, v in roles(tokens)]
    return (f"/*\n * {name}'s theme for the web (0014-design-systems FR-028, FR-037): every role in tokens.json under \"role\",\n"
            " * as a custom property, and nothing else. Load it before a web design system's stylesheets.\n"
            " * Written by agora's brand-theme generator from tokens.json; do not edit: run `agora brand generate " + name + "`.\n */\n"
            "@layer theme {\n  :root {\n" + "\n".join(lines) + "\n  }\n}\n")


def widest(files: list[dict], background: str | None = None) -> str:
    pick = [f for f in files if f["file"].endswith(".png") and (background is None or f.get("background") == background)]
    return max(pick, key=lambda f: f["width"])["file"]


def brand_tex(name: str, tokens: dict) -> str:
    out = [f"% {name}'s theme for print (0014-design-systems FR-028, FR-037): every color role as an xcolor color",
           "% brand-<role>, the font roles, and its widest lockups and icon, as paths inside this brand's directory.",
           "% Load it before a print design system's own definitions. Written by agora's brand-theme generator from",
           f"% tokens.json; do not edit: run `agora brand generate {name}`."]
    for r, t, v in roles(tokens):
        if t == "color":
            out.append(f"\\definecolor{{brand-{r}}}{{HTML}}{{{v.lstrip('#').upper()}}}")
    font = {r: v for r, t, v in roles(tokens) if t == "fontFamily"}
    out.append(f"\\newcommand{{\\brandfontsans}}{{{font['font-sans']}}}")
    out.append(f"\\newcommand{{\\brandfontserif}}{{{font['font-serif']}}}")
    logo = tokens["$extensions"]["com.intellectualfrontiers.logo"]
    out.append(f"\\newcommand{{\\brandlockuplight}}{{{widest(logo['lockup']['files'], 'light')}}}")
    out.append(f"\\newcommand{{\\brandlockupdark}}{{{widest(logo['lockup']['files'], 'dark')}}}")
    out.append(f"\\newcommand{{\\brandicon}}{{{widest(logo['icon']['files'])}}}")
    return "\n".join(out) + "\n"


def generate(brand: Path) -> dict[Path, str]:
    """The brand's theme files, by path: brand.css and brand.tex."""
    tokens = json.loads((brand / "tokens.json").read_text(encoding="utf-8"))
    return {brand / "brand.css": brand_css(brand.name, tokens), brand / "brand.tex": brand_tex(brand.name, tokens)}
