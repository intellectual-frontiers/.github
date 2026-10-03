#!/usr/bin/env python3
"""frontiers-slides' Python harness (spec FR-015): deck.py builds the committed fixture deck exactly, the fixture
deck passes deck.py check, every deck in fixtures/fail/ is refused for the reason fixtures/expected.json names,
and the ontology registers this design system. The browser harness (run.mjs) checks how the deck renders.

    python3 assurance/run.py

Standard library only; uses frontiers-figures' theme and the house voice when they are beside it.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SYSTEM = HERE.parent
sys.path.insert(0, str(SYSTEM))
import deck  # noqa: E402

ONTOLOGY = SYSTEM.parent.parent / "ontology" / "ifcore.ttl"


def main() -> int:
    passed, failed = 0, []

    def check(ok: bool, what: str) -> None:
        nonlocal passed
        if ok:
            passed += 1
        else:
            failed.append(what)

    source = HERE / "fixtures" / "pass" / "deck.md"
    committed = HERE / "fixtures" / "pass" / "deck.html"
    fresh = deck.build(source, committed.with_name("deck.check.html"), "frontiers-brand", False)
    committed.with_name("deck.check.html").unlink()
    check(committed.exists() and fresh == committed.read_text(encoding="utf-8"),
          "fixtures/pass/deck.html is not what deck.py build writes; rebuild it with "
          "python3 deck.py build assurance/fixtures/pass/deck.md -o assurance/fixtures/pass/deck.html (FR-015)")
    problems = deck.check(source, "frontiers-brand")
    check(not problems, f"pass/deck.md should pass deck.py check; it reported: {'; '.join(problems)}")

    expected = json.loads((HERE / "fixtures" / "expected.json").read_text(encoding="utf-8"))
    fails = sorted((HERE / "fixtures" / "fail").glob("*.md"))
    check({p.name for p in fails} == {k for k in expected if not k.startswith("$")},
          "fixtures/expected.json and the decks in fixtures/fail/ name different fixtures")
    for path in fails:
        problems = deck.check(path, "frontiers-brand")
        want = expected.get(path.name, "")
        check(bool(want) and any(want in p for p in problems), f"fail/{path.name} should be refused for {want!r}; it reported: {'; '.join(problems) or 'nothing'}")

    limits = json.loads((SYSTEM / "limits.json").read_text(encoding="utf-8"))
    check(limits["max_points"] == 5 and limits["point_words"] == 14 and limits["body_words"]["default"] == 45,
          "limits.json disagrees with spec FR-011")

    if ONTOLOGY.exists():
        ttl = ONTOLOGY.read_text(encoding="utf-8")
        block = re.search(r'^ifcore:\w+ a ifcore:DesignSystem ;[^.]*?dcterms:identifier "frontiers-slides"[\s\S]*?\.\n', ttl, re.M)
        text = block.group(0) if block else ""
        check("ifcore:SlidesDesignSystemKind" in text, "ifcore.ttl does not register frontiers-slides as a slides design system (FR-001)")
        for t in ("TalkDeck", "LectureDeck", "WorkshopDeck", "BriefingDeck"):
            check(f"ifcore:{t}" in text, f"ifcore.ttl does not classify frontiers-slides by ifcore:{t} (FR-001)")
        check("ifcore:drawsFiguresWith ifcore:FrontiersFigures" in text, "frontiers-slides does not name frontiers-figures (FR-001)")

    print(f"{'ok  ' if not failed else 'FAIL'} frontiers-slides  ({passed} passed{', ' + str(len(failed)) + ' failed' if failed else ''})")
    for f in failed:
        print(f"     ✗ {f}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
