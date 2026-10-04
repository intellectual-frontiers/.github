"""The brand group: `brand`, `imagery`, `ink` and `openedx`, and the generators `brand-theme`, `brand-specimen` and
`openedx-sources` (0042-agora FR-006, FR-012, FR-015).

Thin: the rules live in agora.lib. Standard library only; ImageMagick and Paragon come from the host.
"""
from __future__ import annotations

import datetime
import json
import re
import shutil
from pathlib import Path
from typing import Any

from agora.core import (AgoraError, Arg, ArgType, Call, Ctx, Dynamic, Link, Opt, Pattern, Resource, command, next_command)
from agora.core import files
from agora.core.generate import Generated, orphans
from agora.core.registry import context_for, generator
from agora.core.resource import FAILED, MISSING, USAGE
from agora.lib import assurance, brand_specimen, brand_theme, brands, decoration, imagery, openedx, specs


# types -------------------------------------------------------------------------------------------------------------
def _brands(ctx: Ctx) -> list[str]:
    return assurance.brands(ctx.root)


# The same type the assurance group declares, with the same meaning (0041 FR-013).
BRAND = Dynamic("BRAND", "a brand's slug: a design system with a brand.css (0014-design-systems FR-028)", _brands)


class _Piece(ArgType):
    name = "PIECE"
    doc = "an imagery piece as <brand>/<piece>, such as frontiers-brand/fog-coast-lighthouse-footbridge"

    def choices(self, ctx: Ctx) -> list[str]:
        return imagery.piece_names(ctx.root, _brands(ctx))

    def validate(self, ctx: Ctx, value: str) -> str:
        if value not in self.choices(ctx):
            raise ValueError(f"{value!r} names no piece of any brand's catalog")
        return value

    def resolve(self, ctx: Ctx, value: str) -> Call:
        return Call("imagery show", {"piece": value})


class _Ink(ArgType):
    name = "INK"
    doc = "an ink of a brand's decoration kit as <brand>/<role>, such as frontiers-brand/primary"

    def choices(self, ctx: Ctx) -> list[str]:
        return brands.ink_names(ctx.root, _brands(ctx))

    def validate(self, ctx: Ctx, value: str) -> str:
        if value not in self.choices(ctx):
            raise ValueError(f"{value!r} names no ink of any brand's decoration kit")
        return value

    def resolve(self, ctx: Ctx, value: str) -> Call:
        return Call("ink show", {"ink": value})


PIECE = _Piece()
INK = _Ink()
DATE = Pattern("DATE", r"\d{4}-\d{2}-\d{2}", "a date as YYYY-MM-DD", ["2026-10-04"])


def _brand_dir(ctx: Ctx, name: str) -> Path:
    return brands.brand_dir(ctx.root, name)


def _split(value: str) -> tuple[str, str]:
    brand, _, rest = value.partition("/")
    return brand, rest


# brand -------------------------------------------------------------------------------------------------------------
@command("brand list", category="read", help="List the brands: design systems with a brand.css")
def brand_list(ctx: Ctx) -> Resource:
    rows = [brands.summary(ctx.root, b) for b in _brands(ctx)]
    res = Resource("brand-list", "all", {"count": len(rows), "brands": rows},
                   links=[Link("brand", Call("brand show", {"brand": r["name"]})) for r in rows])
    res.columns["brands"] = ["name", "palette", "roles", "pieces", "openedx", "decoration", "inks"]
    return res


@command("brand show", category="read", help="Show a brand: its palette, roles, logos, and whether what is written from its tokens is current",
         args=[Arg("brand", "BRAND", "the brand")])
def brand_show(ctx: Ctx, brand: str) -> Resource:
    d = brands.detail(ctx.root, brand)
    res = Resource("brand", brand, d)
    res.columns["generated"] = ["path", "state"]
    res.columns["lockup files"] = ["file", "size", "background"]
    res.columns["icon files"] = ["file", "size"]
    res.links = [Link("imagery", Call("imagery list", {"brand": brand})),
                 Link("inks", Call("ink list", {"brand": brand}))]
    if d["decoration"]["parts"]:
        res.links.append(Link("decoration", Call("decoration show", {"brand": brand})))
    res.actions = [next_command("rewrite its theme and specimen from tokens.json", "brand generate", brand=brand)]
    return res


