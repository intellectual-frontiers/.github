/**
 * Tier 2 of the quality system, the records that people and plans make (commons 0021-ifqs FR-038 to FR-041), on real temporary Git
 * repositories: a sample drawn by a rule and a seed, drawn again the same, and attested by a named person as chained records; a plan
 * registered before its run and the run judged against it (a plan registered after, a case outside the plan and a planned case not run are
 * findings); a mutation report ingested, the strength of a proof and what it does to its grade; the reviews that agents made and a person's
 * sampling of them. Nothing stands in for the code under test: the branch, its commits and its chain are real.
 *
 * @module
 */
import { agentStanding, formatAgentFinding } from "../quality/attestation/agents.ts";
import {
  DEFAULT_FLOOR_PERMILLE,
  gradeAfterMutation,
  mutationEvent,
  readMutationReport,
  showStrength,
  strengthPermille,
  strengths,
} from "../quality/attestation/mutation.ts";
import {
  attestAndKeep,
  agentsOf,
  drawAndKeep,
  ingestMutation,
  readTier2,
  registerPlan,
  verifySamples,
} from "../quality/attestation/host.ts";
import { formatPlanFinding, notRunOfPlan, PLAN_ATTR, planHash, readPlan } from "../quality/attestation/plan.ts";
import { type Assurance, agentReviewIds, foldAssurance, ledgerRecordIds } from "../quality/attestation/rules.ts";
import { drawEvent, drawSample, freshSeed, sizeOf, verifyDraw } from "../quality/attestation/sample.ts";
import { keepRun, verifyBranch } from "../quality/host/branch.ts";
import { appendEvents, readLedger } from "../quality/host/ledger-branch.ts";
import { evidenceOfLedger, gradeOfEvidence } from "../quality/pure/ladder.ts";
import { attest } from "../quality/pure/ledger.ts";
import { RUN_GRADE, gradeRank } from "../quality/pure/names.ts";
import { makeTempDir, remove } from "@intellectual-frontiers/system/fs";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { assembledRun, needsGit, repositoryWithCommit } from "./quality-fixtures.ts";

const DAY = "2026-11-17";
const ANA = { name: "Ana Quality", role: "quality lead" } as const;

const PLAN = JSON.stringify({
  title: "release 1",
  cases: [
    { name: "the first holds", requirements: ["0099-demo FR-001"], acceptance: "passes on Bun and Node" },
    { name: "the second holds", requirements: ["0099-demo FR-002"], acceptance: "passes on Bun and Node" },
  ],
});

async function keep(
  repo: string,
  n: number,
  names: readonly string[],
  options: { readonly plan?: string; readonly notRun?: Parameters<typeof keepRun>[0]["notRun"] } = {},
): Promise<void> {
  const cases = names.map((name, i) => ({ name, file: "demo.test.ts", requirements: [`0099-demo FR-00${i + 1}`] }));
  const kept = await keepRun({
    repo,
    record: await assembledRun(n, cases),
    sign: false,
    ...(options.notRun === undefined ? {} : { notRun: options.notRun }),
    ...(options.plan === undefined ? {} : { resourceAttributes: { [PLAN_ATTR]: options.plan } }),
  });
  assert(kept.kind === "ok", kept.kind === "err" ? JSON.stringify(kept.error) : "");
}

