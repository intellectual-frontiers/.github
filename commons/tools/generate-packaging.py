#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["rdflib==7.1.4"]
# ///
"""Generate the packaging table from the packaging ontology (commons 0002-packaging).

    uv run commons/tools/generate-packaging.py            write commons/generated/packaging.auto.toml, packaging.auto.sh and pins.auto.env, and the marked blocks of bin/erga-setup.sh
    uv run commons/tools/generate-packaging.py --check    exit 1, writing nothing, where either file is not what the ontology makes

The ontology (commons/ontology/supply-chain/packaging/*.ttl) is the source; the two generated files are never edited by hand. The TOML is for programs (a harness reads it),
the shell fragment is for scripts that run before any harness exists. The ontology is checked first: a rule it breaks stops the run with every finding named.
"""
from __future__ import annotations

import hashlib
import re
import shlex
import sys
from pathlib import Path

from rdflib import RDF, RDFS, Graph, Literal, Namespace, URIRef
from rdflib.namespace import DCTERMS, OWL

COMMONS = Path(__file__).resolve().parent.parent
ONTOLOGY = COMMONS / "ontology" / "supply-chain" / "packaging"
OUT_TOML = COMMONS / "generated" / "packaging.auto.toml"
OUT_SH = COMMONS / "generated" / "packaging.auto.sh"
OUT_PINS = COMMONS / "generated" / "pins.auto.env"
OUT_RULES = COMMONS / "generated" / "rules.auto.toml"
OUT_RECORD = COMMONS / "generated" / "install-record.auto.toml"
RULE_SETS = ("shell-portability", "ci-forbidden-program", "ci-forbidden-action", "host-program", "installer")
FIELD_TYPES = ("text", "boolean", "date")
SCRIPTS = [COMMONS.parent / "bin" / "erga-setup.sh"]   # carry the fragment between its marks, as a script piped from the internet has no file beside it
BLOCK = re.compile(r"# >>> packaging\.auto >>>\n.*?# <<< packaging\.auto <<<\n", re.S)
PINS_BLOCK = re.compile(r"# >>> pins\.auto >>>\n.*?# <<< pins\.auto <<<\n", re.S)
HEX64 = re.compile(r"^[0-9a-f]{64}$")

PM = Namespace("https://www.intellectualfrontiers.com/ontology/packaging#")
SCHEMA_VERSION = 1
OPS = ("install", "remove", "upgrade", "upgrade-all", "search", "info", "refresh", "list-installed", "query-installed", "query-candidate", "query-version")
OP_OF = {PM.Install: "install", PM.Remove: "remove", PM.Upgrade: "upgrade", PM.UpgradeAll: "upgrade-all", PM.Search: "search", PM.Info: "info", PM.Refresh: "refresh",
         PM.ListInstalled: "list-installed", PM.QueryInstalled: "query-installed", PM.QueryCandidate: "query-candidate", PM.QueryVersion: "query-version"}
ASSURANCE = {PM.Verified: "verified", PM.StandIn: "stand-in", PM.Untested: "untested", PM.NoAssurance: "none"}
KIND = {PM.SystemKind: "system", PM.HelperKind: "helper", PM.UniversalKind: "universal"}
TIER = {PM.Required: "required", PM.Comfort: "comfort"}
SHELL_SYNTAX = re.compile(r"[;|&<>`()\n]")   # a command is a list of words, never a line for a shell
PLACEHOLDER = re.compile(r"\{packages?\}")


class Broken(Exception):
    def __init__(self, findings: list[str]) -> None:
        super().__init__("\n".join(findings))
        self.findings = findings


def load() -> tuple[Graph, str]:
    g = Graph()
    digest = hashlib.sha256()
    for f in sorted(ONTOLOGY.glob("*.ttl")):
        data = f.read_bytes()
        digest.update(f.name.encode() + b"\0" + data)
        g.parse(data=data, format="turtle")
    return g, digest.hexdigest()


def one(g: Graph, s: URIRef, p: URIRef) -> str | None:
    vals = sorted(str(o) for o in g.objects(s, p))
    return vals[0] if vals else None


def many(g: Graph, s: URIRef, p: URIRef) -> list[str]:
    return sorted(str(o) for o in g.objects(s, p))


def ident(g: Graph, s: URIRef) -> str:
    return one(g, s, DCTERMS.identifier) or str(s).rsplit("/", 1)[-1]


