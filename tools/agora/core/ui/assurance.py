"""The assurance UI: the design systems' in-browser harnesses, served read-only (0042-agora FR-025).

It replaces `python3 -m http.server` for `design-systems/<slug>/assurance/index.html`: the whole of `design-systems/` is
served as it lies, so a harness finds its sibling files and the brand beside it, and the index lists each system's page
once for every brand that themes it. Nothing outside `design-systems/` is served, and no request that writes is taken.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from . import pages
from .forms import h
from .server import HARNESS_CSP, App, Reply, Request, Sse, static_file
from .theme import APP_CSS, DATASTAR, Theme, declared


class Assurance(App):
    name = "assurance"

    def __init__(self, registry: Any, home: Path, env: dict[str, str]):
        self.reg, self.home = registry, home
        decl = declared(registry)["assurance"]
        self.theme = Theme(home, decl["design_system"], decl["theme"])
        self.title = f"{registry.name} assurance"

    def writes(self) -> bool:
        return False

    def pages(self) -> list[dict[str, Any]]:
        """Each design system's in-browser page (assurance/index.html), once for every brand that themes it and once for a
        brand itself (0042 FR-025), as a harness's own runner chooses them (0014-design-systems FR-039)."""
        root = self.theme.root
        systems = sorted(p.name for p in root.iterdir() if p.is_dir()) if root.is_dir() else []
        brands = [s for s in systems if (root / s / "brand.css").is_file()]
        out = []
        for slug in systems:
            if not (root / slug / "assurance" / "index.html").is_file():
                continue
            base = f"/{slug}/assurance/index.html"
            pages = [{"brand": None, "path": base}] if slug in brands else [{"brand": b, "path": f"{base}?brand={b}"} for b in brands]
            out.append({"design_system": slug, "brand": slug in brands, "pages": pages})
        return out

    def index(self) -> Reply:
        rows = []
        for r in self.pages():
            links = " ".join(f'<a href="{h(p["path"])}">{h(p["brand"] or "its own page")}</a>' for p in r["pages"])
            kind = "a brand" if r["brand"] else "themed by each brand"
            rows.append(f'<tr data-show="$q === \'\' || \'{h(r["design_system"])}\'.includes($q.toLowerCase())"><td>{h(r["design_system"])}</td>'
                        f'<td>{kind}</td><td>{links}</td></tr>')
        table = ('<table><thead><tr><th>design system</th><th>themed</th><th>assurance page</th></tr></thead>'
                 f'<tbody>{"".join(rows)}</tbody></table>')
        main = (f'<header class="fc-article__head"><h1 class="fc-title">{h(self.title)}</h1><p class="fc-description">Each design system\'s '
                'in-browser harness, served from its own directory. A page runs its tests in your browser and reports them; '
                'a themed system is listed once for every brand that themes it.</p></header>'
                '<div class="fc-prose resource" data-signals="{q: \'\'}"><div class="fc-toolbar"><label class="fc-sr-only" for="q">Filter design systems</label>'
                '<input class="fc-input" id="q" type="search" placeholder="Filter design systems…" data-bind:q></div>'
                f'<div class="assurance-grid">{table}</div></div>')
        return Reply.html(pages.document(self.theme, name=self.title, title="Assurance", main=main, sidebar=None,
                                         crumbs=[(self.title, None)], nav=[("Assurance", "/", True)]))

    def handle(self, req: Request) -> Reply | Sse:
        p = req.path
        if p == "/":
            return self.index()
        if p == "/static/agora.css":
            return static_file(APP_CSS.parent, APP_CSS.name)
        if p == "/static/datastar.js":
            return static_file(DATASTAR.parent, DATASTAR.name)
        if p.startswith("/ds/"):
            return static_file(self.theme.root, p[4:], lambda rel: self.theme.allows(rel.as_posix()))
        rel = p.lstrip("/")
        root = self.theme.root
        if any(part.startswith(".") for part in rel.split("/")):
            return Reply.text("not found", 404)
        target = (root / rel)
        if target.is_dir():
            if not p.endswith("/"):
                return Reply(301, b"", "text/plain", {"Location": p + "/"}, None)
            rel += "index.html"
        return static_file(root, rel, csp=HARNESS_CSP)
