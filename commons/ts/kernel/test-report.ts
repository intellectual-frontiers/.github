/**
 * Test evidence (commons 0008-test-evidence): the record of a test run as OpenTelemetry and every report rendered from it, purely.
 *
 * - Capture (FR-001 to FR-004): a test case (`TestCase`) as a `test` span and a log record with the `test.*` conventions and the
 *   `ifc.test.*` attributes (`testCaseSpan`, `testCaseLog`), the mark a test leaves when it starts (`testStartLog`), so that one that never
 *   ends is closed as `cancelled` (`closeOrphans`), the installation record as a resource (`installationFromEnv`, which refuses a role that
 *   names a person, and `isPersonAttribute`), and the OTLP JSON lines a test process appends to `IFC_TEST_RECORD` (`recordLine`,
 *   `decodeLines`).
 * - The run (FR-005 to FR-007): the exit rule (`judge`), the run's `test run` span and the one OTLP JSON document of a run
 *   (`assembleRecord`), read back only through the OTLP decoders of 0006-signals FR-004 into a typed model (`readRecord`). The requirement
 *   lists a run is held to: ids one per line, or a spec-kit enforcement register's rows of mechanism `check` (`parseRequirementList`), and
 *   requirements declared reviewed (`parseReviewList`).
 * - Reports (FR-008 to FR-010): TAP version 14, JUnit XML, CTRF JSON, SARIF 2.1.0, OSCAL 1.1.2 assessment results and a completion report
 *   in Markdown and in self-contained HTML. Each is a function of the model alone (and, for the completion report, of the signatures the
 *   ledger holds), with no clock: rendering a record twice gives the same bytes, and the counts of each agree with the model's.
 * - Evidence (FR-011 to FR-013): the ledger entries of a run and of a signature with its meaning and role, the in-toto Test Result
 *   statement of a run, and `verifyEvidence`, which checks a record's digest against a ledger, the ledger's chain, each envelope given and,
 *   where asked, a signature of meaning `reviewed`.
 *
 * @example
 * ```ts
 * import { readRecord, tap14 } from "./test-report.ts";
 * // const run = readRecord(await Deno.readTextFile("out/4bf92f3577b34da6a3ce929d0e0e4736.otlp.json"));
 * // if (run.kind === "ok") console.log(tap14(run.value));
 * ```
 *
 * @module
 */
import { absurd } from "./absurd.ts";
import { type DecodeError, formatDecodeError, unknownValue } from "./decode.ts";
import { type DsseEnvelope, type DsseKey, type ResourceDescriptor, type Statement, statement, verifyStatement } from "./dsse.ts";
import { formatLedgerBreak, type LedgerBreak, type LedgerEntry, type LedgerRecord, verifyLedger } from "./evidence.ts";
import {
  type ControlRef,
  type ControlSummary,
  type Finding,
  type Instant,
  instantFromEpochMs,
  roleOf,
  type Severity,
  type Status,
} from "./grc.ts";
import type { Json, JsonObject } from "./json5.ts";
import { assessmentResults, renderOscal } from "./oscal.ts";
import {
  type AttributeValue,
  type Attributes,
  type LogRecord,
  parseSpanId,
  parseTraceId,
  type Resource,
  type Scope,
  SEVERITY,
  type SpanData,
  type SpanId,
  type TraceId,
} from "./otel.ts";
import { decodeLogs, decodeTraces, encodeLogs, encodeTraces, type LogBatch, type TraceBatch } from "./otlp.ts";
import { err, ok, type Result } from "./result.ts";
import { type Sha256, sha256 } from "./sha256.ts";
import { NAMESPACE_URL, uuidV5 } from "./uuid.ts";
import { el, type XmlChild, type XmlElement, writeXml } from "./xml.ts";
import { toYaml } from "./yaml.ts";

// ---------------------------------------------------------------------------------------------------------------------------- the model

/** What became of a test (FR-001). */
export type Outcome = "pass" | "fail" | "skip" | "todo" | "cancelled";

/** Every outcome, in the order reports list them. */
export const OUTCOMES: readonly Outcome[] = ["pass", "fail", "skip", "todo", "cancelled"];

/** A test's risk, after the Computer Software Assurance guidance's high process risk: `high` or `not-high` (FR-001). */
export type Risk = "high" | "not-high";

/** Whether a text is an outcome. */
export function isOutcome(text: string): text is Outcome {
  return (OUTCOMES as readonly string[]).includes(text);
}

/** Whether a text is a risk. */
export function isRisk(text: string): text is Risk {
  return text === "high" || text === "not-high";
}

/** One test as it ran once (FR-001): times in nanoseconds since the Unix epoch; text already redacted and cut. */
export type TestCase = {
  /** The SHA-256 of its file, a NUL and its name. */
  readonly id: string;
  /** Its file, relative to the working folder, with `/`. */
  readonly file: string;
  readonly name: string;
  readonly requirements: readonly string[];
  readonly risk: Risk;
  readonly start: bigint;
  readonly end: bigint;
  readonly outcome: Outcome;
  /** A skip's or a todo's reason, or why it was cancelled. */
  readonly reason?: string;
  readonly message?: string;
  readonly expected?: string;
  readonly actual?: string;
  /** From 1. */
  readonly attempt: number;
};

/** A test of a run: the case, the runtime it ran on (its process's `process.runtime.name`) and the id of its span. */
export type RunTest = TestCase & { readonly runtime: string; readonly spanId: string };

/** The installation record: the resource of a test process or of the run (FR-003). */
export type Installation = {
  readonly runtime: string;
  readonly runtimeVersion: string;
  readonly os: string;
  readonly arch: string;
  readonly revision?: string;
  readonly lockfileSha256?: string;
  readonly pinsSha256?: string;
  readonly role: string;
};

/** A requirement declared proven by review rather than by a test, with the reason. */
export type Review = { readonly requirement: string; readonly reason: string };

/** What one runner did: the runtime, its exit status, or that it is not installed. */
export type RunnerOutcome =
  { readonly kind: "exited"; readonly runtime: string; readonly code: number } | { readonly kind: "missing"; readonly runtime: string };

/** How far a requirement is met by a run. */
export type RequirementState = "proven" | "failing" | "skipped" | "reviewed" | "unproven";

/** One requirement of a run: the tests that prove it, the reviews of it, its risk and its state. */
export type RequirementTrace = {
  readonly id: string;
  /** Whether it is in the list the run was held to. */
  readonly required: boolean;
  readonly risk: Risk;
  readonly state: RequirementState;
  readonly tests: readonly { readonly id: string; readonly name: string; readonly runtime: string; readonly outcome: Outcome }[];
  readonly reviews: readonly string[];
};

/** The counts of a run (FR-010). */
export type Counts = {
  readonly tests: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly todo: number;
  readonly cancelled: number;
};

/** A run's status, as `test.suite.run.status` says it. */
export type RunStatus = "success" | "failure";

/** A run's record as a typed model (FR-008). */
export type TestRun = {
  readonly traceId: string;
  readonly spanId: string;
  readonly start: bigint;
  readonly end: bigint;
  readonly status: RunStatus;
  /** Why it failed, one sentence each; empty where it passed. */
  readonly failures: readonly string[];
  /** The requirements of the list neither proven nor reviewed. */
  readonly unproven: readonly string[];
  /** The list the run was held to. */
  readonly required: readonly string[];
  /** The installation of the process that ran the runners. */
  readonly runner: Installation;
  /** The installation of each runtime the tests ran on, by runtime. */
  readonly installations: readonly Installation[];
  readonly runners: readonly RunnerOutcome[];
  /** In a stable order: runtime, file, name, attempt, start. */
  readonly tests: readonly RunTest[];
  readonly reviews: readonly Review[];
  readonly warnings: readonly string[];
  /** By id. */
  readonly requirements: readonly RequirementTrace[];
  readonly counts: Counts;
};

// ---------------------------------------------------------------------------------------------------------------------------- names

/** The instrumentation scope of test records. */
export const TEST_SCOPE: Scope = { name: "ifc-test", version: "1" };

/** The name of a test's span. */
export const TEST_SPAN = "test";

/** The name of a run's span. */
export const RUN_SPAN = "test run";

/** The event names of the log records of a test record. */
export const EVENTS = {
  case: "ifc.test.case",
  start: "ifc.test.start",
  review: "ifc.test.review",
  runner: "ifc.test.runner",
  warning: "ifc.test.warning",
} as const;

/** The most characters a message, an expected or an actual value keeps (FR-001). */
export const TEXT_LIMIT = 4096;

/** A text cut to `TEXT_LIMIT` characters (without splitting a surrogate pair). */
export function cut(text: string): string {
  if (text.length <= TEXT_LIMIT) return text;
  const end = /[\uD800-\uDBFF]/.test(text.charAt(TEXT_LIMIT - 1)) ? TEXT_LIMIT - 1 : TEXT_LIMIT;
  return text.slice(0, end);
}

/** A test's id: the SHA-256 of its file, a NUL and its name (FR-001). */
export function testId(file: string, name: string): Promise<Sha256> {
  return sha256(`${file}\0${name}`);
}

/** A file path as a record names it: `\` as `/`, without a leading `./`. */
export function recordPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^(?:\.\/)+/, "");
}

// ---------------------------------------------------------------------------------------------------------------------------- installation (FR-003)

