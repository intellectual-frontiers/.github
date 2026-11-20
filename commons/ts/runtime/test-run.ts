/**
 * A test run as evidence (commons 0008-test-evidence FR-005 to FR-007, FR-011, FR-012): `runTests` starts one trace with a `test run`
 * span, runs `bun test` or `node --test` (one or both in turn) with `TRACEPARENT` and `IFC_TEST_RECORD` set,
 * passes each runner's own output on, gathers every process's records into one OTLP JSON file (`<out>/<trace id>.otlp.json`) with the
 * run's span, applies the exit rule, renders the reports asked for from the record as written, appends the record's digest to an
 * evidence ledger and, where a key is given, signs an in-toto Test Result statement of it in a DSSE envelope whose signature is entered
 * in the ledger with its meaning and role. `signRun` signs a record later (a review, an approval), and `verifyRun` checks a record against
 * the ledger and the envelopes. A runtime that is not installed is reported and fails the run. `tools/test.ts` is the command line.
 *
 * @example
 * ```ts
 * import { runTests } from "./test-run.ts";
 * const r = await runTests({ runtimes: ["node"], paths: ["tests"], out: "test-results", reports: ["junit", "md"] });
 * if (r.kind === "ok") console.log(r.value.recordPath, r.value.code);
 * ```
 *
 * @module
 */
import { appendFile } from "node:fs/promises";
import { fromBase64 } from "@intellectual-frontiers/formats/base64";
import { type DsseEnvelope, type DsseKey, parseEnvelope, signStatement } from "@intellectual-frontiers/crypto/dsse";
import {
  appendEntry,
  formatLedgerParseError,
  type LedgerEntry,
  type LedgerRecord,
  ledgerLines,
  parseLedger,
} from "@intellectual-frontiers/grc/evidence";
import { type Instant, instantFromEpochMs, roleOf } from "@intellectual-frontiers/grc/grc";
import { type SpanId, spanIdFrom, type TraceId, traceIdFrom } from "@intellectual-frontiers/telemetry/otel";
import type { LogBatch, TraceBatch } from "@intellectual-frontiers/telemetry/otlp";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Sha256, sha256 } from "@intellectual-frontiers/crypto/sha256";
import {
  assembleRecord,
  completionHtml,
  completionMarkdown,
  ctrfJson,
  formatVerifyProblem,
  junitXml,
  type Meaning,
  oscalAssessmentResults,
  parseRequirementList,
  parseReviewList,
  readRecord,
  recordText,
  runEntry,
  sarif,
  signatureEntry,
  signaturesOf,
  tap14,
  type TestRun,
  testResultStatement,
  type Verification,
  verifyEvidence,
} from "../kernel/test-report.ts";
import { closeOrphans, decodeLines, formatRecordError, installationFromEnv, type RunnerOutcome } from "@intellectual-frontiers/test/record";
import {
  exists,
  makeTempDir,
  mkdir,
  readFile,
  readTextFile,
  remove,
  stat,
  walkFiles,
  writeTextFile,
} from "@intellectual-frontiers/system/fs";
import { basename, dirname, join, resolve } from "@intellectual-frontiers/system/path";
import { build, env, execPath, output, runtimeName, runtimeVersion, which } from "@intellectual-frontiers/system/proc";

/** A runtime whose runner a run uses. */
export type Runtime = "bun" | "node";

/** Every runtime. */
export const RUNTIMES: readonly Runtime[] = ["bun", "node"];

/** A report a run renders from its record (FR-008, FR-009). */
export type ReportFormat = "tap" | "junit" | "ctrf" | "sarif" | "md" | "html" | "oscal";

/** Every report format. */
export const REPORT_FORMATS: readonly ReportFormat[] = ["tap", "junit", "ctrf", "sarif", "md", "html", "oscal"];

/** The file name of a report of a run. */
export function reportName(traceId: string, format: ReportFormat): string {
  const ext: Readonly<Record<ReportFormat, string>> = {
    tap: "tap",
    junit: "junit.xml",
    ctrf: "ctrf.json",
    sarif: "sarif",
    md: "md",
    html: "html",
    oscal: "oscal.json",
  };
  return `${traceId}.${ext[format]}`;
}

