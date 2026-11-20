// Spec: 0001-quality-evidence FR-002
/**
 * `ifc test`, the command line of test evidence (commons 0001-quality-evidence FR-002, FR-008 to FR-010): `run` runs a suite on one or more
 * runtimes into one OTLP record with its reports, appends it to a ledger and signs it where asked; `sign` signs a record later with a
 * meaning and a role; `verify` checks a record against a ledger and its envelopes; `render` renders reports from a record kept. Its exit
 * status is the run's: 0 where it passed, 1 where it failed, 2 for a command line that does not fit.
 *
 * ```sh
 * bun commons/quality/src/test-cli.ts run --runtime bun,node --out test-results --report tap,junit,ctrf,sarif,md,html,oscal \
 *   --requirements ../spec-kit/enforcement.tsv --spec 0005-typescript-practice --ledger test-results/ledger.jsonl tests
 * bun commons/quality/src/test-cli.ts sign --record test-results/<trace>.otlp.json --ledger test-results/ledger.jsonl --key reviewer.pem --meaning reviewed --role qa-lead
 * bun commons/quality/src/test-cli.ts verify --record test-results/<trace>.otlp.json --ledger test-results/ledger.jsonl --envelope e.dsse.json --public-key pub.pem --require-review
 * ```
 *
 * @module
 */
import { flag, formatUsageError, helpText, type Operand, parseArgs, type Parser, value } from "@intellectual-frontiers/terminal/args";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { isMeaning, type Meaning } from "./test-report.ts";
import { args, exit } from "@intellectual-frontiers/system/proc";
import {
  loadRecord,
  REPORT_FORMATS,
  type ReportFormat,
  readLedger,
  RUNTIMES,
  type Runtime,
  runTests,
  signRun,
  verifyRun,
  writeReports,
} from "./host/test-run.ts";

function listOf<T extends string>(all: readonly T[], what: string): Parser<readonly T[]> {
  return (t) => {
    const parts = t
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p !== "");
    const bad = parts.find((p) => !(all as readonly string[]).includes(p));
    if (bad !== undefined) return err(`${bad} is not a ${what} (${all.join(", ")})`);
    return ok(parts.filter((p): p is T => (all as readonly string[]).includes(p)));
  };
}

const meaning: Parser<Meaning> = (t) => (isMeaning(t) ? ok(t) : err("the meaning is executed, reviewed or approved"));

const signing = {
  signKey: value({ help: "A PKCS#8 PEM private key (Ed25519 or ECDSA P-256) to sign the record with.", valueName: "PEM" }),
  meaning: value({
    help: "What the signature means: executed, reviewed or approved.",
    valueName: "MEANING",
    parse: meaning,
    default: "executed",
  }),
  role: value({ help: "The role that signs (never a person): ci, qa-lead, ...", valueName: "ROLE", default: "ci" }),
  keyid: value({ help: "The key's id in the envelope.", valueName: "ID" }),
};

const RUN = {
  runtime: value({ help: "The runners, in turn.", valueName: "LIST", parse: listOf(RUNTIMES, "runtime") }),
  out: value({ help: "Where the record and the reports go.", valueName: "DIR", default: "test-results" }),
  report: value({
    help: `The reports: ${REPORT_FORMATS.join(", ")}.`,
    valueName: "LIST",
    parse: listOf(REPORT_FORMATS, "report"),
    default: [],
  }),
  requirements: value({ help: "Requirement ids one per line, or a spec-kit enforcement.tsv (its check rows).", valueName: "FILE" }),
  spec: value({ help: "Keep only this specification's requirements.", valueName: "SPEC" }),
  reviewed: value({ help: "Reviewed requirements: the requirement, a tab and the reason, one per line.", valueName: "FILE" }),
  ledger: value({ help: "The evidence ledger (JSON lines) the record's digest is appended to.", valueName: "FILE" }),
  ...signing,
};

const SIGN = {
  record: value({ help: "The record to sign.", valueName: "FILE", required: true }),
  ledger: value({ help: "The evidence ledger.", valueName: "FILE", required: true }),
  key: value({ help: "A PKCS#8 PEM private key (Ed25519 or ECDSA P-256).", valueName: "PEM", required: true }),
  meaning: signing.meaning,
  role: signing.role,
  keyid: signing.keyid,
};

const VERIFY = {
  record: value({ help: "The record.", valueName: "FILE", required: true }),
  ledger: value({ help: "The evidence ledger.", valueName: "FILE", required: true }),
  envelope: value({ help: "DSSE envelopes, separated by commas.", valueName: "FILES" }),
  publicKey: value({ help: "An SPKI PEM public key (or the PKCS#8 private key) the envelopes are verified with.", valueName: "PEM" }),
  keyid: signing.keyid,
  requireReview: flag({ help: "Fail unless a signature of meaning reviewed is in the ledger for the record." }),
};

const RENDER = {
  record: value({ help: "The record.", valueName: "FILE", required: true }),
  out: value({ help: "Where the reports go.", valueName: "DIR", default: "test-results" }),
  report: value({
    help: `The reports: ${REPORT_FORMATS.join(", ")}.`,
    valueName: "LIST",
    parse: listOf(REPORT_FORMATS, "report"),
    required: true,
  }),
  ledger: value({ help: "The ledger whose signatures the completion report lists.", valueName: "FILE" }),
};

const PATHS: readonly Operand[] = [{ name: "PATH", help: "Test files and folders (tests by default).", arity: "many" }];

const USAGE = "usage: ifc test run|sign|verify|render [OPTIONS] (--help for each)";

function stop(message: string, code: number): never {
  console.error(`ifc test: ${message}`);
  return exit(code);
}

