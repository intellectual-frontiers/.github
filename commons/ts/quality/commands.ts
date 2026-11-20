/**
 * The commands of the quality system that report on it (commons 0021-ifqs FR-007, FR-019, FR-022, FR-025 to FR-036), run by `quality.ts`:
 * `index` writes (or `--check`s) the index of the branch and the objectives' metrics, `freshness` judges every requirement and opens the
 * nonconformances it calls for, `nonconformances` lists them and links one to its Problem change request, `capa open|verify|close` carries a
 * CAPA through its three states, `register` shows the proof register with the grade and day of each row's evidence, `tier` judges the tier a
 * harness claims, and `attest` records a statement, a review or a probe's report as evidence.
 *
 * @remarks
 * Exit status: 0 where it did what was asked and nothing is wrong, 1 where it found something (a stale proof, an index that differs, a tier that
 * is not met) or refused, 2 for a command line that does not fit. The day today is read once, here, from the clock; every judgement below takes it
 * as an argument.
 *
 * @module
 */
import { flag, formatUsageError, helpText, parseArgs, type Parser, value } from "../kernel/args.ts";
import { err, ok } from "@intellectual-frontiers/core";
import { exists, readTextFile, writeTextFile } from "../runtime/fs.ts";
import { build, runtimeName, runtimeVersion } from "../runtime/proc.ts";
import { stderr, stdout } from "../runtime/stdio.ts";
import { appendEvents, formatLedgerHostError, readLedger } from "./host/ledger-branch.ts";
import { authorOf, formatGatherError, gather, isAfter } from "./host/gather.ts";
import { evaluateObjectives, indexOf, openings } from "./host/report.ts";
import { gitText } from "./host/git.ts";
import { indexIsCurrent } from "./pure/index-file.ts";
import { parseRegister, registerView, showProofCount, summarize } from "./pure/ladder.ts";
import {
  attest,
  type Approver,
  closeCapa,
  linkProblem,
  type LedgerEvent,
  openCapa,
  openNonconformances,
  unlinked,
  verifyFromRun,
} from "./pure/ledger.ts";
import { objectiveMetricsJson, showEvaluation, SUGGESTED_OBJECTIVES } from "./pure/objectives.ts";
import { isDay } from "./pure/time.ts";
import { regulatedInProduction } from "./pure/ladder.ts";
import { isTier, judgeTier, type TierProof } from "./pure/tier.ts";
import { archiveBranch, formatArchiveError } from "./host/archive.ts";
import { readDeclaration } from "./host/declaration.ts";
import { showRetention, tagNameProblem } from "./pure/retention.ts";
import { showGrade } from "./pure/names.ts";
import type { QualityRecord } from "./pure/record.ts";

const say = (text: string): void => void stdout.writeSync(`${text}\n`);
const complain = (text: string): void => void stderr.writeSync(`quality: ${text}\n`);

/** The day today, from the clock: the one place the commands read it. */
export function clockDay(): string {
  return new Date().toISOString().slice(0, 10);
}

const dayParser: Parser<string> = (t) => (isDay(t) ? ok(t) : err("a day is YYYY-MM-DD"));

const REPO = value({ help: "The repository the `quality` branch is in.", valueName: "DIR", default: "." });
const REGISTER = value({ help: "The proof register (enforcement.tsv); the repository's own where not given.", valueName: "FILE" });
const DECLARATION = value({
  help: "The harness's record (ifccm.declaration.ts of the repository where not given): a regulated harness in production needs E4 for every requirement and a mutation floor of 800.",
  valueName: "FILE",
});
const TODAY = value({ help: "The day to judge at, YYYY-MM-DD (the clock where not given).", valueName: "DAY", parse: dayParser });
const SIGN = flag({ help: "Sign the commits that keep it (--no-sign: do not; neither: as commit.gpgsign says).", negatable: true });

const fail = (message: string, code: number): number => {
  complain(message);
  return code;
};
const help = (text: string): number => {
  say(text);
  return 0;
};

// ---------------------------------------------------------------------------------------------------------------------------- index

const INDEX = {
  repo: REPO,
  register: REGISTER,
  out: value({ help: "The file to write the index to; without it the index is printed.", valueName: "FILE" }),
  check: flag({ help: "Fail where the file given by --out is not what the branch gives." }),
  metrics: value({ help: "Also write the objectives as OpenTelemetry metrics (OTLP/JSON) to this file.", valueName: "FILE" }),
};

