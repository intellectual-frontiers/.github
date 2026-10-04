"""The decoration group: `decoration show` and `decoration generate` (0042-agora FR-006; 0014-design-systems FR-047).

Thin: the rules live in agora.lib.decoration. Runs under this group's locked environment, which holds uharfbuzz for
`--only set`. ImageMagick, potrace and rsvg-convert come from the host.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from agora.core import AgoraError, Arg, Call, Choice, Ctx, Dynamic, Link, Opt, Resource, command, next_command
from agora.core import files
from agora.core.checks import find_program
from agora.core.resource import MISSING
from agora.lib import assurance, brands, decoration


def _brands(ctx: Ctx) -> list[str]:
    return assurance.brands(ctx.root)


# The same type the assurance group declares, with the same meaning (0041 FR-013).
BRAND = Dynamic("BRAND", "a brand's slug: a design system with a brand.css (0014-design-systems FR-028)", _brands)
KIT_PART = Choice("KIT_PART", ("trace", "set"), "which part of the decoration kit: trace (the lockup and icon) or set (the wordmark and unit marks)")

TRACE_PROGRAMS = ("convert", "identify", "potrace", "rsvg-convert")
SET_PROGRAMS = ("convert", "rsvg-convert")  # to measure what is set; the shaping is the package


def _need(ctx: Ctx, programs: tuple[str, ...], what: str) -> None:
    gone = [p for p in programs if find_program(ctx.registry, p, ctx.env) is None]
    if gone:
        hints = "; ".join(f"{p}: {ctx.registry.program(p).get('hint', 'install it on the host')}" for p in gone)
        raise AgoraError("missing-program", f"{what} needs {', '.join(gone)}, not found on PATH ({hints})", exit=MISSING,
                         detail={"program": gone[0], "programs": gone, "hint": ctx.registry.program(gone[0]).get("hint", "")},
                         actions=[next_command("see what is missing", "doctor")])


@command("decoration show", category="read",
         help="Show a brand's decoration kit: each part's file and finest detail, and how it is made",
         args=[Arg("brand", "BRAND", "the brand")],
         options=[Opt("--measure", None, "measure each SVG's finest detail again (needs rsvg-convert and ImageMagick; slow)")])
def decoration_show(ctx: Ctx, brand: str, measure: bool) -> Resource:
    b = brands.brand_dir(ctx.root, brand)
    kit = decoration.kit_of(brands.tokens_of(b))
    if measure:
        _need(ctx, SET_PROGRAMS, "--measure")
    rows = []
    for part in ("lockup", "icon", "wordmark"):
        art = kit.get(part)
        if not art:
            continue
        row: dict[str, Any] = {"part": part, "file": art["file"], "present": (b / art["file"]).is_file(),
                               "finest-detail": art.get("finest-detail"), "min-width-in": art.get("min-width-in"),
                               "made": "traced from " + art["traced-from"]["file"] if "traced-from" in art
                               else "set from " + art["set-from"]["font"] if "set-from" in art else ""}
        if measure and row["present"]:
            row["measured"] = round(decoration.finest_detail(b / art["file"]), 4)
        rows.append(row)
    units = [{"unit": u, "file": m["file"], "present": (b / m["file"]).is_file()}
             for u, m in brands.tokens_of(b)["$extensions"][brands.LOGO].get("units", {}).items() if not u.startswith("$")]
    res = Resource("decoration", brand, {"brand": brand, "parts": rows, "units": units, "inks": sorted(kit.get("inks", {}))})
    res.columns["parts"] = ["part", "file", "present", "finest-detail", "made"]
    res.columns["units"] = ["unit", "file", "present"]
    res.links = [Link("brand", Call("brand show", {"brand": brand})), Link("inks", Call("ink list", {"brand": brand}))]
    res.actions = [next_command("remake the kit from the masters and the fonts", "decoration generate", brand=brand)]
    return res


@command("decoration generate", category="generate",
         help="Make a brand's decoration kit: trace the lockup and icon from their masters, and set the wordmark and unit marks in type",
         args=[Arg("brand", "BRAND", "the brand")],
         options=[Opt("--only", "KIT_PART", "only trace (the lockup and icon) or only set (the wordmark and unit marks)")])
def decoration_generate(ctx: Ctx, brand: str, only: str | None) -> Resource:
    if only in (None, "trace"):
        _need(ctx, TRACE_PROGRAMS, "decoration generate (trace)")
    if only in (None, "set"):
        _need(ctx, SET_PROGRAMS, "decoration generate (set)")
    b = brands.brand_dir(ctx.root, brand)
    if not decoration.kit_of(brands.tokens_of(b)):
        raise AgoraError("invalid-argument", f"{brand} has no decoration kit in its tokens.json", exit=2)
    made, notes = decoration.generate(b, only)
    changes = files.apply(ctx, made)
    return Resource("decoration", brand, {"brand": brand, "only": only, "dry_run": ctx.dry_run, "made": notes, "changes": changes},
                    actions=[next_command("see the kit", "decoration show", brand=brand)])
