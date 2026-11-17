/**
 * What a harness's declaration changes in the quality system (commons 0021-ifqs FR-011 and FR-046, with the declaration of 0020-ifccm FR-010): the
 * grade a requirement needs to be counted proved is `E3`, `E4` for high risk, and `E4` for every requirement of a harness that declares a regulated
 * domain and production; the floor of a proof's strength is 600, and 800 for such a harness. The functions are pure (the declaration and the day are
 * arguments); the last test reads the declaration from a real file and judges a real run kept on a real temporary Git repository.
 *
 * @module
 */
import { decodeDeclaration, type Declaration } from "../mizan/changes/declaration.ts";
import { gradeAfterMutation, mutationFloor, strengthPermille } from "../quality/attestation/mutation.ts";
import { readDeclaration } from "../quality/host/declaration.ts";
import { keepRun } from "../quality/host/branch.ts";
import { gather } from "../quality/host/gather.ts";
import {
  evidenceOfRun,
  gradeNeeded,
  gradeRequired,
  judgeRequirement,
  type RegisterRow,
  regulatedInProduction,
} from "../quality/pure/ladder.ts";
import { judgeTier, tierRequirements } from "../quality/pure/tier.ts";
import { makeTempDir, mkdir, remove, writeTextFile } from "../runtime/fs.ts";
import { tierCommand } from "../quality/commands.ts";
import { join } from "../runtime/path.ts";
import { assert, assertEquals, proves } from "../runtime/test.ts";
import { assembledRun, needsGit, repositoryWithCommit } from "./quality-fixtures.ts";
import { judge, recordOf, TODAY } from "./quality-tier1-fixtures.ts";

function declared(input: unknown): Declaration {
  const d = decodeDeclaration(input);
  assert(d.kind === "ok", "a declaration");
  return d.value;
}

/** Regulated, in production from 2026-11-01. */
const REGULATED = declared({ regulatedDomains: ["DeviceQuality"], productionDeclaredOn: "2026-11-01" });
/** Regulated, production not yet. */
const BEFORE = declared({ regulatedDomains: ["DeviceQuality"], productionDeclaredOn: "2027-06-01" });
/** In production, no regulated domain. */
const UNREGULATED = declared({ regulatedDomains: [], productionDeclaredOn: "2026-11-01" });

proves(
  ["0021-ifqs FR-011"],
  "gradeNeeded: E3, E4 for high risk, and E4 for every requirement where the harness declares a regulated domain and production (the day is an argument)",
  () => {
    assertEquals(gradeNeeded("not-high", undefined, TODAY), "E3");
    assertEquals(gradeNeeded("high", undefined, TODAY), "E4");
    assertEquals(gradeNeeded("not-high", REGULATED, TODAY), "E4");
    assertEquals(gradeNeeded("high", REGULATED, TODAY), "E4");
    // the day production is declared, that day included; before it, as for any harness
    assertEquals(gradeNeeded("not-high", REGULATED, "2026-11-01"), "E4");
    assertEquals(gradeNeeded("not-high", REGULATED, "2026-10-31"), "E3");
    assertEquals(gradeNeeded("not-high", BEFORE, TODAY), "E3");
    assertEquals(gradeNeeded("high", BEFORE, TODAY), "E4");
    // production without a regulated domain asks nothing more
    assertEquals(gradeNeeded("not-high", UNREGULATED, TODAY), "E3");
    assertEquals(regulatedInProduction(REGULATED, TODAY), true);
    assertEquals(regulatedInProduction(UNREGULATED, TODAY), false);
    // the risk alone, as before
    assertEquals([gradeRequired("not-high"), gradeRequired("high")], ["E3", "E4"]);
  },
);