proves(
  ["0021-ifqs FR-038"],
  "a sample is drawn by a rule and a seed: the same seed gives the same items, another seed another, and a record that was edited is not the sample its seed gives",
  async () => {
    const population = Array.from({ length: 40 }, (_, i) => `run-${String(i).padStart(2, "0")}`);
    const a = await drawSample({ population, seed: "seed-one", size: 6 });
    const b = await drawSample({ population: [...population].reverse(), seed: "seed-one", size: 6 });
    const c = await drawSample({ population, seed: "seed-two", size: 6 });
    assert(a.kind === "ok" && b.kind === "ok" && c.kind === "ok");
    assertEquals(a.value.items, b.value.items, "the order of the population does not change the sample");
    assert(a.value.items.join() !== c.value.items.join(), "another seed gives another sample");
    assertEquals(a.value.items.length, 6);
    assertEquals(a.value.population.count, 40);
    const event = await drawEvent({ id: "SAMPLE-0001", subject: "runs", population, seed: "seed-one", size: 6, by: ANA, day: DAY });
    assert(event.kind === "ok" && event.value.kind === "sample-drawn");
    assertEquals((await verifyDraw(event.value, population)).kind, "ok");
    const edited = { ...event.value, items: [...event.value.items.slice(1), "run-99"] };
    assertEquals((await verifyDraw(edited, population)).kind, "err", "an edited item is not what the seed gives");
    const other = await verifyDraw(event.value, [...population, "run-extra"]);
    assert(other.kind === "err" && other.error.includes("population"), "another population is named");
    assertEquals(sizeOf(40, undefined, 150), { kind: "ok", value: 6 });
    assertEquals(sizeOf(3, undefined, 1), { kind: "ok", value: 1 }, "a rate takes at least one item");
    assertEquals(
      freshSeed((bytes) => bytes.fill(171)),
      "ab".repeat(16),
    );
    assertEquals((await drawSample({ population, seed: " ", size: 1 })).kind, "err", "a sample without a seed is refused");
  },
);

proves(
  ["0021-ifqs FR-038", "0021-ifqs FR-045"],
  "a person's attestation of a sample is a chained record: the sample, the rule and seed, the result of each item, the role and the day; a sample drawn from the branch is reproducible after the branch has grown",
  async () => {
    const repo = await makeTempDir({ prefix: "ifc-sample-" });
    try {
      await repositoryWithCommit(repo);
      await keep(repo, 1, ["the first holds"]);
      await keep(repo, 2, ["the first holds"]);
      await keep(repo, 3, ["the first holds"]);
      const drawn = await drawAndKeep(repo, { subject: "runs", by: ANA, day: DAY, seed: "7f3a", size: 2 }, { sign: false });
      assert(drawn.kind === "ok", drawn.kind === "err" ? JSON.stringify(drawn.error) : "");
      assertEquals(drawn.value.items.length, 2);
      // a result missing, a stranger and a nameless person are refused, and nothing is written
      const [first = "", second = ""] = drawn.value.items;
      const missing = await attestAndKeep(
        repo,
        { sample: drawn.value.id, results: [{ item: first, verdict: "pass" }], person: ANA, day: DAY },
        { sign: false },
      );
      assert(missing.kind === "err" && JSON.stringify(missing.error).includes("no result for"));
      const nameless = await attestAndKeep(
        repo,
        {
          sample: drawn.value.id,
          results: [
            { item: first, verdict: "pass" },
            { item: second, verdict: "pass" },
          ],
          person: { name: " " },
          day: DAY,
        },
        { sign: false },
      );
      assert(nameless.kind === "err" && JSON.stringify(nameless.error).includes("named person"));
      const attested = await attestAndKeep(
        repo,
        {
          sample: drawn.value.id,
          results: [
            { item: first, verdict: "pass" },
            { item: second, verdict: "fail", note: "the run is not what its note says" },
          ],
          person: ANA,
          day: DAY,
        },
        { sign: false },
      );
      assert(attested.kind === "ok", attested.kind === "err" ? JSON.stringify(attested.error) : "");
      const twice = await attestAndKeep(repo, { sample: drawn.value.id, results: [], person: ANA, day: DAY }, { sign: false });
      assert(twice.kind === "err", "a sample is attested once");
      // the records are on the branch as chained ledger files, which the verifier walks
      const v = await verifyBranch(repo);
      assert(v.kind === "ok" && v.value.records === 2, "a sample and its attestation are two files of the ledger");
      const state = await readTier2(repo);
      assert(state.kind === "ok");
      const sample = state.value.assurance.samples[0];
      assert(sample !== undefined && sample.attested !== undefined);
      assertEquals(sample.attested.person, ANA);
      assertEquals(sample.seed, "7f3a");
      assertEquals(sample.attested.results.map((r) => r.verdict).sort(), ["fail", "pass"]);
      // the branch grows; the sample is still the one its seed gives, from the population as it stood
      await keep(repo, 4, ["the first holds"]);
      const again = await verifySamples(repo);
      assert(again.kind === "ok", again.kind === "err" ? JSON.stringify(again.error) : "");
      assertEquals(again.value, [drawn.value.id]);
      // a person is data: the fold takes the name the record gives and infers nothing
      const ledger = await readLedger(repo);
      assert(ledger.kind === "ok");
      assertEquals(foldAssurance(ledger.value.events).kind, "ok");
    } finally {
      await remove(repo, { recursive: true });
    }
  },
  needsGit,
);

