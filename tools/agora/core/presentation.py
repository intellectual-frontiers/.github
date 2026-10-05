"""How the command line presents itself to an editor (0041-command-line FR-064, FR-072): views, an icon and a view for each noun, which
fields of a list's rows are the label, the description, the status and the badge, a palette title for each command, and the patterns
in files that name a resource. Declared in the manifests (the root's `[views]`, a group's `[nouns.X]`, `[commands."x y"]` and
`[references.X]`), emitted in `command list`, validated here. Standard library only (0041 FR-005).
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from .registry import Registry

# The fixed vocabulary of a status (0041 FR-064). An editor maps each to a codicon and a theme color; a command line never names either.
STATUSES = ("ok", "warning", "error", "pending", "skipped", "info", "muted")
CODICONS = Path(__file__).resolve().parent.parent / "lib" / "codicons.txt"
ID = re.compile(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*")
TITLE = re.compile(r"[A-Z][A-Za-z0-9 /'-]*…?")
MAX_TITLE = 40
LIST_KEYS = ("command", "rows", "id", "label", "description", "status", "status_map", "badge", "tooltip")
NOUN_KEYS = ("icon", "view", "title", "list")
REF_KEYS = ("noun", "pattern", "value", "files", "text", "facts", "lens", "definition")


def codicons() -> set[str]:
    """The codicon ids an icon may name: @vscode/codicons' own glyph map, pinned in lib/codicons.txt."""
    if not CODICONS.is_file():
        return set()
    return {l.strip() for l in CODICONS.read_text(encoding="utf-8").splitlines() if l.strip() and not l.startswith("#")}


def needs_value(c: Any) -> bool:
    """Whether a command asks for something before it can run: the palette shows its title with an ellipsis (VS Code's convention)."""
    return any(a.required and not a.many for a in c.args) or any(o.required for o in c.options)


def problems(reg: Registry) -> list[str]:
    """What is wrong with the declarations themselves, read from the manifests alone (0041 FR-072)."""
    out: list[str] = []
    if not (reg.views or reg.command_meta or reg.references or any(reg.noun_meta.values())):
        return out  # an orchestrator that declares no presentation emits none (0041 FR-072)
    icons = codicons()
    if not icons:
        out.append(f"{CODICONS.name} lists no codicon: the icons cannot be checked (0041 FR-072)")
    bad_icon = lambda who, v: out.append(f"{who}: icon {v!r} is not a codicon id of @vscode/codicons (0041 FR-072)") if v not in icons else None
    for vid, v in sorted(reg.views.items()):
        who = f"view {vid}"
        if not ID.fullmatch(vid):
            out.append(f"{who}: an id is lowercase words joined by hyphens (0041 FR-072)")
        if not isinstance(v.get("title"), str) or not v["title"]:
            out.append(f"{who}: needs a title (0041 FR-072)")
        bad_icon(who, v.get("icon"))
        if not isinstance(v.get("order"), int):
            out.append(f"{who}: needs an integer order (0041 FR-072)")
        for k in v:
            if k not in ("title", "icon", "order", "description"):
                out.append(f"{who}: {k!r} is not a field of a view (0041 FR-064)")
    for noun in sorted(reg.nouns):
        meta = reg.noun_meta.get(noun, {})
        who = f"noun {noun}"
        for k in meta:
            if k not in NOUN_KEYS:
                out.append(f"{who}: {k!r} is not a field of a noun's presentation (0041 FR-064)")
        bad_icon(who, meta.get("icon"))
        if meta.get("view") is not None and meta["view"] not in reg.views:
            out.append(f"{who}: view {meta['view']!r} is declared by no manifest (0041 FR-072)")
        if "title" in meta and not (isinstance(meta["title"], str) and meta["title"]):
            out.append(f"{who}: its title is empty (0041 FR-072)")
        if "list" in meta:
            out += _list_problems(reg, noun, meta["list"])
    for cid, meta in sorted(reg.command_meta.items()):
        c = reg.commands.get(cid)
        who = f"command {cid}"
        if c is None:
            out.append(f"{who}: a manifest presents a command the registry does not have (0041 FR-072)")
            continue
        if c.group != meta["group"]:
            out.append(f"{who}: is presented by group {meta['group']}'s manifest and declared by group {c.group} (0041 FR-072)")
        for k in meta:
            if k not in ("title", "icon", "group"):
                out.append(f"{who}: {k!r} is not a field of a command's presentation (0041 FR-064)")
        t = meta.get("title")
        if t is not None:
            if not (isinstance(t, str) and TITLE.fullmatch(t)) or len(t) > MAX_TITLE:
                out.append(f"{who}: the title {t!r} is a verb and an object in capitals, at most {MAX_TITLE} characters, with nothing else (0041 FR-072)")
            elif t.endswith("…") != needs_value(c):
                out.append(f"{who}: the title {t!r} " + ("ends with an ellipsis though nothing is asked for" if t.endswith("…")
                                                        else "needs an ellipsis: the command asks for a value") + " (0041 FR-072)")
        if "icon" in meta:
            bad_icon(who, meta["icon"])
    for c in sorted(reg.commands.values(), key=lambda c: c.id):
        if "editor" in reg.surfaces_of(c) and not reg.command_meta.get(c.id, {}).get("title"):
            out.append(f"command {c.id}: is offered to the editor and has no palette title (0041 FR-072)")
    for rid, ref in sorted(reg.references.items()):
        out += _reference_problems(reg, rid, ref)
    return out


