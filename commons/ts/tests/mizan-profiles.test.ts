/**
 * Subject profiles (commons 0029-subject-profiles): the kinds of subject and the audience models as typed individuals of Mizan's ontology, with the sections, templates, proofs, standards and laws
 * of each, and the first check, which reads the head of a specification (`**Subject:**`, `**Audience:**`) and reports the sections its profile asks for that it lacks. The check runs on real
 * folders in temporary directories, through `holdHarness` as a harness runs it, and the baseline is a real file.
 *
 * @module
 */
import { audienceModels, authorities, subjectKinds } from "../../ontology/mizan/mod.ts";
import { holdHarness } from "../mizan/harness.ts";
import {
  commonsAudienceProfiles,
  commonsAuthorities,
  commonsSubjectProfiles,
  declaredIn,
  earsPatternOf,
  mizanFindings,
  profileKind,
  profileSections,
  rulePlugins,
} from "../mizan/rules.ts";
import { ruleRunsAt } from "../mizan/levels.ts";
import { mkdirSync, readTextFileSync, withTempDir, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { join } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";

const SPEC = "0029-subject-profiles";
const kind = (key: string) => Object.values(subjectKinds).find((k) => k.values.label.value === key);
const audience = (key: string) => Object.values(audienceModels).find((a) => a.values.label.value === key);

proves(
  [`${SPEC} FR-001`],
  "five kinds of subject, each released as a work kind of the IFR vocabulary, with sections, templates, a proof and standards",
  () => {
    assertEquals(
      Object.values(subjectKinds).map((k) => k.values.label.value),
      ["library", "service", "application", "integration", "platform"],
    );
    const workKind = (key: string): string | undefined => kind(key)?.values.workKind;
    assertEquals(workKind("library"), "https://www.intellectualfrontiers.com/ontology/ifr#Library");
    for (const key of ["service", "application", "integration", "platform"])
      assertEquals(workKind(key), "https://www.intellectualfrontiers.com/ontology/ifr#Software");
    for (const k of Object.values(subjectKinds))
      assert(
        k.values.proofForm.length > 0 && (k.values.requirementTemplate ?? []).length > 0,
        `${k.values.label.value} has a proof and a template`,
      );
  },
);

proves(
  [`${SPEC} FR-002`],
  "the head names the kind and the audience, in any case, the first line counting; a kind or audience that is none of the ontology's is found",
  () => {
    assertEquals(declaredIn("# T\n\n**Spec ID:** 0001-x\n**Subject:** Service\n**Subject:** library\n\n## A\n", "Subject"), {
      value: "service",
      line: 4,
    });
    assertEquals(declaredIn("# T\n\n## A\n\n**Subject:** service\n", "Subject"), undefined);
    assertEquals(declaredIn("# T\n**Audience:** B2B2C\n", "Audience"), { value: "b2b2c", line: 2 });
    const plugin = profileKind(commonsSubjectProfiles, commonsAudienceProfiles);
    const found = plugin.check({ slug: "0001-x", spec: "# T\n\n**Subject:** gadget\n**Audience:** consumer\n\n## A\n" });
    assertEquals(
      found.map((f) => f.key),
      ["mizan/profile-unknown specs/0001-x/spec.md Subject gadget", "mizan/profile-unknown specs/0001-x/spec.md Audience consumer"],
    );
    assertStringIncludes(found[0]?.message ?? "", "library, service, application, integration, platform");
    assertEquals(plugin.check({ slug: "0001-x", spec: "# T\n\n**Subject:** service\n**Audience:** b2b\n" }), []);
    assertEquals(plugin.check({ slug: "0001-x", spec: "# T\n\n**Subject:**\n" }).length, 1);
  },
);

proves([`${SPEC} FR-003`], "every section a profile asks for has at least one requirement template in an EARS pattern", () => {
  for (const p of [...Object.values(subjectKinds), ...Object.values(audienceModels)]) {
    const templates = p.values.requirementTemplate ?? [];
    assert(templates.length >= Math.min(1, (p.values.requiresSection ?? []).length), `${p.values.label.value} has templates`);
    if ((p.values.requiresSection ?? []).length > 0)
      assert(templates.length >= 2, `${p.values.label.value} has a template for its sections`);
    for (const t of templates) {
      assert(t.startsWith("Given ") || /MUST/.test(t), `${p.values.label.value}: ${t} has a keyword`);
      assert(t.startsWith("Given ") || earsPatternOf(t.replace(/<[^>]*>/g, "x")) !== undefined, `${t} is in an EARS pattern`);
    }
  }
});

proves(
  [`${SPEC} FR-004`, `${SPEC} FR-005`, `${SPEC} FR-006`, `${SPEC} FR-007`],
  "each kind asks for the sections its requirement names, and a library for none",
  () => {
    const sections = (key: string): readonly string[] => kind(key)?.values.requiresSection ?? [];
    assertEquals(sections("library"), []);
    assertEquals(sections("service"), ["Contract", "Contract tests", "Service level objectives", "Quality attributes"]);
    assertEquals(sections("application"), ["User journeys", "Accessibility", "Design system"]);
    assertEquals(sections("integration"), ["Contract", "Contract tests"]);
    assertEquals(sections("platform"), ["Contract", "Contract tests", "Service level objectives"]);
    const standards = (key: string): string => (kind(key)?.values.profileStandard ?? []).join(" | ");
    for (const s of ["OpenAPI Specification 3.1", "AsyncAPI", "JSON Schema", "OpenTelemetry", "ISO/IEC 25010"])
      assertStringIncludes(standards("service"), s);
    for (const s of ["WCAG", "Gherkin"]) assertStringIncludes(standards("application"), s);
    assertStringIncludes(kind("application")?.values.proofForm ?? "", "review");
    assertStringIncludes(kind("service")?.values.proofForm ?? "", "OpenTelemetry");
  },
);

proves(
  [`${SPEC} FR-008`, `${SPEC} FR-009`, `${SPEC} FR-010`],
  "b2b asks for five sections and b2b2c for those and three more, citing the laws of consumer privacy",
  () => {
    assertEquals(
      Object.values(audienceModels).map((a) => a.values.label.value),
      ["b2b", "b2b2c"],
    );
    const b2b = audience("b2b")?.values.requiresSection ?? [];
    const b2b2c = audience("b2b2c")?.values.requiresSection ?? [];
    assertEquals(b2b, ["Tenant isolation", "Service level agreements", "Audit trail", "Data processing", "Security controls"]);
    assertEquals(b2b2c, [...b2b, "Actor roles", "Consumer privacy and consent", "Data boundaries"]);
    const standards = (audience("b2b")?.values.profileStandard ?? []).join(" | ");
    for (const s of ["SOC 2", "ISO/IEC 27001", "NIST SP 800-53"]) assertStringIncludes(standards, s);
    assertEquals(audience("b2b")?.values.profileAuthority, []);
    assertEquals(
      (audience("b2b2c")?.values.profileAuthority ?? []).map((a) => a.iri.split("/").pop()),
      ["authority-gdpr", "authority-ccpa"],
    );
    assertStringIncludes((audience("b2b2c")?.values.requirementTemplate ?? []).join("\n"), "operator, a partner or an end user");
  },
);

proves(
  [`${SPEC} FR-014`],
  "the General Data Protection Regulation and the California Consumer Privacy Act are authorities of the ontology, and a requirement may cite them",
  () => {
    const citations = authorities.map((a) => a.values.citation);
    assert(citations.includes("Regulation (EU) 2016/679") && citations.includes("California Civil Code section 1798.100 and following"));
    const ids = commonsAuthorities.map((a) => a.id);
    assert(ids.includes("mzid:authority-gdpr") && ids.includes("mzid:authority-ccpa"));
    const found = mizanFindings(
      [{ slug: "0001-x", spec: "- **FR-001**: The system MUST honor 45 CFR 164.502 (HIPAA). Authority: mzid:authority-gdpr\n" }],
      rulePlugins.filter((p) => p.id === "mizan/authority-citation"),
    );
    assertEquals(found.length, 1);
    assertStringIncludes(found[0]?.message ?? "", "none of the authorities it names");
  },
);

const HEAD = (subject: string, audience: string): string =>
  `# Feature Specification: X\n\n**Spec ID:** 0001-x\n**Status:** Draft\n${subject === "" ? "" : `**Subject:** ${subject}\n`}${audience === "" ? "" : `**Audience:** ${audience}\n`}\n`;
const rest = (headings: readonly string[]): string =>
  `${headings.map((h) => `## ${h}\n\n- **FR-00${headings.indexOf(h) + 1}**: The thing MUST work.\n`).join("\n")}`;
const keys = (slug: string, spec: string): readonly string[] =>
  profileSections(commonsSubjectProfiles, commonsAudienceProfiles)
    .check({ slug, spec })
    .map((f) => f.key.replace(`mizan/profile-section-missing specs/${slug}/spec.md `, ""));

proves(
  [`${SPEC} FR-011`],
  "each section a profile asks for that a specification lacks is found once, a heading of level two or three that begins with it is present, in any case",
  () => {
    assertEquals(keys("0001-x", `${HEAD("service", "")}${rest(["Contract"])}`), [
      "service Contract tests",
      "service Service level objectives",
      "service Quality attributes",
    ]);
    assertEquals(
      keys(
        "0001-x",
        `${HEAD("service", "")}## Contract\n\n### contract tests of the queue\n\n## SERVICE LEVEL OBJECTIVES\n\n## Quality attributes\n`,
      ),
      [],
    );
    assertEquals(keys("0001-x", `${HEAD("application", "b2b2c")}${rest(["User journeys"])}`).length, 2 + 8);
    assertEquals(keys("0001-x", `${HEAD("", "b2b")}`).length, 5);
    // a section named only in a sentence is not a heading
    assertEquals(keys("0001-x", `${HEAD("integration", "")}## Contract\n\nThere are Contract tests here.\n`), [
      "integration Contract tests",
    ]);
  },
);

proves(
  [`${SPEC} FR-012`],
  "a specification that declares nothing, or a library, has no finding, and the check runs from L1 and not at L0",
  () => {
    assertEquals(keys("0001-x", `${HEAD("", "")}${rest(["A"])}`), []);
    assertEquals(keys("0001-x", `${HEAD("library", "")}${rest(["A"])}`), []);
    assert(ruleRunsAt("mizan/profile-section-missing", "L1") && ruleRunsAt("mizan/profile-unknown", "L1"));
    assert(!ruleRunsAt("mizan/profile-section-missing", "L0"));
    // as a harness runs it: held by a baseline that only shrinks, and not read at L0
    return withTempDir((root) => {
      mkdirSync(join(root, "specs", "0001-x"), { recursive: true });
      writeTextFileSync(join(root, "specs", "0001-x", "spec.md"), `${HEAD("service", "")}${rest(["Contract"])}`);
      const base = { root, baselineFile: join(root, "mizan.baseline.txt"), today: "2026-11-18" };
      assertEquals(holdHarness(base), 1);
      assertEquals(holdHarness({ ...base, level: "L0" }), 0);
      assertEquals(holdHarness({ ...base, writeBaseline: true }), 0);
      assertEquals(
        readTextFileSync(base.baselineFile)
          .split("\n")
          .filter((l) => !l.startsWith("#") && l !== ""),
        [
          "mizan/profile-section-missing specs/0001-x/spec.md service Contract tests",
          "mizan/profile-section-missing specs/0001-x/spec.md service Quality attributes",
          "mizan/profile-section-missing specs/0001-x/spec.md service Service level objectives",
        ],
      );
      assertEquals(holdHarness(base), 0);
      // the section is written: its line is stale until deleted
      writeTextFileSync(
        join(root, "specs", "0001-x", "spec.md"),
        `${HEAD("service", "")}${rest(["Contract", "Contract tests", "Service level objectives", "Quality attributes"])}`,
      );
      assertEquals(holdHarness(base), 1);
      return Promise.resolve();
    });
  },
);

proves(
  [`${SPEC} FR-013`],
  "every standard of a profile is named with its edition or marked to verify, and no profile names a company",
  () => {
    for (const p of [...Object.values(subjectKinds), ...Object.values(audienceModels)]) {
      const text = [
        p.values.definition?.value ?? "",
        p.values.proofForm,
        ...(p.values.requirementTemplate ?? []),
        ...(p.values.profileStandard ?? []),
      ].join("\n");
      assert(!/intellectual|@|https?:/i.test(text.replace(/ifr#/g, "")), `${p.values.label.value} names no company, address or link`);
      for (const s of p.values.profileStandard ?? [])
        assert(
          /\d/.test(s) || /\(to verify/.test(s) || /^Gherkin/.test(s) || /OpenTelemetry|JSON Schema/.test(s),
          `${s} is named with its edition, or marked to verify`,
        );
    }
  },
);