/** Whether a resource attribute names a person or a machine of one, and is refused (FR-003): `user.*`, `enduser.*`, `host.name`. */
export function isPersonAttribute(key: string): boolean {
  return key.startsWith("user.") || key.startsWith("enduser.") || key === "host.name" || key === "host.id";
}

const ARCH: Readonly<Record<string, string>> = { x86_64: "amd64", x64: "amd64", aarch64: "arm64", arm: "arm32", ia32: "x86", x86: "x86" };

/** A machine's architecture as OpenTelemetry's `host.arch` names it (`amd64`, `arm64`, ...). */
export function hostArch(arch: string): string {
  return ARCH[arch] ?? arch;
}

const SHA256_TEXT = /^[0-9a-f]{64}$/;

/**
 * The installation record of a process, from what the runtime says of itself and the environment given as a record (the kernel reads no
 * environment): `IFC_TEST_REVISION` or `GITHUB_SHA`, `IFC_TEST_LOCKFILE_SHA256`, `IFC_TEST_PINS_SHA256`, and `IFC_TEST_ROLE` (`ci` where
 * `CI` is set, else `developer`). A role that is not a role (an e-mail address, a name with capitals or spaces) is refused with a
 * warning and the default used, and so is a digest that is not a SHA-256.
 */
export function installationFromEnv(
  self: { readonly runtime: string; readonly runtimeVersion: string; readonly os: string; readonly arch: string },
  env: Readonly<Record<string, string | undefined>>,
): { readonly installation: Installation; readonly warnings: readonly string[] } {
  const warnings: string[] = [];
  const get = (k: string): string | undefined => {
    const v = env[k]?.trim();
    return v === undefined || v === "" ? undefined : v;
  };
  const fallback = get("CI") === undefined || get("CI") === "false" ? "developer" : "ci";
  const given = get("IFC_TEST_ROLE");
  let role = fallback;
  if (given !== undefined) {
    if (roleOf(given) === undefined) warnings.push(`IFC_TEST_ROLE is not a role (lower-case words, never a person); ${fallback} is used`);
    else role = given;
  }
  const digest = (k: string): string | undefined => {
    const v = get(k)?.toLowerCase();
    if (v === undefined) return undefined;
    if (SHA256_TEXT.test(v)) return v;
    warnings.push(`${k} is not a SHA-256; it is left out`);
    return undefined;
  };
  const revision = get("IFC_TEST_REVISION") ?? get("GITHUB_SHA");
  const lockfileSha256 = digest("IFC_TEST_LOCKFILE_SHA256");
  const pinsSha256 = digest("IFC_TEST_PINS_SHA256");
  return {
    installation: {
      runtime: self.runtime,
      runtimeVersion: self.runtimeVersion,
      os: self.os,
      arch: hostArch(self.arch),
      ...(revision === undefined ? {} : { revision }),
      ...(lockfileSha256 === undefined ? {} : { lockfileSha256 }),
      ...(pinsSha256 === undefined ? {} : { pinsSha256 }),
      role,
    },
    warnings,
  };
}

/** The resource of an installation record (FR-003). */
export function installationResource(i: Installation): Resource {
  return {
    attributes: {
      "service.name": "ifc-test",
      "process.runtime.name": i.runtime,
      "process.runtime.version": i.runtimeVersion,
      "os.type": i.os,
      "host.arch": i.arch,
      ...(i.revision === undefined ? {} : { "vcs.ref.head.revision": i.revision }),
      ...(i.lockfileSha256 === undefined ? {} : { "ifc.test.lockfile.sha256": i.lockfileSha256 }),
      ...(i.pinsSha256 === undefined ? {} : { "ifc.test.pins.sha256": i.pinsSha256 }),
      "ifc.test.role": i.role,
    },
  };
}

function text(a: Attributes, key: string): string | undefined {
  const v = a[key];
  return typeof v === "string" ? v : undefined;
}

function texts(a: Attributes, key: string): readonly string[] {
  const v = a[key];
  return Array.isArray(v) && v.every((e): e is string => typeof e === "string") ? v : [];
}

function integerOf(a: Attributes, key: string): number | undefined {
  const v = a[key];
  if (typeof v === "bigint") return Number(v);
  return typeof v === "number" && Number.isInteger(v) ? v : undefined;
}

/** The installation record a resource holds; unknown fields are `unknown`. */
export function installationOf(r: Resource): Installation {
  const a = r.attributes;
  const revision = text(a, "vcs.ref.head.revision");
  const lockfileSha256 = text(a, "ifc.test.lockfile.sha256");
  const pinsSha256 = text(a, "ifc.test.pins.sha256");
  return {
    runtime: text(a, "process.runtime.name") ?? "unknown",
    runtimeVersion: text(a, "process.runtime.version") ?? "unknown",
    os: text(a, "os.type") ?? "unknown",
    arch: text(a, "host.arch") ?? "unknown",
    ...(revision === undefined ? {} : { revision }),
    ...(lockfileSha256 === undefined ? {} : { lockfileSha256 }),
    ...(pinsSha256 === undefined ? {} : { pinsSha256 }),
    role: text(a, "ifc.test.role") ?? "unknown",
  };
}

// ---------------------------------------------------------------------------------------------------------------------------- capture (FR-001, FR-002, FR-004)

/** Where a test's signals belong: the trace, the test's own span id, and the run's span as its parent where there is one. */
export type TestContext = { readonly traceId: TraceId; readonly spanId: SpanId; readonly parentSpanId?: SpanId };

function caseAttributes(c: TestCase): Attributes {
  const status = c.outcome === "pass" ? "pass" : c.outcome === "fail" || c.outcome === "cancelled" ? "fail" : undefined;
  return {
    "test.case.name": c.name,
    ...(status === undefined ? {} : { "test.case.result.status": status }),
    "test.suite.name": c.file,
    "code.file.path": c.file,
    "ifc.test.id": c.id,
    "ifc.test.requirements": [...c.requirements],
    "ifc.test.risk": c.risk,
    "ifc.test.outcome": c.outcome,
    "ifc.test.attempt": BigInt(c.attempt),
    ...(c.reason === undefined ? {} : { "ifc.test.reason": c.reason }),
    ...(c.message === undefined ? {} : { "ifc.test.message": c.message }),
    ...(c.expected === undefined ? {} : { "ifc.test.expected": c.expected }),
    ...(c.actual === undefined ? {} : { "ifc.test.actual": c.actual }),
  };
}

/** A test as its `test` span (FR-002): the conventions, the `ifc.test.*` attributes, and an error status where it failed or was cancelled. */
export function testCaseSpan(c: TestCase, ctx: TestContext): SpanData {
  const failed = c.outcome === "fail" || c.outcome === "cancelled";
  return {
    name: TEST_SPAN,
    context: { traceId: ctx.traceId, spanId: ctx.spanId, traceFlags: 1, traceState: [], isRemote: false },
    ...(ctx.parentSpanId === undefined ? {} : { parentSpanId: ctx.parentSpanId }),
    kind: "internal",
    startTime: c.start,
    endTime: c.end,
    attributes: caseAttributes(c),
    events: [],
    links: [],
    status: failed
      ? { kind: "error", message: c.message ?? c.reason ?? c.outcome }
      : c.outcome === "pass"
        ? { kind: "ok" }
        : { kind: "unset" },
    droppedAttributesCount: 0,
    droppedEventsCount: 0,
    droppedLinksCount: 0,
  };
}

/** A test as its log record (FR-002): the same attributes, the name as its body, at ERROR where it failed or was cancelled. */
export function testCaseLog(c: TestCase, ctx: TestContext): LogRecord {
  const failed = c.outcome === "fail" || c.outcome === "cancelled";
  return {
    time: c.end,
    observedTime: c.end,
    severityNumber: failed ? SEVERITY.ERROR : SEVERITY.INFO,
    severityText: failed ? "ERROR" : "INFO",
    body: `${c.outcome} ${c.name}`,
    attributes: caseAttributes(c),
    droppedAttributesCount: 0,
    eventName: EVENTS.case,
    traceId: ctx.traceId,
    spanId: ctx.spanId,
    traceFlags: 1,
  };
}

/** The mark a test leaves as it starts (FR-004): its span id, so that a test whose span never comes is closed as cancelled. */
export function testStartLog(c: Omit<TestCase, "end" | "outcome">, ctx: TestContext): LogRecord {
  return {
    time: c.start,
    observedTime: c.start,
    severityNumber: SEVERITY.DEBUG,
    severityText: "DEBUG",
    body: `start ${c.name}`,
    attributes: {
      "test.case.name": c.name,
      "test.suite.name": c.file,
      "ifc.test.id": c.id,
      "ifc.test.requirements": [...c.requirements],
      "ifc.test.risk": c.risk,
      "ifc.test.attempt": BigInt(c.attempt),
      ...(ctx.parentSpanId === undefined ? {} : { "ifc.test.parent": ctx.parentSpanId }),
    },
    droppedAttributesCount: 0,
    eventName: EVENTS.start,
    traceId: ctx.traceId,
    spanId: ctx.spanId,
    traceFlags: 1,
  };
}

function plainLog(eventName: string, time: bigint, body: string, attributes: Attributes, warn = false): LogRecord {
  return {
    time,
    observedTime: time,
    severityNumber: warn ? SEVERITY.WARN : SEVERITY.INFO,
    severityText: warn ? "WARN" : "INFO",
    body,
    attributes,
    droppedAttributesCount: 0,
    eventName,
  };
}