/** `quality index`: the index of the branch, derived from it alone (FR-019). */
export async function indexCommand(rest: readonly string[]): Promise<number> {
  const p = parseArgs(rest, INDEX);
  if (p.kind === "err") return fail(formatUsageError(p.error, "quality index"), 2);
  if (p.value.kind === "help") return help(helpText("quality index", "Derive the index of the quality branch.", INDEX));
  const o = p.value.options;
  if (o.check && o.out === undefined) return fail("--check compares the file given by --out: give --out FILE", 2);
  const g = await gather({ repo: o.repo, changes: false, ...(o.register === undefined ? {} : { register: o.register }) });
  if (g.kind === "err") return fail(formatGatherError(g.error), 1);
  const built = indexOf(g.value, SUGGESTED_OBJECTIVES);
  if (built.kind === "err") return fail(built.error, 1);
  if (o.metrics !== undefined) {
    const resource = {
      attributes: {
        "service.name": "ifc.quality",
        "process.runtime.name": runtimeName(),
        "process.runtime.version": runtimeVersion(),
        "os.type": build.os,
      },
    };
    const json = objectiveMetricsJson(built.value.evaluations, resource, BigInt(Date.parse(`${g.value.asOf}T00:00:00Z`)) * 1_000_000n);
    if (json.kind === "err") return fail(json.error, 1);
    await writeTextFile(o.metrics, json.value);
    say(`quality: metrics ${o.metrics}`);
  }
  if (o.out === undefined) {
    stdout.writeSync(built.value.text);
    return 0;
  }
  if (o.check) {
    const onDisk = (await exists(o.out)) ? await readTextFile(o.out) : undefined;
    if (onDisk === undefined || !indexIsCurrent(onDisk, built.value.text)) {
      return fail(`${o.out} is not what the quality branch gives; run quality index --out ${o.out}`, 1);
    }
    say(`quality: ${o.out} is what the branch gives`);
    return 0;
  }
  await writeTextFile(o.out, built.value.text);
  say(`quality: index ${o.out}`);
  return 0;
}

// ---------------------------------------------------------------------------------------------------------------------------- freshness

const FRESHNESS = {
  repo: REPO,
  declaration: DECLARATION,
  register: REGISTER,
  today: TODAY,
  open: flag({ help: "Open the nonconformances the stale and failed proofs and the spent budgets call for." }),
  sign: SIGN,
};

/** `quality freshness`: every requirement judged by time and by change; with `--open` the nonconformances it calls for are opened (FR-007, FR-025, FR-033). */
export async function freshnessCommand(rest: readonly string[]): Promise<number> {
  const p = parseArgs(rest, FRESHNESS);
  if (p.kind === "err") return fail(formatUsageError(p.error, "quality freshness"), 2);
  if (p.value.kind === "help") return help(helpText("quality freshness", "Judge the freshness of every proof.", FRESHNESS));
  const o = p.value.options;
  const today = o.today ?? clockDay();
  const declared = await readDeclaration(o.repo, o.declaration);
  if (declared.kind === "err") return fail(declared.error, 3);
  const g = await gather({
    repo: o.repo,
    today,
    ...(o.register === undefined ? {} : { register: o.register }),
    ...(declared.value === undefined ? {} : { declaration: declared.value }),
  });
  if (g.kind === "err") return fail(formatGatherError(g.error), 1);
  const G = g.value;
  if (G.branchProblem !== undefined) say(`quality: ${G.branchProblem}`);
  let found = G.branchProblem === undefined ? 0 : 1;
  for (const j of G.judgements) {
    if (j.failed !== undefined) {
      found++;
      say(`${j.requirement}: failed (${j.failed.evidence.kind === "run" ? j.failed.evidence.detail : "a probe reported it"})`);
    } else if (j.stale !== undefined) {
      found++;
      say(
        `${j.requirement}: stale by ${j.stale.freshness.by}, ${j.stale.freshness.why}; it counted ${showGrade(j.stale.grade)} and now counts ${showGrade(j.grade)}`,
      );
    }
  }
  for (const rev of G.unknownRevisions)
    say(`quality: the commit ${rev.slice(0, 12)} is not in this repository: its runs are judged by time only`);
  const s = summarize(G.judgements);
  const count = showProofCount({
    proved: s.proved,
    provedByGrade: s.provedByGrade,
    reviewDebt: s.reviewDebt,
    reviewDebtByAgent: s.reviewDebtByAgent,
    reviewDebtByPerson: s.reviewDebtByPerson,
  });
  say(`quality: ${count.kind === "ok" ? count.value : count.error} of ${s.requirements} requirements; ${s.stale} stale proofs`);
  const evals = evaluateObjectives(G, SUGGESTED_OBJECTIVES, today);
  for (const e of evals) say(`quality: ${showEvaluation(e)}`);
  const wanted = openings(G, evals, today);
  if (wanted.length === 0) say("quality: no nonconformance to open");
  for (const e of wanted)
    if (e.kind === "nonconformance-opened") say(`quality: ${o.open ? "opening" : "would open"} ${e.id} for ${e.requirement} (${e.cause})`);
  if (o.open && wanted.length > 0) {
    const r = await appendEvents(o.repo, wanted, o.sign === undefined ? {} : { sign: o.sign });
    if (r.kind === "err") return fail(formatLedgerHostError(r.error), 1);
    say(
      `quality: ${wanted.length} nonconformance${wanted.length === 1 ? "" : "s"} opened; link each to its Problem change request with nonconformances --link`,
    );
  }
  return found > 0 || wanted.length > 0 ? 1 : 0;
}

