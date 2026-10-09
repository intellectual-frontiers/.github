"""Specs, requirements, the ontology, and the check sections for them (0042-agora FR-006, FR-013).

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
from agora.lib import controls, design_systems, noemas, ontology, reflections, register, specs, terms, vocabulary
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


def _onto(ctx: Ctx) -> terms.Ontology:
    return terms.load(ctx.root)


class _Term(ArgType):
    name = "TERM"
    doc = "a term of the ontology as a CURIE, such as ifcore:Agora, or its full IRI"

    def choices(self, ctx: Ctx) -> list[str]:
        return sorted(_onto(ctx).by_curie)

    def validate(self, ctx: Ctx, value: str) -> str:
        t = _onto(ctx).resolve(value)
        if t is None:
            near = _onto(ctx).nearest(value)
            raise ValueError(f"{value!r} names no term of the ontology" + (f"; the nearest are {', '.join(near)}" if near else "; `ontology list --match TEXT` finds one"))
        return t.curie

    def examples(self, ctx: Ctx) -> list[str]:
        return ["ifcore:Agora", "ifcore:ReadCommandCategory"]


class _Scheme(ArgType):
    name = "SCHEME"
    doc = "a concept scheme of the ontology as a CURIE, such as ifcore:CommandCategoryScheme, or by its local name"

    def choices(self, ctx: Ctx) -> list[str]:
        return sorted(t.curie for t in _onto(ctx).terms.values() if t.kind == "scheme")

    def validate(self, ctx: Ctx, value: str) -> str:
        v = value if ":" in value else f"ifcore:{value}"
        if v not in self.choices(ctx):
            raise ValueError(f"{value!r} names no concept scheme of the ontology; `ontology list --kind scheme` lists them")
        return v

    def examples(self, ctx: Ctx) -> list[str]:
        return ["ifcore:CommandCategoryScheme"]


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


def _enforcing_action(ctx: Ctx, by: str):
    """The action that runs what a `check` or `gate` row names, when it is one of this command line's own: `check SECTION...`, `test` or `fresh`."""
    words = by.partition(": ")[2].split()
    if not words or words[0] != ctx.name:
        return None
    rest = words[1:]
    if rest[:1] == ["check"] and all(w in ctx.registry.sections for w in rest[1:]):
        return next_command("run the check that enforces it", "check", sections=rest[1:])
    if rest in (["test"], ["fresh"]):
        return next_command("run what enforces it", rest[0])
    return None


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
                                                "note": row.get("note", ""), "controls": ctl, "path": s.rel,
                                                "line": specs.line_of(s, ident)})
    res.links = [Link("spec", Call("spec show", {"spec": s.name}))]
    run = _enforcing_action(ctx, row.get("by", "")) if row.get("mechanism") in ("check", "gate") else None
    if run is not None:
        res.actions.append(run)
    if row:
        res.actions += [next_command("record its enforcement again", "requirement set", requirement=requirement,
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


# ontology ----------------------------------------------------------------------------------------------------------
KIND_CHOICE = Choice("ONTOLOGY_KIND", terms.KINDS, "the kind of an ontology term (0042 FR-037)")


def _term_text(res: Resource) -> str:
    rows = res.data["terms"]
    if not rows:
        return "no term matches" + (f" {res.data['match']!r}" if res.data.get("match") else "")
    w = max(len(r["curie"]) for r in rows)
    return "\n".join(f"{r['curie']:<{w}}  {r['kind']:<10}  {r['label']}" for r in rows)


@command("ontology list", category="read", help="List the ontology's classes, properties, individuals, schemes and concepts, or the ones that match a text",
         relocatable=True,
         options=[Opt("--kind", "ONTOLOGY_KIND", "only terms of this kind: class, property, individual, scheme or concept"),
                  Opt("--scheme", "SCHEME", "only the concepts of this scheme"),
                  Opt("--match", "TEXT", "only terms whose label, comment, CURIE, IRI or notation holds this text, best match first")])
def ontology_list(ctx: Ctx, kind: str | None, scheme: str | None, match: str | None) -> Resource:
    rows = _onto(ctx).listing(kind, scheme, match)
    res = Resource("ontology-list", match or scheme or kind or "all",
                   {"count": len(rows), "kind": kind, "scheme": scheme, "match": match, "terms": rows},
                   links=[Link("term", Call("ontology show", {"term": r["curie"]})) for r in rows[:100]], text=_term_text)
    if not rows:
        res.actions.append(Action("List every term", Call("ontology list", {})))
    res.columns["terms"] = ["curie", "kind", "label", "summary"]
    return res


@command("ontology show", category="read", help="Show one term: its meaning, relations, statements, what references it and the requirements that cite it",
         relocatable=True, args=[Arg("term", "TERM", "the term, as a CURIE or its full IRI")])
def ontology_show(ctx: Ctx, term: str) -> Resource:
    onto = _onto(ctx)
    t = onto.resolve(term)
    assert t is not None
    data, found = onto.show(t, terms.citations(ctx.root, onto, t))
    res = Resource("ontology", t.curie, data)
    seen: set[tuple[str, str]] = set()
    for rel, ident, noun in found:
        if (ident, noun) not in seen:
            seen.add((ident, noun))
            res.links.append(Link(rel, Call("ontology show", {"term": ident}) if noun == "ontology" else Call("requirement show", {"requirement": ident})))
    if t.kind == "scheme":
        res.links.append(Link("concepts", Call("ontology list", {"scheme": t.curie})))
    for key, cols in (("statements", ["predicate", "object", "kind"]), ("referenced_by", ["curie", "label", "kind", "predicate"]),
                      ("specs", ["requirement", "how", "text"])):
        res.columns[key] = cols
    return res


# reflection --------------------------------------------------------------------------------------------------------
REFLECTION_KIND = Choice("REFLECTION_KIND", tuple(reflections.KIND_CLASS), "a kind of digital reflection (0047-digital-reflections FR-001)")
EPISTEMIC_STATE = Choice("EPISTEMIC_STATE", noemas.STATES, "an epistemic state of a Noema (0048-noemas FR-011)")
REVIEW_STATE = Choice("REVIEW_STATE", reflections.REVIEW_STATES, "a review state (0047-digital-reflections FR-038)")


def _reflection_graph(ctx: Ctx) -> tuple[reflections.Graph, set[str]]:
    g, _ = reflections.load(ctx.root, ctx.public)
    own = {str(f.relative_to(ctx.root)) for f in (ctx.root / "ontology").rglob("*.ttl")} if (ctx.root / "ontology").is_dir() else set()
    if ctx.public == ctx.root:
        own |= {str(f.relative_to(ctx.root)) for f in reflections.examples(ctx.root)}
    return g, own


def _local(node: Any) -> str:
    v = getattr(node, "value", str(node))
    return v.rsplit("#", 1)[-1].rsplit("/", 1)[-1]


def _label(g: reflections.Graph, subject: Any) -> str:
    for p in ("http://www.w3.org/2000/01/rdf-schema#label", "http://www.w3.org/2004/02/skos/core#prefLabel"):
        for o in g.objects(subject, p):
            if hasattr(o, "lang") or hasattr(o, "datatype"):
                return o.value
    return _local(subject)


class _Subject(ArgType):
    name = "SUBJECT"
    doc = "a subject a reflection is a record of, by its full IRI or by its local name when only one subject has it"

    def validate(self, ctx: Ctx, value: str) -> str:
        g, _ = _reflection_graph(ctx)
        reflected = {o.value for rec in g.members(reflections.REFLECTION) for o in g.objects(rec, reflections.REFLECTS)}
        if value in reflected:
            return value
        hits = sorted(v for v in reflected if _local(type("N", (), {"value": v})()) == value)
        if len(hits) == 1:
            return hits[0]
        if hits:
            raise ValueError(f"{value!r} is the local name of {len(hits)} subjects; give the full IRI: {', '.join(hits[:5])}")
        raise ValueError(f"{value!r} is not the subject of any reflection; `reflection list` lists them")

    def examples(self, ctx: Ctx) -> list[str]:
        return ["https://example.org/noema/falsified#KeywordRouting"]


SUBJECT = _Subject()


def _kind_of_record(g: reflections.Graph, rec: Any) -> str:
    k = reflections.record_kind(g, rec)
    return next(iter(k)) if len(k) == 1 else "invalid"


@command("reflection list", category="read", help="List digital reflections: Eidolons, Ergons and Noemas, with the Noemas' epistemic state and every review state; or the audit of how a repository's subjects classify",
         relocatable=True,
         options=[Opt("--kind", "REFLECTION_KIND", "only reflections of this kind"),
                  Opt("--state", "EPISTEMIC_STATE", "only Noemas whose current epistemic state is this"),
                  Opt("--review", "REVIEW_STATE", "only records in this review state; candidate lists what awaits a person"),
                  Opt("--on", "DATE", "judge each Noema's state on this date (ISO), not today"),
                  Opt("--duplicates", None, "list Noema subjects that share a label, for a person to merge or tell apart"),
                  Opt("--audit", None, "classify every subject of the repository and list the reflections that need review; changes nothing")])
def reflection_list(ctx: Ctx, kind: str | None, state: str | None, review: str | None, on: str | None, duplicates: bool, audit: bool) -> Resource:
    g, own = _reflection_graph(ctx)
    if audit:
        data = reflections.audit(g, own)
        res = Resource("reflection-audit", "audit", data, text=lambda r: "\n".join(f"{k}: {v}" for k, v in r.data["subjects"].items()) or "no subjects")
        res.actions.append(Action("Check the ontology", Call("check", {"sections": ["ontology"]})))
        return res
    if duplicates:
        rows = [{"one": a.value, "other": b.value, "label": lab} for a, b, lab in noemas.possible_duplicates(g)]
        return Resource("reflection-duplicates", "duplicates", {"count": len(rows), "duplicates": rows},
                        text=lambda r: "\n".join(f"{x['label']}: {_local_iri(x['one'])} / {_local_iri(x['other'])}" for x in r.data["duplicates"]) or "no possible duplicates")
    rows = []
    for rec in sorted(g.members(reflections.REFLECTION), key=lambda n: n.value):
        if g.file(rec) not in own:
            continue
        k = _kind_of_record(g, rec)
        subj = next((o for o in g.objects(rec, reflections.REFLECTS) if hasattr(o, "value")), None)
        rv = reflections.review_state(g, rec)
        st = noemas.current_state(g, subj, on)[0] if (k == reflections.NOEMA_K and subj is not None) else None
        if (kind and k != kind) or (review and rv != review) or (state and st != state):
            continue
        rows.append({"record": rec.value, "kind": k, "subject": subj.value if subj is not None else None,
                     "label": _label(g, subj) if subj is not None else _local(rec), "state": st, "review": rv})
    res = Resource("reflection-list", kind or "all", {"count": len(rows), "kind": kind, "state": state, "review": review, "reflections": rows},
                   links=[Link("reflection", Call("reflection show", {"subject": r["subject"]})) for r in rows[:100] if r["subject"]],
                   text=lambda r: "\n".join(f"{x['kind']:<7} {x['review']:<9} {(x['state'] or ''):<19} {x['label']}" for x in r.data["reflections"]) or "no reflection matches")
    res.columns["reflections"] = ["kind", "label", "state", "review", "subject"]
    return res


def _local_iri(v: str) -> str:
    return v.rsplit("#", 1)[-1].rsplit("/", 1)[-1]


def _names(g: reflections.Graph, nodes: Any) -> list[dict[str, Any]]:
    out = []
    for x in nodes:
        out.append({"id": x.value, "name": _local(x), "review": reflections.review_state(g, x), "label": reflections.label_of(g, x),
                    "source": [_local(o) for o in g.objects(x, reflections.SOURCE)],
                    "attributed_to": [_local(o) for o in g.objects(x, reflections.ATTRIBUTED)]})
    return out


@command("reflection show", category="read", help="Show one digital reflection by its subject: for a Noema its current state, claims, evidence for and against, assumptions, falsifiers, open questions, research stage and reasons to look again, each with its source and review state",
         relocatable=True, args=[Arg("subject", "SUBJECT", "the subject the reflection is a record of")],
         options=[Opt("--on", "DATE", "judge the state and the evidence on this date (ISO), not today")])
def reflection_show(ctx: Ctx, subject: str, on: str | None) -> Resource:
    g, _ = _reflection_graph(ctx)
    from agora.lib.turtle import Iri
    subj = Iri(subject)
    recs = [r for r in g.members(reflections.REFLECTION) if subj in g.objects(r, reflections.REFLECTS)]
    kind, why = reflections.subject_kind(g, subj)
    data: dict[str, Any] = {"subject": subject, "label": _label(g, subj), "kind": kind, "why": why,
                            "records": [{"record": r.value, "is": _kind_of_record(g, r), "review": reflections.review_state(g, r)} for r in recs],
                            "types": sorted(reflections.short(t) for t in g.declared_types(subj))}
    rels = lambda t, a=None, b=None: _names(g, reflections.relationships_of(g, t, a, b, on))      # noqa: E731
    if kind == reflections.NOEMA_K:
        st, by = noemas.current_state(g, subj, on)
        aspect = lambda a: _names(g, noemas.aspects_of(g, subj, a))                               # noqa: E731
        ev = noemas.evidence(g, subj, on)
        data.update({
            "subtypes": sorted(noemas.subtypes(g, subj)), "state": st, "state_given_by": _local(by) if by else None,
            "assessments": _names(g, noemas.assessments(g, subj)),
            "claims": [{"id": c.value, "text": next((o.value for o in g.objects(c, "https://schema.org/text")), None)} for c in noemas.claims_of(g, subj, on)],
            "evidence": {t: _names(g, v) for t, v in ev.items() if v},
            "assumptions": aspect("assumption"), "falsification_criteria": aspect("falsification-criterion"), "predictions": aspect("prediction"),
            "limitations": aspect("limitation"), "open_questions": aspect("open-question"), "counterarguments": aspect("counterargument"),
            "commercial": {a: v for a in ("problem-addressed", "potential-buyer", "product-wedge", "commercial-hypothesis", "demand-evidence",
                                          "competing-approach", "adoption-obstacle", "native-alpha-source") if (v := aspect(a))},
            "research_stage": {k: {"reached": [_local(x) for x in v["reached"]], "pending": [_local(x) for x in v["pending"]]} for k, v in noemas.trace(g, subj).items()},
            "reexamine": noemas.reexamine(g, subj)})
    else:
        data["relationships"] = {"from": _names(g, reflections.relationships_of(g, None, subj, None, on)), "to": _names(g, reflections.relationships_of(g, None, None, subj, on))}
        data["assertions"] = _names(g, noemas.assertions_about(g, subj))
    res = Resource("reflection", _local(subj), data)
    res.links.append(Link("kind", Call("ontology show", {"term": "ifcore:" + (_local_iri(reflections.KIND_CLASS[kind]) if kind in reflections.KIND_CLASS else "DigitalReflection")})))
    res.actions.append(Action("List reflections", Call("reflection list", {})))
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


@context_for("ontology", "TERM")
def context_ontology(ctx: Ctx, ident: str) -> dict[str, Any]:
    d = ontology_show(ctx, ident)
    rows = register.register_rows(ctx.root)
    cited = d.data["specs"]
    names_ = sorted({c["requirement"].split("/")[0] for c in cited})
    reqs = [{"id": c["requirement"], "mechanism": rows.get(c["requirement"].replace("/", " "), {}).get("mechanism", "missing"), "text": c["text"]}
            for c in cited]
    out = {k: v for k, v in d.data.items() if k not in ("specs", "referenced_by", "statements", "individuals", "members")}
    out["statements"] = d.data["statements"][:40]
    return {"resource": out, "specs": [{"name": n, "status": (specs.resolve_spec(ctx.root, n).status if specs.resolve_spec(ctx.root, n) else "")} for n in names_],
            "requirements": reqs, "files": [d.data["path"], str(register.REGISTER)], "links": d.links[:40], "actions": d.actions,
            "omitted": ["the statements beyond the first 40, the terms that reference it, its individuals and members (use ontology show)"]}


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
    findings = ontology.check_prefixes(ctx.root) + ontology.check_design_systems(ctx.root, ctx.public) \
        + reflections.check(ctx.root, ctx.public)
    return SectionResult.from_findings("ontology", findings)


@section("vocabulary")
def check_vocabulary(ctx: Ctx, scope: str | None) -> SectionResult:
    terms_ = vocabulary.scan({"repository": ctx.root})
    s = vocabulary.summary(terms_)
    notes = [f"vocabulary: {s['terms']} terms: {s['reused']} reused, {s['excepted']} excepted by a Decision, {s['unmapped']} unmapped "
             "(0019 FR-009; the weekly AI Audit judges the unmapped, `spec-kit/audits/vocabulary-drift.md`)"]
    return SectionResult.from_findings("vocabulary", vocabulary.findings(terms_), notes, {"summary": s, "unmapped": vocabulary.rows(terms_, "unmapped")})


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
