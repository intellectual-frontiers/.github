#!/usr/bin/env python3
"""frontiers-spoken-voice's assurance harness (spec FR-010): its copy of frontiers-written-voice's patterns and
terms agrees with the source (0014-design-systems FR-021), its own patterns add to them without removing any,
every script passage in fixtures/pass/ sweeps clean, every one in fixtures/fail/ is refused for the reason
fixtures/expected.json names, and the ontology records the derivation.

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
SOURCE = SYSTEM.parent / "frontiers-written-voice"
sys.path.insert(0, str(SYSTEM))
import sweep  # noqa: E402  (this design system's; it imports the written voice's engine)

ONTOLOGY = SYSTEM.parent.parent / "ontology" / "ifcore.ttl"


def main() -> int:
    passed, failed = 0, []

    def check(ok: bool, what: str) -> None:
        nonlocal passed
        if ok:
            passed += 1
        else:
            failed.append(what)

    for name in ("patterns.json", "terms.json"):
        copy, source = SYSTEM / "inherited" / "frontiers-written-voice" / name, SOURCE / name
        check(source.exists() and copy.read_bytes() == source.read_bytes(),
              f"inherited/frontiers-written-voice/{name} differs from design-systems/frontiers-written-voice/{name}; re-copy it (0014-design-systems FR-021)")
    own = json.loads((SYSTEM / "patterns.json").read_text(encoding="utf-8"))
    inherited = sweep.written.load([SYSTEM / "inherited" / "frontiers-written-voice" / "patterns.json"])
    merged = sweep.patterns()
    for key, value in inherited.items():
        if isinstance(value, list):
            check(all(v in merged[key] for v in value), f"the merged {key} drops an inherited pattern (spec FR-002)")
    for key in ("max_seesaws", "warn_not_fragments"):
        if key in own and key in inherited:
            check(own[key] <= inherited[key], f"patterns.json loosens the inherited {key} (spec FR-002)")

    for path in sorted((HERE / "fixtures" / "pass").iterdir()):
        fails, _ = sweep.sweep(path.read_text(encoding="utf-8"))
        check(not fails, f"pass/{path.name} should sweep clean; it reported: {'; '.join(fails)}")
    expected = json.loads((HERE / "fixtures" / "expected.json").read_text(encoding="utf-8"))
    fail_files = sorted((HERE / "fixtures" / "fail").iterdir())
    check({p.name for p in fail_files} == {k for k in expected if not k.startswith("$")},
          "fixtures/expected.json and fixtures/fail/ name different fixtures")
    for path in fail_files:
        fails, _ = sweep.sweep(path.read_text(encoding="utf-8"))
        want = expected.get(path.name, "")
        check(bool(want) and any(want in f for f in fails), f"fail/{path.name} should be refused for {want!r}; it reported: {'; '.join(fails) or 'nothing'}")

    if ONTOLOGY.exists():
        ttl = ONTOLOGY.read_text(encoding="utf-8")
        block = re.search(r'^ifcore:\w+ a ifcore:DesignSystem ;[^.]*?dcterms:identifier "frontiers-spoken-voice"[\s\S]*?\.\n', ttl, re.M)
        check(bool(block) and "ifcore:SpokenVoiceDesignSystemKind" in block.group(0),
              "ifcore.ttl does not register frontiers-spoken-voice as a spoken-voice design system (spec FR-001)")
        check(bool(block) and "prov:wasDerivedFrom ifcore:FrontiersWrittenVoice" in block.group(0),
              "ifcore.ttl does not record that frontiers-spoken-voice derives from frontiers-written-voice (spec FR-001)")

    print(f"{'ok  ' if not failed else 'FAIL'} frontiers-spoken-voice  ({passed} passed{', ' + str(len(failed)) + ' failed' if failed else ''})")
    for f in failed:
        print(f"     ✗ {f}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
