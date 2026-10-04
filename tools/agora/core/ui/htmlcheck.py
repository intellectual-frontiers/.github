"""What `check ui` reads in a page: is the HTML well formed, does it refer to anything remote, and what does it offer.

Well formed here is stricter than HTML needs: every element that is not void is closed explicitly, and nothing closes an
element it did not open. A page agora writes can meet that, and then a reader never depends on error recovery.
"""
from __future__ import annotations

import re
from html.parser import HTMLParser

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
URL_ATTRS = {"src", "href", "action", "poster", "srcset", "data", "formaction", "cite", "ping", "manifest", "background"}
REMOTE = re.compile(r"^\s*(?:[a-z][a-z0-9+.-]*:)?//|^\s*(?:https?|ftp|wss?):", re.I)
FETCH_CALL = re.compile(r"@(?:get|post|put|patch|delete)\(\s*['\"]\s*(?:[a-z]+:)?//", re.I)
CSS_REMOTE = re.compile(r"@import|url\(\s*['\"]?\s*(?:[a-z][a-z0-9+.-]*:)?//", re.I)


class Page(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[tuple[str, int]] = []
        self.problems: list[str] = []
        self.remote: list[str] = []
        self.ids: dict[str, int] = {}
        self.refs: list[tuple[str, str, str]] = []  # (tag, attribute, value) of every URL the page names
        self.forms: list[dict[str, str]] = []  # each form's hidden inputs, and its Datastar attribute
        self.commands: list[str] = []  # each data-command an action carries
        self.action_forms: list[str] = []  # the command each action form posts
        self.h1 = 0
        self.main = 0
        self.doctype = False
        self.title = ""
        self.lang = ""
        self._in_title = False
        self._form: dict[str, str] | None = None
        self._li: int | None = None  # the stack depth of the action item being read
        self.command_forms: list[tuple[str, bool]] = []  # (data-command of the li, whether it holds a form)

    def _where(self) -> str:
        return f"line {self.getpos()[0]}"

    def handle_decl(self, decl: str) -> None:
        if decl.lower().startswith("doctype"):
            self.doctype = True

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a: dict[str, str] = {}
        for k, v in attrs:
            if k in a:
                self.problems.append(f"{self._where()}: <{tag}> repeats the attribute {k}")
            a[k] = v or ""
        if tag == "html":
            self.lang = a.get("lang", "")
        if tag == "h1":
            self.h1 += 1
        if tag == "main":
            self.main += 1
            if a.get("id") != "main":
                self.problems.append(f"{self._where()}: <main> is not the skip target #main")
        if tag == "title":
            self._in_title = True
        if "id" in a:
            self.ids[a["id"]] = self.ids.get(a["id"], 0) + 1
        for k, v in a.items():
            if k in URL_ATTRS and v:
                self.refs.append((tag, k, v))
                if REMOTE.match(v):
                    self.remote.append(f"<{tag} {k}=\"{v[:80]}\">")
            elif k == "style" and CSS_REMOTE.search(v):
                self.remote.append(f"<{tag} style=\"{v[:80]}\">")
            elif FETCH_CALL.search(v):
                self.remote.append(f"<{tag} {k}=\"{v[:80]}\">")
        if "data-command" in a:
            self.commands.append(a["data-command"])
            self.command_forms.append((a["data-command"], False))
            self._li = len(self.stack) + (0 if tag in VOID else 1)
        if tag == "form":
            self._form = {"submit": next((v for k, v in a.items() if k.startswith("data-on:submit")), "")}
            self.forms.append(self._form)
        if tag == "input" and self._form is not None and a.get("type") == "hidden" and a.get("name") == "cmd":
            self._form["cmd"] = a.get("value", "")
            self.action_forms.append(a.get("value", ""))
            if self._li is not None:
                self.command_forms[-1] = (self.command_forms[-1][0], True)
        if tag not in VOID:
            self.stack.append((tag, self.getpos()[0]))

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        if tag not in VOID and self.stack and self.stack[-1][0] == tag:
            self.stack.pop()

    def handle_endtag(self, tag: str) -> None:
        if tag in VOID:
            self.problems.append(f"{self._where()}: </{tag}> closes a void element")
            return
        if tag == "title":
            self._in_title = False
        if tag == "form":
            self._form = None
        if not self.stack or self.stack[-1][0] != tag:
            opened = self.stack[-1][0] if self.stack else "nothing"
            self.problems.append(f"{self._where()}: </{tag}> closes {opened}, which is still open")
            if any(t == tag for t, _ in self.stack):  # recover so one slip is one finding
                while self.stack and self.stack[-1][0] != tag:
                    self.stack.pop()
                self.stack.pop()
            return
        self.stack.pop()
        if self._li is not None and len(self.stack) < self._li:
            self._li = None

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data


def parse(text: str) -> Page:
    p = Page()
    p.feed(text)
    p.close()
    for tag, line in p.stack:
        p.problems.append(f"line {line}: <{tag}> is never closed")
    for i, n in p.ids.items():
        if n > 1:
            p.problems.append(f"id {i!r} is used {n} times")
    return p


def page_problems(p: Page) -> list[str]:
    """What a whole page must also have (console design system's chrome.md): doctype, lang, a title, one h1 and one main#main."""
    out = list(p.problems)
    if not p.doctype:
        out.append("no doctype")
    if not p.lang:
        out.append("<html> has no lang")
    if not p.title.strip():
        out.append("no <title>")
    if p.h1 != 1:
        out.append(f"{p.h1} <h1> elements; a page has exactly one")
    if p.main != 1:
        out.append(f"{p.main} <main> elements; a page has exactly one")
    return out
