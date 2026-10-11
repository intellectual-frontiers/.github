"""Runs the vocabulary scan (0019-controlled-vocabulary FR-007) on any computer that has Python, without `ws-host`, so the
weekly AI Audit can start from it in a fresh session: `python3 -I tools/vocabulary_scan.py --root .github=. --root NAME=PATH
[--json] [--status unmapped]`. The same scan is `agora check vocabulary`. It reads and prints; it writes nothing.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agora.lib import vocabulary  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--root", action="append", required=True, metavar="NAME=PATH", help="a repository whose ontology/ is scanned")
    ap.add_argument("--status", choices=["reused", "excepted", "unmapped"], help="list only terms of this status")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    roots = {n: Path(p).resolve() for n, _, p in (r.partition("=") for r in a.root)}
    terms = vocabulary.scan(roots)
    if a.json:
        print(json.dumps({"summary": vocabulary.summary(terms), "terms": vocabulary.rows(terms, a.status)}, indent=1))
    else:
        s = vocabulary.summary(terms)
        print(f"{s['terms']} terms: {s['reused']} reused, {s['excepted']} excepted, {s['unmapped']} unmapped")
        for r in vocabulary.rows(terms, a.status or "unmapped"):
            print(f"{r['status']:9} {r['kind']:8} {r['term']:46} {r['where']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
