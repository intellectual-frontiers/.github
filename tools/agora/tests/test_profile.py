"""The execution profile (0041-command-line FR-078 to FR-082): provisioning, attendance, what is runnable on a bare host, `check --available`."""
import unittest
from pathlib import Path
import tempfile

from agora.core import profile as P
from agora.core.checks import SectionResult
from agora.core.registry import Generator, Registry, Section

from .helpers import HOME, run_json
from .toolchain_fixture import FakeHost


class Provisioning(unittest.TestCase):
    def test_the_launchers_variable_decides(self):
        self.assertEqual(P.provisioning_of("agora", {"AGORA_PROVISIONING": "bare", "WS_HOST": "/x"}), P.BARE)
        self.assertEqual(P.provisioning_of("agora", {"AGORA_PROVISIONING": "hosted", "PATH": "/nowhere"}), P.HOSTED)

    def test_without_the_variable_ws_host_on_the_path_or_named_makes_it_hosted(self):
        self.assertEqual(P.provisioning_of("agora", {"PATH": "/usr/bin:/bin"}), P.BARE)
        self.assertEqual(P.provisioning_of("agora", {"PATH": "/usr/bin:/bin", "WS_HOST": "/opt/ws-host"}), P.HOSTED)

    def test_a_value_that_is_neither_is_ignored(self):
        self.assertEqual(P.provisioning_of("agora", {"AGORA_PROVISIONING": "maybe", "PATH": "/usr/bin:/bin"}), P.BARE)


class Attendance(unittest.TestCase):
    def of(self, env, surface="cli"):
        return P.attendance_of("agora", env, surface)

    def test_it_is_attended_when_nothing_says_otherwise(self):
        self.assertEqual(self.of({})[0], P.ATTENDED)

    def test_an_agent_or_a_ci_job_is_unattended(self):
        for var in ("CI", "CLAUDE_CODE_REMOTE"):
            for value in ("true", "1", "TRUE"):
                with self.subTest(var=var, value=value):
                    self.assertEqual(self.of({var: value}), (P.UNATTENDED, var))
        self.assertEqual(self.of({"CI": "false"})[0], P.ATTENDED)

    def test_the_surface_decides_before_the_variables(self):
        self.assertEqual(self.of({}, "mcp")[0], P.UNATTENDED)
        self.assertEqual(self.of({"CI": "true"}, "editor")[0], P.ATTENDED)

    def test_the_override_decides_first(self):
        self.assertEqual(self.of({"AGORA_ATTENDANCE": "attended", "CI": "true"}, "mcp"), (P.ATTENDED, "AGORA_ATTENDANCE"))
        self.assertEqual(self.of({"AGORA_ATTENDANCE": "unattended"})[0], P.UNATTENDED)
        self.assertEqual(self.of({"AGORA_ATTENDANCE": "perhaps"})[0], P.ATTENDED)

    def test_a_pipe_is_not_a_reason(self):
        # The editor reads JSON through a pipe: nothing about the streams is consulted (0041 FR-078).
        import inspect
        self.assertNotIn("isatty", inspect.getsource(P))


class Runnable(unittest.TestCase):
    def test_a_command_naming_an_entry_needs_a_hosted_host(self):
        bare, hosted = P.Profile(P.BARE, P.ATTENDED, ""), P.Profile(P.HOSTED, P.ATTENDED, "")
        self.assertTrue(P.runnable(bare, ()))
        self.assertFalse(P.runnable(bare, ("jre",)))
        self.assertTrue(P.runnable(hosted, ("jre",)))

    def test_the_floor_is_read_from_pyproject(self):
        self.assertEqual(P.python_floor(HOME), (3, 14))
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(P.python_floor(Path(d)), (3, 14))
            (Path(d) / "pyproject.toml").write_text('[project]\nrequires-python = ">=3.15"\n')
            self.assertEqual(P.python_floor(Path(d)), (3, 15))


class CommandList(unittest.TestCase):
    def rows(self, env):
        code, doc = run_json(["command", "list"], env=env)
        self.assertEqual(code, 0)
        return doc["data"], {r["id"]: r for r in doc["data"]["commands"]}

    def test_each_command_says_what_it_needs_and_whether_it_runs_here(self):
        data, rows = self.rows({"AGORA_PROVISIONING": "bare"})
        self.assertEqual(rows["docs build"]["needs"]["toolchain"], ["jre", "asciidoctor"])
        self.assertFalse(rows["docs build"]["runnable"])
        self.assertTrue(rows["spec list"]["runnable"])
        self.assertEqual(rows["spec list"]["needs"], {"packages": [], "toolchain": []})
        self.assertEqual(data["profile"]["provisioning"], "bare")
        _, hosted = self.rows({"AGORA_PROVISIONING": "hosted"})
        self.assertTrue(hosted["docs build"]["runnable"])

    def test_an_unattended_list_leaves_out_the_editors_presentation(self):
        data, rows = self.rows({"AGORA_ATTENDANCE": "unattended"})
        self.assertNotIn("presentation", data)
        self.assertNotIn("title", rows["spec list"])
        self.assertNotIn("icon", rows["spec list"])

    def test_an_attended_list_keeps_it(self):
        data, rows = self.rows({"AGORA_ATTENDANCE": "attended"})
        self.assertIn("presentation", data)
        self.assertIn("title", rows["spec list"])


