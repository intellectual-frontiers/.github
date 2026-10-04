"""What a spec is called, and the patterns of its parts (0020-spec-format FR-005, FR-009, FR-018).

The design system kind codes are the public root's (0014-design-systems FR-018), so the rules are built from the
public root's ontology even when another repository's specs are checked with `--root`.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

NUMBERED = r"\d{4}-[a-z][a-z0-9-]*"
SPEC_DIR = re.compile(rf"^{NUMBERED}$")
KIND_CODE = re.compile(
    r"^ifcore:\w+ a skos:Concept ; skos:inScheme ifcore:DesignSystemKindScheme\b[^\n]*\n\s*skos:notation \"([a-z][a-z0-9-]*)\"",
    re.M,
)
ID_LINE = re.compile(r"^\*\*Spec ID:\*\*\s*(\S+)\s*$", re.M)
STATUS_LINE = re.compile(r"^\*\*Status:\*\*\s*(.+?)\s*$", re.M)
INPUT_LINE = re.compile(r"^\*\*Input:\*\*\s*\S", re.M)
ITEM = re.compile(r"^- \*\*((?:FR|SC)-\d{3}|OQ-\d+)\*\*:", re.M)
HEADING = re.compile(r"^## (.+?)\s*$", re.M)
DATED = re.compile(r"\b20\d\d-\d\d-\d\d\b")
NARRATION = re.compile(
    r"\b(previously|used to|renamed from|formerly|changelog|as of (?:january|february|march|april|may|june|"
    r"july|august|september|october|november|december))\b",
    re.I,
)
ID_IN = re.compile(r"(FR|SC)-(\d{3})")
# 0020 FR-005: the closing sections, in order. "Out of scope" is optional.
CLOSING = ["Out of scope", "Edge cases", "Assumptions", "Open questions", "Key entities", "Success criteria",
           "Review & acceptance checklist"]
OPTIONAL = {"Out of scope"}
MECHANISMS = ("check", "gate", "review", "none")  # 0020 FR-012


@dataclass(frozen=True)
class Names:
    codes: tuple[str, ...]
    slug: str | None
    spec_name: str
    ds_dir: "re.Pattern[str] | None"
    status: "re.Pattern[str]"
    ref: "re.Pattern[str]"
    req: "re.Pattern[str]"


def kind_codes(root: Path) -> list[str]:
    """The design system kind codes declared in root's ifcore.ttl, longest first."""
    ttl = root / "ontology" / "ifcore.ttl"
    codes = KIND_CODE.findall(ttl.read_text(encoding="utf-8")) if ttl.is_file() else []
    return sorted(set(codes), key=len, reverse=True)


@lru_cache(maxsize=8)
def names(public: Path) -> Names:
    codes = tuple(kind_codes(public))
    slug = rf"[a-z][a-z0-9-]*-(?:{'|'.join(map(re.escape, codes))})" if codes else None
    spec_name = rf"(?:{NUMBERED}|{slug})" if slug else NUMBERED
    # A spec name, optionally "(`.github`)", then ids joined by ",", "and", "through", "–" or "-".
    ref = re.compile(
        rf"(?P<spec>{spec_name})\s*(?:\(`?\.?github`?\)\s*)?"
        r"(?P<ids>(?:FR|SC)-\d{3}(?:\s*(?:,|and|through|–|-|to)\s*(?:(?:FR|SC)-\d{3}|(?<![\d-])\d{3}(?![\d-])))*)"
    )
    return Names(codes, slug, spec_name, re.compile(rf"^{slug}$") if slug else None,
                 re.compile(rf"^(Draft|Adopted|Superseded by ({spec_name}))$"), ref,
                 re.compile(rf"^(?P<spec>{spec_name}) (?P<id>FR-\d{{3}})$"))


def expand(ids: str) -> list[str]:
    """'FR-001 through FR-004' or 'FR-014 – FR-016' -> each id it names."""
    out: list[str] = []
    prefix = "FR"
    tokens = re.findall(r"(?:(FR|SC)-)?(\d{3})|(through|–|-|to)", ids)
    pending_range = False
    for pre, num, sep in tokens:
        if sep:
            pending_range = True
            continue
        prefix = pre or prefix
        n = int(num)
        if pending_range and out:
            last = int(out[-1][3:])
            out.extend(f"{prefix}-{k:03d}" for k in range(last + 1, n + 1))
        else:
            out.append(f"{prefix}-{n:03d}")
        pending_range = False
    return out


def strip_code(text: str) -> str:
    return re.sub(r"```.*?```", "", text, flags=re.S)