/** A key to sign with: a Web Crypto private key, or the path of a PKCS#8 PEM file of an Ed25519 or ECDSA P-256 key. */
export type SigningKey = CryptoKey | string;

/** A signature to make: the key, its meaning, the role that signs, and the key's id in the envelope. */
export type SignOptions = { readonly key: SigningKey; readonly meaning: Meaning; readonly role: string; readonly keyid?: string };

/** How to run a suite. */
export type RunOptions = {
  /** The runners, in turn (the runtime this code runs on by default). */
  readonly runtimes?: readonly Runtime[];
  /** Test files and folders (each `*.test.ts`, `*.test.mts`, `*.test.js` or `*.test.mjs` under a folder); `tests` by default. */
  readonly paths?: readonly string[];
  /** Where the record and the reports go (`test-results` by default). */
  readonly out?: string;
  /** The working folder of the runners (this process's by default). */
  readonly cwd?: string;
  /** A file of requirement ids, or a spec-kit enforcement register (FR-006). */
  readonly requirements?: string;
  /** Keep only the requirements of this specification (`0005-typescript-runtime`). */
  readonly spec?: string;
  /** A file of reviewed requirements: the requirement, a tab and the reason, one per line. */
  readonly reviewed?: string;
  /** The evidence ledger (JSON lines) the record's digest is appended to (FR-011). */
  readonly ledger?: string;
  readonly sign?: SignOptions;
  readonly reports?: readonly ReportFormat[];
  /** Whether the runners' output is passed on (`inherit`, the default) or dropped (`null`). */
  readonly output?: "inherit" | "null";
  /** Variables added to the runners' environment. */
  readonly env?: Readonly<Record<string, string>>;
  /** The executable of a runtime, where it is not the one on `PATH`. */
  readonly executables?: Readonly<Partial<Record<Runtime, string>>>;
};

/** What a run did. */
export type RunResult = {
  /** 0 where the run passed, 1 where it failed (FR-006). */
  readonly code: 0 | 1;
  readonly recordPath: string;
  /** The SHA-256 of the record's bytes (FR-007). */
  readonly digest: Sha256;
  readonly run: TestRun;
  readonly reports: readonly string[];
  readonly ledger?: readonly LedgerEntry[];
  readonly envelopePath?: string;
};

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

function newIds(): { readonly traceId: TraceId; readonly spanId: SpanId } {
  for (;;) {
    const t = traceIdFrom(randomBytes(16));
    const s = spanIdFrom(randomBytes(8));
    if (t.kind === "ok" && s.kind === "ok") return { traceId: t.value, spanId: s.value };
  }
}

function nowNanos(): bigint {
  return BigInt(Date.now()) * 1_000_000n;
}

function now(): Instant {
  return instantFromEpochMs(Date.now()) ?? nowFallback();
}

function nowFallback(): never {
  throw new Error("the clock is outside the years 0000 to 9999");
}

/**
 * This process's environment without what would confuse a runner it starts: `NODE_TEST_CONTEXT`, which `node --test` sets for its own
 * test processes and which turns a nested `node --test` into one of them, and the trace state of a context that is replaced.
 */
function inherited(): Record<string, string> {
  const out = env.toObject();
  for (const k of ["NODE_TEST_CONTEXT", "TRACESTATE"]) Reflect.deleteProperty(out, k);
  return out;
}

const TEST_FILE = /\.test\.(?:ts|mts|js|mjs)$/;

/** The test files of some paths: a file as given, a folder as the test files under it, each absolute and once, sorted. */
export async function testFiles(paths: readonly string[], cwd: string): Promise<Result<readonly string[], string>> {
  const out = new Set<string>();
  for (const p of paths) {
    const abs = resolve(cwd, p);
    let info;
    try {
      info = await stat(abs);
    } catch {
      return err(`${p} does not exist`);
    }
    if (info.isDirectory) for (const f of await walkFiles(abs)) if (TEST_FILE.test(f)) out.add(join(abs, f));
    if (info.isFile) out.add(abs);
  }
  return ok([...out].sort());
}

