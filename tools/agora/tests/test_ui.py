"""The web UIs (0041-command-line FR-024 to FR-026; 0042-agora FR-019, FR-023 to FR-027)."""
from __future__ import annotations

import json
import os
import re
import signal
import subprocess
import sys
import time
import unittest
from pathlib import Path
from unittest import mock

from agora.core import cli, render
from agora.core.checks import SectionResult
from agora.core.ctx import Ctx
from agora.core.registry import Registry
from agora.core.resource import AgoraError, Resource
from agora.core.ui import check as ui_check
from agora.core.ui import execute, htmlcheck, state
from agora.core.ui.check import elements_of, events

from .helpers import HOME, run, run_json
from .uifix import UiRepo


def panel_html(text: str) -> str:
    return "\n".join(html for _, html in (elements_of(lines) for ev, lines in events(text) if ev == "datastar-patch-elements"))


class TypeAndForms(unittest.TestCase):
    def test_the_ui_type_takes_its_values_from_the_manifests(self):  # 0041 FR-013, FR-025
        reg = Registry.load(HOME)
        ctx = Ctx(reg, HOME, HOME)
        t = reg.types["UI"]
        self.assertEqual(t.choices(ctx), ["assurance", "console"])
        self.assertEqual(t.validate(ctx, "console"), "console")
        self.assertEqual(t.complete(ctx, "c"), ["console"])
        self.assertEqual(t.schema(ctx)["enum"], ["assurance", "console"])
        with self.assertRaises(ValueError):
            t.validate(ctx, "mcp")
        code, doc = run_json(["ui", "link", "nope"])
        self.assertEqual((code, doc["data"]["code"], doc["data"]["type"]), (2, "invalid-argument", "UI"))

    def test_the_port_type(self):
        ctx = Ctx(Registry.load(HOME), HOME, HOME)
        t = Registry.load(HOME).types["PORT"]
        self.assertEqual(t.validate(ctx, "8080"), 8080)
        for bad in ("0", "65536", "x", "-1"):
            with self.assertRaises(ValueError):
                t.validate(ctx, bad)

    def test_the_surfaces_of_the_ui_commands(self):  # 0041 FR-022; 0042 FR-005
        reg = Registry.load(HOME)
        self.assertEqual({c: reg.surfaces_of(reg.find(c)) for c in ("ui serve", "ui open", "ui stop")}, {c: () for c in ("ui serve", "ui open", "ui stop")})
        self.assertEqual(reg.surfaces_of(reg.find("ui link")), ("ui", "mcp"))
        self.assertEqual(reg.find("ui serve").category, "setup")

    def test_values_from_a_form_are_validated_by_the_terminal_types(self):  # 0041 FR-013, FR-024
        reg = Registry.load(HOME)
        ctx = Ctx(reg, HOME, HOME)
        c = reg.find("check")
        v = cli.values_from_raw(ctx, c, {"sections": ["specs", "register"], "scope": ["0020"], "changed": ["true"]})
        self.assertEqual((v["sections"], v["scope"], v["changed"], v["suite"]), (["specs", "register"], ["0020"], True, None))
        with self.assertRaises(AgoraError) as e:
            cli.values_from_raw(ctx, c, {"sections": ["nope"]})
        self.assertEqual((e.exception.code, e.exception.exit), ("invalid-argument", 2))
        with self.assertRaises(AgoraError) as e:
            cli.values_from_raw(ctx, reg.find("spec show"), {})
        self.assertEqual(e.exception.code, "usage")
        v = cli.values_from_raw(ctx, reg.find("spec set"), {"spec": ["0020"], "status": ["Adopted"]})
        self.assertEqual((v["spec"], v["status"], v["superseded_by"]), ("0020-spec-format", "Adopted", None))

    def test_a_resource_read_back_from_json_is_the_resource(self):  # 0041 FR-028
        code, doc = run_json(["spec", "show", "0041"])
        back = Resource.from_dict(doc)
        self.assertEqual(back.to_dict(Registry.load(HOME)), doc)

    def test_html_hooks_add_only_what_the_surface_makes_of_a_link_and_an_action(self):  # 0041 FR-018
        reg = Registry.load(HOME)
        ctx = Ctx(reg, HOME, HOME)
        res = run_json(["spec", "show", "0041"])[1]
        r = Resource.from_dict(res)
        plain = render.to_html(r, ctx)
        hooked = render.to_html(r, ctx, lambda l: "/x", lambda a: "<button>go</button>", level=2)
        self.assertNotIn("<a ", plain)
        self.assertIn("<h2>", hooked)
        undone = hooked.replace("<button>go</button>", "").replace('<a href="/x">', "").replace("</a>", "").replace("h2>", "h1>")
        self.assertEqual(plain, undone)  # the hooks add anchors and controls, and nothing the resource does not carry


