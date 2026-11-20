/**
 * The commands of Tier 2 of the quality system (commons 0021-ifqs FR-038 to FR-041, 0022-trust), run by `quality.ts`:
 *
 * - `trust` writes the Trust page and its JSON for one audience, or `--check`s them against the files on disk.
 * - `pack` writes the assessor pack as a folder, a tar with its SHA-256 and a DCAT distribution; `verify-pack` verifies one offline.
 * - `plan register|check` registers a test plan before its run and judges every run against the plan it names.
 * - `sample draw|attest|verify` draws a sample by a rule and a seed, records a person's attestation and draws every sample again.
 * - `mutation ingest|strength` records a mutation tool's report and shows the strength of each proof beside its grade.
 * - `agents` shows the sampling of the agents' reviews against the rate the harness states.
 *
 * @remarks
 * Exit status: 0 where it did what was asked and found nothing wrong, 1 where it found something (a pack that is not verified, a page that
 * differs, a run that did not follow its plan) or refused, 2 for a command line that does not fit, 3 where part of a pack could not be checked.
 * The day today is read once here from the clock; every judgement takes it as an argument.
 *
 * @module
 */
import { flag, formatUsageError, helpText, many, parseArgs, type Parser, value } from "../kernel/args.ts";
import { err, ok } from "@intellectual-frontiers/core";
import { mkdir, readTextFile, writeTextFile } from "../runtime/fs.ts";
import { dirname } from "../runtime/path.ts";
import { stderr, stdout } from "../runtime/stdio.ts";
import { collect, formatCollectError, loadSigningKey, packOf, readPackFolder, readPackTar, writePack } from "./assessor/host.ts";
import { showReport, verifyPack } from "./assessor/verify-pack.ts";
import { formatAgentFinding } from "./attestation/agents.ts";
import {
  agentsOf,
  attestAndKeep,
  drawAndKeep,
  formatTier2Error,
  ingestMutation,
  readTier2,
  registerPlan,
  verifySamples,
} from "./attestation/host.ts";
import { gradeAfterMutation, mutationFloor, showStrength, strengths } from "./attestation/mutation.ts";
import { readDeclaration } from "./host/declaration.ts";
import { formatPlanFinding } from "./attestation/plan.ts";
import { SAMPLE_SUBJECTS, type SampleSubject } from "./pure/tier2-events.ts";
import { isDay } from "./pure/time.ts";
import { type Audience, isAudience } from "./trust/audience.ts";
import { checkTrust, generateTrust } from "./trust/host.ts";
import { NO_REQUIREMENT_TEXT, readRequirementTexts } from "./trust/requirement-text.ts";

const say = (text: string): void => void stdout.writeSync(`${text}\n`);
const complain = (text: string): void => void stderr.writeSync(`quality: ${text}\n`);
const fail = (message: string, code: number): number => {
  complain(message);
  return code;
};
const help = (text: string): number => {
  say(text);
  return 0;
};
const clockDay = (): string => new Date().toISOString().slice(0, 10);

const dayParser: Parser<string> = (t) => (isDay(t) ? ok(t) : err("a day is YYYY-MM-DD"));
const permille: Parser<number> = (t) => {
  const n = Number(t);
  return Number.isInteger(n) && n >= 1 && n <= 1000 ? ok(n) : err("a rate is a whole number from 1 to 1000, in a thousand");
};
const count: Parser<number> = (t) => {
  const n = Number(t);
  return Number.isInteger(n) && n >= 1 ? ok(n) : err("a size is a whole number, 1 or more");
};
const audience: Parser<Audience> = (t) => {
  const word = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  return isAudience(word) ? ok(word) : err("the audience is public, assessor or internal");
};
const subject: Parser<SampleSubject> = (t) => {
  const found = SAMPLE_SUBJECTS.find((s) => s === t);
  return found === undefined ? err(`the subject is one of ${SAMPLE_SUBJECTS.join(", ")}`) : ok(found);
};
const result: Parser<{ readonly item: string; readonly verdict: "pass" | "fail" }> = (t) => {
  const eq = t.lastIndexOf("=");
  const verdict = t.slice(eq + 1);
  if (eq < 1 || (verdict !== "pass" && verdict !== "fail")) return err("a result is ITEM=pass or ITEM=fail");
  return ok({ item: t.slice(0, eq), verdict });
};

