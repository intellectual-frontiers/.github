"""`extension build` and the manifest and lint rules of `check extension` (0042-agora FR-032; 0043-if-console FR-027, FR-028)."""
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from agora.lib import extension
from agora.toolchain import vsce

from .helpers import HOME, run_json


class ExtensionRules(unittest.TestCase):
    def copy(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        dest = Path(tmp.name) / "tools" / "if-console"
        shutil.copytree(HOME / "tools" / "if-console", dest, ignore=shutil.ignore_patterns("node_modules"))
        return Path(tmp.name), dest

    def test_the_manifest_of_this_repository_is_valid(self):
        self.assertEqual([f.message for f in extension.manifest_findings(HOME)], [])

    def test_a_runtime_dependency_a_workspace_setting_and_an_untrusted_workspace_are_each_found(self):
        root, ext = self.copy()
        pkg = json.loads((ext / "package.json").read_text())
        pkg["dependencies"] = {"left-pad": "1.0.0"}
        pkg["contributes"]["configuration"]["properties"]["if-console.launchers"]["scope"] = "window"
        pkg["capabilities"]["untrustedWorkspaces"]["supported"] = True
        (ext / "package.json").write_text(json.dumps(pkg))
        found = " | ".join(f.message for f in extension.manifest_findings(root))
        self.assertIn("runtime dependencies", found)
        self.assertIn("scope application", found)
        self.assertIn("untrustedWorkspaces", found)

    def test_a_contributed_command_with_no_handler_is_found(self):
        root, ext = self.copy()
        pkg = json.loads((ext / "package.json").read_text())
        pkg["contributes"]["commands"].append({"command": "if-console.nothing", "title": "Nothing"})
        (ext / "package.json").write_text(json.dumps(pkg))
        self.assertTrue(any("if-console.nothing" in f.message for f in extension.manifest_findings(root)))

    def test_the_lock_pins_the_build_tool_with_integrity_hashes(self):
        self.assertEqual(vsce.lock_problems(), [])

    def test_build_dry_run_names_the_package_and_writes_nothing(self):
        done = subprocess.run([str(HOME / "agora"), "extension", "build", "--dry-run", "--json", "--no-log"], capture_output=True, text=True)
        doc = json.loads(done.stdout)  # a command of a group that pins packages runs in that group's own environment
        self.assertTrue(doc["data"]["dry_run"])
        self.assertEqual(doc["data"]["vsix"], f"build/{extension.vsix_name(HOME)}")
        self.assertEqual(doc["data"]["changes"][0]["path"], doc["data"]["vsix"])


if __name__ == "__main__":
    unittest.main()