def _list_problems(reg: Registry, noun: str, lst: Any) -> list[str]:
    who = f"noun {noun}: list"
    if not isinstance(lst, dict):
        return [f"{who} is a table (0041 FR-064)"]
    out = [f"{who}: {k!r} is not a field of a list's presentation (0041 FR-064)" for k in lst if k not in LIST_KEYS]
    for k in ("command", "rows", "id", "label"):
        if not isinstance(lst.get(k), str) or not lst[k]:
            out.append(f"{who} needs {k} (0041 FR-072)")
    c = reg.commands.get(lst.get("command", ""))
    if c is None:
        out.append(f"{who}: the command {lst.get('command')!r} is not in the registry (0041 FR-072)")
    else:
        if c.category != "read" or "editor" not in reg.surfaces_of(c):
            out.append(f"{who}: {c.id} is not a read command the editor runs (0041 FR-072)")
        if needs_value(c):
            out.append(f"{who}: {c.id} asks for a value, so an editor cannot run it to list rows (0041 FR-072)")
    for k, v in (lst.get("status_map") or {}).items():
        if v not in STATUSES:
            out.append(f"{who}: the status {v!r} (for {k!r}) is not one of {', '.join(STATUSES)} (0041 FR-064)")
    if lst.get("status_map") and not lst.get("status"):
        out.append(f"{who}: a status_map needs the status field it maps (0041 FR-072)")
    if not isinstance(lst.get("tooltip", []), list):
        out.append(f"{who}: tooltip is a list of fields (0041 FR-072)")
    return out


def _reference_problems(reg: Registry, rid: str, ref: dict[str, Any]) -> list[str]:
    who = f"reference {rid}"
    out = [f"{who}: {k!r} is not a field of a reference (0041 FR-064)" for k in ref if k not in REF_KEYS]
    if ref.get("noun") not in reg.nouns or reg.find(f"{ref.get('noun')} show") is None:
        out.append(f"{who}: its noun {ref.get('noun')!r} has no show command (0041 FR-072)")
    groups = 0
    try:
        pat = str(ref.get("pattern", ""))
        if "(?P" in pat or "(?i" in pat or "(?<" in pat:
            out.append(f"{who}: the pattern uses a form only Python reads; it is read by an editor in JavaScript too (0041 FR-072)")
        groups = re.compile(pat).groups
        if not pat:
            out.append(f"{who}: needs a pattern (0041 FR-072)")
    except re.error as e:
        out.append(f"{who}: the pattern does not compile: {e} (0041 FR-072)")
    value = ref.get("value", "$1")
    for n in re.findall(r"\$(\d)", str(value)):
        if int(n) < 1 or int(n) > groups:
            out.append(f"{who}: the value {value!r} names group {n}, which the pattern lacks (0041 FR-072)")
    if not (isinstance(ref.get("files"), list) and ref["files"] and all(isinstance(f, str) for f in ref["files"])):
        out.append(f"{who}: files is a list of globs (0041 FR-072)")
    for k in ("facts", "lens", "definition"):
        if k in ref and not (isinstance(ref[k], list) and all(isinstance(f, str) for f in ref[k])):
            out.append(f"{who}: {k} is a list of fields (0041 FR-072)")
    return out


