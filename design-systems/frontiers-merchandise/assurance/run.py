#!/usr/bin/env python3
"""The assurance harness for frontiers-merchandise (0014-design-systems FR-015, FR-039, FR-045).

    python3 assurance/run.py                  every brand vendored beside this design system
    python3 assurance/run.py --brand SLUG     one brand

It checks this design system's own data, then, under each brand:

  - a brand without a decoration kit is reported as unable to theme goods, and not counted as a pass (FR-039);
  - every job in fixtures/pass/ meets every rule (decoration.py);
  - every job in fixtures/fail/ breaks the rule its "expect" names;
  - the kit's lockup and icon fit at least one imprint location of every product by some method it allows,
    or the gap is reported.

A fixture's `imagery:@first` names the first piece of the brand's imagery pool, so fixtures name no brand's artwork.
Standard library only. Exits non-zero on any failure. This file is the harness and its documentation.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SYSTEM = HERE.parent
sys.path.insert(0, str(SYSTEM))
import decoration  # noqa: E402  (this design system's own rules, in code)

ONTOLOGY = SYSTEM.parent.parent / "ontology" / "ifcore.ttl"


class Result:
    def __init__(self) -> None:
        self.passed, self.failed, self.notes = 0, [], []

    def check(self, ok: bool, what: str) -> None:
        if ok:
            self.passed += 1
        else:
            self.failed.append(what)


def check_data(r: Result) -> None:
    methods, products = decoration.METHODS, decoration.PRODUCTS
    for slug, p in products["products"].items():
        r.check(p["category"] in products["categories"], f"products.json: {slug}'s category {p['category']} is not a listed category")
        for m in p["methods"]:
            r.check(m in methods, f"products.json: {slug} allows unknown method {m}")
        for loc, size in p["locations"].items():
            r.check(len(size) == 2 and all(v > 0 for v in size), f"products.json: {slug} {loc} is not [width, height] in inches")
    for path in (SYSTEM / "data").glob("*.json"):
        hits = re.findall(r"#[0-9a-fA-F]{6}\b", path.read_text(encoding="utf-8"))
        r.check(not hits, f"data/{path.name} holds the color literal {', '.join(hits)} (0014-design-systems FR-044)")
    if ONTOLOGY.exists():
        ttl = ONTOLOGY.read_text(encoding="utf-8")
        block = re.search(r'ifcore:\w+ a ifcore:DesignSystem ;[^.]*?dcterms:identifier "frontiers-merchandise"[\s\S]*?\.\n', ttl)
        r.check(bool(block), "ifcore.ttl does not register frontiers-merchandise (FR-001)")
        if block:
            named = set(re.findall(r"ifcore:(\w+)", re.search(r"dcterms:type ([^;]+);", block.group(0)).group(1)))
            labels = {m.group(2): m.group(1) for m in re.finditer(r'ifcore:(\w+) a skos:Concept ;[^\n]*skos:prefLabel "([^"]+)"@en', ttl)}
            for name in [m["name"] for m in methods.values()] + [c.replace("-", " ") for c in products["categories"]]:
                r.check(labels.get(name) in named, f"ifcore.ttl does not classify frontiers-merchandise by {name!r}, which its data governs (FR-001)")


def resolve(job: dict, brand: decoration.Brand) -> dict:
    if job.get("artwork") == "imagery:@first" and brand.pieces:
        job = {**job, "artwork": "imagery:" + next(iter(brand.pieces))}
    return job


def run(brand_dir: Path) -> Result:
    r = Result()
    brand = decoration.Brand(brand_dir)
    if brand.kit is None:
        r.notes.append(f"{brand_dir.name} has no decoration kit: it cannot theme frontiers-merchandise (0014-design-systems FR-047)")
        return r
    for path in sorted((HERE / "fixtures" / "pass").glob("*.json")):
        problems = decoration.check(resolve(json.loads(path.read_text(encoding="utf-8")), brand), brand)
        r.check(not problems, f"pass/{path.name} should meet every rule under {brand_dir.name}: " + "; ".join(problems))
    for path in sorted((HERE / "fixtures" / "fail").glob("*.json")):
        case = json.loads(path.read_text(encoding="utf-8"))
        problems = decoration.check(resolve(case["job"], brand), brand)
        r.check(any(case["expect"] in p for p in problems),
                f"fail/{path.name} should break the rule about {case['expect']!r} under {brand_dir.name}; it reported: {'; '.join(problems) or 'nothing'}")
    for slug, product in decoration.PRODUCTS["products"].items():
        fits = []
        for art in ("lockup", "icon"):
            aspect = brand.aspect(art)
            for m in product["methods"]:
                method = decoration.METHODS[m]
                floor = max(float(brand.logo[art].get("min-width-in", 0)), method["min_line_in"] / float(brand.kit[art]["finest-detail"]))
                for loc, (w, h) in product["locations"].items():
                    if floor <= min(w, h / aspect):
                        fits.append(f"{art} by {method['name']} on the {loc}")
        if not fits:
            r.notes.append(f"{brand_dir.name}'s kit fits no imprint location of a {product['name'].lower()} by any method allowed on it")
    return r


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--brand", help="the slug of a brand vendored beside this design system")
    args = ap.parse_args()
    root = SYSTEM.parent
    brands = [root / args.brand] if args.brand else sorted(p.parent for p in root.glob("*/brand.css"))
    data = Result()
    check_data(data)
    failed = bool(data.failed)
    print(f"{'ok  ' if not data.failed else 'FAIL'} frontiers-merchandise data  ({data.passed} passed{', ' + str(len(data.failed)) + ' failed' if data.failed else ''})")
    for f in data.failed:
        print(f"     ✗ {f}")
    for b in brands:
        r = run(b)
        if r.passed == 0 and not r.failed:
            print(f"skip frontiers-merchandise, themed by {b.name}")
        else:
            status = "ok  " if not r.failed else "FAIL"
            print(f"{status} frontiers-merchandise, themed by {b.name}  ({r.passed} passed{', ' + str(len(r.failed)) + ' failed' if r.failed else ''})")
        for f in r.failed:
            print(f"     ✗ {f}")
        for n in r.notes:
            print(f"     · {n}")
        failed |= bool(r.failed)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