/** A review declared in a test file or a list (`ifc.test.review`). */
export function reviewLog(r: Review, time: bigint, traceId?: TraceId): LogRecord {
  const base = plainLog(EVENTS.review, time, `reviewed ${r.requirement}`, {
    "ifc.test.requirement": r.requirement,
    "ifc.test.reason": r.reason,
  });
  return traceId === undefined ? base : { ...base, traceId };
}

/** A warning of a test process or a run (`ifc.test.warning`), such as a role refused. */
export function warningLog(message: string, time: bigint): LogRecord {
  return plainLog(EVENTS.warning, time, message, { "ifc.test.warning": message }, true);
}

/** What one runner did (`ifc.test.runner`). */
export function runnerLog(r: RunnerOutcome, time: bigint): LogRecord {
  const attributes: Attributes =
    r.kind === "exited"
      ? { "process.runtime.name": r.runtime, "ifc.test.runner.found": true, "process.exit.code": BigInt(r.code) }
      : { "process.runtime.name": r.runtime, "ifc.test.runner.found": false };
  return plainLog(
    EVENTS.runner,
    time,
    r.kind === "exited" ? `${r.runtime} exited with ${r.code}` : `${r.runtime} is not installed`,
    attributes,
    r.kind === "missing" || (r.kind === "exited" && r.code !== 0),
  );
}

/** One line of `IFC_TEST_RECORD`: an OTLP JSON traces or logs export request of one resource, without a line feed (FR-004). */
export function recordLine(
  resource: Resource,
  signal: { readonly spans: readonly SpanData[] } | { readonly records: readonly LogRecord[] },
): string {
  return JSON.stringify(
    "spans" in signal
      ? encodeTraces([{ resource, scope: TEST_SCOPE, spans: signal.spans }])
      : encodeLogs([{ resource, scope: TEST_SCOPE, records: signal.records }]),
  );
}

/** Why the lines of a test record or a run's record could not be read. */
export type RecordError =
  | { readonly kind: "json"; readonly line: number; readonly reason: string }
  | { readonly kind: "otlp"; readonly line: number; readonly error: DecodeError }
  | { readonly kind: "person"; readonly key: string }
  | { readonly kind: "test"; readonly spanId: string; readonly reason: string }
  | { readonly kind: "no-run"; readonly reason: string };

/** A record error as one sentence. */
export function formatRecordError(e: RecordError): string {
  switch (e.kind) {
    case "json":
      return `line ${e.line} is not JSON: ${e.reason}`;
    case "otlp":
      return `line ${e.line} is not OTLP JSON: ${formatDecodeError(e.error)}`;
    case "person":
      return `the record names a person or a machine of one (${e.key}), which a test record must not`;
    case "test":
      return `the test span ${e.spanId} is not a test record: ${e.reason}`;
    case "no-run":
      return `the record has no run: ${e.reason}`;
    default:
      return absurd(e);
  }
}

/** The signals of one or more export requests. */
export type Signals = { readonly traces: readonly TraceBatch[]; readonly logs: readonly LogBatch[] };

function decodeDocument(value: unknown, line: number): Result<Signals, RecordError> {
  const t = decodeTraces(value);
  if (t.kind === "err") return err({ kind: "otlp", line, error: t.error });
  const l = decodeLogs(value);
  if (l.kind === "err") return err({ kind: "otlp", line, error: l.error });
  return ok({ traces: t.value, logs: l.value });
}

/**
 * The signals of `IFC_TEST_RECORD`'s lines, each an OTLP JSON export request (FR-004). A last line cut short (a process killed while it
 * wrote) is left out with a warning; any other line that is not one is an error.
 */
export function decodeLines(input: string): Result<Signals & { readonly warnings: readonly string[] }, RecordError> {
  const traces: TraceBatch[] = [];
  const logs: LogBatch[] = [];
  const warnings: string[] = [];
  const lines = input.split("\n");
  for (const [i, raw] of lines.entries()) {
    const line = raw.trim();
    if (line === "") continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch (e) {
      if (i === lines.length - 1) {
        warnings.push(`the last line of a test record was cut short and is left out`);
        continue;
      }
      return err({ kind: "json", line: i + 1, reason: e instanceof Error ? e.message : String(e) });
    }
    const d = decodeDocument(value, i + 1);
    if (d.kind === "err") return d;
    traces.push(...d.value.traces);
    logs.push(...d.value.logs);
  }
  return ok({ traces, logs, warnings });
}

function resourceKey(r: Resource, s: Scope): string {
  const keys = Object.keys(r.attributes).sort();
  const enc = (v: AttributeValue | undefined): unknown =>
    typeof v === "bigint"
      ? `${v}n`
      : v instanceof Uint8Array
        ? [...v]
        : Array.isArray(v)
          ? (v as readonly (string | boolean | bigint | number)[]).map((x): unknown => (typeof x === "bigint" ? `${x}n` : x)) // an array attribute is one of these
          : v;
  return JSON.stringify([s.name, s.version ?? "", keys.map((k) => [k, enc(r.attributes[k])])]);
}

/** Batches of one resource and scope joined into one, in the order they first came. */
export function mergeBatches(signals: Signals): Signals {
  const t = new Map<string, { resource: Resource; scope: Scope; spans: SpanData[] }>();
  for (const b of signals.traces) {
    const k = resourceKey(b.resource, b.scope);
    const at = t.get(k) ?? { resource: b.resource, scope: b.scope, spans: [] };
    at.spans.push(...b.spans);
    t.set(k, at);
  }
  const l = new Map<string, { resource: Resource; scope: Scope; records: LogRecord[] }>();
  for (const b of signals.logs) {
    const k = resourceKey(b.resource, b.scope);
    const at = l.get(k) ?? { resource: b.resource, scope: b.scope, records: [] };
    at.records.push(...b.records);
    l.set(k, at);
  }
  return { traces: [...t.values()], logs: [...l.values()] };
}

/**
 * The traces with a `cancelled` test span for each test that started and has no span (FR-004): its process died, or exited, before the
 * test ended. Its end is `at`, the time the run saw its process end.
 */
export function closeOrphans(signals: Signals, at: bigint): Signals {
  const ended = new Set(signals.traces.flatMap((b) => b.spans.filter((s) => s.name === TEST_SPAN).map((s) => s.context.spanId)));
  const extra: TraceBatch[] = [];
  for (const b of signals.logs) {
    const spans: SpanData[] = [];
    for (const r of b.records) {
      if (r.eventName !== EVENTS.start || r.spanId === undefined || r.traceId === undefined || ended.has(r.spanId)) continue;
      ended.add(r.spanId);
      const a = r.attributes;
      const risk = text(a, "ifc.test.risk") ?? "not-high";
      const parent = text(a, "ifc.test.parent");
      const parentSpanId = parent === undefined ? undefined : parseSpanId(parent);
      const c: TestCase = {
        id: text(a, "ifc.test.id") ?? "",
        file: text(a, "test.suite.name") ?? "",
        name: text(a, "test.case.name") ?? "",
        requirements: texts(a, "ifc.test.requirements"),
        risk: isRisk(risk) ? risk : "not-high",
        start: r.time,
        end: at > r.time ? at : r.time,
        outcome: "cancelled",
        reason: "its process ended before the test did",
        attempt: integerOf(a, "ifc.test.attempt") ?? 1,
      };
      spans.push(
        testCaseSpan(c, {
          traceId: r.traceId,
          spanId: r.spanId,
          ...(parentSpanId?.kind === "ok" ? { parentSpanId: parentSpanId.value } : {}),
        }),
      );
    }
    if (spans.length > 0) extra.push({ resource: b.resource, scope: b.scope, spans });
  }
  return extra.length === 0 ? signals : mergeBatches({ traces: [...signals.traces, ...extra], logs: signals.logs });
}

// ---------------------------------------------------------------------------------------------------------------------------- the run (FR-005, FR-006)

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function testOf(s: SpanData, runtime: string): Result<RunTest, RecordError> {
  const a = s.attributes;
  const no = (reason: string): Result<never, RecordError> => err({ kind: "test", spanId: s.context.spanId, reason });
  const id = text(a, "ifc.test.id");
  const name = text(a, "test.case.name");
  const file = text(a, "test.suite.name");
  const outcome = text(a, "ifc.test.outcome") ?? "";
  const risk = text(a, "ifc.test.risk") ?? "";
  if (id === undefined) return no("it has no ifc.test.id");
  if (name === undefined) return no("it has no test.case.name");
  if (file === undefined) return no("it has no test.suite.name");
  if (!isOutcome(outcome)) return no(`its outcome ${JSON.stringify(outcome)} is not one of ${OUTCOMES.join(", ")}`);
  if (!isRisk(risk)) return no(`its risk ${JSON.stringify(risk)} is not high or not-high`);
  const reason = text(a, "ifc.test.reason");
  const message = text(a, "ifc.test.message");
  const expected = text(a, "ifc.test.expected");
  const actual = text(a, "ifc.test.actual");
  return ok({
    id,
    file,
    name,
    requirements: texts(a, "ifc.test.requirements"),
    risk,
    start: s.startTime,
    end: s.endTime,
    outcome,
    ...(reason === undefined ? {} : { reason }),
    ...(message === undefined ? {} : { message }),
    ...(expected === undefined ? {} : { expected }),
    ...(actual === undefined ? {} : { actual }),
    attempt: integerOf(a, "ifc.test.attempt") ?? 1,
    runtime,
    spanId: s.context.spanId,
  });
}

