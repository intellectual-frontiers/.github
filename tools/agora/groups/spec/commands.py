"""Specs, requirements, terms, and the check sections for them (0042-agora FR-006, FR-013).

Thin: the rules live in agora.lib. Standard library only.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from agora.core import (Action, AgoraError, Arg, ArgType, Call, Choice, Ctx, Dynamic, Finding, Link, Opt, Pattern, Resource,
                        SectionResult, command, next_command, section)
from agora.core import files, invocation
from agora.core.registry import context_for
from agora.core.resource import FAILED, OK, USAGE
from agora.lib import controls, design_systems, ontology, register, specs
from agora.lib.names import ID_IN, MECHANISMS, names

TEXT_LEN = 160


# types -------------------------------------------------------------------------------------------------------------
class _Spec(ArgType):
    name = "SPEC"
    doc = "a spec as NNNN-slug or NNNN, or a design system's slug"

    def choices(self, ctx: Ctx) -> list[str]:
        return [f.parent.name for f in specs.spec_files(ctx.root)]

    def validate(self, ctx: Ctx, value: str) -> str:
        s = specs.resolve_spec(ctx.root, value)
        if s is None:
            raise ValueError(f"{value!r} names no spec")
        return s.name

    def complete(self, ctx: Ctx, prefix: str) -> list[str]:
        c = self.choices(ctx)
        return [v for v in c if v.startswith(prefix)] + sorted({v[:4] for v in c if v[:4].startswith(prefix) and v[:4].isdigit()})

    def examples(self, ctx: Ctx) -> list[str]:
        return ["0020", "0020-spec-format", "frontiers-brand"]

    def resolve(self, ctx: Ctx, value: str) -> Call:
        return Call("spec show", {"spec": value})


class _Requirement(ArgType):
    name = "REQUIREMENT"
    doc = "a requirement as <spec>/FR-NNN, such as 0020/FR-013"

    def _all(self, ctx: Ctx) -> list[str]:
        return [f"{s.name}/{i}" for s in specs.find_specs(ctx.root) for i, _ in s.requirements()]

    def choices(self, ctx: Ctx) -> list[str]:
        return self._all(ctx)

    def validate(self, ctx: Ctx, value: str) -> str:
        m = re.fullmatch(r"(.+)/(FR-\d{3})", value)
        if not m:
            raise ValueError(f"{value!r} is not <spec>/FR-NNN")
        s = specs.resolve_spec(ctx.root, m.group(1))
        if s is None:
            raise ValueError(f"{m.group(1)!r} names no spec")
        if m.group(2) not in {i for i, _ in s.requirements()}:
            raise ValueError(f"{s.name} defines no {m.group(2)}")
        return f"{s.name}/{m.group(2)}"

    def complete(self, ctx: Ctx, prefix: str) -> list[str]:
        spec, _, ident = prefix.partition("/")
        return [v for v in self._all(ctx) if v.startswith(prefix)
                or ("/" in prefix and v.split("/")[0].startswith(spec) and v.split("/")[1].startswith(ident))]

    def examples(self, ctx: Ctx) -> list[str]:
        return ["0020/FR-013", "0041-command-line/FR-008"]

    def resolve(self, ctx: Ctx, value: str) -> Call:
        return Call("requirement show", {"requirement": value})


def _terms(ctx: Ctx) -> list[dict[str, Any]]:
    ttl = ctx.root / "ontology" / "ifcore.ttl"
    return ontology.terms(ttl.read_text(encoding="utf-8")) if ttl.is_file() else []


class _Term(ArgType):
    name = "TERM"
    doc = "a concept or scheme of the ontology by its local name, such as ReadCommandCategory"

    def choices(self, ctx: Ctx) -> list[str]:
        return [t["id"] for t in _terms(ctx)]

    def validate(self, ctx: Ctx, value: str) -> str:
        v = value[len("ifcore:"):] if value.startswith("ifcore:") else value
        if v not in self.choices(ctx):
            raise ValueError(f"{value!r} names no term")
        return v

    def examples(self, ctx: Ctx) -> list[str]:
        return ["ReadCommandCategory", "CommandCategoryScheme"]


class _Scheme(ArgType):
    name = "SCHEME"
    doc = "a concept scheme of the ontology by its local name, such as CommandCategoryScheme"

    def choices(self, ctx: Ctx) -> list[str]:
        return [t["id"] for t in _terms(ctx) if t["kind"] == "scheme"]

    def validate(self, ctx: Ctx, value: str) -> str:
        v = value[len("ifcore:"):] if value.startswith("ifcore:") else value
        if v not in self.choices(ctx):
            raise ValueError(f"{value!r} names no scheme")
        return v


class _Control(ArgType):
    name = "CONTROL"
    doc = "a control as <catalog>:<control>, as the ontology's control catalogs declare them"

    def choices(self, ctx: Ctx) -> list[str]:
        return sorted(controls.public_controls(ctx.public))

    def validate(self, ctx: Ctx, value: str) -> str:
        if value not in controls.public_controls(ctx.public):
            raise ValueError(f"{value!r} is not a control in a catalog")
        return value


def design_systems_kinds(ctx: Ctx) -> list[str]:
    return sorted(names(ctx.public).codes)


def _design_systems(ctx: Ctx) -> list[str]:
    d = ctx.root / "design-systems"
    return sorted(p.name for p in d.iterdir() if p.is_dir()) if d.is_dir() else []


SPEC = _Spec()
REQUIREMENT = _Requirement()
TERM = _Term()
SCHEME = _Scheme()
CONTROL = _Control()
DESIGN_SYSTEM = Dynamic("DESIGN_SYSTEM", "a design system's slug, a directory of design-systems/", _design_systems)
KIND = Dynamic("KIND", "a design system kind code of the ontology's kind scheme, such as web or brand", lambda c: design_systems_kinds(c))
MECHANISM = Choice("MECHANISM", MECHANISMS, "how a requirement is enforced (0020 FR-012)")
SPEC_STATUS = Choice("SPEC_STATUS", ("Draft", "Adopted", "Superseded"), "a spec's status (0020 FR-009)")
SLUG = Pattern("SLUG", r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*", "lowercase words joined by hyphens", ["agora", "command-line"])


def _own_repo(ctx: Ctx) -> str | None:
    return ctx.registry.root_manifest.get("register_name")


def _command_problem(ctx: Ctx):
    return lambda text: invocation.problem(ctx, text)


# spec --------------------------------------------------------------------------------------------------------------
def _spec_row(s: specs.Spec) -> dict[str, Any]:
    return {"name": s.name, "kind": "design-system" if s.design_system else "numbered", "status": s.status, "title": s.title,
            "requirements": len(s.requirements()), "path": s.rel}


@command("spec list", category="read", help="List specs", relocatable=True,
         options=[Opt("--status", "SPEC_STATUS", "only specs in this status")])
def spec_list(ctx: Ctx, status: str | None) -> Resource:
    rows = [_spec_row(s) for s in specs.find_specs(ctx.root) if not status or s.status.startswith(status)]
    res = Resource("spec-list", "all", {"count": len(rows), "specs": rows},
                   links=[Link("spec", Call("spec show", {"spec": r["name"]})) for r in rows])
    res.columns["specs"] = ["name", "status", "requirements", "title"]
    return res


def _enforcement_counts(ctx: Ctx, name: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for req, row in register.register_rows(ctx.root).items():
        if req.startswith(name + " "):
            counts[row["mechanism"]] = counts.get(row["mechanism"], 0) + 1
    return counts


@command("spec show", category="read", help="Show one spec: status, requirements and how they are enforced", relocatable=True,
         args=[Arg("spec", "SPEC", "the spec")])
def spec_show(ctx: Ctx, spec: str) -> Resource:
    s = specs.resolve_spec(ctx.root, spec)
    assert s is not None
    reqs = s.requirements()
    rows = register.register_rows(ctx.root)
    m = re.search(r"^\*\*Input:\*\*\s*(.+?)(?:\n\n|\Z)", s.text, re.S | re.M)
    data = {**_spec_row(s), "input": " ".join(m.group(1).split()) if m else "",
            "sections": [h for h in re.findall(r"^## (.+?)\s*$", s.text, re.M)],
            "enforcement": _enforcement_counts(ctx, s.name),
            "requirement list": [{"id": i, "mechanism": rows.get(f"{s.name} {i}", {}).get("mechanism", "missing"),
                                  "text": t[:TEXT_LEN] + ("..." if len(t) > TEXT_LEN else "")} for i, t in reqs]}
    res = Resource("spec", s.name, data)
    res.columns["requirement list"] = ["id", "mechanism", "text"]
    res.links = [Link("requirement", Call("requirement show", {"requirement": f"{s.name}/{i}"})) for i, _ in reqs]
    res.actions = [next_command("check this spec", "check", sections=["specs", "register"], scope=s.name)]
    if s.status == "Draft":
        res.actions.append(next_command("adopt it (a person decides)", "spec set", spec=s.name, status="Adopted"))
    return res


TEMPLATE = """# Feature Specification: {title}

