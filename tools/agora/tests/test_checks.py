import json
import unittest

from .helpers import HOME, TempRepo, run, run_json, spec_text


class Sections(TempRepo):
    def test_a_valid_repository_passes_every_section(self):
        doc = self.check("specs", "register", "controls", "ontology")
        self.assertEqual((self.last_code, doc["data"]["status"]), (0, "passed"))
        self.assertEqual(doc["audience"], "unstated")

    # specs ---------------------------------------------------------------------------------------------------
    def test_specs_missing_closing_section(self):
        self.write("spec-kit/specs/0001-first/spec.md", spec_text("0001-first").replace("## Assumptions\n\n- A condition.\n", ""))
        self.assertTrue(any("missing '## Assumptions'" in m for m in self.findings("specs")))
        self.assertEqual(self.last_code, 1)

    def test_specs_bad_status_and_missing_superseder(self):
        self.write("spec-kit/specs/0001-first/spec.md", spec_text("0001-first", status="Done"))
        self.assertTrue(any("is not Draft, Adopted" in m for m in self.findings("specs")))
        self.write("spec-kit/specs/0001-first/spec.md", spec_text("0001-first", status="Superseded by 0099-nothing"))
        self.assertTrue(any("0099-nothing, which does not exist" in m for m in self.findings("specs")))

    def test_specs_identity_and_numbering(self):
        self.write("spec-kit/specs/0001-first/spec.md", spec_text("0002-other"))
        self.assertTrue(any("does not match its directory" in m for m in self.findings("specs")))
        self.write("spec-kit/specs/0001-first/spec.md", spec_text("0001-first"))
        self.write("spec-kit/specs/0003-Bad_Name/spec.md", spec_text("0003-Bad_Name"))
        self.assertTrue(any("must be NNNN-slug" in m or "spec" in m for m in self.findings("specs")))

    def test_specs_duplicate_identifier_dated_provenance_and_unknown_citation(self):
        extra = "- **FR-001**: Again MUST.\nSee 0099-ghost FR-001, and 2026-01-01 was a day.\n"
        self.write("spec-kit/specs/0001-first/spec.md", spec_text("0001-first", extra=extra))
        found = "\n".join(self.findings("specs"))
        self.assertIn("FR-001 is defined twice", found)
        self.assertIn("dated provenance", found)
        self.assertIn("cites 0099-ghost, which does not exist", found)

    def test_specs_citation_of_a_missing_requirement(self):
        self.write("spec-kit/specs/0001-first/spec.md", spec_text("0001-first", extra="See 0001-first FR-009.\n"))
        self.assertTrue(any("cites 0001-first FR-009, which does not exist" in m for m in self.findings("specs")))

    def test_specs_loose_identifier_is_warned_unless_a_spec_claims_it(self):
        filler = "A sentence that keeps the spec's own name out of reach. " * 6
        extra = f"{filler}\nA rule, per FR-007.\n{filler}\nAnother, per 0001-first FR-001. A further rule of 0001-first, per FR-009.\n"
        self.write("spec-kit/specs/0001-first/spec.md", spec_text("0001-first", extra=extra))
        found = "\n".join(self.findings("specs"))
        self.assertIn("FR-007 is not defined in this spec; name the spec it belongs to", found)
        self.assertNotIn("FR-009 is not defined", found)
        self.assertNotIn("FR-001 is not defined", found)

    def test_specs_edge_case_without_requirement(self):
        self.write("spec-kit/specs/0001-first/spec.md", spec_text("0001-first").replace("- A case, per FR-001.", "- A case with no citation."))
        self.assertTrue(any("edge case cites no requirement" in m for m in self.findings("specs")))

    def test_specs_scope_limits_to_one_spec(self):
        self.write("spec-kit/specs/0002-second/spec.md", spec_text("0002-second", status="Done"))
        self.write("spec-kit/enforcement.tsv", self.root.joinpath("spec-kit/enforcement.tsv").read_text() + "0002-second FR-001\tnone\t-\t\n")
        code, doc = run_json(["check", "specs", "--scope", "0001", "--root", str(self.root)])
        self.assertEqual(code, 0)
        code, doc = run_json(["check", "specs", "--scope", "0002", "--root", str(self.root)])
        self.assertEqual(code, 1)

    # register ------------------------------------------------------------------------------------------------
    def reg(self, *rows):
        self.write("spec-kit/enforcement.tsv", "requirement\tmechanism\tby\tnote\n" + "".join(r + "\n" for r in rows))

    def test_register_missing_row_extra_row_and_duplicate(self):
        self.reg()
        self.assertTrue(any("0001-first FR-001 has no row" in m for m in self.findings("register")))
        self.reg("0001-first FR-001\tnone\t-", "0001-first FR-001\tnone\t-", "0001-first FR-002\tnone\t-")
        found = "\n".join(self.findings("register"))
        self.assertIn("more than one row", found)
        self.assertIn("0001-first FR-002 does not exist", found)

    def test_register_unknown_mechanism_and_malformed_rows(self):
        self.reg("0001-first FR-001\tmaybe\t-")
        self.assertTrue(any("mechanism 'maybe'" in m for m in self.findings("register")))
        self.reg("0001-first FR-001\tnone")
        self.assertTrue(any("tab-separated" in m for m in self.findings("register")))
        self.reg("0001-first FR-1\tnone\t-")
        self.assertTrue(any("is not '<spec> FR-NNN'" in m for m in self.findings("register")))

    def test_register_check_row_names_repository_and_command(self):
        self.reg("0001-first FR-001\tcheck\tmake check")
        self.assertTrue(any("names its repository and command" in m for m in self.findings("register")))
        self.reg("0001-first FR-001\tcheck\tnowhere: do it")
        self.assertTrue(any("names its repository and command" in m for m in self.findings("register")))

    def test_register_public_row_must_name_a_registered_agora_command(self):
        rn = "ws"  # the repository's own register name comes from the manifest
        from agora.core.registry import Registry
        own = Registry.load(HOME).root_manifest["register_name"]
        for by, bad in ((f"{own}: agora check specs", False), (f"{own}: agora check --suite spec", False),
                        (f"{own}: agora check design-systems --runner browser --scope frontiers-brand", False),
                        (f"{own}: agora check nonsense", True), (f"{own}: agora frobnicate", True),
                        (f"{own}: make check", True), (f"{own}: agora check --suite nope", True),
                        (f"{own}: agora check specs --runner browser", True),
                        (f"{own}: agora check design-systems --scope no-such-system", True),
                        (f"{own}: agora check --bogus", True)):
            with self.subTest(by=by):
                self.reg(f"0001-first FR-001\tcheck\t{by}")
                found = self.findings("register")
                self.assertEqual(bool(found), bad, found)

    def test_register_review_row_must_cite_a_requirement(self):
        self.reg("0001-first FR-001\treview\t0001-first FR-001")
        self.assertEqual(self.findings("register"), [])
        self.reg("0001-first FR-001\treview\t0001-first FR-077")
        self.assertTrue(any("a review row cites the requirement" in m for m in self.findings("register")))

    def test_register_reports_none_rows_every_run(self):
        doc = self.check("register")
        self.assertEqual(doc["data"]["sections"][0]["data"]["none"], [{"requirement": "0001-first FR-001", "note": "not yet"}])

    # controls ------------------------------------------------------------------------------------------------
    def test_controls(self):
        self.write("spec-kit/controls.tsv", "requirement\tcontrol\tnote\n0001-first FR-001\tnope:none\t\n"
                   "0001-first FR-009\tnope:none\t\nbad\n")
        found = "\n".join(self.findings("controls"))
        self.assertIn("is not '<catalog>:<control>'", found)
        self.assertIn("0001-first FR-009 does not exist", found)
        self.assertIn("requirement, control", found)
        self.write("spec-kit/controls.tsv", "requirement\tcontrol\tnote\n")
        self.assertEqual(self.findings("controls"), [])

    # ontology ------------------------------------------------------------------------------------------------
    def test_ontology_bare_prefix(self):
        self.write("ontology/x.ttl", "@prefix if: <http://x/> .\n")
        self.assertTrue(any("bare if: prefix" in m for m in self.findings("ontology")))

    def test_ontology_design_system_registration(self):
        self.write("design-systems/thing-web/spec.md", spec_text("thing-web"))
        found = "\n".join(self.findings("ontology"))
        self.assertIn("is not registered in ifcore.ttl", found)

    def test_ontology_registered_design_system_without_directory(self):
        self.write("design-systems/README.md", "x")
        self.write("ontology/ifcore.ttl", 'ifcore:Ghost a ifcore:DesignSystem ;\n    dcterms:identifier "ghost-web" ;\n    dcterms:type ifcore:WebDesignSystemKind ;\n    dcterms:title "x" .\n')
        found = "\n".join(self.findings("ontology"))
        self.assertIn("ghost-web is registered but design-systems/ghost-web/ does not exist", found)
        self.assertIn("names no interaction model", found)

    def test_findings_name_their_location_and_the_next_action(self):
        self.write("spec-kit/specs/0001-first/spec.md", spec_text("0001-first", status="Done"))
        doc = self.check("specs")
        f = doc["data"]["sections"][0]["findings"][0]
        self.assertIn("0001-first/spec.md", f["where"])
        self.assertIn("run `check specs`", f["next"])
        self.assertEqual(doc["actions"][0]["cli"], "agora check specs")