def words(template: str) -> list[str]:
    return shlex.split(template)


def model(g: Graph) -> tuple[dict, list[str]]:
    """The whole table, and every rule of the ontology it breaks."""
    bad: list[str] = []
    skos_def = URIRef("http://www.w3.org/2004/02/skos/core#definition")
    for kind in (OWL.Class, OWL.DatatypeProperty, OWL.ObjectProperty):   # 0002-packaging FR-001: every term of the vocabulary is defined
        for term in sorted(g.subjects(RDF.type, kind)):
            if str(term).startswith(str(PM)) and not one(g, term, skos_def):
                bad.append(f"the term {str(term)[len(str(PM)):]} has no definition")
            if kind == OWL.Class and str(term).startswith(str(PM)) and not one(g, term, RDFS.label):
                bad.append(f"the class {str(term)[len(str(PM)):]} has no label")
    managers: dict[str, dict] = {}
    by_iri: dict[URIRef, str] = {}
    for m in sorted(g.subjects(RDF.type, PM.PackageManager)):
        mid = ident(g, m)
        by_iri[m] = mid
        if mid in managers:
            bad.append(f"two managers are called {mid}")
        kinds = [KIND[k] for k in g.objects(m, PM.kind) if k in KIND]
        exe = one(g, m, PM.executable)
        if not exe:
            bad.append(f"manager {mid} has no executable")
        if len(kinds) != 1:
            bad.append(f"manager {mid} must have exactly one kind")
        admin = one(g, m, PM.needsAdministrator)
        managers[mid] = {"executable": exe or "", "kind": kinds[0] if kinds else "", "administrator": admin == "true", "environment": one(g, m, PM.environment) or "",
                         "purl_type": one(g, m, PM.purlType) or "", "harness_use": one(g, m, PM.harnessUse) or "", "commands": {}, "note": one(g, m, PM.note) or ""}
    prohibitions: list[dict] = []
    for p in sorted(g.subjects(RDF.type, PM.Prohibition)):
        owner = next(g.objects(p, PM.prohibitionOf), None)
        t = one(g, p, PM.forbiddenTemplate)
        why = one(g, p, URIRef("http://www.w3.org/2004/02/skos/core#definition"))
        if owner not in by_iri or not t or not why:
            bad.append(f"prohibition {p} needs a manager, a template and a reason")
            continue
        prohibitions.append({"manager": by_iri[owner], "template": t, "argv": words(t), "reason": why})
    forbidden = {(p["manager"], p["template"]) for p in prohibitions}
    for c in sorted(g.subjects(RDF.type, PM.Command)):
        owner = next(g.objects(c, PM.commandOf), None)
        op = next((OP_OF[o] for o in g.objects(c, PM.operation) if o in OP_OF), None)
        t = one(g, c, PM.template)
        if owner not in by_iri or op is None or not t:
            bad.append(f"command {c} needs a manager, an operation and a template")
            continue
        mid = by_iri[owner]
        ni = one(g, c, PM.nonInteractive)
        for label, text in (("template", t), ("non-interactive form", ni)):
            if text is None:
                continue
            if SHELL_SYNTAX.search(text):
                bad.append(f"{mid} {op}: the {label} holds shell syntax; a command is a list of words")
            if (mid, text) in forbidden:
                bad.append(f"{mid} {op}: the {label} is a command the ontology forbids ({text})")
        if op in managers[mid]["commands"]:
            bad.append(f"{mid} has two {op} commands")
        entry: dict = {"argv": words(t), "origin": one(g, c, PM.origin) or "", "verified": one(g, c, PM.verifiedOn) or ""}
        if ni:
            entry["noninteractive"] = words(ni)
        managers[mid]["commands"][op] = entry
    families: dict[str, dict] = {}
    fam_iri: dict[URIRef, str] = {}
    seen_ids: dict[str, str] = {}
    for f in sorted(g.subjects(RDF.type, PM.SystemFamily)):
        fid = ident(g, f)
        fam_iri[f] = fid
        detect = many(g, f, PM.detectedBy)
        if not detect:
            bad.append(f"family {fid} has no ID that detects it")
        for d in detect:
            if d in seen_ids and d != "*":
                bad.append(f"the ID {d} detects both {seen_ids[d]} and {fid}")
            seen_ids[d] = fid
        status = "supported" if PM.Supported in g.objects(f, PM.supportStatus) else "catalogued" if PM.Catalogued in g.objects(f, PM.supportStatus) else ""
        assure = next((ASSURANCE[a] for a in g.objects(f, PM.assurance) if a in ASSURANCE), "")
        if not status:
            bad.append(f"family {fid} has no support status")
        if not assure:
            bad.append(f"family {fid} has no assurance")
        used = [by_iri[m] for m in g.objects(f, PM.usesManager) if m in by_iri]
        pref = next((by_iri[m] for m in g.objects(f, PM.preferredManager) if m in by_iri), "")
        if len(used) != len(list(g.objects(f, PM.usesManager))):
            bad.append(f"family {fid} names a manager that does not exist")
        installs = one(g, f, PM.harnessInstallsPackages)
        families[fid] = {"label": one(g, f, RDFS.label) or fid, "status": status, "assurance": assure, "detect": detect, "detect_source": one(g, f, PM.detectSource) or "",
                         "uname": one(g, f, PM.unameName) or "", "managers": used, "preferred": pref, "installs_packages": installs != "false",
                         "removal_hint": one(g, f, PM.removalHint) or "", "admin_install": one(g, f, PM.adminInstall) or "", "verified_on": one(g, f, PM.verifiedOn) or "",
                         "note": one(g, f, PM.note) or ""}
    programs: dict[str, dict] = {}
    prog_iri: dict[URIRef, str] = {}
    for p in sorted(g.subjects(RDF.type, PM.Program)):
        name = one(g, p, PM.programName)
        tier = next((TIER[t] for t in g.objects(p, PM.tier) if t in TIER), None)
        if not name or not tier:
            bad.append(f"program {p} needs a name and a tier")
            continue
        prog_iri[p] = name
        order = one(g, p, PM.order)
        if order is None or not order.isdigit():
            bad.append(f"program {name} has no order")
        programs[name] = {"tier": tier, "order": int(order) if order and order.isdigit() else 0, "names": {}}
    for n in sorted(g.subjects(RDF.type, PM.PackageName)):
        prog = next(g.objects(n, PM.forProgram), None)
        fam = next(g.objects(n, PM.forFamily), None)
        text = one(g, n, PM.name)
        if prog not in prog_iri or fam not in fam_iri or not text:
            bad.append(f"package name {n} needs a program, a family and a name")
            continue
        programs[prog_iri[prog]]["names"][fam_iri[fam]] = text
    # ---- rules for a family a harness acts on
    for fid, f in sorted(families.items()):
        if f["status"] != "supported":
            continue
        if f["assurance"] == "none":
            bad.append(f"family {fid} is supported, so it needs an assurance other than none")
        if f["assurance"] == "verified" and not f["verified_on"]:
            bad.append(f"family {fid} is verified but says no where or when")
        if not f["removal_hint"]:
            bad.append(f"family {fid} is supported and has no removal hint")
        if not f["installs_packages"]:
            continue
        pm_ = managers.get(f["preferred"])
        if pm_ is None:
            bad.append(f"family {fid} is supported and has no preferred manager")
            continue
        inst = pm_["commands"].get("install")
        if not inst or "noninteractive" not in inst:
            bad.append(f"family {fid}: {f['preferred']} needs an install command with a non-interactive form")
        elif inst["origin"] != "archon":
            bad.append(f"family {fid}: the non-interactive install of {f['preferred']} must come from a harness (origin archon), not from {inst['origin'] or 'nowhere'}")
        if not f["admin_install"]:
            bad.append(f"family {fid} is supported and has no command for a person with administrator rights")
        if "query-installed" not in pm_["commands"]:
            bad.append(f"family {fid}: {f['preferred']} has no query-installed command, so a harness cannot tell what is already there")
        for name, p in sorted(programs.items()):
            if p["tier"] == "required" and fid not in p["names"]:
                bad.append(f"required program {name} has no package name for the supported family {fid}")
    for name, p in programs.items():
        for fid in p["names"]:
            if families[fid]["status"] != "supported":
                bad.append(f"program {name} names a package for {fid}, which is not supported")
    platforms: dict[str, dict] = {}
    plat_iri: dict[URIRef, str] = {}
    suffixes: set[str] = set()
    for pl in sorted(g.subjects(RDF.type, PM.Platform)):
        name = one(g, pl, PM.platformName)
        rec = {"os": one(g, pl, PM.operatingSystem) or "", "processor": one(g, pl, PM.processor) or "", "suffix": one(g, pl, PM.pinSuffix) or "", "label": one(g, pl, RDFS.label) or ""}
        if not name or not all(rec.values()):
            bad.append(f"platform {pl} needs a name, an operating system, a processor, a pin suffix and a label")
            continue
        if rec["suffix"] in suffixes:
            bad.append(f"two platforms share the pin suffix {rec['suffix']}")
        suffixes.add(rec["suffix"])
        plat_iri[pl] = name
        platforms[name] = rec
    pins: dict[str, dict] = {}
    pin_iri: dict[URIRef, str] = {}
    keys: set[str] = set()
    for pn in sorted(g.subjects(RDF.type, PM.PinnedDownload)):
        name, key, version = one(g, pn, PM.programName), one(g, pn, PM.pinKey), one(g, pn, PM.version)
        if not (name and key and version):
            bad.append(f"pinned download {pn} needs a name, a key and a version")
            continue
        if key in keys:
            bad.append(f"two pinned downloads share the key {key}")
        keys.add(key)
        pin_iri[pn] = name
        pins[name] = {"key": key, "version": version, "label": one(g, pn, RDFS.label) or name, "note": one(g, pn, PM.note) or "", "sha256": {}}
    for c in sorted(g.subjects(RDF.type, PM.Checksum)):
        pn, pl, digest = next(g.objects(c, PM.forPin), None), next(g.objects(c, PM.forPlatform), None), one(g, c, PM.sha256)
        if pn not in pin_iri or pl not in plat_iri or not digest:
            bad.append(f"checksum {c} needs a pinned download, a platform and a SHA-256")
            continue
        if not HEX64.match(digest):
            bad.append(f"the checksum of {pin_iri[pn]} on {plat_iri[pl]} is not 64 lower-case hexadecimal digits")
        if plat_iri[pl] in pins[pin_iri[pn]]["sha256"]:
            bad.append(f"{pin_iri[pn]} has two checksums for {plat_iri[pl]}")
        pins[pin_iri[pn]]["sha256"][plat_iri[pl]] = digest
    rules: list[dict] = []
    for r in sorted(g.subjects(RDF.type, PM.Rule), key=str):
        rid = str(r).rsplit("rule-", 1)[-1]
        rset, pat, label, why = one(g, r, PM.ruleSet), one(g, r, PM.pattern), one(g, r, RDFS.label), one(g, r, skos_def)
        if rset not in RULE_SETS or not (pat and label and why):
            bad.append(f"rule {rid} needs a set (one of {', '.join(RULE_SETS)}), a pattern, a name and a reason")
            continue
        try:
            re.compile(pat)
        except re.error as e:
            bad.append(f"rule {rid}: the pattern is not a regular expression: {e}")
        if any(x["id"] == rid for x in rules):
            bad.append(f"two rules are called {rid}")
        rules.append({"id": rid, "set": rset, "pattern": pat, "label": label, "reason": why})
    record: list[dict] = []
    for f in sorted(g.subjects(RDF.type, PM.RecordField), key=lambda x: int(one(g, x, PM.order) or 0)):
        name, typ, order = one(g, f, PM.fieldName), one(g, f, PM.fieldType), one(g, f, PM.order)
        if not name or typ not in FIELD_TYPES or not order or not one(g, f, skos_def):
            bad.append(f"record field {f} needs a name, a type (one of {', '.join(FIELD_TYPES)}), an order and a definition")
            continue
        if any(x["name"] == name for x in record) or any(x["order"] == int(order) for x in record):
            bad.append(f"the record field {name} repeats a name or an order")
        record.append({"name": name, "type": typ, "order": int(order), "definition": one(g, f, skos_def), "values": many(g, f, PM.allowedValue)})
    return {"managers": managers, "families": families, "programs": programs, "prohibitions": prohibitions, "platforms": platforms, "pins": pins, "rules": rules, "record": record}, bad


