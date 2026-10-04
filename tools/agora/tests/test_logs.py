import json
import shutil
import tempfile
import unittest
from pathlib import Path

from agora.core.cli import main
from agora.core.registry import Arg, Command, Opt, Registry
from agora.core.resource import Resource

from .helpers import HOME


class Logs(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.home = Path(self.tmp.name)
        shutil.copytree(HOME / "tools" / "agora", self.home / "tools" / "agora", ignore=shutil.ignore_patterns("__pycache__", "tests"))
        shutil.copytree(HOME / "ontology", self.home / "ontology")

    def lines(self):
        files = list((self.home / ".agora" / "logs").glob("*.ndjson"))
        return [json.loads(l) for f in files for l in f.read_text().splitlines()]

    def call(self, *argv, **kw):
        import io
        return main(list(argv), home=self.home, stdout=io.StringIO(), stderr=io.StringIO(), env={"PATH": "/usr/bin"}, **kw)

    def test_a_run_is_logged_with_surface_command_args_and_exit(self):
        self.call("spec", "show", "0020", "--root", str(HOME))
        self.call("spec", "show", "99")
        a, b = self.lines()
        self.assertEqual((a["surface"], a["command"], a["exit"]), ("cli", "spec show", 0))
        self.assertEqual(a["args"]["spec"], "0020-spec-format")
        self.assertEqual((b["command"], b["exit"], b["args"]), ("spec show", 2, {}))
        self.assertIn("time", a)

    def test_a_dry_run_is_logged_as_one(self):
        self.call("spec", "new", "demo", "--dry-run")
        line = self.lines()[-1]
        self.assertEqual((line["command"], line["dry_run"]), ("spec new", True))

    def test_a_value_marked_unlogged_never_reaches_the_log(self):
        reg = Registry.load(self.home)
        reg.add_command(Command(("spec", "status"), "read", group="spec", args=(Arg("spec", "TEXT"),),
                                options=(Opt("--who", "TEXT", log=False), Opt("--what", "TEXT")),
                                fn=lambda ctx, spec, who, what: Resource("x", "y")))
        self.call("spec", "status", "0020", "--who", "A Person", "--what", "thing", registry=reg)
        line = self.lines()[-1]
        self.assertNotIn("A Person", json.dumps(line))
        self.assertEqual(line["args"]["what"], "thing")

    def test_no_log_writes_nothing(self):
        self.call("doctor", "--no-log")
        self.assertEqual(self.lines(), [])

    def test_the_log_directory_is_gitignored(self):
        self.assertIn(".agora/logs/", (HOME / ".gitignore").read_text())
        self.assertEqual(Registry.load(HOME).root_manifest["logs"], ".agora/logs")

    def test_a_failure_to_log_never_fails_the_command(self):
        (self.home / ".agora").write_text("a file where a directory belongs")
        self.assertEqual(self.call("environment", "show"), 0)


class Hygiene(unittest.TestCase):
    def test_agora_names_no_other_repository(self):  # 0042 FR-003: the names come from the register, as data
        import re
        from agora.lib.register import known_repositories
        names = known_repositories(HOME) - {Registry.load(HOME).root_manifest["register_name"]}
        self.assertTrue(names)
        bad = re.compile("|".join(rf"(?<![\w./-]){re.escape(n)}(?![\w-])" for n in names) + r"|\b" + "vau" + r"lt\b", re.I)
        files = [HOME / "agora"] + [f for f in (HOME / "tools" / "agora").rglob("*") if f.is_file() and f.suffix in (".py", ".toml", "")]
        for f in files:
            if "__pycache__" not in f.parts:
                for n, line in enumerate(f.read_text().splitlines(), 1):
                    self.assertIsNone(bad.search(line), f"{f}:{n}: {line}")
