import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from agora.core import pins, plan
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
    """`uv.lock` and the dependency groups of `pyproject.toml` (0025-tooling-environment FR-013; 0041-command-line FR-002, FR-003, FR-029)."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dir = Path(self.tmp.name)

    def group(self, packages):
        return Group("g", "", self.dir, packages)

    HASH = "sha256:" + "a" * 64

    def lock(self, packages, *, hashed=True, written_from=None, root=True):
        """A uv.lock holding these packages, as uv writes it: each with a sdist and a wheel, and the project's own entry naming the groups it was written from."""
        h = f', hash = "{self.HASH}"' if hashed else ""
        text = 'version = 1\nrequires-python = ">=3.14"\n'
        for name, ver in packages.items():
            text += (f'\n[[package]]\nname = "{name.lower()}"\nversion = "{ver}"\nsource = {{ registry = "https://pypi.org/simple" }}\n'
                     f'sdist = {{ url = "https://example.org/{name}-{ver}.tar.gz"{h} }}\n'
                     f'wheels = [{{ url = "https://example.org/{name}-{ver}-py3-none-any.whl"{h} }}]\n')
        if root:
            from_ = packages if written_from is None else written_from
            text += ('\n[[package]]\nname = "t-env"\nversion = "0"\nsource = { virtual = "." }\n\n[package.dev-dependencies]\n'
                     'g = [' + ", ".join(f'{{ name = "{n.lower()}" }}' for n in packages) + ']\n\n[package.metadata]\n\n[package.metadata.requires-dev]\n'
                     'g = [' + ", ".join(f'{{ name = "{n.lower()}", specifier = "=={v}" }}' for n, v in from_.items()) + "]\n")
        (self.dir / "uv.lock").write_text(text, encoding="utf-8")

    def test_a_matching_lock_has_no_problem(self):
        self.lock({"six": "1.16.0"})
        self.assertEqual(plan.lock_problems(self.group({"six": "1.16.0"})), [])

    def test_a_pin_without_a_lock(self):
        self.assertIn("no uv.lock", plan.lock_problems(self.group({"six": "1.16.0"}))[0])

    def test_a_package_locked_at_another_version(self):
        self.lock({"six": "1.16.0"})
        problems = plan.lock_problems(self.group({"six": "1.17.0"}))
        self.assertTrue(any("pins six==1.17.0; uv.lock has 1.16.0" in p for p in problems))

    def test_a_package_the_lock_lacks(self):
        self.lock({"idna": "3.7"})
        self.assertTrue(any("uv.lock has nothing" in p for p in plan.lock_problems(self.group({"six": "1.16.0"}))))

    def test_a_distribution_without_a_hash(self):
        self.lock({"six": "1.16.0"}, hashed=False)
        self.assertTrue(any("no hash for every file of six" in p for p in plan.lock_problems(self.group({"six": "1.16.0"}))))

    def test_a_lock_written_from_other_pins_than_pyproject_now_has(self):
        self.lock({"six": "1.16.0"}, written_from={"six": "1.15.0"})
        self.assertTrue(any("written from other pins" in p for p in plan.lock_problems(self.group({"six": "1.16.0"}))))

    def test_a_group_that_pins_nothing_has_no_problem_whatever_the_lock_holds(self):
        (self.dir / "uv.lock").write_text("x")
        self.assertEqual(plan.lock_problems(self.group({})), [])

    def test_a_lock_that_is_not_toml(self):
        (self.dir / "uv.lock").write_text("not [ toml")
        self.assertTrue(any("cannot be read" in p for p in plan.lock_problems(self.group({"six": "1.16.0"}))))

    def project(self):
        (self.dir / "pyproject.toml").write_text('[project]\nname = "t-env"\nversion = "0"\nrequires-python = ">=3.14"\ndependencies = []\n'
                                                 '[tool.uv]\npackage = false\n[dependency-groups]\ng = ["six==1.16.0"]\n')

    @unittest.skipUnless(shutil.which("uv"), "uv is not installed")
    def test_offline_with_a_cold_cache_names_the_package_group_and_command(self):
        packages = {"six": "1.16.0"}
        self.project()
        self.lock(packages)
        reg = Registry(self.dir)
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
        self.lock(packages, written_from={"six": "1.15.0"})
        reg = Registry(self.dir)
        reg.groups["g"] = self.group(packages)
        with self.assertRaises(AgoraError) as cm:
            plan.prepare(reg, "g", offline=False, command="x show")
        self.assertEqual((cm.exception.code, cm.exception.exit), ("lock", 3))


class Pins(unittest.TestCase):
    """The pins are the dependency groups of pyproject.toml (core/pins.py)."""

    def home(self, text):
        d = tempfile.TemporaryDirectory()
        self.addCleanup(d.cleanup)
        (Path(d.name) / "pyproject.toml").write_text(text)
        return Path(d.name)

    def test_exact_pins_and_included_groups(self):
        home = self.home('[dependency-groups]\na = ["Six==1.16.0"]\nb = ["idna==3.7", {include-group = "a"}]\n')
        self.assertEqual(pins.dependency_pins(home), {"a": {"Six": "1.16.0"}, "b": {"idna": "3.7", "Six": "1.16.0"}})
        self.assertEqual(pins.pin_problems(home, {"a", "b"}), [])

    def test_a_range_is_not_a_pin(self):
        home = self.home('[dependency-groups]\na = ["six>=1"]\n')
        self.assertTrue(any("not pinned to one exact version" in p for p in pins.pin_problems(home, {"a"})))

    def test_a_group_no_command_group_has_is_a_problem(self):
        home = self.home('[dependency-groups]\nzzz = ["six==1.16.0"]\n')
        self.assertTrue(any("no command group has that name" in p for p in pins.pin_problems(home, {"a"})))

    def test_a_cycle_and_a_missing_include_are_problems_not_crashes(self):
        home = self.home('[dependency-groups]\na = [{include-group = "b"}]\nb = [{include-group = "a"}, {include-group = "nope"}]\n')
        problems = pins.pin_problems(home, {"a", "b"})
        self.assertTrue(any("includes it" in p for p in problems))
        self.assertTrue(any("does not declare" in p for p in problems))

    def test_no_pyproject_pins_nothing(self):
        self.assertEqual(pins.dependency_pins(Path(tempfile.gettempdir()) / "nowhere"), {})

    def test_this_repository_pins_each_group_the_registry_says(self):
        reg = Registry.load(HOME)
        self.assertEqual(pins.pin_problems(HOME, set(reg.groups)), [])
        self.assertEqual(reg.groups["vcs"].packages, {"dulwich": "1.2.17"})
        self.assertEqual(set(reg.groups["selftest"].packages), set().union(*(reg.groups[g].packages for g in ("assurance", "decoration", "items", "vcs", "brand"))))


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