# ---- TOML ------------------------------------------------------------------------------------------------------------------------------------------

def s(x: str) -> str:
    return '"' + x.replace("\\", "\\\\").replace('"', '\\"') + '"'


def arr(xs: list[str]) -> str:
    return "[" + ", ".join(s(x) for x in xs) + "]"


def toml(t: dict, digest: str) -> str:
    out = ["# AUTO-GENERATED by commons/tools/generate-packaging.py from commons/ontology/supply-chain/packaging/*.ttl (commons 0002-packaging). Do not edit: change the ontology.",
           f"schema = {SCHEMA_VERSION}", f"source_sha256 = {s(digest)}", ""]
    for fid, f in sorted(t["families"].items()):
        out += [f"[families.{fid}]", f"label = {s(f['label'])}", f"status = {s(f['status'])}", f"assurance = {s(f['assurance'])}", f"detect = {arr(f['detect'])}",
                f"detect_source = {s(f['detect_source'])}", f"managers = {arr(f['managers'])}"]
        for k in ("uname", "preferred", "removal_hint", "admin_install", "verified_on", "note"):
            if f[k]:
                out.append(f"{k} = {s(f[k])}")
        out += [f"installs_packages = {str(f['installs_packages']).lower()}", ""]
    for mid, m in sorted(t["managers"].items()):
        out += [f"[managers.{mid}]", f"executable = {s(m['executable'])}", f"kind = {s(m['kind'])}", f"administrator = {str(m['administrator']).lower()}"]
        for k in ("environment", "purl_type", "harness_use", "note"):
            if m[k]:
                out.append(f"{k} = {s(m[k])}")
        out.append("")
        for op in OPS:
            c = m["commands"].get(op)
            if not c:
                continue
            out += [f"[managers.{mid}.commands.{op}]", f"argv = {arr(c['argv'])}"]
            if "noninteractive" in c:
                out.append(f"noninteractive = {arr(c['noninteractive'])}")
            out.append(f"origin = {s(c['origin'])}")
            if c["verified"]:
                out.append(f"verified = {s(c['verified'])}")
            out.append("")
    for name, pl in sorted(t["platforms"].items()):
        out += [f"[platforms.{s(name)}]", f"label = {s(pl['label'])}", f"os = {s(pl['os'])}", f"processor = {s(pl['processor'])}", f"pin_suffix = {s(pl['suffix'])}", ""]
    for name, pn in sorted(t["pins"].items()):
        out += [f"[pins.{s(name)}]", f"key = {s(pn['key'])}", f"version = {s(pn['version'])}", f"label = {s(pn['label'])}"]
        out += [f"sha256.{s(pf)} = {s(h)}" for pf, h in sorted(pn["sha256"].items())]
        out.append("")
    for p in t["prohibitions"]:
        out += ["[[prohibitions]]", f"manager = {s(p['manager'])}", f"argv = {arr(p['argv'])}", f"reason = {s(p['reason'])}", ""]
    for name, p in sorted(t["programs"].items(), key=lambda kv: (kv[1]["order"], kv[0])):
        out += [f"[programs.{s(name)}]", f"tier = {s(p['tier'])}", f"order = {p['order']}"]
        out += [f"names.{fid} = {s(n)}" for fid, n in sorted(p["names"].items())]
        out.append("")
    return "\n".join(out).rstrip("\n") + "\n"


