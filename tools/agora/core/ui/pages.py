"""The page a UI sends: the console design system's markup contract (chrome.md) around a resource's HTML rendering."""
from __future__ import annotations

import json
from typing import Any

from .forms import h
from .theme import Theme


def head(theme: Theme, title: str, name: str) -> str:
    assets = theme.brand_assets()
    icon = f'<link rel="icon" href="{h(assets["favicon"])}">' if assets.get("favicon") else ""
    css = "".join(f'<link rel="stylesheet" href="{h(u)}">' for u in theme.stylesheets())
    return ('<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width, initial-scale=1">'
            f'<title>{h(title)} · {h(name)}</title>{icon}{css}'
            f'<script src="{h(theme.script)}" defer></script>'
            '<script type="module" src="/static/datastar.js"></script></head>')


def brand_link(theme: Theme, name: str) -> str:
    a = theme.brand_assets()
    img = (f'<img src="{h(a["logo"])}" width="{a["width"]}" height="{a["height"]}" alt="">' if a.get("logo") else "")
    return f'<a class="fc-brand" href="/">{img}<span class="fc-brand__name">{h(name)}</span></a>'


def tree(items: list[dict[str, Any]]) -> str:
    """A sidebar tree: {"label": text} is a section label; {"href", "text", "current"} a link; {"folder", "items", "open"} a folder."""
    out = []
    for it in items:
        if "label" in it:
            out.append(f'<li class="fc-tree__label">{h(it["label"])}</li>')
        elif "folder" in it:
            out.append(f'<li><details{" open" if it.get("open") else ""}><summary>{h(it["folder"])}</summary><ul>{tree(it["items"])}</ul></details></li>')
        else:
            cur = ' aria-current="page"' if it.get("current") else ""
            out.append(f'<li><a class="fc-tree__link" href="{h(it["href"])}"{cur}>{h(it["text"])}</a></li>')
    return "".join(out)


def document(theme: Theme, *, name: str, title: str, main: str, sidebar: list[dict[str, Any]] | None, crumbs: list[tuple[str, str | None]],
             description: str = "", search: list[dict[str, Any]] | None = None, nav: list[tuple[str, str, bool]] | None = None,
             foot: str = "") -> str:
    """One complete page. `main` is the page's content, already markup; the h1 is the resource's own."""
    index = json.dumps(search or []).replace("</", "<\\/")
    cur_attr = ' aria-current="page"'
    links = "".join(f'<a class="fc-nav__link" href="{h(href)}"{cur_attr if cur else ""}>{h(text)}</a>' for text, href, cur in nav or [])
    crumb = "".join(f'<li><a href="{h(href)}">{h(text)}</a></li>' if href else f'<li><span aria-current="page">{h(text)}</span></li>' for text, href in crumbs)
    brand = brand_link(theme, name)
    side = ""
    toggle = ""
    if sidebar is not None:  # the docs layout: a sidebar of the registry; the home layout has none
        toggle = ('<button class="fc-btn fc-nav__toggle" type="button" data-variant="ghost" data-size="icon" data-fc-sidebar-toggle '
                  'aria-controls="fc-sidebar" aria-expanded="false" aria-label="Open navigation">☰</button>')
        side = ('<aside class="fc-sidebar" id="fc-sidebar" aria-label="Sidebar"><div class="fc-sidebar__head">'
                f'{brand}<button class="fc-btn fc-sidebar__collapse" type="button" data-variant="ghost" data-size="icon" data-fc-sidebar-collapse '
                'aria-label="Collapse sidebar" aria-expanded="true">‹</button></div>'
                f'<div class="fc-sidebar__tools"><fc-search placeholder="Search commands…" label="Search commands"><script type="application/json">{index}</script></fc-search></div>'
                f'<div class="fc-sidebar__scroll"><nav class="fc-tree" aria-label="Registry"><ul>{tree(sidebar)}</ul></nav></div>'
                f'<div class="fc-sidebar__foot"><span>{h(foot)}</span></div></aside>'
                '<button class="fc-btn fc-sidebar-expand" type="button" data-size="icon" data-fc-sidebar-collapse aria-label="Expand sidebar" aria-expanded="false">›</button>')
    layout = "docs" if sidebar is not None else "home"
    return (head(theme, title, name) + '<body><a class="fc-skip" href="#main">Skip to content</a>'
            f'<fc-shell data-layout="{layout}">'
            f'<header class="fc-nav">{toggle}{brand}'
            f'<nav class="fc-nav__links" aria-label="Primary">{links}</nav><span class="fc-nav__spacer"></span></header>'
            f'{side}'
            '<div class="fc-page" id="page"><main class="fc-article" id="main">'
            f'<nav class="fc-crumbs" aria-label="Breadcrumb"><ol>{crumb}</ol></nav>'
            f'{main}</main></div></fc-shell></body></html>')
