"""A reader for the Turtle the ontology is written in (0042-agora FR-037): prefixes, IRIs, prefixed names, `a`, literals with a
language or datatype, blank nodes, collections, comments. Standard library only. It yields triples with the line of each
statement's subject, and refuses what it cannot read with the line, so that a malformed file is never half-read.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterator

RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
RDF_TYPE, RDF_FIRST, RDF_REST, RDF_NIL = RDF + "type", RDF + "first", RDF + "rest", RDF + "nil"
XSD = "http://www.w3.org/2001/XMLSchema#"


@dataclass(frozen=True)
class Iri:
    value: str


@dataclass(frozen=True)
class Lit:
    value: str
    lang: str = ""
    datatype: str = ""


@dataclass(frozen=True)
class Blank:
    label: str


Node = Iri | Lit | Blank


class TurtleError(ValueError):
    pass


TOKEN = re.compile(r"""
  (?P<ws>\s+|\#[^\n]*)
 |(?P<iri><[^<>"{}|^`\\\s]*>)
 |(?P<long>\"\"\"(?:[^"\\]|\\.|"(?!""))*\"\"\"|'''(?:[^'\\]|\\.|'(?!''))*''')
 |(?P<str>"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')
 |(?P<lang>@[A-Za-z]+(?:-[A-Za-z0-9]+)*)
 |(?P<dt>\^\^)
 |(?P<bnode>_:[A-Za-z0-9_][\w.-]*)
 |(?P<num>[+-]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?)
 |(?P<pname>(?:[A-Za-z][\w.-]*)?:(?:[\w:%-][\w:.%-]*)?)
 |(?P<word>[A-Za-z]+)
 |(?P<punct>[;,.\[\]()])
""", re.X)

ESCAPES = {"t": "\t", "n": "\n", "r": "\r", "b": "\b", "f": "\f", '"': '"', "'": "'", "\\": "\\"}


def _unescape(raw: str) -> str:
    return re.sub(r"\\(?:([tnrbf\"'\\])|u([0-9A-Fa-f]{4})|U([0-9A-Fa-f]{8}))",
                  lambda m: ESCAPES[m.group(1)] if m.group(1) else chr(int(m.group(2) or m.group(3), 16)), raw)


class Reader:
    def __init__(self, text: str) -> None:
        self.prefixes: dict[str, str] = {}
        self.toks: list[tuple[str, str, int]] = []
        line = 1
        pos = 0
        while pos < len(text):
            m = TOKEN.match(text, pos)
            if not m:
                raise TurtleError(f"line {line}: cannot read {text[pos:pos + 20]!r}")
            kind = m.lastgroup or ""
            raw = m.group()
            if kind == "ws":
                raw = m.group()
            else:
                # a name's trailing dot ends the statement, not the name
                if kind == "pname" and raw.endswith("."):
                    raw = raw[:-1]
                self.toks.append((kind, raw, line))
            line += raw.count("\n")
            pos += len(raw)
        self.i = 0
        self.bn = 0
        self.triples: list[tuple[Node, str, Node, int]] = []

    # -- tokens
    def peek(self) -> tuple[str, str, int] | None:
        return self.toks[self.i] if self.i < len(self.toks) else None

    def take(self) -> tuple[str, str, int]:
        t = self.peek()
        if t is None:
            raise TurtleError("unexpected end of file")
        self.i += 1
        return t

    def expect(self, value: str) -> None:
        k, v, ln = self.take()
        if v != value:
            raise TurtleError(f"line {ln}: expected {value!r}, found {v!r}")

    # -- terms
    def iri(self, raw: str) -> str:
        return raw[1:-1]

    def pname(self, raw: str, ln: int) -> str:
        pre, _, local = raw.partition(":")
        if pre not in self.prefixes:
            raise TurtleError(f"line {ln}: the prefix {pre!r} is not declared")
        return self.prefixes[pre] + re.sub(r"\\(.)", r"\1", local)

    def blank(self) -> Blank:
        self.bn += 1
        return Blank(f"b{self.bn}")

    def resource(self) -> tuple[Node, int]:
        k, v, ln = self.take()
        if k == "iri":
            return Iri(self.iri(v)), ln
        if k == "pname":
            return Iri(self.pname(v, ln)), ln
        if k == "bnode":
            return Blank(v[2:]), ln
        if v == "[":
            node = self.blank()
            if self.peek() and self.peek()[1] == "]":  # type: ignore[index]
                self.take()
            else:
                self.predicate_object_list(node, ln)
                self.expect("]")
            return node, ln
        if v == "(":
            return self.collection(ln), ln
        raise TurtleError(f"line {ln}: expected a subject or object, found {v!r}")

    def collection(self, ln: int) -> Node:
        items: list[Node] = []
        while True:
            t = self.peek()
            if t is None:
                raise TurtleError(f"line {ln}: a collection is not closed")
            if t[1] == ")":
                self.take()
                break
            items.append(self.object())
        if not items:
            return Iri(RDF_NIL)
        head: Node = self.blank()
        cur = head
        for n, item in enumerate(items):
            self.triples.append((cur, RDF_FIRST, item, ln))
            nxt: Node = Iri(RDF_NIL) if n == len(items) - 1 else self.blank()
            self.triples.append((cur, RDF_REST, nxt, ln))
            cur = nxt
        return head

    def object(self) -> Node:
        k, v, ln = self.peek() or ("", "", 0)
        if k in ("str", "long"):
            self.take()
            body = _unescape(v[3:-3] if k == "long" else v[1:-1])
            nxt = self.peek()
            if nxt and nxt[0] == "lang":
                self.take()
                return Lit(body, lang=nxt[1][1:])
            if nxt and nxt[0] == "dt":
                self.take()
                dk, dv, dl = self.take()
                return Lit(body, datatype=self.iri(dv) if dk == "iri" else self.pname(dv, dl))
            return Lit(body)
        if k == "num":
            self.take()
            return Lit(v, datatype=XSD + ("integer" if re.fullmatch(r"[+-]?\d+", v) else "decimal" if "e" not in v.lower() else "double"))
        if k == "word" and v in ("true", "false"):
            self.take()
            return Lit(v, datatype=XSD + "boolean")
        return self.resource()[0]

    # -- statements
    def predicate_object_list(self, subj: Node, ln: int) -> None:
        while True:
            k, v, pl = self.take()
            if k == "word" and v == "a":
                pred = RDF_TYPE
            elif k == "iri":
                pred = self.iri(v)
            elif k == "pname":
                pred = self.pname(v, pl)
            else:
                raise TurtleError(f"line {pl}: expected a predicate, found {v!r}")
            while True:
                self.triples.append((subj, pred, self.object(), ln))
                t = self.peek()
                if t and t[1] == ",":
                    self.take()
                    continue
                break
            t = self.peek()
            if t and t[1] == ";":
                while self.peek() and self.peek()[1] == ";":  # type: ignore[index]
                    self.take()
                t = self.peek()
                if t and t[1] in (".", "]"):
                    return
                continue
            return

    def read(self) -> None:
        while self.peek():
            k, v, ln = self.peek()  # type: ignore[misc]
            if v in ("@prefix", "@base") or (k == "word" and v.lower() in ("prefix", "base")):
                self.take()
                if v.lower().endswith("base"):
                    self.take()
                else:
                    pk, pv, pl = self.take()
                    if pk != "pname" or not pv.endswith(":"):
                        raise TurtleError(f"line {pl}: a prefix name ends with a colon")
                    ik, iv, il = self.take()
                    if ik != "iri":
                        raise TurtleError(f"line {il}: a prefix names an IRI")
                    self.prefixes[pv[:-1]] = self.iri(iv)
                if v.startswith("@"):
                    self.expect(".")
                continue
            subj, sl = self.resource()
            if self.peek() and self.peek()[1] == ".":  # type: ignore[index]
                self.take()
                continue
            self.predicate_object_list(subj, sl)
            self.expect(".")


def parse(text: str) -> tuple[dict[str, str], list[tuple[Node, str, Node, int]]]:
    """(prefixes, triples as (subject, predicate IRI, object, the line the statement starts on))."""
    r = Reader(text)
    r.read()
    return r.prefixes, r.triples