@command("brand generate", category="generate",
         help="Write a brand's brand.css, brand.tex and specimen from its tokens.json (every brand when none is named)",
         args=[Arg("brand", "BRAND", "the brand; every brand when none is named", required=False)])
def brand_generate(ctx: Ctx, brand: str | None) -> Resource:
    names = [brand] if brand else _brands(ctx)
    out: dict[Path, str] = {}
    for n in names:
        out.update(brands.generated(_brand_dir(ctx, n)))
    changes = files.apply(ctx, out)
    return Resource("brand", brand or "all", {"brands": names, "dry_run": ctx.dry_run, "changes": changes},
                    actions=[next_command("prove it current", "fresh", generators=["brand-theme", "brand-specimen"])])


@generator("brand-theme")
def gen_theme(ctx: Ctx, scope: str | None) -> Generated:
    gd = Generated()
    for n in [scope] if scope else _brands(ctx):
        for path, text in brand_theme.generate(_brand_dir(ctx, n)).items():
            gd.files[path] = text
            gd.calls[path] = Call("brand generate", {"brand": n})
    return gd


@generator("brand-specimen")
def gen_specimen(ctx: Ctx, scope: str | None) -> Generated:
    gd = Generated()
    for n in [scope] if scope else _brands(ctx):
        for path, text in brand_specimen.generate(_brand_dir(ctx, n)).items():
            gd.files[path] = text
            gd.calls[path] = Call("brand generate", {"brand": n})
    return gd


@context_for("brand", "BRAND")
def brand_context(ctx: Ctx, brand: str) -> dict[str, Any]:
    d = brands.detail(ctx.root, brand)
    res = brand_show(ctx, brand)
    spec = brand if (ctx.root / "design-systems" / brand / "spec.md").is_file() else "0014-design-systems"
    s = specs.resolve_spec(ctx.root, spec)
    return {"resource": res.data, "specs": [{"name": spec, "status": s.status if s else "unknown"}], "requirements": [],
            "files": [f"design-systems/{brand}/tokens.json"] + [g["path"] for g in d["generated"]],
            "links": res.links, "actions": res.actions,
            "omitted": [f"the requirements of {spec} (use context spec:{spec})"]}


# imagery -----------------------------------------------------------------------------------------------------------
@command("imagery list", category="read", help="List a brand's imagery pieces", args=[Arg("brand", "BRAND", "the brand")])
def imagery_list(ctx: Ctx, brand: str) -> Resource:
    b = _brand_dir(ctx, brand)
    cat = imagery.catalog(b) or {}
    rows = [{"id": p["id"], "name": p["name"], "environment": p["environment"], "size": "x".join(str(v) for v in p["pixel_size"]),
             "water": bool(p.get("water", {}).get("present")), "anchor": p["visual_anchor"]} for p in cat.get("pieces", [])]
    res = Resource("imagery-list", brand, {"brand": brand, "count": len(rows), "environments": cat.get("environments", []),
                                           "pieces": rows},
                   links=[Link("piece", Call("imagery show", {"piece": f"{brand}/{r['id']}"})) for r in rows])
    res.columns["pieces"] = ["id", "environment", "size", "water", "anchor"]
    res.actions = [next_command("write its WebP files, share card and app icons", "imagery build", brand=brand),
                   next_command("check the pool", "check", sections=["imagery"], scope=brand)]
    return res


@command("imagery show", category="read", programs=("convert", "identify"),
         help="Show one piece: its catalog entry, and what its master measures (pixel size, content box, transparency, color)",
         args=[Arg("piece", "PIECE", "the piece, as <brand>/<piece>")])
def imagery_show(ctx: Ctx, piece: str) -> Resource:
    brand, pid = _split(piece)
    b = _brand_dir(ctx, brand)
    entry = next(p for p in imagery.pieces(b) if p["id"] == pid)
    m = imagery.measure(b / "imagery" / entry["file"])
    problems = [f"{k} is {entry.get(k)} in the catalog; the master measures {m[k]}" for k in ("pixel_size", "content_box")
                if m[k] != entry.get(k)]
    if not m["transparent"]:
        problems.append("the master has no real transparency")
    web = [{"file": w["file"], "size": f"{w['width']}x{w['height']}", "present": (b / "imagery" / w["file"]).is_file()}
           for w in entry.get("web", [])]
    data = {"piece": piece, "entry": entry, "measure": {**m, "colored_share": round(m["colored_share"], 4)}, "web": web,
            "agrees": not problems, "problems": problems}
    res = Resource("imagery-piece", piece, data)
    res.columns["web"] = ["file", "size", "present"]
    res.links = [Link("brand", Call("brand show", {"brand": brand})), Link("pool", Call("imagery list", {"brand": brand}))]
    return res