const REPO = value({ help: "The repository the `quality` branch is in.", valueName: "DIR", default: "." });
const REGISTER = value({ help: "The proof register (enforcement.tsv); the repository's own where not given.", valueName: "FILE" });
const DECLARATION = value({
  help: "The harness's record (ifccm.declaration.ts of the repository where not given): a regulated harness in production needs E4 for every requirement and a mutation floor of 800.",
  valueName: "FILE",
});
const TODAY = value({
  help: "The day (YYYY-MM-DD); where not given, the day of the newest evidence for a page or a pack, the clock for a record.",
  valueName: "DAY",
  parse: dayParser,
});
const SIGN = flag({ help: "Sign the commits that keep it (--no-sign: do not; neither: as commit.gpgsign says).", negatable: true });
const BY = value({ help: "The named person. The person is data in the record, never inferred.", valueName: "NAME", required: true });
const ROLE = value({ help: "The person's role.", valueName: "ROLE" });

// ---------------------------------------------------------------------------------------------------------------------------- trust

const TRUST = {
  repo: REPO,
  declaration: DECLARATION,
  register: REGISTER,
  today: TODAY,
  harness: value({ help: "The harness's name, as the page shows it.", valueName: "NAME", required: true }),
  audience: value({
    help: "Who the rendering is for: public (the default), assessor or internal.",
    valueName: "AUDIENCE",
    parse: audience,
  }),
  scope: value({ help: "A sentence of scope, which never states conformity, certification or compliance.", valueName: "TEXT" }),
  notCovered: many({ help: "What the page does not cover (repeat).", valueName: "TEXT" }),
  term: many({
    help: "A name that must never reach the public: a customer, a person, a host, a private repository (repeat).",
    valueName: "NAME",
  }),
  agentRate: value({ help: "The rate at which a person samples the agents' reviews, in a thousand.", valueName: "N", parse: permille }),
  html: value({ help: "The file to write the page to; without it the page is printed.", valueName: "FILE" }),
  json: value({ help: "The file to write the page's JSON to.", valueName: "FILE" }),
  check: flag({ help: "Fail where --html or --json is not what the evidence makes." }),
};

/** `quality trust`: the Trust page for an audience (0022-trust FR-001). */
export async function trustCommand(rest: readonly string[]): Promise<number> {
  const p = parseArgs(rest, TRUST);
  if (p.kind === "err") return fail(formatUsageError(p.error, "quality trust"), 2);
  if (p.value.kind === "help") return help(helpText("quality trust", "Generate the Trust page from the evidence.", TRUST));
  const o = p.value.options;
  if (o.check && o.html === undefined && o.json === undefined) return fail("--check compares the files given by --html and --json", 2);
  const declared = await readDeclaration(o.repo, o.declaration);
  if (declared.kind === "err") return fail(declared.error, 3);
  const c = await collect({
    repo: o.repo,
    ...(o.register === undefined ? {} : { register: o.register }),
    ...(o.today === undefined ? {} : { today: o.today }),
    ...(declared.value === undefined ? {} : { declaration: declared.value }),
  });
  if (c.kind === "err") return fail(formatCollectError(c.error), 1);
  // the text of a requirement is read from the specifications at the tested revision, and a repository without them shows none (0022-trust FR-018)
  const texts = await readRequirementTexts(o.repo, c.value.revision);
  const page = generateTrust(c.value, {
    requirementText: texts.kind === "ok" ? texts.value : NO_REQUIREMENT_TEXT,
    harness: o.harness,
    audience: o.audience ?? "Public",
    rules: { terms: o.term },
    ...(o.scope === undefined ? {} : { scopeNote: o.scope }),
    notCovered: o.notCovered,
    ...(o.agentRate === undefined ? {} : { agentRatePermille: o.agentRate }),
  });
  if (page.kind === "err") return fail(page.error, 1);
  if (o.check) {
    const checked = await checkTrust(page.value, {
      ...(o.html === undefined ? {} : { html: o.html }),
      ...(o.json === undefined ? {} : { json: o.json }),
    });
    if (checked.kind === "err") return fail(`${checked.error}; run quality trust again without --check`, 1);
    say("quality: the page is what the evidence makes");
    return 0;
  }
  if (o.html === undefined && o.json === undefined) {
    stdout.writeSync(page.value.html);
    return 0;
  }
  for (const [path, body] of [
    [o.html, page.value.html],
    [o.json, page.value.json],
  ] as const) {
    if (path === undefined) continue;
    await mkdir(dirname(path), { recursive: true });
    await writeTextFile(path, body);
    say(`quality: ${path} (${page.value.view.redactions} values redacted)`);
  }
  return 0;
}