function compareTests(a: RunTest, b: RunTest): number {
  return (
    byText(a.runtime, b.runtime) ||
    byText(a.file, b.file) ||
    byText(a.name, b.name) ||
    a.attempt - b.attempt ||
    (a.start < b.start ? -1 : a.start > b.start ? 1 : 0) ||
    byText(a.spanId, b.spanId)
  );
}

/** The tests of some signals, in a stable order. */
export function testsOf(signals: Signals): Result<readonly RunTest[], RecordError> {
  const tests: RunTest[] = [];
  for (const b of signals.traces) {
    const runtime = text(b.resource.attributes, "process.runtime.name") ?? "unknown";
    for (const s of b.spans) {
      if (s.name !== TEST_SPAN) continue;
      const t = testOf(s, runtime);
      if (t.kind === "err") return t;
      tests.push(t.value);
    }
  }
  return ok(tests.sort(compareTests));
}

/** The reviews some signals declare, each once, by requirement and reason. */
export function reviewsOf(signals: Signals): readonly Review[] {
  const seen = new Map<string, Review>();
  for (const b of signals.logs) {
    for (const r of b.records) {
      if (r.eventName !== EVENTS.review) continue;
      const requirement = text(r.attributes, "ifc.test.requirement");
      const reason = text(r.attributes, "ifc.test.reason");
      if (requirement === undefined || reason === undefined) continue;
      seen.set(JSON.stringify([requirement, reason]), { requirement, reason });
    }
  }
  return [...seen.entries()].sort(([a], [b]) => byText(a, b)).map(([, r]) => r);
}

/** The counts of some tests. */
export function countsOf(tests: readonly { readonly outcome: Outcome }[]): Counts {
  const n = (o: Outcome): number => tests.filter((t) => t.outcome === o).length;
  return { tests: tests.length, passed: n("pass"), failed: n("fail"), skipped: n("skip"), todo: n("todo"), cancelled: n("cancelled") };
}

/** Each requirement named by a test, a review or the list, with its state (FR-006, FR-009). */
export function requirementsOf(
  tests: readonly RunTest[],
  reviews: readonly Review[],
  required: readonly string[],
): readonly RequirementTrace[] {
  const ids = new Set<string>([...required, ...reviews.map((r) => r.requirement), ...tests.flatMap((t) => t.requirements)]);
  const listed = new Set(required);
  return [...ids].sort(byText).map((id) => {
    const proving = tests.filter((t) => t.requirements.includes(id));
    const reasons = [...new Set(reviews.filter((r) => r.requirement === id).map((r) => r.reason))].sort(byText);
    const outcomes = new Set(proving.map((t) => t.outcome));
    const state: RequirementState =
      outcomes.has("fail") || outcomes.has("cancelled")
        ? "failing"
        : outcomes.has("pass")
          ? "proven"
          : reasons.length > 0
            ? "reviewed"
            : proving.length > 0
              ? "skipped"
              : "unproven";
    return {
      id,
      required: listed.has(id),
      risk: proving.some((t) => t.risk === "high") ? "high" : "not-high",
      state,
      tests: proving.map((t) => ({ id: t.id, name: t.name, runtime: t.runtime, outcome: t.outcome })),
      reviews: reasons,
    };
  });
}

/** What the exit rule says of a run (FR-006). */
export type Judgement = { readonly status: RunStatus; readonly failures: readonly string[]; readonly unproven: readonly string[] };

/**
 * The exit rule (FR-006): a run fails when a test failed, when a runner exited non-zero or is not installed, when a test was cancelled,
 * or when a requirement of the list is neither proven by a test of the run nor declared reviewed.
 */
export function judge(input: {
  readonly tests: readonly RunTest[];
  readonly runners: readonly RunnerOutcome[];
  readonly required: readonly string[];
  readonly reviews: readonly Review[];
}): Judgement {
  const failures: string[] = [];
  const counts = countsOf(input.tests);
  const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
  if (counts.failed > 0) failures.push(`${plural(counts.failed, "test", "tests")} failed`);
  if (counts.cancelled > 0) failures.push(`${plural(counts.cancelled, "test was", "tests were")} cancelled`);
  for (const r of input.runners) {
    switch (r.kind) {
      case "exited":
        if (r.code !== 0) failures.push(`the ${r.runtime} runner exited with ${r.code}`);
        break;
      case "missing":
        failures.push(`${r.runtime} is not installed`);
        break;
      default:
        absurd(r);
    }
  }
  const unproven = requirementsOf(input.tests, input.reviews, input.required)
    .filter((r) => r.required && (r.state === "unproven" || r.state === "skipped"))
    .map((r) => r.id);
  if (unproven.length > 0)
    failures.push(`${plural(unproven.length, "requirement is", "requirements are")} neither proven nor reviewed: ${unproven.join(", ")}`);
  return { status: failures.length === 0 ? "success" : "failure", failures, unproven };
}

/** What a run is assembled from: its ids and times, the installation that ran it, the signals its processes wrote, the runners, the list and the reviews of a list. */
export type RunInput = {
  readonly traceId: TraceId;
  readonly spanId: SpanId;
  readonly start: bigint;
  readonly end: bigint;
  readonly runner: Installation;
  readonly signals: Signals;
  readonly runners: readonly RunnerOutcome[];
  readonly required: readonly string[];
  /** Reviews from a list rather than from the tests' own code. */
  readonly reviews?: readonly Review[];
  readonly warnings?: readonly string[];
};

/**
 * The one OTLP JSON document of a run (FR-005, FR-006): every process's signals, a cancelled span for each test that never ended, and the
 * run's `test run` span with `test.suite.run.status` and `ifc.test.unproven`, its reviews, runners and warnings; with the judgement.
 */
export function assembleRecord(input: RunInput): Result<{ readonly record: JsonObject; readonly judgement: Judgement }, RecordError> {
  const closed = closeOrphans(mergeBatches(input.signals), input.end);
  const tests = testsOf(closed);
  if (tests.kind === "err") return tests;
  const reviews = [...reviewsOf(closed), ...(input.reviews ?? [])];
  const judgement = judge({ tests: tests.value, runners: input.runners, required: input.required, reviews });
  const resource = installationResource(input.runner);
  const runSpan: SpanData = {
    name: RUN_SPAN,
    context: { traceId: input.traceId, spanId: input.spanId, traceFlags: 1, traceState: [], isRemote: false },
    kind: "internal",
    startTime: input.start,
    endTime: input.end,
    attributes: {
      "test.suite.name": "ifc test",
      "test.suite.run.status": judgement.status,
      "ifc.test.unproven": [...judgement.unproven],
      "ifc.test.required": [...input.required],
      "ifc.test.failures": [...judgement.failures],
      "ifc.test.runtimes": input.runners.map((r) => r.runtime),
    },
    events: [],
    links: [],
    status: judgement.status === "success" ? { kind: "ok" } : { kind: "error", message: judgement.failures.join("; ") },
    droppedAttributesCount: 0,
    droppedEventsCount: 0,
    droppedLinksCount: 0,
  };
  const own: LogRecord[] = [
    ...input.runners.map((r) => ({ ...runnerLog(r, input.end), traceId: input.traceId, spanId: input.spanId })),
    ...(input.reviews ?? []).map((r) => ({ ...reviewLog(r, input.end, input.traceId), spanId: input.spanId })),
    ...(input.warnings ?? []).map((w) => ({ ...warningLog(w, input.end), traceId: input.traceId, spanId: input.spanId })),
  ];
  const merged = mergeBatches({
    traces: [{ resource, scope: TEST_SCOPE, spans: [runSpan] }, ...closed.traces],
    logs: [...(own.length === 0 ? [] : [{ resource, scope: TEST_SCOPE, records: own }]), ...closed.logs],
  });
  return ok({ record: { ...encodeTraces(merged.traces), ...encodeLogs(merged.logs) }, judgement });
}

/** A record as the bytes kept: its JSON and a line feed (FR-007). */
export function recordText(record: JsonObject): string {
  return `${JSON.stringify(record)}\n`;
}

/**
 * A run's record read into the typed model (FR-007, FR-008), only through the OTLP decoders of 0006-signals: the run's span, its
 * installation records (a resource that names a person is refused), its tests, its reviews and its requirements. `input` is the
 * record's text, or its JSON already parsed.
 */
