#!/usr/bin/env python3
"""The profile's figure, drawn with frontiers-figures and themed by frontiers-brand (0014-design-systems FR-048).

    python3 profile/figures/make.py

Writes how-we-work.src.svg (the semantic source), and how-we-work.svg and how-we-work-dark.svg (themed, default and
on-dark, with the sans embedded, since GitHub shows a README's figures as images). Edit this file, never the SVGs.
Needs Pillow (to measure) and fontTools (to embed).
"""
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
FIGURES = ROOT / "design-systems" / "frontiers-figures"
BRAND = ROOT / "design-systems" / "frontiers-brand"
sys.path.insert(0, str(FIGURES))
import layouts  # noqa: E402
import svgkit  # noqa: E402
import theme  # noqa: E402

svgkit.use_brand(BRAND)
src = HERE / "how-we-work.src.svg"
layouts.loop_circular(
    str(src), "Every opportunity moves through four questions", "An advantage counts only once it has changed a real decision.",
    ["Find: what is unusually true here?", "Prove: what small hard thing earns a scarce commitment?",
     "Decide: what will we do now?", "Compound: how does use make the advantage stronger?"])
problems = subprocess.run([sys.executable, str(FIGURES / "figcheck.py"), "--brand", str(BRAND), str(src)]).returncode
for name, variant in (("how-we-work.svg", "default"), ("how-we-work-dark.svg", "on-dark")):
    (HERE / name).write_text(theme.apply(src.read_text(encoding="utf-8"), BRAND, variant, embed_fonts=True), encoding="utf-8")
sys.exit(problems)