/**
 * `ifc test` with its arguments (after `test`): the exit status of what it ran. The `ifc` command of the package (`node/ifc.mjs`) calls
 * it; `bun commons/quality/src/test-cli.ts` runs it from the source.
 *
 * @param argv - the arguments after `ifc test`
 */
export async function main(argv: readonly string[]): Promise<number> {
  const [command, ...rest] = argv;
  switch (command) {
    case "run": {
      const p = parseArgs(rest, RUN, PATHS);
      if (p.kind === "err") return stop(formatUsageError(p.error, "ifc test run"), 2);
      if (p.value.kind === "help") {
        console.log(helpText("ifc test run", "Run a suite into one test record, its reports and the ledger.", RUN, PATHS));
        return 0;
      }
      const o = p.value.options;
      const runtimes: readonly Runtime[] | undefined = o.runtime;
      const reports: readonly ReportFormat[] = o.report;
      const r = await runTests({
        ...(runtimes === undefined ? {} : { runtimes }),
        paths: p.value.positionals.length === 0 ? ["tests"] : p.value.positionals,
        out: o.out,
        reports,
        ...(o.requirements === undefined ? {} : { requirements: o.requirements }),
        ...(o.spec === undefined ? {} : { spec: o.spec }),
        ...(o.reviewed === undefined ? {} : { reviewed: o.reviewed }),
        ...(o.ledger === undefined ? {} : { ledger: o.ledger }),
        ...(o.signKey === undefined
          ? {}
          : { sign: { key: o.signKey, meaning: o.meaning, role: o.role, ...(o.keyid === undefined ? {} : { keyid: o.keyid }) } }),
      });
      if (r.kind === "err") return stop(r.error, 1);
      const c = r.value.run.counts;
      console.log(
        `ifc test: ${r.value.run.status === "success" ? "PASSED" : "FAILED"}: ${c.tests} tests, ${c.passed} passed, ${c.failed} failed, ` +
          `${c.skipped} skipped, ${c.todo} todo, ${c.cancelled} cancelled`,
      );
      for (const f of r.value.run.failures) console.log(`ifc test: ${f}`);
      console.log(`ifc test: record ${r.value.recordPath} sha256 ${r.value.digest}`);
      for (const path of r.value.reports) console.log(`ifc test: report ${path}`);
      if (r.value.envelopePath !== undefined) console.log(`ifc test: envelope ${r.value.envelopePath}`);
      return r.value.code;
    }
    case "sign": {
      const p = parseArgs(rest, SIGN);
      if (p.kind === "err") return stop(formatUsageError(p.error, "ifc test sign"), 2);
      if (p.value.kind === "help") {
        console.log(
          helpText("ifc test sign", "Sign a test record with a meaning and a role, and enter the signature in the ledger.", SIGN),
        );
        return 0;
      }
      const o = p.value.options;
      const r = await signRun({
        record: o.record,
        ledger: o.ledger,
        sign: { key: o.key, meaning: o.meaning, role: o.role, ...(o.keyid === undefined ? {} : { keyid: o.keyid }) },
      });
      if (r.kind === "err") return stop(r.error, 1);
      console.log(`ifc test: envelope ${r.value.envelopePath}`);
      return 0;
    }
    case "verify": {
      const p = parseArgs(rest, VERIFY);
      if (p.kind === "err") return stop(formatUsageError(p.error, "ifc test verify"), 2);
      if (p.value.kind === "help") {
        console.log(helpText("ifc test verify", "Check a test record against the ledger and its envelopes.", VERIFY));
        return 0;
      }
      const o = p.value.options;
      const r = await verifyRun({
        record: o.record,
        ledger: o.ledger,
        envelopes: (o.envelope ?? "").split(",").filter((e) => e !== ""),
        ...(o.publicKey === undefined ? {} : { publicKey: o.publicKey }),
        ...(o.keyid === undefined ? {} : { keyid: o.keyid }),
        requireReview: o.requireReview,
      });
      if (r.kind === "err") {
        for (const problem of r.error) console.error(`ifc test verify: ${problem}`);
        return 1;
      }
      console.log(
        `ifc test verify: the record ${r.value.digest} is in the ledger (${r.value.seq} entries), ` +
          `${r.value.signatures.length} signature${r.value.signatures.length === 1 ? "" : "s"}: ` +
          (r.value.signatures.map((s) => `${s.meaning} by ${s.role}`).join(", ") || "none"),
      );
      return 0;
    }
    case "render": {
      const p = parseArgs(rest, RENDER);
      if (p.kind === "err") return stop(formatUsageError(p.error, "ifc test render"), 2);
      if (p.value.kind === "help") {
        console.log(helpText("ifc test render", "Render reports from a test record kept.", RENDER));
        return 0;
      }
      const o = p.value.options;
      const r = await loadRecord(o.record);
      if (r.kind === "err") return stop(r.error, 1);
      const ledger = o.ledger === undefined ? undefined : await readLedger(o.ledger);
      if (ledger?.kind === "err") return stop(ledger.error, 1);
      const paths = await writeReports(r.value.run, o.out, o.report, {
        digest: r.value.digest,
        ...(ledger === undefined ? {} : { ledger: ledger.value }),
      });
      for (const path of paths) console.log(`ifc test: report ${path}`);
      return 0;
    }
    case undefined:
    case "--help":
    case "-h":
      console.log(USAGE);
      return command === undefined ? 2 : 0;
    default:
      return stop(`${command} is not a command; ${USAGE}`, 2);
  }
}

if (import.meta.main) {
  const result: Result<number, unknown> = await main(args).then(
    (code) => ok(code),
    (e: unknown) => err(e),
  );
  if (result.kind === "err") stop(result.error instanceof Error ? result.error.message : String(result.error), 1);
  else exit(result.value);
}
