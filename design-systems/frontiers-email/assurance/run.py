#!/usr/bin/env python3
"""frontiers-email's assurance harness (spec FR-012): under every brand here, each tone's roles meet 4.5:1; every
message in fixtures/pass/ passes mail.py check and builds to HTML that is 600px, table-laid, styled inline with
no custom property, stylesheet link or script, under the size clients clip at, with every image sized and
described, and a plain-text alternative carrying every link; every message in fixtures/fail/ is refused for the
reason fixtures/expected.json names; and the ontology registers this design system.

    python3 assurance/run.py

Standard library only.
"""
from __future__ import annotations

import json
import re
import sys
import tempfile
from html.parser import HTMLParser
from pathlib import Path

HERE = Path(__file__).resolve().parent
SYSTEM = HERE.parent
sys.path.insert(0, str(SYSTEM))
import mail  # noqa: E402

ONTOLOGY = SYSTEM.parent.parent / "ontology" / "ifcore.ttl"
ASSETS = "https://assets.invalid/brand"


class Shape(HTMLParser):
    VOID = {"img", "br", "meta", "hr", "link", "input"}

    def __init__(self) -> None:
        super().__init__()
        self.tables, self.imgs, self.links, self.unstyled = [], [], [], []
        self.stack: list[tuple[str, str]] = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "table":
            self.tables.append(a)
        elif tag == "img":
            self.imgs.append(a)
        elif tag == "a":
            self.links.append(a.get("href", ""))
        if tag not in self.VOID:
            self.stack.append((tag, a.get("style") or ""))

    def handle_endtag(self, tag):
        while self.stack:
            if self.stack.pop()[0] == tag:
                break

    def handle_data(self, data):
        tags = [t for t, _ in self.stack]
        if not data.strip() or "body" not in tags or {"style", "title"} & set(tags):
            return
        styles = [st for _, st in self.stack]
        if any("display:none" in st.replace(" ", "") for st in styles):
            return
        if not (any("font-family" in st for st in styles) and any(re.search(r"(^|;)\s*color:", st) for st in styles)):
            self.unstyled.append(data.strip()[:40])


def main() -> int:
    passed, failed = 0, []

    def check(ok: bool, what: str) -> None:
        nonlocal passed
        if ok:
            passed += 1
        else:
            failed.append(what)

    raw = (SYSTEM / "email.json").read_text(encoding="utf-8")
    check(not re.findall(r"#[0-9a-fA-F]{3,8}\b", raw), "email.json holds a color literal (0014-design-systems FR-044)")
    brands = sorted(p.parent for p in SYSTEM.parent.glob("*/brand.css"))
    for brand in brands:
        tokens = mail._tokens(brand)
        for tone, roles in mail.DATA["tones"].items():
            c = {k: mail.color(v, tokens) for k, v in roles.items()}
            for fg, bg in (("text", "background"), ("muted", "background"), ("link", "background"), ("button_text", "button")):
                r = mail.contrast(c[fg], c[bg])
                check(r >= mail.DATA["min_contrast"], f"{brand.name}, {tone}: {fg} on {bg} is {r:.2f}:1 (FR-009)")
        for path in sorted((HERE / "fixtures" / "pass").glob("*.md")):
            problems = mail.check(path, brand.name, ASSETS)
            check(not problems, f"pass/{path.name} under {brand.name}: {'; '.join(problems)}")
            with tempfile.TemporaryDirectory() as tmp:
                page, txt = mail.build(path, Path(tmp) / "m.html", brand.name, ASSETS)
            shape = Shape()
            shape.feed(page)
            where = f"pass/{path.name} under {brand.name}"
            check(any(t.get("width") == str(mail.DATA["width"]) for t in shape.tables), f"{where}: no {mail.DATA['width']}px table (FR-010)")
            check(all(t.get("role") == "presentation" for t in shape.tables), f"{where}: a layout table without role=presentation (FR-010)")
            check(not shape.unstyled, f"{where}: text without its font and color inline: {shape.unstyled} (FR-010)")
            check(all(i.get("alt") and i.get("width") and i.get("height") for i in shape.imgs), f"{where}: an image without alt, width or height (FR-007)")
            check(all(int(i["width"]) >= 100 for i in shape.imgs), f"{where}: a lockup narrower than the brand's 100px minimum (FR-007)")
            check(all(i["src"].startswith(ASSETS) for i in shape.imgs), f"{where}: an image not served from --assets (FR-007)")
            check("var(" not in page and "<link" not in page and "<script" not in page, f"{where}: a custom property, stylesheet link or script (FR-010)")
            check(len(page.encode()) <= mail.DATA["max_bytes"], f"{where}: over {mail.DATA['max_bytes']} bytes (FR-010)")
            body_links = [l for l in shape.links if l.startswith("https://")]
            check(all(l in txt for l in body_links), f"{where}: the plain text leaves out a link (FR-010)")
            check("prefers-color-scheme: dark" in page and 'name="color-scheme"' in page, f"{where}: no dark mode (FR-009)")
        expected = json.loads((HERE / "fixtures" / "expected.json").read_text(encoding="utf-8"))
        fails = sorted((HERE / "fixtures" / "fail").glob("*.md"))
        check({p.name for p in fails} == {k for k in expected if not k.startswith("$")}, "fixtures/expected.json and fixtures/fail/ name different messages")
        for path in fails:
            problems = mail.check(path, brand.name, ASSETS)
            want = expected.get(path.name, "")
            check(bool(want) and any(want in p for p in problems), f"fail/{path.name} under {brand.name} should be refused for {want!r}; it reported: {'; '.join(problems) or 'nothing'}")
    if ONTOLOGY.exists():
        ttl = ONTOLOGY.read_text(encoding="utf-8")
        block = re.search(r'^ifcore:\w+ a ifcore:DesignSystem ;[^.]*?dcterms:identifier "frontiers-email"[\s\S]*?\.\n', ttl, re.M)
        text = block.group(0) if block else ""
        check("ifcore:EmailDesignSystemKind" in text, "ifcore.ttl does not register frontiers-email as an email design system (FR-001)")
        for t in ("NewsletterEmail", "AnnouncementEmail", "InvitationEmail", "NotificationEmail"):
            check(f"ifcore:{t}" in text, f"ifcore.ttl does not classify frontiers-email by ifcore:{t} (FR-001)")
    print(f"{'ok  ' if not failed else 'FAIL'} frontiers-email, themed by {', '.join(b.name for b in brands)}  ({passed} passed{', ' + str(len(failed)) + ' failed' if failed else ''})")
    for f in failed:
        print(f"     ✗ {f}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
