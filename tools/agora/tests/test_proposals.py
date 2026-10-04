"""Proposals (0041-command-line FR-039; 0042-agora FR-029) and the agent skill (FR-028)."""
import json
import shutil
import subprocess

from .helpers import HOME, TempRepo, run_json


class Proposals(TempRepo):
    def setUp(self):
        super().setUp()
        shutil.copytree(HOME / "tools" / "agora", self.root / "tools" / "agora", ignore=shutil.ignore_patterns("__pycache__", "tests"))
        shutil.copytree(HOME / "ontology", self.root / "ontology")
        self.write("README.md", "")

    def go(self, *argv):
        return run_json(list(argv), home=self.root)

    def new(self, *extra, resource="spec:0001", reason="it is ready", run="spec set", fields=("spec=0001", "status=Adopted")):
        argv = ["proposal", "new", resource, "--reason", reason, "--run", run]
        for f in fields:
            argv += ["--field", f]
        return self.go(*argv, *extra)

    def proposal_file(self, pid="0001-spec-set-0001-first"):
        return self.root / ".agora" / "proposals" / f"{pid}.json"

    def test_new_writes_a_tracked_replayable_file_and_leaves_the_commit_to_a_person(self):  # 0041 FR-039, FR-041
        code, doc = self.new()
        self.assertEqual(code, 0, doc)
        self.assertEqual(doc["id"], "0001-spec-set-0001-first")
        file = json.loads(self.proposal_file().read_text())
        self.assertEqual(file, {"id": "0001-spec-set-0001-first", "status": "open", "resource": "spec:0001-first", "reason": "it is ready",
                                "action": {"command": "spec set", "fields": {"spec": "0001", "status": "Adopted"}}})
        self.assertEqual(doc["data"]["command line"], "agora spec set 0001 --status Adopted")
        self.assertEqual(doc["actions"][0]["command"], "proposal advance")
        code, doc = self.new(fields=("spec=0001", "status=Superseded", "superseded_by=0001"))
        self.assertEqual(doc["id"], "0002-spec-set-0001-first")  # the next unused number

    def test_new_takes_dry_run_and_writes_nothing_then(self):  # 0041 FR-015
        code, doc = self.new("--dry-run")
        self.assertEqual((code, doc["data"]["dry_run"]), (0, True))
        self.assertFalse((self.root / ".agora" / "proposals").exists())

    def test_new_validates_the_action_as_the_command_would(self):  # 0042 FR-029
        for kwargs, why in (({"run": "spec show", "fields": ("spec=0001",)}, "is a read command"),
                            ({"run": "check", "fields": ()}, "is a check command"),
                            ({"run": "proposal advance", "fields": ("proposal=x",)}, "proposal command"),
                            ({"run": "no such", "fields": ()}, "no such"),
                            ({"fields": ("spec=0001", "status=Nonsense")}, "status"),
                            ({"fields": ("spec=9999", "status=Adopted")}, "spec"),
                            ({"fields": ("spec=0001", "colour=blue")}, "takes no field colour"),
                            ({"fields": ("spec=0001", "oops")}, "NAME=VALUE"),
                            ({"reason": "  "}, "reason"),
                            ({"resource": "nonsense:1"}, "nonsense")):
            with self.subTest(**kwargs):
                code, doc = self.new(**kwargs)
                self.assertGreaterEqual(code, 1, doc)
                self.assertEqual(doc["kind"], "error")
                self.assertIn(why, json.dumps(doc))
                self.assertFalse((self.root / ".agora" / "proposals").exists())

    def test_list_and_show_are_reads_that_name_the_action_as_a_command_line(self):
        self.new()
        code, doc = self.go("proposal", "list")
        self.assertEqual([r["id"] for r in doc["data"]["proposals"]], ["0001-spec-set-0001-first"])
        self.assertEqual(self.go("proposal", "list", "--status", "accepted")[1]["data"]["count"], 0)
        code, doc = self.go("proposal", "show", "0001-spec-set-0001-first")
        self.assertEqual((doc["data"]["status"], doc["data"]["command line"]), ("open", "agora spec set 0001 --status Adopted"))
        self.assertEqual(doc["actions"][0]["command"], "proposal advance")
        self.assertEqual(self.go("proposal", "show", "9999-nothing")[0], 2)
        for c in ("proposal list", "proposal show"):
            self.assertEqual(self.go("command", "show", c)[1]["data"]["category"], "read")

    def test_advance_shows_its_dry_run_replays_the_action_and_marks_it_accepted(self):  # 0041 FR-039, FR-015
        self.new()
        spec = self.root / "spec-kit" / "specs" / "0001-first" / "spec.md"
        before = spec.read_text()
        code, doc = self.go("proposal", "advance", "0001-spec-set-0001-first", "--dry-run")
        self.assertEqual((code, doc["data"]["status"], doc["data"]["dry_run"]), (0, "open", True))
        self.assertTrue(doc["data"]["preview"][0]["data"]["dry_run"])
        self.assertEqual(spec.read_text(), before)
        self.assertEqual(json.loads(self.proposal_file().read_text())["status"], "open")
        code, doc = self.go("proposal", "advance", "0001-spec-set-0001-first")
        self.assertEqual((code, doc["data"]["status"]), (0, "accepted"), doc)
        self.assertIn("**Status:** Adopted", spec.read_text())
        self.assertNotEqual(spec.read_text(), before)
        self.assertEqual(doc["data"]["preview"][0]["kind"], "spec")  # the dry run was shown first
        self.assertEqual(json.loads(self.proposal_file().read_text())["status"], "accepted")
        self.assertEqual(self.go("proposal", "list", "--status", "open")[1]["data"]["count"], 0)

    def test_advance_refuses_an_accepted_proposal_and_one_whose_dry_run_fails(self):
        self.new()
        self.go("proposal", "advance", "0001-spec-set-0001-first")
        code, doc = self.go("proposal", "advance", "0001-spec-set-0001-first")
        self.assertEqual((code, doc["data"]["code"]), (1, "accepted"))
        # the same move again cannot replay: Adopted cannot become Adopted, so the proposal stays open and nothing is written
        self.new(fields=("spec=0001", "status=Adopted"), reason="again")
        spec = self.root / "spec-kit" / "specs" / "0001-first" / "spec.md"
        before = spec.read_text()
        code, doc = self.go("proposal", "advance", "0002-spec-set-0001-first")
        self.assertEqual((code, doc["data"]["code"]), (1, "replay"))
        self.assertIn("stays open", doc["data"]["message"])
        self.assertEqual(spec.read_text(), before)
        self.assertEqual(json.loads(self.proposal_file("0002-spec-set-0001-first").read_text())["status"], "open")

    def test_the_surfaces_follow_the_categories_and_advance_is_never_on_mcp(self):  # 0041 FR-022, FR-023
        reg = {c["id"]: c for c in self.go("command", "list")[1]["data"]["commands"]}
        self.assertEqual(reg["proposal advance"]["surfaces"], ["terminal", "ui"])
        self.assertEqual(reg["proposal new"]["surfaces"], ["terminal", "ui", "mcp"])
        self.assertEqual(self.go("command", "show", "proposal new")[1]["data"]["category"], "record")
        self.assertEqual(self.go("command", "show", "proposal advance")[1]["data"]["category"], "decision")

    def test_a_proposal_command_never_commits_or_pushes(self):  # 0041 FR-041
        subprocess.run(["git", "init", "-q"], cwd=self.root, check=True)
        subprocess.run(["git", "add", "-A"], cwd=self.root, check=True)
        subprocess.run(["git", "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "x"], cwd=self.root, check=True)
        head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=self.root, capture_output=True, text=True).stdout
        self.new()
        self.go("proposal", "advance", "0001-spec-set-0001-first")
        self.assertEqual(subprocess.run(["git", "rev-parse", "HEAD"], cwd=self.root, capture_output=True, text=True).stdout, head)
        self.assertEqual(subprocess.run(["git", "diff", "--cached", "--name-only"], cwd=self.root, capture_output=True, text=True).stdout, "")

    def test_the_context_of_a_proposal_and_the_resource_it_concerns(self):  # 0041 FR-038
        self.new()
        code, doc = self.go("context", "proposal:0001-spec-set-0001-first")
        self.assertEqual((code, doc["id"]), (0, "proposal:0001-spec-set-0001-first"))
        self.assertEqual(doc["data"]["files"], [".agora/proposals/0001-spec-set-0001-first.json"])


class Skill(TempRepo):
    """The agent skill is written from the registry alone (0042 FR-028)."""

    def test_it_lists_exactly_the_registrys_commands_categories_and_surfaces_and_says_a_decision_is_for_a_person(self):  # 0041 FR-037
        from agora.core.registry import Registry
        from agora.lib import skill
        reg = Registry.load(HOME)
        text = skill.text(reg)
        for c in reg.commands.values():
            row = [l for l in text.splitlines() if l.startswith(f"| `{c.id}` | `{c.category}`")]
            self.assertEqual(len(row), 1, c.id)
            self.assertIn(f"`{c.category}`", row[0])
            self.assertIn(", ".join(["terminal", *reg.surfaces_of(c)]), row[0])
        for n in reg.nouns:
            self.assertIn(f"| `{n}` |", text)
        for s in reg.sections:
            self.assertIn(f"| `{s}` |", text)
        for g in reg.generators.values():
            self.assertIn(f"| `{g.name}` |", text)
        self.assertIn("A `decision` command is for a person", text)
        for d in ("spec set", "ink record", "proposal advance"):
            self.assertIn(f"`{d}`", text.split("A `decision` command is for a person")[1].split("\n")[0])
        self.assertIn("spec_show", text)
        self.assertNotIn("spec_set` |", text)  # a decision is no MCP tool
        self.assertIn("Generated by the agent-skill generator", text)
        self.assertEqual(text, skill.text(reg))  # deterministic

    def test_the_committed_skill_is_what_the_generator_writes(self):  # 0041 FR-036
        from agora.core.registry import Registry
        from agora.lib import skill
        self.assertEqual((HOME / skill.PATH).read_text(encoding="utf-8"), skill.text(Registry.load(HOME)))

    def test_it_depends_on_nothing_but_the_registry(self):  # 0042 FR-028
        import inspect
        from agora.lib import skill
        src = inspect.getsource(skill)
        self.assertNotIn("spec-kit", src)
        self.assertNotIn("read_text", src)
