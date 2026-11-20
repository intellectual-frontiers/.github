// Spec: 0007-repoctl-prove FR-011
/**
 * The run of a proof plan (commons repoctl 0007-repoctl-prove FR-001, FR-011, FR-012): the proofs of the tiers that run here, each a program in its folder, except the proofs of tests, whose tests are selected by what changed (the imports
 * of each test, the requirements the changed files name, the symbols a seam's library imports), left out where a quarantine holds them, taken from the cache where their key is in it, and run each as its own program. The tiers run in
 * order, and the proofs of a tier several at a time.
 *
 * @remarks
 * A proof of tests passes where every test selected for it passed; its detail says how many ran, how many came from the cache and how many were left out. What is left out is reported with its reason, so that a run says why it is safe.
 *
 * @limits
 * The platform and release proofs do not run here. A failure is never cached, and a test that reads the checkout is never left out nor cached.
 *
 * @example
 * ```ts
 * import { quarantineOf } from "./prove-run.ts";
 * typeof quarantineOf; // "function"
 * ```
 *
 * @module
 */
import { type Proof, type ProofTier, type QuarantineEntry, parseQuarantine, proofKey, type SkipReason } from "@intellectual-frontiers/repoctl/governance";
import { applyQuarantine, type LibraryNode, pool, type PlannedProof, selectSeam, selectTests, type Selection, type SkippedProof, type TestReach, type World } from "@intellectual-frontiers/repoctl/logical";
import { join } from "@intellectual-frontiers/system/path";
import { commandOf, type Planned, type ProofOutcome, runProof } from "./prove.ts";
import { packageIndexOf, readerOf, readTests, type ResultCache, runTests, type TestOutcome } from "./tests.ts";

/** The proofs of a plan that are suites of tests. */
const testsOf = (p: Proof): { readonly library: string; readonly provider: string | undefined } | undefined => {
  switch (p.kind) {
    case "suite":
    case "smoke":
      return { library: p.library, provider: undefined };
    case "seam":
      return { library: p.consumer, provider: p.provider };
    case "docs-check":
    case "spec-check":
    case "trace-check":
    case "types":
    case "sync-check":
    case "versions-check":
    case "pack":
    case "end-to-end":
    case "platform":
    case "release-gate":
      return undefined;
  }
};

/** The quarantine record of the repository: its entries, or none where there is no record; a record that is wrong is an error. */
export async function quarantineOf(w: World): Promise<{ readonly entries: readonly QuarantineEntry[] } | { readonly problem: string }> {
  const text = await w.files.read(join(w.repo, "commons", "repoctl", "quarantine.json"));
  if (text === undefined) return { entries: [] };
  const r = parseQuarantine(text);
  return r.kind === "ok" ? { entries: r.value } : { problem: `commons/repoctl/quarantine.json: ${r.error}` };
}

/** What a run was asked: the tiers, the cache, the quarantine, today (`YYYY-MM-DD`) and how many programs at a time. */
export type RunWanted = { readonly tiers: readonly ProofTier[]; readonly cache: ResultCache; readonly quarantine: readonly QuarantineEntry[]; readonly today: string; readonly width: number };

/** A proof with how it ended. */
export type ProofReport = { readonly proof: PlannedProof; readonly outcome: ProofOutcome };

/** What a run did: each proof's report, what the selection left out and why, and the quarantine entries that have expired. */
export type RunReport = { readonly reports: readonly ProofReport[]; readonly left: readonly SkippedProof[]; readonly expired: readonly QuarantineEntry[] };

const everything = (planned: Planned): boolean => planned.plan.proofs.some((p) => p.proof.kind === "release-gate");

