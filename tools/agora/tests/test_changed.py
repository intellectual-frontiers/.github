import shutil
import subprocess
import unittest

from agora.core.checks import glob_regex, section_changed
from agora.core.registry import Registry

from .helpers import HOME, TempRepo, run_json


class Globs(unittest.TestCase):
    def test_globs(self):
        m = lambda g, p: bool(glob_regex(g).match(p))
        self.assertTrue(m("spec-kit/specs/**", "spec-kit/specs/0001-a/spec.md"))
        self.assertTrue(m("design-systems/*/spec.md", "design-systems/x-web/spec.md"))
        self.assertFalse(m("design-systems/*/spec.md", "design-systems/x-web/sub/spec.md"))
        self.assertTrue(m("tools/**/x.py", "tools/x.py"))
        self.assertFalse(m("agora", "tools/agora"))
        self.assertTrue(m("agora", "agora"))

    def test_a_section_without_watched_paths_always_runs(self):
        self.assertEqual(section_changed((), []), (True, "declares no watched paths"))
        self.assertFalse(section_changed(("a/**",), ["b/x"])[0])
        self.assertTrue(section_changed(("a/**",), ["a/x"])[0])


@unittest.skipUnless(shutil.which("git"), "git is not installed")
class Changed(TempRepo):
    def git(self, *args):
        subprocess.run(["git", "-C", str(self.root), "-c", "user.name=t", "-c", "user.email=t@t", *args], check=True,
                       capture_output=True)

    def setUp(self):
        super().setUp()
        self.git("init", "-q")
        self.git("add", "-A")
        self.git("commit", "-q", "-m", "first")

    def ran(self, *extra):
        code, doc = run_json(["check", "specs", "register", "controls", "ontology", "environment", "--changed", "--root",
                              str(self.root), *extra])
        return code, [s["name"] for s in doc["data"]["sections"]], doc["data"]["skipped_unchanged"]

    def test_nothing_changed_runs_nothing_and_lists_each_skip_with_its_reason(self):
        code, ran, skipped = self.ran()
        self.assertEqual((code, ran), (0, []))
        self.assertEqual(sorted(s["name"] for s in skipped), ["controls", "environment", "ontology", "register", "specs"])
        self.assertTrue(all(s["reason"] == "no watched path changed" for s in skipped))

    def test_a_changed_file_runs_the_sections_that_watch_it(self):
        self.write("tools/reference-environment", "github:o/r/" + "a" * 40 + "\n# x\n")
        _, ran, skipped = self.ran()
        self.assertEqual(ran, ["environment"])
        self.assertIn("specs", [s["name"] for s in skipped])

    def test_untracked_files_count_as_changes(self):
        self.write("spec-kit/specs/0002-new/spec.md", "x")
        _, ran, _ = self.ran()
        self.assertEqual(ran, ["specs", "register", "controls"])

    def test_staged_changes_count(self):
        self.write("ontology/x.ttl", "# x\n")
        self.git("add", "ontology/x.ttl")
        _, ran, _ = self.ran()
        self.assertEqual(ran, ["ontology"])

    def test_since_adds_what_differs_from_a_commit(self):
        self.write("ontology/x.ttl", "# x\n")
        self.git("add", "-A")
        self.git("commit", "-q", "-m", "second")
        self.assertEqual(self.ran()[1], [])
        self.assertEqual(self.ran("--since", "HEAD~1")[1], ["ontology"])


class Isolation(TempRepo):
    def test_an_isolated_section_runs_in_its_own_worker(self):
        reg = Registry.load(HOME)
        reg.sections["environment"].isolated = True
        code, doc = run_json(["check", "environment", "specs", "--root", str(self.root)], registry=reg)
        self.assertEqual(code, 0, doc)
        self.assertEqual([s["name"] for s in doc["data"]["sections"]], ["environment", "specs"])
        self.write("tools/reference-environment", "bad\n")
        code, doc = run_json(["check", "environment", "--root", str(self.root)], registry=reg)
        self.assertEqual((code, doc["data"]["sections"][0]["status"]), (1, "failed"))


class EveryDeclaration(unittest.TestCase):
    """0041 FR-032: every section and generator declares watched paths, each pattern matches a file, and `--changed` runs
    exactly the sections and generators whose paths a change touches."""

    @classmethod
    def setUpClass(cls):
        from agora.lib.layout import repository_files
        cls.reg = Registry.load(HOME)
        cls.files = repository_files(HOME)

    def declared(self):
        return [(f"section {s.name}", s.watch) for s in self.reg.sections.values()] + \
               [(f"generator {g.name}", g.watch) for g in self.reg.generators.values()]

    def test_every_section_and_generator_declares_watched_paths_that_match_files(self):
        for what, watch in self.declared():
            with self.subTest(what=what):
                self.assertTrue(watch, "declares no watched paths")
                for pat in watch:
                    if pat.startswith(".agora/"):
                        continue  # untracked state or proposals not yet drafted
                    self.assertTrue(any(glob_regex(pat).match(f) for f in self.files), f"{pat} matches no file")

    def test_a_change_to_a_watched_file_runs_the_section_and_an_unrelated_one_does_not(self):
        for what, watch in self.declared():
            with self.subTest(what=what):
                hit = next(f for pat in watch if not pat.startswith(".agora/") for f in self.files if glob_regex(pat).match(f))
                self.assertTrue(section_changed(watch, [hit])[0])
                self.assertFalse(section_changed(watch, ["zzz/unrelated.txt"])[0])

    def test_check_changed_runs_exactly_the_sections_a_changed_file_touches(self):
        from unittest import mock
        from agora.core.checks import SectionResult
        reg = Registry.load(HOME)
        ran: list[str] = []
        for n, s in reg.sections.items():
            s.fn = lambda ctx, scope, n=n: (ran.append(n), SectionResult(n))[1]
            s.programs = ()
        for n, s in reg.sections.items():
            hit = next(f for pat in s.watch if not pat.startswith(".agora/") for f in self.files if glob_regex(pat).match(f))
            want = [x for x in reg.sections if section_changed(reg.sections[x].watch, [hit])[0]]
            del ran[:]
            with mock.patch("agora.core.runner.changed_paths", return_value=[hit]), \
                    mock.patch("agora.core.worker.needs_worker", return_value=False):
                code, doc = run_json(["check", "--changed"], registry=reg)
            self.assertEqual(ran, want, n)
            self.assertIn(n, ran)
            self.assertEqual(sorted(x["name"] for x in doc["data"]["skipped_unchanged"]), sorted(set(reg.sections) - set(want)))
            self.assertTrue(all(x["reason"] == "no watched path changed" for x in doc["data"]["skipped_unchanged"]))

    def test_fresh_changed_proves_only_generators_whose_paths_changed(self):
        from unittest import mock
        reg = Registry.load(HOME)
        proved: list[str] = []
        from agora.core.generate import Generated
        for n, g in reg.generators.items():
            g.fn = lambda ctx, scope, n=n: (proved.append(n), Generated())[1]
            g.programs = ()
        for n, g in reg.generators.items():
            hit = next(f for pat in g.watch for f in self.files if glob_regex(pat).match(f))
            want = [x for x in reg.generators if section_changed(reg.generators[x].watch, [hit])[0]]
            del proved[:]
            with mock.patch("agora.groups.core.commands.changed_paths", return_value=[hit]), \
                    mock.patch("agora.core.generate.needs_worker", return_value=False):
                code, doc = run_json(["fresh", "--changed"], registry=reg)
            self.assertEqual(proved, want, n)
            self.assertIn(n, proved)
