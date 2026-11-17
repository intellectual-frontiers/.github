/**
 * `quality`, the command of the quality system (commons 0021-ifqs): `record` keeps a run's record as evidence (a new file on the append-only
 * `quality` branch, signed where Git is set to sign, and a note on the tested commit), `verify` walks the branch and its chain and names the
 * first file or commit that does not match, and `render` renders a record as JUnit XML, CTRF, SARIF, TAP or the documents of ISO/IEC/IEEE
 * 29119-3, on demand. `ifc test` is unchanged: `record` takes the record that `ifc test run` writes, and verifies the CAPA whose named test it
 * passes (FR-029). The system reports itself with `index` (the index of the branch, `--check`able), `freshness` (every proof judged by time and by
 * change, the nonconformances it calls for opened with `--open`), `nonconformances`, `capa open|verify|close`, `register` (the proof register with
 * the grade and day of its evidence), `tier` (a claim judged) and `attest` (a statement, a review or a probe's result kept as evidence); see
 * `commands.ts`. Exit status: 0 where it did what was asked, 1 where a record was refused, the branch does not verify or it found something, 2 for
 * a command line that does not fit.
 *
 * ```sh
 * bun quality/quality.ts record --record test-results/<trace>.otlp.json --repo . --not-run "0021-ifqs FR-005=no network"
 * bun quality/quality.ts verify --repo . --allowed-signers .github/allowed_signers --require-signed
 * bun quality/quality.ts render --repo . --run <trace> --format junit,sarif --out reports
 * ```
 *
 * @module
 */
import { flag, formatUsageError, helpText, many, parseArgs, type Parser, value } from "../kernel/args.ts";
import { err, ok, type Result } from "../kernel/result.ts";
import { mkdir, readTextFile, writeTextFile } from "../runtime/fs.ts";
import { join } from "../runtime/path.ts";
import { args, exit } from "../runtime/proc.ts";
import { stderr, stdout } from "../runtime/stdio.ts";
import { formatKeepError, gradeOfCommit, keepRun, readKeptRun, verifyBranch, formatVerifyError } from "./host/branch.ts";
import {
  attestCommand,
  capaCommand,
  clockDay,
  freshnessCommand,
  indexCommand,
  nonconformancesCommand,
  registerCommand,
  runFactsOf,
  tierCommand,
  verifications,
} from "./commands.ts";
import { appendEvents, formatLedgerHostError, readLedger } from "./host/ledger-branch.ts";
import { formatHostError } from "./host/git.ts";
import { type Grade, isGrade } from "./pure/names.ts";
import { formatQualityError, type NotRun, readQuality } from "./pure/record.ts";
import { isRenderFormat, render, type RenderFormat, RENDER_FORMATS } from "./pure/render.ts";

const say = (text: string): void => void stdout.writeSync(`${text}\n`);
const complain = (text: string): void => void stderr.writeSync(`quality: ${text}\n`);

const notRun: Parser<NotRun> = (t) => {
  const eq = t.indexOf("=");
  if (eq < 1 || t.slice(eq + 1).trim() === "") return err("a case that did not run is REQUIREMENT=REASON, and the reason is not empty");
  const requirement = t.slice(0, eq).trim();
  return ok({ requirements: [requirement], name: requirement, reason: t.slice(eq + 1).trim() });
};

const formats: Parser<readonly RenderFormat[]> = (t) => {
  const parts = t
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p !== "");
  const bad = parts.find((p) => !isRenderFormat(p));
  if (bad !== undefined) return err(`${bad} is not a format (${RENDER_FORMATS.join(", ")})`);
  return ok(parts.filter(isRenderFormat));
};

const grade: Parser<Grade> = (t) => (isGrade(t) ? ok(t) : err("the grade is E0, E1, E2, E3, E4 or E5"));

