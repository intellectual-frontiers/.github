#!/usr/bin/env python3
"""Build and check an email (frontiers-email spec FR-005 to FR-012).

    python3 mail.py build MESSAGE.md -o OUT.html --assets URL [--brand SLUG]
    python3 mail.py check MESSAGE.md [...] [--brand SLUG]

A message is Markdown with front matter:

    ---
    type: newsletter
    subject: We stop a pilot when the evidence says stop
    preheader: Three signals that end a pilot, and the test to write before the kickoff.
    ---
    # Most pilots never had a way to fail
    Two of the five pilots we reviewed ran past their budget.
    - The metric misses its threshold
    [Read the full piece](https://example.org/stop){button}
    ---

`#` is the heading, `##` a subheading, `-` a point, a blank line ends a paragraph, a line of `---` a divider, and
`[text](https://...){button}` the one call to action. **bold** and [links](https://...) are the only inline markup.

`build` writes the HTML email (600px, table layout, every style inline, colors resolved from the brand's theme
roles, with a dark-mode stylesheet for clients that honor one) and its plain-text alternative beside it (.txt). The
lockup is linked from `--assets`, the public URL where the brand's files are served. `check` reports every rule a
message breaks. Standard library only; uses the house voice when it is beside this design system.
"""
from __future__ import annotations

import argparse
import html
import importlib.util
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SYSTEMS = HERE.parent
DATA = json.loads((HERE / "email.json").read_text(encoding="utf-8"))
TYPES = DATA["types"]


def _tokens(brand: Path) -> dict:
    return json.loads((brand / "tokens.json").read_text(encoding="utf-8"))


def _value(tokens: dict, role: str) -> str:
    value = tokens["role"][role]["$value"]
    while isinstance(value, str) and value.startswith("{"):
        group, key = value[1:-1].split(".", 1)
        value = tokens[group][key]["$value"]
    return value


def color(expr: str, tokens: dict) -> str:
    """A brand role or a mix of two ("text!72!surface"), resolved as frontiers-figures resolves them."""
    if "!" not in expr:
        return _value(tokens, expr).lower()
    a, pct, b = expr.split("!")
    w = int(pct) / 100
    ca, cb = _value(tokens, a), _value(tokens, b)
    return "#" + "".join(f"{round(w * int(ca[i:i + 2], 16) + (1 - w) * int(cb[i:i + 2], 16)):02x}" for i in (1, 3, 5))


def contrast(a: str, b: str) -> float:
    def lum(h: str) -> float:
        c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
        c = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    x, y = sorted((lum(a), lum(b)), reverse=True)
    return (x + 0.05) / (y + 0.05)


def parse(text: str) -> tuple[dict, list[tuple[str, str]]]:
    """Front matter and blocks: (kind, text) with kind h1, h2, p, li, button, divider."""
    meta: dict = {}
    body = text
    if text.startswith("---\n"):
        end = text.index("\n---\n", 4)
        for line in text[4:end].splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        body = text[end + 5:]
    blocks: list[tuple[str, str]] = []
    para: list[str] = []

    def flush() -> None:
        if para:
            blocks.append(("p", " ".join(para)))
            para.clear()
    for raw in body.splitlines():
        line = raw.strip()
        if not line:
            flush()
        elif line == "---":
            flush()
            blocks.append(("divider", ""))
        elif line.startswith("## "):
            flush()
            blocks.append(("h2", line[3:]))
        elif line.startswith("# "):
            flush()
            blocks.append(("h1", line[2:]))
        elif line.startswith("- "):
            flush()
            blocks.append(("li", line[2:]))
        elif m := re.fullmatch(r"\[(.+)\]\((\S+)\)\{button\}", line):
            flush()
            blocks.append(("button", f"{m.group(1)}\x00{m.group(2)}"))
        else:
            para.append(line)
    flush()
    return meta, blocks


def inline(text: str, link: str) -> str:
    out = html.escape(text, quote=False)
    out = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", out)
    return re.sub(r"\[([^\]]+)\]\((https://[^)\s]+)\)",
                  lambda m: f'<a href="{html.escape(m.group(2))}" style="color:{link};text-decoration:underline;">{m.group(1)}</a>', out)


def plain(text: str) -> str:
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    return re.sub(r"\[([^\]]+)\]\((https://[^)\s]+)\)", r"\1 (\2)", text)