@command("imagery build", category="build", programs=("convert", "identify"),
         help="Write a brand's WebP files, share card and app icons from its masters and tokens",
         args=[Arg("brand", "BRAND", "the brand")])
def imagery_build(ctx: Ctx, brand: str) -> Resource:
    b = _brand_dir(ctx, brand)
    changes = files.apply(ctx, imagery.build_changes(b))
    cat = imagery.pieces(b)
    return Resource("imagery-build", brand, {"brand": brand, "dry_run": ctx.dry_run,
                                              "webp": sum(len(p["web"]) for p in cat), "changes": changes},
                    actions=[next_command("check the pool", "check", sections=["imagery"], scope=brand)])


def _slug(path: Path) -> str:
    return path.name[:-4]


@command("imagery add", category="record", programs=("convert", "identify"),
         help="Add a master to a brand's pool: copy it byte for byte, measure it, and catalog it (then build its WebP files)",
         args=[Arg("brand", "BRAND", "the brand")],
         options=[Opt("--master", "TEXT", "the approved PNG; its file name without .png is the piece's id", required=True),
                  Opt("--name", "TEXT", "a short human name", required=True),
                  Opt("--environment", "TEXT", "one of the catalog's environments", required=True),
                  Opt("--description", "TEXT", "what is drawn, foreground to horizon", required=True),
                  Opt("--visual-anchor", "TEXT", "the one built thing the eye lands on", required=True),
                  Opt("--route", "TEXT", "how people move through the scene", required=True),
                  Opt("--built-structure", "TEXT", "a human-made thing in the scene (repeat)", multiple=True),
                  Opt("--infrastructure-type", "TEXT", "the kind of system the structures form (repeat)", multiple=True),
                  Opt("--colored-element", "TEXT", "what carries color (repeat)", multiple=True),
                  Opt("--water-form", "TEXT", "the form water takes; omit when there is none"),
                  Opt("--metaphor", "TEXT", "what the piece can stand for (repeat)", multiple=True),
                  Opt("--suggested-subject", "TEXT", "a subject the metaphors suit (repeat)", multiple=True),
                  Opt("--supplied", "DATE", "when the piece was supplied; today by default"),
                  Opt("--generator", "TEXT", "what made it", required=True)])
