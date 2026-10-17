#!/usr/bin/env python3
"""Find, in shell scripts, what only GNU tools have (commons 0004-rules): the `shell-portability` rules of commons/generated/rules.auto.toml.

    python3 commons/tools/shell-portability-check.py FILE...      print `file:line: uses X ...` for each, exit 1 if there is one

A comment line, and a trailing comment, may name what a script avoids and are not read. Standard library only; `scan(path, allow)` gives the findings as data, where `allow` is text
whose presence on a line excuses it (a line that picks the right tool for the computer it runs on).
"""
from __future__ import annotations

import re
import sys
import tomllib
from pathlib import Path

RULES = Path(__file__).resolve().parent.parent / "generated" / "rules.auto.toml"


def rules(path: Path = RULES) -> list[dict[str, str]]:
    return [r for r in tomllib.loads(path.read_text(encoding="utf-8"))["rules"] if r["set"] == "shell-portability"]


def scan(path: Path, allow: tuple[str, ...] = (), table: Path = RULES) -> list[str]:
    found: list[str] = []
    compiled = [(re.compile(r["pattern"]), r) for r in rules(table)]
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if line.lstrip().startswith("#") or any(a in line for a in allow):
            continue
        code = re.sub(r"\s#\s.*$", "", line)
        for rx, r in compiled:
            if rx.search(code):
                found.append(f"{path.name}:{n}: uses {r['label']}, which a Mac's tools lack ({r['reason']}): {line.strip()}")
    return found


def main(argv: list[str]) -> int:
    found = [f for a in argv for f in scan(Path(a))]
    for f in found:
        print(f, file=sys.stderr)
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