def emit(reg: Registry) -> dict[str, Any]:
    """The `presentation` of `command list` (0041 FR-064): everything an editor needs to draw this command line's views and rows."""
    views = [{"id": vid, **{k: v[k] for k in ("title", "icon", "order", "description") if k in v}}
             for vid, v in sorted(reg.views.items(), key=lambda kv: (kv[1].get("order", 0), kv[0]))]
    nouns = []
    for noun in sorted(reg.nouns):
        meta = reg.noun_meta.get(noun)
        if not meta:
            continue
        row: dict[str, Any] = {"noun": noun, "title": meta.get("title", noun), "icon": meta["icon"]}
        if "view" in meta:
            row["view"] = meta["view"]
        if "list" in meta:
            row["list"] = {k: v for k, v in meta["list"].items() if k in LIST_KEYS}
        nouns.append(row)
    refs = [{"id": rid, **{k: v for k, v in ref.items() if k in REF_KEYS}} for rid, ref in sorted(reg.references.items())]
    return {"views": views, "nouns": nouns, "references": refs}


def of_command(reg: Registry, cid: str) -> dict[str, Any]:
    """A command's own presentation: its palette title and, where it has one, its icon."""
    meta = reg.command_meta.get(cid, {})
    return {k: meta[k] for k in ("title", "icon") if k in meta}


def data_problems(ctx: Any) -> list[str]:
    """What the declarations say about data, checked against the data: each list's fields exist in its rows, a status's values
    are mapped, and a reference's fields exist in the resource it shows (0041 FR-072). It runs the read commands it names."""
    from . import execute

    reg = ctx.registry
    out: list[str] = []
    runner = lambda cmd, extra=None: next(iter(execute.execute(ctx, cmd, _values(cmd, extra or {}))))
    sample: dict[str, Any] = {}
    for noun in sorted(reg.noun_meta):
        lst = reg.noun_meta[noun].get("list")
        if not isinstance(lst, dict) or reg.commands.get(lst.get("command", "")) is None:
            continue
        who = f"noun {noun}: list"
        res = runner(reg.commands[lst["command"]])
        if res.kind == "error" or res.exit:
            continue  # a list that cannot run (a clone without its data) is that command's own failure, not a mismatch with its declaration
        rows = res.data.get(lst["rows"])
        if not isinstance(rows, list):
            out.append(f"{who}: the data of {lst['command']} has no list {lst['rows']!r} (0041 FR-072)")
            continue
        if not rows:
            continue
        sample[noun] = rows[0]
        fields = [lst[k] for k in ("id", "label", "description", "status", "badge") if lst.get(k)] + list(lst.get("tooltip", []))
        for f in dict.fromkeys(fields):
            missing = [i for i, r in enumerate(rows) if not isinstance(r, dict) or f not in r]
            if missing:
                out.append(f"{who}: the field {f!r} is absent from {len(missing)} of {len(rows)} rows of {lst['command']} (0041 FR-072)")
        if lst.get("status"):
            known = lst.get("status_map") or {}
            for v in sorted({str(r.get(lst["status"])) for r in rows if isinstance(r, dict)}):
                if not known and v in STATUSES:
                    continue
                if v not in known:
                    out.append(f"{who}: the status {v!r} of {lst['command']} is mapped to no status of the vocabulary (0041 FR-072)")
    for rid, ref in sorted(reg.references.items()):
        noun = ref.get("noun")
        row = sample.get(noun)
        lst = reg.noun_meta.get(noun, {}).get("list")
        show = reg.find(f"{noun} show")
        if row is None or not lst or show is None:
            continue
        res = runner(show, {show.args[0].name: row.get(lst["id"])} if show.args else {})
        if res.kind == "error" or res.exit:
            continue
        for k in [ref.get("text")] + list(ref.get("facts", [])) + list(ref.get("lens", [])) + list(ref.get("definition", [])):
            if k and k not in res.data:
                out.append(f"reference {rid}: the data of {show.id} has no field {k!r} (0041 FR-072)")
    return out


def _values(cmd: Any, given: dict[str, Any]) -> dict[str, Any]:
    v: dict[str, Any] = {a.name: [] if a.many else None for a in cmd.args}
    for o in cmd.options:
        v[o.dest] = [] if o.multiple else (False if o.type is None else o.default)
    v.update(given)
    return v
