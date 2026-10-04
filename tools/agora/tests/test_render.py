import html
import json
import re
import unittest

from agora.core import render
from agora.core.cli import main
from agora.core.ctx import Ctx
from agora.core.registry import Registry
from agora.core.resource import Action, AgoraError, Call, Link, Resource

from .helpers import HOME, run


def leaves(v):
    if isinstance(v, dict):
        for x in v.values():
            yield from leaves(x)
    elif isinstance(v, list):
        for x in v:
            yield from leaves(x)
    elif isinstance(v, str) and v:
        yield v
    elif isinstance(v, (int, float)) and not isinstance(v, bool):
        yield str(v)


class ThreeRenderings(unittest.TestCase):
    def setUp(self):
        self.reg = Registry.load(HOME)
        self.ctx = Ctx(self.reg, HOME, HOME)

    def resource(self, argv):
        code, out, _ = run([*argv, "--json"])
        return json.loads(out)

    def test_json_carries_the_schema_and_audience(self):
        for argv in (["command", "show", "check"], ["term", "show", "ReadCommandCategory"], ["environment", "show"]):
            with self.subTest(argv=argv):
                d = self.resource(argv)
                self.assertEqual(sorted(d), ["actions", "audience", "data", "id", "kind", "links", "schema"])
                self.assertEqual(d["schema"], f"agora/{d['kind']}@1")
                self.assertEqual(d["audience"], "public")

    def test_text_and_html_say_what_json_says(self):
        for argv in (["term", "show", "ReadCommandCategory"], ["environment", "show"], ["command", "show", "spec show"],
                     ["requirement", "show", "0020/FR-013"]):
            with self.subTest(argv=argv):
                d = self.resource(argv)
                res = Resource(d["kind"], d["id"], d["data"])
                _, text, _ = run(argv)
                page = render.to_html(res, self.ctx)
                for leaf in leaves(d["data"]):
                    self.assertIn(html.escape(leaf), page)
                    if len(leaf) < 200:
                        self.assertIn(leaf, text)
                self.assertIn("audience: public", text)
                self.assertIn('data-audience="public"', page)

    def test_nothing_appears_in_text_that_the_resource_lacks(self):
        res = Resource("t", "x", {"a": "one", "b": [{"c": "two"}]})
        text = render.to_text(res, self.ctx)
        self.assertEqual(sorted(set(re.findall(r"[a-z]+", text)) - {"t", "x", "audience", "public"}), ["a", "b", "c", "one", "two"])

    def test_html_escapes(self):
        res = Resource("t", "<x>", {"a": "<script>alert(1)</script>"})
        page = render.to_html(res, self.ctx)
        self.assertNotIn("<script>", page)
        self.assertIn("&lt;script&gt;", page)

    def test_html_page_has_no_remote_reference_or_script(self):
        page = render.to_html_page(Resource("t", "x", {"a": 1}), self.ctx)
        self.assertNotIn("http", page)
        self.assertNotIn("<script", page)

    def test_html_flag(self):
        code, out, _ = run(["environment", "show", "--html"])
        self.assertEqual(code, 0)
        self.assertTrue(out.startswith("<!doctype html>"))

    def test_links_and_actions_generate_their_command_lines(self):
        res = Resource("t", "x", links=[Link("spec", Call("spec show", {"spec": "0020-spec-format"}))],
                       actions=[Action("set it", Call("requirement set", {"requirement": "0020-spec-format/FR-001",
                                                                           "mechanism": "none", "by": "-", "note": "a b"}))])
        d = res.to_dict(self.reg)
        self.assertEqual(d["links"][0]["cli"], "agora spec show 0020-spec-format")
        a = d["actions"][0]
        self.assertEqual(a["cli"], "agora requirement set 0020-spec-format/FR-001 --mechanism none --by - --note 'a b'")
        self.assertEqual((a["category"], a["surfaces"]), ("record", ["ui", "mcp"]))

    def test_a_disabled_action_says_why(self):
        res = Resource("t", "x", actions=[Action("go", Call("check"), enabled=False, reason="nothing changed")])
        a = res.to_dict(self.reg)["actions"][0]
        self.assertEqual((a["enabled"], a["reason"]), (False, "nothing changed"))
        self.assertIn("disabled: nothing changed", render.to_text(res, self.ctx))

    def test_errors_are_resources_in_all_three_renderings(self):
        e = AgoraError("boom", "it broke", actions=[Action("see", Call("command list"))]).resource()
        d = e.to_dict(self.reg)
        self.assertEqual((d["kind"], d["data"]["code"], d["data"]["message"]), ("error", "boom", "it broke"))
        self.assertIn("it broke", render.to_text(e, self.ctx))
        self.assertIn("it broke", render.to_html(e, self.ctx))
        self.assertTrue(d["actions"])

    def test_text_errors_go_to_stderr_and_json_to_stdout(self):
        code, out, err = run(["spec", "show", "99"])
        self.assertEqual((out, "invalid-argument" in err), ("", True))
        code, out, err = run(["spec", "show", "99", "--json"])
        self.assertEqual(json.loads(out)["kind"], "error")

    def test_relocated_output_is_unstated(self):
        code, out, _ = run(["spec", "list", "--root", str(HOME / "design-systems"), "--json"])
        self.assertEqual(json.loads(out)["audience"], "unstated")
        code, out, _ = run(["spec", "list", "--root", str(HOME), "--json"])
        self.assertEqual(json.loads(out)["audience"], "public")
        _, text, _ = run(["spec", "list", "--root", str(HOME / "design-systems")])
        self.assertIn("audience: unstated", text)

    def test_long_lists_are_cut_in_text_not_in_json(self):
        _, text, _ = run(["requirement", "list"])
        self.assertIn("more (--json has all)", text)
        _, out, _ = run(["requirement", "list", "--json"])
        self.assertGreater(len(json.loads(out)["data"]["requirements"]), render.TEXT_ROWS)
