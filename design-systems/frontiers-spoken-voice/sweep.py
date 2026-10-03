#!/usr/bin/env python3
"""The mechanical sweep of frontiers-spoken-voice (spec FR-009): frontiers-written-voice's sweep, over a script's
spoken text, with the written voice's patterns and terms (this design system's copy in inherited/) and its own.

    python3 sweep.py FILE [...] [--patterns MORE.json ...] [--terms MORE.json ...] [--draft]

As a module: `patterns()` and `terms()` give the merged patterns and shared terms, and `sweep(text, fixed=())`
returns (fails, warns), with `fixed` the passages a show's format dictates (its identification, its tagline).
Needs frontiers-written-voice beside it, as a consumer vendors both. Standard library only.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
INHERITED = HERE / "inherited" / "frontiers-written-voice"
_spec = importlib.util.spec_from_file_location("written_voice_sweep", HERE.parent / "frontiers-written-voice" / "sweep.py")
written = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(written)


def patterns(extra: list[Path] = ()) -> dict:
    return written.load([INHERITED / "patterns.json", HERE / "patterns.json", *extra])


def terms(extra: list[Path] = ()) -> list[dict]:
    return written.load_terms([INHERITED / "terms.json", *extra])


def sweep(text: str, fixed: tuple[str, ...] = ()) -> tuple[list[str], list[str]]:
    return written.sweep(text, patterns(), fixed=fixed, terms=terms())


def main(argv: list[str]) -> int:
    extra = []
    args = list(argv)
    for flag in ("--patterns", "--terms"):
        while flag in args:
            i = args.index(flag)
            extra.append((flag, Path(args[i + 1])))
            del args[i:i + 2]
    base = ["--patterns", str(INHERITED / "patterns.json"), "--patterns", str(HERE / "patterns.json")]
    base += [x for flag, p in extra if flag == "--patterns" for x in (flag, str(p))]
    base += [x for flag, p in extra if flag == "--terms" for x in (flag, str(p))]
    return written.main(args + base)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
