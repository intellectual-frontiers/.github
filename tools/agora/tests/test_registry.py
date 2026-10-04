import unittest

from agora.core.registry import Command, Registry
from agora.core.types import Choice

from .helpers import HOME


def cmd(words: str, category: str = "read", group: str = "g", **kw) -> Command:
    return Command(tuple(words.split()), category, group=group, **kw)


class RegistryLoads(unittest.TestCase):
    def setUp(self):
        self.reg = Registry.load(HOME)

    def test_registry_is_valid(self):
        self.assertEqual(self.reg.validate(), [])
        self.assertEqual(self.reg.plan_conflicts(), [])

    def test_every_command_has_one_category_and_a_known_group(self):
        for c in self.reg.commands.values():
            self.assertIn(c.category, ("read", "check", "record", "build", "generate", "decision", "setup"))
            if c.status == "implemented":
                self.assertIn(c.group, self.reg.groups)
                self.assertTrue(callable(c.fn))

    def test_default_surfaces_follow_category(self):
        s = self.reg.surfaces_of
        self.assertEqual(s(self.reg.find("spec show")), ("ui", "mcp"))
        self.assertEqual(s(self.reg.find("spec set")), ("ui",))
        self.assertEqual(s(self.reg.find("lock")), ())

    def test_decisions_are_never_on_mcp(self):
        for c in self.reg.commands.values():
            if c.category == "decision":
                self.assertNotIn("mcp", self.reg.surfaces_of(c))

    def test_every_declared_section_is_implemented_or_planned(self):
        for s in self.reg.sections.values():
            self.assertTrue(s.status == "planned" or callable(s.fn), s.name)

    def test_spec_suite_runs_only_implemented_sections(self):
        for n in self.reg.suites["spec"]["sections"]:
            self.assertEqual(self.reg.sections[n].status, "implemented")

    def test_lookup_takes_the_longest_words(self):
        c, rest = self.reg.lookup(["spec", "show", "0020", "--json"])
        self.assertEqual((c.id, rest), ("spec show", ["0020", "--json"]))
        c, rest = self.reg.lookup(["check", "specs"])
        self.assertEqual((c.id, rest), ("check", ["specs"]))
        self.assertIsNone(self.reg.lookup(["nonsense"])[0])


class RegistryConflicts(unittest.TestCase):
    def reg(self) -> Registry:
        r = Registry()
        r.nouns.update({"a": "", "b": ""})
        return r

    def test_two_commands_with_one_name(self):
        r = self.reg()
        r.add_command(cmd("a list"))
        r.add_command(cmd("a list"))
        self.assertTrue(any("two commands with one name" in p for p in r.validate()))

    def test_a_command_in_two_groups(self):
        r = self.reg()
        r.add_command(cmd("a list", group="g1"))
        r.add_command(cmd("a list", group="g2"))
        self.assertTrue(any("a command in two groups" in p for p in r.validate()))

    def test_a_type_declared_twice_with_different_meanings(self):
        r = self.reg()
        r.add_type(Choice("KIND", ["x"]), "g1")
        r.add_type(Choice("KIND", ["y"]), "g2")
        self.assertTrue(any("declared twice with different meanings" in p for p in r.validate()))
        r2 = self.reg()
        r2.add_type(Choice("KIND", ["x"]), "g1")
        r2.add_type(Choice("KIND", ["x"]), "g2")
        self.assertEqual(r2.validate(), [])

    def test_grammar(self):
        r = self.reg()
        for c in (cmd("a frobnicate"), cmd("a check"), cmd("lonely"), cmd("a b c"), cmd("a list", "nonsense"),
                  cmd("b show", "decision", surfaces=("mcp",))):
            r.add_command(c)
        problems = "\n".join(r.validate())
        self.assertIn("'frobnicate' is not one of the fixed verbs", problems)
        self.assertIn("a check runs only through check", problems)
        self.assertIn("a command with no noun must be one of", problems)
        self.assertIn("is <noun> <verb> or one of the closed set", problems)
        self.assertIn("not one of read, check", problems)
        self.assertIn("decision command must not be exposed over MCP", problems)

    def test_ui_and_mcp_words(self):
        r = Registry()
        r.nouns.update({"ui": "", "mcp": ""})
        r.add_command(cmd("ui open", "setup"))
        r.add_command(cmd("ui frobnicate", "setup"))
        r.add_command(cmd("mcp serve", "setup"))
        problems = r.validate()
        self.assertEqual(len(problems), 1)
        self.assertIn("ui frobnicate", problems[0])

    def test_a_plan_needing_two_locks_in_one_process(self):
        from agora.core.registry import Group, Section
        from pathlib import Path
        r = Registry()
        for n in ("g1", "g2"):
            r.groups[n] = Group(n, "", Path("."), {"p": "1"})
            r.sections[n] = Section(n, group=n, status="implemented")
        r.suites["s"] = {"sections": ["g1", "g2"], "planned": []}
        self.assertTrue(r.plan_conflicts())
        r.sections["g2"].isolated = True
        self.assertEqual(r.plan_conflicts(), [])