// ---------------------------------------------------------------------------------------------------------------------------- pack

const PACK = {
  repo: REPO,
  declaration: DECLARATION,
  register: REGISTER,
  today: TODAY,
  harness: value({ help: "The harness's name.", valueName: "NAME", required: true }),
  out: value({
    help: "The new folder to write the pack to; a tar, its SHA-256 and a DCAT distribution are written beside it.",
    valueName: "DIR",
    required: true,
  }),
  from: value({ help: "The first day of evidence the pack holds.", valueName: "DAY", parse: dayParser }),
  to: value({ help: "The last day of evidence the pack holds.", valueName: "DAY", parse: dayParser }),
  signKey: value({
    help: "An Ed25519 private key as a JWK file, to sign the pack with; without it the pack is unsigned and verifies as not_run.",
    valueName: "FILE",
  }),
  signer: value({ help: "The principal the key is published as in the allowed-signers file.", valueName: "NAME", default: "quality" }),
};

/** `quality pack`: the assessor pack (0022-trust FR-010, FR-013). */
export async function packCommand(rest: readonly string[]): Promise<number> {
  const p = parseArgs(rest, PACK);
  if (p.kind === "err") return fail(formatUsageError(p.error, "quality pack"), 2);
  if (p.value.kind === "help") return help(helpText("quality pack", "Write the assessor pack.", PACK));
  const o = p.value.options;
  let signing: Awaited<ReturnType<typeof loadSigningKey>> | undefined;
  if (o.signKey !== undefined) {
    signing = await loadSigningKey(await readTextFile(o.signKey), o.signer);
    if (signing.kind === "err") return fail(signing.error, 1);
  }
  const declared = await readDeclaration(o.repo, o.declaration);
  if (declared.kind === "err") return fail(declared.error, 3);
  const c = await collect({
    repo: o.repo,
    ...(o.register === undefined ? {} : { register: o.register }),
    ...(o.today === undefined ? {} : { today: o.today }),
    ...(declared.value === undefined ? {} : { declaration: declared.value }),
  });
  if (c.kind === "err") return fail(formatCollectError(c.error), 1);
  const pack = await packOf(c.value, {
    harness: o.harness,
    ...(o.from === undefined && o.to === undefined
      ? {}
      : { span: { ...(o.from === undefined ? {} : { from: o.from }), ...(o.to === undefined ? {} : { to: o.to }) } }),
    ...(signing?.kind === "ok" ? { signing: signing.value } : {}),
  });
  if (pack.kind === "err") return fail(pack.error, 1);
  const written = await writePack(o.out, pack.value, { title: `Assessor pack of ${o.harness}`, revision: c.value.revision });
  if (written.kind === "err") return fail(written.error, 1);
  say(
    `quality: pack ${o.out} (${pack.value.files.size} files, ${pack.value.redactions} values redacted${signing === undefined ? ", not signed" : ", signed"})`,
  );
  say(`quality: ${written.value.tar} sha256 ${written.value.sha256}`);
  say(`quality: ${written.value.dcat}`);
  return 0;
}

const VERIFY_PACK = {};