/** Runs the proofs of a plan that the tiers ask for. */
export async function runPlan(w: World, planned: Planned, base: string, wanted: RunWanted): Promise<RunReport> {
  const index = await packageIndexOf(w, planned.graph);
  const reader = readerOf(w, index);
  const nodes = new Map<string, LibraryNode>(planned.graph.map((n) => [n.name, n]));
  const reports: ProofReport[] = [];
  const left: SkippedProof[] = [];
  const expired = new Map<string, QuarantineEntry>();
  const all = everything(planned);
  const changed = planned.changed.flatMap((c) => (c.after === undefined ? [{ path: c.path, text: c.before ?? "" }] : [{ path: c.path, text: c.after }]));
  const suites = new Map<string, readonly TestReach[]>();
  const suiteOf = async (library: string): Promise<readonly TestReach[]> => {
    const known = suites.get(library);
    if (known !== undefined) return known;
    const node = nodes.get(library);
    const tests = node === undefined ? [] : await readTests(w, node, index, reader);
    suites.set(library, tests);
    return tests;
  };
  const record = (tier: ProofTier, subject: string, reason: SkipReason, because: string): void => {
    left.push({ tier, subject, reason, because });
  };
  const ran = new Set<string>();
  for (const tier of wanted.tiers) {
    const here = planned.plan.proofs.filter((p) => p.tier === tier);
    const plain: PlannedProof[] = [];
    const bearing: { readonly proof: PlannedProof; readonly selected: readonly TestReach[]; readonly cachedAway: number }[] = [];
    for (const p of here) {
      const t = testsOf(p.proof);
      if (t === undefined) {
        const c = commandOf(w.repo, p.proof, base);
        const key = c === undefined ? proofKey(p.proof) : `${c.cwd}\u0000${c.argv.join(" ")}`;
        if (!ran.has(key)) {
          ran.add(key);
          plain.push(p);
        }
        continue;
      }
      const tests = await suiteOf(t.library);
      let selection: Selection;
      const why = p.why;
      if (p.proof.kind === "smoke" || all) selection = selectTests(tests, changed, true);
      else if (p.proof.kind === "seam" && t.provider !== undefined) {
        const delta = why.kind === "surface" ? (why.symbols.length === 0 ? ({ kind: "unknown", why: "every symbol" } as const) : ({ kind: "changed", symbols: why.symbols } as const)) : why.kind === "surface-unknown" ? ({ kind: "unknown", why: why.why } as const) : ({ kind: "unknown", why: "the plan reaches the whole library" } as const);
        selection = selectSeam(tests, p.proof.provider, delta);
      } else selection = selectTests(tests, changed, false);
      const subject = proofKey(p.proof);
      if (selection.left.length > 0) record(tier, subject, "tests-unaffected", `${selection.left.length} of ${tests.length} tests import nothing that changed and prove no changed requirement`);
      const held = applyQuarantine(selection.run, wanted.quarantine, wanted.today);
      for (const e of held.expired) expired.set(e.test, e);
      for (const h of held.held) record(tier, `${h.item.test.path}`, "quarantined", `owned by ${h.entry.owner} until ${h.entry.expires}: ${h.entry.reason}`);
      bearing.push({ proof: p, selected: held.run.map((r) => r.test), cachedAway: 0 });
    }
    const width = wanted.width;
    const plainDone = await pool(plain, width, async (p): Promise<ProofReport> => ({ proof: p, outcome: await runProof(w, p.proof, base) }));
    reports.push(...plainDone);
    const jobs = new Map<string, TestReach>();
    for (const b of bearing) for (const t of b.selected) jobs.set(t.path, t);
    const outcomes: ReadonlyMap<string, TestOutcome> = await runTests(w, [...jobs.values()], wanted.cache, index, width);
    for (const b of bearing) {
      const mine = b.selected.map((t) => outcomes.get(t.path));
      const failed = b.selected.flatMap((t) => {
        const o = outcomes.get(t.path);
        return o?.kind === "failed" ? [{ t, o }] : [];
      });
      const cached = mine.filter((o) => o?.kind === "passed" && o.cached).length;
      const seconds = mine.reduce((n, o) => n + (o?.seconds ?? 0), 0);
      const detail = `${b.selected.length} tests, ${cached} from the cache`;
      if (cached > 0) record(tier, proofKey(b.proof.proof), "cache-hit", `${cached} tests have the key of a test that passed: the same test, the same sources it imports, the same runtime`);
      reports.push({
        proof: b.proof,
        outcome:
          failed.length === 0
            ? { kind: "passed", seconds, detail }
            : { kind: "failed", seconds, detail, output: failed.flatMap(({ t, o }) => [`${t.path}${o.seeds.length > 0 ? ` (${o.seeds.join("; ")})` : ""}`, ...o.output.slice(-8)]) },
      });
    }
  }
  return { reports, left, expired: [...expired.values()] };
}