export function readRecord(input: unknown): Result<TestRun, RecordError> {
  let value: unknown = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input);
    } catch (e) {
      return err({ kind: "json", line: 1, reason: e instanceof Error ? e.message : String(e) });
    }
  }
  const d = decodeDocument(value, 1);
  if (d.kind === "err") return d;
  const signals = d.value;
  for (const b of [...signals.traces, ...signals.logs]) {
    const key = Object.keys(b.resource.attributes).find(isPersonAttribute);
    if (key !== undefined) return err({ kind: "person", key });
  }
  const runs = signals.traces.flatMap((b) => b.spans.filter((s) => s.name === RUN_SPAN).map((s) => ({ s, resource: b.resource })));
  const run = runs[0];
  if (run === undefined) return err({ kind: "no-run", reason: `no span is named ${JSON.stringify(RUN_SPAN)}` });
  if (runs.length > 1) return err({ kind: "no-run", reason: `${runs.length} spans are named ${JSON.stringify(RUN_SPAN)}` });
  const status = text(run.s.attributes, "test.suite.run.status");
  if (status !== "success" && status !== "failure")
    return err({ kind: "no-run", reason: "its span has no test.suite.run.status of success or failure" });
  const tests = testsOf(signals);
  if (tests.kind === "err") return tests;
  const reviews = reviewsOf(signals);
  const required = texts(run.s.attributes, "ifc.test.required");
  const runners: RunnerOutcome[] = [];
  const warnings: string[] = [];
  for (const b of signals.logs) {
    for (const r of b.records) {
      if (r.eventName === EVENTS.runner) {
        const runtime = text(r.attributes, "process.runtime.name") ?? "unknown";
        const code = integerOf(r.attributes, "process.exit.code");
        runners.push(
          r.attributes["ifc.test.runner.found"] === false || code === undefined
            ? { kind: "missing", runtime }
            : { kind: "exited", runtime, code },
        );
      } else if (r.eventName === EVENTS.warning) {
        warnings.push(text(r.attributes, "ifc.test.warning") ?? "");
      }
    }
  }
  const installations = new Map<string, Installation>();
  for (const b of signals.traces) {
    if (b.spans.some((s) => s.name === TEST_SPAN)) {
      const i = installationOf(b.resource);
      installations.set(JSON.stringify([i.runtime, i.runtimeVersion, i.os, i.arch, i.role, i.revision ?? ""]), i);
    }
  }
  return ok({
    traceId: run.s.context.traceId,
    spanId: run.s.context.spanId,
    start: run.s.startTime,
    end: run.s.endTime,
    status,
    failures: texts(run.s.attributes, "ifc.test.failures"),
    unproven: texts(run.s.attributes, "ifc.test.unproven"),
    required,
    runner: installationOf(run.resource),
    installations: [...installations.entries()].sort(([a], [b]) => byText(a, b)).map(([, i]) => i),
    runners,
    tests: tests.value,
    reviews,
    warnings: [...new Set(warnings)].sort(byText),
    requirements: requirementsOf(tests.value, reviews, required),
    counts: countsOf(tests.value),
  });
}

// ---------------------------------------------------------------------------------------------------------------------------- lists (FR-006)

/**
 * The requirements a run is held to (FR-006): one id per line (`0008-test-evidence FR-001`; `#` begins a comment), or a spec-kit
 * enforcement register, whose rows (`requirement`, a tab, `mechanism`, ...) of mechanism `check` are taken. `spec` keeps only the ids
 * that begin with it (`0005-typescript-runtime`). Each id once, in the order given.
 */
export function parseRequirementList(input: string, spec?: string): readonly string[] {
  const out = new Set<string>();
  for (const raw of input.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    const cols = line.split("\t");
    let id: string;
    if (cols.length > 1) {
      if (cols[1]?.trim() !== "check") continue;
      id = (cols[0] ?? "").trim();
    } else {
      id = line.trim();
    }
    if (id === "" || id === "requirement") continue;
    if (spec !== undefined && !(id === spec || id.startsWith(`${spec} `) || id.startsWith(spec))) continue;
    out.add(id);
  }
  return [...out];
}

/** Requirements declared reviewed in a list (FR-006): a line of the requirement, a tab and the reason (`#` begins a comment). A line without a reason is left out. */
export function parseReviewList(input: string): readonly Review[] {
  const out: Review[] = [];
  for (const raw of input.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const requirement = line.slice(0, tab).trim();
    const reason = line.slice(tab + 1).trim();
    if (requirement !== "" && reason !== "") out.push({ requirement, reason });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------- rendering helpers

/** Nanoseconds since the Unix epoch as ISO 8601 text in UTC with milliseconds. */
export function isoTime(nanos: bigint): string {
  return instantFromEpochMs(Number(nanos / 1_000_000n)) ?? "1970-01-01T00:00:00.000Z";
}

/** The seconds between two times in nanoseconds, with three decimals. */
export function seconds(start: bigint, end: bigint): string {
  const ns = end > start ? end - start : 0n;
  const ms = ns / 1_000_000n;
  return `${ms / 1000n}.${String(ms % 1000n).padStart(3, "0")}`;
}

function milliseconds(start: bigint, end: bigint): number {
  return Number((end > start ? end - start : 0n) / 1_000_000n);
}

/** A test's tests grouped by runtime and file, in the order of the model. */
function groups(run: TestRun): readonly { readonly runtime: string; readonly file: string; readonly tests: readonly RunTest[] }[] {
  const out = new Map<string, { runtime: string; file: string; tests: RunTest[] }>();
  for (const t of run.tests) {
    const k = JSON.stringify([t.runtime, t.file]);
    const g = out.get(k) ?? { runtime: t.runtime, file: t.file, tests: [] };
    g.tests.push(t);
    out.set(k, g);
  }
  return [...out.values()];
}

const oneLine = (s: string): string => s.replace(/[\r\n]+/g, " ");

// ---------------------------------------------------------------------------------------------------------------------------- TAP 14 (FR-008)

function tapDescription(s: string): string {
  return oneLine(s).replaceAll("\\", "\\\\").replaceAll("#", "\\#");
}

function diagnostic(t: RunTest, indent: string): string {
  const fields: Record<string, Json> = { outcome: t.outcome };
  if (t.message !== undefined) fields["message"] = t.message;
  if (t.expected !== undefined) fields["expected"] = t.expected;
  if (t.actual !== undefined) fields["actual"] = t.actual;
  if (t.reason !== undefined) fields["reason"] = t.reason;
  fields["requirements"] = [...t.requirements];
  fields["risk"] = t.risk;
  fields["id"] = t.id;
  const yaml = toYaml(fields)
    .split("\n")
    .filter((l) => l !== "")
    .map((l) => `${indent}${l}`)
    .join("\n");
  return `${indent}---\n${yaml}\n${indent}...\n`;
}

/**
 * The run as TAP version 14 (FR-008): a plan, one subtest per runtime and file, each test `ok` or `not ok` numbered, `# SKIP` and
 * `# TODO` with their reasons, and a YAML diagnostic block for a failure or a cancellation; the counts as closing comments.
 */
export function tap14(run: TestRun): string {
  const gs = groups(run);
  let out = `TAP version 14\n1..${gs.length}${gs.length === 0 ? " # no tests" : ""}\n`;
  for (const [gi, g] of gs.entries()) {
    const title = tapDescription(`${g.file} [${g.runtime}]`);
    out += `# Subtest: ${title}\n    1..${g.tests.length}\n`;
    for (const [i, t] of g.tests.entries()) {
      const n = i + 1;
      const name = tapDescription(t.name);
      switch (t.outcome) {
        case "pass":
          out += `    ok ${n} - ${name}\n`;
          break;
        case "skip":
          out += `    ok ${n} - ${name} # SKIP${t.reason === undefined ? "" : ` ${tapDescription(t.reason)}`}\n`;
          break;
        case "todo":
          out += `    not ok ${n} - ${name} # TODO${t.reason === undefined ? "" : ` ${tapDescription(t.reason)}`}\n`;
          break;
        case "fail":
        case "cancelled":
          out += `    not ok ${n} - ${name}\n${diagnostic(t, "      ")}`;
          break;
        default:
          absurd(t.outcome);
      }
    }
    const failed = g.tests.some((t) => t.outcome === "fail" || t.outcome === "cancelled");
    out += `${failed ? "not ok" : "ok"} ${gi + 1} - ${title}\n`;
  }
  const c = run.counts;
  out += `# tests ${c.tests}\n# pass ${c.passed}\n# fail ${c.failed}\n# skip ${c.skipped}\n# todo ${c.todo}\n# cancelled ${c.cancelled}\n`;
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------- JUnit XML (FR-008)

const prop = (name: string, value: string): XmlElement =>
  el(
    "property",
    [],
    [
      ["name", name],
      ["value", value],
    ],
  );

function installationProps(i: Installation | undefined, runtime: string): readonly XmlElement[] {
  if (i === undefined) return [prop("process.runtime.name", runtime)];
  return [
    prop("process.runtime.name", i.runtime),
    prop("process.runtime.version", i.runtimeVersion),
    prop("os.type", i.os),
    prop("host.arch", i.arch),
    ...(i.revision === undefined ? [] : [prop("vcs.ref.head.revision", i.revision)]),
    ...(i.lockfileSha256 === undefined ? [] : [prop("ifc.test.lockfile.sha256", i.lockfileSha256)]),
    ...(i.pinsSha256 === undefined ? [] : [prop("ifc.test.pins.sha256", i.pinsSha256)]),
    prop("ifc.test.role", i.role),
  ];
}

function failureText(t: RunTest): string {
  return [
    t.message,
    t.expected === undefined ? undefined : `expected: ${t.expected}`,
    t.actual === undefined ? undefined : `actual: ${t.actual}`,
    t.reason,
  ]
    .filter((x): x is string => x !== undefined)
    .join("\n");
}

/**
 * The run as JUnit XML (FR-008): one `testsuite` per file and runtime with the installation as `properties`, a `testcase` with its
 * `classname` (the file) and its time in seconds, the requirements, risk and id as its `properties`, and `failure`, `error` (cancelled)
 * or `skipped` (skip and todo).
 */
export function junitXml(run: TestRun): string {
  const time = (ts: readonly RunTest[]): string => {
    const ms = ts.reduce((n, t) => n + milliseconds(t.start, t.end), 0);
    return `${Math.floor(ms / 1000)}.${String(ms % 1000).padStart(3, "0")}`;
  };
  const suites = groups(run).map((g) => {
    const c = countsOf(g.tests);
    const installation = run.installations.find((i) => i.runtime === g.runtime);
    const cases = g.tests.map((t) => {
      const props = el("properties", [
        ...t.requirements.map((r) => prop("requirement", r)),
        prop("risk", t.risk),
        prop("id", t.id),
        prop("outcome", t.outcome),
        prop("attempt", String(t.attempt)),
      ]);
      const body: XmlChild[] = [props];
      switch (t.outcome) {
        case "pass":
          break;
        case "fail":
          body.push(
            el(
              "failure",
              [failureText(t)],
              [
                ["message", oneLine(t.message ?? "failed")],
                ["type", "AssertionError"],
              ],
            ),
          );
          break;
        case "cancelled":
          body.push(
            el(
              "error",
              [failureText(t)],
              [
                ["message", oneLine(t.reason ?? "cancelled")],
                ["type", "cancelled"],
              ],
            ),
          );
          break;
        case "skip":
          body.push(el("skipped", [], [["message", oneLine(t.reason ?? "skipped")]]));
          break;
        case "todo":
          body.push(el("skipped", [], [["message", `TODO${t.reason === undefined ? "" : `: ${oneLine(t.reason)}`}`]]));
          break;
        default:
          absurd(t.outcome);
      }
      return el("testcase", body, [
        ["name", t.name],
        ["classname", t.file],
        ["file", t.file],
        ["time", seconds(t.start, t.end)],
      ]);
    });
    return el(
      "testsuite",
      [el("properties", installationProps(installation, g.runtime)), ...cases],
      [
        ["name", `${g.file} [${g.runtime}]`],
        ["tests", String(c.tests)],
        ["failures", String(c.failed)],
        ["errors", String(c.cancelled)],
        ["skipped", String(c.skipped + c.todo)],
        ["time", time(g.tests)],
      ],
    );
  });
  const c = run.counts;
  return writeXml(
    el("testsuites", suites, [
      ["name", `ifc test ${run.traceId}`],
      ["tests", String(c.tests)],
      ["failures", String(c.failed)],
      ["errors", String(c.cancelled)],
      ["skipped", String(c.skipped + c.todo)],
      ["time", seconds(run.start, run.end)],
    ]),
  );
}

// ---------------------------------------------------------------------------------------------------------------------------- CTRF (FR-008)

function ctrfStatus(o: Outcome): string {
  switch (o) {
    case "pass":
      return "passed";
    case "fail":
      return "failed";
    case "skip":
      return "skipped";
    case "todo":
      return "pending";
    case "cancelled":
      return "other";
    default:
      return absurd(o);
  }
}

/** The run as CTRF JSON (FR-008): `results.tool`, `summary` and `tests`, with the requirements, risk, id and outcome under `extra`. */
export function ctrfJson(run: TestRun): string {
  const c = run.counts;
  const tests = run.tests.map((t) => ({
    name: t.name,
    status: ctrfStatus(t.outcome),
    duration: milliseconds(t.start, t.end),
    start: Number(t.start / 1_000_000n),
    stop: Number(t.end / 1_000_000n),
    ...(t.message === undefined ? {} : { message: t.message }),
    ...(t.outcome === "fail" || t.outcome === "cancelled" ? { trace: failureText(t) } : {}),
    filePath: t.file,
    suite: `${t.file} [${t.runtime}]`,
    retries: t.attempt - 1,
    extra: {
      id: t.id,
      requirements: [...t.requirements],
      risk: t.risk,
      outcome: t.outcome,
      runtime: t.runtime,
      ...(t.reason === undefined ? {} : { reason: t.reason }),
      ...(t.expected === undefined ? {} : { expected: t.expected }),
      ...(t.actual === undefined ? {} : { actual: t.actual }),
    },
  }));
  const doc = {
    reportFormat: "CTRF",
    specVersion: "0.0.0",
    results: {
      tool: { name: "ifc test" },
      summary: {
        tests: c.tests,
        passed: c.passed,
        failed: c.failed,
        skipped: c.skipped,
        pending: c.todo,
        other: c.cancelled,
        start: Number(run.start / 1_000_000n),
        stop: Number(run.end / 1_000_000n),
      },
      tests,
      environment: {
        osPlatform: run.runner.os,
        ...(run.runner.revision === undefined ? {} : { commit: run.runner.revision }),
        extra: {
          traceId: run.traceId,
          status: run.status,
          role: run.runner.role,
          runtimes: run.installations.map((i) => `${i.runtime} ${i.runtimeVersion}`),
        },
      },
      extra: { cancelled: c.cancelled, todo: c.todo, unproven: [...run.unproven], failures: [...run.failures] },
    },
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}

// ---------------------------------------------------------------------------------------------------------------------------- SARIF (FR-008)

/** The rule of a failed test that proves no requirement. */
export const NO_REQUIREMENT_RULE = "ifc.test.no-requirement";

/** The run as SARIF 2.1.0 (FR-008): each failed or cancelled test a result at its file, its first requirement as its rule; the counts as the run's properties. */
export function sarif(run: TestRun): string {
  const failed = run.tests.filter((t) => t.outcome === "fail" || t.outcome === "cancelled");
  const ruleOf = (t: RunTest): string => t.requirements[0] ?? NO_REQUIREMENT_RULE;
  const rules = [...new Set(failed.map(ruleOf))].sort(byText);
  const doc = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "ifc test",
            rules: rules.map((id) => ({
              id,
              shortDescription: { text: id === NO_REQUIREMENT_RULE ? "A test that proves no requirement" : `Requirement ${id}` },
            })),
          },
        },
        invocations: [{ executionSuccessful: run.status === "success" }],
        results: failed.map((t) => ({
          ruleId: ruleOf(t),
          ruleIndex: rules.indexOf(ruleOf(t)),
          level: "error",
          message: {
            text: oneLine(
              `${t.name}: ${t.outcome === "cancelled" ? `cancelled (${t.reason ?? "it did not end"})` : (t.message ?? "failed")}`,
            ),
          },
          locations: [{ physicalLocation: { artifactLocation: { uri: t.file, uriBaseId: "%SRCROOT%" } } }],
          partialFingerprints: { "ifcTestId/v1": t.id },
          properties: { requirements: [...t.requirements], outcome: t.outcome, runtime: t.runtime, risk: t.risk, attempt: t.attempt },
        })),
        properties: { traceId: run.traceId, status: run.status, ...run.counts, unproven: [...run.unproven] },
      },
    ],
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}