# ---- shell fragment --------------------------------------------------------------------------------------------------------------------------------

def q(x: str) -> str:
    return "'" + x.replace("'", "'\\''") + "'"


def shell(t: dict, digest: str) -> str:
    fams = t["families"]
    out = ["# >>> packaging.auto >>>",
           "# AUTO-GENERATED by commons/tools/generate-packaging.py from commons/ontology/supply-chain/packaging/*.ttl (commons 0002-packaging). Do not edit: change the ontology.",
           "# shellcheck disable=SC2034  # read by the script this is part of",
           f"pm_schema={SCHEMA_VERSION}", f"pm_source_sha256={q(digest)}", ""]

    def case(name: str, arg: str, rows: dict[str, str], default: str = "") -> None:
        out.append(f"{name}() {{  # {name} {arg}")
        out.append(f"  case ${{1:-}} in")
        for k, v in sorted(rows.items()):
            out.append(f"    {k}) printf '%s' {q(v)} ;;")
        out.append(f"    *) printf '%s' {q(default)} ;;")
        out.extend(["  esac", "}", ""])

    # family of the words an /etc/os-release gives (ID, then ID_LIKE): the first word that detects one
    out.append("pm_family_of() {  # pm_family_of WORDS: the family a computer's os-release ID and ID_LIKE words name, or nothing")
    out.append("  for pm_w in $1; do")
    out.append("    case $pm_w in")
    for fid, f in sorted(fams.items()):
        if f["detect_source"] == "os-release":
            out.append(f"      {'|'.join(sorted(f['detect']))}) printf '%s' {q(fid)}; return 0 ;;")
    out += ["    esac", "  done", "  return 0", "}", ""]
    out.append("pm_family_of_uname() {  # pm_family_of_uname NAME: the family `uname -s` names on a platform without os-release, or nothing")
    out.append("  case ${1:-} in")
    for fid, f in sorted(fams.items()):
        if f["uname"]:
            out.append(f"    {f['uname']}) printf '%s' {q(fid)} ;;")
    out += ["  esac", "}", ""]
    case("pm_label", "FAMILY", {fid: f["label"] for fid, f in fams.items()})
    case("pm_status", "FAMILY", {fid: f["status"] for fid, f in fams.items()})
    case("pm_assurance", "FAMILY", {fid: f["assurance"] for fid, f in fams.items()})
    case("pm_manager", "FAMILY", {fid: f["preferred"] or (f["managers"][0] if f["managers"] and f["installs_packages"] else "") for fid, f in fams.items()})
    case("pm_installs_packages", "FAMILY", {fid: "yes" if f["installs_packages"] else "no" for fid, f in fams.items() if f["status"] == "supported"})
    case("pm_removal_hint", "FAMILY", {fid: f["removal_hint"] for fid, f in fams.items() if f["removal_hint"]})
    case("pm_note", "FAMILY", {fid: f["note"] for fid, f in fams.items() if f["note"]})
    mgrs = t["managers"]

    def words_of(fid: str, op: str, key: str) -> str:
        f = fams[fid]
        m = mgrs.get(f["preferred"]) if f["preferred"] else None
        c = m["commands"].get(op) if m else None
        if not c:
            return ""
        a = c.get(key, c["argv"] if key == "argv" else [])
        return " ".join(w for w in a if not PLACEHOLDER.fullmatch(w))

    sup = {fid: f for fid, f in fams.items() if f["status"] == "supported" and f["installs_packages"]}
    case("pm_install_words", "FAMILY", {fid: words_of(fid, "install", "noninteractive") for fid in sup})
    case("pm_refresh_words", "FAMILY", {fid: words_of(fid, "refresh", "noninteractive") or words_of(fid, "refresh", "argv") for fid in sup})
    case("pm_query_installed_words", "FAMILY", {fid: words_of(fid, "query-installed", "argv") for fid in sup})
    case("pm_query_candidate_words", "FAMILY", {fid: words_of(fid, "query-candidate", "argv") for fid in sup})
    case("pm_environment", "FAMILY", {fid: mgrs[f["preferred"]]["environment"] for fid, f in sup.items() if mgrs[f["preferred"]]["environment"]})
    case("pm_admin_install", "FAMILY", {fid: f["admin_install"] or " ".join(mgrs[f["preferred"]]["commands"]["install"]["argv"]) for fid, f in fams.items()
                                         if f["admin_install"] or (f["preferred"] and "install" in mgrs.get(f["preferred"], {}).get("commands", {}))})
    # package names: pm_package FAMILY PROGRAM, and the programs of a tier
    out.append("pm_package() {  # pm_package FAMILY PROGRAM: what the family calls the package, or nothing")
    out.append("  case ${1:-}:${2:-} in")
    for name, p in sorted(t["programs"].items()):
        for fid, n in sorted(p["names"].items()):
            out.append(f"    {fid}:{name}) printf '%s' {q(n)} ;;")
    out += ["  esac", "}", ""]
    out.append("pm_programs() {  # pm_programs TIER: the programs of the tier (required or comfort), one word each, in order")
    out.append("  case ${1:-} in")
    for tier in ("required", "comfort"):
        out.append(f"    {tier}) printf '%s\\n' " + " ".join(q(n) for n, p in sorted(t["programs"].items(), key=lambda kv: (kv[1]["order"], kv[0])) if p["tier"] == tier) + " ;;")
    out += ["  esac", "}", "# <<< packaging.auto <<<", ""]
    return "\n".join(out)