// ---------------------------------------------------------------------------------------------------------------------------- nonconformances

const NONCONFORMANCES = {
  repo: REPO,
  all: flag({ help: "Also list the closed ones, which stay in the record (FR-031)." }),
  link: value({ help: "Link this nonconformance (NC-0001) to its Problem change request; give --issue.", valueName: "NC" }),
  issue: value({
    help: "The number of the Problem change request, with --link.",
    valueName: "N",
    parse: (t) => (/^\d+$/.test(t) && Number(t) > 0 ? ok(Number(t)) : err("an issue number")),
  }),
  issueRepo: value({ help: "The repository of the change request, owner/name, where it is not this one.", valueName: "OWNER/NAME" }),
  today: TODAY,
  sign: SIGN,
};

/** `quality nonconformances`: the nonconformances and their CAPA, closed ones kept (FR-026, FR-031); `--link` records the Problem change request. */
export async function nonconformancesCommand(rest: readonly string[]): Promise<number> {
  const p = parseArgs(rest, NONCONFORMANCES);
  if (p.kind === "err") return fail(formatUsageError(p.error, "quality nonconformances"), 2);
  if (p.value.kind === "help")
    return help(helpText("quality nonconformances", "List the nonconformances and their CAPA.", NONCONFORMANCES));
  const o = p.value.options;
  const read = await readLedger(o.repo);
  if (read.kind === "err") return fail(formatLedgerHostError(read.error), 1);
  if (o.link !== undefined) {
    if (o.issue === undefined) return fail("--link needs --issue N", 2);
    const e = linkProblem(
      read.value.ledger,
      o.link,
      { number: o.issue, ...(o.issueRepo === undefined ? {} : { repo: o.issueRepo }) },
      o.today ?? clockDay(),
    );
    if (e.kind === "err") return fail(e.error, 1);
    const w = await appendEvents(o.repo, [e.value], o.sign === undefined ? {} : { sign: o.sign });
    if (w.kind === "err") return fail(formatLedgerHostError(w.error), 1);
    say(`quality: ${o.link} is linked to Problem #${o.issue}`);
    return 0;
  }
  const l = read.value.ledger;
  const list = o.all ? l.nonconformances : openNonconformances(l);
  for (const n of list) {
    const capas = l.capas.filter((c) => c.nonconformance === n.id).map((c) => `${c.id} ${c.state}`);
    say(
      `${n.id} ${n.state === "NonconformanceOpen" ? "open" : "closed"} ${n.requirement} (${n.cause}) opened ${n.openedOn}${n.problem === undefined ? ", no Problem change request linked" : `, Problem #${n.problem.number}`}${capas.length === 0 ? ", no CAPA" : `, ${capas.join(", ")}`}: ${n.reason}`,
    );
  }
  say(
    `quality: ${openNonconformances(l).length} open, ${l.nonconformances.length - openNonconformances(l).length} closed, ${unlinked(l).length} not linked to a Problem change request`,
  );
  return 0;
}

// ---------------------------------------------------------------------------------------------------------------------------- capa

