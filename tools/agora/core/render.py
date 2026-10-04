"""The three renderings of a resource: text, JSON, HTML (0041-command-line FR-018, FR-019).

All three are views of Resource.to_dict(): nothing appears in one that the resource does not carry. Text may omit
fields a person does not need; JSON never does.
"""
from __future__ import annotations

import html
import json
from typing import Any

from .resource import Resource

TEXT_ROWS = 40  # a table or list longer than this is cut in text, saying how many it left out; JSON is whole


def to_json(res: Resource, ctx: Any) -> str:
    return json.dumps(res.to_dict(ctx.registry, ctx.audience, ctx.name), indent=2, ensure_ascii=False)


def to_ndjson_line(res: Resource, ctx: Any) -> str:
    return json.dumps(res.to_dict(ctx.registry, ctx.audience, ctx.name), ensure_ascii=False)


# text ----------------------------------------------------------------------------------------------------------
def _scalar(v: Any) -> bool:
    return v is None or isinstance(v, (str, int, float, bool))


def _s(v: Any) -> str:
    return "" if v is None else ("yes" if v is True else "no" if v is False else str(v))


def _lines(value: Any, indent: int, path: str, res: Resource) -> list[str]:
    pad = "  " * indent
    out: list[str] = []
    if isinstance(value, dict):
        for k, v in value.items():
            p = f"{path}.{k}" if path else k
            if _scalar(v):
                out.append(f"{pad}{k}: {_s(v)}")
            elif isinstance(v, list) and all(_scalar(x) for x in v):
                out.append(f"{pad}{k}: {', '.join(_s(x) for x in v) if v else '(none)'}")
            elif isinstance(v, list):
                out.append(f"{pad}{k}:")
                out += _lines(v, indent + 1, p, res)
            else:
                out.append(f"{pad}{k}:" if v else f"{pad}{k}: (none)")
                out += _lines(v, indent + 1, p, res)
    elif isinstance(value, list):
        if value and all(isinstance(x, dict) and all(_scalar(c) or (isinstance(c, list) and all(_scalar(y) for y in c))
                                                       for c in x.values()) for x in value):
            cols = res.columns.get(path) or list(dict.fromkeys(k for x in value for k in x))
            rows = [[", ".join(_s(y) for y in x[c]) if isinstance(x.get(c), list) else _s(x.get(c)) for c in cols]
                    for x in value[:TEXT_ROWS]]
            widths = [max(len(c), *(len(r[i]) for r in rows)) for i, c in enumerate(cols)]
            out.append(pad + "  ".join(c.ljust(w) for c, w in zip(cols, widths)).rstrip())
            out += [pad + "  ".join(c.ljust(w) for c, w in zip(r, widths)).rstrip() for r in rows]
            if len(value) > TEXT_ROWS:
                out.append(f"{pad}... {len(value) - TEXT_ROWS} more (--json has all)")
        else:
            for x in value[:TEXT_ROWS]:
                if _scalar(x):
                    out.append(f"{pad}- {_s(x)}")
                else:
                    sub = _lines(x, indent + 1, path, res)
                    out.append(f"{pad}-" + (" " + sub[0].lstrip() if sub else ""))
                    out += sub[1:]
            if len(value) > TEXT_ROWS:
                out.append(f"{pad}... {len(value) - TEXT_ROWS} more (--json has all)")
    return out


def to_text(res: Resource, ctx: Any) -> str:
    d = res.to_dict(ctx.registry, ctx.audience, ctx.name)
    out = [f"{res.kind}: {res.id}", f"audience: {d['audience']}"]
    if res.text is not None:
        out += res.text(res).splitlines()
    else:
        out += _lines(res.data, 0, "", res)
    if d["links"]:
        out.append("links:")
        out += [f"  {l['rel']}: {l['cli']}" for l in d["links"][:15]]
        if len(d["links"]) > 15:
            out.append(f"  ... {len(d['links']) - 15} more (--json has all)")
    if d["actions"]:
        out.append("next:")
        for a in d["actions"]:
            tail = f"  [{a['category']}]" if a["category"] else ""
            out.append(f"  {a['label']}: {a['cli']}{tail}" + ("" if a["enabled"] else f"  (disabled: {a.get('reason', '')})"))
    return "\n".join(out)


# html ----------------------------------------------------------------------------------------------------------
def _h(v: Any) -> str:
    return html.escape(_s(v))


def _html_value(value: Any, path: str, res: Resource) -> str:
    if _scalar(value):
        return f"<span>{_h(value)}</span>"
    if isinstance(value, dict):
        rows = "".join(f"<dt>{_h(k)}</dt><dd>{_html_value(v, f'{path}.{k}' if path else k, res)}</dd>" for k, v in value.items())
        return f"<dl>{rows}</dl>"
    if all(isinstance(x, dict) and all(_scalar(c) for c in x.values()) for x in value) and value:
        cols = res.columns.get(path) or list(dict.fromkeys(k for x in value for k in x))
        head = "".join(f"<th>{_h(c)}</th>" for c in cols)
        body = "".join("<tr>" + "".join(f"<td>{_h(x.get(c))}</td>" for c in cols) + "</tr>" for x in value)
        return f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>"
    return "<ul>" + "".join(f"<li>{_html_value(x, path, res)}</li>" for x in value) + "</ul>"


def to_html(res: Resource, ctx: Any) -> str:
    """The resource as a page fragment for a web UI: markup only, no script, no remote reference."""
    d = res.to_dict(ctx.registry, ctx.audience, ctx.name)
    parts = [f'<article class="resource" data-kind="{_h(res.kind)}" data-id="{_h(res.id)}" data-audience="{_h(d["audience"])}">',
             f"<header><h1>{_h(res.kind)}: {_h(res.id)}</h1><p class=\"audience\">audience: {_h(d['audience'])}</p></header>",
             f'<section class="data">{_html_value(res.data, "", res)}</section>']
    if d["links"]:
        parts.append('<nav class="links"><ul>' + "".join(
            f'<li><span class="rel">{_h(l["rel"])}</span> <code>{_h(l["cli"])}</code></li>' for l in d["links"]) + "</ul></nav>")
    if d["actions"]:
        parts.append('<footer class="actions"><ul>' + "".join(
            f'<li data-command="{_h(a["command"])}" data-category="{_h(a["category"])}"'
            f'{"" if a["enabled"] else " data-disabled"}><span class="label">{_h(a["label"])}</span> '
            f'<code>{_h(a["cli"])}</code>{"" if a["enabled"] else " <em>" + _h(a.get("reason", "")) + "</em>"}</li>'
            for a in d["actions"]) + "</ul></footer>")
    parts.append("</article>")
    return "\n".join(parts)


def to_html_page(res: Resource, ctx: Any) -> str:
    return ("<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\">"
            f"<title>{_h(res.kind)}: {_h(res.id)}</title></head><body>\n{to_html(res, ctx)}\n</body></html>")