proves(
  ["0021-ifqs FR-011"],
  "the ladder counts a requirement of a regulated harness in production proved only at E4, and an E3 run no longer",
  async () => {
    const q = await recordOf(11, [{ name: "ordinary", requirements: ["0021-ifqs FR-005"] }], { revision: "abc1234" });
    const [e3] = evidenceOfRun(q, "E3");
    const [e4] = evidenceOfRun(q, "E4");
    assert(e3 !== undefined && e4 !== undefined);
    const at = (e: typeof e3, context?: { declaration: Declaration | undefined; today: string }) =>
      judgeRequirement("0021-ifqs FR-005", [judge(e)], context);
    assertEquals(at(e3).proved, true);
    assertEquals(at(e3, { declaration: undefined, today: TODAY }).proved, true);
    assertEquals(at(e3, { declaration: BEFORE, today: TODAY }).proved, true);
    const refused = at(e3, { declaration: REGULATED, today: TODAY });
    assertEquals([refused.grade, refused.required, refused.proved], ["E3", "E4", false]);
    const kept = at(e4, { declaration: REGULATED, today: TODAY });
    assertEquals([kept.grade, kept.required, kept.proved], ["E4", "E4", true]);
  },
);

proves(
  ["0021-ifqs FR-011", "0021-ifqs FR-036"],
  "the tier claim of a regulated harness in production is refused where a requirement of the tier is proved below E4, naming it and its grade; any other harness is judged by the register alone",
  async () => {
    const wanted = tierRequirements("Tier0");
    const register: RegisterRow[] = wanted.map((requirement) => ({ requirement, mechanism: "check", by: "x", note: "" }));
    const q = await recordOf(
      12,
      wanted.map((requirement, i) => ({ name: `case ${i}`, requirements: [requirement] })),
      { revision: "abc1234" },
    );
    const judgements = (grade: "E3" | "E4") =>
      wanted.map((requirement) =>
        judgeRequirement(
          requirement,
          evidenceOfRun(q, grade)
            .filter((e) => e.requirement === requirement)
            .map((e) => judge(e)),
        ),
      );
    assertEquals(judgeTier("Tier0", register).claimed, true);
    // not regulated, or not yet in production: the register alone
    assertEquals(judgeTier("Tier0", register, { judgements: judgements("E3"), declaration: undefined, today: TODAY }).claimed, true);
    assertEquals(judgeTier("Tier0", register, { judgements: judgements("E3"), declaration: BEFORE, today: TODAY }).claimed, true);
    // regulated and in production: every requirement of the tier at E4
    const refused = judgeTier("Tier0", register, { judgements: judgements("E3"), declaration: REGULATED, today: TODAY });
    assertEquals(refused.claimed, false);
    assertEquals(refused.underGrade.length, wanted.length);
    assertEquals([refused.underGrade[0]?.grade, refused.underGrade[0]?.needed], ["E3", "E4"]);
    assertEquals(judgeTier("Tier0", register, { judgements: judgements("E4"), declaration: REGULATED, today: TODAY }).claimed, true);
    // a requirement with no proof at all is below the grade too
    assertEquals(judgeTier("Tier0", register, { judgements: [], declaration: REGULATED, today: TODAY }).underGrade.length, wanted.length);
  },
);

proves(
  ["0021-ifqs FR-046"],
  "the floor of strength is 600, 800 where the harness declares a regulated domain and production, a floor it states for itself never lowering that, and it decides whether a grade is lowered",
  () => {
    assertEquals(mutationFloor(undefined, TODAY), 600);
    assertEquals(mutationFloor(BEFORE, TODAY), 600);
    assertEquals(mutationFloor(UNREGULATED, TODAY), 600);
    assertEquals(mutationFloor(REGULATED, TODAY), 800);
    assertEquals(mutationFloor(REGULATED, "2026-10-31"), 600);
    // a floor the harness states: its own where it is not regulated in production, never below 800 where it is
    assertEquals(mutationFloor(undefined, TODAY, 700), 700);
    assertEquals(mutationFloor(REGULATED, TODAY, 700), 800);
    assertEquals(mutationFloor(REGULATED, TODAY, 900), 900);
    // 7 of 10 mutants killed: 700 permille is above the default floor and below the regulated one
    const permille = strengthPermille({ requirement: "0021-ifqs FR-005" as never, mutants: 10, killed: 7, survived: 3 });
    assertEquals(permille, 700);
    const strength = {
      requirement: "0021-ifqs FR-005",
      permille: 700,
      mutants: 10,
      survived: 3,
      run: "MUT-1",
      tool: "t",
      day: TODAY,
      revision: "abc1234",
    };
    assertEquals(gradeAfterMutation("E4", true, strength, mutationFloor(undefined, TODAY)).effect, "kept");
    const lowered = gradeAfterMutation("E4", true, strength, mutationFloor(REGULATED, TODAY));
    assertEquals([lowered.effect, lowered.grade], ["lowered", "E3"]);
  },
);

