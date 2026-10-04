"""The layout group: the print design system's layouts, as commands and as generated documentation (0042-agora FR-006, FR-015, FR-017).

The rules live in the design system's own `latex/layout.py`, which stays in `design-systems/frontiers-print/`
(0014-design-systems FR-005): the commands and the generator call it through importlib, `print-layout-docs` on a scratch
copy of each Markdown file, compared with the file. Standard library only.
"""
from __future__ import annotations

import importlib.util
import shutil
import tempfile
import warnings
from pathlib import Path
from typing import Any

from agora.core import AgoraError, Arg, ArgType, Call, Ctx, Link, Opt, Resource, command, next_command
from agora.core import files
from agora.core.generate import Generated
from agora.core.registry import generator
from agora.lib import assurance, print_layouts

MARKERS = ("<!-- layouts:begin", "<!-- typefaces:begin")


class _Layout(ArgType):
    name = "LAYOUT"
    doc = "a print layout's name or alias, from layouts.json: two-column, nature, jama"

    def choices(self, ctx: Ctx) -> list[str]:
        return print_layouts.names(ctx.root)

    def validate(self, ctx: Ctx, value: str) -> str:
        canon = print_layouts.canonical(ctx.root, value)
        if canon is None:
            raise ValueError(f"{value!r} is not a layout or an alias of one")
        return canon

    def resolve(self, ctx: Ctx, value: str) -> Call:
        return Call("layout show", {"layout": value})


LAYOUT = _Layout()


@command("layout list", category="read", help="List the print design system's article layouts: status, aliases and summary")
def layout_list(ctx: Ctx) -> Resource:
    reg = print_layouts.registry(ctx.root)
    rows = [print_layouts.row(k, v, reg["default"]) for k, v in reg["layouts"].items()]
    res = Resource("layout-list", "all", {"count": len(rows), "default": reg["default"], "typefaces": print_layouts.typefaces(ctx.root),
                                          "layouts": rows},
                   links=[Link("layout", Call("layout show", {"layout": r["name"]})) for r in rows])
    res.columns["layouts"] = ["name", "status", "aliases", "columns", "sidebar", "summary"]
    return res


@command("layout show", category="read", help="Show one print layout: what it is for, its numbers and, with --def, the iflayout.def the class reads",
         args=[Arg("layout", "LAYOUT", "the layout, by name or alias")],
         options=[Opt("--def", None, "also give the iflayout.def the document class reads (a layout that is built)"),
                  Opt("--typeface", "TEXT", "with --def: the typeface set to use instead of the layout's own")])
def layout_show(ctx: Ctx, layout: str, typeface: str | None = None, **flags: Any) -> Resource:
    with_def = flags["def"]  # the option's name is a keyword, so it arrives in the keyword arguments
    v = print_layouts.registry(ctx.root)["layouts"][layout]
    data: dict[str, Any] = {"name": layout, **{k: v[k] for k in ("status", "aliases", "summary", "modeled_on", "best_for") if k in v},
                            "caution": v.get("caution", ""), "note": v.get("note", ""), "numbers": {
                                k: v[k] for k in v if k not in ("status", "aliases", "summary", "modeled_on", "best_for", "caution", "note")}}
    if with_def:
        try:
            data["def"] = print_layouts.emit(ctx.root, layout, typeface or "")
        except ValueError as e:
            raise AgoraError("refused", str(e), exit=1) from None
    res = Resource("layout", layout, data, text=_layout_text)
    res.actions = [next_command("write its iflayout.def", "layout build", layout=layout, out="iflayout.def")] if v["status"] == "built" else []
    return res


def _layout_text(res: Resource) -> str:
    d = res.data
    out = [f"{d['name']} [{d['status']}]" + (f" (alias: {', '.join(d['aliases'])})" if d.get("aliases") else ""), d["summary"], ""]
    out += [f"  {k}: {d[k]}" for k in ("modeled_on", "best_for", "caution", "note") if d.get(k)]
    out += ["", "  numbers: " + ", ".join(f"{k} {v}" for k, v in d["numbers"].items())]
    if "def" in d:
        out += ["", d["def"].rstrip("\n")]
    return "\n".join(out)


@command("layout build", category="build",
         help="Write a built layout's iflayout.def, the macros the article class reads, from layouts.json and typefaces.json",
         args=[Arg("layout", "LAYOUT", "the layout, by name or alias")],
         options=[Opt("--out", "TEXT", "the file to write", alias="-o", required=True),
                  Opt("--typeface", "TEXT", "the typeface set to use instead of the layout's own")])
def layout_build(ctx: Ctx, layout: str, out: str, typeface: str | None) -> Resource:
    try:
        text = print_layouts.emit(ctx.root, layout, typeface or "")
    except ValueError as e:
        raise AgoraError("refused", str(e), exit=1) from None
    changes = files.apply(ctx, {Path(out): text})
    return Resource("layout", layout, {"layout": layout, "out": out, "dry_run": ctx.dry_run, "changes": changes},
                    actions=[next_command("show the layout", "layout show", layout=layout)])


def _load(script: Path):
    """The design system's layout.py as a module, loaded from where it stands."""
    spec = importlib.util.spec_from_file_location(f"_{script.parent.parent.name.replace('-', '_')}_layout", script)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", ResourceWarning)  # the design system's own script leaves its JSON files to be closed at exit
        spec.loader.exec_module(mod)
    return mod


@generator("print-layout-docs")
def gen_print_layout_docs(ctx: Ctx, scope: str | None) -> Generated:
    gd = Generated()
    for slug in assurance.design_systems(ctx.root):
        ds = ctx.root / "design-systems" / slug
        script = ds / "latex" / "layout.py"
        if not script.is_file() or (scope and scope != slug):
            continue
        mod = _load(script)
        docs = [p for p in sorted(ds.rglob("*.md")) if any(m in p.read_text(encoding="utf-8") for m in MARKERS)]
        with tempfile.TemporaryDirectory() as tmp:
            for n, doc in enumerate(docs):
                scratch = Path(tmp) / f"{n}.md"
                shutil.copy(doc, scratch)
                mod.sync(str(scratch), check=False)
                gd.files[doc] = scratch.read_text(encoding="utf-8")
                gd.literal[doc] = f"python3 {script.relative_to(ctx.root)} sync {doc.relative_to(ctx.root)}"
    return gd
