"""`check ui` (0041-command-line FR-025, FR-026; 0042-agora FR-027).

Starts each UI on a free port in this process, fetches its pages and a sample of its resource routes, and fails on what a
page must not have: HTML that is not well formed, a remote reference, an action that names a command the registry lacks or
does not expose on `ui`, a request that changes something without the header that proves it came from the UI's own page,
an event stream that does not answer. Standard library only; the browser part uses Chromium when it is asked for.
"""
from __future__ import annotations

import http.client
import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, urlsplit

from agora.core.checks import Finding, SectionResult, find_program
from agora.core.ctx import Ctx

from . import htmlcheck, runtime
from .state import HOST
from .theme import DATASTAR, declared

TIMEOUT = 60
MAX_RESOURCE_PAGES = 40
DATASTAR_VERSION = re.compile(r"^//\s*Datastar v([\d.]+)", re.M)
README_VERSION = re.compile(r"`datastar\.js`\s*\|\s*([\d.]+)\s*\|")
SSE_EVENT = re.compile(r"^event: (\S+)\n((?:data: .*\n?)*)", re.M)


class Client:
    def __init__(self, port: int):
        self.port = port

    def fetch(self, method: str, path: str, headers: dict[str, str] | None = None, body: dict[str, list[str]] | None = None
              ) -> tuple[int, dict[str, str], bytes]:
        conn = http.client.HTTPConnection(HOST, self.port, timeout=TIMEOUT)  # no proxy: this is the loopback address
        data = urlencode(body, doseq=True) if body is not None else None
        h = dict(headers or {})
        if data is not None:
            h.setdefault("Content-Type", "application/x-www-form-urlencoded")
        try:
            conn.request(method, path, data, h)
            r = conn.getresponse()
            return r.status, {k.lower(): v for k, v in r.getheaders()}, r.read()
        finally:
            conn.close()

    def post(self, path: str, body: dict[str, list[str]], *, datastar: bool = True, origin: str | None = None) -> tuple[int, dict[str, str], str]:
        h = {"Origin": origin or f"http://{HOST}:{self.port}"}
        if datastar:
            h["Datastar-Request"] = "true"
        status, headers, data = self.fetch("POST", path, h, body)
        return status, headers, data.decode("utf-8", "replace")


def events(text: str) -> list[tuple[str, list[str]]]:
    return [(m.group(1), [l[len("data: "):] for l in m.group(2).splitlines()]) for m in SSE_EVENT.finditer(text)]


def elements_of(lines: list[str]) -> tuple[str, str]:
    """The selector and the markup a datastar-patch-elements event carries."""
    sel = next((l[len("selector "):] for l in lines if l.startswith("selector ")), "")
    return sel, "\n".join(l[len("elements "):] for l in lines if l.startswith("elements "))


class Run:
    def __init__(self, ctx: Ctx, ui: str, findings: list[Finding]):
        self.ctx, self.ui, self.findings = ctx, ui, findings
        self.notes: list[str] = []

    def bad(self, where: str, msg: str) -> None:
        self.findings.append(Finding("error", f"{self.ui} {where}", msg))

    def page(self, c: Client, path: str, *, expect: int = 200, full: bool = True) -> htmlcheck.Page | None:
        status, headers, body = c.fetch("GET", path)
        if status != expect:
            self.bad(path, f"answered {status}; expected {expect}")
            return None
        if "html" not in headers.get("content-type", ""):
            self.bad(path, f"is {headers.get('content-type')}, not HTML")
            return None
        csp = headers.get("content-security-policy", "")
        if "default-src" not in csp or "connect-src 'self'" not in csp:
            self.bad(path, "sends no content security policy that keeps the page to its own address (0042 FR-026)")
        p = htmlcheck.parse(body.decode("utf-8", "replace"))
        for problem in (htmlcheck.page_problems(p) if full else p.problems):
            self.bad(path, f"HTML is not well formed: {problem}")
        for r in p.remote:
            self.bad(path, f"refers to a remote host: {r} (0041 FR-025)")
        return p