const CAPA_OPEN = {
  repo: REPO,
  nonconformance: value({ help: "The nonconformance the CAPA corrects.", valueName: "NC", required: true }),
  action: value({ help: "The corrective action, stated.", valueName: "TEXT", required: true }),
  testRequirement: value({ help: "The requirement the verifying test proves, NNNN-slug FR-nnn.", valueName: "REQ", required: true }),
  testName: value({
    help: "The name of the test that verifies it, as `proves` names it; it must exist.",
    valueName: "NAME",
    required: true,
  }),
  corrective: value({ help: "The last commit of the corrective change.", valueName: "REV", required: true }),
  author: value({
    help: "The author of the corrective change, an e-mail address (Git's own for the commit where not given).",
    valueName: "EMAIL",
  }),
  agent: value({ help: "Open it as this agent (else as the role `maintainer`).", valueName: "NAME" }),
  today: TODAY,
  sign: SIGN,
};

const CAPA_VERIFY = {
  repo: REPO,
  run: value({ help: "The trace id of a run kept on the branch.", valueName: "TRACE", required: true }),
  sign: SIGN,
};

const APPROVER: Parser<"person" | "agent" | "automated"> = (t) =>
  t === "person" || t === "agent" || t === "automated" ? ok(t) : err("person, agent or automated");

const CAPA_CLOSE = {
  repo: REPO,
  capa: value({ help: "The CAPA to close.", valueName: "CAPA", required: true }),
  person: value({ help: "The named person who approves the closure.", valueName: "NAME", required: true }),
  role: value({ help: "Their role.", valueName: "ROLE" }),
  decision: value({ help: "The identifier of the Decision that records the approval.", valueName: "ID", required: true }),
  regulated: flag({ help: "The harness claims a regulated domain: the approver is not the author of the corrective change." }),
  as: value({
    help: "What approves: person (the default), agent or automated. Only a person closes a CAPA.",
    valueName: "KIND",
    parse: APPROVER,
    default: "person",
  }),
  today: TODAY,
  sign: SIGN,
};