**Spec ID:** {name}
**Status:** Draft

**Input:** {title}. State in one paragraph what this spec covers and why it exists.

## Requirements

- **FR-001**: State the first requirement with MUST, MUST NOT or MAY.

## Out of scope

- State what this spec leaves to others.

## Edge cases

- State a case and what happens, citing the requirement that decides it, per FR-001.

## Assumptions

- State what this spec takes as given.

## Open questions

- None yet.

## Key entities

- **{title}** - what it is, in one line.

## Success criteria

- **SC-001**: State how anyone can tell the spec is met.

## Review & acceptance checklist

- [ ] Every requirement is testable (MUST / MUST NOT), not aspirational
- [ ] No company fact is asserted here
- [ ] Every open item is marked, not silently decided
- [ ] Public-safe: no confidential information, no unverified number stated
      as settled fact
"""


@command("spec new", category="generate", help="Create a spec in the form 0020 FR-005 states, with the next unused number",
         args=[Arg("slug", "SLUG", "the spec's slug; its number is the next unused one")],
         options=[Opt("--title", "TEXT", "the spec's title; the slug's words by default")])
def spec_new(ctx: Ctx, slug: str, title: str | None) -> Resource:
    d = ctx.root / "spec-kit" / "specs"
    existing = [p.name for p in d.iterdir() if p.is_dir()] if d.is_dir() else []
    if any(n[5:] == slug for n in existing if re.match(r"\d{4}-", n)):
        raise AgoraError("exists", f"a spec with the slug {slug} already exists", exit=USAGE,
                         actions=[next_command("list the specs", "spec list")])
    nxt = max([int(n[:4]) for n in existing if re.match(r"\d{4}-", n)] or [0]) + 1
    name = f"{nxt:04d}-{slug}"
    text = TEMPLATE.format(name=name, title=title or slug.replace("-", " ").capitalize())
    changes = files.apply(ctx, {d / name / "spec.md": text})
    res = Resource("spec", name, {"name": name, "dry_run": ctx.dry_run, "changes": changes})
    res.actions = [next_command("record how its first requirement is enforced", "requirement set",
                                requirement=f"{name}/FR-001", mechanism="none", by="-", note="not written yet")]
    return res


def _status_value(s: str) -> str:
    return s.split(" ")[0]


@command("spec set", category="decision", help="Move a spec between Draft, Adopted and Superseded, only as 0020 FR-010 allows",
         args=[Arg("spec", "SPEC", "the spec")],
         options=[Opt("--status", "SPEC_STATUS", "the new status", required=True),
                  Opt("--superseded-by", "SPEC", "for Superseded: the spec that supersedes it")])
def spec_set(ctx: Ctx, spec: str, status: str, superseded_by: str | None) -> Resource:
    s = specs.resolve_spec(ctx.root, spec)
    assert s is not None
    cur = _status_value(s.status)
    allowed = {"Draft": {"Adopted", "Superseded"}, "Adopted": {"Superseded"}, "Superseded": set()}
    if status not in allowed.get(cur, set()):
        raise AgoraError("transition", f"{s.name} is {s.status}; it cannot move to {status} (0020 FR-010 allows Draft to "
                         "Adopted or Superseded, and Adopted to Superseded)", exit=USAGE)
    if status == "Superseded":
        if not superseded_by:
            raise AgoraError("usage", "Superseded needs --superseded-by SPEC (0020 FR-009)", exit=USAGE)
        if superseded_by == s.name:
            raise AgoraError("usage", "a spec cannot supersede itself", exit=USAGE)
        new = f"Superseded by {superseded_by}"
    else:
        if superseded_by:
            raise AgoraError("usage", "--superseded-by applies only to Superseded", exit=USAGE)
        new = status
    text = specs.STATUS_LINE.sub(lambda m: f"**Status:** {new}", s.text, count=1)
    changes = files.apply(ctx, {s.path: text})
    return Resource("spec", s.name, {"name": s.name, "from": s.status, "status": new, "dry_run": ctx.dry_run, "changes": changes},
                    actions=[next_command("check it", "check", sections=["specs"], scope=s.name)])


# requirement -------------------------------------------------------------------------------------------------------
def _split(req: str) -> tuple[str, str]:
    spec, ident = req.split("/")
    return spec, ident


@command("requirement list", category="read", help="List requirements with how each is enforced", relocatable=True,
         options=[Opt("--spec", "SPEC", "only this spec's requirements"),
                  Opt("--mechanism", "MECHANISM", "only requirements enforced this way (none lists what nothing enforces)")])
def requirement_list(ctx: Ctx, spec: str | None, mechanism: str | None) -> Resource:
    rows_by_req = register.register_rows(ctx.root)
    rows = []
    for s in specs.find_specs(ctx.root):
        if spec and s.name != spec:
            continue
        for ident, text in s.requirements():
            r = rows_by_req.get(f"{s.name} {ident}", {})
            mech = r.get("mechanism", "missing")
            if mechanism and mech != mechanism:
                continue
            rows.append({"requirement": f"{s.name}/{ident}", "mechanism": mech, "by": r.get("by", ""), "note": r.get("note", ""),
                         "text": text[:TEXT_LEN] + ("..." if len(text) > TEXT_LEN else "")})
    res = Resource("requirement-list", mechanism or "all", {"count": len(rows), "spec": spec, "mechanism": mechanism,
                                                            "requirements": rows},
                   links=[Link("requirement", Call("requirement show", {"requirement": r["requirement"]})) for r in rows])
    res.columns["requirements"] = ["requirement", "mechanism", "by", "note"]
    return res


@command("requirement show", category="read", help="Show one requirement in full, with its enforcement and controls",
         relocatable=True, args=[Arg("requirement", "REQUIREMENT", "the requirement")])
def requirement_show(ctx: Ctx, requirement: str) -> Resource:
    spec, ident = _split(requirement)
    s = specs.resolve_spec(ctx.root, spec)
    assert s is not None
    text = dict(s.requirements())[ident]
    row = register.register_rows(ctx.root).get(f"{s.name} {ident}", {})
    ctl = [{"control": c["control"], "note": c["note"]} for c in register.control_rows(ctx.root) if c["requirement"] == f"{s.name} {ident}"]
    res = Resource("requirement", requirement, {"requirement": requirement, "spec": s.name, "id": ident, "text": text,
                                                "mechanism": row.get("mechanism", "missing"), "by": row.get("by", ""),
                                                "note": row.get("note", ""), "controls": ctl})
    res.links = [Link("spec", Call("spec show", {"spec": s.name}))]
    if row:
        res.actions = [next_command("record its enforcement again", "requirement set", requirement=requirement,
                                    mechanism=row["mechanism"], by=row["by"], **({"note": row["note"]} if row["note"] else {}))]
    return res


@command("requirement set", category="record", help="Set how a requirement is enforced, in the enforcement register",
         args=[Arg("requirement", "REQUIREMENT", "the requirement")],
         options=[Opt("--mechanism", "MECHANISM", "check, gate, review or none", required=True),
                  Opt("--by", "TEXT", "'<repository>: <command>' for check and gate, the defining requirement for review, '-' for none"),
                  Opt("--note", "TEXT", "what the row says in its own words")])
def requirement_set(ctx: Ctx, requirement: str, mechanism: str, by: str | None, note: str | None) -> Resource:
    spec, ident = _split(requirement)
    by = by if by is not None else ("-" if mechanism == "none" else None)
    if by is None:
        raise AgoraError("usage", f"a {mechanism} row needs --by", exit=USAGE)
    own, every = specs.index_of(ctx.root), specs.index_of(ctx.public, ctx.root)
    problem = register.row_problem(own, every, ctx.public, f"{spec} {ident}", mechanism, by, _own_repo(ctx), _command_problem(ctx))
    if problem:
        raise AgoraError("invalid-row", problem, exit=USAGE)
    path = ctx.root / register.REGISTER
    text = register.set_row(path.read_text(encoding="utf-8"), f"{spec} {ident}", mechanism, by, note or "")
    changes = files.apply(ctx, {path: text})
    return Resource("requirement", requirement, {"requirement": requirement, "mechanism": mechanism, "by": by,
                                                 "note": note or "", "dry_run": ctx.dry_run, "changes": changes},
                    actions=[next_command("check the register", "check", sections=["register"], scope=spec)])


@command("requirement add", category="record", help="Add the control a requirement addresses to the control map",
         args=[Arg("requirement", "REQUIREMENT", "the requirement")],
         options=[Opt("--control", "CONTROL", "<catalog>:<control>", required=True),
                  Opt("--note", "TEXT", "what the row says in its own words")])
def requirement_add(ctx: Ctx, requirement: str, control: str, note: str | None) -> Resource:
    spec, ident = _split(requirement)
    req = f"{spec} {ident}"
    if any(c["requirement"] == req and c["control"] == control for c in register.control_rows(ctx.root)):
        raise AgoraError("exists", f"{req} already addresses {control} (0028 FR-005)", exit=USAGE)
    path = ctx.root / register.CONTROL_MAP
    old = path.read_text(encoding="utf-8") if path.is_file() else ""
    changes = files.apply(ctx, {path: register.add_control_row(old, req, control, note or "")})
    return Resource("requirement", requirement, {"requirement": requirement, "control": control, "dry_run": ctx.dry_run,
                                                 "changes": changes},
                    actions=[next_command("check the control map", "check", sections=["controls"])])


# term --------------------------------------------------------------------------------------------------------------
@command("term list", category="read", help="List the ontology's concepts and schemes", relocatable=True,
         options=[Opt("--scheme", "SCHEME", "only the concepts of this scheme")])
def term_list(ctx: Ctx, scheme: str | None) -> Resource:
    rows = [{"id": t["id"], "kind": t["kind"], "scheme": t["scheme"], "label": t["label"], "notation": t["notation"]}
            for t in _terms(ctx) if not scheme or t["scheme"] == scheme]
    res = Resource("term-list", scheme or "all", {"count": len(rows), "scheme": scheme, "terms": rows},
                   links=[Link("term", Call("term show", {"term": r["id"]})) for r in rows])
    res.columns["terms"] = ["id", "kind", "scheme", "label", "notation"]
    return res


@command("term show", category="read", help="Show one concept or scheme", relocatable=True,
         args=[Arg("term", "TERM", "the term's local name")])
def term_show(ctx: Ctx, term: str) -> Resource:
    t = next(t for t in _terms(ctx) if t["id"] == term)
    res = Resource("term", term, dict(t))
    if t["scheme"]:
        res.links.append(Link("scheme", Call("term show", {"term": t["scheme"]})))
    if t["kind"] == "scheme":
        res.links.append(Link("concepts", Call("term list", {"scheme": term})))
    return res


# context providers (0041 FR-038) -----------------------------------------------------------------------------------
@context_for("spec", "SPEC")
def context_spec(ctx: Ctx, ident: str) -> dict[str, Any]:
    s = specs.resolve_spec(ctx.root, ident)
    assert s is not None
    rows = register.register_rows(ctx.root)
    reqs = [{"id": f"{s.name}/{i}", "mechanism": rows.get(f"{s.name} {i}", {}).get("mechanism", "missing"),
             "text": t[:TEXT_LEN] + ("..." if len(t) > TEXT_LEN else "")} for i, t in s.requirements()]
    d = spec_show(ctx, s.name)
    return {"resource": {k: v for k, v in d.data.items() if k != "requirement list"}, "specs": [{"name": s.name, "status": s.status}],
            "requirements": reqs, "files": [s.rel, str(register.REGISTER), str(register.CONTROL_MAP)],
            "links": d.links[:30], "actions": d.actions,
            "omitted": ["requirement text beyond its first %d characters (use requirement show)" % TEXT_LEN]}


@context_for("design-system", "DESIGN_SYSTEM")
def context_design_system(ctx: Ctx, ident: str) -> dict[str, Any]:
    d = design_system_show(ctx, ident)
    s = specs.resolve_spec(ctx.root, ident)
    base = f"design-systems/{ident}"
    files_ = [f"{base}/spec.md" if s else None, *(f"{base}/{h}" for h in design_systems.harness_files(ctx.root, ident)),
              str(register.REGISTER), "ontology/ifcore.ttl"]
    out: dict[str, Any] = {"resource": d.data, "specs": [], "requirements": [], "files": [f for f in files_ if f],
                           "links": d.links, "actions": d.actions}
    if s:
        rows = register.register_rows(ctx.root)
        out["specs"] = [{"name": s.name, "status": s.status}]
        out["requirements"] = [{"id": f"{s.name}/{i}", "mechanism": rows.get(f"{s.name} {i}", {}).get("mechanism", "missing"),
                                "text": t[:TEXT_LEN] + ("..." if len(t) > TEXT_LEN else "")} for i, t in s.requirements()]
        out["omitted"] = ["requirement text beyond its first %d characters (use requirement show)" % TEXT_LEN]
    return out


@context_for("term", "TERM")
def context_term(ctx: Ctx, ident: str) -> dict[str, Any]:
    d = term_show(ctx, ident)
    return {"resource": d.data, "specs": [{"name": "0019-controlled-vocabulary", "status": "see spec show"}], "requirements": [],
            "files": ["ontology/ifcore.ttl"], "links": d.links, "actions": d.actions}


@context_for("requirement", "REQUIREMENT")
def context_requirement(ctx: Ctx, ident: str) -> dict[str, Any]:
    d = requirement_show(ctx, ident)
    spec, _ = _split(ident)
    return {"resource": d.data, "specs": [{"name": spec, "status": specs.resolve_spec(ctx.root, spec).status}],
            "requirements": [], "files": [specs.resolve_spec(ctx.root, spec).rel, str(register.REGISTER), str(register.CONTROL_MAP)],
            "links": d.links, "actions": d.actions}


# check sections ----------------------------------------------------------------------------------------------------
@section("specs")
def check_specs(ctx: Ctx, scope: str | None) -> SectionResult:
    findings = specs.check_format(ctx.root, ctx.public)
    if scope:
        s = specs.resolve_spec(ctx.root, scope)
        findings = [f for f in findings if f.where.split(":")[0] == s.rel]
    n = len(specs.spec_files(ctx.root)) if not scope else 1
    return SectionResult.from_findings("specs", findings, [f"specs: {n} checked"], {"checked": n})


@section("register")
def check_register(ctx: Ctx, scope: str | None) -> SectionResult:
    findings, nones, counts = register.check_register(ctx.root, ctx.public, _own_repo(ctx), _command_problem(ctx), only=scope)
    notes = [f"enforcement: {sum(counts.values())} requirements — " + ", ".join(f"{counts[m]} {m}" for m in ("check", "gate", "review", "none"))]
    by_spec: dict[str, list[str]] = {}
    for req, _ in nones:
        spec, ident = req.split(" ")
        by_spec.setdefault(spec, []).append(ident[3:])
    if nones:  # 0020 FR-014: every run reports what nothing enforces
        notes.append("enforced by nothing (0020 FR-014; `requirement list --mechanism none` says why):")
        notes += [f"  {spec}: FR-" + ", ".join(ids) for spec, ids in by_spec.items()]
    return SectionResult.from_findings("register", findings, notes,
                                       {"counts": counts, "none": [{"requirement": r, "note": n} for r, n in nones]})


@section("controls")
def check_controls(ctx: Ctx, scope: str | None) -> SectionResult:
    findings, mapped = controls.check_control_map(ctx.root, ctx.public)
    return SectionResult.from_findings("controls", findings, [f"control map: {mapped} requirement-control links"] if mapped else [],
                                       {"links": mapped})


@section("ontology")
def check_ontology(ctx: Ctx, scope: str | None) -> SectionResult:
    findings = ontology.check_prefixes(ctx.root) + ontology.check_design_systems(ctx.root, ctx.public)
    return SectionResult.from_findings("ontology", findings)


# design-system -----------------------------------------------------------------------------------------------------
@command("design-system list", category="read", help="List design systems: kind, status, spec and harness", relocatable=True,
         options=[Opt("--kind", "KIND", "only design systems of this kind")])
def design_system_list(ctx: Ctx, kind: str | None) -> Resource:
    reg_ = design_systems.entries(ctx.root)
    rows = [design_systems.row(ctx.root, s, reg_.get(s)) for s in design_systems.slugs(ctx.root)]
    rows = [r for r in rows if not kind or r["kind"] == kind]
    res = Resource("design-system-list", kind or "all", {"count": len(rows), "kind": kind, "design systems": rows},
                   links=[Link("design system", Call("design-system show", {"design_system": r["slug"]})) for r in rows])
    res.columns["design systems"] = ["slug", "kind", "status", "spec", "requirements", "harness"]
    return res


@command("design-system show", category="read", help="Show one design system: its registration, spec, harness and derivation",
         relocatable=True, args=[Arg("design_system", "DESIGN_SYSTEM", "the design system")])
def design_system_show(ctx: Ctx, design_system: str) -> Resource:
    d = design_systems.detail(ctx.root, design_system)
    res = Resource("design-system", design_system, d)
    res.links = [Link("spec", Call("spec show", {"spec": design_system}))] if d["spec"] != "none" else []
    res.links += [Link("derives from", Call("design-system show", {"design_system": x})) for x in d["derives from"]
                  if x in design_systems.slugs(ctx.root)]
    res.links += [Link("derived by", Call("design-system show", {"design_system": x})) for x in d["derived by"]]
    if d["kind"] == "brand":
        res.links.append(Link("brand", Call("brand show", {"brand": design_system})))
    res.actions = [next_command("check its spec", "check", sections=["specs", "register"], scope=design_system)]
    return res


@command("design-system new", category="generate",
         help="Scaffold a design system whose spec and ontology entry already exist (0001 FR-037)",
         args=[Arg("slug", "SLUG", "the design system's slug, ending with its kind's code")],
         options=[Opt("--kind", "KIND", "its kind: the ontology entry's, and the code its slug ends with", required=True)])
def design_system_new(ctx: Ctx, slug: str, kind: str) -> Resource:
    again = [next_command("see the design systems", "design-system list")]
    if not slug.endswith("-" + kind):
        raise AgoraError("kind", f"{slug} does not end with -{kind}: a design system's slug ends with its kind's code (0014-design-systems FR-003)",
                         exit=USAGE, actions=again)
    d = ctx.root / "design-systems" / slug
    if not (d / "spec.md").is_file():
        raise AgoraError("no-spec", f"design-systems/{slug}/spec.md does not exist: the spec comes first, then the ontology, then the work "
                         "(0001-eidolon-architecture FR-037; 0014-design-systems FR-022)", exit=FAILED,
                         actions=[next_command("write the spec first", "spec list")])
    entry = design_systems.entries(ctx.root).get(slug)
    if entry is None:
        raise AgoraError("no-entry", f"{slug} has no ifcore:DesignSystem individual in ontology/ifcore.ttl: the ontology comes before the work "
                         "(0001-eidolon-architecture FR-037; 0014-design-systems FR-010)", exit=FAILED, actions=again)
    if entry["kind"] != kind:
        raise AgoraError("kind", f"the ontology registers {slug} as kind {entry['kind']!r}, not {kind!r} (a kind never changes, "
                         "0014-design-systems FR-018)", exit=USAGE, actions=again)
    wanted = design_systems.scaffold(ctx.root, slug, entry["label"] or slug)
    missing = {p: t for p, t in wanted.items() if not p.exists()}
    changes = files.apply(ctx, missing)
    res = Resource("design-system", slug, {"slug": slug, "kind": kind, "dry_run": ctx.dry_run, "changes": changes,
                                           "kept": [str(p.relative_to(ctx.root)) for p in wanted if p not in missing]
                                           + [f"design-systems/{slug}/{h}" for h in design_systems.harness_files(ctx.root, slug)]})
    res.actions = [next_command("check its spec and register rows", "check", sections=["specs", "register"], scope=slug),
                   next_command("run its harness", "check", sections=["design-systems"], scope=slug)]
    return res