def lit(x: str) -> str:   # a TOML literal string, so a pattern is written as it is
    return "'" + x + "'" if "'" not in x else s(x)


def rules_toml(t: dict, digest: str) -> str:
    out = ["# AUTO-GENERATED by commons/tools/generate-packaging.py from commons/ontology/supply-chain/packaging/rules.ttl (commons 0004-rules). Do not edit: change the ontology.",
           f"schema = {SCHEMA_VERSION}", f"source_sha256 = {s(digest)}", ""]
    for r in t["rules"]:
        out += ["[[rules]]", f"id = {s(r['id'])}", f"set = {s(r['set'])}", f"pattern = {lit(r['pattern'])}", f"label = {s(r['label'])}", f"reason = {s(r['reason'])}", ""]
    return "\n".join(out).rstrip("\n") + "\n"


def record_toml(t: dict, digest: str) -> str:
    out = ["# AUTO-GENERATED by commons/tools/generate-packaging.py from commons/ontology/supply-chain/packaging/record.ttl (commons 0002-packaging FR-016). Do not edit: change the ontology.",
           f"schema = {SCHEMA_VERSION}", f"source_sha256 = {s(digest)}", ""]
    for f in t["record"]:
        out += ["[[fields]]", f"name = {s(f['name'])}", f"type = {s(f['type'])}", f"definition = {s(f['definition'])}"]
        if f["values"]:
            out.append(f"values = {arr(f['values'])}")
        out.append("")
    return "\n".join(out).rstrip("\n") + "\n"