/** `quality capa open|verify|close` (FR-028 to FR-030). */
export async function capaCommand(rest: readonly string[]): Promise<number> {
  const [sub, ...args] = rest;
  switch (sub) {
    case "open": {
      const p = parseArgs(args, CAPA_OPEN);
      if (p.kind === "err") return fail(formatUsageError(p.error, "quality capa open"), 2);
      if (p.value.kind === "help") return help(helpText("quality capa open", "Open a CAPA that names its verifying test.", CAPA_OPEN));
      const o = p.value.options;
      const read = await readLedger(o.repo);
      if (read.kind === "err") return fail(formatLedgerHostError(read.error), 1);
      const g = await gather({ repo: o.repo, changes: false });
      if (g.kind === "err") return fail(formatGatherError(g.error), 1);
      const full = await gitText(o.repo, ["rev-parse", "--verify", "--quiet", `${o.corrective}^{commit}`]);
      if (full.kind === "err") return fail(`${o.corrective} is not a commit of this repository`, 1);
      const author =
        o.author ??
        (await (async () => {
          const a = await authorOf(o.repo, full.value);
          return a.kind === "ok" ? a.value : undefined;
        })());
      const e = openCapa(
        read.value.ledger,
        {
          nonconformance: o.nonconformance,
          action: o.action,
          test: { requirement: o.testRequirement, name: o.testName },
          correctiveRevision: full.value,
          ...(author === undefined ? {} : { author }),
          openedBy: o.agent === undefined ? { kind: "role", role: "maintainer" } : { kind: "agent", name: o.agent },
        },
        g.value.tests,
        o.today ?? clockDay(),
      );
      if (e.kind === "err") return fail(e.error, 1);
      const w = await appendEvents(o.repo, [e.value], o.sign === undefined ? {} : { sign: o.sign });
      if (w.kind === "err") return fail(formatLedgerHostError(w.error), 1);
      say(
        `quality: ${e.value.kind === "capa-opened" ? e.value.id : "CAPA"} opened for ${o.nonconformance}; it is verified when ${JSON.stringify(o.testName)} passes in a run at or after ${full.value.slice(0, 12)}`,
      );
      return 0;
    }
    case "verify": {
      const p = parseArgs(args, CAPA_VERIFY);
      if (p.kind === "err") return fail(formatUsageError(p.error, "quality capa verify"), 2);
      if (p.value.kind === "help")
        return help(helpText("quality capa verify", "Verify the CAPA a kept run's passing tests close.", CAPA_VERIFY));
      const o = p.value.options;
      const g = await gather({ repo: o.repo, changes: false });
      if (g.kind === "err") return fail(formatGatherError(g.error), 1);
      const run = g.value.runs.find((r) => r.traceId === o.run);
      if (run === undefined) return fail(`no run ${o.run} is kept on the quality branch`, 1);
      const made = await verifications(o.repo, g.value.ledger.ledger, {
        traceId: run.traceId,
        revision: run.revision,
        day: run.day,
        cases: run.cases,
      });
      if (made.length === 0) {
        say("quality: no CAPA is verified by this run");
        return 0;
      }
      const w = await appendEvents(o.repo, made, o.sign === undefined ? {} : { sign: o.sign });
      if (w.kind === "err") return fail(formatLedgerHostError(w.error), 1);
      for (const e of made) if (e.kind === "capa-verified") say(`quality: ${e.id} is verified by run ${e.traceId}; a person closes it`);
      return 0;
    }
    case "close": {
      const p = parseArgs(args, CAPA_CLOSE);
      if (p.kind === "err") return fail(formatUsageError(p.error, "quality capa close"), 2);
      if (p.value.kind === "help")
        return help(helpText("quality capa close", "Close a verified CAPA by a named person's Decision.", CAPA_CLOSE));
      const o = p.value.options;
      const read = await readLedger(o.repo);
      if (read.kind === "err") return fail(formatLedgerHostError(read.error), 1);
      const capa = read.value.ledger.capas.find((c) => c.id === o.capa);
      const author = capa === undefined ? undefined : await authorOf(o.repo, capa.correctiveRevision);
      const approver: Approver =
        o.as === "person"
          ? { kind: "person", name: o.person, ...(o.role === undefined ? {} : { role: o.role }) }
          : o.as === "agent"
            ? { kind: "agent", name: o.person }
            : { kind: "automated" };
      const events = closeCapa(
        read.value.ledger,
        {
          capa: o.capa,
          approver,
          decision: o.decision,
          regulated: o.regulated,
          ...(author?.kind === "ok" ? { author: author.value } : {}),
        },
        o.today ?? clockDay(),
      );
      if (events.kind === "err") return fail(events.error, 1);
      const w = await appendEvents(o.repo, events.value, o.sign === undefined ? {} : { sign: o.sign });
      if (w.kind === "err") return fail(formatLedgerHostError(w.error), 1);
      say(`quality: ${o.capa} is closed by ${o.person} (Decision ${o.decision}) and its nonconformance with it`);
      return 0;
    }
    case undefined:
    default:
      return fail("usage: quality capa open|verify|close [OPTIONS] (--help for each)", 2);
  }
}

/** The events that verify CAPA from a run: the named test passed, at a revision that holds the corrective change's last commit (FR-029). */
export async function verifications(
  repo: string,
  ledger: Parameters<typeof verifyFromRun>[0],
  run: {
    readonly traceId: string;
    readonly revision: string | undefined;
    readonly day: string;
    readonly cases: Parameters<typeof verifyFromRun>[1]["cases"];
  },
): Promise<readonly LedgerEvent[]> {
  if (run.revision === undefined) return [];
  const afters = new Map<string, boolean>();
  for (const c of ledger.capas)
    if (c.state === "CapaOpen") afters.set(c.correctiveRevision, await isAfter(repo, c.correctiveRevision, run.revision));
  return verifyFromRun(
    ledger,
    { traceId: run.traceId, revision: run.revision, day: run.day, cases: run.cases },
    (corrective) => afters.get(corrective) === true,
  );
}

