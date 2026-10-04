"""The layout group: the print design system's layout documentation as a generator (0042-agora FR-015, FR-017).

The rules live in the design system's own `latex/layout.py`, which stays in `design-systems/frontiers-print/`
(0014-design-systems FR-005): the generator calls its `sync` through importlib, on a scratch copy of each Markdown file,
and compares the result with the file. Standard library only.
"""
from __future__ import annotations

import importlib.util
import shutil
import tempfile
import warnings
from pathlib import Path

from agora.core import Ctx
from agora.core.generate import Generated
from agora.core.registry import generator
from agora.lib import assurance

MARKERS = ("<!-- layouts:begin", "<!-- typefaces:begin")


def _load(script: Path):
    """The design system's layout.py as a module, loaded from where it stands."""
    spec = importlib.util.spec_from_file_location(f"_{script.parent.parent.name.replace('-', '_')}_layout", script)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", ResourceWarning)  # the design system's own script leaves its JSON files to be closed at exit
        spec.loader.exec_module(mod)
    return mod


@generator("print-layout-docs")
def gen_print_layout_docs(ctx: Ctx, scope: str | None) -> Generated:
    gd = Generated()
    for slug in assurance.design_systems(ctx.root):
        ds = ctx.root / "design-systems" / slug
        script = ds / "latex" / "layout.py"
        if not script.is_file() or (scope and scope != slug):
            continue
        mod = _load(script)
        docs = [p for p in sorted(ds.rglob("*.md")) if any(m in p.read_text(encoding="utf-8") for m in MARKERS)]
        with tempfile.TemporaryDirectory() as tmp:
            for n, doc in enumerate(docs):
                scratch = Path(tmp) / f"{n}.md"
                shutil.copy(doc, scratch)
                mod.sync(str(scratch), check=False)
                gd.files[doc] = scratch.read_text(encoding="utf-8")
                gd.literal[doc] = f"python3 {script.relative_to(ctx.root)} sync {doc.relative_to(ctx.root)}"
    return gd