def build(message: Path, out: Path, brand_slug: str, assets: str) -> tuple[str, str]:
    meta, blocks = parse(message.read_text(encoding="utf-8"))
    brand = SYSTEMS / brand_slug
    tokens = _tokens(brand)
    light = {k: color(v, tokens) for k, v in DATA["tones"]["light"].items()}
    dark = {k: color(v, tokens) for k, v in DATA["tones"]["dark"].items()}
    sans = f"'{_value(tokens, 'font-sans')}', {DATA['fallback_sans']}"
    logo = tokens["$extensions"]["com.intellectualfrontiers.logo"]["lockup"]["files"]
    pick = lambda bg: min((f for f in logo if f["background"] == bg and f["file"].endswith(".png") and f["width"] >= 2 * DATA["lockup_width"]),  # noqa: E731
                          key=lambda f: f["width"])
    lw = DATA["lockup_width"]
    lf, df = pick("light"), pick("dark")
    lh = round(lw * lf["height"] / lf["width"])
    base = assets.rstrip("/")
    brand_name = html.escape(meta.get("from-name", "Intellectual Frontiers"))
    rows = []
    td = f"font-family:{sans};color:{light['text']};"
    for kind, text in blocks:
        if kind == "h1":
            rows.append(f'<tr><td class="em-text" style="{td}font-size:28px;line-height:34px;font-weight:700;padding:8px 0 12px;">{inline(text, light["link"])}</td></tr>')
        elif kind == "h2":
            rows.append(f'<tr><td class="em-text" style="{td}font-size:20px;line-height:26px;font-weight:700;padding:16px 0 8px;">{inline(text, light["link"])}</td></tr>')
        elif kind == "p":
            rows.append(f'<tr><td class="em-text" style="{td}font-size:17px;line-height:26px;padding:0 0 16px;">{inline(text, light["link"])}</td></tr>')
        elif kind == "li":
            rows.append(f'<tr><td class="em-text" style="{td}font-size:17px;line-height:26px;padding:0 0 8px 20px;">&#8226;&nbsp;{inline(text, light["link"])}</td></tr>')
        elif kind == "divider":
            rows.append(f'<tr><td style="padding:16px 0;"><div class="em-rule" style="border-top:1px solid {light["rule"]};height:1px;line-height:1px;font-size:1px;">&nbsp;</div></td></tr>')
        elif kind == "button":
            label, url = text.split("\x00")
            rows.append('<tr><td style="padding:8px 0 24px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>'
                        f'<td class="em-button" bgcolor="{light["button"]}" style="background:{light["button"]};border-radius:4px;">'
                        f'<a href="{html.escape(url)}" class="em-button-text" style="display:inline-block;padding:14px 24px;font-family:{sans};font-size:17px;line-height:20px;font-weight:700;color:{light["button_text"]};text-decoration:none;">{html.escape(label)}</a>'
                        "</td></tr></table></td></tr>")
    footer = (f'<tr><td class="em-muted em-rule" style="font-family:{sans};font-size:13px;line-height:20px;color:{light["muted"]};padding:24px 0 0;border-top:1px solid {light["rule"]};">'
              f'{html.escape(meta.get("address", ""))}<br>'
              + (f'You are receiving this because you subscribed. <a href="{{{{unsubscribe_url}}}}" style="color:{light["muted"]};text-decoration:underline;">Unsubscribe</a>.'
                 if TYPES.get(meta.get("type", ""), {}).get("unsubscribe") else "")
              + "</td></tr>")
    css = (f":root{{color-scheme:light dark;supported-color-schemes:light dark;}}"
           f"@media (prefers-color-scheme: dark){{"
           f".em-body,.em-card{{background:{dark['background']} !important;}}"
           f".em-text{{color:{dark['text']} !important;}}.em-text a{{color:{dark['link']} !important;}}"
           f".em-muted,.em-muted a{{color:{dark['muted']} !important;}}"
           f".em-button{{background:{dark['button']} !important;}}.em-button-text{{color:{dark['button_text']} !important;}}"
           f".em-rule{{border-color:{dark['rule']} !important;}}"
           f".em-logo-light{{display:none !important;}}.em-logo-dark{{display:block !important;max-height:none !important;}}}}")
    page = f"""<!doctype html>
<html lang="{meta.get('lang', 'en')}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>{html.escape(meta.get('subject', ''))}</title>
<style>{css}</style>
</head>
<body class="em-body" style="margin:0;padding:0;background:{light['background']};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{html.escape(meta.get('preheader', ''))}</div>
<table role="presentation" class="em-body" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{light['background']};">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" class="em-card" width="{DATA['width']}" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:{DATA['width']}px;background:{light['background']};">
<tr><td style="padding:0 0 24px;">
<img class="em-logo-light" src="{base}/{lf['file']}" width="{lw}" height="{lh}" alt="{brand_name}" style="display:block;border:0;width:{lw}px;height:auto;">
<img class="em-logo-dark" src="{base}/{df['file']}" width="{lw}" height="{lh}" alt="{brand_name}" style="display:none;max-height:0;border:0;width:{lw}px;height:auto;">
</td></tr>
{chr(10).join(rows)}
{footer}
</table>
</td></tr>
</table>
</body>
</html>
"""
    lines = []
    for i, (kind, text) in enumerate(blocks):
        if kind != "li" and i and blocks[i - 1][0] == "li":
            lines.append("")
        if kind in ("h1", "h2"):
            lines += [plain(text).upper() if kind == "h1" else plain(text), ""]
        elif kind == "p":
            lines += [plain(text), ""]
        elif kind == "li":
            lines.append(f"- {plain(text)}")
        elif kind == "divider":
            lines += ["", "----", ""]
        elif kind == "button":
            label, url = text.split("\x00")
            lines += [f"{label}: {url}", ""]
    lines += ["--", meta.get("address", "")]
    if TYPES.get(meta.get("type", ""), {}).get("unsubscribe"):
        lines.append("Unsubscribe: {{unsubscribe_url}}")
    txt = re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip() + "\n"
    out.write_text(page, encoding="utf-8")
    out.with_suffix(".txt").write_text(txt, encoding="utf-8")
    return page, txt