const RECORD = {
  record: value({ help: "The record `ifc test run` wrote (one OTLP JSON file).", valueName: "FILE", required: true }),
  repo: value({ help: "The repository the `quality` branch is in.", valueName: "DIR", default: "." }),
  commit: value({ help: "The tested commit that takes the note (the record's revision, else HEAD).", valueName: "REV" }),
  sign: flag({
    help: "Sign the commit through the host's Git signing (--no-sign: do not; neither: as commit.gpgsign says).",
    negatable: true,
  }),
  notRun: many({
    help: "A requirement planned and not run: REQUIREMENT=REASON. Never counted as passed.",
    valueName: "REQ=REASON",
    parse: notRun,
  }),
};

const VERIFY = {
  repo: value({ help: "The repository the `quality` branch is in.", valueName: "DIR", default: "." }),
  allowedSigners: value({ help: "An SSH allowed-signers file of the keys this harness trusts.", valueName: "FILE" }),
  requireSigned: flag({ help: "Fail on a commit that is not signed by a trusted key." }),
};

const RENDER = {
  record: value({ help: "A record file to render.", valueName: "FILE" }),
  repo: value({ help: "With --run, the repository the record is kept in.", valueName: "DIR", default: "." }),
  run: value({ help: "The trace id of a run kept on the `quality` branch.", valueName: "TRACE" }),
  format: value({
    help: `One or more of ${RENDER_FORMATS.join(", ")}, separated by commas.`,
    valueName: "LIST",
    parse: formats,
    required: true,
  }),
  out: value({ help: "A folder to write the renderings to; without it they are printed.", valueName: "DIR" }),
  grade: value({ help: "The grade to show (E0 to E5); the record's own where not given.", valueName: "GRADE", parse: grade }),
};

const USAGE = "usage: quality record|verify|render|index|freshness|nonconformances|capa|register|tier|attest [OPTIONS] (--help for each)";

