"""The console: the registry browser (0042-agora FR-024).

Nouns, the commands under each, and a page for each command; every resource a page shows is the HTML rendering of the
command's resource. An action is offered only where the registry's surfaces for its command include `ui`; a command runs
through the same library call as the terminal and its result streams over server-sent events that Datastar patches in.
A write shows its `--dry-run` first and runs only for the call that was previewed; a decision also needs a confirmation.
"""
from __future__ import annotations

import secrets
from typing import Any
from urllib.parse import urlencode

from agora.core import cli, render
from agora.core.registry import WRITES, Command
from agora.core.resource import AgoraError, Resource

from . import execute as ex
from . import forms, pages
from .forms import h
from .server import App, Reply, Request, Sse, patch, static_file
from .theme import APP_CSS, DATASTAR, Theme, declared


def canon(raw: dict[str, list[str]]) -> tuple:
    """A call's fields in one form, so a preview and its run can be compared."""
    return tuple(sorted((k, tuple(v)) for k, v in raw.items() if v))


class Console(App):
    name = "console"

    def __init__(self, registry: Any, home: Any, env: dict[str, str]):
        self.reg, self.home, self.env = registry, home, dict(env)
        decl = declared(registry)["console"]
        self.theme = Theme(home, decl["design_system"], decl["theme"])
        self.title = f"{registry.name} console"
        self.no_log = False  # `check ui` sets it: its probes are not actions to record
        self.previews: dict[str, tuple[str, tuple]] = {}  # token -> the call whose --dry-run was shown

    # the registry as pages -------------------------------------------------------------------------------------
    def exposed(self, cmd: Command | None) -> bool:
        """Whether the console may offer a command at all: the registry's surfaces for it include `ui` (0041 FR-022)."""
        return cmd is not None and cmd.status == "implemented" and "ui" in self.reg.surfaces_of(cmd)

    def ctx(self, **kw: Any):
        kw.setdefault("no_log", self.no_log)
        return ex.new_ctx(self.reg, self.home, self.env, **kw)

    def implemented(self) -> list[Command]:
        return sorted((c for c in self.reg.commands.values() if c.status == "implemented"), key=lambda c: c.id)

    @staticmethod
    def cmd_url(cmd: Command) -> str:
        return "/c/" + "/".join(cmd.words)

    def res_url(self, cmd: Command, fields: dict[str, Any]) -> str:
        q = []
        for k, v in fields.items():
            if v is None or v is False or v == []:
                continue
            for x in v if isinstance(v, (list, tuple)) else [v]:
                q.append((k, "true" if x is True else str(x)))
        return "/r/" + "/".join(cmd.words) + ("?" + urlencode(q) if q else "")

    def sidebar(self, current: str | None) -> list[dict[str, Any]]:
        by_noun: dict[str, list[Command]] = {}
        loose: list[Command] = []
        for c in self.implemented():
            if c.noun:
                by_noun.setdefault(c.noun, []).append(c)
            else:
                loose.append(c)
        items: list[dict[str, Any]] = [{"label": "Registry"}, {"href": "/", "text": "Home", "current": current == "/"}, {"label": "Nouns"}]
        for noun, cmds in sorted(by_noun.items()):
            items.append({"folder": noun, "open": any(self.cmd_url(c) == current for c in cmds) or current == f"/n/{noun}",
                          "items": [{"href": self.cmd_url(c), "text": c.words[1], "current": self.cmd_url(c) == current} for c in cmds]})
        items.append({"label": "Repository"})
        items += [{"href": self.cmd_url(c), "text": c.id, "current": self.cmd_url(c) == current} for c in loose]
        return items

    def search_index(self) -> list[dict[str, Any]]:
        return [{"title": c.id, "description": c.help, "href": self.cmd_url(c), "section": c.noun or "repository",
                 "keywords": [c.category, c.group]} for c in self.implemented()]

    def page(self, title: str, main: str, current: str | None, crumbs: list[tuple[str, str | None]], status: int = 200) -> Reply:
        body = pages.document(self.theme, name=self.title, title=title, main=main, sidebar=self.sidebar(current), crumbs=crumbs,
                              search=self.search_index(), nav=[("Registry", "/", current == "/")], foot=f"{self.reg.name}, audience {self.reg.audience}")
        return Reply.html(body, status)

    # rendering a resource --------------------------------------------------------------------------------------
    def link_href(self, link: dict[str, Any]) -> str | None:
        cmd = self.reg.find(link["command"])
        return self.res_url(cmd, link["fields"]) if cmd and cmd.category == "read" and self.exposed(cmd) else None

    def action_html(self, a: dict[str, Any]) -> str:
        cmd = self.reg.find(a["command"])
        if not self.exposed(cmd) or "ui" not in a.get("surfaces", []):
            return ""
        label = "Run" if cmd.category in ("read", "check") else "Review…" if cmd.category == "decision" else "Preview…"
        raw = {"cmd": cmd.id, **a["fields"]}
        return forms.post_form("/act/start", forms.hidden_fields(raw) + f'<button class="fc-btn" data-size="sm" type="submit">{label}</button>')

    def render(self, res: Resource, ctx: Any, level: int = 1) -> str:
        return render.to_html(res, ctx, self.link_href, self.action_html, level)

    # GET -------------------------------------------------------------------------------------------------------
    def handle(self, req: Request) -> Reply | Sse:
        p = req.path
        if req.method == "POST":
            return {"/act/start": self.act_start, "/act/run": self.act_run, "/act/clear": self.act_clear}.get(p, lambda r: Reply.text("not found", 404))(req)
        if p == "/":
            return self.home_page()
        if p.startswith("/n/"):
            return self.noun_page(p[3:].strip("/"))
        if p.startswith("/c/"):
            return self.command_page(p[3:].strip("/"), req.one("run") == "1")
        if p.startswith("/r/"):
            return self.resource_page(p[3:].strip("/"), req)
        if p == "/static/agora.css":
            return static_file(APP_CSS.parent, APP_CSS.name)
        if p == "/static/datastar.js":
            return static_file(DATASTAR.parent, DATASTAR.name)
        if p.startswith("/ds/"):
            return static_file(self.theme.root, p[4:], lambda rel: self.theme.allows(rel.as_posix()))
        if p == "/favicon.ico":
            return Reply(204, b"", "image/x-icon", csp=None)
        return Reply.text("not found", 404)

    def run_one(self, cmd: Command, values: dict[str, Any], **kw: Any) -> tuple[Any, list[Resource]]:
        ctx = self.ctx(**kw)
        return ctx, list(ex.execute(ctx, cmd, values))

    def home_page(self) -> Reply:
        cmds = self.implemented()
        nouns: dict[str, list[Command]] = {}
        for c in cmds:
            if c.noun:
                nouns.setdefault(c.noun, []).append(c)
        on_ui = sum(1 for c in cmds if self.exposed(c))
        stats = "".join(f'<div class="fc-stat"><div class="fc-stat__label">{h(l)}</div><div class="fc-stat__value">{v}</div>'
                        f'<div class="fc-stat__note">{h(n)}</div></div>' for l, v, n in (
                            ("Commands", len(cmds), "implemented"), ("Nouns", len(nouns), "kinds of resource"),
                            ("In this console", on_ui, "exposed on the ui surface"),
                            ("Decisions", sum(1 for c in cmds if c.category == "decision"), "for a person")))
        cards = "".join(f'<a class="fc-card" href="/n/{h(n)}"><span class="fc-card__title">{h(n)}</span>'
                        f'<span class="fc-card__text">{h(self.reg.nouns.get(n, ""))} ({len(cs)} command{"s" if len(cs) != 1 else ""})</span></a>'
                        for n, cs in sorted(nouns.items()))
        listing = self.run_one(self.reg.commands["command list"], {"category": None, "status": "implemented"})
        article = "".join(self.render(r, listing[0], 3) for r in listing[1])
        main = (f'<header class="fc-article__head"><h1 class="fc-title">{h(self.title)}</h1>'
                f'<p class="fc-description">The registry of {h(self.reg.name)}: each noun, its commands, and what each command does. '
                'A command runs here through the same library call as in the terminal.</p></header>'
                '<section id="act-panel" aria-live="polite"></section>'
                f'<div class="fc-prose"><div class="fc-stats">{stats}</div><h2>Nouns</h2><div class="fc-cards fc-noun-cards">{cards}</div>'
                f'<h2>Commands</h2>{article}</div>')
        return self.page("Registry", main, "/", [(self.title, None)])

    def noun_page(self, noun: str) -> Reply:
        cmds = [c for c in self.implemented() if c.noun == noun]
        if not cmds:
            return self.page("Not found", '<header class="fc-article__head"><h1 class="fc-title">No such noun</h1></header>', None,
                             [(self.title, "/"), (noun, None)], 404)
        rows = "".join(f'<tr><td><a href="{self.cmd_url(c)}">{h(c.id)}</a></td>'
                       f'<td><span class="fc-badge" data-tone="{"warning" if c.category == "decision" else "info" if c.category == "read" else "primary"}">{h(c.category)}</span></td>'
                       f'<td>{h(", ".join(["terminal", *self.reg.surfaces_of(c)]))}</td><td>{h(c.help)}</td></tr>' for c in cmds)
        main = (f'<header class="fc-article__head"><h1 class="fc-title">{h(noun)}</h1><p class="fc-description">{h(self.reg.nouns.get(noun, ""))}</p></header>'
                '<section id="act-panel" aria-live="polite"></section>'
                f'<div class="fc-prose resource"><table><thead><tr><th>command</th><th>category</th><th>surfaces</th><th>what it does</th></tr></thead>'
                f'<tbody>{rows}</tbody></table></div>')
        return self.page(noun, main, f"/n/{noun}", [(self.title, "/"), (noun, None)])

    def command_page(self, words: str, run: bool = False) -> Reply:
        cmd = self.reg.find(words.replace("/", " "))
        if cmd is None or cmd.status != "implemented":
            return self.page("Not found", '<header class="fc-article__head"><h1 class="fc-title">No such command</h1></header>', None,
                             [(self.title, "/"), (words, None)], 404)
        ctx = self.ctx()
        surfaces = ["terminal", *self.reg.surfaces_of(cmd)]
        badges = (f'<span class="fc-badge" data-tone="primary">{h(cmd.category)}</span> '
                  + " ".join(f'<span class="fc-badge">{h(s)}</span>' for s in surfaces))
        if self.exposed(cmd):
            plain = cmd.category == "read" and not any(a.required for a in cmd.args) and not any(o.required for o in cmd.options)
            form = forms.command_form(self.reg, ctx, cmd, autorun=run and plain)
            open_ = f'<p><a href="{self.res_url(cmd, {})}">Open the result as a page</a></p>' if plain else ""
            body = form + open_
        else:
            body = (f'<div class="fc-callout" data-type="info"><div class="fc-callout__body"><p class="fc-callout__title">Not offered in this console</p>'
                    f'<p>{h(cmd.id)} is a {h(cmd.category)} command, and the registry does not expose it on the ui surface. '
                    f'Run it in the terminal.</p></div></div>')
        _, shown = self.run_one(self.reg.commands["command show"], {"command": cmd.id})
        article = "".join(self.render(r, ctx, 2) for r in shown)
        main = (f'<header class="fc-article__head"><h1 class="fc-title">{h(cmd.id)}</h1><p class="fc-description">{h(cmd.help)}</p>'
                f'<p>{badges}</p></header><section id="act-panel" aria-live="polite"></section>'
                f'<div class="fc-prose">{body}<h2>About this command</h2>{article}</div>')
        crumbs = [(self.title, "/")] + ([(cmd.noun, f"/n/{cmd.noun}")] if cmd.noun else []) + [(cmd.id, None)]
        return self.page(cmd.id, main, self.cmd_url(cmd), crumbs)

    def resource_page(self, words: str, req: Request) -> Reply:
        cmd = self.reg.find(words.replace("/", " "))
        if cmd is None or cmd.category != "read" or not self.exposed(cmd):
            return Reply.text("a page shows the resource of a read command the registry exposes on the ui surface", 404)
        ctx = self.ctx()
        try:
            values = cli.values_from_raw(ctx, cmd, req.query)
            results = list(ex.execute(ctx, cmd, values))
        except AgoraError as e:
            results = [e.resource()]
        status = 400 if results[0].kind == "error" and results[0].exit == 2 else 200
        article = "".join(self.render(r, ctx, 1 if i == 0 else 2) for i, r in enumerate(results))
        main = f'<section id="act-panel" aria-live="polite"></section><div class="fc-prose">{article}</div>'
        crumbs = [(self.title, "/")] + ([(cmd.noun, f"/n/{cmd.noun}")] if cmd.noun else []) + [(f"{cmd.id}", self.cmd_url(cmd)), ("result", None)]
        return self.page(cmd.id, main, self.cmd_url(cmd), crumbs, status)

    # POST: running, over server-sent events --------------------------------------------------------------------
    @staticmethod
    def panel(inner: str, busy: bool = False) -> str:
        close = ('<button class="fc-btn act-close" type="button" data-variant="ghost" data-size="icon" aria-label="Dismiss" '
                 'data-on:click="@post(\'/act/clear\')">×</button>') if inner else ""
        return f'<section id="act-panel" aria-live="polite" aria-busy="{"true" if busy else "false"}">{close}{inner}</section>'

    def raw_of(self, req: Request) -> dict[str, list[str]]:
        out: dict[str, list[str]] = {}
        for k, vs in req.form.items():
            if k in ("cmd", "token", "confirm", "datastar"):
                continue
            lines = [l.strip() for v in vs for l in v.splitlines() if l.strip()]
            if lines:
                out[k] = lines
        return out

    def refuse(self, why: str) -> Sse:
        return Sse(lambda emit: emit(*patch("#act-panel", self.panel(f'<p class="fc-error" role="alert">{h(why)}</p>'))))

    def command_of(self, req: Request) -> Command | None:
        cmd = self.reg.find(req.one("cmd"))
        return cmd if self.exposed(cmd) else None

    def act_clear(self, req: Request) -> Sse:
        return Sse(lambda emit: emit(*patch("#act-panel", self.panel(""))))

    def act_start(self, req: Request) -> Reply | Sse:
        cmd = self.command_of(req)
        if cmd is None:
            return Reply.text("the registry does not expose that command on the ui surface", 403)
        raw = self.raw_of(req)
        return Sse(lambda emit: self._start(cmd, raw, emit))

    def _values(self, cmd: Command, raw: dict[str, list[str]]):
        ctx = self.ctx()
        return cli.values_from_raw(ctx, cmd, raw)

    def _error(self, e: AgoraError, emit: Any) -> None:
        ctx = self.ctx()
        emit(*patch("#act-panel", self.panel(self.render(e.resource(), ctx, 3))))

    def _start(self, cmd: Command, raw: dict[str, list[str]], emit: Any) -> None:
        try:
            values = self._values(cmd, raw)
        except AgoraError as e:
            return self._error(e, emit)
        if cmd.category in WRITES:
            return self._preview(cmd, raw, values, emit)
        self._stream(cmd, values, emit)

    def _line(self, cmd: Command, values: dict[str, Any]) -> str:
        from agora.core.resource import Call
        return Call(cmd.id, values).cli(self.reg, self.reg.name)

    def _preview(self, cmd: Command, raw: dict[str, list[str]], values: dict[str, Any], emit: Any) -> None:
        ctx, results = self.run_one(cmd, values, dry_run=True)
        shown = "".join(self.render(r, ctx, 3) for r in results)
        head = f'<h2>Preview of <code>{h(self._line(cmd, values))} --dry-run</code></h2>'
        if any(r.kind == "error" or r.exit for r in results):
            return emit(*patch("#act-panel", self.panel(head + shown)))
        token = secrets.token_urlsafe(16)
        self.previews[token] = (cmd.id, canon(raw))
        confirm = ""
        if cmd.category == "decision":
            confirm = ('<label class="fc-check"><input type="checkbox" name="confirm" value="yes" required> '
                       'I decide this: it changes what only a person decides.</label>')
        run = forms.post_form("/act/run", forms.hidden_fields({"cmd": cmd.id, "token": token, **raw}) + confirm
                              + '<div class="fc-form__actions"><button class="fc-btn" data-variant="'
                              + ("danger" if cmd.category == "decision" else "primary") + '" type="submit">Run it</button> '
                              + forms.post_form("/act/clear", '<button class="fc-btn" type="submit">Cancel</button>', "fc-inline") + "</div>",
                              "fc-form")
        note = '<p class="fc-hint">This is what <code>--dry-run</code> returned. Nothing has been written.</p>'
        emit(*patch("#act-panel", self.panel(head + note + shown + run)))

    def _stream(self, cmd: Command, values: dict[str, Any], emit: Any) -> None:
        head = f'<h2>Running <code>{h(self._line(cmd, values))}</code></h2>'
        emit(*patch("#act-panel", self.panel(head + '<ol class="act-progress" id="act-progress"></ol>', busy=True)))
        tones = {"passed": "success", "failed": "danger", "skipped": "warning", "running": "info"}

        def li(name: str, status: str, detail: str = "") -> str:
            return (f'<li id="sec-{h(name)}" data-status="{status}"><span class="fc-badge" data-tone="{tones[status]}" data-dot>{status}</span>'
                    f'<span>{h(name)}</span><span>{h(detail)}</span></li>')

        def on_section(event: str, name: str, result: Any) -> None:
            if event == "start":
                emit(*patch("#act-progress", li(name, "running"), "append"))
            else:
                n = sum(1 for f in result.findings if f.level == "error")
                emit(*patch(f"#sec-{name}", li(name, result.status, result.reason or (f"{n} error(s)" if n else "")), "outer"))

        ctx, results = self.run_one(cmd, values, on_section=on_section)
        shown = "".join(self.render(r, ctx, 3) for r in results)
        emit(*patch("#act-panel", self.panel(f'<h2>Result of <code>{h(self._line(cmd, values))}</code></h2>' + shown)))

    def act_run(self, req: Request) -> Reply | Sse:
        cmd = self.command_of(req)
        if cmd is None:
            return Reply.text("the registry does not expose that command on the ui surface", 403)
        if cmd.category not in WRITES:
            return self.act_start(req)
        raw = self.raw_of(req)
        token = req.one("token")
        if self.previews.get(token) != (cmd.id, canon(raw)):
            return self.refuse("This call was not previewed. Preview it (--dry-run) first; a write runs only for the call you saw.")
        if cmd.category == "decision" and req.one("confirm") != "yes":
            return self.refuse("A decision needs your explicit confirmation.")
        del self.previews[token]

        def go(emit: Any) -> None:
            try:
                values = self._values(cmd, raw)
            except AgoraError as e:
                return self._error(e, emit)
            ctx, results = self.run_one(cmd, values)
            ok = all(r.kind != "error" and not r.exit for r in results)
            head = f'<h2>{"Ran" if ok else "Could not run"} <code>{h(self._line(cmd, values))}</code></h2>'
            emit(*patch("#act-panel", self.panel(head + "".join(self.render(r, ctx, 3) for r in results))))
        return Sse(go)