/** The cases of a kept record as the verification of a CAPA reads them. */
export function runFactsOf(q: QualityRecord, revision: string | undefined, day: string): Parameters<typeof verifications>[2] {
  return {
    traceId: q.traceId,
    revision,
    day,
    cases: q.cases.map((c) => ({ name: c.name, requirements: c.requirements, outcome: c.outcome })),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------- register

const REGISTER_CMD = {
  repo: REPO,
  register: REGISTER,
  today: TODAY,
  out: value({ help: "The file to write the view to; without it the view is printed.", valueName: "FILE" }),
  check: flag({ help: "Fail where the file given by --out is not what is generated." }),
};

/** `quality register`: the proof register with the grade and day of each row's evidence, generated (FR-022). */
export async function registerCommand(rest: readonly string[]): Promise<number> {
  const p = parseArgs(rest, REGISTER_CMD);
  if (p.kind === "err") return fail(formatUsageError(p.error, "quality register"), 2);
  if (p.value.kind === "help") return help(helpText("quality register", "Show the proof register with its evidence.", REGISTER_CMD));
  const o = p.value.options;
  if (o.check && o.out === undefined) return fail("--check compares the file given by --out: give --out FILE", 2);
  const g = await gather({
    repo: o.repo,
    ...(o.today === undefined ? {} : { today: o.today }),
    changes: false,
    ...(o.register === undefined ? {} : { register: o.register }),
  });
  if (g.kind === "err") return fail(formatGatherError(g.error), 1);
  const text = registerView(g.value.register, g.value.byRequirement);
  if (o.out === undefined) {
    stdout.writeSync(text);
    return 0;
  }
  if (o.check) {
    const onDisk = (await exists(o.out)) ? (await readTextFile(o.out)).replaceAll("\r\n", "\n") : undefined;
    if (onDisk !== text) return fail(`${o.out} is not what is generated; run quality register --out ${o.out}`, 1);
    say(`quality: ${o.out} is what is generated`);
    return 0;
  }
  await writeTextFile(o.out, text);
  say(`quality: register ${o.out}`);
  return 0;
}

// ---------------------------------------------------------------------------------------------------------------------------- archive

const ARCHIVE = {
  repo: REPO,
  declaration: DECLARATION,
  today: TODAY,
  tag: value({ help: "The name of the Git tag that archives the branch.", valueName: "NAME", required: true }),
};

/**
 * `quality archive --tag NAME`: where the retention period the harness's record states (`retentionDays`) has passed for the oldest evidence,
 * a Git tag on the tip of the `quality` branch archives it; nothing is ever deleted, and there is no option that deletes (FR-047).
 */
export async function archiveCommand(rest: readonly string[]): Promise<number> {
  const p = parseArgs(rest, ARCHIVE);
  if (p.kind === "err") return fail(formatUsageError(p.error, "quality archive"), 2);
  if (p.value.kind === "help")
    return help(
      helpText(
        "quality archive",
        "Archive the quality branch by a tag once the retention period of its oldest evidence has passed; nothing is deleted.",
        ARCHIVE,
      ),
    );
  const o = p.value.options;
  const named = tagNameProblem(o.tag);
  if (named !== undefined) return fail(named, 2);
  const declared = await readDeclaration(o.repo, o.declaration);
  if (declared.kind === "err") return fail(declared.error, 3);
  const today = o.today ?? clockDay();
  const retentionDays = declared.value?.retentionDays;
  const r = await archiveBranch({ repo: o.repo, tag: o.tag, retentionDays, today });
  if (r.kind === "err") return fail(formatArchiveError(r.error), 1);
  if (r.value.kind === "tagged") {
    say(`quality: ${showRetention(r.value.judgement)}`);
    say(`quality: tagged ${r.value.tag} at ${r.value.tip}; nothing was deleted`);
    return 0;
  }
  say(`quality: not archived: ${showRetention(r.value.judgement)}`);
  return r.value.judgement.kind === "no-period" ? 1 : 0;
}

// ---------------------------------------------------------------------------------------------------------------------------- tier

const TIER = {
  declaration: DECLARATION,
  today: TODAY,
  claim: value({ help: "The tier the harness claims: Tier0, Tier1 or Tier2.", valueName: "TIER", required: true }),
  register: REGISTER,
  repo: REPO,
};

/** `quality tier`: the claim judged against the requirements of the tier and those below it (FR-036). */
export async function tierCommand(rest: readonly string[]): Promise<number> {
  const p = parseArgs(rest, TIER);
  if (p.kind === "err") return fail(formatUsageError(p.error, "quality tier"), 2);
  if (p.value.kind === "help") return help(helpText("quality tier", "Judge the tier a harness claims.", TIER));
  const o = p.value.options;
  if (!isTier(o.claim)) return fail(`${o.claim} is not a tier (Tier0, Tier1, Tier2)`, 2);
  const file = o.register ?? `${o.repo}/commons/spec-kit/enforcement.tsv`;
  const text = await readTextFile(file).then(
    (t) => ok(t),
    () => err(`${file} cannot be read`),
  );
  if (text.kind === "err") return fail(text.error, 1);
  const declared = await readDeclaration(o.repo, o.declaration);
  if (declared.kind === "err") return fail(declared.error, 3);
  const today = o.today ?? clockDay();
  // a regulated harness in production is judged on the grade of its proofs too (0021-ifqs FR-011)
  let proof: TierProof | undefined;
  if (declared.value !== undefined && regulatedInProduction(declared.value, today)) {
    const g = await gather({
      repo: o.repo,
      today,
      ...(o.register === undefined ? {} : { register: o.register }),
      declaration: declared.value,
    });
    if (g.kind === "err") return fail(formatGatherError(g.error), 1);
    proof = { judgements: g.value.judgements, declaration: declared.value, today };
  }
  const j = judgeTier(o.claim, parseRegister(text.value), proof);
  if (j.claimed) {
    say(`quality: ${o.claim} is met: every requirement of it and of the tiers below is held by a mechanism`);
    return 0;
  }
  for (const r of j.unmet) say(`${r}: held by none`);
  for (const u of j.underGrade)
    say(`${u.requirement}: proved at ${showGrade(u.grade)}, a regulated harness in production needs ${showGrade(u.needed)}`);
  const parts = [
    ...(j.unmet.length === 0 ? [] : [`${j.unmet.length} held by none`]),
    ...(j.underGrade.length === 0 ? [] : [`${j.underGrade.length} proved below the grade needed`]),
  ];
  return fail(`${o.claim} is refused: ${parts.join(", ")}`, 1);
}

// ---------------------------------------------------------------------------------------------------------------------------- attest

const KIND: Parser<"statement" | "review" | "probe"> = (t) =>
  t === "statement" || t === "review" || t === "probe" ? ok(t) : err("statement, review or probe");
const BY: Parser<"person" | "agent"> = (t) => (t === "person" || t === "agent" ? ok(t) : err("person or agent"));
const OUTCOME: Parser<"pass" | "fail"> = (t) => (t === "pass" || t === "fail" ? ok(t) : err("pass or fail"));

const ATTEST = {
  repo: REPO,
  kind: value({ help: "statement (E1), review (E2) or probe (E5).", valueName: "KIND", parse: KIND, required: true as const }),
  requirement: value({ help: "The requirement, NNNN-slug FR-nnn.", valueName: "REQ", required: true }),
  by: value({
    help: "Whether a person or an agent made it (a review by an agent is said so and graded E2 at most).",
    valueName: "WHO",
    parse: BY,
    default: "person",
  }),
  who: value({ help: "Who made it (a statement or a review).", valueName: "NAME" }),
  outcome: value({ help: "A probe's result.", valueName: "RESULT", parse: OUTCOME, default: "pass" }),
  source: value({ help: "The probe that reports it.", valueName: "NAME" }),
  sample: flag({ help: "A review that is a person's sample of agents' reviews (FR-038)." }),
  today: TODAY,
  sign: SIGN,
};

/** `quality attest`: a statement (`E1`), a review (`E2`) or a probe's typed result (`E5`) kept as evidence on the branch (FR-021, FR-024). */
export async function attestCommand(rest: readonly string[]): Promise<number> {
  const p = parseArgs(rest, ATTEST);
  if (p.kind === "err") return fail(formatUsageError(p.error, "quality attest"), 2);
  if (p.value.kind === "help")
    return help(helpText("quality attest", "Keep a statement, a review or a probe's result as evidence.", ATTEST));
  const o = p.value.options;
  const day = o.today ?? clockDay();
  const made =
    o.kind === "probe"
      ? attest({ kind: "probe", requirement: o.requirement, outcome: o.outcome, source: o.source ?? "probe" }, day)
      : attest(
          o.kind === "review"
            ? { kind: "review", requirement: o.requirement, by: o.by, who: o.who ?? "", sample: o.sample }
            : { kind: "statement", requirement: o.requirement, by: o.by, who: o.who ?? "" },
          day,
        );
  if (made.kind === "err") return fail(made.error, 1);
  const w = await appendEvents(o.repo, [made.value], o.sign === undefined ? {} : { sign: o.sign });
  if (w.kind === "err") return fail(formatLedgerHostError(w.error), 1);
  say(
    `quality: ${o.kind} of ${o.requirement} kept (${o.kind === "statement" ? "E1" : o.kind === "review" ? "E2" : "E5"}${o.by === "agent" ? ", an agent's" : ""})`,
  );
  return 0;
}