class Htmlcheck(unittest.TestCase):
    def test_a_good_page_is_well_formed(self):
        p = htmlcheck.parse('<!doctype html><html lang="en"><head><title>t</title></head><body><main id="main"><h1>x</h1><img src="/a.png" alt=""></main></body></html>')
        self.assertEqual(htmlcheck.page_problems(p), [])

    def test_what_it_finds(self):
        bad = htmlcheck.parse('<div><p>one</div><span id="a"></span><span id="a"></span><a href="https://example.test/">x</a>'
                              '<img src="//cdn.test/x.png"><div style="background:url(http://x/y)"></div><button data-on:click="@get(\'https://x.test/\')"></button><b>')
        text = " ".join(bad.problems)
        self.assertIn("closes p", text)
        self.assertIn("is never closed", text)
        self.assertIn("'a' is used 2 times", text)
        self.assertEqual(len(bad.remote), 4)
        whole = htmlcheck.page_problems(htmlcheck.parse("<html><body><h1>a</h1><h1>b</h1></body></html>"))
        for want in ("no doctype", "no lang", "no <title>", "2 <h1>", "0 <main>"):
            self.assertTrue(any(want in w for w in whole), want)

    def test_actions_and_their_forms_are_read(self):
        p = htmlcheck.parse('<ul><li data-command="spec set"><form data-on:submit__prevent="@post(\'/act/start\', {contentType: \'form\'})">'
                            '<input type="hidden" name="cmd" value="spec set"></form></li><li data-command="lock">x</li></ul>')
        self.assertEqual(p.commands, ["spec set", "lock"])
        self.assertEqual(p.command_forms, [("spec set", True), ("lock", False)])


