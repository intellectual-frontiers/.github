#!/usr/bin/env python3
"""Check a decoration job against frontiers-merchandise's rules, themed by a brand (spec FR-006 to FR-009).

    python3 decoration.py JOB.json --brand DIR    the problems with one job, or none; exits non-zero on any

A job is what a consumer sends a decorator, as JSON:

    {"product": "polo", "location": "left-chest", "method": "embroidery",
     "artwork": "icon", "ink": "text", "substrate": "#ffffff", "width_in": 2.4}

`artwork` is a piece of the brand's decoration kit (0014-design-systems FR-047): its `lockup`, its `icon`, or its
`wordmark` where the kit has one; or `imagery:<id>`, a piece of its imagery pool (FR-043). `ink` is a color role in the kit's `inks`, and is left out for a method that
uses none. `substrate` is the color of the goods. `"order": true` marks a job going to a decorator, which may use
only an ink whose matches are verified; a proof may use any. Standard library only.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
METHODS = json.loads((HERE / "data" / "methods.json").read_text(encoding="utf-8"))["methods"]
PRODUCTS = json.loads((HERE / "data" / "products.json").read_text(encoding="utf-8"))
MIN_CONTRAST = 3.0  # WCAG 2.2 1.4.11, non-text contrast: the mark against the goods
KIT_ARTWORK = ("lockup", "icon", "wordmark")  # the lockup and icon every kit has; a wordmark it may add


class Brand:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.tokens = json.loads((path / "tokens.json").read_text(encoding="utf-8"))
        self.kit = self.tokens.get("$extensions", {}).get("com.intellectualfrontiers.decoration")
        self.logo = self.tokens["$extensions"]["com.intellectualfrontiers.logo"]
        pool = path / "imagery" / "catalog.json"
        self.pieces = {p["id"]: p for p in json.loads(pool.read_text(encoding="utf-8"))["pieces"]} if pool.exists() else {}

    def role(self, name: str) -> str | None:
        value = self.tokens.get("role", {}).get(name, {}).get("$value")
        while isinstance(value, str) and value.startswith("{"):
            group, key = value[1:-1].split(".", 1)
            value = self.tokens[group][key]["$value"]
        return value

    def aspect(self, artwork: str) -> float:
        """Height over width of the kit's vector artwork, from its viewBox."""
        svg = (self.path / self.kit[artwork]["file"]).read_text(encoding="utf-8")
        _, _, w, h = (float(v) for v in re.search(r'viewBox="([^"]+)"', svg).group(1).split())
        return h / w

    def artwork(self) -> list[str]:
        """The kit's artwork: the lockup, the icon, and the wordmark if it has one."""
        return [a for a in KIT_ARTWORK if a in (self.kit or {})]

    def min_width(self, artwork: str) -> float:
        """The brand's smallest width for a kit artwork: its own, else its logo's (frontiers-brand FR-008)."""
        own = self.kit[artwork].get("min-width-in")
        return float(own if own is not None else self.logo.get(artwork, {}).get("min-width-in", 0))


