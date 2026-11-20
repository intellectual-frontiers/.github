// Spec: 0001-quality-evidence FR-026
/**
 * What the quality system reads of a repository to report on itself (commons 0001-quality-evidence FR-026 to FR-030, FR-039), with real `git`: the proof
 * register, the runs kept on the `quality` branch with the grade the branch gives each, the ledger of nonconformances and CAPA, the tests the
 * repository holds, and, for each piece of evidence, what in the requirement's chain changed after the revision of its run. It then judges every
 * requirement on the ladder (`pure/ladder.ts`) and finds the nonconformances to open (FR-015).
 *
 * @remarks
 * The change a run is held against is Git's own: the files that differ between the run's commit and `HEAD`, and the requirement's line in its
 * specification at the two (FR-030). A run whose commit this repository does not hold is judged by time only, and says so. Nothing is written
 * here; `quality.ts` writes the events this reports.
 *
 * @module
 */
import { instantOf } from "@intellectual-frontiers/grc/grc";
import type { Declaration } from "@intellectual-frontiers/mizan/changes/declaration";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { existsSync, readTextFile } from "@intellectual-frontiers/system/fs";
import { join } from "@intellectual-frontiers/system/path";
import { chainFiles, requirementLine, type SourceText, testsOf } from "../pure/chain-files.ts";
import { type Cadences, DEFAULT_CADENCES, freshnessOf } from "../pure/freshness.ts";
import type { IndexRun } from "../pure/index-file.ts";
import {
  type Evidence,
  evidenceOfLedger,
  evidenceOfRun,
  type Judged,
  type Judgement,
  judgeRequirement,
  parseRegister,
  type RegisterRow,
  superseding,
  gradeOfEvidence,
} from "../pure/ladder.ts";
import type { KnownTest } from "../pure/ledger.ts";
import { type Grade, QUALITY_BRANCH, RUN_GRADE } from "../pure/names.ts";
import { readQuality } from "../pure/record.ts";
import { blobAt, verifyBranch, type VerifyError, type VerifyOptions } from "./branch.ts";
import { formatHostError, gitRaw, gitText, type HostError } from "./git.ts";
import { type LedgerHostError, type LedgerRead, readLedger } from "./ledger-branch.ts";

/** What `gather` is given. */
export type GatherOptions = {
  readonly repo: string;
  /** The proof register's file; the repository's `commons/spec-kit/enforcement.tsv`, else `enforcement.tsv`, where not given. */
  readonly register?: string;
  /** The day today, `YYYY-MM-DD`: no clock is read here. Where not given, the day of the newest thing on the branch, so that the same branch gives the same judgement. */
  readonly today?: string;
  /** Whether to hold the evidence against what changed in Git after its run (FR-030); true where not given. The index of the branch does not (FR-024). */
  readonly changes?: boolean;
  readonly cadences?: Cadences;
  readonly verify?: VerifyOptions;
  /** The harness's declaration (`ifccm:HarnessDeclaration`): a regulated harness in production needs `E4` for every requirement (FR-016). Read by the caller, never here. */
  readonly declaration?: Declaration;
};

/** A run as the gatherer read it. */
export type GatheredRun = IndexRun & {
  readonly cases: readonly { readonly name: string; readonly requirements: readonly string[]; readonly outcome: string }[];
  readonly notRunCases: number;
};