def pin_lines(t: dict, comments: bool) -> list[str]:
    out: list[str] = []
    for name, pn in t["pins"].items():
        if comments:
            out.append(f"# {pn['label']}" + (f": {pn['note']}" if pn["note"] else ""))
        out.append(f"{pn['key']}_VERSION={pn['version']}")
        for pf, h in sorted(pn["sha256"].items(), key=lambda kv: t["platforms"][kv[0]]["suffix"]):
            out.append(f"{pn['key']}_SHA256_{t['platforms'][pf]['suffix']}={h}")
        if comments:
            out.append("")
    return out


def pins_env(t: dict, digest: str) -> str:
    head = ["# AUTO-GENERATED by commons/tools/generate-packaging.py from commons/ontology/supply-chain/packaging/pins.ttl (commons 0002-packaging FR-014). Do not edit: change the ontology.",
            f"# source_sha256={digest}"]
    return "\n".join(head + pin_lines(t, False)) + "\n"


def pins_block(t: dict, digest: str) -> str:
    head = ["# >>> pins.auto >>>",
            "# AUTO-GENERATED by commons/tools/generate-packaging.py from commons/ontology/supply-chain/packaging/pins.ttl (commons 0002-packaging FR-014). Do not edit: change the ontology.",
            "# shellcheck disable=SC2034  # read by the script this is part of", ""]
    return "\n".join(head + pin_lines(t, True)) .rstrip("\n") + "\n# <<< pins.auto <<<\n"


