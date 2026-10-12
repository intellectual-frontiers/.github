"""The profile and what is runnable here (0041-command-line FR-078 to FR-083): command list, MCP tools, `check --available`, `fresh --available`, doctor."""
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from agora.core import toolchain
from agora.core.checks import Finding, SectionResult
from agora.core.registry import Generator, Registry, Section

from .helpers import HOME, run_json
from .toolchain_fixture import FakeBackend, FakeHost


class Isolated(unittest.TestCase):
    """The store and the cache are throwaway, so that what this machine happens to have installed does not decide a test."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        patcher = mock.patch.dict(os.environ, {"XDG_DATA_HOME": f"{self._tmp.name}/data", "XDG_CACHE_HOME": f"{self._tmp.name}/cache"})
        patcher.start()
        self.addCleanup(patcher.stop)


class CommandList(Isolated):
    def rows(self, env):
        code, doc = run_json(["command", "list"], env=env)
        self.assertEqual(code, 0)
        return doc["data"], {r["id"]: r for r in doc["data"]["commands"]}

    def test_each_command_says_what_it_needs_and_whether_it_runs_here(self):
        data, rows = self.rows({"AGORA_OFFLINE": "1"})
        self.assertEqual(rows["docs build"]["needs"]["toolchain"], ["jre", "asciidoctor"])
        self.assertFalse(rows["docs build"]["runnable"], "offline with nothing in the store, asciidoctor comes from no source")
        self.assertTrue(rows["spec list"]["runnable"])
        self.assertEqual(rows["spec list"]["needs"], {"packages": [], "toolchain": []})
        _, online = self.rows({})
        self.assertTrue(online["docs build"]["runnable"], "online, archon can obtain it")

    def test_an_unattended_list_leaves_out_the_editors_presentation(self):
        data, rows = self.rows({"ARCHON_ATTENDANCE": "unattended"})
        self.assertNotIn("presentation", data)
        self.assertNotIn("title", rows["spec list"])
        self.assertNotIn("icon", rows["spec list"])
        self.assertEqual(data["profile"]["attendance"], "unattended")

    def test_an_attended_list_keeps_it(self):
        data, rows = self.rows({"ARCHON_ATTENDANCE": "attended"})
        self.assertIn("presentation", data)
        self.assertIn("title", rows["spec list"])


class Available(Isolated):
    def registry(self):
        reg = Registry.load(HOME)
        reg.sections["needs-asciidoctor"] = Section("needs-asciidoctor", "a section that names a toolchain entry", toolchain=("asciidoctor",), group="spec",
                                                    fn=lambda ctx, scope: SectionResult("needs-asciidoctor"))
        reg.sections["plain"] = Section("plain", "a section that names none", group="spec", fn=lambda ctx, scope: SectionResult("plain"))
        return reg

    def check(self, *argv, env=None):
        return run_json(["check", *argv], registry=self.registry(), env={"AGORA_OFFLINE": "1", **(env or {})})

    def test_a_section_that_cannot_run_here_is_skipped_and_the_exit_is_3(self):
        code, doc = self.check("plain", "needs-asciidoctor")
        self.assertEqual(code, 3)
        self.assertEqual(doc["data"]["summary"], {"run": 2, "passed": 1, "failed": 0, "skipped": 1})
        self.assertFalse(doc["data"]["complete"])
        skipped = [s for s in doc["data"]["sections"] if s["status"] == "skipped"][0]
        self.assertIn("offline", skipped["reason"])

    def test_available_runs_what_can_run_says_the_run_is_incomplete_and_exits_0(self):
        code, doc = self.check("plain", "needs-asciidoctor", "--available")
        self.assertEqual(code, 0)
        self.assertEqual(doc["data"]["status"], "skipped")
        self.assertFalse(doc["data"]["complete"])

    def test_available_still_fails_when_what_ran_failed(self):
        reg = self.registry()
        reg.sections["plain"].fn = lambda ctx, scope: SectionResult.from_findings("plain", [Finding("error", "x", "bad")])
        code, doc = run_json(["check", "plain", "needs-asciidoctor", "--available"], registry=reg, env={"AGORA_OFFLINE": "1"})
        self.assertEqual(code, 1)

    def test_a_section_whose_entry_archon_can_obtain_runs(self):
        with tempfile.TemporaryDirectory() as tmp:
            host = FakeHost(Path(tmp))
            host.add("asciidoctor", ready=False)
            with mock.patch.object(toolchain, "ArchonBackend", lambda home, env, offline: FakeBackend(host)):
                code, doc = run_json(["check", "plain", "needs-asciidoctor"], registry=self.registry(), env={})
            self.assertEqual(host.asked(), ["obtain asciidoctor"])
        self.assertEqual(code, 0, doc)
        self.assertTrue(doc["data"]["complete"])


class FreshAvailable(Isolated):
    def registry(self):
        from agora.core.generate import Generated
        reg = Registry.load(HOME)
        reg.generators.clear()
        reg.generators["needs-asciidoctor"] = Generator("needs-asciidoctor", "a generator that names a toolchain entry", command="x", toolchain=("asciidoctor",),
                                                        group="spec", fn=lambda ctx, scope: Generated())
        reg.generators["plain"] = Generator("plain", "a generator that names none", command="y", group="spec", fn=lambda ctx, scope: Generated())
        return reg

    def fresh(self, *argv):
        return run_json(["fresh", *argv], registry=self.registry(), env={"AGORA_OFFLINE": "1"})

    def test_a_generator_that_cannot_run_is_skipped_and_the_exit_is_3(self):
        code, doc = self.fresh()
        self.assertEqual(code, 3)
        rows = {g["name"]: g["status"] for g in doc["data"]["generators"]}
        self.assertEqual(rows, {"needs-asciidoctor": "skipped", "plain": "fresh"})
        self.assertFalse(doc["data"]["complete"])

    def test_available_proves_what_can_be_proved_and_exits_0(self):
        code, doc = self.fresh("--available")
        self.assertEqual(code, 0)
        self.assertFalse(doc["data"]["complete"])


class Doctor(Isolated):
    def test_a_host_with_only_uv_is_not_a_fault(self):
        code, doc = run_json(["doctor"], env={"ARCHON_ATTENDANCE": "unattended"})
        self.assertEqual((code, doc["data"]["status"]), (0, "ok"))
        self.assertEqual(doc["data"]["profile"]["attendance"], "unattended")
        self.assertEqual(doc["data"]["missing"], [])
        sources = {r["entry"]: r["source"] for r in doc["data"]["toolchain"]}
        self.assertIn("asciidoctor", sources)
        self.assertEqual(sources["asciidoctor"], "-", "not obtained yet, and that is not a fault")


class McpTools(Isolated):
    def names(self, env):
        from agora.core.mcp import Server
        return set(Server(Registry.load(HOME), HOME, env).exposed())

    def test_offline_it_lists_only_commands_that_can_run(self):
        offline, online = self.names({"AGORA_OFFLINE": "1"}), self.names({})
        self.assertIn("spec_list", offline)
        self.assertNotIn("docs_build", offline)
        self.assertIn("docs_build", online)
        self.assertLess(offline, online)


if __name__ == "__main__":
    unittest.main()
