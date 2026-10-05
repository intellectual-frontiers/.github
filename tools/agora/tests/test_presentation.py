"""How the command line presents itself to an editor (0041-command-line FR-064, FR-072): views, noun icons, list-row fields, statuses,
palette titles and references, emitted in `command list` and checked by `check commands`."""
import copy
import os
import unittest

from agora.core import execute, presentation
from agora.core.registry import Registry

from .helpers import HOME, run_json


def loaded():
    return Registry.load(HOME)


class Emitted(unittest.TestCase):
    def setUp(self):
        _, self.doc = run_json(["command", "list"])
        self.p = self.doc["data"]["presentation"]

    def test_the_schema_version_is_unchanged_because_every_field_is_added(self):
        self.assertEqual(self.doc["schema"], "agora/command-list@1")

    def test_views_are_ordered_and_each_has_an_id_a_title_an_icon_and_an_order(self):
        views = self.p["views"]
        self.assertEqual([v["id"] for v in views], ["specs", "ontology", "design-systems", "builds", "proposals"])
        self.assertTrue(all({"id", "title", "icon", "order"} <= set(v) for v in views))
        self.assertEqual([v["order"] for v in views], sorted(v["order"] for v in views))

    def test_each_noun_has_an_icon_and_a_view_it_declares_and_a_list_names_fields_of_its_rows(self):
        ids = {v["id"] for v in self.p["views"]}
        nouns = {n["noun"]: n for n in self.p["nouns"]}
        for noun in {c["noun"] for c in self.doc["data"]["commands"] if c["noun"]}:
            self.assertIn("icon", nouns[noun], noun)
            self.assertIn(nouns[noun].get("view", next(iter(ids))), ids)
        spec = nouns["spec"]["list"]
        self.assertEqual((spec["command"], spec["rows"], spec["label"], spec["status"]), ("spec list", "specs", "name", "status"))
        self.assertEqual(spec["status_map"], {"Draft": "pending", "Adopted": "ok", "Superseded": "muted"})
        self.assertTrue(set(nouns["spec"]["list"]["status_map"].values()) <= set(presentation.STATUSES))
        self.assertEqual(nouns["spec"]["view"], "specs")
        self.assertEqual(nouns["brand"]["view"], "design-systems")
        self.assertEqual(nouns["deck"]["view"], "builds")

    def test_every_command_the_editor_offers_has_a_palette_title_in_the_list_and_in_show(self):
        for c in self.doc["data"]["commands"]:
            if "editor" in c["surfaces"]:
                self.assertTrue(c.get("title"), c["id"])
        _, shown = run_json(["command", "show", "spec set"])
        self.assertEqual(shown["data"]["title"], "Set Spec Status…")
        self.assertEqual(shown["data"]["icon"], "verified")

    def test_a_reference_names_a_pattern_files_and_the_fields_of_the_resource_it_shows(self):
        (ref,) = self.p["references"]
        self.assertEqual((ref["id"], ref["noun"], ref["value"]), ("requirement", "requirement", "$1/$2"))
        import re
        m = re.search(ref["pattern"], "see 0020 FR-013 and 0041-command-line FR-064")
        self.assertEqual(m.expand(r"\1/\2"), "0020/FR-013")
        _, doc = run_json(["requirement", "show", "0020/FR-013"])
        self.assertTrue({ref["text"], *ref["facts"], *ref["lens"], *ref["definition"]} <= set(doc["data"]))
        self.assertEqual(doc["data"]["path"], "spec-kit/specs/0020-spec-format/spec.md")
        self.assertIsInstance(doc["data"]["line"], int)
        self.assertEqual(doc["actions"][0]["command"], "check", "the check that enforces it can be run from the hover")


