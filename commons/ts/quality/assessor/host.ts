/**
 * What the Trust page and the assessor pack are made from, read once with real `git` (commons 0022-trust FR-001, FR-012): the evidence files of
 * the `quality` branch in the order they were kept, the ledger's files, the notes on the tested commits, the specifications at the tested
 * revisions, the proof judged on the ladder, the objectives and the records of Tier 2. `collect` reads them; `trustInputOf` and `packSourceOf` make
 * the page's content and the pack's source from the same `Collected`, so that the two are made from the same evidence in one run.
 *
 * @remarks
 * Nothing here reads a clock: the day of a page is `today` where one is given and the day of the newest thing on the branch otherwise, so that the
 * same repository gives the same page and the same pack. A pack is written as a folder, and as one deterministic tar beside it with its SHA-256
 * and a DCAT distribution (FR-013). `readPackFolder` and `readPackTar` read one back for `quality verify-pack`.
 *
 * @module
 */
import { filesAt } from "../host/ledger-branch.ts";
import { untar, filesOf } from "@intellectual-frontiers/formats/archive";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { mkdir, readFile, readTextFile, walkFiles, writeFile, exists } from "@intellectual-frontiers/system/fs";
import { dirname, fromFileUrl, join } from "@intellectual-frontiers/system/path";
import { type AgentStanding, agentStanding } from "../attestation/agents.ts";
import { gradeAfterMutation, mutationFloor, strengths, type Strength } from "../attestation/mutation.ts";
import type { Declaration } from "@intellectual-frontiers/mizan/changes/declaration";
import { readTier2, type Tier2State } from "../attestation/host.ts";
import { blobAt, verifyBranch } from "../host/branch.ts";
import { formatGatherError, gather, type Gathered } from "../host/gather.ts";
import { formatHostError, gitText, type HostError } from "../host/git.ts";
import { evaluateObjectives, indexOf } from "../host/report.ts";
import { DEFAULT_CADENCES } from "../pure/freshness.ts";
import { type Judgement, showProofCount, summarize } from "../pure/ladder.ts";
import { type Evaluation, SUGGESTED_OBJECTIVES } from "../pure/objectives.ts";
import { gradeRank, NOTES_REF, QUALITY_BRANCH } from "../pure/names.ts";
import { readQuality } from "../pure/record.ts";
import { daysBetween } from "../pure/ledger.ts";
import { oscalAssessmentResults } from "../../kernel/test-report.ts";
import type { TrustCapa, TrustFailure, TrustInput, TrustNonconformance, TrustObjective, TrustRequirement } from "../trust/view.ts";
import { buildPack, dcatOf, type BuiltPack, matrixTsv, type PackSource, type SourceFile, packTar } from "./pack.ts";
import { allowedSignersLine, figuresOf, type PackFiles } from "./verify-pack.ts";

/** Why the evidence could not be collected. */
export type CollectError =
  | { readonly kind: "gather"; readonly reason: string }
  | { readonly kind: "host"; readonly error: HostError }
  | { readonly kind: "refused"; readonly reason: string };

/** A collect error as one sentence. */
export function formatCollectError(e: CollectError): string {
  return e.kind === "host" ? formatHostError(e.error) : e.kind === "gather" ? e.reason : e.reason;
}

const host = (error: HostError): CollectError => ({ kind: "host", error });

/** What `collect` is given. */
export type CollectOptions = {
  readonly repo: string;
  /** The proof register; the repository's own where not given. */
  readonly register?: string;
  /** The day the page is as of: the day of the newest thing on the branch where not given (no clock). */
  readonly today?: string;
  /** The harness's declaration, where it has one: a regulated harness in production needs `E4` for every requirement (0021-ifqs FR-011). */
  readonly declaration?: Declaration;
  /** The revision the page and the pack are made at: `HEAD` where not given. */
  readonly revision?: string;
};

