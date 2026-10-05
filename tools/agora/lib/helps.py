"""What `check help` reads (0042-agora FR-033; 0041-command-line FR-065): every help topic is well formed and names only commands,
topics and paths that exist. Standard library only.
"""
from __future__ import annotations

import re
import shlex
from pathlib import Path
from typing import Any

from agora.core.checks import Finding
from agora.core.registry import Registry
from agora.core.types import Choice

REQUIRED = ("start", "check", "specs", "design-systems", "brands", "toolchain", "editor", "ai", "extend", "recover")
NAME = re.compile(r"[a-z][a-z0-9-]*")
SUMMARY_MAX = 120
# A repository path in a topic: it must exist. Only paths under a top-level name of this repository are read as paths.
TOP = ("tools", "spec-kit", "design-systems", "ontology", "docs-src", "docs", "profile", "content")
PATH = re.compile(r"(?<![\w./-])((?:" + "|".join(TOP) + r")/[A-Za-z0-9_./*<>{}-]*)")
SPAN = re.compile(r"`((?:\./)?agora(?:\s[^`]*)?)`")
LINE = re.compile(r"^ {4}((?:\./)?agora\s.*)$")


def _commands_named(text: str) -> list[str]:
    """Every `agora ...` command line in a topic's text: an indented line, or a code span."""
    out = []
    for line in text.splitlines():
        m = LINE.match(line)
        if m:
            out.append(m.group(1))
    out += SPAN.findall(text)
    return out


def _words(line: str) -> list[str]:
    try:
        toks = shlex.split(line)
    except ValueError:
        toks = line.split()
    return toks[1:] if toks and toks[0] in ("agora", "./agora") else toks


def text_findings(reg: Registry, home: Path, where: str, text: str) -> list[Finding]:
    out: list[Finding] = []
    for line in _commands_named(text):
        toks = _words(line)
        lead = []
        for t in toks:
            if t.startswith("-"):
                break
            lead.append(t)
        if not lead:
            continue
        cmd, rest = reg.lookup(lead)
        if cmd is None:
            out.append(Finding("error", where, f"names `agora {' '.join(lead[:2])}`, which is not a command (0042 FR-033)"))
        elif cmd.id == "help" and rest and rest[0].islower() and rest[0] not in reg.topics:
            out.append(Finding("error", where, f"names the help topic {rest[0]!r}, which does not exist (0042 FR-033)"))
    for m in PATH.finditer(text):
        p = m.group(1).rstrip(".,;:)")
        if any(c in p for c in "*<>{}") or re.search(r"[A-Z]", p):
            continue
        if not (home / p).exists():
            out.append(Finding("error", where, f"names the path {p}, which does not exist (0042 FR-033)"))
    return out


def step_findings(reg: Registry, where: str, step: Any, ctx: Any) -> list[Finding]:
    cmd = reg.find(step.command)
    if cmd is None:
        return [Finding("error", where, f"step {step.label!r} runs {step.command!r}, which is not a command (0042 FR-033)")]
    out: list[Finding] = []
    known = {a.name: reg.types.get(a.type) for a in cmd.args} | {o.dest: (reg.types.get(o.type) if o.type else None) for o in cmd.options}
    flags = {o.dest for o in cmd.options if o.type is None}
    for key, value in step.fields.items():
        if key not in known:
            out.append(Finding("error", where, f"step {step.label!r} gives {key} to {cmd.id}, which takes {', '.join(sorted(known)) or 'no field'} (0042 FR-033)"))
            continue
        if key in flags:
            if value is not True:
                out.append(Finding("error", where, f"step {step.label!r}: {key} is a flag and takes true (0042 FR-033)"))
            continue
        t = known[key]
        for v in value if isinstance(value, (list, tuple)) else [value]:
            if t is not None and (isinstance(t, Choice) or t.name in ("SECTION", "SUITE")):
                try:
                    t.validate(ctx, str(v))
                except ValueError as e:
                    out.append(Finding("error", where, f"step {step.label!r}: {key}: {e} (0042 FR-033)"))
    return out


def findings(reg: Registry, home: Path, ctx: Any = None) -> list[Finding]:
    if ctx is None:
        from agora.core.ctx import Ctx

        ctx = Ctx(reg, home, home, env={})
    out: list[Finding] = []
    for key, t in reg.topics.items():
        if "#duplicate" in key:
            out.append(Finding("error", t.module, f"help topic {t.name!r} is declared twice (0042 FR-033)"))
    topics = {k: t for k, t in reg.topics.items() if "#duplicate" not in k}
    for need in REQUIRED:
        if need not in topics:
            out.append(Finding("error", "tools/agora/help", f"there is no help topic {need!r}, which 0042 FR-033 requires"))
    for name, t in sorted(topics.items()):
        where = f"tools/agora/help/{t.module.rsplit('.', 1)[-1]}.py: {name}"
        if not NAME.fullmatch(name):
            out.append(Finding("error", where, "a topic's name is lowercase letters, digits and hyphens (0042 FR-033)"))
        if not t.summary.strip() or "\n" in t.summary or len(t.summary) > SUMMARY_MAX or not t.summary.rstrip().endswith("."):
            out.append(Finding("error", where, f"the summary is one plain sentence ending in a full stop, at most {SUMMARY_MAX} characters (0042 FR-033)"))
        try:
            body = t.body()
        except Exception as e:  # noqa: BLE001 - a topic that raises is a finding, not a crash
            out.append(Finding("error", where, f"the topic could not be built: {type(e).__name__}: {e}"))
            continue
        if not body["plain"].strip():
            out.append(Finding("error", where, "has no plain first paragraph (0042 FR-033)"))
        if not body["sections"]:
            out.append(Finding("error", where, "has no sections (0042 FR-033)"))
        if not body["steps"]:
            out.append(Finding("error", where, "has no steps; each thing a person does is a step that is an action (0042 FR-033)"))
        text = body["plain"]
        for heading, section in body["sections"]:
            if not str(heading).strip() or not str(section).strip():
                out.append(Finding("error", where, "has a section with no heading or no text (0042 FR-033)"))
            text += "\n" + str(section)
        out += text_findings(reg, home, where, text)
        for step in body["steps"]:
            if not step.label.strip():
                out.append(Finding("error", where, "has a step with no label (0042 FR-033)"))
            out += step_findings(reg, where, step, ctx)
    return out