class Console(UiRepo):
    def test_pages_are_the_html_rendering_of_resources(self):  # 0042 FR-024
        server, c = self.serve()
        for path in ("/", "/n/spec", "/c/spec/show", "/c/lock", "/r/spec/list", "/r/spec/show?spec=0001", "/r/design-system/list",
                     "/r/command/show?command=check"):
            status, headers, body = c.fetch("GET", path)
            self.assertEqual(status, 200, path)
            page = htmlcheck.parse(body.decode())
            self.assertEqual(htmlcheck.page_problems(page), [], path)
            self.assertEqual(page.remote, [], path)
            self.assertIn("default-src 'none'", headers["content-security-policy"])
        body = c.fetch("GET", "/r/spec/show?spec=0001")[2].decode()
        self.assertIn('data-kind="spec"', body)
        self.assertIn('href="/r/requirement/show?requirement=0001-first%2FFR-001"', body)  # a link is a link to its resource
        self.assertEqual(c.fetch("GET", "/n/nonesuch")[0], 404)
        self.assertEqual(c.fetch("GET", "/c/nonesuch")[0], 404)
        self.assertEqual(c.fetch("GET", "/r/spec/set?spec=0001&status=Adopted")[0], 404)  # a page shows a read command only
        self.assertEqual(c.fetch("GET", "/r/spec/show?spec=nope")[0], 400)  # an error resource, as a page

    def test_the_same_resource_in_the_terminal_and_in_the_console(self):  # 0041 FR-024
        server, c = self.serve()
        app = server.app
        for words, values in ((["spec", "list"], {"status": None}), (["spec", "show", "0001"], {"spec": "0001-first"}),
                              (["design-system", "list"], {"kind": None}), (["term", "list"], {"scheme": None})):
            cmd = app.reg.find(" ".join(words[:2]))
            _, results = app.run_one(cmd, values, no_log=True)
            code, doc = run_json([*words, "--root", str(self.root)], home=self.root)
            self.assertEqual(results[0].to_dict(app.reg, "public", "agora")["data"], doc["data"], words)

    def test_an_action_is_offered_only_where_the_registry_exposes_it_on_ui(self):  # 0041 FR-017, FR-022; 0042 FR-024
        server, c = self.serve()
        body = c.fetch("GET", "/r/spec/show?spec=0001")[2].decode()
        p = htmlcheck.parse(body)
        self.assertEqual(p.action_forms, ["check", "spec set"])  # the decision is shown, and run only with a confirmation
        reg = server.app.reg
        reg.find("spec set").surfaces = ()  # no longer exposed on ui
        body = c.fetch("GET", "/r/spec/show?spec=0001")[2].decode()
        self.assertEqual(htmlcheck.parse(body).action_forms, ["check"])
        self.assertIn("agora spec set 0001-first --status Adopted", body)  # still shown as the terminal's command
        status, _, _ = c.post("/act/start", {"cmd": ["spec set"], "spec": ["0001"], "status": ["Adopted"]})
        self.assertEqual(status, 403)
        status, _, _ = c.post("/act/start", {"cmd": ["lock"]})  # setup: on no surface but the terminal
        self.assertEqual(status, 403)
        page = c.fetch("GET", "/c/lock")[2].decode()
        self.assertIn("Not offered in this console", page)
        self.assertNotIn("<form", page)

    def test_a_form_has_the_fields_choices_and_requirements_of_the_typed_arguments(self):  # 0041 FR-013
        server, c = self.serve()
        page = c.fetch("GET", "/c/spec/set")[2].decode()
        self.assertIn('name="spec"', page)
        self.assertRegex(page, r'<select class="fc-select" id="f-spec-set-status" name="status" required')
        for status in ("Draft", "Adopted", "Superseded"):
            self.assertIn(f'<option value="{status}">', page)
        self.assertIn("Preview the change (--dry-run)", page)
        self.assertIn("A decision", page)
        check = c.fetch("GET", "/c/check")[2].decode()
        self.assertIn('name="sections" multiple', check)
        self.assertIn('type="checkbox" name="changed"', check)
        read = c.fetch("GET", "/c/spec/list")[2].decode()
        self.assertNotIn("--dry-run", read.split("About this command")[0])

    def test_a_read_runs_over_an_event_stream_and_is_logged_as_the_ui(self):  # 0042 FR-021, FR-024
        server, c = self.serve()
        status, headers, text = c.post("/act/start", {"cmd": ["spec show"], "spec": ["0001"]})
        self.assertEqual((status, headers["content-type"]), (200, "text/event-stream"))
        html = panel_html(text)
        self.assertIn('data-kind="spec"', html)
        self.assertEqual(htmlcheck.parse(elements_of([e for e in events(text) if e[0] == "datastar-patch-elements"][-1][1])[1]).problems, [])
        lines = [json.loads(l) for l in self.logs().splitlines()]
        self.assertEqual([(l["surface"], l["command"], l["args"], l["exit"]) for l in lines], [("ui", "spec show", {"spec": "0001-first"}, 0)])

    def test_a_form_with_a_bad_value_answers_with_an_error_resource(self):  # 0041 FR-013, FR-020
        server, c = self.serve()
        _, _, text = c.post("/act/start", {"cmd": ["spec show"], "spec": ["9999"]})
        html = panel_html(text)
        self.assertIn('data-kind="error"', html)
        self.assertIn("invalid-argument", html)

    def test_a_check_streams_section_by_section(self):  # 0041 FR-031; 0042 FR-024
        server, c = self.serve()
        _, _, text = c.post("/act/start", {"cmd": ["check"], "sections": ["environment", "controls"]})
        sel = [(elements_of(lines)[0], re.search(r'data-status="(\w+)"', elements_of(lines)[1])) for ev, lines in events(text)
               if ev == "datastar-patch-elements"]
        story = [(s, m.group(1)) for s, m in sel if m and s.startswith(("#sec-", "#act-progress"))]
        self.assertEqual(story, [("#act-progress", "running"), ("#sec-environment", "passed"), ("#act-progress", "running"),
                                 ("#sec-controls", "passed")])
        self.assertIn('data-kind="check"', panel_html(text))

    def test_a_write_shows_its_dry_run_first_and_runs_only_for_the_call_previewed(self):  # 0041 FR-015, FR-026; 0042 FR-024
        server, c = self.serve()
        target = self.root / "spec-kit/specs/0002-second-thing/spec.md"
        call = {"cmd": ["spec new"], "slug": ["second-thing"], "title": ["A second thing"]}
        _, _, text = c.post("/act/run", {**call, "token": ["made-up"]})
        self.assertIn("was not previewed", text)
        self.assertFalse(target.exists())
        _, _, text = c.post("/act/start", call)
        self.assertIn("--dry-run", text)
        self.assertIn('data-kind="spec"', text)
        self.assertFalse(target.exists())  # the preview wrote nothing
        token = re.search(r'name="token" value="([^"]+)"', text).group(1)
        self.assertNotIn('name="confirm"', text)  # not a decision
        _, _, text = c.post("/act/run", {**call, "title": ["Another title"], "token": [token]})  # other values than previewed
        self.assertIn("was not previewed", text)
        self.assertFalse(target.exists())
        _, _, text = c.post("/act/run", {**call, "token": [token]})  # the previewed call, whose token the refusal did not spend
        self.assertTrue(target.is_file(), text)
        self.assertIn("Ran", text)
        _, _, text = c.post("/act/run", {**call, "token": [token]})  # a token is used once
        self.assertIn("was not previewed", text)
        lines = [json.loads(l) for l in self.logs().splitlines()]
        self.assertEqual([(l["command"], l.get("dry_run", False)) for l in lines], [("spec new", True), ("spec new", False)])

    def test_a_decision_needs_the_persons_confirmation(self):  # 0041 FR-026; 0042 FR-007, FR-024
        server, c = self.serve()
        spec = self.root / "spec-kit/specs/0001-first/spec.md"
        call = {"cmd": ["spec set"], "spec": ["0001"], "status": ["Adopted"]}
        _, _, text = c.post("/act/start", call)
        self.assertIn('name="confirm"', text)
        self.assertIn("required", text)
        token = re.search(r'name="token" value="([^"]+)"', text).group(1)
        _, _, text = c.post("/act/run", {**call, "token": [token]})
        self.assertIn("explicit confirmation", text)
        self.assertIn("**Status:** Draft", spec.read_text())
        _, _, text = c.post("/act/run", {**call, "token": [token], "confirm": ["yes"]})
        self.assertIn("**Status:** Adopted", spec.read_text())

    def test_a_write_that_fails_its_dry_run_offers_no_run(self):  # 0041 FR-015
        server, c = self.serve()
        _, _, text = c.post("/act/start", {"cmd": ["spec set"], "spec": ["0001"], "status": ["Superseded"]})  # needs --superseded-by
        self.assertIn('data-kind="error"', text)
        self.assertNotIn('name="token"', text)

    def test_nothing_changes_without_the_ui_own_page(self):  # 0041 FR-025; 0042 FR-026
        server, c = self.serve()
        self.assertEqual(c.fetch("GET", "/", {"Host": "example.test"})[0], 403)
        self.assertEqual(c.fetch("GET", "/", {"Host": f"127.0.0.1:{c.port + 1}"})[0], 403)
        self.assertEqual(c.post("/act/start", {"cmd": ["spec list"]}, datastar=False)[0], 403)
        self.assertEqual(c.post("/act/start", {"cmd": ["spec list"]}, origin="http://example.test")[0], 403)
        self.assertEqual(c.post("/act/start", {"cmd": ["spec list"]}, origin=f"http://localhost:{c.port}")[0], 200)
        self.assertEqual(c.fetch("PUT", "/act/start")[0], 405)
        self.assertEqual(c.fetch("DELETE", "/")[0], 405)

    def test_only_the_design_systems_and_agora_files_are_served(self):  # 0014 FR-005
        server, c = self.serve()
        for path in ("/ds/frontiers-console-web/spec.md", "/ds/../spec-kit/enforcement.tsv", "/ds/frontiers-brand/tokens.json",
                     "/static/agora.py", "/%2e%2e/%2e%2e/etc/passwd"):
            self.assertEqual(c.fetch("GET", path)[0], 404, path)
        self.assertEqual(c.fetch("GET", "/static/datastar.js")[0], 200)
        self.assertEqual(c.fetch("GET", "/static/agora.css")[0], 200)

    def test_datastar_is_vendored_at_the_version_recorded(self):  # 0041 FR-026; 0042 FR-019
        self.assertEqual(ui_check.vendored(Ctx(Registry.load(HOME), HOME, HOME)), [])
        text = (HOME / "tools/agora/vendor/datastar.js").read_text()
        self.assertTrue(text.startswith("// Datastar v1.0.4"))
        copy = self.root / "tools/agora/vendor/README.md"
        copy.write_text(copy.read_text().replace("| 1.0.4 |", "| 1.0.3 |"))
        with mock.patch.object(ui_check, "DATASTAR", self.root / "tools/agora/vendor/datastar.js"):
            self.assertTrue(any("records 1.0.3" in str(f) for f in ui_check.vendored(Ctx(Registry.load(self.root), self.root, self.root))))
        (self.root / "tools/agora/vendor/datastar.js").unlink()
        with mock.patch.object(ui_check, "DATASTAR", self.root / "tools/agora/vendor/datastar.js"):
            self.assertTrue(any("not vendored" in str(f) for f in ui_check.vendored(Ctx(Registry.load(self.root), self.root, self.root))))

    def test_a_command_of_a_locked_group_runs_in_its_worker(self):  # 0041 FR-028
        server, c = self.serve()
        app = server.app
        cmd = app.reg.find("figure generate")
        self.assertTrue(app.reg.groups[cmd.group].packages)
        with mock.patch("agora.core.worker.run_command", return_value=[Resource("figure", "x")]) as w:
            _, results = app.run_one(cmd, {}, no_log=True)
        w.assert_called_once()
        self.assertEqual(results[0].kind, "figure")

    def test_a_failing_command_is_an_error_resource_never_a_trace(self):  # 0041 FR-020
        server, c = self.serve()
        app = server.app
        cmd = app.reg.find("spec list")
        with mock.patch.object(type(cmd), "fn", create=True, new=None):
            pass
        boom = mock.Mock(side_effect=RuntimeError("boom"))
        cmd2 = type(cmd)(**{**cmd.__dict__, "fn": boom})
        _, results = app.run_one(cmd2, {"status": None}, no_log=True)
        self.assertEqual((results[0].kind, results[0].data["code"]), ("error", "internal"))
        self.assertNotIn("Traceback", json.dumps(results[0].data))