/** `quality verify-pack PACK`: verifies a pack's folder or tar with no network (0022-trust FR-014, FR-015). */
export async function verifyPackCommand(rest: readonly string[]): Promise<number> {
  const p = parseArgs(rest, VERIFY_PACK, [{ name: "PACK", help: "The pack's folder, or its tar.", arity: "one" }]);
  if (p.kind === "err") return fail(formatUsageError(p.error, "quality verify-pack"), 2);
  if (p.value.kind === "help")
    return help(
      helpText("quality verify-pack", "Verify an assessor pack offline.", VERIFY_PACK, [
        { name: "PACK", help: "The pack's folder, or its tar.", arity: "one" },
      ]),
    );
  const path = p.value.positionals[0] ?? "";
  const files = path.endsWith(".tar") ? await readPackTar(path) : ok(await readPackFolder(path));
  if (files.kind === "err") return fail(files.error, 1);
  const report = await verifyPack(files.value);
  stdout.writeSync(showReport(report));
  return report.verified ? 0 : report.checks.some((c) => c.status === "fail") ? 1 : 3;
}

// ---------------------------------------------------------------------------------------------------------------------------- plans

const PLAN_REGISTER = {
  repo: REPO,
  plan: value({ help: "The plan file: a title and its cases, each with its acceptance criterion.", valueName: "FILE", required: true }),
  by: BY,
  role: ROLE,
  today: TODAY,
  sign: SIGN,
};
const PLAN_CHECK = { repo: REPO, requireSigned: flag({ help: "A plan must be in a signed commit." }) };

/** `quality plan register|check` (0021-ifqs FR-039). */
export async function planCommand(rest: readonly string[]): Promise<number> {
  const [sub, ...args] = rest;
  switch (sub) {
    case "register": {
      const p = parseArgs(args, PLAN_REGISTER);
      if (p.kind === "err") return fail(formatUsageError(p.error, "quality plan register"), 2);
      if (p.value.kind === "help")
        return help(helpText("quality plan register", "Register a test plan before the run it governs.", PLAN_REGISTER));
      const o = p.value.options;
      const r = await registerPlan(
        o.repo,
        await readTextFile(o.plan),
        { name: o.by, ...(o.role === undefined ? {} : { role: o.role }) },
        o.today ?? clockDay(),
        o.sign === undefined ? {} : { sign: o.sign },
      );
      if (r.kind === "err") return fail(formatTier2Error(r.error), 1);
      say(`quality: ${r.value.id} registered; a run names it with the resource attribute ifc.quality.plan.sha256`);
      return 0;
    }
    case "check": {
      const p = parseArgs(args, PLAN_CHECK);
      if (p.kind === "err") return fail(formatUsageError(p.error, "quality plan check"), 2);
      if (p.value.kind === "help") return help(helpText("quality plan check", "Judge every run against the plan it names.", PLAN_CHECK));
      const o = p.value.options;
      const s = await readTier2(o.repo, { requireSigned: o.requireSigned });
      if (s.kind === "err") return fail(formatTier2Error(s.error), 1);
      for (const f of s.value.findings) say(`quality: ${formatPlanFinding(f)}`);
      say(
        `quality: ${s.value.plans.length} plan${s.value.plans.length === 1 ? "" : "s"}, ${s.value.runs.length} run${s.value.runs.length === 1 ? "" : "s"}, ${s.value.findings.length} finding${s.value.findings.length === 1 ? "" : "s"}`,
      );
      return s.value.findings.length === 0 ? 0 : 1;
    }
    case undefined:
    default:
      return fail("usage: quality plan register|check [OPTIONS]", 2);
  }
}

// ---------------------------------------------------------------------------------------------------------------------------- samples