/** What was read. */
export type Collected = {
  readonly repo: string;
  readonly revision: string;
  readonly today: string;
  readonly gathered: Gathered;
  /** The harness's declaration the judgements were made under, where it has one. */
  readonly declaration?: Declaration;
  readonly tier2: Tier2State;
  readonly evaluations: readonly Evaluation[];
  readonly strengths: ReadonlyMap<string, Strength>;
  readonly evidence: readonly SourceFile[];
  readonly records: readonly SourceFile[];
  readonly notes: readonly { readonly commit: string; readonly text: string }[];
};

/** Reads the repository once for the page and the pack (FR-012). */
export async function collect(options: CollectOptions): Promise<Result<Collected, CollectError>> {
  const g = await gather({
    repo: options.repo,
    ...(options.register === undefined ? {} : { register: options.register }),
    ...(options.today === undefined ? {} : { today: options.today }),
    ...(options.declaration === undefined ? {} : { declaration: options.declaration }),
  });
  if (g.kind === "err") return err({ kind: "gather", reason: formatGatherError(g.error) });
  const tier2 = await readTier2(options.repo);
  if (tier2.kind === "err") return err({ kind: "refused", reason: JSON.stringify(tier2.error) });
  const rev = await gitText(options.repo, ["rev-parse", "--verify", "--quiet", `${options.revision ?? "HEAD"}^{commit}`]);
  const revision = rev.kind === "ok" && rev.value !== "" ? rev.value : "none";
  const evidence: SourceFile[] = [];
  const records: SourceFile[] = [];
  const notes: { commit: string; text: string }[] = [];
  const verified = await verifyBranch(options.repo);
  if (verified.kind === "ok") {
    for (const f of verified.value.files) {
      const body = await blobAt(options.repo, f.commit, f.path);
      if (body.kind === "err") return err(host(body.error));
      evidence.push({ path: f.path, text: body.value });
    }
    const tip = g.value.tip;
    if (tip !== undefined) {
      const filed = await filesAt(options.repo, tip);
      if (filed.kind === "err") return err(host(filed.error));
      records.push(...filed.value);
    }
    const listed = await gitText(options.repo, ["notes", "--ref", NOTES_REF, "list"]);
    if (listed.kind === "ok") {
      for (const line of listed.value.split("\n")) {
        const commit = line.trim().split(" ")[1];
        if (commit === undefined || commit === "") continue;
        const shown = await gitText(options.repo, ["notes", "--ref", NOTES_REF, "show", commit]);
        if (shown.kind === "ok") notes.push({ commit, text: shown.value });
      }
    }
  } else if (verified.error.kind !== "no-branch") {
    return err({
      kind: "refused",
      reason: `the ${QUALITY_BRANCH} branch does not verify, so no page or pack is made from it: ${JSON.stringify(verified.error)}`,
    });
  }
  const today = options.today ?? g.value.asOf;
  return ok({
    repo: options.repo,
    revision,
    today,
    gathered: g.value,
    ...(options.declaration === undefined ? {} : { declaration: options.declaration }),
    tier2: tier2.value,
    evaluations: evaluateObjectives(g.value, SUGGESTED_OBJECTIVES, g.value.asOf),
    strengths: strengths(tier2.value.assurance.mutations),
    evidence,
    records,
    notes,
  });
}

const isRunGrade = (g: Judgement["grade"]): boolean => gradeRank(g) >= 3 && gradeRank(g) <= 4;