class Available(unittest.TestCase):
    def registry(self):
        reg = Registry.load(HOME)
        reg.sections["needs-jre"] = Section("needs-jre", "a section that names a toolchain entry", toolchain=("jre",), group="spec",
                                            fn=lambda ctx, scope: SectionResult("needs-jre"))
        reg.sections["plain"] = Section("plain", "a section that names none", group="spec", fn=lambda ctx, scope: SectionResult("plain"))
        return reg

    def check(self, *argv, env=None):
        return run_json(["check", *argv], registry=self.registry(), env={"AGORA_PROVISIONING": "bare", **(env or {})})

    def test_a_section_that_cannot_run_here_is_skipped_and_the_exit_is_3(self):
        code, doc = self.check("plain", "needs-jre")
        self.assertEqual(code, 3)
        self.assertEqual(doc["data"]["summary"], {"run": 2, "passed": 1, "failed": 0, "skipped": 1})
        self.assertFalse(doc["data"]["complete"])
        skipped = [s for s in doc["data"]["sections"] if s["status"] == "skipped"][0]
        self.assertIn("ws-host", skipped["reason"])

    def test_available_runs_what_can_run_says_the_run_is_incomplete_and_exits_0(self):
        code, doc = self.check("plain", "needs-jre", "--available")
        self.assertEqual(code, 0)
        self.assertEqual(doc["data"]["status"], "skipped")
        self.assertFalse(doc["data"]["complete"])

    def test_available_still_fails_when_what_ran_failed(self):
        reg = self.registry()
        reg.sections["plain"].fn = lambda ctx, scope: SectionResult.from_findings("plain", [__import__("agora.core.checks", fromlist=["Finding"]).Finding("error", "x", "bad")])
        code, doc = run_json(["check", "plain", "needs-jre", "--available"], registry=reg, env={"AGORA_PROVISIONING": "bare"})
        self.assertEqual(code, 1)

    def test_a_hosted_host_runs_it(self):
        with tempfile.TemporaryDirectory() as tmp:
            host = FakeHost(Path(tmp))
            host.add("jre", ready=True)
            code, doc = run_json(["check", "plain", "needs-jre"], registry=self.registry(), env={**host.env(), "AGORA_PROVISIONING": "hosted"})
        self.assertEqual(code, 0, doc)
        self.assertTrue(doc["data"]["complete"])


class FreshAvailable(unittest.TestCase):
    def registry(self):
        from agora.core.generate import Generated
        reg = Registry.load(HOME)
        reg.generators.clear()
        reg.generators["needs-jre"] = Generator("needs-jre", "a generator that names a toolchain entry", command="x", toolchain=("jre",), group="spec",
                                                fn=lambda ctx, scope: Generated())
        reg.generators["plain"] = Generator("plain", "a generator that names none", command="y", group="spec", fn=lambda ctx, scope: Generated())
        return reg

    def fresh(self, *argv):
        return run_json(["fresh", *argv], registry=self.registry(), env={"AGORA_PROVISIONING": "bare"})

    def test_a_generator_that_cannot_run_is_skipped_and_the_exit_is_3(self):
        code, doc = self.fresh()
        self.assertEqual(code, 3)
        rows = {g["name"]: g["status"] for g in doc["data"]["generators"]}
        self.assertEqual(rows, {"needs-jre": "skipped", "plain": "fresh"})
        self.assertFalse(doc["data"]["complete"])

    def test_available_proves_what_can_be_proved_and_exits_0(self):
        code, doc = self.fresh("--available")
        self.assertEqual(code, 0)
        self.assertFalse(doc["data"]["complete"])


class Doctor(unittest.TestCase):
    def test_a_bare_host_is_not_a_fault(self):
        code, doc = run_json(["doctor"], env={"AGORA_PROVISIONING": "bare"})
        self.assertEqual((code, doc["data"]["status"]), (0, "ok"))
        self.assertEqual(doc["data"]["profile"]["provisioning"], "bare")
        self.assertEqual(doc["data"]["toolchain"], [])
        self.assertIn("ws-host", doc["data"]["note"])
        self.assertEqual(doc["data"]["missing"], [])


class McpTools(unittest.TestCase):
    def names(self, env):
        from agora.core.mcp import Server
        return set(Server(Registry.load(HOME), HOME, env).exposed())

    def test_a_bare_host_lists_only_commands_it_can_run(self):
        bare, hosted = self.names({"AGORA_PROVISIONING": "bare"}), self.names({"AGORA_PROVISIONING": "hosted"})
        self.assertIn("spec_list", bare)
        self.assertNotIn("docs_build", bare)
        self.assertIn("docs_build", hosted)
        self.assertLess(bare, hosted)


if __name__ == "__main__":
    unittest.main()