/**
 * The Node hook of this package (`node/register.mjs`, 0005-typescript-runtime FR-070), which `node --test` is given so that a suite whose
 * files import this package from `node_modules`, as a consumer's do, runs on Node as it does on Bun.
 */
export const NODE_HOOK: string = new URL("../node/register.mjs", import.meta.url).href;

function runnerArgv(runtime: Runtime, exe: string, files: readonly string[]): readonly string[] {
  switch (runtime) {
    case "node":
      return [exe, "--import", NODE_HOOK, "--test", ...files];
    case "bun":
      return [exe, "test", ...files];
    default: {
      const never: never = runtime;
      return never;
    }
  }
}

function executable(runtime: Runtime, given: Readonly<Partial<Record<Runtime, string>>> | undefined): string | undefined {
  const g = given?.[runtime];
  if (g !== undefined) return g;
  return runtime === runtimeName() ? execPath() : which(runtime);
}

async function readOptional(path: string | undefined, what: string): Promise<Result<string | undefined, string>> {
  if (path === undefined) return ok(undefined);
  try {
    return ok(await readTextFile(path));
  } catch (e) {
    return err(`the ${what} ${path} cannot be read: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** A ledger read from its file, empty where there is none. */
export async function readLedger(path: string): Promise<Result<readonly LedgerEntry[], string>> {
  if (!(await exists(path))) return ok([]);
  const parsed = parseLedger(await readTextFile(path));
  return parsed.kind === "ok" ? parsed : err(`the ledger ${path}: ${formatLedgerParseError(parsed.error)}`);
}

async function appendToLedger(path: string, record: LedgerRecord): Promise<Result<readonly LedgerEntry[], string>> {
  const before = await readLedger(path);
  if (before.kind === "err") return before;
  const after = await appendEntry(before.value, record);
  if (after.kind === "err") return err(`the ledger entry has no canonical form at ${after.error.path}: ${after.error.reason}`);
  const added = after.value.slice(before.value.length);
  await mkdir(dirname(resolve(path)), { recursive: true });
  await appendFile(path, ledgerLines(added));
  return ok(after.value);
}

function pemBody(pem: string, label: RegExp): Result<Uint8Array<ArrayBuffer>, string> {
  const m = new RegExp(`-----BEGIN (${label.source})-----([\\s\\S]*?)-----END \\1-----`).exec(pem);
  if (m === null) return err("the file holds no PEM block of the kind expected");
  const der = fromBase64(m[2] ?? "");
  return der.kind === "ok" ? ok(new Uint8Array(der.value)) : err(`the PEM block is not base64: ${der.error}`);
}

const ALGORITHMS: readonly (AlgorithmIdentifier | EcKeyImportParams)[] = [{ name: "Ed25519" }, { name: "ECDSA", namedCurve: "P-256" }];

/** A private key from a PKCS#8 PEM file (or its text) of an Ed25519 or ECDSA P-256 key. */
export async function loadPrivateKey(pathOrPem: string, extractable = false): Promise<Result<CryptoKey, string>> {
  const pem = pathOrPem.includes("-----BEGIN") ? pathOrPem : await readTextFile(pathOrPem).catch(() => "");
  const der = pemBody(pem, /PRIVATE KEY/);
  if (der.kind === "err") return der;
  for (const a of ALGORITHMS) {
    try {
      return ok(await crypto.subtle.importKey("pkcs8", der.value, a, extractable, ["sign"]));
    } catch {
      // Not this algorithm; try the next.
    }
  }
  return err("the private key is neither Ed25519 nor ECDSA P-256 in PKCS#8");
}

/** A public key from an SPKI PEM file (or its text), or the public half of a PKCS#8 private key, of Ed25519 or ECDSA P-256. */
export async function loadPublicKey(pathOrPem: string): Promise<Result<CryptoKey, string>> {
  const pem = pathOrPem.includes("-----BEGIN") ? pathOrPem : await readTextFile(pathOrPem).catch(() => "");
  if (/-----BEGIN PUBLIC KEY-----/.test(pem)) {
    const der = pemBody(pem, /PUBLIC KEY/);
    if (der.kind === "err") return der;
    for (const a of ALGORITHMS) {
      try {
        return ok(await crypto.subtle.importKey("spki", der.value, a, true, ["verify"]));
      } catch {
        // Not this algorithm; try the next.
      }
    }
    return err("the public key is neither Ed25519 nor ECDSA P-256 in SPKI");
  }
  const priv = await loadPrivateKey(pem, true);
  if (priv.kind === "err") return priv;
  const jwk = await crypto.subtle.exportKey("jwk", priv.value);
  const { d: _d, key_ops: _ops, ...pub } = jwk;
  const a: AlgorithmIdentifier | EcKeyImportParams =
    priv.value.algorithm.name === "Ed25519" ? { name: "Ed25519" } : { name: "ECDSA", namedCurve: "P-256" };
  return ok(await crypto.subtle.importKey("jwk", pub, a, true, ["verify"]));
}

/** The reports asked for, rendered from the record as read back, written to `out`; their paths. */
export async function writeReports(
  run: TestRun,
  out: string,
  formats: readonly ReportFormat[],
  extra: { readonly digest?: Sha256; readonly ledger?: readonly LedgerEntry[] } = {},
): Promise<readonly string[]> {
  const signatures = extra.digest === undefined || extra.ledger === undefined ? [] : signaturesOf(extra.ledger, extra.digest);
  const completion = { ...(extra.digest === undefined ? {} : { digest: extra.digest }), signatures };
  const paths: string[] = [];
  if (formats.length > 0) await mkdir(out, { recursive: true });
  for (const f of [...new Set(formats)]) {
    let body: string;
    switch (f) {
      case "tap":
        body = tap14(run);
        break;
      case "junit":
        body = junitXml(run);
        break;
      case "ctrf":
        body = ctrfJson(run);
        break;
      case "sarif":
        body = sarif(run);
        break;
      case "md":
        body = completionMarkdown(run, completion);
        break;
      case "html":
        body = completionHtml(run, completion);
        break;
      case "oscal":
        body = await oscalAssessmentResults(run);
        break;
      default: {
        const never: never = f;
        body = never;
      }
    }
    const path = join(out, reportName(run.traceId, f));
    await writeTextFile(path, body);
    paths.push(path);
  }
  return paths;
}

async function signRecord(
  run: TestRun,
  recordPath: string,
  digest: Sha256,
  ledgerPath: string | undefined,
  sign: SignOptions,
): Promise<Result<{ readonly envelopePath: string; readonly ledger?: readonly LedgerEntry[] }, string>> {
  if (roleOf(sign.role) === undefined) return err(`${JSON.stringify(sign.role)} is not a role (lower-case words, never a person)`);
  const key = typeof sign.key === "string" ? await loadPrivateKey(sign.key) : ok(sign.key);
  if (key.kind === "err") return key;
  const s = testResultStatement(run, { name: basename(recordPath), digest });
  const signed = await signStatement(s, [{ key: key.value, ...(sign.keyid === undefined ? {} : { keyid: sign.keyid }) }]);
  if (signed.kind === "err") return err(`the key cannot sign: ${signed.error.reason}`);
  const text = `${JSON.stringify(signed.value, null, 2)}\n`;
  const envelopePath = join(dirname(recordPath), `${run.traceId}.${sign.meaning}.${sign.role.replace(/[^a-z0-9._-]/g, "-")}.dsse.json`);
  await writeTextFile(envelopePath, text);
  if (ledgerPath === undefined) return ok({ envelopePath });
  const ledger = await appendToLedger(ledgerPath, signatureEntry(sign.meaning, sign.role, digest, await sha256(text), now()));
  if (ledger.kind === "err") return ledger;
  return ok({ envelopePath, ledger: ledger.value });
}

/**
 * A suite run as evidence (FR-005 to FR-007, FR-011): every runner in turn, one record, the exit rule, the reports, the ledger and the
 * signature asked for. An error is something that kept the run from being recorded (a path that does not exist, a list that cannot be
 * read); a run that fails is `ok` with `code` 1.
 */
export async function runTests(options: RunOptions = {}): Promise<Result<RunResult, string>> {
  const cwd = resolve(options.cwd ?? ".");
  const out = resolve(cwd, options.out ?? "test-results");
  const runtimes = [...new Set(options.runtimes ?? [runtimeName()])];
  const files = await testFiles(options.paths ?? ["tests"], cwd);
  if (files.kind === "err") return files;
  if (files.value.length === 0) return err("no test file was found");
  const requirementsText = await readOptional(
    options.requirements === undefined ? undefined : resolve(cwd, options.requirements),
    "requirements list",
  );
  if (requirementsText.kind === "err") return requirementsText;
  const reviewedText = await readOptional(options.reviewed === undefined ? undefined : resolve(cwd, options.reviewed), "reviewed list");
  if (reviewedText.kind === "err") return reviewedText;
  const required = requirementsText.value === undefined ? [] : parseRequirementList(requirementsText.value, options.spec);
  const reviews = reviewedText.value === undefined ? [] : parseReviewList(reviewedText.value);

  const { traceId, spanId } = newIds();
  const start = nowNanos();
  const tmp = await makeTempDir({ prefix: "ifc-test-" });
  const traces: TraceBatch[] = [];
  const logs: LogBatch[] = [];
  const warnings: string[] = [];
  const runners: RunnerOutcome[] = [];
  try {
    for (const runtime of runtimes) {
      const exe = executable(runtime, options.executables);
      if (exe === undefined) {
        runners.push({ kind: "missing", runtime });
        continue;
      }
      const recordFile = join(tmp, `${runtime}.jsonl`);
      await writeTextFile(recordFile, "");
      let code: number;
      try {
        const r = await output(runnerArgv(runtime, exe, files.value), {
          cwd,
          env: { ...inherited(), ...options.env, TRACEPARENT: `00-${traceId}-${spanId}-01`, IFC_TEST_RECORD: recordFile },
          clearEnv: true,
          stdout: options.output ?? "inherit",
          stderr: options.output ?? "inherit",
        });
        code = r.code;
      } catch {
        runners.push({ kind: "missing", runtime });
        continue;
      }
      const end = nowNanos();
      runners.push({ kind: "exited", runtime, code });
      const lines = decodeLines(await readTextFile(recordFile));
      if (lines.kind === "err") return err(`the records of ${runtime}: ${formatRecordError(lines.error)}`);
      warnings.push(...lines.value.warnings);
      // A test process that died left start marks without spans: they are closed here, at the time its runner ended.
      const closed = closeOrphans({ traces: lines.value.traces, logs: lines.value.logs }, end);
      traces.push(...closed.traces);
      logs.push(...closed.logs);
    }
  } finally {
    await remove(tmp, { recursive: true }).catch(() => {});
  }
  const runner = installationFromEnv(
    { runtime: runtimeName(), runtimeVersion: runtimeVersion(), os: build.os, arch: build.arch },
    env.toObject(),
  );
  const assembled = assembleRecord({
    traceId,
    spanId,
    start,
    end: nowNanos(),
    runner: runner.installation,
    signals: { traces, logs },
    runners,
    required,
    reviews,
    warnings: [...runner.warnings, ...warnings],
  });
  if (assembled.kind === "err") return err(formatRecordError(assembled.error));
  await mkdir(out, { recursive: true });
  const text = recordText(assembled.value.record);
  const recordPath = join(out, `${traceId}.otlp.json`);
  await writeTextFile(recordPath, text);
  // The record is the evidence (FR-007): what follows reads it back from its bytes, through the decoders.
  const bytes = await readFile(recordPath);
  const digest = await sha256(bytes);
  const run = readRecord(new TextDecoder().decode(bytes));
  if (run.kind === "err") return err(`the record written cannot be read back: ${formatRecordError(run.error)}`);

  let ledger: readonly LedgerEntry[] | undefined;
  if (options.ledger !== undefined) {
    const l = await appendToLedger(resolve(cwd, options.ledger), runEntry(traceId, digest, now()));
    if (l.kind === "err") return l;
    ledger = l.value;
  }
  let envelopePath: string | undefined;
  if (options.sign !== undefined) {
    const s = await signRecord(
      run.value,
      recordPath,
      digest,
      options.ledger === undefined ? undefined : resolve(cwd, options.ledger),
      options.sign,
    );
    if (s.kind === "err") return s;
    envelopePath = s.value.envelopePath;
    if (s.value.ledger !== undefined) ledger = s.value.ledger;
  }
  const reports = await writeReports(run.value, out, options.reports ?? [], { digest, ...(ledger === undefined ? {} : { ledger }) });
  return ok({
    code: assembled.value.judgement.status === "success" ? 0 : 1,
    recordPath,
    digest,
    run: run.value,
    reports,
    ...(ledger === undefined ? {} : { ledger }),
    ...(envelopePath === undefined ? {} : { envelopePath }),
  });
}

/** A record read from its file, with its digest. */
export async function loadRecord(path: string): Promise<Result<{ readonly run: TestRun; readonly digest: Sha256 }, string>> {
  let bytes: Uint8Array;
  try {
    bytes = await readFile(path);
  } catch (e) {
    return err(`the record ${path} cannot be read: ${e instanceof Error ? e.message : String(e)}`);
  }
  const run = readRecord(new TextDecoder().decode(bytes));
  if (run.kind === "err") return err(`the record ${path}: ${formatRecordError(run.error)}`);
  return ok({ run: run.value, digest: await sha256(bytes) });
}

/** A record signed after its run (a review, an approval): the envelope beside it, and its signature in the ledger (FR-011, FR-013). */
export async function signRun(options: {
  readonly record: string;
  readonly ledger: string;
  readonly sign: SignOptions;
}): Promise<Result<{ readonly envelopePath: string; readonly ledger: readonly LedgerEntry[] }, string>> {
  const r = await loadRecord(options.record);
  if (r.kind === "err") return r;
  const s = await signRecord(r.value.run, resolve(options.record), r.value.digest, options.ledger, options.sign);
  if (s.kind === "err") return s;
  return ok({ envelopePath: s.value.envelopePath, ledger: s.value.ledger ?? [] });
}

/**
 * A record checked (FR-012, FR-013): its digest in the ledger, the ledger's chain whole, each envelope verified with the key and naming
 * the digest, and, with `requireReview`, a signature of meaning `reviewed` in the ledger. Each problem as a sentence.
 */
export async function verifyRun(options: {
  readonly record: string;
  readonly ledger: string;
  readonly envelopes?: readonly string[];
  /** A Web Crypto public key, or the path of an SPKI (or PKCS#8) PEM file. */
  readonly publicKey?: CryptoKey | string;
  readonly keyid?: string;
  readonly requireReview?: boolean;
}): Promise<Result<Verification & { readonly digest: Sha256 }, readonly string[]>> {
  let bytes: Uint8Array;
  try {
    bytes = await readFile(options.record);
  } catch (e) {
    return err([`the record ${options.record} cannot be read: ${e instanceof Error ? e.message : String(e)}`]);
  }
  const digest = await sha256(bytes);
  const ledger = await readLedger(options.ledger);
  if (ledger.kind === "err") return err([ledger.error]);
  const envelopes: { name: string; envelope: DsseEnvelope; digest: Sha256 }[] = [];
  for (const path of options.envelopes ?? []) {
    let text: string;
    try {
      text = await readTextFile(path);
    } catch {
      return err([`the envelope ${path} cannot be read`]);
    }
    const e = parseEnvelope(text);
    if (e.kind === "err") return err([`the envelope ${path} is not a DSSE envelope`]);
    envelopes.push({ name: basename(path), envelope: e.value, digest: await sha256(text) });
  }
  const keys: DsseKey[] = [];
  if (options.publicKey !== undefined) {
    const k = typeof options.publicKey === "string" ? await loadPublicKey(options.publicKey) : ok(options.publicKey);
    if (k.kind === "err") return err([k.error]);
    keys.push({ key: k.value, ...(options.keyid === undefined ? {} : { keyid: options.keyid }) });
  }
  const v = await verifyEvidence({
    recordDigest: digest,
    ledger: ledger.value,
    envelopes,
    keys,
    requireReview: options.requireReview === true,
  });
  return v.kind === "ok" ? ok({ ...v.value, digest }) : err(v.error.map(formatVerifyProblem));
}
