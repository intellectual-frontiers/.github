"""agora's view of the toolchain ws-host owns (0025-tooling-environment FR-015 to FR-020; 0041-command-line FR-066 to FR-068; 0042-agora FR-030), driven
through a stand-in ws-host."""
import tempfile
import unittest
from pathlib import Path

from agora.core import toolchain as tc
from agora.lib import toolchain_rules

from .helpers import HOME
from .toolchain_fixture import FakeHost


class Adapter(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.host = FakeHost(Path(self.tmp.name))
        self.host.add("jre", files={"bin/java": b"x"}, provides={"java": "bin/java"}, env={"JAVA_HOME": "{dir}"}, bin="bin")
        self.host.add("asciidoctor", ready=False, needs=("jre",), provides={"asciidoctor": "lib/a.jar"})
        self.host.add("tex-xurl", files={"tex/x": b"x"}, env={"TEXMFHOME": "{dir}"})
        self.host.add("tex-fvextra", files={"tex/y": b"y"}, env={"TEXMFHOME": "{dir}"})
        self.host.add("tinytex", ready=False)

    def test_entries_come_from_ws_host_with_agoras_own_checks_attached(self):
        t = self.host.toolchain()
        self.assertEqual(sorted(t.entries), ["asciidoctor", "jre", "tex-fvextra", "tex-xurl", "tinytex"])
        self.assertEqual(t.entries["jre"].state, "ready")
        self.assertTrue(callable(t.entries["jre"].check))   # found by presence in agora/toolchain/jre.py (0041 FR-066)

    def test_expand_puts_a_need_first_and_a_group_stands_for_its_entries(self):
        t = self.host.toolchain()
        self.assertEqual(t.expand(["asciidoctor"]), ["jre", "asciidoctor"])
        self.assertEqual(t.expand(["tex-packages"]), ["tex-fvextra", "tex-xurl"])
        with self.assertRaises(tc.ToolchainError):
            t.expand(["nope"])

    def test_use_installs_only_what_is_missing_through_ws_host_then_says_where_it_is(self):
        t = self.host.toolchain()
        r = t.use(["asciidoctor"])
        self.assertEqual([l for l in self.host.asked() if l.startswith("toolchain ensure")], ["toolchain ensure asciidoctor --provider agora"])
        self.assertEqual(sorted(r.dirs), ["asciidoctor", "jre"])
        self.assertTrue(str(r.path_of("java")).endswith("jre/bin/java"))

    def test_environment_carries_the_installed_entries_and_not_the_hosts_tex_or_playwright_settings(self):
        t = self.host.toolchain(env=self.host.env(TEXMFHOME="/host/tex", CHROMIUM="/host/chromium", PLAYWRIGHT_BROWSERS_PATH="/host/pw", KEEP="1"))
        env = t.use(["jre"]).env()
        self.assertEqual(env["KEEP"], "1")
        self.assertNotIn("CHROMIUM", env)
        self.assertNotIn("PLAYWRIGHT_BROWSERS_PATH", env)
        self.assertTrue(env["JAVA_HOME"].endswith("store/jre"))
        self.assertTrue(env["PATH"].split(":")[0].endswith("store/jre/bin"))
        self.assertNotEqual(env.get("TEXMFHOME"), "/host/tex")

    def test_offline_a_missing_entry_is_exit_3_naming_it_its_version_and_the_command(self):
        t = self.host.toolchain(offline=True)
        with self.assertRaises(tc.ToolchainError) as e:
            t.use(["asciidoctor"])
        self.assertEqual(e.exception.exit, 3)
        self.assertIn("asciidoctor 1.0", e.exception.message)
        self.assertIn("ws-host toolchain ensure asciidoctor --provider agora", e.exception.message)
        self.assertEqual([l for l in self.host.asked() if l.startswith("toolchain ensure")], [], "nothing is installed offline")

    def test_an_entry_ws_host_cannot_install_is_exit_3_and_names_why(self):
        self.host.add("no-build", ready=False, fail="no-build 1.0 has no build for linux-x64")
        with self.assertRaises(tc.ToolchainError) as e:
            self.host.toolchain().use(["no-build"])
        self.assertEqual(e.exception.exit, 3)
        self.assertIn("no build", e.exception.message)

    def test_without_ws_host_it_says_so_with_exit_3(self):
        t = tc.Toolchain(HOME, env={"PATH": "/nonexistent"}, offline=False)
        with self.assertRaises(tc.ToolchainError) as e:
            t.use(["jre"])
        self.assertEqual(e.exception.exit, 3)
        self.assertIn("ws-host is needed", e.exception.message)

    def test_a_ws_host_that_does_not_know_the_provider_is_exit_3(self):
        import json
        self.host.script.write_text("#!/bin/sh\necho '{\"kind\": \"error\", \"data\": {\"plain\": \"No enabled provider is called agora.\"}}'\nexit 3\n")
        with self.assertRaises(tc.ToolchainError) as e:
            self.host.toolchain().entries
        self.assertEqual(e.exception.exit, 3)
        self.assertIn("No enabled provider", e.exception.message)


class Declarations(unittest.TestCase):
    def test_the_declared_entries_are_read_as_data(self):
        d = tc.declared(HOME)
        self.assertIn("chromium", d)
        self.assertEqual(d["chromium"]["kind"], "archive")
        self.assertTrue(set(tc.GROUPS) <= {"tex-packages"})
        self.assertTrue(any(n.startswith("tex-") for n in d))

    def test_every_entry_with_agora_code_is_declared(self):
        declared = set(tc.declared(HOME)) | set(tc.GROUPS)
        self.assertLessEqual(set(tc.discover_code()), declared)

    def test_the_findings_of_a_clean_repository_are_none_and_a_name_that_is_not_an_entry_is_one(self):
        from agora.core.registry import Registry
        reg = Registry.load(HOME)
        declared = tc.declared(HOME)
        self.assertEqual(toolchain_rules.entry_findings(declared, reg), [])
        reg.sections["controls"].toolchain = ("no-such-tool",)
        found = toolchain_rules.entry_findings(declared, reg)
        self.assertTrue(any("no-such-tool" in f.message for f in found))
        declared = {**declared, "jre": {**declared["jre"], "needs": ["ghost"]}}
        self.assertTrue(any("ghost" in f.message for f in toolchain_rules.entry_findings(declared, Registry.load(HOME))))

    def test_ws_host_findings_become_findings(self):
        self.assertEqual(toolchain_rules.generated_findings.__name__, "generated_findings")
        with tempfile.TemporaryDirectory() as tmp:
            host = FakeHost(Path(tmp))
            host.extra = {"stale": [".workspaces-host/mise/.config/mise/conf.d/jre.toml"]}
            host.save()
            found = toolchain_rules.generated_findings(HOME, host.env())
            self.assertEqual([f.where for f in found], [".workspaces-host/mise/.config/mise/conf.d/jre.toml"])
            host.extra = {"stale": [], "generate_exit": 1}
            host.save()
            self.assertEqual(len(toolchain_rules.generated_findings(HOME, host.env())), 1)


if __name__ == "__main__":
    unittest.main()