/** The page's content from what was collected (FR-002, FR-003, FR-005): before redaction, which `trustViewOf` does. */
export function trustInputOf(
  c: Collected,
  options: {
    readonly harness: string;
    readonly scopeNote?: string;
    readonly notCovered?: readonly string[];
    readonly agentRatePermille?: number;
  },
): TrustInput {
  const g = c.gathered;
  const files: PackFiles = new Map([...c.evidence, ...c.records].map((f) => [f.path, new TextEncoder().encode(f.text)]));
  const figures = figuresOf(files);
  const summary = summarize(g.judgements);
  const count = showProofCount({
    proved: summary.proved,
    provedByGrade: summary.provedByGrade,
    reviewDebt: summary.reviewDebt,
    reviewDebtByAgent: summary.reviewDebtByAgent,
    reviewDebtByPerson: summary.reviewDebtByPerson,
  });
  const runOf = new Map<string, string>();
  for (const e of g.evidence) if (e.kind === "run") runOf.set(`${e.requirement} ${e.day}`, e.traceId);
  const requirements: TrustRequirement[] = g.judgements.map((j) => {
    const s = c.strengths.get(j.requirement);
    const after = gradeAfterMutation(j.grade, isRunGrade(j.grade), s, mutationFloor(c.declaration, c.today));
    const run = j.day === undefined ? undefined : runOf.get(`${j.requirement} ${j.day}`);
    return {
      id: j.requirement,
      grade: j.grade,
      freshness: j.freshness,
      required: j.required,
      proved: j.proved,
      ...(j.day === undefined ? {} : { day: j.day }),
      ...(run === undefined ? {} : { run }),
      ...(s === undefined ? {} : { strengthPermille: s.permille, gradeAfterStrength: after.grade }),
    };
  });
  const failures: TrustFailure[] = [];
  for (const f of c.evidence) {
    const q = readQuality(f.text);
    if (q.kind === "err") continue;
    const day = f.path.split("/").slice(2, 5).join("-");
    for (const k of q.value.cases) {
      if (k.outcome !== "fail" && k.outcome !== "not_run") continue;
      failures.push({
        run: q.value.traceId,
        day,
        requirements: k.requirements,
        name: k.name,
        outcome: k.outcome,
        reason: k.outcome === "fail" ? "the case failed" : (k.reason ?? "the case did not run"),
        ...(k.outcome === "fail" && k.message !== undefined ? { message: k.message } : {}),
        file: k.file,
      });
    }
  }
  const ledger = g.ledger.ledger;
  const nonconformances: TrustNonconformance[] = ledger.nonconformances.map((n) => ({
    id: n.id,
    requirement: n.requirement,
    cause: n.cause,
    state: n.state,
    openedOn: n.openedOn,
    ...(n.closedOn === undefined ? {} : { closedOn: n.closedOn }),
    ageDays: Math.max(0, daysBetween(n.openedOn, n.closedOn ?? c.today)),
    reason: n.reason,
    capas: n.capas,
  }));
  const capas: TrustCapa[] = ledger.capas.map((k) => ({
    id: k.id,
    nonconformance: k.nonconformance,
    state: k.state,
    openedOn: k.openedOn,
    action: k.action,
    test: `${k.test.name} (${k.test.requirement})`,
    ...(k.verified === undefined ? {} : { verifiedOn: k.verified.day }),
    ...(k.closed === undefined ? {} : { closedOn: k.closed.day }),
  }));
  const objectives: TrustObjective[] = c.evaluations.map((e) => ({
    id: e.objective.id,
    metric: e.objective.metric,
    comparator: e.objective.comparator,
    target: e.objective.target,
    unit: e.objective.unit,
    value: e.value,
    state: e.state,
    budget: e.objective.budget,
    remaining: e.remaining,
    windowDays: e.objective.windowDays,
  }));
  const days = g.runs.map((r) => r.day).sort();
  const newest = days[days.length - 1];
  const cadenceDays = DEFAULT_CADENCES.run.days;
  const overdue = newest === undefined ? 0 : daysBetween(newest, c.today) - cadenceDays;
  const agents: AgentStanding = agentStanding(c.tier2.ledger.events, c.tier2.assurance, options.agentRatePermille ?? 0);
  return {
    harness: options.harness,
    revision: c.revision,
    generated: c.today,
    ...(days.length === 0 ? {} : { span: { from: days[0] ?? "", to: newest ?? "" } }),
    ...(g.head === undefined ? {} : { head: g.head }),
    ...(options.scopeNote === undefined ? {} : { scopeNote: options.scopeNote }),
    notCovered: options.notCovered ?? [],
    figures,
    proof: {
      count: count.kind === "ok" ? count.value : "the count of proved requirements is not shown without its grade and the review debt",
      proved: summary.proved,
      requirements: summary.requirements,
      reviewDebt: summary.reviewDebt,
      reviewDebtByAgent: summary.reviewDebtByAgent,
      reviewDebtByPerson: summary.reviewDebtByPerson,
      byGrade: summary.byGrade,
    },
    requirements,
    failures,
    nonconformances,
    capas,
    objectives,
    ...(newest !== undefined && overdue > 0 ? { stale: { newest, cadenceDays, overdueDays: overdue } } : {}),
    people: {
      plans: c.tier2.assurance.plans.length,
      samplesDrawn: c.tier2.assurance.samples.length,
      samplesAttested: c.tier2.assurance.samples.filter((s) => s.attested !== undefined).length,
      mutationRuns: c.tier2.assurance.mutations.length,
      agentReviews: agents.reviews,
      agentReviewsSampled: agents.sampled,
    },
  };
}