def _sample_commands(ctx: Ctx, app: Any) -> list[str]:
    """The resource routes to fetch: every read command the console exposes that needs no program and no locked package, with
    the first value of each typed argument it requires."""
    reg = ctx.registry
    out: list[str] = []
    for c in app.implemented():
        if c.category != "read" or not app.exposed(c) or c.programs or reg.groups[c.group].packages or c.id == "ui link":
            continue
        fields: dict[str, Any] = {}
        ok = True
        for a in c.args:
            if not a.required:
                continue
            t = reg.types.get(a.type)
            value = None
            try:
                candidates = (t.examples(ctx) + t.choices(ctx)[:5]) if t else []
            except Exception:  # a type that reads files this clone lacks offers no sample
                candidates = []
            for v in candidates:
                try:
                    t.validate(ctx, v)
                    value = v
                    break
                except Exception:
                    continue
            if value is None:
                ok = False
                break
            fields[a.name] = value
        if ok and not any(o.required for o in c.options):
            out.append(app.res_url(c, fields))
    return out


def actions_of(ctx: Ctx, run: Run, app: Any, path: str, p: htmlcheck.Page) -> None:
    """0042 FR-024: every action a page offers names a command the registry has, and a form to run it only where the registry
    exposes the command on ui."""
    reg = ctx.registry
    for cmd_id in p.action_forms:
        cmd = reg.find(cmd_id)
        if cmd is None or not app.exposed(cmd):
            run.bad(path, f"a form posts {cmd_id!r}, which is not a command the registry exposes on ui (0042 FR-024)")
    for cmd_id, has_form in p.command_forms:
        cmd = reg.find(cmd_id)
        if cmd is None:
            run.bad(path, f"an action names {cmd_id!r}, which the registry does not have (0041 FR-017)")
        elif has_form and not app.exposed(cmd):
            run.bad(path, f"an action offers {cmd_id!r}, which the registry does not expose on ui (0042 FR-024)")
    for f in p.forms:
        if f.get("submit") and "contentType: 'form'" not in f["submit"]:
            run.bad(path, "a form does not post as a form")


def check_console(ctx: Ctx, run: Run, app: Any, c: Client) -> int:
    pages = ["/"] + [f"/n/{n}" for n in sorted({x.noun for x in app.implemented() if x.noun})] \
        + [app.cmd_url(x) for x in app.implemented()]
    seen_assets: set[str] = set()
    seen_resources: list[str] = []
    refs: set[str] = set()

    def visit(path: str) -> None:
        p = run.page(c, path)
        if p is None:
            return
        for tag, attr, value in p.refs:
            u = urlsplit(value)
            if value.startswith("/"):
                (seen_assets if (tag in ("link", "script", "img")) else refs).add(u.path + (f"?{u.query}" if u.query else ""))
        actions_of(ctx, run, app, path, p)

    for path in pages:
        visit(path)
    for r in _sample_commands(ctx, app) + sorted(x for x in refs if x.startswith("/r/")):
        if r not in seen_resources and len(seen_resources) < MAX_RESOURCE_PAGES:
            seen_resources.append(r)
            visit(r)
    for a in sorted(seen_assets):
        status, headers, body = c.fetch("GET", a)
        if status != 200:
            run.bad(a, f"answered {status}")
        elif a.endswith(".css") and htmlcheck.CSS_REMOTE.search(body.decode("utf-8", "replace")):
            run.bad(a, "a stylesheet imports or loads something remote (0041 FR-025)")
    if not any(a.endswith("datastar.js") for a in seen_assets):
        run.bad("/", "the page does not load Datastar (0041 FR-026)")
    run.notes.append(f"console: {len(pages)} pages, {len(seen_resources)} resource routes, {len(seen_assets)} assets")
    check_events(ctx, run, app, c)
    check_refusals(ctx, run, app, c)
    return len(pages) + len(seen_resources)


