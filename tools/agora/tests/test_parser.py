import json
import unittest

from agora.core.cli import split_globals
from agora.core.registry import Arg, Command, Opt, Registry
from agora.core.resource import Resource

from .helpers import HOME, run, run_json


class Parser(unittest.TestCase):
    def test_globals_may_stand_anywhere(self):
        rest, g = split_globals(["--json", "spec", "show", "--root", "/x", "0020", "--dry-run", "--offline"])
        self.assertEqual(rest, ["spec", "show", "0020"])
        self.assertTrue(g["json"] and g["dry_run"] and g["offline"])
        self.assertEqual(g["root"], "/x")

    def test_the_id_is_the_first_positional(self):
        code, doc = run_json(["spec", "show", "0020"])
        self.assertEqual((code, doc["id"]), (0, "0020-spec-format"))

    def test_options_before_or_after_the_id(self):
        a = run_json(["requirement", "list", "--spec", "0020", "--mechanism", "none"])
        b = run_json(["requirement", "list", "--mechanism", "none", "--spec", "0020"])
        self.assertEqual(a, b)
        self.assertTrue(all(r["mechanism"] == "none" for r in a[1]["data"]["requirements"]))

    def test_typed_argument_failure_names_the_type_and_examples(self):
        code, doc = run_json(["spec", "show", "99"])
        self.assertEqual(code, 2)
        self.assertEqual((doc["kind"], doc["data"]["code"], doc["data"]["type"]), ("error", "invalid-argument", "SPEC"))
        self.assertIn("0020", doc["data"]["examples"])
        self.assertTrue(doc["actions"])

    def test_requirement_type_checks_the_requirement_exists(self):
        self.assertEqual(run_json(["requirement", "show", "0020/FR-013"])[0], 0)
        code, doc = run_json(["requirement", "show", "0020/FR-999"])
        self.assertEqual((code, doc["data"]["type"]), (2, "REQUIREMENT"))

    def test_a_number_resolves_to_its_spec(self):
        self.assertEqual(run_json(["spec", "show", "0041"])[1]["id"], "0041-command-line")

    def test_usage_errors_exit_2(self):
        for argv in (["nonsense"], ["spec"], ["spec", "show"], ["spec", "show", "0020", "extra"], ["spec", "list", "--nope"],
                     ["check", "--suite", "nope"], ["spec", "list", "--dry-run"], ["check", "--json", "--html"]):
            with self.subTest(argv=argv):
                self.assertEqual(run(argv)[0], 2)

    def test_unknown_command_suggests(self):
        code, doc = run_json(["spec", "shw", "0020"])
        self.assertEqual(code, 2)
        self.assertIn("spec show", doc["data"]["message"])

    def test_help_comes_from_the_registry(self):
        code, doc = run_json(["spec", "show", "--help"])
        self.assertEqual((code, doc["kind"]), (0, "help"))
        self.assertIn("SPEC", doc["data"]["usage"])
        self.assertEqual(run_json(["--help"])[0], 0)

    def test_writes_take_dry_run_and_refuse_root(self):
        self.assertEqual(run(["spec", "new", "demo", "--dry-run"])[0], 0)
        code, doc = run_json(["spec", "new", "demo", "--root", "/tmp"])
        self.assertEqual((code, doc["data"]["code"]), (2, "usage"))

    def test_reads_refuse_dry_run(self):
        self.assertEqual(run(["spec", "show", "0020", "--dry-run"])[0], 2)

    def test_a_toolchain_entry_that_cannot_be_had_is_exit_3_naming_it_and_the_override(self):
        from unittest import mock
        from agora.core import toolchain
        reg = Registry.load(HOME)
        reg.add_command(Command(("spec", "status"), "read", "x", toolchain=("no-such-tool",), group="spec",
                                fn=lambda ctx: Resource("x", "y")))
        nobuild = toolchain.Entry("no-such-tool", "1.0", "x", {}, lambda p: {})
        with mock.patch.object(toolchain, "discover", lambda: {"no-such-tool": nobuild}):
            code, doc = run_json(["spec", "status"], registry=reg)
        self.assertEqual((code, doc["data"]["code"]), (3, "toolchain"))
        self.assertIn("no-such-tool 1.0", doc["data"]["message"])
        self.assertIn("AGORA_NO_SUCH_TOOL", doc["data"]["message"])

    def test_an_unexpected_exception_is_an_error_resource_not_a_trace(self):
        reg = Registry.load(HOME)

        def boom(ctx):
            raise RuntimeError("kaboom")
        reg.add_command(Command(("spec", "status"), "read", "x", group="spec", fn=boom))
        code, out, err = run(["spec", "status", "--json"], registry=reg)
        doc = json.loads(out)
        self.assertEqual((code, doc["data"]["code"]), (1, "internal"))
        self.assertNotIn("Traceback", out + err)
        self.assertNotIn("trace", doc["data"])
        code, out, _ = run(["spec", "status", "--json", "--debug"], registry=reg)
        self.assertIn("kaboom", json.loads(out)["data"]["trace"])

    def test_streams_are_ndjson(self):
        reg = Registry.load(HOME)
        reg.add_command(Command(("spec", "status"), "read", "x", group="spec",
                                fn=lambda ctx: (Resource("tick", str(i)) for i in range(3))))
        code, out, _ = run(["spec", "status", "--json"], registry=reg)
        lines = out.strip().splitlines()
        self.assertEqual((code, len(lines)), (0, 3))
        self.assertTrue(all(json.loads(l)["kind"] == "tick" for l in lines))

    def test_offline_from_the_environment_or_the_flag(self):
        from agora.core.cli import main
        import io
        seen = []
        reg = Registry.load(HOME)
        reg.add_command(Command(("spec", "status"), "read", "x", group="spec",
                                fn=lambda ctx: seen.append(ctx.offline) or Resource("x", "y")))
        run(["spec", "status"], registry=reg, env={"AGORA_OFFLINE": "1"})
        run(["spec", "status", "--offline"], registry=reg)
        run(["spec", "status"], registry=reg)
        self.assertEqual(seen, [True, True, False])


class Completion(unittest.TestCase):
    def complete(self, *words):
        code, out, _ = run(["--complete", *words])
        self.assertEqual(code, 0)
        return out.split()

    def test_first_words(self):
        w = self.complete("")
        for expected in ("check", "spec", "doctor", "command"):
            self.assertIn(expected, w)
        self.assertIn("design-system", w)
        self.assertNotIn("ui", w)
        self.assertIn("mcp", w)
        self.assertIn("proposal", w)

    def test_verbs_of_a_noun(self):
        self.assertEqual(self.complete("spec", ""), ["list", "new", "set", "show"])
        self.assertEqual(self.complete("spec", "sh"), ["show"])

    def test_typed_positionals_and_options(self):
        self.assertIn("0020-spec-format", self.complete("spec", "show", "0020"))
        self.assertEqual(self.complete("requirement", "list", "--mechanism", ""), ["check", "gate", "none", "review"])
        self.assertIn("0042-agora/FR-001", self.complete("requirement", "show", "0042/FR-00"))
        self.assertEqual(self.complete("check", "--suite", ""), ["browser", "extension", "images", "python", "spec", "vscode"])
        self.assertIn("--suite", self.complete("check", "--s"))
        self.assertIn("specs", self.complete("check", "sp"))

    def test_scripts(self):
        for shell in ("bash", "zsh"):
            code, out, _ = run(["--completion-script", shell])
            self.assertEqual(code, 0)
            self.assertIn("--complete", out)
        self.assertEqual(run(["--completion-script", "fish"])[0], 2)