// ---------------------------------------------------------------------------------------------------------------------------- OSCAL (FR-008)

/** The URI the UUIDs and properties of a test run's OSCAL document are named in. */
export const OSCAL_NAMESPACE_URI = "https://github.com/intellectual-frontiers/.github/tree/main/commons/spec-kit/specs/0008-test-evidence";

/** A requirement as a catalog control: its specification and its number (`0008-test-evidence FR-001`). */
export function requirementRef(id: string): ControlRef {
  const sp = id.lastIndexOf(" ");
  return sp < 0 ? { catalog: "requirements", id } : { catalog: id.slice(0, sp), id: id.slice(sp + 1) };
}

/** A requirement as an OSCAL token: `req-` and its words in lower case joined by `-`. */
export function oscalControlId(r: ControlRef): string {
  return `req-${`${r.catalog}-${r.id}`.toLowerCase().replace(/[^a-z0-9._-]+/g, "-")}`;
}

function oscalStatus(o: Outcome): Status {
  switch (o) {
    case "pass":
      return "pass";
    case "fail":
      return "fail";
    case "cancelled":
      return "error";
    case "skip":
    case "todo":
      return "not-applicable";
    default:
      return absurd(o);
  }
}

/**
 * The run as OSCAL 1.1.2 assessment results (FR-008, 0007-grc FR-017): one observation per test (its control the test, its subject the
 * runtime it ran on) and one finding per requirement, satisfied or not by the outcomes of the tests that prove it.
 */
export async function oscalAssessmentResults(
  run: TestRun,
  options: { readonly version?: string; readonly organization?: string } = {},
): Promise<string> {
  const at: Instant = instantFromEpochMs(Number(run.start / 1_000_000n)) ?? (isoTime(0n) as Instant); // isoTime gives a canonical Instant's text
  const severity = (r: Risk): Severity => (r === "high" ? "high" : "low");
  const testControl = (t: RunTest): ControlSummary => ({
    id: `test-${t.id}`,
    title: t.name,
    description: `${t.file}: ${t.name}`,
    implements: t.requirements.map(requirementRef),
    severity: severity(t.risk),
    cadence: "each run",
  });
  const requirementControls: ControlSummary[] = run.requirements.map((r) => ({
    id: `requirement ${r.id}`,
    title: r.id,
    description: r.reviews.length > 0 ? `reviewed: ${r.reviews.join("; ")}` : `${r.id}: ${r.state}`,
    implements: [requirementRef(r.id)],
    severity: severity(r.risk),
    cadence: "each run",
  }));
  const runtimeLabel = (runtime: string): string => {
    const version = run.installations.find((i) => i.runtime === runtime)?.runtimeVersion;
    return version === undefined ? runtime : `${runtime} ${version}`;
  };
  const findings: Finding[] = run.tests.map((t) => {
    const status = oscalStatus(t.outcome);
    return {
      control: testControl(t),
      subject: { kind: "runtime", id: runtimeLabel(t.runtime) },
      status,
      outcome: status,
      severity: severity(t.risk),
      title: `${t.outcome}: ${t.name}`,
      detail: t.message ?? t.reason ?? `${t.name}: ${t.outcome}`,
      evidence: [],
      at: instantFromEpochMs(Number(t.end / 1_000_000n)) ?? at,
    };
  });
  const namespace = await uuidV5(NAMESPACE_URL, OSCAL_NAMESPACE_URI);
  const doc = await assessmentResults(
    {
      pack: { id: `ifc-test-${run.traceId}`, title: `Test run ${run.traceId}` },
      at,
      controls: [...requirementControls, ...findings.map((f) => f.control)],
      subjects: [],
      findings,
    },
    {
      namespace,
      lastModified: instantFromEpochMs(Number(run.end / 1_000_000n)) ?? at,
      version: options.version ?? "1",
      propNamespace: OSCAL_NAMESPACE_URI,
      title: `Test run ${run.traceId}: assessment results`,
      controlId: oscalControlId,
      ...(options.organization === undefined ? {} : { organization: options.organization }),
    },
  );
  return renderOscal(doc);
}

