/**
 * The rules Mizan adds to the format of a specification (commons 0003-mizan FR-013 to FR-015, 0018-standards-first FR-009): the EARS patterns and RFC 2119 keywords, the
 * form of a scenario, the Standards considered section of a plan, and the command that holds their findings against a baseline that only shrinks. The command is run as a
 * program on the runtime this test runs on, on specifications written into a temporary folder.
 *
 * @module
 */
import { makeTempDirSync, mkdirSync, readTextFileSync, removeSync, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { fromFileUrl, dirname, resolve } from "@intellectual-frontiers/system/path";
import { run, execPath } from "@intellectual-frontiers/system/proc";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { earsPatternOf, mizanFindings, rulePlugins, type RulePlugin, type SpecText } from "../mizan/rules.ts";
import { AUDITED_ON, packagingTerms } from "../../ontology/audit/mod.ts";
import { audienceModels, bases, conformanceLevels, conformanceRequirements, MZ, MZV, mz, subjectKinds } from "../../ontology/mizan/mod.ts";
import { en, named, iriIn, OWL, OwlOntology, ontologyOf, RDFS, triplesOf, turtle } from "@intellectual-frontiers/rdf";
import { exportHtmlView } from "../mizan/integrations/pure/export-html.ts";
import { pm } from "../../ontology/supply-chain/packaging/mod.ts";
import { basisMissing, daysBetween, termFindings } from "../mizan/standards.ts";
import { holdHarness } from "../mizan/harness.ts";
import { specTermFindings } from "../mizan/spec-terms.ts";
import { readSpecTexts } from "../mizan/check.ts";

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
    "5. **Given** a long scenario that wraps",
    "   over lines, **When** it is read as one item, **Then** it is in order, per FR-002.",
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

proves(
  ["0012-ontology FR-014", "0018-standards-first FR-003"],
  "a term of an ontology with no record of its basis is found, and every term of the packaging ontology has one",
  () => {
    assertEquals(
      basisMissing(["https://x/A", "https://x/B"], ["https://x/A"], "audit.ts").map((f) => f.key),
      ["mizan/term-basis-missing https://x/B"],
    );
    assertEquals(basisMissing(["https://x/A"], ["https://x/A", "https://x/Z"]), []);
    assertEquals(
      basisMissing(
        Object.values(pm).map((t) => t.iri),
        packagingTerms.map((t) => t.values.termIri),
      ),
      [],
    );
    assertEquals(Object.keys(pm).length, packagingTerms.length);
    const by = (basis: string) => packagingTerms.filter((t) => t.values.basis.iri === basis).length;
    assertEquals([by(bases.Specializes.iri), by(bases.Maps.iri), by(bases.Unaligned.iri)], [5, 5, 51]);
  },
);

proves(
  ["0012-ontology FR-014"],
  "a term's mapping names a standard term, and an unaligned term of the audit says why and when it was audited",
  () => {
    for (const t of packagingTerms) {
      if (t.values.basis.iri === bases.Unaligned.iri) {
        assert((t.values.justification ?? "").includes("Candidates to examine"), `${t.iri} names its candidates`);
        assertEquals(t.values.addedOn, AUDITED_ON);
      } else {
        assert((t.values.standardTerm ?? "").startsWith("https://schema.org/"), `${t.iri} names a schema.org term`);
        assert(t.values.mappingRelation !== undefined, `${t.iri} says its relation`);
      }
    }
  },
);

proves(
  ["0003-mizan FR-020"],
  "a prefixed name of an ontology the ontology does not define is found once with its line; a prefix not given, and a sentence's colon, are not read",
  () => {
    const found = specTermFindings(
      [
        {
          slug: "0001-x",
          spec: "Uses `mz:Rung`, `mz:Nothing` and `mz:Nothing` again.\nA `schema:Thing`, a **Status:** line, a URL `https://x/y` and `pm:Gone`.\n",
        },
      ],
      { mz: new Set(["Rung"]), pm: new Set(["Here"]) },
    );
    assertEquals(
      found.map((f) => `${f.key}@${f.line}`),
      ["mizan/spec-term-unknown specs/0001-x/spec.md mz:Nothing@1", "mizan/spec-term-unknown specs/0001-x/spec.md pm:Gone@2"],
    );
  },
);

proves(
  ["0003-mizan FR-020"],
  "commons' own specifications are read for real: they name terms of the packaging ontology, all defined, and an ontology with none defined would find them",
  () => {
    const specs = readSpecTexts(`${dirname(fromFileUrl(import.meta.url))}/../../spec-kit`);
    const known = {
      mz: new Set([
        ...Object.keys(mz),
        ...Object.keys(conformanceLevels),
        ...Object.keys(conformanceRequirements),
        ...Object.keys(subjectKinds),
        ...Object.keys(audienceModels),
      ]),
      pm: new Set(Object.keys(pm)),
    };
    assertEquals(specTermFindings(specs, known), []);
    const none = specTermFindings(specs, { pm: new Set() });
    assert(none.length >= 5, `${none.length} packaging terms are named in the specifications`);
  },
);

proves(["0012-ontology FR-015"], "a code list of 5,000 entries type-checks with a key type of its entries, within 30 seconds", async () => {
  const root = resolve(dirname(fromFileUrl(import.meta.url)), "..").replaceAll("\\", "/"); // forward slashes: the path is written into a TypeScript string
  const tsc = `${root}/node_modules/typescript/bin/tsc`;
  const dir = makeTempDirSync({ prefix: "mizan-codes-" });
  try {
    const rows = Array.from(
      { length: 5000 },
      (_, i) => `  Term${i}: { label: en("term ${i}"), definition: en("The term number ${i}.") },`,
    ).join("\n");
    writeTextFileSync(
      `${dir}/list.ts`,
      [
        `import { classSchema, codes, en, namespace, one, optional, range, rdfs, skos, vocabulary } from "${root}/../rdf/src/mod.ts";`,
        `const NS = namespace("t", "https://example.org/t#");`,
        `const t = vocabulary(NS, { Code: "owl:Class" });`,
        `const CODE = { label: one(rdfs.label, range.langString), definition: optional(skos.definition, range.langString) } as const;`,
        `export const list = codes(classSchema(t.Code, CODE), NS, {\n${rows}\n});`,
        `export type Key = keyof typeof list;`,
        `export const last: Key = "Term4999";`,
        `// @ts-expect-error a key that is not an entry does not type-check`,
        `export const none: Key = "Term5000";`,
        ``,
      ].join("\n"),
    );
    const started = Date.now();
    const o = await run(
      [
        execPath(),
        tsc,
        "--ignoreConfig",
        "--noEmit",
        "--strict",
        "--target",
        "es2024",
        "--module",
        "nodenext",
        "--moduleResolution",
        "nodenext",
        "--allowImportingTsExtensions",
        "--erasableSyntaxOnly",
        "--skipLibCheck",
        "--types",
        "node",
        `${dir}/list.ts`,
      ],
      { cwd: root },
    ); // `--types node` is found from the package's own folder, wherever the tests are run from
    assertEquals([o.code, o.stdout.trim()], [0, ""], o.stderr);
    assert(Date.now() - started < 30_000, `5,000 entries took ${Date.now() - started} ms`);
  } finally {
    removeSync(dir, { recursive: true });
  }
});

proves(
  ["0018-standards-first FR-013"],
  "a deprecated term with no replacement is found, and a specification that names a deprecated term is found with its replacement",
  () => {
    const found = termFindings(
      [
        { iri: "https://x/Old", basis: "adopts", standardTerm: "https://s/Old", decision: false, deprecatedOn: "2026-01-01" },
        {
          iri: "https://x/Older",
          basis: "adopts",
          standardTerm: "https://s/Older",
          decision: false,
          deprecatedOn: "2025-01-01",
          replacedBy: "https://x/New",
        },
      ],
      "2026-11-17",
    );
    assertEquals(
      found.map((f) => f.key),
      ["mizan/deprecated-no-replacement https://x/Old"],
    );
    const named = specTermFindings(
      [{ slug: "0001-x", spec: "Uses `mz:Older` and `mz:Older` and `mz:Fine`.\n" }],
      { mz: new Set(["Older", "Fine"]) },
      new Map([["mz:Older", "mz:New"]]),
    );
    assertEquals(
      named.map((f) => f.rule),
      ["mizan/spec-term-deprecated"],
    );
    assertStringIncludes(named[0]?.message ?? "", "mz:New replaces it");
  },
);

proves(["0012-ontology FR-016"], "the kernel's OwlOntology takes a version IRI, which the Turtle writes as owl:versionIRI", () => {
  const ontology = OwlOntology.make(ontologyOf(MZ), {
    label: en("Mizan"),
    versionInfo: "1",
    versionIri: named<"owl:Ontology">(iriIn(MZV, "1")),
  });
  const ttl = turtle({ prefixes: [MZ, MZV, OWL, RDFS], triples: triplesOf([ontology]) });
  assertStringIncludes(ttl, "owl:versionIRI mzv:1");
  assertStringIncludes(ttl, 'owl:versionInfo "1"');
});

proves(
  ["0019-mizan-integrations FR-010"],
  "the HTML view escapes every text, says it is generated, and shows classes, properties, code lists and the basis of each term",
  () => {
    const html = exportHtmlView(
      {
        title: "A <b>title</b>",
        iri: "https://x/o",
        versionIri: "https://x/o/1",
        classes: [{ curie: "x:A", label: "A & B", definition: '"quoted" <i>' }],
        properties: [{ curie: "x:p", label: "p", domain: "x:A", range: "xsd:string" }],
        codeLists: [{ name: "Basis", members: [{ code: "Adopts", label: "adopts" }] }],
        terms: [{ curie: "x:A", basis: "unaligned", justification: "none <found>" }],
      },
      "made by a test",
    );
    assert(html.startsWith("<!doctype html>"));
    assertStringIncludes(html, "A &lt;b&gt;title&lt;/b&gt;");
    assertStringIncludes(html, "A &amp; B");
    assertStringIncludes(html, "&quot;quoted&quot; &lt;i&gt;");
    assertStringIncludes(html, "none &lt;found&gt;");
    assertStringIncludes(html, "made by a test");
    assertStringIncludes(html, '<span class="chip unaligned">unaligned</span>');
    assertStringIncludes(html, "https://x/o/1");
    assert(!html.includes("<b>title"), "no raw markup from the data");
  },
);

proves(
  ["0003-mizan FR-040"],
  "a harness holds its own specifications and its own audit through holdHarness: a missing record fails whatever the baseline holds, a missing decision is held, one overdue fails",
  () => {
    const dir = makeTempDirSync({ prefix: "mizan-harness-" });
    try {
      mkdirSync(`${dir}/specs/0001-x`, { recursive: true });
      writeTextFileSync(
        `${dir}/specs/0001-x/spec.md`,
        "# Feature Specification: X\n\n- **FR-001**: It MUST work with `h:Gone` and `h:Here`.\n",
      );
      const base = {
        root: dir,
        baselineFile: `${dir}/mizan.baseline.txt`,
        name: "harness",
        termsFile: "ontology/audit.ts",
        specTerms: { known: { h: new Set(["Here"]) } },
        terms: [
          { iri: "https://h/Here", basis: "unaligned" as const, justification: "none found", addedOn: "2026-11-17", decision: false },
        ],
        completeness: [{ file: "ontology/h.ts", ontology: ["https://h/Here"], recorded: ["https://h/Here"] }],
      };
      assertEquals(holdHarness({ ...base, today: "2026-11-18" }), 1);
      assertEquals(holdHarness({ ...base, today: "2026-11-18", writeBaseline: true }), 0);
      assertStringIncludes(readTextFileSync(`${dir}/mizan.baseline.txt`), "mizan/spec-term-unknown specs/0001-x/spec.md h:Gone");
      assertStringIncludes(readTextFileSync(`${dir}/mizan.baseline.txt`), "mizan/decision-missing https://h/Here");
      assertEquals(holdHarness({ ...base, today: "2026-11-19" }), 0);
      assertEquals(holdHarness({ ...base, today: "2027-03-01" }), 1);
      assertEquals(
        holdHarness({
          ...base,
          today: "2026-11-19",
          completeness: [{ file: "ontology/h.ts", ontology: ["https://h/Here", "https://h/New"], recorded: ["https://h/Here"] }],
        }),
        1,
      );
    } finally {
      removeSync(dir, { recursive: true });
    }
  },
);
