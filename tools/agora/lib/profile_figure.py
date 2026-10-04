"""The organization profile's figure, drawn with frontiers-figures and themed by frontiers-brand (0014-design-systems
FR-048; 0042-agora FR-015).

`render` returns the three files of `profile/figures/`: how-we-work.src.svg (the semantic source), and how-we-work.svg
and how-we-work-dark.svg (themed, default and on-dark, with the sans embedded, since GitHub shows a README's figures as
images). The figure's words are here; its drawing and theming are the two design systems' own modules, imported from
where they stand (0042 FR-017). Needs Pillow (to measure) and fontTools (to embed), which agora's assurance group locks.
"""
from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

DIR = Path("profile") / "figures"
TITLE = "Every opportunity moves through four questions"
SUBTITLE = "An advantage counts only once it has changed a real decision."
STEPS = ["Find: what is unusually true here?", "Prove: what small hard thing earns a scarce commitment?",
         "Decide: what will we do now?", "Compound: how does use make the advantage stronger?"]
VARIANTS = (("how-we-work.svg", "default"), ("how-we-work-dark.svg", "on-dark"))
SOURCE = "how-we-work.src.svg"
HEADER = ("<!-- Written by agora's profile-figure generator from frontiers-figures and frontiers-brand; do not edit: "
          "run `agora figure generate`. -->\n")


class FigureProblem(Exception):
    """frontiers-figures' own check of the figure failed."""


def render(root: Path) -> dict[Path, str]:
    figures = root / "design-systems" / "frontiers-figures"
    brand = root / "design-systems" / "frontiers-brand"
    sys.path.insert(0, str(figures))
    try:
        import layouts  # noqa: PLC0415
        import svgkit  # noqa: PLC0415
        import theme  # noqa: PLC0415
    finally:
        sys.path.remove(str(figures))
    svgkit.use_brand(brand)
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / SOURCE
        layouts.loop_circular(str(src), TITLE, SUBTITLE, STEPS)
        p = subprocess.run([sys.executable, str(figures / "figcheck.py"), "--brand", str(brand), str(src)],
                           capture_output=True, text=True)
        if p.returncode != 0:
            raise FigureProblem((p.stdout + p.stderr).strip())
        text = src.read_text(encoding="utf-8")
    out = {root / DIR / SOURCE: HEADER + text}
    for name, variant in VARIANTS:
        out[root / DIR / name] = HEADER + theme.apply(text, brand, variant, embed_fonts=True)
    return out