/** `quality` with its arguments: the exit status. */
export async function main(argv: readonly string[]): Promise<number> {
  const [command, ...rest] = argv;
  switch (command) {
    case "record": {
      const p = parseArgs(rest, RECORD);
      if (p.kind === "err") return fail(formatUsageError(p.error, "quality record"), 2);
      if (p.value.kind === "help") return help(helpText("quality record", "Keep a run's record as evidence.", RECORD));
      const o = p.value.options;
      const text = await readTextFile(o.record).then(
        (t): Result<string, string> => ok(t),
        (e: unknown): Result<string, string> => err(e instanceof Error ? e.message : String(e)),
      );
      if (text.kind === "err") return fail(text.error, 1);
      const kept = await keepRun({
        repo: o.repo,
        record: text.value,
        notRun: o.notRun,
        ...(o.commit === undefined ? {} : { commit: o.commit }),
        ...(o.sign === undefined ? {} : { sign: o.sign }),
      });
      if (kept.kind === "err") return fail(formatKeepError(kept.error), 1);
      const k = kept.value;
      say(`quality: kept ${k.path}`);
      say(`quality: sha256 ${k.sha256}`);
      say(`quality: grade ${k.grade}${k.signed ? " (signed)" : " (not signed)"}`);
      say(
        `quality: ${k.record.counts.tests} ran, ${k.record.counts.passed} passed, ${k.record.counts.failed} failed, ${k.record.counts.notRun} not_run`,
      );
      say(k.tested === undefined ? "quality: no tested commit, so no note" : `quality: noted ${k.tested}`);
      // the CAPA whose named test this run passed after its corrective change become verified, and in no other way (FR-029)
      const ledger = await readLedger(o.repo);
      if (ledger.kind === "err") return fail(formatLedgerHostError(ledger.error), 1);
      const verified = await verifications(
        o.repo,
        ledger.value.ledger,
        runFactsOf(k.record, k.tested ?? k.record.run.runner.revision, clockDay()),
      );
      if (verified.length > 0) {
        const w = await appendEvents(o.repo, verified, o.sign === undefined ? {} : { sign: o.sign });
        if (w.kind === "err") return fail(formatLedgerHostError(w.error), 1);
        for (const e of verified) if (e.kind === "capa-verified") say(`quality: ${e.id} is verified by this run; a person closes it`);
      }
      return 0;
    }
    case "verify": {
      const p = parseArgs(rest, VERIFY);
      if (p.kind === "err") return fail(formatUsageError(p.error, "quality verify"), 2);
      if (p.value.kind === "help") return help(helpText("quality verify", "Walk the quality branch and its chain.", VERIFY));
      const o = p.value.options;
      const v = await verifyBranch(o.repo, {
        ...(o.allowedSigners === undefined ? {} : { allowedSigners: o.allowedSigners }),
        requireSigned: o.requireSigned,
      });
      if (v.kind === "err") return fail(formatVerifyError(v.error), 1);
      say(`quality: ${v.value.count} file${v.value.count === 1 ? "" : "s"} chained from 64 zeros to ${v.value.head}`);
      for (const g of v.value.grades) say(`quality: ${g.commit} ${g.grade} ${g.path}`);
      return 0;
    }
    case "render": {
      const p = parseArgs(rest, RENDER);
      if (p.kind === "err") return fail(formatUsageError(p.error, "quality render"), 2);
      if (p.value.kind === "help") return help(helpText("quality render", "Render a record on demand.", RENDER));
      const o = p.value.options;
      if ((o.record === undefined) === (o.run === undefined)) return fail("give one of --record FILE or --run TRACE", 2);
      let body: Result<string, string>;
      if (o.record !== undefined) {
        body = await readTextFile(o.record).then(
          (t): Result<string, string> => ok(t),
          (e: unknown): Result<string, string> => err(e instanceof Error ? e.message : String(e)),
        );
      } else {
        const kept = await readKeptRun(o.repo, o.run ?? "");
        body = kept.kind === "ok" ? ok(kept.value) : err(formatHostError(kept.error));
      }
      if (body.kind === "err") return fail(body.error, 1);
      const q = readQuality(body.value);
      if (q.kind === "err") return fail(formatQualityError(q.error), 1);
      let shown: Grade = o.grade ?? q.value.grade;
      if (o.grade === undefined && o.run !== undefined && q.value.run.runner.revision !== undefined) {
        const g = await gradeOfCommit(o.repo, q.value.run.runner.revision);
        if (g.kind === "ok" && g.value !== "E0") shown = g.value;
      }
      if (o.out !== undefined) await mkdir(o.out, { recursive: true });
      for (const f of o.format) {
        const text = render(q.value, f, shown);
        if (o.out === undefined) say(text.trimEnd());
        else {
          const file = join(
            o.out,
            `${q.value.traceId}.${f}.${f === "junit" ? "xml" : f === "ctrf" || f === "sarif" ? "json" : f === "tap" ? "tap" : "md"}`,
          );
          await writeTextFile(file, text);
          say(`quality: report ${file}`);
        }
      }
      return 0;
    }
    case "index":
      return indexCommand(rest);
    case "freshness":
      return freshnessCommand(rest);
    case "nonconformances":
      return nonconformancesCommand(rest);
    case "capa":
      return capaCommand(rest);
    case "register":
      return registerCommand(rest);
    case "tier":
      return tierCommand(rest);
    case "attest":
      return attestCommand(rest);
    case undefined:
    case "--help":
    case "-h":
      say(USAGE);
      return command === undefined ? 2 : 0;
    default:
      return fail(`${command} is not a command; ${USAGE}`, 2);
  }
}

function fail(message: string, code: number): number {
  complain(message);
  return code;
}

function help(text: string): number {
  say(text);
  return 0;
}

if (import.meta.main) {
  const code = await main(args).then(
    (c) => c,
    (e: unknown) => {
      complain(e instanceof Error ? e.message : String(e));
      return 1;
    },
  );
  exit(code);
}