// ---------------------------------------------------------------------------------------------------------------------------- evidence (FR-011 to FR-013)

/** The meaning of a signature on a run (FR-011). */
export type Meaning = "executed" | "reviewed" | "approved";

/** Every meaning. */
export const MEANINGS: readonly Meaning[] = ["executed", "reviewed", "approved"];

/** Whether a text is a meaning. */
export function isMeaning(text: string): text is Meaning {
  return (MEANINGS as readonly string[]).includes(text);
}

/** The ledger kind of a run's record. */
export const RUN_KIND = "test-run";

/** The ledger kind of a signature on a run: `test-signature:<meaning>:<role>`. */
export function signatureKind(meaning: Meaning, role: string): string {
  return `test-signature:${meaning}:${role}`;
}

/** The ledger entry of a run (FR-011): kind `test-run`, the run's trace id as its subject and the record's digest as its evidence. */
export function runEntry(traceId: string, digest: Sha256, at: Instant): LedgerRecord {
  return { at, kind: RUN_KIND, subject: { kind: "test-run", id: traceId }, evidence: digest };
}

/** The ledger entry of a signature (FR-011): its meaning and role in its kind, the record's digest as its subject, the envelope's digest as its evidence. */
export function signatureEntry(meaning: Meaning, role: string, recordDigest: Sha256, envelopeDigest: Sha256, at: Instant): LedgerRecord {
  return { at, kind: signatureKind(meaning, role), subject: { kind: "test-record", id: recordDigest }, evidence: envelopeDigest };
}

/** A signature on a run as the ledger holds it. */
export type SignatureOnRun = {
  readonly seq: number;
  readonly meaning: Meaning;
  readonly role: string;
  readonly at: string;
  readonly envelope: string;
};

/** The signatures the ledger holds on the record of a digest, in the ledger's order. */
export function signaturesOf(ledger: readonly LedgerEntry[], recordDigest: string): readonly SignatureOnRun[] {
  return ledger.flatMap((e) => {
    const m = /^test-signature:([a-z]+):(.+)$/.exec(e.kind);
    const meaning = m?.[1] ?? "";
    if (m === null || !isMeaning(meaning) || e.subject.kind !== "test-record" || e.subject.id !== recordDigest) return [];
    return [{ seq: e.seq, meaning, role: m[2] ?? "", at: e.at, envelope: e.evidence }];
  });
}

/** The predicate type of an in-toto Test Result. */
export const TEST_RESULT_PREDICATE = "https://in-toto.io/attestation/test-result/v0.1";

/** An in-toto Test Result predicate (v0.1). */
export type TestResultPredicate = {
  readonly result: "PASSED" | "WARNED" | "FAILED";
  readonly configuration: readonly ResourceDescriptor[];
  readonly url?: string;
  readonly passedTests: readonly string[];
  readonly warnedTests: readonly string[];
  readonly failedTests: readonly string[];
};

const testLabel = (t: RunTest): string => `${t.runtime} ${t.file}: ${t.name}`;

/**
 * The in-toto Statement v1 of a run (FR-011): its subject the record (`name`, the SHA-256 of its bytes), its predicate the Test Result:
 * `FAILED` where the run failed, `WARNED` where it passed with tests skipped or todo, else `PASSED`; the configuration the record and the
 * lockfile and pins it names.
 */
export function testResultStatement(
  run: TestRun,
  record: { readonly name: string; readonly digest: Sha256; readonly url?: string },
): Statement<TestResultPredicate> {
  const warned = run.tests.filter((t) => t.outcome === "skip" || t.outcome === "todo");
  const configuration: ResourceDescriptor[] = [{ name: record.name, digest: { sha256: record.digest } }];
  for (const i of [run.runner, ...run.installations]) {
    if (i.lockfileSha256 !== undefined && !configuration.some((c) => c.digest["sha256"] === i.lockfileSha256))
      configuration.push({ name: "lockfile", digest: { sha256: i.lockfileSha256 } });
    if (i.pinsSha256 !== undefined && !configuration.some((c) => c.digest["sha256"] === i.pinsSha256))
      configuration.push({ name: "pins", digest: { sha256: i.pinsSha256 } });
  }
  return statement([{ name: record.name, digest: { sha256: record.digest } }], TEST_RESULT_PREDICATE, {
    result: run.status === "failure" ? "FAILED" : warned.length > 0 ? "WARNED" : "PASSED",
    configuration,
    ...(record.url === undefined ? {} : { url: record.url }),
    passedTests: run.tests.filter((t) => t.outcome === "pass").map(testLabel),
    warnedTests: warned.map(testLabel),
    failedTests: run.tests.filter((t) => t.outcome === "fail" || t.outcome === "cancelled").map(testLabel),
  });
}

/** Why `ifc test verify` refused a record (FR-012, FR-013). */
export type VerifyProblem =
  | { readonly kind: "not-in-ledger"; readonly digest: string }
  | { readonly kind: "ledger-broken"; readonly break: LedgerBreak }
  | { readonly kind: "envelope"; readonly name: string; readonly reason: string }
  | { readonly kind: "envelope-subject"; readonly name: string; readonly digest: string }
  | { readonly kind: "no-key" }
  | { readonly kind: "review-missing"; readonly digest: string };

/** A verification problem as one sentence. */
export function formatVerifyProblem(p: VerifyProblem): string {
  switch (p.kind) {
    case "not-in-ledger":
      return `the record's digest ${p.digest} is not in the ledger as a test run`;
    case "ledger-broken":
      return `the ledger's chain is broken: ${formatLedgerBreak(p.break)}`;
    case "envelope":
      return `the envelope ${p.name} does not verify: ${p.reason}`;
    case "envelope-subject":
      return `the envelope ${p.name} does not name the record's digest ${p.digest}`;
    case "no-key":
      return "envelopes were given without a key to verify them with";
    case "review-missing":
      return `no signature of meaning reviewed is in the ledger for the record ${p.digest}`;
    default:
      return absurd(p);
  }
}

/** What verification found where nothing is wrong: the ledger's head and the signatures on the record. */
export type Verification = { readonly seq: number; readonly signatures: readonly SignatureOnRun[] };

/**
 * A record's evidence checked (FR-012, FR-013): its digest is in the ledger as a `test-run`, the ledger's chain is whole, each envelope
 * given verifies with the keys given and names the digest, and, with `requireReview`, the ledger holds a signature of meaning `reviewed`
 * on it (one of the envelopes given, where any are). Every problem is named, not only the first.
 */
export async function verifyEvidence(input: {
  readonly recordDigest: Sha256;
  readonly ledger: readonly LedgerEntry[];
  readonly envelopes?: readonly { readonly name: string; readonly envelope: DsseEnvelope; readonly digest: Sha256 }[];
  readonly keys?: readonly DsseKey[];
  readonly requireReview?: boolean;
}): Promise<Result<Verification, readonly VerifyProblem[]>> {
  const problems: VerifyProblem[] = [];
  const chain = await verifyLedger(input.ledger);
  if (chain.kind === "err") problems.push({ kind: "ledger-broken", break: chain.error });
  if (!input.ledger.some((e) => e.kind === RUN_KIND && e.evidence === input.recordDigest))
    problems.push({ kind: "not-in-ledger", digest: input.recordDigest });
  const envelopes = input.envelopes ?? [];
  const keys = input.keys ?? [];
  const verified = new Set<string>();
  if (envelopes.length > 0 && keys.length === 0) problems.push({ kind: "no-key" });
  else {
    for (const e of envelopes) {
      const s = await verifyStatement(e.envelope, keys, unknownValue);
      if (s.kind === "err") {
        problems.push({
          kind: "envelope",
          name: e.name,
          reason: s.error.kind === "statement" ? formatDecodeError(s.error.error) : s.error.kind,
        });
        continue;
      }
      if (s.value.predicateType !== TEST_RESULT_PREDICATE || !s.value.subject.some((d) => d.digest["sha256"] === input.recordDigest)) {
        problems.push({ kind: "envelope-subject", name: e.name, digest: input.recordDigest });
        continue;
      }
      verified.add(e.digest);
    }
  }
  const signatures = signaturesOf(input.ledger, input.recordDigest);
  if (input.requireReview === true) {
    const reviews = signatures.filter((s) => s.meaning === "reviewed" && (envelopes.length === 0 || verified.has(s.envelope)));
    if (reviews.length === 0) problems.push({ kind: "review-missing", digest: input.recordDigest });
  }
  return problems.length === 0 ? ok({ seq: chain.kind === "ok" ? chain.value.seq : 0, signatures }) : err(problems);
}

