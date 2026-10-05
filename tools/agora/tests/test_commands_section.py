import json
import re
import shutil
import tempfile
import unittest
from pathlib import Path

from .helpers import HOME, copy_guide, run_json


class CommandsSection(unittest.TestCase):
    """0042 FR-004: the registry and the ontology list the same commands, with the same noun, verb and category."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.home = Path(self.tmp.name)
        shutil.copytree(HOME / "tools" / "agora", self.home / "tools" / "agora", ignore=shutil.ignore_patterns("__pycache__", "tests"))
        (self.home / "ontology").mkdir()
        shutil.copy(HOME / "agora", self.home / "agora")
        shutil.copy(HOME / ".if-console.env", self.home / ".if-console.env")
        shutil.copy(HOME / ".gitignore", self.home / ".gitignore")
        shutil.copy(HOME / "README.md", self.home / "README.md")
        copy_guide(self.home)
        self.ttl = (HOME / "ontology" / "ifcore.ttl").read_text()

    def findings(self, ttl=None):
        (self.home / "ontology" / "ifcore.ttl").write_text(self.ttl if ttl is None else ttl)
        code, doc = run_json(["check", "commands"], home=self.home)
        return code, [f["message"] for f in doc["data"]["sections"][0]["findings"]]

    def test_they_agree_here(self):
        self.assertEqual(self.findings(), (0, []))

    def test_a_command_the_ontology_lacks(self):
        ttl = re.sub(r"ifcore:AgoraSpecShowCommand a .*?hasAudience ifcore:Public \.\n", "", self.ttl, flags=re.S)
        code, found = self.findings(ttl)
        self.assertEqual(code, 1)
        self.assertTrue(any("'spec show' is in the registry and has no ifcore:Command individual" in m for m in found))

    def test_a_command_the_registry_lacks(self):
        extra = ('ifcore:AgoraSpecFrobCommand a ifcore:Command ; ifcore:commandOf ifcore:Agora ; dcterms:identifier "spec frob" ;\n'
                 '    ifcore:commandNoun ifcore:SpecResourceKind ; ifcore:commandCategory ifcore:ReadCommandCategory .\n')
        code, found = self.findings(self.ttl + "\n" + extra)
        self.assertEqual(code, 1)
        self.assertTrue(any("declares command 'spec frob', which the registry does not" in m for m in found))

    def test_a_category_noun_or_verb_that_differs(self):
        ttl = self.ttl.replace('dcterms:identifier "spec show" ;\n    ifcore:commandNoun ifcore:SpecResourceKind ; ifcore:commandVerb ifcore:ShowCommandVerb ; ifcore:commandCategory ifcore:ReadCommandCategory',
                               'dcterms:identifier "spec show" ;\n    ifcore:commandNoun ifcore:TermResourceKind ; ifcore:commandVerb ifcore:ListCommandVerb ; ifcore:commandCategory ifcore:BuildCommandCategory')
        self.assertNotEqual(ttl, self.ttl)
        code, found = self.findings(ttl)
        self.assertEqual(code, 1)
        text = "\n".join(found)
        for k in ("noun", "verb", "category"):
            self.assertIn(f"{k} is", text)

    def test_a_readme_without_the_link_the_setup_or_help_fails_and_so_does_a_long_one(self):  # 0042 FR-036
        readme = self.home / "README.md"
        kept = readme.read_text()
        readme.write_text("# only a title\n")
        code, found = self.findings()
        self.assertEqual(code, 1)
        for want in ("does not link to the guide", "the one-time system ensure", "the help command"):
            self.assertTrue(any(want in x for x in found), want)
        readme.write_text(kept + "\nmore\n" * 130)
        code, found = self.findings()
        self.assertTrue(any("the README is short" in x for x in found))

    def test_the_guides_landing_page_and_workflow_are_checked(self):  # 0042 FR-035
        index = self.home / "docs" / "index.html"
        index.write_text(index.read_text().replace('assets/logo.webp', 'assets/invented.png', 1))
        self.assertTrue(any("assets/invented.png" in x for x in self.findings()[1]))
        copy_guide(self.home)
        (self.home / "docs" / "stray.txt").write_text("x")
        self.assertTrue(any("one hand-written page" in x for x in self.findings()[1]))
        (self.home / "docs" / "stray.txt").unlink()
        (self.home / ".github" / "workflows" / "pages.yml").unlink()
        self.assertTrue(any("published to GitHub Pages" in x for x in self.findings()[1]))

    def test_a_reference_to_a_script_agora_replaced_fails(self):  # 0042 FR-016
        (self.home / "notes.md").write_text("run tools/spec_check.py to check\n")
        code, found = self.findings()
        self.assertEqual(code, 1)
        self.assertTrue(any("refers to tools/spec_check.py" in x for x in found))

    def test_a_section_or_generator_with_no_watched_paths_fails(self):  # 0041 FR-032
        m = self.home / "tools" / "agora" / "groups" / "spec" / "agora.toml"
        m.write_text(m.read_text().replace('watch = ["spec-kit/controls.tsv", "spec-kit/specs/**", "design-systems/*/spec.md", "ontology/ifcore.ttl"]\n', ""))
        code, found = self.findings()
        self.assertEqual(code, 1)
        self.assertTrue(any("section controls declares no watched paths" in x for x in found))

    def test_a_proposal_that_does_not_replay_fails(self):  # 0042 FR-029
        d = self.home / ".agora" / "proposals"
        d.mkdir(parents=True)
        (d / "0001-spec-set.json").write_text(json.dumps({"id": "0001-spec-set", "status": "open", "resource": "spec:0042", "reason": "x",
                                                          "action": {"command": "spec show", "fields": {"spec": "0042"}}}))
        code, found = self.findings()
        self.assertEqual(code, 1)
        self.assertTrue(any("is a read command: only record, generate, decision" in x for x in found))

    def test_a_manifest_section_with_no_implementation(self):
        m = self.home / "tools" / "agora" / "groups" / "spec" / "agora.toml"
        m.write_text(m.read_text() + '\n[sections.ghost]\nhelp = "x"\n')
        code, found = self.findings()
        self.assertTrue(any("section ghost is declared" in x for x in found))


class Workflows(CommandsSection):
    """0042 FR-022: a workflow calls agora and no other tool of this repository's own."""

    def workflow(self, text):
        d = self.home / ".github" / "workflows"
        d.mkdir(parents=True, exist_ok=True)
        (d / "w.yml").write_text(text)
        return self.findings()

    def test_a_workflow_calling_agora_passes(self):
        self.assertEqual(self.workflow("jobs:\n  a:\n    steps:\n      - run: ./agora check --suite spec\n"), (0, []))

    def test_a_workflow_that_never_calls_agora_fails(self):
        code, found = self.workflow("jobs:\n  a:\n    steps:\n      - run: echo hi\n")
        self.assertEqual(code, 1)
        self.assertTrue(any("calls agora, as ./agora" in m for m in found))

    def test_a_workflow_calling_another_script_under_tools_fails_but_a_comment_may_name_one(self):
        code, found = self.workflow("# was tools/run_assurance.sh\njobs:\n  a:\n    steps:\n      - run: ./agora check && tools/other.sh --x\n")
        self.assertEqual(code, 1)
        self.assertEqual([m for m in found if "other than agora" in m].__len__(), 1)
        self.assertTrue(any("tools/other.sh" in m for m in found))


class AgoraWorkflow(unittest.TestCase):
    """0042 FR-022: doctor's exit 3 is a visible warning naming what is missing, and any other failure fails the job; the
    workflow that proves the generators and runs the tests installs no program and runs in no image."""

    def test_doctor_exit_3_is_a_warning_and_every_other_status_fails(self):
        self.assertFalse((HOME / ".github" / "workflows" / "reference-environment.yml").exists())
        text = (HOME / ".github" / "workflows" / "agora.yml").read_text()
        step = text.split("- name: agora's doctor\n", 1)[1].split("      - name:", 1)[0]
        self.assertIn('-eq 3', step)
        self.assertIn("::warning", step)
        self.assertIn("missing: ", step)  # what doctor reports as missing is named in the warning
        self.assertIn('exit "$code"', step)
        for command in ("./agora fresh", "./agora test"):
            self.assertIn(command, text)
        for gone in ("apt-get", "docker", "container:"):
            self.assertNotIn(gone, text)

    def test_the_gap_is_recorded_as_an_open_question(self):
        spec = (HOME / "spec-kit" / "specs" / "0042-agora" / "spec.md").read_text()
        self.assertIn("potrace", spec.split("## Open questions")[1].split("## Key entities")[0])