def imagery_add(ctx: Ctx, brand: str, master: str, name: str, environment: str, description: str, visual_anchor: str,
                route: str, built_structure: list[str], infrastructure_type: list[str], colored_element: list[str],
                water_form: str | None, metaphor: list[str], suggested_subject: list[str], supplied: str | None,
                generator: str) -> Resource:
    b = _brand_dir(ctx, brand)
    src = Path(master).expanduser()
    if not src.is_file() or src.suffix != ".png":
        raise AgoraError("invalid-argument", f"--master {master!r} is not a PNG file", exit=USAGE)
    pid = _slug(src)
    if not re.fullmatch(imagery.ID_RE, pid):
        raise AgoraError("invalid-argument", f"the master's name {src.name!r} is not an id: lowercase words joined by hyphens, "
                         "environment first and then the anchor", exit=USAGE)
    cat = imagery.catalog(b)
    if cat is None:
        raise AgoraError("invalid-argument", f"{brand} has no imagery/catalog.json to add to", exit=USAGE)
    if pid in {p["id"] for p in cat["pieces"]}:
        raise AgoraError("exists", f"{brand} already has a piece {pid}", exit=USAGE,
                         actions=[next_command("see it", "imagery show", piece=f"{brand}/{pid}")])
    if environment not in cat.get("environments", []):
        raise AgoraError("invalid-argument", f"--environment {environment!r} is not one of {', '.join(cat.get('environments', []))}", exit=USAGE)
    missing = [f for f, v in (("--built-structure", built_structure), ("--infrastructure-type", infrastructure_type),
                              ("--colored-element", colored_element), ("--metaphor", metaphor),
                              ("--suggested-subject", suggested_subject)) if not v]
    if missing:
        raise AgoraError("usage", f"a catalog entry needs {', '.join(missing)}", exit=USAGE)
    day = supplied or datetime.date.today().isoformat()
    made = imagery.new_piece(src, {
        "name": name, "environment": environment, "description": description, "visual_anchor": visual_anchor, "route": route,
        "built_structures": built_structure, "infrastructure_type": infrastructure_type, "colored_elements": colored_element,
        "water": {"present": bool(water_form), **({"form": water_form} if water_form else {})},
        "metaphors": metaphor, "suggested_subjects": suggested_subject, "source": {"supplied": day, "generator": generator}})
    problems = []
    if not made["measure"]["transparent"]:
        problems.append("the master has no real transparency; an approved master keeps it (frontiers-brand FR-015)")
    if problems:
        raise AgoraError("invalid-master", "; ".join(problems), exit=FAILED)
    cat["pieces"].append(made["entry"])
    changes = files.apply(ctx, {b / "imagery" / f"{pid}.png": src.read_bytes(),
                                b / "imagery" / "catalog.json": imagery.dumps(cat)})
    return Resource("imagery-piece", f"{brand}/{pid}", {"piece": f"{brand}/{pid}", "entry": made["entry"],
                                                          "measure": {**made["measure"], "colored_share": round(made["measure"]["colored_share"], 4)},
                                                          "dry_run": ctx.dry_run, "changes": changes},
                    actions=[next_command("write its WebP files", "imagery build", brand=brand),
                             next_command("check the pool", "check", sections=["imagery"], scope=brand)])


# ink ---------------------------------------------------------------------------------------------------------------
def _inks(ctx: Ctx, brand: str) -> tuple[dict[str, Any], dict[str, str]]:
    t = brands.tokens_of(_brand_dir(ctx, brand))
    roles = {k: brand_theme.resolve(t, v["$value"]) for k, v in t["role"].items()}
    return decoration.kit_of(t).get("inks", {}), roles


@command("ink list", category="read", help="List a brand's inks: each role's spot color and thread, and whether they were verified",
         args=[Arg("brand", "BRAND", "the brand")])
def ink_list(ctx: Ctx, brand: str) -> Resource:
    inks, roles = _inks(ctx, brand)
    rows = [brands.ink_row(r, e, roles.get(r)) for r, e in inks.items()]
    res = Resource("ink-list", brand, {"brand": brand, "count": len(rows), "verified": sum(r["verified"] for r in rows), "inks": rows},
                   links=[Link("ink", Call("ink show", {"ink": f"{brand}/{r['role']}"})) for r in rows])
    res.columns["inks"] = ["role", "color", "spot", "thread", "verified"]
    return res


@command("ink show", category="read",
         help="Show one ink, and with GIMP palettes (a thread chart, a spot-color guide) its nearest candidates by CIEDE2000",
         args=[Arg("ink", "INK", "the ink, as <brand>/<role>")],
         options=[Opt("--palette", "TEXT", "a GIMP palette (.gpl) to match against (repeat)", multiple=True)])
def ink_show(ctx: Ctx, ink: str, palette: list[str]) -> Resource:
    brand, role = _split(ink)
    inks, roles = _inks(ctx, brand)
    row = brands.ink_row(role, inks[role], roles.get(role))
    data: dict[str, Any] = {"ink": ink, **row, "matches": []}
    if palette:
        for p in palette:
            if not Path(p).expanduser().is_file():
                raise AgoraError("invalid-argument", f"--palette {p!r} is not a file", exit=USAGE)
        data["matches"] = decoration.match(roles[role], [Path(p).expanduser() for p in palette])
        data["note"] = "a match is a candidate until it is checked against the physical guide and card"
    res = Resource("ink", ink, data)
    res.columns["matches"] = ["delta-e", "palette", "color", "rgb"]
    res.links = [Link("inks", Call("ink list", {"brand": brand}))]
    res.actions = [next_command("record that a person checked it against the physical guide and card (a decision)",
                                "ink record", ink=ink)]
    return res