class CheckUi(UiRepo):
    def ctx(self):
        return Ctx(Registry.load(self.root), self.root, self.root, env={"PATH": "/usr/bin:/bin"})

    def test_it_passes_on_this_repository_and_says_the_browser_part_did_not_run(self):  # 0042 FR-027
        code, doc = run_json(["check", "ui"])
        s = doc["data"]["sections"][0]
        self.assertEqual((code, s["status"], s["findings"]), (0, "passed", []))
        self.assertTrue(any("browser part did not run" in n for n in s["notes"]))
        self.assertEqual(sorted(s["data"]["uis"]), ["assurance", "console"])

    def test_one_ui_by_scope(self):
        code, doc = run_json(["check", "ui", "--scope", "assurance"])
        self.assertEqual((code, sorted(doc["data"]["sections"][0]["data"]["uis"])), (0, ["assurance"]))
        self.assertEqual(run(["check", "ui", "--scope", "nope"])[0], 2)
        r = ui_check.check_ui(Ctx(Registry.load(HOME), HOME, HOME), "frontiers-brand")  # a scope meant for another section
        self.assertEqual(r.status, "skipped")

    def test_a_page_with_a_remote_reference_fails(self):  # 0041 FR-025
        from agora.core.ui.console import Console
        real = Console.home_page
        def bad(self):
            r = real(self)
            r.body = r.body.replace(b"</main>", b'<img src="https://example.test/x.png" alt=""></main>')
            return r
        with mock.patch.object(Console, "home_page", bad):
            r = ui_check.check_ui(self.ctx(), "console")
        self.assertEqual(r.status, "failed")
        self.assertTrue(any("remote host" in f.message for f in r.findings))

    def test_a_page_that_is_not_well_formed_fails(self):
        from agora.core.ui.console import Console
        real = Console.noun_page
        def bad(self, noun):
            r = real(self, noun)
            r.body = r.body.replace(b"</main>", b"<div></main>")
            return r
        with mock.patch.object(Console, "noun_page", bad):
            r = ui_check.check_ui(self.ctx(), "console")
        self.assertTrue(any("not well formed" in f.message for f in r.findings))

    def test_an_action_for_a_command_the_registry_does_not_expose_fails(self):  # 0042 FR-024
        from agora.core.ui import forms
        from agora.core.ui.console import Console
        def offer_everything(self, a):
            return forms.post_form("/act/start", forms.hidden_fields({"cmd": a["command"], **a["fields"]}) + "<button>x</button>")
        reg = Registry.load(self.root)
        reg.find("spec set").surfaces = ()
        with mock.patch.object(Console, "action_html", offer_everything), \
                mock.patch("agora.core.ui.runtime.Registry", create=True):
            from agora.core.ui import runtime
            server = runtime.start(reg, self.root, {"PATH": "/usr/bin"}, "console", 0)
            server.start()
            self.servers.append(server)
            from agora.core.ui.check import Client, Run, check_console
            findings: list = []
            check_console(Ctx(reg, self.root, self.root, env={}), Run(Ctx(reg, self.root, self.root), "console", findings), server.app, Client(server.port))
        self.assertTrue(any("'spec set', which is not a command the registry exposes on ui" in f.message for f in findings), [f.message for f in findings])

    def test_a_server_that_does_not_refuse_a_foreign_post_fails(self):  # 0042 FR-026
        from agora.core.ui import server as srv
        real = srv.UIServer._handler
        reg = Registry.load(self.root)
        with mock.patch.object(srv, "UIServer", wraps=srv.UIServer):
            pass
        from agora.core.ui.check import Client, Run, check_refusals
        from agora.core.ui import runtime
        server = runtime.start(reg, self.root, {"PATH": "/usr/bin"}, "console", 0)
        server.hosts |= {"example.test"}  # a server that answers any host it is asked about
        server.start()
        self.servers.append(server)
        findings: list = []
        check_refusals(Ctx(reg, self.root, self.root), Run(Ctx(reg, self.root, self.root), "console", findings), server.app, Client(server.port))
        self.assertTrue(any("another host" in f.message for f in findings))

    def test_the_browser_part_is_skipped_without_chromium_and_runs_with_it(self):  # 0042 FR-027; 0041 FR-006, FR-033
        ctx = Ctx(Registry.load(HOME), HOME, HOME, env=dict(os.environ))
        ctx.section_options = {"runner": "browser"}
        with mock.patch.object(ui_check, "find_program", return_value=None):
            r = ui_check.check_ui(ctx, "console")
        self.assertEqual(r.status, "skipped")
        self.assertIn("chromium", r.reason)
        self.assertIn("Playwright", r.reason)
        code, doc = run_json(["check", "ui", "--runner", "browser", "--scope", "assurance"])  # nothing for the console to skip
        self.assertEqual(code, 0)

    @unittest.skipUnless(ui_check.find_program(Registry.load(HOME), "chromium", dict(os.environ)), "Chromium is not here")
    def test_the_console_runs_a_read_action_in_chromium(self):
        code, doc = run_json(["check", "ui", "--runner", "browser"], env={k: v for k, v in os.environ.items() if k != "PATH"} | {"PATH": os.environ["PATH"]})
        s = doc["data"]["sections"][0]
        self.assertEqual((code, s["status"]), (0, "passed"), s["findings"])
        self.assertTrue(any("Chromium loaded the page" in n for n in s["notes"]))


