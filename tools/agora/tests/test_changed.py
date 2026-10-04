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
