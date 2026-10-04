"""The AsciiDoc a course is written in (frontiers-course spec FR-003), read and rendered without Asciidoctor.

A course file is an AsciiDoc document: a header (`= Title`, then `:name: value` attribute entries), then blocks:

    == Heading                      sections, level 2 to 6 (`==` to `======`)
    a paragraph                     lines until a blank line
    * point / . step                lists; `**` nests one level (in an assessment, a choice's feedback)
    * [x] choice / * [ ] choice     a checklist (an item's choices)
    image::figures/x.svg[Alt text]  a figure
    [quote, Who]                    a quotation
    ____
    words
    ____
    [#id,name=value,...]            attributes of the block or section that follows
    [.feedback]                     a role on the paragraph that follows
    // a comment

Inline: *strong*, _emphasis_, `code`, https://url[text], link:path[text], image:path[alt]. Anything else a
course might reach for (tables, includes, passthroughs, admonitions, other delimited blocks) is refused by
`unsupported()`, so what a course says is what every target shows. Standard library only.
"""
from __future__ import annotations

import html
import re

LINK = re.compile(r"(?<![\w/])(?:(https://[^\s\[\]]+)|link:([^\s\[\]]+))\[([^\]]*)\]")
IMAGE_INLINE = re.compile(r"(?<!:)image:([^\s\[:][^\s\[]*)\[([^\]]*)\]")
IMAGE_BLOCK = re.compile(r"^image::([^\s\[]+)\[([^\]]*)\]$")
ATTRS = re.compile(r"^\[([^\]]*)\]$")
UNSUPPORTED = [
    (re.compile(r"^\|===", re.M), "a table"),
    (re.compile(r"^include::", re.M), "an include"),
    (re.compile(r"^(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION): ", re.M), "an admonition"),
    (re.compile(r"^(?:----|\.\.\.\.|====|\*\*\*\*|\+\+\+\+|--)\s*$", re.M), "a delimited block other than a quotation"),
    (re.compile(r"pass:\[|\+\+\+"), "a passthrough"),
    (re.compile(r"^:[\w-]+:", re.M), "an attribute entry outside the header"),
    (re.compile(r"\{[\w-]+\}"), "an attribute reference"),
]


def header(text: str) -> tuple[str, dict, str]:
    """(title, attributes, body) of an AsciiDoc document."""
    lines = text.lstrip("﻿").splitlines()
    i = 0
    while i < len(lines) and (not lines[i].strip() or lines[i].startswith("//")):
        i += 1
    if i >= len(lines) or not lines[i].startswith("= "):
        raise ValueError("no document title (a first line starting `= `)")
    title, attrs = lines[i][2:].strip(), {}
    i += 1
    while i < len(lines) and lines[i].strip():
        if m := re.match(r"^:([\w-]+):\s*(.*)$", lines[i]):
            attrs[m.group(1)] = m.group(2).strip()
        elif not lines[i].startswith("//"):
            break
        i += 1
    return title, attrs, "\n".join(lines[i:]).strip()


def unsupported(body: str) -> list[str]:
    """The constructs in `body` this subset does not render."""
    return [name for rx, name in UNSUPPORTED if rx.search(body)]


def block_attrs(spec: str) -> dict:
    """`#id,.role,name=value,name="a, b"` → {"id", "role", "positional": [...], name: value}."""
    out: dict = {"positional": []}
    for part in re.findall(r'(?:[^,"]|"[^"]*")+', spec):
        part = part.strip()
        if not part:
            continue
        for m in re.finditer(r"([#.])([\w-]+)", part if part[0] in "#." else ""):
            out["id" if m.group(1) == "#" else "role"] = m.group(2)
        if part[0] in "#.":
            continue
        if "=" in part:
            k, v = part.split("=", 1)
            out[k.strip()] = v.strip().strip('"')
        else:
            out["positional"].append(part.strip('"'))
    return out