proves(
  ["0021-ifqs FR-039", "0021-ifqs FR-045"],
  "a plan is registered before its run and the run records its hash: a run that followed it has no finding, and one that did not (a plan registered after, a case outside it, a planned case not run, an unknown plan) is named",
  async () => {
    const repo = await makeTempDir({ prefix: "ifc-plan-" });
    try {
      await repositoryWithCommit(repo);
      const registered = await registerPlan(repo, PLAN, ANA, DAY, { sign: false });
      assert(registered.kind === "ok", registered.kind === "err" ? JSON.stringify(registered.error) : "");
      assertEquals(registered.value.id, "PLAN-0001");
      // a plan with no case, and a case with no acceptance criterion, are refused and nothing is kept
      const empty = await registerPlan(repo, JSON.stringify({ title: "empty", cases: [] }), ANA, DAY, { sign: false });
      assert(empty.kind === "err" && JSON.stringify(empty.error).includes("at least one case"));
      const loose = await registerPlan(
        repo,
        JSON.stringify({ title: "loose", cases: [{ name: "a", requirements: [], acceptance: " " }] }),
        ANA,
        DAY,
        { sign: false },
      );
      assert(loose.kind === "err" && JSON.stringify(loose.error).includes("acceptance"));
      const plan = readPlan(PLAN);
      assert(plan.kind === "ok");
      const hash = await planHash(plan.value);
      assert(hash.kind === "ok");
      // the same plan is the same hash whatever the order of its keys
      const reordered = readPlan(JSON.stringify({ cases: plan.value.cases, title: plan.value.title }));
      assert(reordered.kind === "ok");
      const same = await planHash(reordered.value);
      assert(same.kind === "ok");
      assertEquals(same.value, hash.value);
      // a run that follows it: both cases, and the plan's hash
      await keep(repo, 1, ["the first holds", "the second holds"], { plan: hash.value });
      let state = await readTier2(repo);
      assert(state.kind === "ok");
      assertEquals(state.value.findings, [], "a run that followed its plan has no finding");
      // a run that did not run a planned case and did not report it: a finding; reported as not_run: none
      await keep(repo, 2, ["the first holds"], { plan: hash.value });
      state = await readTier2(repo);
      assert(state.kind === "ok");
      const missing = state.value.findings.filter((f) => f.kind === "planned-not-run");
      assertEquals(missing.length, 1);
      assertStringIncludes(missing.map(formatPlanFinding).join(), "the second holds");
      const planned = state.value.plans[0];
      assert(planned !== undefined);
      const notRun = notRunOfPlan(planned.id, planned.plan, ["the first holds"]);
      assertEquals(
        notRun.map((n) => n.name),
        ["the second holds"],
      );
      assertStringIncludes(notRun[0]?.reason ?? "", "PLAN-0001");
      await keep(repo, 3, ["the first holds"], { plan: hash.value, notRun });
      state = await readTier2(repo);
      assert(state.kind === "ok");
      assertEquals(state.value.findings.filter((f) => f.run.endsWith("3")).length, 0, "a planned case reported as not_run is no finding");
      // a case outside the plan, and a plan the branch does not hold
      await keep(repo, 4, ["the first holds", "the second holds", "a third nobody planned"], { plan: hash.value });
      await keep(repo, 5, ["the first holds"], { plan: "0".repeat(64) });
      state = await readTier2(repo);
      assert(state.kind === "ok");
      const kinds = state.value.findings.map((f) => f.kind).sort();
      assertEquals(kinds.includes("case-not-in-plan"), true);
      assertEquals(kinds.includes("unknown-plan"), true);
      // a plan registered after the run it names is not a pre-registered plan
      await keep(repo, 6, ["the first holds", "the second holds"], { plan: await laterPlan(plan.value) });
      await registerPlan(repo, JSON.stringify({ ...plan.value, title: "release 2" }), ANA, DAY, { sign: false });
      state = await readTier2(repo);
      assert(state.kind === "ok");
      assertEquals(
        state.value.findings.some((f) => f.kind === "registered-after"),
        true,
      );
    } finally {
      await remove(repo, { recursive: true });
    }
  },
  needsGit,
);