def _voice():
    path = SYSTEMS / "frontiers-written-voice" / "sweep.py"
    if not path.exists():
        return None
    spec = importlib.util.spec_from_file_location("written_voice_sweep", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def check(message: Path, brand_slug: str, assets: str) -> list[str]:
    """Every rule the message breaks, naming its requirement."""
    meta, blocks = parse(message.read_text(encoding="utf-8"))
    problems = []
    kind = meta.get("type")
    if kind not in TYPES:
        problems.append(f"no type {kind!r}; use one of {', '.join(TYPES)} (FR-005)")
    subject, pre = meta.get("subject", ""), meta.get("preheader", "")
    if not subject or len(subject) > DATA["subject_max"]:
        problems.append(f"a subject of {len(subject)} characters; it needs 1 to {DATA['subject_max']} (FR-006)")
    if not DATA["preheader"][0] <= len(pre) <= DATA["preheader"][1]:
        problems.append(f"a preheader of {len(pre)} characters; it needs {DATA['preheader'][0]} to {DATA['preheader'][1]} (FR-006)")
    if not meta.get("address"):
        problems.append("no postal address for the footer (FR-008)")
    if not any(k == "h1" for k, _ in blocks):
        problems.append("no heading stating the message's point (FR-006)")
    buttons = [t for k, t in blocks if k == "button"]
    if len(buttons) > 1:
        problems.append(f"{len(buttons)} calls to action; a message has at most one (FR-006)")
    for k, t in blocks:
        for url in re.findall(r"\]\((\S+?)\)", t) + ([t.split("\x00")[1]] if k == "button" else []):
            if not url.startswith("https://"):
                problems.append(f"a link that is not https: {url} (FR-007)")
    words = sum(len(t.split()) for k, t in blocks if k in ("p", "li", "h1", "h2"))
    if words > DATA["max_words"]:
        problems.append(f"{words} words, over {DATA['max_words']}; link to the full piece instead (FR-006)")
    brand = SYSTEMS / brand_slug
    tokens = _tokens(brand)
    for tone, roles in DATA["tones"].items():
        c = {k: color(v, tokens) for k, v in roles.items()}
        for fg, bg in (("text", "background"), ("muted", "background"), ("link", "background"), ("button_text", "button")):
            r = contrast(c[fg], c[bg])
            if r < DATA["min_contrast"]:
                problems.append(f"{tone}: {fg} on {bg} is {r:.2f}:1, below {DATA['min_contrast']}:1 (FR-009)")
    out = Path("/dev/null")
    try:
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "message.html"
            page, txt = build(message, out, brand_slug, assets)
    except (KeyError, ValueError) as e:
        return problems + [f"cannot be built: {e} (FR-010)"]
    size = len(page.encode("utf-8"))
    if size > DATA["max_bytes"]:
        problems.append(f"{size} bytes of HTML, over the {DATA['max_bytes']} some clients clip at (FR-010)")
    if "var(" in page or "<link" in page or "<script" in page:
        problems.append("the built HTML uses a custom property, an external stylesheet or a script (FR-010)")
    if TYPES.get(kind, {}).get("unsubscribe") and "{{unsubscribe_url}}" not in page:
        problems.append("no unsubscribe link (FR-008)")
    voice = _voice()
    if voice:
        patterns = voice.load([SYSTEMS / "frontiers-written-voice" / "patterns.json"])
        terms = voice.load_terms([SYSTEMS / "frontiers-written-voice" / "terms.json"])
        text = "\n\n".join([subject, pre] + [t.split("\x00")[0] for k, t in blocks if k != "divider"])
        fails, _ = voice.sweep(text, patterns, terms=terms)
        problems += [f"{f} (FR-011)" for f in fails]
    return problems


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("cmd", choices=("build", "check"))
    ap.add_argument("messages", nargs="+", type=Path)
    ap.add_argument("-o", "--out", type=Path)
    ap.add_argument("--brand", default="frontiers-brand")
    ap.add_argument("--assets", help="the public https URL the brand's files (its logos/) are served from; required to build")
    args = ap.parse_args(argv)
    if args.cmd == "build":
        if not (args.assets or "").startswith("https://"):
            ap.error("build needs --assets, the https URL the brand's files are served from")
        for m in args.messages:
            build(m, args.out or m.with_suffix(".html"), args.brand, args.assets)
        return 0
    failed = False
    for m in args.messages:
        for p in check(m, args.brand, args.assets or "https://assets.invalid/brand"):
            print(f"FAIL {m}: {p}")
            failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
