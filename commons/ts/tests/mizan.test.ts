/**
 * The rules Mizan adds to the format of a specification (commons 0003-mizan FR-013 to FR-015, 0018-standards-first FR-009): the EARS patterns and RFC 2119 keywords, the
 * form of a scenario, the Standards considered section of a plan, and the command that holds their findings against a baseline that only shrinks. The command is run as a
 * program on the runtime this test runs on, on specifications written into a temporary folder.
 *
 * @module
 */
import { makeTempDirSync, mkdirSync, readTextFileSync, removeSync, writeTextFileSync } from "../runtime/fs.ts";
import { fromFileUrl, dirname, resolve } from "../runtime/path.ts";
import { run, execPath } from "../runtime/proc.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../runtime/test.ts";
import { earsPatternOf, mizanFindings, rulePlugins, type RulePlugin, type SpecText } from "../mizan/rules.ts";
import { daysBetween, termFindings } from "../mizan/standards.ts";

const CHECK = resolve(dirname(fromFileUrl(import.meta.url)), "..", "mizan", "check.ts");

/** A specification in the commons form, with the requirement lines given. */
const spec = (slug: string, ...requirements: string[]): SpecText => ({
  slug,
  spec: `# Feature Specification: X\n\n${requirements.join("\n")}\n`,
});

proves(["0003-mizan FR-013"], "the six EARS patterns are told apart, and a trigger in no pattern is not one", () => {
  assertEquals(earsPatternOf("The checker MUST write nothing."), "ubiquitous");
  assertEquals(earsPatternOf("WHEN a file has no citation, the check MUST report it."), "event");
  assertEquals(earsPatternOf("WHILE a term is unaligned, the check MUST warn."), "state");
  assertEquals(earsPatternOf("IF a hash differs, THEN the import MUST be refused."), "unwanted");
  assertEquals(earsPatternOf("WHERE a harness has no windows, rung 6 MUST hold only headless hosts."), "optional");
  assertEquals(earsPatternOf("WHEN a term is added, WHILE it is unaligned, the check MUST count it."), "complex");
  assertEquals(earsPatternOf("IF a hash differs the import MUST be refused."), undefined);
  assertEquals(earsPatternOf("WHEN a file has no citation the check MUST report it."), undefined);
});

proves(
  ["0003-mizan FR-013"],
  "a requirement with no RFC 2119 keyword, and a trigger not in the form of its pattern, are named; one in a pattern is not",
  () => {
    const found = mizanFindings([
      spec(
        "0001-x",
        "- **FR-001**: The checker MUST write nothing.",
        "- **FR-002**: The checker does what is needed.",
        "- **FR-003**: IF a hash differs the import MUST be refused.",
        "- **FR-004**: WHEN a file has no citation, the check MUST report it, and a very long sentence",
        "  that goes on over two lines SHOULD still be read as one.",
      ),
    ]);
    assertEquals(
      found.map((f) => f.key),
      ["mizan/requirement-keyword specs/0001-x/spec.md FR-002", "mizan/requirement-ears specs/0001-x/spec.md FR-003"],
    );
    assertStringIncludes(found[0]?.message ?? "", "MUST NOT, SHOULD, SHOULD NOT, MAY");
  },
);

proves(["0003-mizan FR-014"], "a scenario with Given, When, Then in order that cites a requirement is not named, and any other is", () => {
  const text = [
    "# Feature Specification: X",
    "",
    "1. **Given** a file, **When** it has no line, **Then** the check fails, per FR-001.",
    "2. **Given** a file, **Then** the check fails, **When** it has no line, per FR-001.",
    "3. **Given** a file, **When** it has no line, **Then** the check fails.",
    "4. **Given** a file only.",
    "",
  ].join("\n");
  const found = mizanFindings([{ slug: "0001-x", spec: text }]).filter((f) => f.rule === "mizan/scenario-form");
  assertEquals(
    found.map((f) => f.line),
    [4, 5, 6],
  );
  assertStringIncludes(found[1]?.message ?? "", "cites no requirement");
});

proves(["0018-standards-first FR-009"], "a plan with no Standards considered section is named, and one with it, or no plan, is not", () => {
  const base = { slug: "0001-x", spec: "- **FR-001**: It MUST work.\n" };
  assertEquals(
    mizanFindings([{ ...base, plan: "## Summary\n\nWords.\n" }]).map((f) => f.key),
    ["mizan/standards-considered specs/0001-x/plan.md plan"],
  );
  assertEquals(mizanFindings([{ ...base, plan: "## Standards considered\n\nschema.org.\n" }]), []);
  assertEquals(mizanFindings([base]), []);
});

proves(["0003-mizan FR-013"], "a harness adds its own rule as a plugin, run beside Mizan's", () => {
  const plugin: RulePlugin = {
    id: "mizan/requirement-keyword",
    check: (s) => [
      { file: `specs/${s.slug}/spec.md`, line: 1, rule: "mizan/requirement-keyword", message: "its own", key: `own ${s.slug}` },
    ],
  };
  assertEquals(
    mizanFindings([spec("0001-x", "- **FR-001**: It MUST work.")], [...rulePlugins, plugin]).map((f) => f.key),
    ["own 0001-x"],
  );
});