// ---------------------------------------------------------------------------------------------------------------------------- completion report (FR-009)

type Block =
  | { readonly kind: "para"; readonly text: string }
  | { readonly kind: "list"; readonly items: readonly string[] }
  | { readonly kind: "table"; readonly head: readonly string[]; readonly rows: readonly (readonly string[])[] };

type Section = { readonly title: string; readonly blocks: readonly Block[] };

/** What a completion report adds to the record: the record's digest and the signatures the ledger holds on it. */
export type CompletionOptions = { readonly digest?: string; readonly signatures?: readonly SignatureOnRun[] };

function stateWords(r: RequirementTrace): string {
  switch (r.state) {
    case "proven":
      return "proven";
    case "failing":
      return "failing";
    case "skipped":
      return r.required ? "unproven (its tests were skipped)" : "skipped";
    case "reviewed":
      return `reviewed: ${r.reviews.join("; ")}`;
    case "unproven":
      return r.required ? "unproven" : "not proven";
    default:
      return absurd(r.state);
  }
}

function completion(run: TestRun, o: CompletionOptions): { readonly title: string; readonly sections: readonly Section[] } {
  const c = run.counts;
  const signatures = o.signatures ?? [];
  const reviewed = signatures.some((s) => s.meaning === "reviewed");
  const high = run.requirements.filter((r) => r.risk === "high");
  const incidents = run.tests.filter((t) => t.outcome !== "pass");
  const verdict = run.status === "success" ? "PASSED" : "FAILED";
  const facts = [
    `Run ${run.traceId}${o.digest === undefined ? "" : `, record SHA-256 ${o.digest}`}.`,
    `Started ${isoTime(run.start)}, ended ${isoTime(run.end)} (${seconds(run.start, run.end)} s).`,
    `Runners: ${run.runners.length === 0 ? "none" : run.runners.map((r) => (r.kind === "exited" ? `${r.runtime} exited with ${r.code}` : `${r.runtime} not installed`)).join("; ")}.`,
  ];
  const sections: Section[] = [
    {
      title: "Summary",
      blocks: [
        { kind: "para", text: `Result: ${verdict}.` },
        {
          kind: "table",
          head: ["tests", "passed", "failed", "skipped", "todo", "cancelled"],
          rows: [[c.tests, c.passed, c.failed, c.skipped, c.todo, c.cancelled].map(String)],
        },
        { kind: "list", items: facts },
        ...(run.failures.length === 0 ? [] : [{ kind: "list" as const, items: run.failures.map((f) => `Failed: ${f}.`) }]),
        ...(run.warnings.length === 0 ? [] : [{ kind: "list" as const, items: run.warnings.map((w) => `Warning: ${w}.`) }]),
      ],
    },
    {
      title: "Installation record",
      blocks: [
        {
          kind: "table",
          head: ["", "runtime", "version", "os", "arch", "revision", "lockfile SHA-256", "pins SHA-256", "role"],
          rows: [["runner", run.runner] as const, ...run.installations.map((i) => ["tests", i] as const)].map(([what, i]) => [
            what,
            i.runtime,
            i.runtimeVersion,
            i.os,
            i.arch,
            i.revision ?? "-",
            i.lockfileSha256 ?? "-",
            i.pinsSha256 ?? "-",
            i.role,
          ]),
        },
      ],
    },
    {
      title: "Requirement trace matrix",
      blocks:
        run.requirements.length === 0
          ? [{ kind: "para", text: "No requirement is named by a test, a review or the list." }]
          : [
              {
                kind: "table",
                head: ["requirement", "listed", "risk", "state", "tests"],
                rows: run.requirements.map((r) => [
                  r.id,
                  r.required ? "yes" : "no",
                  r.risk,
                  stateWords(r),
                  r.tests.length === 0 ? "-" : r.tests.map((t) => `${t.outcome}: ${t.name} [${t.runtime}]`).join("; "),
                ]),
              },
            ],
    },
    {
      title: "Incidents",
      blocks:
        incidents.length === 0
          ? [{ kind: "para", text: "None: every test passed." }]
          : [
              {
                kind: "table",
                head: ["outcome", "test", "file", "runtime", "detail"],
                rows: incidents.map((t) => [
                  t.outcome,
                  t.name,
                  t.file,
                  t.runtime,
                  [
                    t.message,
                    t.expected === undefined ? undefined : `expected ${t.expected}`,
                    t.actual === undefined ? undefined : `actual ${t.actual}`,
                    t.reason,
                  ]
                    .filter((x): x is string => x !== undefined)
                    .join("; ") || "-",
                ]),
              },
            ],
    },
    {
      title: "High-risk requirements",
      blocks:
        high.length === 0
          ? [{ kind: "para", text: "None: no test of the run is of high risk." }]
          : [
              {
                kind: "para",
                text: "Each requirement whose tests are of high risk needs a signed review (a signature of meaning reviewed on this record).",
              },
              {
                kind: "table",
                head: ["requirement", "state", "signed review"],
                rows: high.map((r) => [r.id, stateWords(r), reviewed ? "yes" : "needed"]),
              },
            ],
    },
    {
      title: "Conclusion",
      blocks: [
        {
          kind: "para",
          text:
            run.status === "success"
              ? `The run passed: every test that ran passed and every requirement listed is proven or reviewed.${high.length > 0 && !reviewed ? ` ${high.length} high-risk requirement${high.length === 1 ? " needs" : "s need"} a signed review.` : ""}`
              : `The run failed: ${run.failures.join("; ")}.`,
        },
      ],
    },
    {
      title: "Signatures",
      blocks:
        signatures.length === 0
          ? [{ kind: "para", text: "None in the ledger for this record." }]
          : [
              {
                kind: "table",
                head: ["meaning", "role", "at", "envelope SHA-256"],
                rows: signatures.map((s) => [s.meaning, s.role, s.at, s.envelope]),
              },
            ],
    },
  ];
  return { title: `Test completion report: ${verdict}`, sections };
}

function mdCell(s: string): string {
  return oneLine(s).replaceAll("\\", "\\\\").replaceAll("|", "\\|") || " ";
}

/** The test completion report in Markdown (FR-009). */
export function completionMarkdown(run: TestRun, options: CompletionOptions = {}): string {
  const doc = completion(run, options);
  let out = `# ${doc.title}\n`;
  for (const s of doc.sections) {
    out += `\n## ${s.title}\n`;
    for (const b of s.blocks) {
      switch (b.kind) {
        case "para":
          out += `\n${oneLine(b.text)}\n`;
          break;
        case "list":
          out += `\n${b.items.map((i) => `- ${oneLine(i)}`).join("\n")}\n`;
          break;
        case "table":
          out += `\n| ${b.head.map(mdCell).join(" | ")} |\n|${b.head.map(() => " --- |").join("")}\n${b.rows.map((r) => `| ${r.map(mdCell).join(" | ")} |`).join("\n")}\n`;
          break;
        default:
          absurd(b);
      }
    }
  }
  return out;
}

function html(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

const STYLE =
  "body{font:15px/1.5 system-ui,sans-serif;margin:2rem auto;max-width:72rem;padding:0 1rem;color:#1b1b1b;background:#fff}" +
  "table{border-collapse:collapse;margin:.5rem 0;width:100%}th,td{border:1px solid #c8c8c8;padding:.25rem .5rem;text-align:left;vertical-align:top;overflow-wrap:anywhere}" +
  "th{background:#f0f0f0}h1{font-size:1.6rem}h2{font-size:1.2rem;margin-top:2rem}" +
  "@media (prefers-color-scheme:dark){body{color:#e8e8e8;background:#161616}th{background:#2a2a2a}th,td{border-color:#444}}";

/** The test completion report as one HTML document that needs nothing outside itself (FR-009). */
export function completionHtml(run: TestRun, options: CompletionOptions = {}): string {
  const doc = completion(run, options);
  let body = `<h1>${html(doc.title)}</h1>\n`;
  for (const s of doc.sections) {
    body += `<section>\n<h2>${html(s.title)}</h2>\n`;
    for (const b of s.blocks) {
      switch (b.kind) {
        case "para":
          body += `<p>${html(b.text)}</p>\n`;
          break;
        case "list":
          body += `<ul>\n${b.items.map((i) => `<li>${html(i)}</li>`).join("\n")}\n</ul>\n`;
          break;
        case "table":
          body += `<table>\n<thead><tr>${b.head.map((h) => `<th>${html(h)}</th>`).join("")}</tr></thead>\n<tbody>\n${b.rows.map((r) => `<tr>${r.map((d) => `<td>${html(d)}</td>`).join("")}</tr>`).join("\n")}\n</tbody>\n</table>\n`;
          break;
        default:
          absurd(b);
      }
    }
    body += "</section>\n";
  }
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${html(doc.title)}</title>\n<style>${STYLE}</style>\n</head>\n<body>\n${body}</body>\n</html>\n`;
}

/** Parses a trace id and a span id (for a runner that holds them as text). */
export function runIds(traceId: string, spanId: string): Result<{ readonly traceId: TraceId; readonly spanId: SpanId }, string> {
  const t = parseTraceId(traceId);
  if (t.kind === "err") return t;
  const s = parseSpanId(spanId);
  if (s.kind === "err") return s;
  return ok({ traceId: t.value, spanId: s.value });
}
