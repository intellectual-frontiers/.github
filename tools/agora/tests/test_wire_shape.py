"""The wire shape the editor reads (0041-command-line FR-064): `command list|show`, actions, links and check data; and the
declaration the editor finds this repository's launcher by (0042-agora FR-032)."""
import unittest

from agora.core.resource import Action, Call, Resource
from agora.core.registry import Registry

from .helpers import HOME, run_json


class WireShape(unittest.TestCase):
    def test_command_list_rows_carry_id_category_group_surfaces_and_help(self):
        _, doc = run_json(["command", "list"])
        self.assertEqual(doc["schema"], "agora/command-list@1")
        for c in doc["data"]["commands"]:
            self.assertTrue({"id", "category", "group", "surfaces", "help"} <= set(c), c)
            self.assertIn("terminal", c["surfaces"])

    def test_command_show_carries_every_field_the_editor_reads(self):
        _, doc = run_json(["command", "show", "spec set"])
        d = doc["data"]
        for key in ("id", "noun", "verb", "category", "help", "group", "arguments", "options", "usage", "surfaces", "programs"):
            self.assertIn(key, d)
        self.assertTrue({"name", "type", "help", "required", "words", "many"} <= set(d["arguments"][0]))
        status = next(o for o in d["options"] if o["flag"] == "--status")
        self.assertTrue({"flag", "type", "help", "multiple", "required"} <= set(status))
        self.assertEqual(status["choices"], ["Draft", "Adopted", "Superseded"])

    def test_zero_or_more_arguments_are_not_required_and_a_type_with_many_values_lists_none_inline(self):
        _, doc = run_json(["command", "show", "check"])
        sections = doc["data"]["arguments"][0]
        self.assertEqual((sections["many"], sections["required"]), (True, False))
        _, doc = run_json(["command", "show", "spec show"])
        self.assertNotIn("choices", doc["data"]["arguments"][0])  # some fifty specs: the editor asks `spec list`

    def test_an_action_that_needs_a_value_has_no_pasteable_line_and_names_what_it_needs(self):
        reg = Registry.load(HOME)
        full = Resource("x", "x", actions=[Action("a", Call("spec set", {"spec": "0043-if-console", "status": "Adopted"})),
                                           Action("b", Call("spec set", {"spec": "0043-if-console"}))]).to_dict(reg)
        a, b = full["actions"]
        self.assertIn("cli", a)
        self.assertNotIn("needs", a)
        self.assertIsNone(b["cli"])
        self.assertEqual(b["needs"], ["status"])
        for key in ("label", "command", "fields", "category", "surfaces", "enabled"):
            self.assertIn(key, a)

    def test_a_link_has_rel_command_fields_and_cli(self):
        _, doc = run_json(["command", "list"])
        self.assertTrue(all({"rel", "command", "fields", "cli"} <= set(l) for l in doc["links"]))

    def test_check_data_has_status_summary_and_sections_with_findings_that_say_what_next(self):
        _, doc = run_json(["check", "commands"])
        d = doc["data"]
        self.assertTrue({"status", "summary", "sections"} <= set(d))
        self.assertTrue({"run", "passed", "failed", "skipped"} <= set(d["summary"]))
        self.assertTrue({"name", "status", "findings"} <= set(d["sections"][0]))

    def test_a_dry_run_carries_the_whole_unified_diff_per_file(self):
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "x.def"
            out.write_text("\n".join(f"line {i}" for i in range(400)) + "\n")
            _, doc = run_json(["layout", "build", "two-column", "--out", str(out), "--dry-run"])
        change = doc["data"]["changes"][0]
        self.assertGreater(len(change["diff"]), 60)
        self.assertFalse(any("more lines" in l for l in change["diff"]))

    def test_the_declaration_names_the_launcher_and_toolchain_add_is_offered_to_the_editor(self):
        self.assertIn("IF_CONSOLE_LAUNCHER=./agora", (HOME / ".if-console.env").read_text().splitlines())
        _, doc = run_json(["command", "list"])
        row = next(c for c in doc["data"]["commands"] if c["id"] == "toolchain add")
        self.assertIn("editor", row["surfaces"])
        self.assertNotIn("mcp", row["surfaces"])


if __name__ == "__main__":
    unittest.main()