async function laterPlan(plan: { readonly title: string; readonly cases: readonly unknown[] }): Promise<string> {
  const later = readPlan(JSON.stringify({ ...plan, title: "release 2" }));
  assert(later.kind === "ok");
  const h = await planHash(later.value);
  assert(h.kind === "ok");
  return h.value;
}

const REPORT = JSON.stringify({
  schema: "ifqs-mutation-report/1",
  tool: { name: "a mutation tool the harness names", version: "9.1" },
  revision: "abc123",
  results: [
    { requirement: "0099-demo FR-001", mutants: 20, killed: 16, survived: 3, timeout: 1 },
    { requirement: "0099-demo FR-002", mutants: 12, killed: 4, survived: 6, noCoverage: 1, equivalent: 1 },
  ],
});

proves(
  ["0021-ifqs FR-040", "0021-ifqs FR-046"],
  "a mutation report becomes a record naming its tool, each requirement's strength is shown beside its grade, and a strength below the floor lowers the grade of a run",
  async () => {
    const repo = await makeTempDir({ prefix: "ifc-mutation-" });
    try {
      await repositoryWithCommit(repo);
      const kept = await ingestMutation(repo, REPORT, DAY, { sign: false });
      assert(kept.kind === "ok", kept.kind === "err" ? JSON.stringify(kept.error) : "");
      assertEquals(kept.value.id, "MUT-0001");
      const state = await readTier2(repo);
      assert(state.kind === "ok");
      const run = state.value.assurance.mutations[0];
      assert(run !== undefined);
      assertEquals(run.tool, { name: "a mutation tool the harness names", version: "9.1" });
      const s = strengths(state.value.assurance.mutations);
      // (16 + 1) / 20 = 85 %; (4 + 0) / (12 - 1) = 36.3 %
      assertEquals(s.get("0099-demo FR-001")?.permille, 850);
      assertEquals(s.get("0099-demo FR-002")?.permille, 363);
      assertEquals(showStrength(363), "36.3%");
      const strong = gradeAfterMutation("E4", true, s.get("0099-demo FR-001"));
      assertEquals([strong.grade, strong.effect], ["E4", "kept"]);
      const weak = gradeAfterMutation("E4", true, s.get("0099-demo FR-002"));
      assertEquals([weak.grade, weak.effect], ["E3", "lowered"]);
      assertStringIncludes(weak.why, "36.3%");
      assertEquals(gradeAfterMutation("E3", true, s.get("0099-demo FR-002")).grade, "E2");
      assertEquals(gradeAfterMutation("E3", true, undefined).effect, "unmeasured");
      assertEquals(gradeAfterMutation("E2", false, s.get("0099-demo FR-002")).effect, "not-a-run");
      assertEquals(DEFAULT_FLOOR_PERMILLE, 600);
      // a report whose rows do not account for their mutants, or that names no tool, is refused and nothing is kept
      const bad = readMutationReport(REPORT.replace('"killed":16', '"killed":17'));
      assert(bad.kind === "ok");
      const refused = mutationEvent([], bad.value, DAY);
      assert(refused.kind === "err" && refused.error.includes("accounts for"));
      const nameless = await ingestMutation(repo, REPORT.replace("a mutation tool the harness names", " "), DAY, { sign: false });
      assert(nameless.kind === "err");
      const allEquivalent = readMutationReport(
        REPORT.replace('"killed":16', '"killed":0')
          .replace('"survived":3', '"survived":0')
          .replace('"mutants":20', '"mutants":1')
          .replace('"timeout":1', '"equivalent":1'),
      );
      assert(allEquivalent.kind === "ok");
      assertEquals(strengthPermille(allEquivalent.value.results[0] ?? never()), undefined);
    } finally {
      await remove(repo, { recursive: true });
    }
  },
  needsGit,
);