async function specsAt(
  repo: string,
  revisions: readonly string[],
): Promise<{ readonly files: readonly SourceFile[]; readonly index: string }> {
  const files = new Map<string, string>();
  const index: Record<string, Record<string, string>> = {};
  for (const rev of revisions) {
    const listed = await gitText(repo, ["ls-tree", "-r", "--name-only", rev]);
    if (listed.kind === "err") continue;
    for (const p of listed.value.split("\n")) {
      const slug = /(?:^|\/)specs\/([^/]+)\/spec\.md$/.exec(p)?.[1];
      if (slug === undefined) continue;
      const body = await gitText(repo, ["show", `${rev}:${p}`]);
      if (body.kind === "err") continue;
      const path = `specs/${slug}/${(await sha256(body.value)).slice(0, 12)}.md`;
      files.set(path, body.value);
      (index[rev.slice(0, 12)] ??= {})[slug] = path;
    }
  }
  return { files: [...files].map(([path, text]) => ({ path, text })), index: `${JSON.stringify(index, null, 2)}\n` };
}

/** What a pack is made with besides the evidence. */
export type PackOptions = {
  readonly harness: string;
  readonly span?: { readonly from?: string; readonly to?: string };
  readonly signing?: PackSource["signing"];
};

/** The pack's source from what was collected, with the verifier's own files read from where this program is (FR-016). */
export async function packSourceOf(c: Collected, options: PackOptions): Promise<Result<PackSource, CollectError>> {
  const g = c.gathered;
  const input = trustInputOf(c, { harness: options.harness });
  const built = indexOf(g, SUGGESTED_OBJECTIVES);
  if (built.kind === "err") return err({ kind: "refused", reason: built.error });
  const revisions = [...new Set([c.revision, ...g.runs.flatMap((r) => (r.revision === undefined ? [] : [r.revision]))])].filter(
    (r) => r !== "none",
  );
  const specs = await specsAt(c.repo, revisions);
  const oscal: { traceId: string; text: string }[] = [];
  for (const f of c.evidence) {
    const q = readQuality(f.text);
    if (q.kind === "ok") oscal.push({ traceId: q.value.traceId, text: await oscalAssessmentResults(q.value.run) });
  }
  const here = dirname(fromFileUrl(import.meta.url));
  return ok({
    harness: options.harness,
    revision: c.revision,
    asOf: c.today,
    ...(options.span === undefined ? {} : { span: options.span }),
    evidence: c.evidence,
    records: c.records,
    notes: c.notes,
    specs: specs.files,
    specIndex: specs.index,
    matrix: matrixTsv(g.register, input.requirements),
    index: built.value.text,
    oscal,
    verifier: { pack: await readTextFile(join(here, "verify-pack.ts")), main: await readTextFile(join(here, "verify.ts")) },
    ...(options.signing === undefined ? {} : { signing: options.signing }),
  });
}