proves(
  ["0021-ifqs FR-011"],
  "the declaration is read from the harness's own file and a real E3 run kept on a real quality branch is proved for it before production and not after",
  async () => {
    const dir = await makeTempDir({ prefix: "ifqs-regulated-" });
    try {
      const tested = await repositoryWithCommit(dir);
      const record = await assembledRun(1, [{ name: "a case", requirements: ["0021-ifqs FR-005"] }], { revision: tested });
      const kept = await keepRun({ repo: dir, record, sign: false });
      assert(kept.kind === "ok", kept.kind === "err" ? JSON.stringify(kept.error) : "");
      // no file: no declaration
      const none = await readDeclaration(dir);
      assert(none.kind === "ok" && none.value === undefined);
      const missing = await readDeclaration(dir, "nowhere.ts");
      assert(missing.kind === "err");
      await writeTextFile(
        join(dir, "ifccm.declaration.ts"),
        `export const declaration = { regulatedDomains: ["DeviceQuality"], productionDeclaredOn: "2026-11-01" };\n`,
      );
      const read = await readDeclaration(dir);
      assert(read.kind === "ok" && read.value !== undefined);
      assertEquals(read.value.regulatedDomains, ["DeviceQuality"]);
      const without = await gather({ repo: dir, today: TODAY, changes: false });
      assert(without.kind === "ok");
      assertEquals(without.value.byRequirement.get("0021-ifqs FR-005")?.proved, true);
      const regulated = await gather({ repo: dir, today: TODAY, changes: false, declaration: read.value });
      assert(regulated.kind === "ok");
      const j = regulated.value.byRequirement.get("0021-ifqs FR-005");
      assertEquals([j?.grade, j?.required, j?.proved], ["E3", "E4", false]);
    } finally {
      await remove(dir, { recursive: true });
    }
  },
  needsGit,
);

proves(
  ["0021-ifqs FR-011", "0021-ifqs FR-046"],
  "quality tier reads the declaration: a regulated harness in production is refused a tier its E3 proofs held before, and the same harness is accepted before its production day",
  async () => {
    const dir = await makeTempDir({ prefix: "ifqs-regulated-tier-" });
    try {
      const tested = await repositoryWithCommit(dir);
      const wanted = tierRequirements("Tier0");
      const record = await assembledRun(
        1,
        wanted.map((requirement, i) => ({ name: `case ${i}`, requirements: [requirement] })),
        { revision: tested },
      );
      const kept = await keepRun({ repo: dir, record, sign: false });
      assert(kept.kind === "ok", kept.kind === "err" ? JSON.stringify(kept.error) : "");
      await mkdir(join(dir, "commons", "spec-kit"), { recursive: true });
      await writeTextFile(
        join(dir, "commons", "spec-kit", "enforcement.tsv"),
        `requirement\tmechanism\tby\tnote\n${wanted.map((r) => `${r}\tcheck\tx\tn`).join("\n")}\n`,
      );
      const claim = (...more: string[]) => tierCommand(["--claim", "Tier0", "--repo", dir, "--today", TODAY, ...more]);
      assertEquals(await claim(), 0, "no declaration: the register alone");
      await writeTextFile(
        join(dir, "ifccm.declaration.ts"),
        `export const declaration = { regulatedDomains: ["DeviceQuality"], productionDeclaredOn: "2026-11-01" };\n`,
      );
      assertEquals(await claim(), 1, "regulated and in production: an E3 proof is below E4");
      assertEquals(await tierCommand(["--claim", "Tier0", "--repo", dir, "--today", "2026-10-31"]), 0, "the day before production");
      assertEquals(await claim("--declaration", "nowhere.ts"), 3, "a declaration file that is not there is an environment error");
    } finally {
      await remove(dir, { recursive: true });
    }
  },
  needsGit,
);