proves(
  ["0021-ifqs FR-041"],
  "an agent's review is graded below a test run, and a person samples the agents' reviews at the stated rate: a sample owed, a review the person found wanting and an unattested sample are findings",
  async () => {
    const repo = await makeTempDir({ prefix: "ifc-agents-" });
    try {
      await repositoryWithCommit(repo);
      for (const [i, who] of ["agent-a", "agent-a", "agent-b", "agent-b"].entries()) {
        const review = attest({ kind: "review", requirement: `0099-demo FR-00${i + 1}`, by: "agent", who, sample: false }, DAY);
        assert(review.kind === "ok");
        const w = await appendEvents(repo, [review.value], { sign: false });
        assert(w.kind === "ok");
      }
      const person = attest({ kind: "review", requirement: "0099-demo FR-005", by: "person", who: "Ana", sample: false }, DAY);
      assert(person.kind === "ok");
      await appendEvents(repo, [person.value], { sign: false });
      const ledger = await readLedger(repo);
      assert(ledger.kind === "ok");
      assertEquals(agentReviewIds(ledger.value.events).length, 4, "only the agents' reviews are in the population");
      assertEquals(ledgerRecordIds(ledger.value.events).length, 5);
      // an agent's review is E2 and a test run's is E3: below it
      const graded = evidenceOfLedger(ledger.value.ledger)
        .filter((e) => e.kind === "review" && e.by === "agent")
        .map(gradeOfEvidence);
      assert(graded.length === 4 && graded.every((g) => gradeRank(g) < gradeRank(RUN_GRADE)), "an agent's review is graded below a run");
      // no sample yet: at 250 in a thousand one of four is owed
      let standing = await agentsOf(repo, 250);
      assert(standing.kind === "ok");
      assertEquals([standing.value.reviews, standing.value.needed, standing.value.sampled], [4, 1, 0]);
      assertEquals(
        standing.value.findings.map((f) => f.kind),
        ["sampling-owed"],
      );
      assertStringIncludes(formatAgentFinding(standing.value.findings[0] ?? { kind: "not-attested", sample: "" }), "1 are owed");
      // a person draws the sample at the stated rate, and finds the review wanting
      const drawn = await drawAndKeep(
        repo,
        { subject: "agent-reviews", by: ANA, day: DAY, seed: "agents", ratePermille: 500 },
        { sign: false },
      );
      assert(drawn.kind === "ok", drawn.kind === "err" ? JSON.stringify(drawn.error) : "");
      assertEquals(drawn.value.items.length, 2, "half of four");
      standing = await agentsOf(repo, 500);
      assert(standing.kind === "ok");
      assertEquals(
        standing.value.findings.map((f) => f.kind),
        ["not-attested", "sampling-owed"],
      );
      const [one = "", two = ""] = drawn.value.items;
      const attested = await attestAndKeep(
        repo,
        {
          sample: drawn.value.id,
          results: [
            { item: one, verdict: "pass" },
            { item: two, verdict: "fail" },
          ],
          person: ANA,
          day: DAY,
        },
        { sign: false },
      );
      assert(attested.kind === "ok");
      standing = await agentsOf(repo, 500);
      assert(standing.kind === "ok");
      assertEquals([standing.value.sampled, standing.value.passed, standing.value.failed], [2, 1, 1]);
      assertEquals(
        standing.value.findings.map((f) => f.kind),
        ["contradicted"],
      );
      assertEquals(standing.value.contradicted.length, 1);
      // the same standing from the pure function over the ledger's events
      const pure = agentStanding(ledger.value.events, foldOk(ledger.value.events), 250);
      assertEquals(pure.reviews, 4);
    } finally {
      await remove(repo, { recursive: true });
    }
  },
  needsGit,
);

function foldOk(events: Parameters<typeof foldAssurance>[0]): Assurance {
  const f = foldAssurance(events);
  assert(f.kind === "ok");
  return f.value;
}

function never(): never {
  throw new Error("the report has a row");
}
