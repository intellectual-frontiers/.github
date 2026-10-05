import json
import unittest
from pathlib import Path

from .helpers import HOME, TempRepo, run, run_json, spec_text


class SpecCommands(TempRepo):
    def run_here(self, *argv):
        """Writing commands refuse --root, so they run with the temp repository as home."""
        import shutil
        if not (self.root / "tools" / "agora").exists():
            shutil.copytree(HOME / "tools" / "agora", self.root / "tools" / "agora", ignore=shutil.ignore_patterns("__pycache__", "tests"))
            shutil.copy(HOME / "ontology" / "ifcore.ttl", self.root / "ontology" / "ifcore.ttl") if (self.root / "ontology").exists() else (
                (self.root / "ontology").mkdir(), shutil.copy(HOME / "ontology" / "ifcore.ttl", self.root / "ontology" / "ifcore.ttl"))
            self.write(".devcontainer/ws-repos.json", (HOME / ".devcontainer/ws-repos.json").read_text())
        return run_json(list(argv), home=self.root)

    def test_spec_list_and_show(self):
        code, doc = run_json(["spec", "list", "--root", str(self.root)])
        self.assertEqual(doc["data"]["specs"][0]["name"], "0001-first")
        code, doc = run_json(["spec", "show", "0001", "--root", str(self.root)])
        self.assertEqual(doc["data"]["requirements"], 1)
        self.assertEqual(doc["links"][0]["cli"], "agora requirement show 0001-first/FR-001")
        self.assertIn("spec set", [a["command"] for a in doc["actions"]])

    def test_spec_new_takes_the_next_number_and_passes_the_check(self):
        code, doc = self.run_here("spec", "new", "second-thing", "--title", "A second thing")
        self.assertEqual((code, doc["id"]), (0, "0002-second-thing"))
        path = self.root / "spec-kit/specs/0002-second-thing/spec.md"
        self.assertTrue(path.is_file())
        code, doc = run_json(["check", "specs", "--root", str(self.root)])
        self.assertEqual(code, 0, doc["data"]["sections"][0]["findings"])
        self.assertEqual(self.run_here("spec", "new", "second-thing")[0], 2)  # the slug exists
        code, doc = self.run_here("spec", "new", "third", "--dry-run")
        self.assertEqual(code, 0)
        self.assertFalse((self.root / "spec-kit/specs/0003-third").exists())

    def test_spec_new_writes_no_requirement_text_beyond_the_skeleton(self):
        self.run_here("spec", "new", "second-thing")
        text = (self.root / "spec-kit/specs/0002-second-thing/spec.md").read_text()
        self.assertEqual(text.count("- **FR-"), 1)
        self.assertEqual(len(list((self.root / "spec-kit").glob("*.tsv"))), 1)  # the register is not touched

    def test_spec_set_moves_status_only_as_0020_allows(self):
        self.run_here("spec", "list")
        spec = self.root / "spec-kit/specs/0001-first/spec.md"
        code, doc = self.run_here("spec", "set", "0001", "--status", "Adopted", "--dry-run")
        self.assertEqual(code, 0)
        self.assertIn("**Status:** Draft", spec.read_text())
        self.assertEqual(self.run_here("spec", "set", "0001", "--status", "Adopted")[0], 0)
        self.assertIn("**Status:** Adopted", spec.read_text())
        self.assertEqual(self.run_here("spec", "set", "0001", "--status", "Draft")[0], 2)
        self.assertEqual(self.run_here("spec", "set", "0001", "--status", "Superseded")[0], 2)  # needs the superseder
        self.write("spec-kit/specs/0002-next/spec.md", spec_text("0002-next"))
        self.assertEqual(self.run_here("spec", "set", "0001", "--status", "Superseded", "--superseded-by", "0002")[0], 0)
        self.assertIn("**Status:** Superseded by 0002-next", spec.read_text())
        self.assertEqual(self.run_here("spec", "set", "0001", "--status", "Adopted")[0], 2)
        self.assertEqual(run_json(["check", "specs", "--scope", "0001", "--root", str(self.root)])[0], 0)

    def test_spec_set_is_a_decision(self):
        _, doc = run_json(["command", "show", "spec set"])
        self.assertEqual((doc["data"]["category"], doc["data"]["surfaces"]), ("decision", ["terminal", "editor"]))

    def test_requirement_set_writes_only_the_register(self):
        before = (self.root / "spec-kit/specs/0001-first/spec.md").read_text()
        code, doc = self.run_here("requirement", "set", "0001/FR-001", "--mechanism", "check", "--by",
                                  ".github: agora check specs", "--note", "n", "--dry-run")
        self.assertEqual(code, 0)
        self.assertIn("none", (self.root / "spec-kit/enforcement.tsv").read_text())
        code, doc = self.run_here("requirement", "set", "0001/FR-001", "--mechanism", "check", "--by", ".github: agora check specs", "--note", "n")
        self.assertEqual(code, 0)
        self.assertIn("0001-first FR-001\tcheck\t.github: agora check specs\tn", (self.root / "spec-kit/enforcement.tsv").read_text())
        self.assertEqual((self.root / "spec-kit/specs/0001-first/spec.md").read_text(), before)
        self.assertEqual(run_json(["check", "register", "--root", str(self.root)])[0], 0)

    def test_requirement_set_refuses_a_row_the_check_would_refuse(self):
        for args in (["--mechanism", "check", "--by", ".github: agora nonsense"], ["--mechanism", "check"],
                     ["--mechanism", "review", "--by", "0001-first FR-099"], ["--mechanism", "check", "--by", "make check"]):
            with self.subTest(args=args):
                code, doc = self.run_here("requirement", "set", "0001/FR-001", *args)
                self.assertEqual(code, 2, doc)
        self.assertIn("none", (self.root / "spec-kit/enforcement.tsv").read_text())

    def test_requirement_set_adds_a_missing_row_after_its_spec(self):
        self.write("spec-kit/specs/0001-first/spec.md", spec_text("0001-first", frs=2))
        code, _ = self.run_here("requirement", "set", "0001/FR-002", "--mechanism", "none")
        self.assertEqual(code, 0)
        self.assertEqual(run_json(["check", "register", "--root", str(self.root)])[0], 0)

    def test_requirement_add_writes_the_control_map(self):
        from agora.lib.controls import public_controls
        control = sorted(public_controls(HOME))[0]
        code, doc = self.run_here("requirement", "add", "0001/FR-001", "--control", control, "--note", "partly")
        self.assertEqual(code, 0)
        self.assertIn(f"0001-first FR-001\t{control}\tpartly", (self.root / "spec-kit/controls.tsv").read_text())
        self.assertEqual(self.run_here("requirement", "add", "0001/FR-001", "--control", control)[0], 2)  # once
        self.assertEqual(self.run_here("requirement", "add", "0001/FR-001", "--control", "nope:nope")[0], 2)
        self.assertEqual(run_json(["check", "controls", "--root", str(self.root)])[0], 0)

    def test_requirement_list_replaces_list_none(self):
        code, doc = run_json(["requirement", "list", "--mechanism", "none", "--root", str(self.root)])
        self.assertEqual([r["requirement"] for r in doc["data"]["requirements"]], ["0001-first/FR-001"])
        self.assertEqual(doc["data"]["requirements"][0]["note"], "not yet")

    def test_requirement_show(self):
        code, doc = run_json(["requirement", "show", "0001/FR-001", "--root", str(self.root)])
        self.assertEqual((doc["data"]["mechanism"], doc["data"]["text"]), ("none", "A thing MUST hold."))

    def test_no_command_commits_or_pushes(self):
        import re
        src = "\n".join(p.read_text() for p in (HOME / "tools/agora").rglob("*.py") if "tests" not in p.parts)
        self.assertIsNone(re.search(r"\[\s*\"git\"\s*,\s*\"(commit|push|tag|add)\"", src))
        self.assertIsNone(re.search(r"git\s+(commit|push)\b", src))


