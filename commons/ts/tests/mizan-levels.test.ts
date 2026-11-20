/**
 * Conformance levels (commons 0028-conformance-levels): the four levels as typed individuals of Mizan's ontology and what each entails, the rule of which of Mizan's rules a level runs,
 * `holdHarness` and `check.ts` held to a level, and `check.ts --all` running the `verify` of the libraries a manifest declares. The check runs on real folders in temporary directories and the
 * command as a real program; the `verify` of a library in a test is a real script of a real package, run by Bun.
 *
 * @module
 */
import { conformanceLevels, conformanceRequirements } from "@intellectual-frontiers/ontology/mizan";
import { run as runCheck } from "../mizan/check.ts";
import { holdHarness } from "@intellectual-frontiers/mizan/harness";
import { DEFAULT_LEVEL, entailedBy, LEVELS, levelOf, levelOfRule, ruleMatches, ruleRunsAt } from "@intellectual-frontiers/mizan/levels";
import { verifyAll } from "../mizan/libraries.ts";
import { CHANGES_RULES } from "@intellectual-frontiers/mizan/changes/rules";
import { MIZAN_RULES } from "@intellectual-frontiers/mizan/rules";
import { VERSIONS_RULES } from "@intellectual-frontiers/mizan/versions/rules";
import { mkdirSync, readTextFileSync, withTempDir, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { join } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const SPEC = "0028-conformance-levels";
const keys = (level: (typeof LEVELS)[number], only: "all" | "added" = "all"): readonly string[] =>
  entailedBy(level)
    .filter((e) => only === "all" || e.addedBy === level)
    .map((e) => e.key);

proves(
  [`${SPEC} FR-001`, `${SPEC} FR-003`, `${SPEC} FR-004`, `${SPEC} FR-005`, `${SPEC} FR-006`],
  "four levels of ranks 0 to 3, each adding its own requirements to those of the levels below it",
  () => {
    const levels = Object.values(conformanceLevels);
    assertEquals(levels.map((l) => l.values.levelRank).sort(), [0, 1, 2, 3]);
    assertEquals(Object.keys(conformanceLevels), ["Registered", "Core", "Standards", "Governed"]);
    assertEquals(
      LEVELS.map((l) => levels.find((x) => x.values.levelRank === LEVELS.indexOf(l))?.iri.split("#")[1]),
      ["Registered", "Core", "Standards", "Governed"],
    );
    assertEquals(keys("L0"), ["Manifest", "VerifyCommand", "Version"]);
    assertEquals(keys("L1", "added"), [
      "SpecKit",
      "OwnVerify",
      "EarsRequirements",
      "GherkinScenarios",
      "ProofRows",
      "SourceTrace",
      "ShrinkOnlyBaselines",
      "Citations",
    ]);
    assertEquals(keys("L2", "added"), ["TermAudit"]);
    assertEquals(keys("L3", "added"), ["Ifccm", "Ifr", "Ifqs"]);
    // cumulative: a level entails what the levels below it add
    for (const l of LEVELS.slice(1)) {
      const below = new Set(keys(LEVELS[LEVELS.indexOf(l) - 1] ?? "L0"));
      assert(
        [...below].every((k) => keys(l).includes(k)),
        `${l} entails the requirements of the level below it`,
      );
    }
    assertEquals(keys("L3").length, Object.keys(conformanceRequirements).length);
  },
);

proves([`${SPEC} FR-002`], "a requirement is added by exactly one level, and says what proves it", () => {
  const added = Object.values(conformanceLevels).flatMap((l) => (l.values.entails ?? []).map((e) => e.iri));
  assertEquals(added.length, new Set(added).size);
  assertEquals(
    [...added].sort(),
    Object.values(conformanceRequirements)
      .map((r) => r.iri)
      .sort(),
  );
  for (const [key, r] of Object.entries(conformanceRequirements))
    assert((r.values.rule ?? []).length + (r.values.enforcedBy ?? []).length > 0, `${key} names a rule or says what else proves it`);
});

const ALL_RULES: readonly string[] = [...MIZAN_RULES, ...CHANGES_RULES, ...VERSIONS_RULES];

proves([`${SPEC} FR-007`], "every rule a requirement names is a rule that exists, and a family names at least one", () => {
  for (const [key, r] of Object.entries(conformanceRequirements))
    for (const pattern of r.values.rule ?? [])
      assert(
        ALL_RULES.some((id) => ruleMatches(pattern, id)),
        `${key} names ${pattern}, which is no rule`,
      );
  assert(!ruleMatches("changes/*", "mizan/requirement-ears") && ruleMatches("changes/*", "changes/no-issue") && ruleMatches("a/b", "a/b"));
  assertEquals(levelOfRule("mizan/requirement-ears"), "L1");
  assertEquals(levelOfRule("mizan/decision-missing"), "L2");
  assertEquals(levelOfRule("versions/not-grown"), "L3");
  assertEquals(levelOfRule("mizan/authority-citation"), undefined);
  assertEquals(levelOf("L2"), "L2");
  assertEquals(levelOf("L9"), undefined);
});

const WEAK = "# Feature Specification: X\n\n**Spec ID:** 0001-x\n**Status:** Draft\n\n- **FR-001**: The thing works.\n";

/** A folder with one weak specification, and the terms of a vocabulary with one that has no decision. */
async function inFolder(f: (root: string, base: Parameters<typeof holdHarness>[0]) => void | Promise<void>): Promise<void> {
  await withTempDir(async (root) => {
    mkdirSync(join(root, "specs", "0001-x"), { recursive: true });
    writeTextFileSync(join(root, "specs", "0001-x", "spec.md"), WEAK);
    const base = {
      root,
      baselineFile: join(root, "mizan.baseline.txt"),
      today: "2026-11-18",
      terms: [
        { iri: "https://example.org/T", basis: "unaligned" as const, justification: "none found", addedOn: "2026-11-01", decision: false },
      ],
      termsFile: "ontology.ts",
    };
    await f(root, base);
  });
}

proves(
  [`${SPEC} FR-008`],
  "with no level the check is held to L3: the same findings, the same baseline and the same status as L3",
  async () => {
    assertEquals(DEFAULT_LEVEL, "L3");
    await inFolder((_, base) => {
      assertEquals(holdHarness(base), 1);
      assertEquals(holdHarness({ ...base, level: "L3" }), 1);
      assertEquals(holdHarness({ ...base, writeBaseline: true }), 0);
      const written = readTextFileSync(base.baselineFile);
      assertEquals(
        written.split("\n").filter((l) => !l.startsWith("#") && l !== ""),
        ["mizan/decision-missing https://example.org/T", "mizan/requirement-keyword specs/0001-x/spec.md FR-001"],
      );
      assertEquals(holdHarness(base), 0);
      assertEquals(holdHarness({ ...base, level: "L3" }), 0);
      writeTextFileSync(base.baselineFile, "");
      assertEquals(holdHarness({ ...base, level: "L3", writeBaseline: true }), 0);
      assertEquals(readTextFileSync(base.baselineFile), written);
    });
  },
);

proves(
  [`${SPEC} FR-009`],
  "below L3 the check runs only the rules the level entails, a rule no requirement names from L1, and no rule at L0",
  async () => {
    assert(ruleRunsAt("mizan/authority-citation", "L1") && !ruleRunsAt("mizan/authority-citation", "L0"));
    assert(
      ruleRunsAt("mizan/requirement-ears", "L1") &&
        !ruleRunsAt("mizan/decision-missing", "L1") &&
        ruleRunsAt("mizan/decision-missing", "L2"),
    );
    assert(!ruleRunsAt("changes/no-issue", "L2") && ruleRunsAt("changes/no-issue", "L3") && !ruleRunsAt("versions/not-grown", "L2"));
    await inFolder((_, base) => {
      // L0: nothing is run, so a weak requirement and a term with no decision pass
      assertEquals(holdHarness({ ...base, level: "L0" }), 0);
      // L1: the requirement is found, the term is not looked at
      holdHarness({ ...base, level: "L1", writeBaseline: true });
      assertEquals(
        readTextFileSync(base.baselineFile)
          .split("\n")
          .filter((l) => !l.startsWith("#") && l !== ""),
        ["mizan/requirement-keyword specs/0001-x/spec.md FR-001"],
      );
      // L2: both
      holdHarness({ ...base, level: "L2", writeBaseline: true });
      assertEquals(
        readTextFileSync(base.baselineFile)
          .split("\n")
          .filter((l) => !l.startsWith("#") && l !== "").length,
        2,
      );
    });
    // a gated finding of change control is L3's: refused at L3, not looked for at L2
    await inFolder((_, base) => {
      const refused = { declaration: { regulatedDomains: ["DeviceQuality" as const] }, file: "ifccm.declaration.ts" };
      const held = { ...base, terms: [], writeBaseline: false };
      holdHarness({ ...held, level: "L1", writeBaseline: true });
      assertEquals(holdHarness({ ...held, level: "L3", declaration: refused }), 1);
      assertEquals(holdHarness({ ...held, level: "L2", declaration: refused }), 0);
    });
  },
);

proves(
  [`${SPEC} FR-010`],
  "a baseline line of a rule the level does not run is neither stale nor lost where the baseline is written",
  async () => {
    await inFolder((_, base) => {
      holdHarness({ ...base, writeBaseline: true });
      const full = readTextFileSync(base.baselineFile);
      // at L1 the line of the audit is not stale
      assertEquals(holdHarness({ ...base, level: "L1" }), 0);
      // writing at L1 keeps it
      assertEquals(holdHarness({ ...base, level: "L1", writeBaseline: true }), 0);
      assertEquals(readTextFileSync(base.baselineFile), full);
      // at L0 every line is kept
      assertEquals(holdHarness({ ...base, level: "L0", writeBaseline: true }), 0);
      assertEquals(readTextFileSync(base.baselineFile), full);
      // a line of a rule the level runs that no longer occurs is still stale
      writeTextFileSync(base.baselineFile, `${full}mizan/requirement-ears specs/0001-x/spec.md FR-009\n`);
      assertEquals(holdHarness({ ...base, level: "L1" }), 1);
    });
  },
);

proves(
  [`${SPEC} FR-011`],
  "check.ts takes --level, holds commons at L3 without it, and refuses a level that is not one of the four with status 2",
  async () => {
    assertEquals(await runCheck(["--level", "L9"]), 2);
    assertEquals(await runCheck(["--level", "l1"]), 2);
    assertEquals(await runCheck(["--level", "L1"]), 0);
    assertEquals(await runCheck(["--level", "L0"]), 0);
    assertEquals(await runCheck([]), 0);
    assertEquals(await runCheck(["--level", "L3"]), 0);
  },
);

/** A repository with one library whose package has the script `verify` and the text of it. */
function library(root: string, name: string, verify: string): void {
  mkdirSync(join(root, "commons", name), { recursive: true });
  writeTextFileSync(
    join(root, "commons", name, "library.ts"),
    `export const library = { name: "${name}", level: "L0", verify: "bun run verify", version: "0.1.0", exports: [] };\n`,
  );
  writeTextFileSync(
    join(root, "commons", name, "package.json"),
    JSON.stringify({ name: `@intellectual-frontiers/${name}`, version: "0.1.0", scripts: { verify } }),
  );
}

const MARK = "bun -e \"import { writeFileSync } from 'node:fs'; writeFileSync('ran.txt', 'x')\"";

proves(
  [`${SPEC} FR-012`],
  "--all runs the verify of every library from its own folder and names each status; without it no verify runs",
  async () => {
    await withTempDir(async (root) => {
      library(root, "alpha", MARK);
      library(root, "beta", 'bun -e "process.exit(3)"');
      const r = await verifyAll(root);
      assertEquals(r, [
        { name: "alpha", code: 0 },
        { name: "beta", code: 3 },
      ]);
      assertEquals(readTextFileSync(join(root, "commons", "alpha", "ran.txt")), "x");
      // the command: failing, it exits 1; the check itself is not the library's
      assertEquals(await runCheck(["--all", "--repo", root]), 1);
    });
    await withTempDir(async (root) => {
      library(root, "alpha", MARK);
      assertEquals(await runCheck(["--all", "--repo", root]), 0);
      assertEquals(readTextFileSync(join(root, "commons", "alpha", "ran.txt")), "x");
    });
    await withTempDir(async (root) => {
      library(root, "alpha", MARK);
      // without --all the check never runs a library's verify, whatever --repo says
      assertEquals(await runCheck(["--repo", root]), 0);
      let ran = true;
      try {
        readTextFileSync(join(root, "commons", "alpha", "ran.txt"));
      } catch {
        ran = false;
      }
      assertEquals(ran, false);
    });
  },
);