/** Writes a pack as a folder (refused where the folder is not empty), and beside it one deterministic tar with its SHA-256 and DCAT distribution (FR-013). */
export async function writePack(
  out: string,
  pack: BuiltPack,
  options: { readonly title: string; readonly revision: string },
): Promise<Result<{ readonly tar: string; readonly sha256: string; readonly dcat: string }, string>> {
  if ((await exists(out)) && (await walkFiles(out)).length > 0) return err(`${out} is not empty: a pack is written to a new folder`);
  for (const [path, bytes] of pack.files) {
    await mkdir(join(out, dirname(path)), { recursive: true });
    await writeFile(join(out, path), bytes);
  }
  const archive = packTar(pack);
  if (archive.kind === "err") return archive;
  const digest = await sha256(archive.value);
  const tarPath = `${out.replace(/[\\/]+$/, "")}.tar`;
  await writeFile(tarPath, archive.value);
  await writeFile(`${tarPath}.sha256`, new TextEncoder().encode(`${digest}  ${tarPath.split(/[\\/]/).pop() ?? tarPath}\n`));
  const dcat = `${tarPath}.dcat.json`;
  await writeFile(
    dcat,
    new TextEncoder().encode(
      dcatOf({
        title: options.title,
        file: tarPath.split(/[\\/]/).pop() ?? tarPath,
        sha256: digest,
        bytes: archive.value.length,
        revision: options.revision,
      }),
    ),
  );
  return ok({ tar: tarPath, sha256: digest, dcat });
}

/** The files of a pack folder. */
export async function readPackFolder(root: string): Promise<PackFiles> {
  const out = new Map<string, Uint8Array>();
  for (const rel of await walkFiles(root)) out.set(rel.replaceAll("\\", "/"), await readFile(join(root, rel)));
  return out;
}

/** The files of a pack tar. */
export async function readPackTar(path: string): Promise<Result<PackFiles, string>> {
  const entries = untar(await readFile(path));
  return entries.kind === "ok" ? ok(filesOf(entries.value)) : err(`${path} is not a tar archive: ${JSON.stringify(entries.error)}`);
}

/**
 * The key that signs a pack, from a JWK file (`{"kty":"OKP","crv":"Ed25519","x":...,"d":...}`), and the allowed-signers file that verifies it for
 * `principal`: the key is imported for signing alone, and what is published of it is the public part.
 */
export async function loadSigningKey(jwkText: string, principal: string): Promise<Result<NonNullable<PackSource["signing"]>, string>> {
  let jwk: JsonWebKey;
  try {
    jwk = JSON.parse(jwkText) as JsonWebKey;
  } catch {
    return err("the signing key is not JSON");
  }
  if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || typeof jwk.x !== "string" || typeof jwk.d !== "string")
    return err("the signing key is an Ed25519 private key as a JWK (kty OKP, crv Ed25519, x and d)");
  if (!/^[A-Za-z0-9._@-]+$/.test(principal)) return err(`${JSON.stringify(principal)} is not a principal an allowed-signers file can hold`);
  try {
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, ["sign"]);
    const pub = Uint8Array.from(atob(jwk.x.replaceAll("-", "+").replaceAll("_", "/")), (ch) => ch.charCodeAt(0));
    return ok({ keys: [{ key, keyid: principal }], allowedSigners: allowedSignersLine(principal, pub) });
  } catch (e) {
    return err(`the signing key cannot be used: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** A pack from the evidence collected: the page and the pack are made from the same `Collected` (FR-012). */
export async function packOf(c: Collected, options: PackOptions): Promise<Result<BuiltPack, string>> {
  const source = await packSourceOf(c, options);
  if (source.kind === "err") return err(formatCollectError(source.error));
  return buildPack(source.value);
}