class OtherCommands(unittest.TestCase):
    def test_ontology_list_and_show(self):
        code, doc = run_json(["ontology", "list", "--scheme", "CommandCategoryScheme"])
        self.assertEqual(sorted(t["notation"] for t in doc["data"]["terms"]),
                         ["build", "check", "decision", "generate", "read", "record", "setup"])
        code, doc = run_json(["ontology", "show", "ifcore:ReadCommandCategory"])
        self.assertEqual((doc["id"], doc["data"]["scheme"], doc["data"]["notation"]), ("ifcore:ReadCommandCategory", "ifcore:CommandCategoryScheme", "read"))
        self.assertEqual(run_json(["ontology", "show", "Nope"])[0], 2)
        self.assertEqual(run_json(["ontology", "list", "--scheme", "Nope"])[0], 2)

    def test_command_list_and_show(self):
        code, doc = run_json(["command", "list"])
        ids = [c["id"] for c in doc["data"]["commands"]]
        self.assertIn("check", ids)
        self.assertIn("proposal list", ids)
        self.assertIn("mcp serve", ids)
        self.assertEqual(run_json(["command", "list", "--status", "planned"])[0], 2)  # nothing is planned: the option is gone
        self.assertIn("design-system list", ids)
        self.assertIn("brand list", ids)
        code, doc = run_json(["command", "list", "--category", "decision"])
        self.assertEqual([c["id"] for c in doc["data"]["commands"]], ["ink record", "proposal advance", "spec set"])
        code, doc = run_json(["command", "show", "requirement", "set"])
        self.assertEqual(doc["id"], "requirement set")
        d = doc["data"]
        self.assertEqual((d["noun"], d["verb"], d["category"], d["group"]), ("requirement", "set", "record", "spec"))
        self.assertEqual(d["arguments"][0]["type"], "REQUIREMENT")
        self.assertIn("--dry-run", [o["flag"] for o in d["options"]])
        self.assertEqual(d["surfaces"], ["terminal", "editor", "mcp"])
        self.assertEqual(run_json(["command", "show", "nope"])[0], 2)

    def test_context_for_a_spec_and_a_requirement(self):
        code, doc = run_json(["context", "spec:0020"])
        self.assertEqual((code, doc["id"]), (0, "spec:0020-spec-format"))
        d = doc["data"]
        self.assertEqual(d["specs"][0]["name"], "0020-spec-format")
        self.assertTrue(d["requirements"] and d["files"] and doc["actions"])
        self.assertTrue(d["omitted"])
        code, doc = run_json(["context", "0020/FR-013"])
        self.assertEqual(doc["id"], "requirement:0020-spec-format/FR-013")
        self.assertEqual(doc["data"]["resource"]["mechanism"], "check")
        self.assertEqual(run_json(["context", "nonsense:1"])[0], 2)

    def test_context_is_deterministic_and_bounded(self):
        a = run(["context", "spec:0041", "--json"])[1]
        self.assertEqual(a, run(["context", "spec:0041", "--json"])[1])
        d = json.loads(a)["data"]
        self.assertLessEqual(len(d["requirements"]), 60)
        self.assertTrue(any("requirements" in o for o in d["omitted"]) or len(d["requirements"]) <= 60)

    def test_doctor_reports_and_changes_nothing(self):
        from unittest import mock
        from agora.core import system
        with mock.patch.object(system, "loads", lambda lib: True):  # a healthy host: the browser's libraries load
            code, doc = run_json(["doctor"])
        self.assertEqual((code, doc["data"]["status"]), (0, "ok"))
        self.assertEqual(doc["data"]["conflicts"], [])
        self.assertEqual([p["name"] for p in doc["data"]["prerequisites"]], ["uv", "python3"])
        self.assertNotIn("programs", doc["data"])  # no host program is declared: packages and toolchain entries supply them
        rows = {r["entry"]: r for r in doc["data"]["toolchain"]}
        self.assertEqual(set(rows), {"tinytex", "tex-packages", "chromium", "npm-packages", "extension-build", "jre", "asciidoctor", "asciidoctor-pdf", "vscode"})
        self.assertTrue(all(r["cache"] in ("ready", "not fetched") and r["needed by"] for r in rows.values()))
        self.assertTrue(any("browser" in n for n in rows["chromium"]["needed by"]))
        self.assertTrue(any("frontiers-print" in n for n in rows["tinytex"]["needed by"]))

    def test_doctor_lists_every_opt_in_override_that_is_set(self):  # 0025 FR-019
        code, doc = run_json(["doctor"], env={"AGORA_NODE": "/no/such/node"})
        self.assertEqual(doc["data"]["overrides"], [{"entry": "node", "variable": "AGORA_NODE", "path": "/no/such/node", "present": False}])
        self.assertEqual(run_json(["doctor"])[1]["data"]["overrides"], [])

    def test_doctor_fails_on_a_registry_conflict(self):
        from agora.core.registry import Command, Registry
        reg = Registry.load(HOME)
        reg.add_command(Command(("spec", "show"), "read", group="other"))
        code, doc = run_json(["doctor"], registry=reg)
        self.assertEqual((code, doc["data"]["status"]), (1, "failed"))

    def test_lock_with_nothing_pinned_reports_nothing_to_lock(self):
        code, doc = run_json(["lock", "core"])
        self.assertEqual((code, doc["data"]["locked"]), (0, []))
        code, doc = run_json(["lock", "spec", "--dry-run"])
        self.assertEqual(code, 0)

    def test_lock_refuses_offline(self):
        code, doc = run_json(["lock", "--offline"])
        self.assertEqual((code, doc["data"]["code"]), (3, "offline"))
        code, doc = run_json(["lock"], env={"AGORA_OFFLINE": "1"})
        self.assertEqual(code, 3)