class Selection(unittest.TestCase):
    def test_suite_spec_passes_on_this_repository(self):
        code, doc = run_json(["check", "--suite", "spec"])
        self.assertEqual((code, doc["data"]["status"]), (0, "passed"))
        self.assertEqual([s["name"] for s in doc["data"]["sections"]],
                         ["specs", "register", "controls", "ontology", "toolchain", "commands"])
        self.assertEqual(doc["audience"], "public")

    def test_a_suite_that_names_no_section_ran_nothing_and_fails(self):
        from agora.core.registry import Registry
        reg = Registry.load(HOME)
        reg.suites["empty"] = {"sections": [], "options": {}}
        code, doc = run_json(["check", "--suite", "empty"], registry=reg)
        self.assertEqual((code, doc["kind"], doc["data"]["code"]), (1, "error", "empty"))

    def test_plain_check_runs_every_section(self):
        from unittest import mock
        from agora.core.checks import SectionResult
        from agora.core.registry import Registry
        reg = Registry.load(HOME)
        for n in ("design-systems", "imagery", "openedx", "figures", "voice", "slides", "email", "course", "media", "signage",
                  "merchandise", "extension"):  # the harnesses, the extension and item checks have their own tests; this one proves the selection
            reg.sections[n].fn = lambda ctx, scope, n=n: SectionResult(n)
            reg.sections[n].toolchain = ()
        with mock.patch("agora.core.worker.needs_worker", return_value=False):
            code, doc = run_json(["check"], registry=reg)
        self.assertEqual(code, 0)
        self.assertEqual(doc["data"]["summary"]["run"], 18)

    def test_scope_and_options_must_apply(self):
        self.assertEqual(run(["check", "controls", "--scope", "x"])[0], 2)
        self.assertEqual(run(["check", "specs", "--runner", "browser"])[0], 2)
        self.assertEqual(run(["check", "specs", "--scope", "no-such-spec"])[0], 2)

    def test_root_is_refused_by_a_section_that_is_not_relocatable(self):
        code, doc = run_json(["check", "commands", "--root", str(HOME / "design-systems")])
        self.assertEqual((code, doc["data"]["code"]), (2, "usage"))

    def test_a_toolchain_entry_that_cannot_be_had_skips_the_section_and_fails_the_run(self):
        from unittest import mock
        from agora.core import toolchain
        from agora.core.registry import Registry
        reg = Registry.load(HOME)
        reg.sections["controls"].toolchain = ("no-such-tool",)
        nobuild = toolchain.Entry("no-such-tool", "1.0", "x", {}, lambda p: {})  # no build for any platform
        with mock.patch.object(toolchain, "discover", lambda: {"no-such-tool": nobuild}):
            code, doc = run_json(["check", "controls"], registry=reg)
        s = doc["data"]["sections"][0]
        self.assertEqual((code, s["status"], doc["data"]["status"]), (3, "skipped", "skipped"))
        self.assertIn("no-such-tool", s["reason"])
        self.assertIn("AGORA_NO_SUCH_TOOL", s["reason"])