class Checked(unittest.TestCase):
    def test_this_repository_declares_nothing_invalid(self):
        self.assertEqual(loaded().validate(), [])

    def found(self, mutate):
        reg = loaded()
        mutate(reg)
        return " | ".join(presentation.problems(reg))

    def test_an_icon_that_is_not_a_codicon_a_view_nobody_declared_and_a_status_outside_the_vocabulary_are_found(self):
        def mutate(reg):
            reg.noun_meta["spec"]["icon"] = "not-a-codicon"
            reg.noun_meta["deck"]["view"] = "nowhere"
            reg.noun_meta["spec"]["list"] = {**reg.noun_meta["spec"]["list"], "status_map": {"Draft": "great"}}
        text = self.found(mutate)
        self.assertIn("icon 'not-a-codicon' is not a codicon", text)
        self.assertIn("view 'nowhere' is declared by no manifest", text)
        self.assertIn("'great'", text)

    def test_titles_are_a_verb_and_an_object_with_an_ellipsis_exactly_when_a_value_is_asked_for(self):
        def mutate(reg):
            reg.command_meta["spec show"]["title"] = "Show Spec"
            reg.command_meta["spec list"]["title"] = "List Specs…"
            reg.command_meta["ontology list"]["title"] = "list terms, please."
            del reg.command_meta["brand list"]["title"]
        text = self.found(mutate)
        self.assertIn("command spec show: the title 'Show Spec' needs an ellipsis", text)
        self.assertIn("command spec list: the title 'List Specs…' ends with an ellipsis though nothing is asked for", text)
        self.assertIn("command ontology list: the title", text)
        self.assertIn("command brand list: is offered to the editor and has no palette title", text)

    def test_a_list_that_needs_a_value_or_names_a_command_that_is_not_a_read_is_found(self):
        def mutate(reg):
            reg.noun_meta["imagery"]["list"] = {"command": "imagery list", "rows": "pieces", "id": "name", "label": "name"}
            reg.noun_meta["brand"]["list"] = {**reg.noun_meta["brand"]["list"], "command": "brand generate"}
        text = self.found(mutate)
        self.assertIn("imagery list asks for a value", text)
        self.assertIn("brand generate is not a read command", text)

    def test_a_reference_with_a_pattern_only_python_reads_or_a_group_it_lacks_is_found(self):
        def mutate(reg):
            reg.references["requirement"] = {**reg.references["requirement"], "pattern": "(?P<a>x)", "value": "$3"}
        text = self.found(mutate)
        self.assertIn("a form only Python reads", text)
        self.assertIn("names group 3", text)

    def test_a_field_that_is_not_in_the_rows_and_a_status_nothing_maps_are_found_against_the_data(self):
        reg = loaded()
        reg.noun_meta = copy.deepcopy(reg.noun_meta)
        reg.noun_meta["spec"]["list"]["label"] = "no-such-field"
        del reg.noun_meta["spec"]["list"]["status_map"]["Draft"]
        ctx = execute.new_ctx(reg, HOME, dict(os.environ), no_log=True)
        text = " | ".join(presentation.data_problems(ctx))
        self.assertIn("the field 'no-such-field' is absent from", text)
        self.assertIn("status 'Draft' of spec list is mapped to no status", text)

    def test_a_search_that_is_no_text_option_and_a_row_icon_that_is_no_codicon_are_found(self):
        def mutate(reg):
            reg.noun_meta["ontology"]["list"] = {**reg.noun_meta["ontology"]["list"], "search": "kind"}
        self.assertIn("search 'kind' is not an option of ontology list that takes text", self.found(mutate))
        reg = loaded()
        reg.noun_meta = copy.deepcopy(reg.noun_meta)
        reg.noun_meta["ontology"]["list"]["icon"] = "label"   # a field whose values are labels, not codicon ids
        ctx = execute.new_ctx(reg, HOME, dict(os.environ), no_log=True)
        self.assertIn("is not a codicon id of the glyph map", " | ".join(presentation.data_problems(ctx)))

    def test_the_ontology_noun_declares_its_icon_field_and_its_search_option(self):
        _, doc = run_json(["command", "list"])
        noun = next(n for n in doc["data"]["presentation"]["nouns"] if n["noun"] == "ontology")
        self.assertEqual((noun["view"], noun["list"]["icon"], noun["list"]["search"]), ("ontology", "icon", "match"))

    def test_the_codicon_list_is_the_glyph_map_of_the_pinned_package(self):
        icons = presentation.codicons()
        self.assertTrue({"book", "pass", "error", "warning", "git-pull-request", "plus"} <= icons)
        self.assertGreater(len(icons), 500)


if __name__ == "__main__":
    unittest.main()
