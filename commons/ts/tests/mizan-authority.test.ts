/**
 * The rule that a requirement that comes from law cites its authority (commons 0018-standards-first FR-008, FR-015, FR-016): what counts as a citation of law, when an
 * authority covers one, the three findings of the plugin, commons' own specifications read for real, and the command that holds the findings against a baseline, run as a program
 * on the runtime this test runs on.
 *
 * @module
 */
import { makeTempDirSync, mkdirSync, readTextFileSync, removeSync, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, resolve } from "@intellectual-frontiers/system/path";
import { execPath, run } from "@intellectual-frontiers/system/proc";
import { assert, assertEquals, assertStringIncludes, proves } from "../runtime/test.ts";
import { readSpecTexts } from "../mizan/check.ts";
import {
  authorityCitation,
  commonsAuthorities,
  covers,
  lawCitationsIn,
  mizanFindings,
  type RulePlugin,
  rulePlugins,
  type SpecText,
} from "../mizan/rules.ts";

const HERE = dirname(fromFileUrl(import.meta.url));
const CHECK = resolve(HERE, "..", "mizan", "check.ts");
const SPEC_KIT = resolve(HERE, "..", "..", "spec-kit");

const spec = (slug: string, ...requirements: string[]): SpecText => ({
  slug,
  spec: `# Feature Specification: X\n\n${requirements.join("\n")}\n`,
});

const only = (text: SpecText): readonly string[] =>
  mizanFindings([text], [authorityCitation(commonsAuthorities)]).map((f) => `${f.line} ${f.key.split(" ").slice(2).join(" ")}`);

proves(
  ["0018-standards-first FR-015"],
  "a citation of the Code of Federal Regulations or the United States Code is read however it is written, and a number that is not one is not",
  () => {
    const normal = (text: string): string[] => lawCitationsIn(text).map((c) => c.normal);
    assertEquals(normal("It follows 21 CFR Part 11."), ["21 CFR 11"]);
    assertEquals(normal("It follows 45 CFR 164.312(a)(1) and 42 U.S.C. 1320d-2."), ["45 CFR 164.312", "42 USC 1320d-2"]);
    assertEquals(normal("See 5 USC § 552a, and 21 C.F.R. §§ 820.30."), ["5 USC 552a", "21 CFR 820.30"]);
    assertEquals(normal("Part 11 of the regulation, the CFR, 21-cfr-820, and 3 or 4 USC."), []);
    assertEquals(lawCitationsIn("It follows 21 CFR Part 11.")[0]?.written, "21 CFR Part 11");
  },
);

proves(
  ["0018-standards-first FR-015"],
  "an authority covers its own citation and what is under it, and nothing whose number only starts the same",
  () => {
    const named = (text: string) => lawCitationsIn(text)[0] ?? { written: "", normal: "" };
    assert(covers("21 CFR Part 820", named("21 CFR Part 820")));
    assert(covers("21 CFR Part 820", named("21 CFR 820.30")));
    assert(covers("42 U.S.C. 1320d", named("42 USC 1320d-2")));
    assert(!covers("21 CFR Part 820", named("21 CFR 8200")));
    assert(!covers("21 CFR Part 820", named("21 CFR Part 11")));
    assert(!covers("21 CFR Part 11", named("45 CFR 11")));
    assert(!covers("42 U.S.C. 1320d", named("42 USC 1320de")));
    assert(!covers("not a citation", named("21 CFR 11")));
  },
);

proves(
  ["0018-standards-first FR-015"],
  "commons' ontology gives the authorities of 21 CFR Part 820 and Part 11 and, for consumer privacy, the GDPR and the CCPA as the identifiers a requirement names",
  () => {
    assertEquals(
      commonsAuthorities.map((a) => [a.id, a.citation]),
      [
        ["mzid:authority-21-cfr-820", "21 CFR Part 820"],
        ["mzid:authority-21-cfr-11", "21 CFR Part 11"],
        ["mzid:authority-gdpr", "Regulation (EU) 2016/679"],
        ["mzid:authority-ccpa", "California Civil Code section 1798.100 and following"],
      ],
    );
  },
);

proves(
  ["0018-standards-first FR-016"],
  "a requirement that names a law and no authority, one that names an authority there is not, and a citation no named authority covers are each found once",
  () => {
    const found = only(
      spec(
        "0001-x",
        "- **FR-001**: The device MUST keep records as 21 CFR Part 11 requires.",
        "- **FR-002**: The device MUST keep records as 21 CFR Part 11 requires. Authority: mzid:authority-21-cfr-11.",
        "- **FR-003**: The device MUST keep complaint files (21 CFR 820.198),",
        "  and sign them, Authority: mzid:authority-21-cfr-820, mzid:authority-21-cfr-11.",
        "- **FR-004**: The device MUST keep records as 21 CFR Part 11 requires. Authority: mzid:authority-nothing.",
        "- **FR-005**: The device MUST sign records as 21 CFR Part 11 requires. Authority: mzid:authority-21-cfr-820.",
        "- **FR-006**: The device MUST keep records, and names no law. Authority: mzid:authority-21-cfr-11.",
        "- **FR-007**: The device MUST store 5 U.S.C. 552a data. Authority: mzid:authority-21-cfr-11.",
        "- **FR-008**: The device MUST name no law.",
      ),
    );
    assertEquals(found, ["3 FR-001", "7 FR-004 mzid:authority-nothing", "8 FR-005 21 CFR 11", "10 FR-007 5 USC 552a"]);
  },
);