class Assurance(UiRepo):
    def setUp(self):
        super().setUp()
        self.write("design-systems/brand-a/brand.css", "/* a */")
        self.write("design-systems/brand-a/assurance/index.html", "<!doctype html><title>a</title>")
        self.write("design-systems/web-a/assurance/index.html", '<!doctype html><title>w</title><link data-theme="brand-a">')
        self.write("design-systems/web-a/assurance/run.mjs", "//")
        self.write("design-systems/web-a/css/bundle.txt", "x.css\n")
        self.write("design-systems/py-only/assurance/run.py", "#")  # no in-browser page
        self.write("design-systems/web-a/assurance/data.json", "{}")
        self.write("design-systems/web-a/.secret", "no")
        self.write("spec-kit/outside.txt", "outside")
        self.server, self.c = self.serve("assurance")

    def test_it_lists_each_assurance_page_per_brand(self):  # 0042 FR-025
        status, headers, body = self.c.fetch("GET", "/")
        page = htmlcheck.parse(body.decode())
        self.assertEqual((status, htmlcheck.page_problems(page)), (200, []))
        hrefs = [v for _, a, v in page.refs if a == "href" and "/assurance/" in v]
        self.assertEqual(hrefs, ["/brand-a/assurance/index.html", "/web-a/assurance/index.html?brand=brand-a"])
        self.assertNotIn("py-only", body.decode().split("<tbody>")[1])

    def test_it_serves_design_systems_as_they_lie_so_a_harness_runs_from_its_directory(self):
        for path, ctype in (("/web-a/assurance/index.html?brand=brand-a", "text/html"), ("/web-a/assurance/data.json", "application/json"),
                            ("/brand-a/brand.css", "text/css"), ("/web-a/assurance/", None)):
            status, headers, _ = self.c.fetch("GET", path)
            self.assertEqual(status, 200 if ctype or path.endswith("/") else 404, path)
            if ctype:
                self.assertTrue(headers["content-type"].startswith(ctype), path)
        status, headers, _ = self.c.fetch("GET", "/web-a/assurance")
        self.assertEqual((status, headers["location"]), (301, "/web-a/assurance/"))
        self.assertEqual(self.c.fetch("HEAD", "/web-a/assurance/index.html")[0], 200)

    def test_it_serves_nothing_outside_design_systems_and_accepts_no_write(self):  # 0042 FR-025
        for path in ("/%2e%2e/spec-kit/outside.txt", "/web-a/../../spec-kit/outside.txt", "/web-a/.secret", "/%2e%2e%2fspec-kit%2foutside.txt",
                     "/nonesuch", "/web-a/"):
            self.assertEqual(self.c.fetch("GET", path)[0], 404, path)
        (self.root / "design-systems" / "link").symlink_to(self.root / "spec-kit")
        self.assertEqual(self.c.fetch("GET", "/link/outside.txt")[0], 404)  # a symbolic link out is not followed
        for method in ("POST", "PUT", "DELETE", "PATCH"):
            h = {"Datastar-Request": "true", "Origin": f"http://127.0.0.1:{self.c.port}"}
            self.assertEqual(self.c.fetch(method, "/web-a/assurance/data.json", h, {"a": ["b"]})[0], 405, method)
        self.assertEqual(self.c.fetch("GET", "/", {"Host": "example.test"})[0], 403)


