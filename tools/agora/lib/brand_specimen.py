"""A brand design system's assurance specimen, from its tokens.json (0014-design-systems FR-028; 0042-agora FR-015).

`agora brand generate` writes it and `agora fresh brand-specimen` proves it current. The specimen shows every palette color as a swatch, every theme role, and every logo file at its native
size on the background its variant is for; the brand's integration suite checks it. Standard library only.
"""
from __future__ import annotations

import html
import json
from pathlib import Path

GENERATOR = "brand-specimen"


def resolve(tokens: dict, value):
    for _ in range(10):
        if not (isinstance(value, str) and value.startswith("{")):
            return value
        group, key = value[1:-1].split(".", 1)
        value = tokens[group][key]["$value"]
    return value


def specimen(brand: Path) -> str:
    t = json.loads((brand / "tokens.json").read_text(encoding="utf-8"))
    name = brand.name
    colors = {k: v["$value"] for k, v in t["color"].items() if not k.startswith("$")}
    roles = {k: resolve(t, v["$value"]) for k, v in t["role"].items()}
    logo = t["$extensions"]["com.intellectualfrontiers.logo"]
    surface, text = roles["surface"], roles["text"]
    swatch = lambda k, v, attr="": f'    <li><span class="swatch"{attr} style="background:{v}"></span><code>{html.escape(k)}</code> {v}</li>'
    sw = "\n".join(swatch(k, v, f' data-swatch="{k}"') for k, v in colors.items())
    rl = "\n".join(swatch(k, v) for k, v in roles.items() if str(v).startswith("#"))

    def imgs(files, bg):
        return "\n".join(
            f'      <figure><img src="../../{f["file"]}" width="{f["width"]}" height="{f["height"]}" alt="{html.escape(name)} logo" data-background="{bg}"><figcaption>{f["file"]}</figcaption></figure>'
            for f in files if f.get("background", "light") == bg)

    return f'''<!doctype html>
<!-- Written by agora's brand-specimen generator from tokens.json; do not edit: run `agora brand generate {html.escape(name)}`. -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Specimen · {html.escape(name)} assurance</title>
<link rel="icon" href="../../{logo["favicon"]["file"]}">
<style>
  body {{ margin: 0; background: {surface}; color: {text}; font: 1rem/1.5 "{roles["font-serif"]}", Georgia, serif; }}
  main {{ max-inline-size: 90rem; margin-inline: auto; padding: 2rem 1.5rem; }}
  h1, h2 {{ font-family: "{roles["font-sans"]}", "Helvetica Neue", Arial, sans-serif; }}
  ul {{ list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 1rem; }}
  .swatch {{ display: block; inline-size: 6rem; block-size: 3rem; border: 1px solid #e2e0da; }}
  [data-surface] {{ display: flex; flex-wrap: wrap; align-items: flex-end; gap: 2rem; padding: 2rem; }}
  figure {{ margin: 0; }}
  figure img {{ display: block; max-inline-size: 100%; block-size: auto; }}
  figcaption {{ font: 0.75rem ui-monospace, monospace; margin-block-start: 0.5rem; }}
  [data-surface="light"] {{ background: #ffffff; }}
  [data-surface="dark"] {{ background: {text}; color: #ffffff; }}
</style>
</head>
<body>
<main>
  <h1>{html.escape(name)} specimen</h1>
  <h2>Palette</h2>
  <ul>
{sw}
  </ul>
  <h2>Theme roles</h2>
  <ul>
{rl}
  </ul>
  <h2>Lockup, light backgrounds</h2>
  <section data-surface="light" aria-label="Lockups on white">
{imgs(logo["lockup"]["files"], "light")}
  </section>
  <h2>Lockup, dark backgrounds</h2>
  <section data-surface="dark" aria-label="Lockups on a dark background">
{imgs(logo["lockup"]["files"], "dark")}
  </section>
  <h2>Icon</h2>
  <section data-surface="light" aria-label="Icons on white">
{imgs(logo["icon"]["files"], "light")}
  </section>
</main>
</body>
</html>
'''


def path_of(brand: Path) -> Path:
    return brand / "assurance" / "fixtures" / "specimen.html"


def generate(brand: Path) -> dict[Path, str]:
    return {path_of(brand): specimen(brand)}