/** What was read and judged. */
export type Gathered = {
  readonly register: readonly RegisterRow[];
  /** The declaration the judgements were made under, where one was given. */
  readonly declaration?: Declaration;
  readonly judgements: readonly Judgement[];
  readonly byRequirement: ReadonlyMap<string, Judgement>;
  readonly runs: readonly GatheredRun[];
  /** Every piece of evidence read, before the newest run supersedes the older ones. */
  readonly evidence: readonly Evidence[];
  readonly ledger: LedgerRead;
  readonly tests: readonly KnownTest[];
  /** The tip of the `quality` branch and the head of its chain, where there is a branch. */
  readonly tip?: string;
  readonly head?: string;
  /** Why the branch's evidence is not counted (a chain that does not verify: every run is `E0` until a new run). */
  readonly branchProblem?: string;
  /** The day of the newest run or record on the branch: the day the index is as of. */
  readonly asOf: string;
  /** What changed after each requirement's evidence, for the report: `requirement` to the changed files. */
  readonly changed: ReadonlyMap<string, readonly string[]>;
  /** Evidence whose revision this repository does not hold: judged by time only. */
  readonly unknownRevisions: readonly string[];
};

/** Why gathering failed. */
export type GatherError = HostError | LedgerHostError | { readonly kind: "register"; readonly path: string };

/** A gather error as one sentence. */
export function formatGatherError(e: GatherError): string {
  return e.kind === "register"
    ? `the proof register ${e.path} cannot be read`
    : e.kind === "ledger"
      ? `the ledger: ${e.reason}`
      : formatHostError(e);
}

async function trackedTs(repo: string): Promise<Result<readonly string[], HostError>> {
  const r = await gitText(repo, ["ls-files", "-z", "--", "*.ts"]);
  if (r.kind === "err") return r;
  return ok(r.value.split("\0").filter((p) => p !== ""));
}

async function sourcesOf(repo: string, paths: readonly string[]): Promise<readonly SourceText[]> {
  const out: SourceText[] = [];
  for (const p of paths) {
    try {
      out.push({ path: p, text: await readTextFile(join(repo, p)) });
    } catch {
      // a tracked file that is deleted in the working tree has no text to read
    }
  }
  return out;
}

/** The text of the specifications of the repository by slug, and where each is. */
async function specsOf(
  repo: string,
): Promise<{ readonly texts: readonly { readonly slug: string; readonly text: string }[]; readonly paths: ReadonlyMap<string, string> }> {
  const listed = await gitText(repo, ["ls-files", "-z", "--", "*/spec.md", "spec.md"]);
  const files = listed.kind === "ok" ? listed.value.split("\0").filter((p) => /(^|\/)specs\/[^/]+\/spec\.md$/.test(p)) : [];
  const texts: { slug: string; text: string }[] = [];
  const paths = new Map<string, string>();
  for (const p of files) {
    const slug = /specs\/([^/]+)\/spec\.md$/.exec(p)?.[1] ?? "";
    try {
      texts.push({ slug, text: await readTextFile(join(repo, p)) });
      paths.set(slug, p);
    } catch {
      // a deleted specification has no text
    }
  }
  return { texts, paths };
}

async function holds(repo: string, rev: string): Promise<boolean> {
  const r = await gitRaw(repo, ["cat-file", "-e", `${rev}^{commit}`]);
  return r.kind === "ok" && r.value.code === 0;
}

/** The revision HEAD was at, at the end of a day (for evidence that carries a day and no revision). */
async function revisionAt(repo: string, day: string): Promise<string | undefined> {
  const r = await gitText(repo, ["rev-list", "-1", `--before=${day}T23:59:59Z`, "HEAD"]);
  return r.kind === "ok" && r.value !== "" ? r.value : undefined;
}