proves(["0018-standards-first FR-016"], "the message of each finding says what is wrong in one sentence", () => {
  const found = mizanFindings(
    [
      spec(
        "0001-x",
        "- **FR-001**: The device MUST keep records as 21 CFR Part 11 requires.",
        "- **FR-002**: The device MUST sign. 21 CFR 11.50 applies. Authority: mzid:authority-nothing.",
      ),
    ],
    [authorityCitation(commonsAuthorities)],
  );
  assertEquals(
    found.map((f) => f.rule),
    ["mizan/authority-citation", "mizan/authority-citation"],
  );
  assertStringIncludes(found[0]?.message ?? "", "FR-001 names 21 CFR Part 11 and carries no Authority:");
  assertStringIncludes(found[1]?.message ?? "", "FR-002 names the authority mzid:authority-nothing, which is no mz:Authority individual");
});

proves(["0018-standards-first FR-015"], "a harness gives the rule its own authorities, and only those are known to it", () => {
  const own = authorityCitation([{ id: "mzid:authority-45-cfr-164", citation: "45 CFR Part 164" }]);
  const text = spec(
    "0001-x",
    "- **FR-001**: The system MUST protect 45 CFR 164.312 data. Authority: mzid:authority-45-cfr-164.",
    "- **FR-002**: The system MUST sign as 21 CFR Part 11 says. Authority: mzid:authority-21-cfr-11.",
  );
  assertEquals(
    mizanFindings([text], [own]).map((f) => f.key),
    ["mizan/authority-citation specs/0001-x/spec.md FR-002 mzid:authority-21-cfr-11"],
  );
  assertEquals(
    mizanFindings([text], [authorityCitation(commonsAuthorities)]).map((f) => f.key),
    ["mizan/authority-citation specs/0001-x/spec.md FR-001 mzid:authority-45-cfr-164"],
  );
});

proves(
  ["0018-standards-first FR-008", "0018-standards-first FR-016"],
  "commons' own specifications read for real: every requirement that names a law cites its authority, and the rule is one of Mizan's own plugins",
  () => {
    assert(rulePlugins.some((p: RulePlugin) => p.id === "mizan/authority-citation"));
    const specs = readSpecTexts(SPEC_KIT);
    assert(specs.length > 15);
    assertEquals(
      mizanFindings(specs, [authorityCitation(commonsAuthorities)]).map((f) => f.key),
      [],
    );
    const first = specs.find((s) => s.slug === "0018-standards-first");
    assert(first !== undefined);
    assertStringIncludes(first.spec, "Authority: mzid:authority-21-cfr-820, mzid:authority-21-cfr-11.");
    const broken = { ...first, spec: first.spec.replace("Authority: mzid:authority-21-cfr-820, mzid:authority-21-cfr-11.", "") };
    assertEquals(
      mizanFindings([broken], [authorityCitation(commonsAuthorities)]).map((f) => f.key),
      ["mizan/authority-citation specs/0018-standards-first/spec.md FR-010"],
    );
  },
);

proves(
  ["0018-standards-first FR-016"],
  "the finding is a warning held by the baseline: it fails when new, is held once written, and its line goes stale when the requirement is fixed",
  async () => {
    const root = makeTempDirSync({ prefix: "mizan-authority-" });
    const command = async (...args: string[]) => run([execPath(), CHECK, "--root", root, ...args]);
    try {
      mkdirSync(`${root}/specs/0001-x`, { recursive: true });
      const file = `${root}/specs/0001-x/spec.md`;
      writeTextFileSync(file, "# Feature Specification: X\n\n- **FR-001**: It MUST keep records as 21 CFR Part 11 requires.\n");
      const fresh = await command();
      assertEquals(fresh.code, 1);
      assertStringIncludes(fresh.stderr, "mizan/authority-citation: FR-001 names 21 CFR Part 11 and carries no Authority:");
      assertEquals((await command("--write-baseline")).code, 0);
      assertStringIncludes(readTextFileSync(`${root}/mizan.baseline.txt`), "mizan/authority-citation specs/0001-x/spec.md FR-001");
      assertEquals((await command()).code, 0);
      writeTextFileSync(
        file,
        "# Feature Specification: X\n\n- **FR-001**: It MUST keep records as 21 CFR Part 11 requires. Authority: mzid:authority-21-cfr-11.\n",
      );
      const stale = await command();
      assertEquals(stale.code, 1);
      assertStringIncludes(stale.stderr, "no longer occurs");
    } finally {
      removeSync(root, { recursive: true });
    }
  },
);