const SAMPLE_DRAW = {
  repo: REPO,
  subject: value({ help: `What to sample: ${SAMPLE_SUBJECTS.join(", ")}.`, valueName: "SUBJECT", parse: subject, required: true }),
  by: BY,
  role: ROLE,
  seed: value({ help: "The seed that chooses the sample (random bytes where not given); it is recorded either way.", valueName: "TEXT" }),
  size: value({ help: "How many items.", valueName: "N", parse: count }),
  rate: value({ help: "Or the share to sample, in a thousand, of what the population holds.", valueName: "N", parse: permille }),
  today: TODAY,
  sign: SIGN,
};
const SAMPLE_ATTEST = {
  repo: REPO,
  sample: value({ help: "The sample.", valueName: "ID", required: true }),
  by: BY,
  role: ROLE,
  result: many({
    help: "The result of one item: ITEM=pass or ITEM=fail (repeat, one for each item).",
    valueName: "ITEM=RESULT",
    parse: result,
  }),
  today: TODAY,
  sign: SIGN,
};
const SAMPLE_VERIFY = { repo: REPO };

/** `quality sample draw|attest|verify` (0021-ifqs FR-038). */
export async function sampleCommand(rest: readonly string[]): Promise<number> {
  const [sub, ...args] = rest;
  switch (sub) {
    case "draw": {
      const p = parseArgs(args, SAMPLE_DRAW);
      if (p.kind === "err") return fail(formatUsageError(p.error, "quality sample draw"), 2);
      if (p.value.kind === "help")
        return help(helpText("quality sample draw", "Draw a sample by a rule and a seed, and record it.", SAMPLE_DRAW));
      const o = p.value.options;
      const drawn = await drawAndKeep(
        o.repo,
        {
          subject: o.subject,
          by: { name: o.by, ...(o.role === undefined ? {} : { role: o.role }) },
          day: o.today ?? clockDay(),
          ...(o.seed === undefined ? {} : { seed: o.seed }),
          ...(o.size === undefined ? {} : { size: o.size }),
          ...(o.rate === undefined ? {} : { ratePermille: o.rate }),
        },
        o.sign === undefined ? {} : { sign: o.sign },
      );
      if (drawn.kind === "err") return fail(formatTier2Error(drawn.error), 1);
      say(`quality: ${drawn.value.id} drawn with the seed ${drawn.value.seed}: ${drawn.value.items.join(", ")}`);
      return 0;
    }
    case "attest": {
      const p = parseArgs(args, SAMPLE_ATTEST);
      if (p.kind === "err") return fail(formatUsageError(p.error, "quality sample attest"), 2);
      if (p.value.kind === "help")
        return help(helpText("quality sample attest", "Record a person's result on each item of a sample.", SAMPLE_ATTEST));
      const o = p.value.options;
      const r = await attestAndKeep(
        o.repo,
        {
          sample: o.sample,
          results: o.result,
          person: { name: o.by, ...(o.role === undefined ? {} : { role: o.role }) },
          day: o.today ?? clockDay(),
        },
        o.sign === undefined ? {} : { sign: o.sign },
      );
      if (r.kind === "err") return fail(formatTier2Error(r.error), 1);
      say(
        `quality: ${o.sample} attested by ${o.by}: ${o.result.filter((x) => x.verdict === "pass").length} pass, ${o.result.filter((x) => x.verdict === "fail").length} fail`,
      );
      return 0;
    }
    case "verify": {
      const p = parseArgs(args, SAMPLE_VERIFY);
      if (p.kind === "err") return fail(formatUsageError(p.error, "quality sample verify"), 2);
      if (p.value.kind === "help")
        return help(helpText("quality sample verify", "Draw every recorded sample again from its seed.", SAMPLE_VERIFY));
      const r = await verifySamples(p.value.options.repo);
      if (r.kind === "err") return fail(formatTier2Error(r.error), 1);
      say(
        `quality: ${r.value.length} sample${r.value.length === 1 ? "" : "s"} drawn again from the seed and the population, each as recorded`,
      );
      return 0;
    }
    case undefined:
    default:
      return fail("usage: quality sample draw|attest|verify [OPTIONS]", 2);
  }
}

// ---------------------------------------------------------------------------------------------------------------------------- mutation and agents