class Commands(UiRepo):
    """`ui serve`, `open`, `stop` and `link` as processes in a clone of their own (0042 FR-023)."""

    def setUp(self):
        super().setUp()
        self.env = {**os.environ, "PYTHONPATH": str(self.root / "tools"), "DISPLAY": "", "WAYLAND_DISPLAY": "", "BROWSER": ""}
        self.procs: list[subprocess.Popen] = []
        self.addCleanup(self.reap)

    def reap(self):
        for p in self.procs:
            if p.poll() is None:
                p.kill()
                p.wait()
        for ui in ("console", "assurance"):
            st = state.read(self.root, Registry.load(self.root), ui)
            if st:
                os.kill(st["pid"], signal.SIGKILL)

    def agora(self, *argv: str, env=None):
        p = subprocess.run([sys.executable, "-m", "agora", *argv, "--json", "--no-log"], cwd=self.root, env=env or self.env, capture_output=True, text=True, timeout=60)
        return p.returncode, json.loads(p.stdout or p.stderr)

    def serve_proc(self, ui="console", *extra):
        p = subprocess.Popen([sys.executable, "-m", "agora", "ui", "serve", ui, "--json", "--no-log", *extra], cwd=self.root, env=self.env,
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        self.procs.append(p)
        first = json.loads(p.stdout.readline())
        return p, first

    def test_serve_link_stop(self):
        p, first = self.serve_proc()
        self.assertEqual((first["kind"], first["data"]["status"]), ("ui", "serving"))
        st = json.loads((self.root / ".agora/ui/console.json").read_text())
        self.assertEqual((st["pid"], st["port"], st["url"]), (p.pid, first["data"]["port"], f"http://127.0.0.1:{first['data']['port']}/"))
        self.assertEqual(urlopen_status(st["url"]), 200)
        code, doc = self.agora("ui", "link", "console")
        self.assertEqual((code, doc["data"]["url"]), (0, st["url"]))
        text = subprocess.run([sys.executable, "-m", "agora", "ui", "link", "console", "--no-log"], cwd=self.root, env=self.env, capture_output=True, text=True).stdout
        self.assertIn(st["url"], text)
        code, doc = self.agora("ui", "serve", "console")  # a second one for the clone is refused
        self.assertEqual((code, doc["data"]["code"]), (1, "running"))
        self.assertIn(st["url"], doc["data"]["message"])
        code, doc = self.agora("ui", "stop", "console")
        self.assertEqual((code, doc["data"]["status"]), (0, "stopped"))
        p.wait(timeout=10)
        self.assertFalse((self.root / ".agora/ui/console.json").exists())
        last = json.loads(p.stdout.read().strip().splitlines()[-1])
        self.assertEqual(last["data"]["status"], "stopped")
        code, doc = self.agora("ui", "stop", "console")
        self.assertEqual((code, doc["data"]["status"]), (0, "not running"))
        code, doc = self.agora("ui", "link", "console")
        self.assertEqual((code, doc["data"]["code"]), (1, "not-running"))
        self.assertEqual(doc["actions"][0]["cli"], "agora ui serve console")

    def test_it_listens_on_the_port_given_and_on_loopback_only(self):
        port = state.free_port()
        p, first = self.serve_proc("assurance", "--port", str(port))
        self.assertEqual(first["data"]["port"], port)
        self.assertTrue(first["data"]["url"].startswith("http://127.0.0.1:"))
        code, doc = self.agora("ui", "serve", "console", "--port", str(port))  # the port is taken
        self.assertEqual((code, doc["data"]["code"]), (1, "port"))
        self.assertFalse((self.root / ".agora/ui/console.json").exists())

    def test_a_stale_state_file_is_not_a_running_ui(self):
        d = self.root / ".agora/ui"
        d.mkdir(parents=True)
        dead = subprocess.Popen([sys.executable, "-c", "pass"])
        dead.wait()
        (d / "console.json").write_text(json.dumps({"ui": "console", "pid": dead.pid, "port": 1, "url": "http://127.0.0.1:1/"}))
        code, doc = self.agora("ui", "link", "console")
        self.assertEqual((code, doc["data"]["code"]), (1, "not-running"))
        self.assertFalse((d / "console.json").exists())

    def test_open_serves_in_the_background_and_prints_the_address_where_there_is_no_browser(self):
        code, doc = self.agora("ui", "open", "console")
        self.assertEqual(code, 0, doc)
        self.assertEqual((doc["data"]["status"], doc["data"]["opened"]), ("started", False))
        self.assertIn("no browser", doc["data"]["note"])
        url = doc["data"]["url"]
        self.assertEqual(urlopen_status(url), 200)  # it outlived the command
        code, doc2 = self.agora("ui", "open", "console")  # already running: no second one
        self.assertEqual((doc2["data"]["status"], doc2["data"]["pid"]), ("running", doc["data"]["pid"]))
        self.assertEqual(self.agora("ui", "stop", "console")[1]["data"]["status"], "stopped")
        time.sleep(0.2)
        with self.assertRaises(OSError):
            urlopen_status(url)

    def test_open_uses_a_browser_where_there_is_one(self):
        from agora.groups.core import commands as core
        reg = Registry.load(self.root)
        ctx = Ctx(reg, self.root, self.root, env={**os.environ, "DISPLAY": ":0", "PYTHONPATH": str(self.root / "tools")})
        with mock.patch.object(core.webbrowser, "open", return_value=True) as opened:
            res = core.ui_open(ctx, "assurance", None)
        try:
            self.assertEqual(res.data["opened"], True)
            opened.assert_called_once_with(res.data["url"])
        finally:
            core.ui_stop(ctx, "assurance")


def urlopen_status(url: str) -> int:
    import urllib.request
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    return opener.open(url, timeout=10).status


if __name__ == "__main__":
    unittest.main()
