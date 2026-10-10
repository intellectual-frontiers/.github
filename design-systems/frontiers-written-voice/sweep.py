#!/usr/bin/env python3
"""The mechanical sweep of frontiers-written-voice (spec FR-017): the patterns in patterns.json, run over prose.

    python3 sweep.py FILE [...] [--patterns PATTERNS.json ...] [--terms TERMS.json ...] [--mode prose|procedure] [--draft]

Prints every finding as `FAIL` or `WARN` with the file and the passage, and exits non-zero on any FAIL (on none
with --draft, which reports every FAIL as a WARN). AsciiDoc (.adoc), Markdown (.md) and HTML (.html) are read as their
prose: comments, attribute lines, front matter, code and listing blocks, scripts, styles and tags are never swept. The
headings of a file (its title included) are swept again as headings (FR-009): one that starts by announcing a topic or an
activity, or is a bare label, is a FAIL (`fail_headline_starts`, `fail_headline_labels`); one that only names a topic is
a WARN (`warn_headline_starts`). A URL (http://, https://) or a
mailto: address is never swept, in any text; the link text after it (an AsciiDoc `[...]`) is (FR-020). --patterns may be given more
than once; later files add to earlier ones (a spoken-voice design system adds its own to these, FR-018). --terms
adds shared-term files to this design system's terms.json (FR-016).

As a module: `sweep(text, patterns, fixed=(), mode="prose", terms=())` returns (fails, warns) for plain text,
`sweep_headings(headings, patterns)` the same for a list of headings, `prose(text, suffix)` and `headings(text, suffix)`
read a file's prose and headings, `load(paths)` merges pattern files and `load_terms(paths)` reads shared-term files.
Standard library only.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
NEGATION = re.compile(r"\b(?:is|are|was|were) not\b|\bisn't\b|\baren't\b|\bwasn't\b|\bweren't\b|'s not\b|'re not\b", re.I)
PRONOUN_START = re.compile(r"^(?:it|that|this|they|he|she|these|those)(?:'s|'re| is| are)\b", re.I)
PASSIVE = re.compile(r"\b(?:should|must|is to|are to|needs to|need to) be \w+ed\b", re.I)
STEP = re.compile(r"^\s*(?:\.+|\d+\.)\s+(.*)$")
# An address up to whitespace, a bracket or an angle bracket, never ending on the sentence's own punctuation; an
# AsciiDoc macro's [link text] after it stays in the text.
URL = re.compile(r"(?:https?://|mailto:)[^\s\[\]<>]*[^\s\[\]<>.,;:!?)'\"]", re.I)


def load(paths: list[Path]) -> dict:
    """The pattern files merged in order: lists are joined, maps updated, numbers replaced by the later file."""
    merged: dict = {}
    for path in paths:
        for key, value in json.loads(Path(path).read_text(encoding="utf-8")).items():
            if key.startswith("$"):
                continue
            if isinstance(value, list):
                merged[key] = merged.get(key, []) + [v for v in value if v not in merged.get(key, [])]
            elif isinstance(value, dict):
                merged[key] = {**merged.get(key, {}), **value}
            else:
                merged[key] = value
    return merged


def load_terms(paths: list[Path]) -> list[dict]:
    """The shared terms of every file given, in order."""
    return [t for path in paths for t in json.loads(Path(path).read_text(encoding="utf-8"))["terms"]]


def plain_quotes(text: str) -> str:
    return str(text).replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')


# A cited title (<cite>) is another author's words and is never swept (FR-020).
HTML_DROP = re.compile(r"(?is)<(script|style|template|svg|cite)\b.*?</\1\s*>|<!--.*?-->|<head\b.*?</head\s*>")
HTML_BLOCK = re.compile(r"(?i)</?(?:p|div|section|article|main|header|footer|nav|aside|h[1-6]|li|ul|ol|dl|dt|dd|tr|td|th|table|"
                        r"thead|tbody|blockquote|figure|figcaption|pre|br|hr|details|summary)\b[^>]*>")
HTML_TAG = re.compile(r"<[^>]+>")
HTML_HEADING = re.compile(r"(?is)<h[1-6]\b[^>]*>(.*?)</h[1-6]\s*>")
HTML_TITLE = re.compile(r"(?is)<title\b[^>]*>(.*?)</title\s*>")
HTML_META_DESCRIPTION = re.compile(r"""(?is)<meta\s+name=["']description["']\s+content=["']([^"']*)["']""")


def html_text(fragment: str) -> str:
    """The text of an HTML fragment, its tags gone and its entities read."""
    import html as _html
    return re.sub(r"[ \t]+", " ", _html.unescape(HTML_TAG.sub(" ", fragment))).strip()


def headings(text: str, suffix: str) -> list[str]:
    """The headings of a file, as a reader reads them: the title and every h1 to h6 of HTML, every `=` line of AsciiDoc (its
    document title included), every `#` line of Markdown. Code and listing blocks are never read."""
    if suffix == ".html":
        return [html_text(m) for m in HTML_TITLE.findall(text)] + [html_text(m) for m in HTML_HEADING.findall(text)]
    out, block = [], None
    for line in text.splitlines():
        s = line.strip()
        if suffix == ".adoc":
            if block:
                if s == block:
                    block = None
                continue
            if s in ("////", "----", "....", "++++", "```"):
                block = s
                continue
            if m := re.match(r"^=+\s+(.*)$", s):
                out.append(m.group(1).strip())
        elif suffix == ".md":
            if block:
                if s.startswith(block):
                    block = None
                continue
            if s.startswith("```") or s.startswith("~~~"):
                block = s[:3]
                continue
            if m := re.match(r"^#+\s+(.*?)\s*#*$", s):
                out.append(m.group(1).strip())
    return out


def prose(text: str, suffix: str) -> str:
    """The prose of an AsciiDoc, Markdown or HTML file: what a reader reads, without markup that is never read as text."""
    if suffix == ".html":
        import html as _html
        # the description a search result or a card shows is read as prose too
        meta = HTML_META_DESCRIPTION.search(text)
        body = HTML_DROP.sub(" ", text)
        body = HTML_BLOCK.sub("\n", body)
        lines = [_html.unescape(meta.group(1)).strip()] if meta else []
        return "\n".join(lines + [l for l in (html_text(x) for x in body.splitlines()) if l])
    out, block = [], None
    lines = text.splitlines()
    if suffix == ".md" and lines and lines[0].strip() == "---":
        end = next((i for i, l in enumerate(lines[1:], 1) if l.strip() == "---"), 0)
        lines = lines[end + 1:]
    for line in lines:
        s = line.strip()
        if suffix == ".adoc":
            if block:
                if s == block:
                    block = None
                continue
            if s in ("////", "----", "....", "++++", "```"):
                block = s
                continue
            if s.startswith("//") or re.match(r"^:[\w-]+:", s) or re.match(r"^\[.*\]$", s) or s in ("****", "====", "|==="):
                continue
            out.append(re.sub(r"^=+\s+", "", line))
        elif suffix == ".md":
            if block:
                if s.startswith(block):
                    block = None
                continue
            if s.startswith("```") or s.startswith("~~~"):
                block = s[:3]
                continue
            if s.startswith("<!--"):
                continue
            out.append(re.sub(r"^#+\s+", "", line))
        else:
            out.append(line)
    return "\n".join(out)


def sweep(text: str, patterns: dict, fixed: tuple[str, ...] = (), mode: str = "prose",
          terms: list[dict] | tuple = ()) -> tuple[list[str], list[str]]:
    """Every pattern the text breaks, as (fails, warns). `fixed` are passages a format dictates (a show's tagline);
    they are removed first, then every URL and mailto: address, which a reader does not read as prose (FR-020)."""
    t = plain_quotes(text)
    for f in fixed:
        t = t.replace(plain_quotes(f), " ")
    t = URL.sub(" ", t)
    low = t.lower()
    fails: list[str] = []
    warns: list[str] = []

    def find(term: str):
        return re.search(r"(?<![a-z])" + re.escape(plain_quotes(term).lower()) + r"(?![a-z])", low)

    def context(m) -> str:
        return t[max(0, m.start() - 35):m.end() + 35].replace("\n", " ").strip()

    if "—" in t or " -- " in t:
        fails.append("an em dash; rewrite with a comma, a colon, parentheses or a new sentence")
    for w in patterns.get("fail_words", []):
        if m := find(w):
            fails.append(f"banned word {w!r}: ...{context(m)}...")
    for w in patterns.get("warn_words", []):
        if m := find(w):
            warns.append(f"check the word {w!r}; keep it only in its literal sense: ...{context(m)}...")
    for w, plain in patterns.get("plain_words", {}).items():
        if m := find(w):
            warns.append(f"{w!r} where a person would say {plain!r}: ...{context(m)}...")
    for w in patterns.get("idioms", []):
        if m := find(w):
            warns.append(f"idiom {w!r}: say the literal meaning in plain words (FR-021): ...{context(m)}...")
    for kind in ("hedges", "throat_clearing"):
        for ph in patterns.get(kind, []):
            if m := find(ph):
                label = "hedge" if kind == "hedges" else "throat-clearing"
                (fails if " " in ph else warns).append(f"{label} {ph!r}: ...{context(m)}...")
    for ph in patterns.get("fail_contains", []):
        if m := find(ph):
            fails.append(f"announcement or wrap-up aside {ph!r}: ...{context(m)}...; say the plain point")
    for rx in patterns.get("fail_self_description", []):
        if m := re.search(rx, t, re.I):
            fails.append(f"describes the page's own apparatus ({m.group(0)!r}): ...{context(m)}...; say the thing, not what the page says about it")
    for term in terms:
        for variant in term.get("avoid", []):
            if variant in t:
                i = t.index(variant)
                fails.append(f"{variant.strip()!r} for the shared term {term['term']!r} ({term['iri']}): "
                             f"...{t[max(0, i - 35):i + len(variant) + 35].strip()}...")
    for lab in patterns.get("fail_labels", []):
        if m := find(lab):
            fails.append(f"the text labels a story ({lab!r}): ...{context(m)}...; tell it as a hypothetical instead")

    sents = [x.strip() for x in re.split(r"(?<=[.!?])\s+|\n\s*\n", t) if x.strip()]
    for sent in sents:
        start = sent.lower().lstrip("\"'(*_ ")
        if hit := next((a for a in patterns.get("fail_announcements", []) if start.startswith(a)), None):
            fails.append(f"announcement ({hit!r}): {sent[:90]!r}; say the thing instead of saying it is coming")
        elif hit := next((a for a in patterns.get("warn_announcements", []) if start.startswith(a)), None):
            warns.append(f"check for an announcement ({hit!r}): {sent[:90]!r}")

    seesaws = 0
    for a, b in zip(sents, sents[1:]):
        neg = NEGATION.search(a)
        early = bool(neg) and len(a[:neg.start()].split()) <= 6 and len(a.split()) <= 25
        if early and (PRONOUN_START.match(b) or (a.split()[:2] == b.split()[:2] and len(a.split()) > 2)):
            seesaws += 1
    seesaws += len(re.findall(r"\bnot\b[^.!?]{1,80},\s+but\b", t, re.I))
    if re.search(r"\bnot only\b[^.!?]*\bbut also\b", t, re.I):
        fails.append("the 'not only X but also Y' formula")
    limit = patterns.get("max_seesaws", 1)
    if seesaws > limit:
        fails.append(f"{seesaws} 'it is not X. It is Y.' seesaws; the limit is {limit} a piece")
    fragments = [x for x in sents if re.match(r"^Not [^.!?]*[.!?]$", x) and len(x.split()) <= 9]
    if len(fragments) > patterns.get("warn_not_fragments", 3):
        warns.append(f"{len(fragments)} sentences that are just 'Not X.'; that many reads as a tic")

    if mode == "procedure":
        limits = patterns.get("procedure", {})
        for line in t.splitlines():
            step = STEP.match(line)
            for sent in re.split(r"(?<=[.!?])\s+", (step.group(1) if step else line).strip()):
                n = len(sent.split())
                most = limits.get("max_instruction_words" if step else "max_descriptive_words", 25)
                if n > most:
                    fails.append(f"{'an instruction' if step else 'a sentence'} of {n} words, over {most}: {sent[:80]!r}")
                if step and PASSIVE.search(sent):
                    fails.append(f"a passive instruction; name who acts, in the present tense: {sent[:80]!r}")
    return fails, warns


def sweep_headings(heads: list[str], patterns: dict) -> tuple[list[str], list[str]]:
    """Every heading that announces instead of stating its claim (FR-009), as (fails, warns): one that starts with a word of
    `fail_headline_starts` or an announcement opening, or is one of `fail_headline_labels`, fails; one that starts with a
    phrase of `warn_headline_starts` names a topic and is reported for a person to read again."""
    fails: list[str] = []
    warns: list[str] = []
    seen: set[str] = set()
    for h in heads:
        low = plain_quotes(h).lower().strip().lstrip("\"'(*_ ")
        if low in seen:         # a title repeated as the h1 is one heading
            continue
        seen.add(low)
        low = re.sub(r"^\d+(?:\.\d+)*[.:)]?\s+", "", low)      # a numbered heading's number
        bare = low.rstrip(" .:!?")
        if not bare:
            continue
        if bare in (x.lower() for x in patterns.get("fail_headline_labels", [])):
            fails.append(f"heading is a bare label ({h.strip()!r}); state what the section says instead (FR-009)")
            continue
        starts = [a for a in patterns.get("fail_headline_starts", []) + patterns.get("fail_announcements", [])
                  if re.match(r"(?<![a-z])" + re.escape(a.lower()) + r"(?![a-z])", low)]
        if starts:
            fails.append(f"heading announces a topic or an activity ({starts[0]!r}): {h.strip()[:90]!r}; state the claim instead (FR-009)")
            continue
        topic = [a for a in patterns.get("warn_headline_starts", []) if re.match(re.escape(a.lower()) + r"(?![a-z])", low)]
        if topic:
            warns.append(f"heading names a topic ({topic[0].strip()!r}): {h.strip()[:90]!r}; a reader should be able to repeat its claim (FR-009)")
    return fails, warns


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("files", nargs="+", type=Path)
    ap.add_argument("--patterns", action="append", type=Path, help="pattern files, merged in order (default: this design system's)")
    ap.add_argument("--terms", action="append", type=Path, default=[], help="shared-term files added to this design system's terms.json")
    ap.add_argument("--mode", choices=("prose", "procedure"), default="prose")
    ap.add_argument("--draft", action="store_true", help="report every FAIL as a WARN")
    args = ap.parse_args(argv)
    patterns = load(args.patterns or [HERE / "patterns.json"])
    terms = load_terms([HERE / "terms.json", *args.terms])
    failed = False
    for path in args.files:
        text = path.read_text(encoding="utf-8")
        fails, warns = sweep(prose(text, path.suffix), patterns, mode=args.mode, terms=terms)
        hf, hw = sweep_headings(headings(text, path.suffix), patterns)
        fails, warns = fails + hf, warns + hw
        if args.draft:
            fails, warns = [], fails + warns
        for f in fails:
            print(f"FAIL {path}: {f}")
        for w in warns:
            print(f"WARN {path}: {w}")
        failed |= bool(fails)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
