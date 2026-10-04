import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from agora.core import plan
from agora.core.registry import Group, Registry
from agora.core.resource import AgoraError

from .helpers import HOME


class Plans(unittest.TestCase):
    def test_groups_without_packages_run_on_the_standard_library(self):
        reg = Registry.load(HOME)
        for g in reg.groups:
            p = plan.plan_for(reg, g)
            self.assertEqual(p.stdlib, not reg.groups[g].packages, g)
            self.assertEqual(p.lock is None, p.stdlib)
        for g in ("core", "spec"):
            self.assertTrue(plan.plan_for(reg, g).stdlib, g)

    def test_the_spec_suite_groups_pin_nothing(self):  # 0042 FR-018
        reg = Registry.load(HOME)
        for n in reg.suites["spec"]["sections"]:
            self.assertEqual(reg.groups[reg.sections[n].group].packages, {})

    def test_the_stamp_is_stable_and_follows_the_pins(self):
        a = plan.pins_stamp({"six": "1.16.0", "Idna": "3.7"})
        self.assertEqual(a, plan.pins_stamp({"idna": "3.7", "six": "1.16.0"}))
        self.assertNotEqual(a, plan.pins_stamp({"six": "1.16.1", "idna": "3.7"}))


class Locks(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dir = Path(self.tmp.name)

    def group(self, packages):
        return Group("g", "", self.dir, packages)

    def lock(self, packages, body, stamp=None):
        (self.dir / "agora.lock").write_text(f"{plan.STAMP}{stamp or plan.pins_stamp(packages)}\n{body}", encoding="utf-8")

    GOOD = "six==1.16.0 \\\n    --hash=sha256:" + "a" * 64 + "\n"

    def test_a_matching_lock_has_no_problem(self):
        self.lock({"six": "1.16.0"}, self.GOOD)
        self.assertEqual(plan.lock_problems(self.group({"six": "1.16.0"})), [])

    def test_a_pin_without_a_lock(self):
        self.assertIn("has no lock", plan.lock_problems(self.group({"six": "1.16.0"}))[0])

    def test_a_lock_that_does_not_match_the_pins(self):
        self.lock({"six": "1.16.0"}, self.GOOD)
        problems = plan.lock_problems(self.group({"six": "1.17.0"}))
        self.assertTrue(any("does not match its manifest's pins" in p for p in problems))
        self.assertTrue(any("pins six==1.17.0; its lock has 1.16.0" in p for p in problems))

    def test_a_distribution_without_a_hash(self):
        self.lock({"six": "1.16.0"}, "six==1.16.0\n")
        self.assertTrue(any("no hash for six" in p for p in plan.lock_problems(self.group({"six": "1.16.0"}))))

    def test_a_lock_for_a_group_that_pins_nothing(self):
        (self.dir / "agora.lock").write_text("x")
        self.assertTrue(plan.lock_problems(self.group({})))

    @unittest.skipUnless(shutil.which("uv"), "uv is not installed")
    def test_offline_with_a_cold_cache_names_the_package_group_and_command(self):
        packages = {"six": "1.16.0"}
        self.lock(packages, self.GOOD)
        reg = Registry()
        reg.groups["g"] = self.group(packages)
        old = os.environ.get("UV_CACHE_DIR")
        os.environ["UV_CACHE_DIR"] = str(self.dir / "cold-cache")
        try:
            with self.assertRaises(AgoraError) as cm:
                plan.prepare(reg, "g", offline=True, command="x show")
        finally:
            os.environ.pop("UV_CACHE_DIR") if old is None else os.environ.__setitem__("UV_CACHE_DIR", old)
        e = cm.exception
        self.assertEqual((e.code, e.exit), ("offline", 3))
        self.assertIn("six==1.16.0", e.message)
        self.assertIn("group g", e.message)
        self.assertIn("x show", e.message)

    def test_a_mismatched_lock_stops_the_plan(self):
        packages = {"six": "1.16.0"}
        self.lock(packages, self.GOOD, stamp="sha256:wrong")
        reg = Registry()
        reg.groups["g"] = self.group(packages)
        with self.assertRaises(AgoraError) as cm:
            plan.prepare(reg, "g", offline=False, command="x show")
        self.assertEqual((cm.exception.code, cm.exception.exit), ("lock", 3))


class Core(unittest.TestCase):
    def test_the_core_uses_only_the_standard_library(self):  # 0041 FR-005
        import ast
        stdlib = set(sys.stdlib_module_names)
        for sub in ("core", "lib", "groups"):
            for f in (HOME / "tools" / "agora" / sub).rglob("*.py"):
                tree = ast.parse(f.read_text())
                # a package a group pins is imported only inside the function that uses it, never by the core (FR-005)
                lazy = {id(n) for fn in ast.walk(tree) if isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef))
                        for n in ast.walk(fn)} if sub != "core" else set()
                for node in ast.walk(tree):
                    mods = [a.name for a in node.names] if isinstance(node, ast.Import) else \
                           [node.module] if isinstance(node, ast.ImportFrom) and node.level == 0 and node.module else []
                    for m in mods:
                        top = m.split(".")[0]
                        self.assertTrue(top in stdlib or top == "agora" or id(node) in lazy, f"{f}: imports {m}")

    def test_the_core_runs_with_no_package_installed(self):
        p = subprocess.run([sys.executable, "-S", "-m", "agora", "command", "list", "--json"], capture_output=True, text=True,
                           env={"PYTHONPATH": str(HOME / "tools"), "PATH": os.environ["PATH"]}, cwd=HOME)
        self.assertEqual(p.returncode, 0, p.stderr)