/** Reads the repository and judges every requirement (FR-026 to FR-030). */
export async function gather(options: GatherOptions): Promise<Result<Gathered, GatherError>> {
  const repo = options.repo;
  const registerFile =
    options.register ??
    (existsSync(join(repo, "commons", "spec-kit", "enforcement.tsv"))
      ? join(repo, "commons", "spec-kit", "enforcement.tsv")
      : join(repo, "enforcement.tsv"));
  let register: readonly RegisterRow[] = [];
  if (options.register !== undefined || existsSync(registerFile)) {
    try {
      register = parseRegister(await readTextFile(registerFile));
    } catch {
      return err({ kind: "register", path: registerFile });
    }
  }
  // the branch: the runs and the grade the branch gives each
  const runs: GatheredRun[] = [];
  const evidence: Evidence[] = [];
  let head: string | undefined;
  let branchProblem: string | undefined;
  const verified = await verifyBranch(repo, options.verify ?? {});
  if (verified.kind === "err") {
    const e: VerifyError = verified.error;
    if (e.kind === "git-missing" || e.kind === "git") return err(e);
    if (e.kind !== "no-branch")
      branchProblem = `the ${QUALITY_BRANCH} branch does not verify, so its evidence is not counted: ${describe(e)}`;
  } else {
    head = verified.value.head;
    const gradeOf = new Map(verified.value.grades.map((g) => [g.path, g.grade]));
    for (const f of verified.value.files) {
      const body = await blobAt(repo, f.commit, f.path);
      if (body.kind === "err") return body;
      const q = readQuality(body.value);
      if (q.kind === "err") continue;
      const grade: Grade = gradeOf.get(f.path) ?? RUN_GRADE;
      evidence.push(...evidenceOfRun(q.value, grade));
      runs.push({
        traceId: q.value.traceId,
        path: f.path,
        day: f.path.split("/").slice(2, 5).join("-"),
        ...(q.value.run.runner.revision === undefined ? {} : { revision: q.value.run.runner.revision }),
        grade,
        tests: q.value.counts.tests,
        passed: q.value.counts.passed,
        failed: q.value.counts.failed,
        notRun: q.value.counts.notRun,
        notRunCases: q.value.counts.notRun,
        cases: q.value.cases.map((c) => ({ name: c.name, requirements: c.requirements, outcome: c.outcome })),
      });
    }
  }
  const ledger = await readLedger(repo);
  if (ledger.kind === "err") return ledger;
  evidence.push(...evidenceOfLedger(ledger.value.ledger));
  const days = [
    ...runs.map((r) => r.day),
    ...ledger.value.ledger.attestations.map((a) => a.day),
    ...ledger.value.ledger.nonconformances.map((n) => n.openedOn),
  ];
  const asOf = days.sort().at(-1) ?? options.today ?? "1970-01-01";
  const today = options.today ?? asOf;

  // the repository's sources, for the chain of each requirement and for the tests a CAPA may name
  const tracked = await trackedTs(repo);
  if (tracked.kind === "err") return tracked;
  const sources = await sourcesOf(repo, tracked.value);
  const specs = await specsOf(repo);
  const tests = sources.filter((s) => s.path.endsWith(".test.ts") || s.text.includes("proves(")).flatMap((s) => testsOf(s.text));
  const universe = [...new Set([...register.map((r) => r.requirement), ...evidence.map((e) => e.requirement)])].sort();
  const chains = chainFiles(universe, sources, specs.paths);

  // what changed after each piece of evidence
  const now = instantOf(`${today}T23:59:59.999Z`);
  if (now === undefined) return err({ kind: "unreadable", reason: `${today} is not a day` });
  const changedCache = new Map<string, ReadonlySet<string> | undefined>();
  const specAt = new Map<string, string | undefined>();
  const changedSince = async (rev: string): Promise<ReadonlySet<string> | undefined> => {
    if (changedCache.has(rev)) return changedCache.get(rev);
    let result: ReadonlySet<string> | undefined;
    if (await holds(repo, rev)) {
      const d = await gitText(repo, ["diff", "--name-only", "-z", rev, "HEAD"]);
      const ancestor = await gitRaw(repo, ["merge-base", "--is-ancestor", rev, "HEAD"]);
      if (d.kind === "ok" && ancestor.kind === "ok")
        result = new Set([
          ...d.value.split("\0").filter((p) => p !== ""),
          ...(ancestor.value.code === 0 ? [] : [`(the commit ${rev.slice(0, 12)} is not an ancestor of HEAD)`]),
        ]);
    }
    changedCache.set(rev, result);
    return result;
  };
  const specTextAt = async (rev: string, path: string): Promise<string | undefined> => {
    const key = `${rev}:${path}`;
    if (!specAt.has(key)) {
      const b = await gitText(repo, ["show", `${rev}:${path}`]);
      specAt.set(key, b.kind === "ok" ? b.value : undefined);
    }
    return specAt.get(key);
  };
  const dayRevisions = new Map<string, string | undefined>();
  const changed = new Map<string, readonly string[]>();
  const unknownRevisions = new Set<string>();
  const byReq = new Map<string, Evidence[]>();
  for (const e of evidence) byReq.set(e.requirement, [...(byReq.get(e.requirement) ?? []), e]);
  const judgements: Judgement[] = [];
  for (const requirement of universe) {
    const list = superseding(byReq.get(requirement) ?? []);
    const chain = chains.get(requirement) ?? [];
    const judged: Judged[] = [];
    for (const e of list) {
      let rev = e.kind === "run" ? e.revision : undefined;
      if (rev === undefined && e.kind !== "run") {
        if (!dayRevisions.has(e.day)) dayRevisions.set(e.day, await revisionAt(repo, e.day));
        rev = dayRevisions.get(e.day);
      }
      const what: string[] = [];
      if (rev !== undefined && options.changes !== false) {
        const diff = await changedSince(rev);
        if (diff === undefined) unknownRevisions.add(rev);
        else {
          what.push(...[...diff].filter((p) => chain.includes(p) && !p.endsWith("/spec.md") && !p.endsWith("spec.md")));
          what.push(...[...diff].filter((p) => p.startsWith("(")));
          const [slug = "", fr = ""] = requirement.split(" ");
          const specPath = specs.paths.get(slug);
          if (specPath !== undefined && diff.has(specPath)) {
            const then = await specTextAt(rev, specPath);
            const nowText = specs.texts.find((t) => t.slug === slug)?.text;
            if (then !== undefined && nowText !== undefined && requirementLine(then, fr) !== requirementLine(nowText, fr))
              what.push(`${slug} ${fr} in ${specPath}`);
          }
        }
      }
      const verdict = freshnessOf(e, what, now, options.cadences ?? DEFAULT_CADENCES);
      if (what.length > 0) changed.set(requirement, [...new Set([...(changed.get(requirement) ?? []), ...what])]);
      judged.push({ evidence: e, grade: gradeOfEvidence(e), freshness: verdict });
    }
    judgements.push(judgeRequirement(requirement, judged, { declaration: options.declaration, today }));
  }
  return ok({
    register,
    ...(options.declaration === undefined ? {} : { declaration: options.declaration }),
    judgements,
    byRequirement: new Map(judgements.map((j) => [j.requirement, j])),
    runs,
    evidence,
    ledger: ledger.value,
    tests,
    ...(ledger.value.tip === undefined ? {} : { tip: ledger.value.tip }),
    ...(head === undefined ? {} : { head }),
    ...(branchProblem === undefined ? {} : { branchProblem }),
    asOf,
    changed,
    unknownRevisions: [...unknownRevisions].sort(),
  });
}

function describe(e: VerifyError): string {
  return JSON.stringify(e);
}

/** The author of a commit, as an e-mail address, for the rule that a regulated harness's CAPA is not closed by the author of its change (FR-035). */
export async function authorOf(repo: string, revision: string): Promise<Result<string, HostError>> {
  const r = await gitText(repo, ["log", "-1", "--format=%ae", revision]);
  return r.kind === "ok" ? ok(r.value.trim()) : r;
}

/** Whether `earlier` is an ancestor of, or the same commit as, `later` (FR-034: the run is at a revision that holds the last commit of the corrective change). */
export async function isAfter(repo: string, earlier: string, later: string): Promise<boolean> {
  if (earlier === later) return true;
  const r = await gitRaw(repo, ["merge-base", "--is-ancestor", earlier, later]);
  return r.kind === "ok" && r.value.code === 0;
}