def blocks(body: str) -> list[dict]:
    """The body's blocks: {"kind": section|para|list|checklist|image|quote, ...} with their attributes."""
    out: list[dict] = []
    lines = body.splitlines()
    i, pending = 0, {}
    while i < len(lines):
        line = lines[i]
        s = line.strip()
        if not s or s.startswith("//"):
            i += 1
            continue
        if (m := ATTRS.match(s)) and not IMAGE_BLOCK.match(s):
            pending = {**pending, **block_attrs(m.group(1))}
            i += 1
            continue
        if m := re.match(r"^(={2,6}) (.+)$", s):
            out.append({"kind": "section", "level": len(m.group(1)), "text": m.group(2).strip(), "attrs": pending})
        elif m := IMAGE_BLOCK.match(s):
            out.append({"kind": "image", "src": m.group(1), "alt": block_attrs(m.group(2))["positional"][0] if m.group(2) else "", "attrs": pending})
        elif s == "____":
            j = i + 1
            while j < len(lines) and lines[j].strip() != "____":
                j += 1
            who = pending.get("positional", [None, None])
            out.append({"kind": "quote", "text": " ".join(x.strip() for x in lines[i + 1:j] if x.strip()),
                        "who": who[1] if len(who) > 1 else "", "attrs": pending})
            i = j + 1
            pending = {}
            continue
        elif re.match(r"^(\*{1,2}|\.{1,2}) ", s):
            items: list[dict] = []
            ordered = s.startswith(".")
            while i < len(lines) and (m := re.match(r"^(\*{1,2}|\.{1,2}) (.+)$", lines[i].strip())):
                depth, text = len(m.group(1)), m.group(2).strip()
                i += 1
                while i < len(lines) and lines[i].strip() and not re.match(r"^(\*{1,2}|\.{1,2}) |^\[|^={2,6} |^image::", lines[i].strip()):
                    text += " " + lines[i].strip()
                    i += 1
                if depth == 2 and items:
                    items[-1]["sub"].append(text)
                else:
                    c = re.match(r"^\[([ xX*])\] (.+)$", text)
                    items.append({"text": c.group(2) if c else text, "checked": (c.group(1) != " ") if c else None, "sub": []})
            checklist = all(it["checked"] is not None for it in items)
            out.append({"kind": "checklist" if checklist else "list", "ordered": ordered, "items": items, "attrs": pending})
            pending = {}
            continue
        else:
            para = [s]
            i += 1
            while i < len(lines) and lines[i].strip() and not re.match(r"^(\*{1,2}|\.{1,2}) |^\[|^={2,6} |^image::|^____$|^//", lines[i].strip()):
                para.append(lines[i].strip())
                i += 1
            out.append({"kind": "para", "text": " ".join(para), "attrs": pending})
            pending = {}
            continue
        pending = {}
        i += 1
    return out


def plain(text: str) -> str:
    """Inline markup removed: what a reader reads."""
    t = IMAGE_INLINE.sub(lambda m: m.group(2), text)
    t = LINK.sub(lambda m: m.group(3) or m.group(1) or m.group(2), t)
    t = re.sub(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])", r"\1", t)
    t = re.sub(r"(?<![\w_])_([^_\n]+)_(?![\w_])", r"\1", t)
    return re.sub(r"`([^`]+)`", r"\1", t)


def text_of(body: str) -> str:
    """The body as plain prose, for counting words and sweeping voice."""
    parts = []
    for b in blocks(body):
        if b["kind"] in ("section", "para", "quote"):
            parts.append(plain(b["text"]))
        elif b["kind"] in ("list", "checklist"):
            parts += [plain(it["text"]) + "." for it in b["items"]] + [plain(s) for it in b["items"] for s in it["sub"]]
    return "\n\n".join(parts)


def images(body: str) -> list[tuple[str, str]]:
    """(src, alt) of every image, block or inline."""
    out = [(b["src"], b["alt"]) for b in blocks(body) if b["kind"] == "image"]
    return out + [(m.group(1), m.group(2)) for m in IMAGE_INLINE.finditer(body)]


def links(body: str) -> list[tuple[str, str]]:
    """(target, text) of every link."""
    return [(m.group(1) or m.group(2), m.group(3)) for m in LINK.finditer(body)]


def inline(text: str, asset) -> str:
    out, pos = [], 0
    pattern = re.compile(f"{IMAGE_INLINE.pattern}|{LINK.pattern}")
    for m in pattern.finditer(text):
        out.append(_marks(text[pos:m.start()]))
        if m.group(1) is not None:
            out.append(f'<img src="{html.escape(asset(m.group(1)))}" alt="{html.escape(m.group(2))}">')
        else:
            target = m.group(3) or asset(m.group(4))
            out.append(f'<a href="{html.escape(target)}">{_marks(m.group(5) or target)}</a>')
        pos = m.end()
    out.append(_marks(text[pos:]))
    return "".join(out)


def _marks(text: str) -> str:
    t = html.escape(text, quote=False)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    t = re.sub(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])", r"<strong>\1</strong>", t)
    return re.sub(r"(?<![\w_])_([^_\n]+)_(?![\w_])", r"<em>\1</em>", t)


def render(body: str, asset, shift: int = 0) -> str:
    """The body as HTML: a section of level n (`==` is 2) becomes h(n + shift)."""
    out = []
    for b in blocks(body):
        k = b["kind"]
        if k == "section":
            n = min(b["level"] + shift, 6)
            out.append(f"<h{n}>{inline(b['text'], asset)}</h{n}>")
        elif k == "para":
            out.append(f"<p>{inline(b['text'], asset)}</p>")
        elif k == "image":
            out.append(f'<figure><img src="{html.escape(asset(b["src"]))}" alt="{html.escape(b["alt"])}"></figure>')
        elif k == "quote":
            cite = f"<footer>{html.escape(b['who'])}</footer>" if b["who"] else ""
            out.append(f"<blockquote><p>{inline(b['text'], asset)}</p>{cite}</blockquote>")
        else:
            tag = "ol" if b["ordered"] else "ul"
            items = "".join(f"<li>{inline(it['text'], asset)}" + (f"<{tag}>" + "".join(f"<li>{inline(s, asset)}</li>" for s in it["sub"]) + f"</{tag}>" if it["sub"] else "") + "</li>"
                            for it in b["items"])
            out.append(f"<{tag}>{items}</{tag}>")
    return "\n".join(out)