/** The command as a program, in a folder of specifications written to disk. */
async function command(root: string, ...args: string[]): Promise<{ code: number; stderr: string; stdout: string }> {
  const o = await run([execPath(), CHECK, "--root", root, ...args]);
  return { code: o.code, stderr: o.stderr, stdout: o.stdout };
}

proves(
  ["0003-mizan FR-015"],
  "a new finding fails, the baseline holds it, a fixed one makes its baseline line stale, and the baseline only shrinks",
  async () => {
    const root = makeTempDirSync({ prefix: "mizan-rules-" });
    try {
      mkdirSync(`${root}/specs/0001-x`, { recursive: true });
      const specFile = `${root}/specs/0001-x/spec.md`;
      writeTextFileSync(specFile, "# Feature Specification: X\n\n- **FR-001**: It does what is needed.\n");
      const fresh = await command(root);
      assertEquals(fresh.code, 1);
      assertStringIncludes(fresh.stderr, "mizan/requirement-keyword: FR-001 has none of MUST");
      const written = await command(root, "--write-baseline");
      assertEquals(written.code, 0);
      assertStringIncludes(readTextFileSync(`${root}/mizan.baseline.txt`), "mizan/requirement-keyword specs/0001-x/spec.md FR-001");
      assertEquals((await command(root)).code, 0);
      writeTextFileSync(specFile, "# Feature Specification: X\n\n- **FR-001**: It MUST do what is needed.\n");
      const stale = await command(root);
      assertEquals(stale.code, 1);
      assertStringIncludes(stale.stderr, "no longer occurs; delete the line, the baseline only shrinks");
      assertEquals((await command(root, "--write-baseline")).code, 0);
      assertEquals((await command(root)).code, 0);
      writeTextFileSync(specFile, "# Feature Specification: X\n\n- **FR-001**: It MUST do what is needed.\n- **FR-002**: Nor this.\n");
      assertEquals((await command(root)).code, 1);
    } finally {
      removeSync(root, { recursive: true });
    }
  },
);

proves(["0003-mizan FR-015"], "commons' own folder passes with the baseline it holds", async () => {
  const o = await run([execPath(), CHECK]);
  assertEquals([o.code, o.stdout], [0, ""]);
  assert(o.stderr.includes("passed"));
});

proves(
  ["0018-standards-first FR-003", "0018-standards-first FR-004"],
  "a term on a standard must name its term, and an unaligned term must say why",
  () => {
    const found = termFindings(
      [
        { iri: "https://x/A", basis: "specializes", decision: false },
        { iri: "https://x/B", basis: "adopts", standardTerm: "https://s/B", decision: false },
        { iri: "https://x/C", basis: "unaligned", decision: true },
      ],
      "2026-11-17",
    );
    assertEquals(
      found.map((f) => f.key),
      ["mizan/term-standard https://x/A", "mizan/unaligned-justification https://x/C"],
    );
  },
);

proves(
  ["0018-standards-first FR-005"],
  "a decision is due 90 days after the term: missing within them, overdue after, and none where one is linked",
  () => {
    const term = (addedOn: string, decision = false) => ({
      iri: "https://x/T",
      basis: "unaligned" as const,
      justification: "none found",
      addedOn,
      decision,
    });
    assertEquals(daysBetween("2026-11-17", "2027-02-15"), 90);
    assertEquals(daysBetween("2026-11-17", "not a day"), undefined);
    assertEquals(
      termFindings([term("2026-11-17")], "2026-11-17").map((f) => f.rule),
      ["mizan/decision-missing"],
    );
    assertEquals(
      termFindings([term("2026-11-17")], "2027-02-15").map((f) => f.rule),
      ["mizan/decision-missing"],
    );
    assertEquals(
      termFindings([term("2026-11-17")], "2027-02-16").map((f) => f.rule),
      ["mizan/decision-overdue"],
    );
    assertEquals(termFindings([term("2026-11-17", true)], "2030-01-01"), []);
    assertEquals(
      termFindings([{ iri: "https://x/U", basis: "unaligned", justification: "none found", decision: false }], "2026-11-17").map(
        (f) => f.rule,
      ),
      ["mizan/decision-missing"],
    );
  },
);

proves(
  ["0018-standards-first FR-005"],
  "commons' own folder holds Mizan's terms: the baseline holds the missing decisions within 90 days, and one overdue fails whatever it holds",
  async () => {
    const within = await run([execPath(), CHECK, "--today", "2027-02-15"]);
    assertEquals(within.code, 0);
    const late = await run([execPath(), CHECK, "--today", "2027-02-16"]);
    assertEquals(late.code, 1);
    assertStringIncludes(late.stderr, "mizan/decision-overdue");
    assertStringIncludes(late.stderr, "its decision was due 1 days ago");
  },
);