def main(argv: list[str]) -> int:
    g, digest = load()
    t, bad = model(g)
    if bad:
        print("the packaging ontology breaks its own rules:", file=sys.stderr)
        for b in bad:
            print(f"  - {b}", file=sys.stderr)
        return 2
    fragment = shell(t, digest)
    want = {OUT_TOML: toml(t, digest), OUT_SH: fragment, OUT_PINS: pins_env(t, digest), OUT_RULES: rules_toml(t, digest), OUT_RECORD: record_toml(t, digest)}
    pblock = pins_block(t, digest)
    for script in SCRIPTS:
        if script.exists():   # a copy of commons alone (a test's) has no scripts beside it
            text = script.read_text()
            if not BLOCK.search(text):
                print(f"{script.relative_to(COMMONS.parent)} has no block between '# >>> packaging.auto >>>' and '# <<< packaging.auto <<<' to put the table in", file=sys.stderr)
                return 2
            if not PINS_BLOCK.search(text):
                print(f"{script.relative_to(COMMONS.parent)} has no block between '# >>> pins.auto >>>' and '# <<< pins.auto <<<' to put the pins in", file=sys.stderr)
                return 2
            want[script] = PINS_BLOCK.sub(lambda _m: pblock, BLOCK.sub(lambda _m: fragment, text, count=1), count=1)
    if "--check" in argv:
        stale = [p for p, text in want.items() if not p.exists() or p.read_text() != text]
        for p in stale:
            print(f"{p.relative_to(COMMONS.parent)} is not what the ontology makes; run: uv run commons/tools/generate-packaging.py", file=sys.stderr)
        return 1 if stale else 0
    OUT_TOML.parent.mkdir(parents=True, exist_ok=True)
    for p, text in want.items():
        p.write_text(text)
        print(f"wrote {p.relative_to(COMMONS.parent)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