def check_events(ctx: Ctx, run: Run, app: Any, c: Client) -> None:
    status, headers, text = c.post("/act/start", {"cmd": ["command list"]})
    if status != 200 or "text/event-stream" not in headers.get("content-type", ""):
        return run.bad("/act/start", f"a read command answered {status} {headers.get('content-type')}, not an event stream (0041 FR-026)")
    evs = events(text)
    patches = [elements_of(lines) for ev, lines in evs if ev == "datastar-patch-elements"]
    if not patches or "#act-panel" not in [s for s, _ in patches]:
        return run.bad("/act/start", "the event stream patches no #act-panel")
    for sel, html in patches:
        for problem in htmlcheck.parse(html).problems:
            run.bad("/act/start", f"a patched fragment is not well formed: {problem}")
        for r in htmlcheck.parse(html).remote:
            run.bad("/act/start", f"a patched fragment refers to a remote host: {r}")
    if not any('data-kind="command-list"' in html for _, html in patches):
        run.bad("/act/start", "the event stream did not carry the command's resource")
    status, _, text = c.post("/act/start", {"cmd": ["check"], "sections": ["environment"]})
    seq = [(sel, "running" if 'data-status="running"' in html else "done" if f'id="sec-environment"' in html else "") for ev, lines in events(text)
           if ev == "datastar-patch-elements" for sel, html in [elements_of(lines)]]
    states = [s for sel, s in seq if sel.startswith("#sec-") or sel == "#act-progress"]
    if "running" not in states or "done" not in states or states.index("running") > states.index("done"):
        run.bad("/act/start", "a check did not stream its section as it started and as it ended (0042 FR-024)")
    run.notes.append("console: event streams answer, a check streams section by section")


def check_refusals(ctx: Ctx, run: Run, app: Any, c: Client) -> None:
    """0042 FR-024, FR-026: what the server must refuse."""
    status, _, _ = c.fetch("GET", "/", {"Host": "example.test"})
    if status != 403:
        run.bad("/", f"answered {status} to a request for another host; it must refuse (0042 FR-026)")
    status, _, _ = c.post("/act/start", {"cmd": ["command list"]}, datastar=False)
    if status != 403:
        run.bad("/act/start", f"answered {status} to a post without Datastar's header; it must refuse (0042 FR-026)")
    status, _, _ = c.post("/act/start", {"cmd": ["command list"]}, origin="http://example.test")
    if status != 403:
        run.bad("/act/start", f"answered {status} to a post from another origin; it must refuse (0042 FR-026)")
    unexposed = next((x.id for x in ctx.registry.commands.values() if x.status == "implemented" and not app.exposed(x)), None)
    if unexposed:
        status, _, _ = c.post("/act/start", {"cmd": [unexposed]})
        if status != 403:
            run.bad("/act/start", f"ran {unexposed!r}, which the registry does not expose on ui (0042 FR-024)")
    # A write that was not previewed: the probe names a design system that has no spec, so nothing could be written even
    # if the guard failed.
    status, _, text = c.post("/act/run", {"cmd": ["design-system new"], "slug": ["probe-brand"], "kind": ["brand"], "token": ["none"]})
    if "not previewed" not in text:
        run.bad("/act/run", "a write that was never previewed was not refused (0042 FR-024)")
    run.notes.append("console: a foreign host, a foreign origin, a post without the header, an unexposed command and an unpreviewed write are refused")


def check_assurance(ctx: Ctx, run: Run, app: Any, c: Client) -> int:
    p = run.page(c, "/")
    n = 1
    if p is not None:
        pages = [v for _, a, v in p.refs if a == "href" and "/assurance/" in v]
        if not pages:
            run.bad("/", "lists no design system's assurance page (0042 FR-025)")
        for v in pages[:3]:
            status, headers, _ = c.fetch("GET", v)
            n += 1
            if status != 200 or "html" not in headers.get("content-type", ""):
                run.bad(v, f"a listed assurance page answered {status}")
        styles = [v for t, a, v in p.refs if t == "link" and v.startswith("/")]
        for v in styles + ["/static/datastar.js"]:
            if c.fetch("GET", v)[0] != 200:
                run.bad(v, "does not answer")
    for path in ("/%2e%2e/spec-kit/enforcement.tsv", "/frontiers-brand/../../README.md", "/.git/config", "/frontiers-brand/", "/frontiers-brand/.x",
                 "/%2e%2e%2f%2e%2e%2fREADME.md"):
        status, _, body = c.fetch("GET", path)
        if status == 200 and path != "/frontiers-brand/":
            run.bad(path, "served a file outside design-systems/ or a hidden file (0042 FR-025)")
    status, headers, _ = c.fetch("POST", "/", {"Datastar-Request": "true", "Origin": f"http://{HOST}:{c.port}"}, {"a": ["b"]})
    if status != 405:
        run.bad("/", f"answered {status} to a post; this UI takes no request that changes anything (0042 FR-025)")
    run.notes.append(f"assurance: {n} pages, a path outside design-systems/ and a post are refused")
    return n