const MUTATION_INGEST = {
  repo: REPO,
  report: value({ help: "The report of the mutation tool the harness names (ifqs-mutation-report/1).", valueName: "FILE", required: true }),
  today: TODAY,
  sign: SIGN,
};
const MUTATION_STRENGTH = {
  repo: REPO,
  declaration: DECLARATION,
  today: TODAY,
  floor: value({
    help: "The strength, in a thousand, below which a proof's grade is lowered (600 where not given; never below 800 for a regulated harness in production).",
    valueName: "N",
    parse: permille,
  }),
};

/** `quality mutation ingest|strength` (0021-ifqs FR-040). */
export async function mutationCommand(rest: readonly string[]): Promise<number> {
  const [sub, ...args] = rest;
  switch (sub) {
    case "ingest": {
      const p = parseArgs(args, MUTATION_INGEST);
      if (p.kind === "err") return fail(formatUsageError(p.error, "quality mutation ingest"), 2);
      if (p.value.kind === "help")
        return help(helpText("quality mutation ingest", "Record the report of a mutation run.", MUTATION_INGEST));
      const o = p.value.options;
      const r = await ingestMutation(
        o.repo,
        await readTextFile(o.report),
        o.today ?? clockDay(),
        o.sign === undefined ? {} : { sign: o.sign },
      );
      if (r.kind === "err") return fail(formatTier2Error(r.error), 1);
      say(`quality: ${r.value.id} recorded`);
      return 0;
    }
    case "strength": {
      const p = parseArgs(args, MUTATION_STRENGTH);
      if (p.kind === "err") return fail(formatUsageError(p.error, "quality mutation strength"), 2);
      if (p.value.kind === "help")
        return help(helpText("quality mutation strength", "Show the strength of each proof beside its grade.", MUTATION_STRENGTH));
      const o = p.value.options;
      const declared = await readDeclaration(o.repo, o.declaration);
      if (declared.kind === "err") return fail(declared.error, 3);
      const c = await collect({
        repo: o.repo,
        ...(o.today === undefined ? {} : { today: o.today }),
        ...(declared.value === undefined ? {} : { declaration: declared.value }),
      });
      if (c.kind === "err") return fail(formatCollectError(c.error), 1);
      const s = strengths(c.value.tier2.assurance.mutations);
      for (const j of c.value.gathered.judgements) {
        const st = s.get(j.requirement);
        if (st === undefined) continue;
        const effect = gradeAfterMutation(
          j.grade,
          j.grade === "E3" || j.grade === "E4",
          st,
          mutationFloor(c.value.declaration, c.value.today, o.floor),
        );
        say(
          `${j.requirement}\t${j.grade}\t${showStrength(st.permille)}\t${effect.effect === "lowered" ? `lowered to ${effect.grade}` : effect.effect}\t${effect.why}`,
        );
      }
      return 0;
    }
    case undefined:
    default:
      return fail("usage: quality mutation ingest|strength [OPTIONS]", 2);
  }
}

const AGENTS = {
  repo: REPO,
  rate: value({
    help: "The rate at which a person samples the agents' reviews, in a thousand.",
    valueName: "N",
    parse: permille,
    required: true,
  }),
};

/** `quality agents`: the sampling of the agents' reviews against the stated rate (0021-ifqs FR-041). */
export async function agentsCommand(rest: readonly string[]): Promise<number> {
  const p = parseArgs(rest, AGENTS);
  if (p.kind === "err") return fail(formatUsageError(p.error, "quality agents"), 2);
  if (p.value.kind === "help") return help(helpText("quality agents", "Judge the sampling of the agents' reviews.", AGENTS));
  const o = p.value.options;
  const s = await agentsOf(o.repo, o.rate);
  if (s.kind === "err") return fail(formatTier2Error(s.error), 1);
  say(
    `quality: ${s.value.reviews} agent review${s.value.reviews === 1 ? "" : "s"}; ${s.value.sampled} sampled by a person (${s.value.passed} hold, ${s.value.failed} do not); ${s.value.needed} owed at ${o.rate} in a thousand`,
  );
  for (const f of s.value.findings) say(`quality: ${formatAgentFinding(f)}`);
  return s.value.findings.length === 0 ? 0 : 1;
}
