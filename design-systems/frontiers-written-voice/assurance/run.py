#!/usr/bin/env python3
"""frontiers-written-voice's assurance harness (spec FR-019): the patterns and shared terms hold together, every
passage in fixtures/pass/ sweeps clean, and every passage in fixtures/fail/ is refused for the reason
fixtures/expected.json names. A fixture whose name starts with procedure- is swept in procedure mode.

    python3 assurance/run.py

Standard library only.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SYSTEM = HERE.parent
sys.path.insert(0, str(SYSTEM))
import sweep  # noqa: E402

ONTOLOGY = SYSTEM.parent.parent / "ontology" / "ifcore.ttl"
KEYS = {"fail_words", "warn_words", "plain_words", "hedges", "throat_clearing", "fail_announcements",
        "warn_announcements", "fail_contains", "fail_labels", "max_seesaws", "warn_not_fragments", "procedure"}


def main() -> int:
    passed, failed = 0, []

    def check(ok: bool, what: str) -> None:
        nonlocal passed
        if ok:
            passed += 1
        else:
            failed.append(what)

    raw = json.loads((SYSTEM / "patterns.json").read_text(encoding="utf-8"))
    unknown = set(k for k in raw if not k.startswith("$")) - KEYS
    check(not unknown, f"patterns.json has keys sweep.py does not read: {sorted(unknown)}")
    patterns = sweep.load([SYSTEM / "patterns.json"])
    for key, value in patterns.items():
        if isinstance(value, list):
            low = [v.lower() for v in value]
            check(len(low) == len(set(low)), f"patterns.json {key} lists a pattern twice")
            check(all(v == v.strip() and v for v in value), f"patterns.json {key} has an empty or padded pattern")

    terms = sweep.load_terms([SYSTEM / "terms.json"])
    ttl = ONTOLOGY.read_text(encoding="utf-8") if ONTOLOGY.exists() else ""
    for t in terms:
        local = t["iri"].split(":", 1)[1]
        block = re.search(rf"^ifcore:{local} a [\s\S]*?(?:\.\n|\Z)", ttl, re.M)
        check(bool(block), f"terms.json: {t['iri']} is not in ontology/ifcore.ttl (FR-016)")
        if block:
            labels = re.findall(r'(?:rdfs:label|skos:prefLabel|skos:altLabel) "([^"]+)"@en', block.group(0))
            check(t["term"] in labels, f"terms.json: {t['iri']} is labelled {labels}, not {t['term']!r} (FR-016)")
        check(all(v.strip() and v not in t["term"] for v in t["avoid"]),
              f"terms.json: an avoided variant of {t['term']!r} is empty or part of the term itself")

    for path in sorted((HERE / "fixtures" / "pass").iterdir()):
        mode = "procedure" if path.name.startswith("procedure-") else "prose"
        fails, _ = sweep.sweep(sweep.prose(path.read_text(encoding="utf-8"), path.suffix), patterns, mode=mode, terms=terms)
        check(not fails, f"pass/{path.name} should sweep clean; it reported: {'; '.join(fails)}")
    expected = json.loads((HERE / "fixtures" / "expected.json").read_text(encoding="utf-8"))
    fail_files = sorted((HERE / "fixtures" / "fail").iterdir())
    check({p.name for p in fail_files} == {k for k in expected if not k.startswith("$")},
          "fixtures/expected.json and fixtures/fail/ name different fixtures")
    for path in fail_files:
        mode = "procedure" if path.name.startswith("procedure-") else "prose"
        fails, _ = sweep.sweep(sweep.prose(path.read_text(encoding="utf-8"), path.suffix), patterns, mode=mode, terms=terms)
        want = expected.get(path.name, "")
        check(bool(want) and any(want in f for f in fails), f"fail/{path.name} should be refused for {want!r}; it reported: {'; '.join(fails) or 'nothing'}")

    if ttl:
        check(bool(re.search(r'dcterms:identifier "frontiers-written-voice"[\s\S]*?ifcore:WrittenVoiceDesignSystemKind', ttl)),
              "ifcore.ttl does not register frontiers-written-voice as a written-voice design system (FR-001)")

    print(f"{'ok  ' if not failed else 'FAIL'} frontiers-written-voice  ({passed} passed{', ' + str(len(failed)) + ' failed' if failed else ''})")
    for f in failed:
        print(f"     ✗ {f}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
