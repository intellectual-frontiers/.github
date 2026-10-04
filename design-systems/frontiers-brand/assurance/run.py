#!/usr/bin/env python3
"""frontiers-brand's Open edX package check (spec FR-020): openedx/ is what `agora openedx generate` writes from
tokens.json, and, with Paragon's CLI (PARAGON=path/to/paragon), dist/ is what the build writes and every built
pair meets 4.5:1. Every other brand here is written to a scratch directory, so the writer works for any brand.

    python3 assurance/run.py

Runs on its own, without `agora`: it imports the package writer, agora/lib/openedx.py, from the tools/ directory of
the public root that holds this design system (found relative to this file). Standard library only; ImageMagick for a
brand without a favicon.ico. `agora check openedx` runs this file.
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
BRAND = HERE.parent
sys.path.insert(0, str(BRAND.parent.parent / "tools"))
from agora.lib import openedx  # noqa: E402


def main() -> int:
    paragon = Path(os.environ["PARAGON"]).resolve() if os.environ.get("PARAGON") else None
    failed = openedx.check(BRAND, BRAND / "openedx", f"{BRAND.name}-openedx", paragon)
    passed = 1
    for other in sorted(p.parent for p in BRAND.parent.glob("*/brand.css") if p.parent != BRAND):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "pkg"
            try:
                openedx.write(other, out, f"{other.name}-openedx")
            except Exception as e:  # noqa: BLE001 — any failure is the finding
                failed.append(f"{other.name}: the package writer fails: {e}")
                continue
            missing = [f for f in ("logo.svg", "logo-white.svg", "logo-trademark.svg", "favicon.ico",
                                   "paragon/tokens/themes/light/global/color.json") if not (out / f).is_file()]
            if missing:
                failed.append(f"{other.name}: the package lacks {', '.join(missing)}")
            else:
                passed += 1
    note = "" if paragon else "; dist/ not rebuilt (set PARAGON to Paragon's CLI)"
    print(f"{'ok  ' if not failed else 'FAIL'} frontiers-brand's Open edX package  ({passed} passed{', ' + str(len(failed)) + ' failed' if failed else ''}{note})")
    for f in failed:
        print(f"     ✗ {f}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