@command("ink record", category="decision",
         help="Record that a person checked an ink's spot color and thread against the physical guide and card",
         args=[Arg("ink", "INK", "the ink, as <brand>/<role>")],
         options=[Opt("--spot", "TEXT", "the spot color's name as checked", required=True),
                  Opt("--thread", "TEXT", "the thread's number as checked", required=True),
                  Opt("--by", "TEXT", "who checked them: the one name a command writes to a tracked file (0042 FR-012)",
                      required=True, log=False),
                  Opt("--on", "DATE", "the date they were checked", required=True)])
def ink_record(ctx: Ctx, ink: str, spot: str, thread: str, by: str, on: str) -> Resource:
    brand, role = _split(ink)
    path = _brand_dir(ctx, brand) / "tokens.json"
    tokens = json.loads(path.read_text(encoding="utf-8"))
    try:
        decoration.record_ink(tokens, role, spot, thread, by, on)
    except ValueError as e:
        raise AgoraError("invalid-argument", f"--on: {e}", exit=USAGE) from None
    changes = files.apply(ctx, {path: decoration.dumps(tokens)})
    return Resource("ink", ink, {"ink": ink, "spot": spot, "thread": thread, "verified-by": by, "verified-on": on,
                                 "dry_run": ctx.dry_run, "changes": changes},
                    actions=[next_command("see the brand's inks", "ink list", brand=brand)])


# openedx -----------------------------------------------------------------------------------------------------------
@command("openedx generate", category="generate",
         help="Write a brand's Open edX package sources from its tokens.json, logos and fonts (not the built dist/)",
         args=[Arg("brand", "BRAND", "the brand")])
def openedx_generate(ctx: Ctx, brand: str) -> Resource:
    gd = gen_openedx(ctx, brand)
    changes = files.apply(ctx, {**gd.files, **{p: None for p in orphans(gd)}})
    return Resource("openedx", brand, {"brand": brand, "dry_run": ctx.dry_run, "changes": changes},
                    actions=[next_command("build it with Paragon", "openedx build", brand=brand),
                             next_command("check it", "check", sections=["openedx"], scope=brand)])


@command("openedx build", category="build", programs=("node",),
         help="Write a brand's Open edX package sources and build dist/ with Paragon's CLI",
         args=[Arg("brand", "BRAND", "the brand")],
         options=[Opt("--paragon", "TEXT", "Paragon's CLI, such as node_modules/.bin/paragon (PARAGON in the environment otherwise)")])
def openedx_build(ctx: Ctx, brand: str, paragon: str | None) -> Resource:
    cli = assurance.paragon_path(paragon, ctx.env)
    if cli is None or not cli.is_file():
        raise AgoraError("missing-program", "Paragon's CLI was " + ("not a file: " + str(cli) if cli else "not given")
                         + "; give the paragon executable (--paragon, or PARAGON in the environment)", exit=MISSING,
                         detail={"program": "paragon", "hint": f"npm install @openedx/paragon@{openedx.PARAGON_VERSION}, then use node_modules/.bin/paragon"})
    b = _brand_dir(ctx, brand)
    got = openedx.built(b, openedx.package_name(b), cli)
    out = b / "openedx"
    gd = Generated({out / rel: data for rel, data in got.items()}, [(out, openedx.UNOWNED)])
    changes = files.apply(ctx, {**gd.files, **{p: None for p in orphans(gd)}})
    return Resource("openedx", brand, {"brand": brand, "paragon": str(cli), "dry_run": ctx.dry_run, "changes": changes},
                    actions=[next_command("check it", "check", sections=["openedx"], scope=brand, paragon=str(cli))])


@generator("openedx-sources")
def gen_openedx(ctx: Ctx, scope: str | None) -> Generated:
    gd = Generated()
    for n in [scope] if scope else assurance.openedx_brands(ctx.root):
        b = _brand_dir(ctx, n)
        out = b / "openedx"
        try:
            rendered = openedx.rendered(b, openedx.package_name(b))
        except openedx.MissingProgram as e:
            raise AgoraError("missing-program", f"{n}: {e}", exit=MISSING, detail={"program": e.program, "hint": e.hint}) from None
        for rel, data in rendered.items():
            gd.files[out / rel] = data
            gd.calls[out / rel] = Call("openedx generate", {"brand": n})
        gd.owned.append((out, (*openedx.UNOWNED, "dist")))
    return gd