def vendored(ctx: Ctx) -> list[Finding]:
    """0042 FR-019: Datastar is vendored as one file, at the version tools/agora/vendor/README.md records."""
    out: list[Finding] = []
    readme = DATASTAR.parent / "README.md"
    if not DATASTAR.is_file():
        return [Finding("error", "tools/agora/vendor/datastar.js", "Datastar is not vendored (0041 FR-026)")]
    m = DATASTAR_VERSION.search(DATASTAR.read_text(encoding="utf-8")[:200])
    r = README_VERSION.search(readme.read_text(encoding="utf-8")) if readme.is_file() else None
    if not m:
        out.append(Finding("error", "tools/agora/vendor/datastar.js", "the file names no Datastar version in its first line"))
    if not r:
        out.append(Finding("error", "tools/agora/vendor/README.md", "does not record Datastar's version and license (0042 FR-019)"))
    elif m and m.group(1) != r.group(1):
        out.append(Finding("error", "tools/agora/vendor/datastar.js", f"is version {m.group(1)}; tools/agora/vendor/README.md records {r.group(1)} (0042 FR-019)"))
    return out


def browser_part(ctx: Ctx, run: Run, c: Client, chromium: str) -> None:
    """The console in Chromium: open a read command's page with its run started, and see Datastar patch the result in."""
    url = f"http://{HOST}:{c.port}/c/spec/list?run=1"
    with tempfile.TemporaryDirectory() as profile:
        argv = [chromium, "--headless", "--disable-gpu", "--no-first-run", "--disable-extensions", f"--user-data-dir={profile}",
                "--virtual-time-budget=20000", "--dump-dom", url]
        if hasattr(os, "geteuid") and os.geteuid() == 0:
            argv.insert(1, "--no-sandbox")
        env = {k: v for k, v in ctx.env.items() if k.lower() not in ("http_proxy", "https_proxy", "all_proxy")}
        p = subprocess.run(argv, capture_output=True, text=True, timeout=120, env={**env, "NO_PROXY": HOST})
    dom = p.stdout
    panel = re.search(r'<section id="act-panel"[^>]*>(.*?)</section>\s*<div class="fc-prose">', dom, re.S)
    if p.returncode != 0 or not dom:
        run.bad("browser", f"Chromium exited {p.returncode}: {p.stderr.strip()[-200:]}")
    elif not panel or 'data-kind="spec-list"' not in panel.group(1):
        run.bad("browser", "Chromium loaded the page but Datastar did not patch the read action's result into #act-panel")
    else:
        run.notes.append("console: Chromium loaded the page and Datastar patched the result of `spec list` into it")


def check_ui(ctx: Ctx, scope: str | None) -> SectionResult:
    reg = ctx.registry
    declared_uis = sorted(declared(reg))
    if scope is not None and scope not in declared_uis:  # a scope of another section (a design system) names no UI
        return SectionResult("ui", "skipped", reason=f"--scope {scope} is not a UI ({', '.join(declared_uis)}), so the ui section ran nothing")
    findings: list[Finding] = vendored(ctx)
    notes: list[str] = []
    data: dict[str, Any] = {"uis": {}}
    browser = ctx.section_options.get("runner") == "browser"
    chromium = find_program(reg, "chromium", ctx.env) if browser else None
    for ui in [scope] if scope else declared_uis:
        run = Run(ctx, ui, findings)
        server = runtime.start(reg, ctx.home, ctx.env, ui, 0)
        server.app.no_log = True
        server.start()
        try:
            c = Client(server.port)
            n = check_console(ctx, run, server.app, c) if ui == "console" else check_assurance(ctx, run, server.app, c)
            if ui == "console" and browser and chromium:
                browser_part(ctx, run, c, chromium)
            data["uis"][ui] = {"pages": n}
        finally:
            server.stop()
        notes += run.notes
    res = SectionResult.from_findings("ui", findings, notes, data)
    if not browser:
        res.notes.append("the browser part did not run: it needs --runner browser (the browser suite runs it)")
    elif not chromium and (scope in (None, "console")):
        if res.status == "passed":
            res.status = "skipped"
            res.reason = f"the browser part needs chromium, which is not found ({reg.program('chromium').get('hint', 'install it from the host')})"
    return res