def luminance(hex_color: str) -> float:
    c = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    c = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def contrast(a: str, b: str) -> float:
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def check(job: dict, brand: Brand) -> list[str]:
    """Every rule the job breaks, as a sentence naming its requirement; empty when it meets them all."""
    if brand.kit is None:
        return [f"{brand.path.name} has no decoration kit, so it cannot theme goods (0014-design-systems FR-047)"]
    problems = []
    product = PRODUCTS["products"].get(job.get("product"))
    method = METHODS.get(job.get("method"))
    if product is None:
        return [f"unknown product {job.get('product')!r} (FR-005)"]
    if method is None:
        return [f"unknown decoration method {job.get('method')!r} (FR-004)"]
    if job["method"] not in product["methods"]:
        problems.append(f"{method['name']} is not allowed on a {product['name'].lower()}: use {', '.join(METHODS[m]['name'] for m in product['methods'])} (FR-005)")
    location = product["locations"].get(job.get("location"))
    if location is None:
        return problems + [f"a {product['name'].lower()} has no imprint location {job.get('location')!r}: {', '.join(product['locations'])} (FR-005)"]

    artwork, width = job.get("artwork", ""), float(job.get("width_in", 0))
    if artwork.startswith("imagery:"):
        piece = brand.pieces.get(artwork.split(":", 1)[1])
        if piece is None:
            return problems + [f"{artwork} is not in {brand.path.name}'s imagery pool (FR-006)"]
        if not method["imagery"]:
            problems.append(f"a piece of the imagery pool needs full color; {method['name']} cannot reproduce it (FR-006)")
        if job.get("ink"):
            problems.append("a piece of the imagery pool is printed in its own colors, never in an ink (FR-008)")
        w, h = piece["pixel_size"]
        aspect, floor, what = h / w, 0.0, "the piece"
    elif artwork in KIT_ARTWORK and artwork not in brand.artwork():
        return problems + [f"{brand.path.name}'s decoration kit has no {artwork} (FR-006)"]
    elif artwork in KIT_ARTWORK:
        aspect = brand.aspect(artwork)
        brand_min = brand.min_width(artwork)
        method_min = method["min_line_in"] / float(brand.kit[artwork]["finest-detail"])
        floor, what = max(brand_min, method_min), f"the {artwork}"
        if width < brand_min:
            problems.append(f"{what} at {width:g} in is below the brand's {brand_min:g} in minimum (frontiers-brand FR-008; FR-007)")
        elif width < method_min:
            problems.append(f"{what} at {width:g} in has detail finer than {method['name']} holds ({method['min_line_in']:g} in); it needs at least {method_min:.2f} in (FR-007)")
    else:
        return problems + [f"artwork {artwork!r} is not the lockup, the icon, the wordmark or imagery:<id> (FR-006)"]

    max_w, max_h = location
    if width > max_w + 1e-9:
        problems.append(f"{what} at {width:g} in is wider than the {job['location']} imprint's {max_w:g} in (FR-007)")
    if width * aspect > max_h + 1e-9:
        problems.append(f"{what} at {width:g} in is {width * aspect:.2f} in tall, taller than the {job['location']} imprint's {max_h:g} in (FR-007)")
    if floor and floor > max_w + 1e-9:
        problems.append(f"{what} cannot fit the {job['location']} imprint by {method['name']} at any size (FR-007)")

    if artwork.startswith("imagery:"):
        return problems
    ink = job.get("ink")
    if method["ink"] == "none":
        if ink:
            problems.append(f"{method['name']} uses no ink; leave ink out (FR-008)")
        return problems
    if not ink:
        return problems + [f"{method['name']} needs an ink, one of {', '.join(brand.kit['inks'])} (FR-008)"]
    match = brand.kit["inks"].get(ink)
    if match is None:
        return problems + [f"{ink!r} is not an ink {brand.path.name} allows on goods: {', '.join(brand.kit['inks'])} (FR-008)"]
    if job.get("order") and match.get("verified") is False:
        problems.append(f"{ink}'s matches are not verified against the physical guide and card; a proof may use it, an order may not (FR-008, frontiers-brand FR-017)")
    if method["ink"] == "thread" and not match.get("thread"):
        problems.append(f"{ink} has no thread match for embroidery (FR-008)")
    if method["ink"] == "spot" and not match.get("spot"):
        problems.append(f"{ink} has no spot-color match for {method['name']} (FR-008)")
    substrate = job.get("substrate", "")
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", substrate):
        return problems + [f"substrate {substrate!r} is not a #rrggbb color (FR-009)"]
    ratio = contrast(brand.role(ink), substrate)
    if ratio < MIN_CONTRAST:
        problems.append(f"{ink} ({brand.role(ink)}) on a {substrate} substrate is {ratio:.2f}:1, below {MIN_CONTRAST:g}:1 (FR-009)")
    return problems


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("job", type=Path)
    ap.add_argument("--brand", type=Path, required=True, help="the brand's directory")
    args = ap.parse_args()
    problems = check(json.loads(args.job.read_text(encoding="utf-8")), Brand(args.brand))
    for p in problems:
        print(f"✗ {p}")
    if not problems:
        print(f"✓ {args.job.name} meets frontiers-merchandise under {args.brand.name}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
