#!/usr/bin/env python3
"""frontiers-media's assurance harness (spec FR-013): formats.json holds together; under every brand here, every
tone's text roles meet 4.5:1, every job in fixtures/pass/ passes media.py check and renders (where the resvg-py
package is installed) to a PNG of its format's size, transparent where the format is; every job in fixtures/fail/ is
refused for the reason fixtures/expected.json names; and the ontology registers this design system.

    python3 assurance/run.py

Needs the Python package Pillow; rendering needs resvg-py (`pip install Pillow resvg-py`).
"""
from __future__ import annotations

import importlib.util
import json
import re
import struct
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SYSTEM = HERE.parent
sys.path.insert(0, str(SYSTEM))
import media  # noqa: E402

ONTOLOGY = SYSTEM.parent.parent / "ontology" / "ifcore.ttl"
TYPES = {"podcast-cover": "PodcastCoverArt", "episode-art": "EpisodeArt", "video-thumbnail": "VideoThumbnail",
         "title-card": "TitleCard", "lower-third": "LowerThird", "social-square": "SocialCard",
         "social-portrait": "SocialCard", "social-story": "SocialCard"}


class Result:
    def __init__(self) -> None:
        self.passed, self.failed = 0, []

    def check(self, ok: bool, what: str) -> None:
        if ok:
            self.passed += 1
        else:
            self.failed.append(what)


def png_info(path: Path) -> tuple[int, int, int]:
    head = path.read_bytes()[:26]
    w, h = struct.unpack(">II", head[16:24])
    return w, h, head[25]


def run_brand(brand: Path) -> Result:
    r = Result()
    tokens = media._tokens(brand)
    for tone, roles in media.TONES.items():
        bg = media.color(roles["background"], tokens)
        for role in ("text", "kicker", "byline"):
            ratio = media.contrast(media.color(roles[role], tokens), bg)
            r.check(ratio >= media.DATA["min_contrast"], f"{tone} tone: {role} is {ratio:.2f}:1 under {brand.name} (FR-006)")
    render = importlib.util.find_spec("resvg_py") is not None
    with tempfile.TemporaryDirectory() as tmp:
        for path in sorted((HERE / "fixtures" / "pass").glob("*.json")):
            job = json.loads(path.read_text(encoding="utf-8"))
            problems = media.check(job, brand)
            r.check(not problems, f"pass/{path.name} should meet every rule under {brand.name}: {'; '.join(problems)}")
            if render:
                out = Path(tmp) / f"{path.stem}.png"
                media.render(job, brand, out)
                w, h, kind = png_info(out)
                fmt = media.FORMATS[job["format"]]
                r.check([w, h] == fmt["size"], f"pass/{path.name} renders at {w}x{h}, not {fmt['size']} (FR-004)")
                if fmt.get("transparent"):
                    r.check(kind in (4, 6), f"pass/{path.name} renders without transparency (FR-004)")
    covered = {json.loads(p.read_text(encoding="utf-8"))["format"] for p in (HERE / "fixtures" / "pass").glob("*.json")}
    r.check(covered == set(media.FORMATS), f"fixtures/pass/ covers no job for {sorted(set(media.FORMATS) - covered)}")
    expected = json.loads((HERE / "fixtures" / "expected.json").read_text(encoding="utf-8"))
    fails = sorted((HERE / "fixtures" / "fail").glob("*.json"))
    r.check({p.name for p in fails} == {k for k in expected if not k.startswith("$")}, "fixtures/expected.json and fixtures/fail/ name different jobs")
    for path in fails:
        problems = media.check(json.loads(path.read_text(encoding="utf-8")), brand)
        want = expected.get(path.name, "")
        r.check(bool(want) and any(want in p for p in problems), f"fail/{path.name} should be refused for {want!r} under {brand.name}; it reported: {'; '.join(problems) or 'nothing'}")
    if not render:
        print("     · resvg-py is not installed; assets were checked, not rendered")
    return r


def check_data(r: Result) -> None:
    for slug, fmt in media.FORMATS.items():
        r.check(all(v > 0 for v in fmt["size"]), f"formats.json: {slug} has a size that is not positive")
        r.check(fmt["title_px"][0] >= media.DATA["min_text_px"] and fmt["title_px"][0] <= fmt["title_px"][1],
                f"formats.json: {slug}'s title range is below the minimum or inverted (FR-008)")
        for key in ("kicker_px", "byline_px"):
            if key in fmt:
                r.check(fmt[key] >= media.DATA["min_text_px"], f"formats.json: {slug}'s {key} is below {media.DATA['min_text_px']}px (FR-008)")
    hits = re.findall(r"#[0-9a-fA-F]{3,8}\b", (SYSTEM / "formats.json").read_text(encoding="utf-8"))
    r.check(not hits, f"formats.json holds color literals {hits} (0014-design-systems FR-044)")
    if ONTOLOGY.exists():
        ttl = ONTOLOGY.read_text(encoding="utf-8")
        block = re.search(r'^ifcore:\w+ a ifcore:DesignSystem ;[^.]*?dcterms:identifier "frontiers-media"[\s\S]*?\.\n', ttl, re.M)
        text = block.group(0) if block else ""
        r.check("ifcore:MediaDesignSystemKind" in text, "ifcore.ttl does not register frontiers-media as a media design system (FR-001)")
        for t in sorted(set(TYPES.values())):
            r.check(f"ifcore:{t}" in text, f"ifcore.ttl does not classify frontiers-media by ifcore:{t} (FR-001)")


def main() -> int:
    data = Result()
    check_data(data)
    failed = bool(data.failed)
    print(f"{'ok  ' if not data.failed else 'FAIL'} frontiers-media data  ({data.passed} passed{', ' + str(len(data.failed)) + ' failed' if data.failed else ''})")
    for f in data.failed:
        print(f"     ✗ {f}")
    for brand in sorted(p.parent for p in SYSTEM.parent.glob("*/brand.css")):
        r = run_brand(brand)
        print(f"{'ok  ' if not r.failed else 'FAIL'} frontiers-media, themed by {brand.name}  ({r.passed} passed{', ' + str(len(r.failed)) + ' failed' if r.failed else ''})")
        for f in r.failed:
            print(f"     ✗ {f}")
        failed |= bool(r.failed)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
