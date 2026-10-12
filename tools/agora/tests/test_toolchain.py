"""agora's view of the toolchain archon makes available (0025-tooling-environment FR-015 to FR-020; 0041-command-line FR-066 to FR-068; 0042-agora FR-030),
driven through a stand-in backend."""
import tempfile
import unittest
from pathlib import Path
from unittest import mock

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

    def test_entries_come_from_archon_with_agoras_own_checks_attached(self):
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

    def test_use_obtains_only_what_is_missing_through_archon_then_says_where_it_is(self):
        t = self.host.toolchain()
        r = t.use(["asciidoctor"])
        self.assertEqual(self.host.asked(), ["obtain asciidoctor"])
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
        self.assertIn("Run the command once while online", e.exception.message)
        self.assertEqual(self.host.asked(), [], "nothing is obtained offline")

    def test_an_entry_no_source_can_supply_is_exit_3_and_names_why(self):
        self.host.add("no-build", ready=False, fail="no-build 1.0 has no build for linux-x64")
        with self.assertRaises(tc.ToolchainError) as e:
            self.host.toolchain().use(["no-build"])
        self.assertEqual(e.exception.exit, 3)
        self.assertIn("no build", e.exception.message)

    def test_an_entry_the_repository_does_not_declare_is_a_usage_error(self):
        with self.assertRaises(tc.ToolchainError) as e:
            self.host.toolchain().use(["no-such-entry"])
        self.assertEqual(e.exception.exit, 2)

    def test_the_real_backend_reads_this_repositorys_declarations_and_installs_nothing_to_answer(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict("os.environ", {"XDG_DATA_HOME": f"{tmp}/data", "XDG_CACHE_HOME": f"{tmp}/cache"}):
            rows = tc.ArchonBackend(HOME, {}, False).rows()
            self.assertEqual(sorted(e["name"] for e in rows["entries"]), sorted(tc.declared(HOME)))
            self.assertEqual({e["name"]: e["state"] for e in rows["entries"]}["asciidoctor"], "missing")
            self.assertFalse((Path(tmp) / "data").exists() and any((Path(tmp) / "data").rglob("*.jar")))


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

    def test_archons_findings_become_findings(self):
        self.assertEqual(toolchain_rules.generated_findings(HOME), [])      # this repository's generated files are current
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual([f.message for f in toolchain_rules.generated_findings(Path(tmp))], ["declares no provider (provider.toml)"])


if __name__ == "__main__":
    unittest.main()
