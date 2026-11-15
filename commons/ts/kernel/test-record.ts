/**
 * The capture half of test evidence (commons 0008-test-evidence FR-001 to FR-004), kept apart from the reports so that every test process
 * loads only this: the model of a test case and of an installation, a test case as its `test` span and log record with the `test.*`
 * conventions and the `ifc.test.*` attributes (`testCaseSpan`, `testCaseLog`), the mark a test leaves as it starts (`testStartLog`), so
 * that one that never ends is closed as `cancelled` (`closeOrphans`), the installation record as a resource (`installationFromEnv`,
 * which refuses a role that names a person, and `isPersonAttribute`), and the OTLP JSON lines a test process appends to
 * `IFC_TEST_RECORD` (`recordLine`, `decodeLines`). `./test-report.ts` reads a run's record and renders it.
 *
 * @example
 * ```ts
 * import { installationFromEnv, installationResource, recordLine, testCaseSpan } from "./test-record.ts";
 * const { installation } = installationFromEnv({ runtime: "node", runtimeVersion: "26.0.0", os: "linux", arch: "x86_64" }, { CI: "true" });
 * // recordLine(installationResource(installation), { spans: [testCaseSpan(test, context)] }) is one line of IFC_TEST_RECORD
 * ```
 *
 * @module
 */
import { absurd } from "./absurd.ts";
import { type DecodeError, formatDecodeError } from "./decode.ts";
import { roleOf } from "./grc.ts";
import {
  type AttributeValue,
  type Attributes,
  type LogRecord,
  parseSpanId,
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

/** An attribute's value where it is a string. */
export function attributeText(a: Attributes, key: string): string | undefined {
  const v = a[key];
  return typeof v === "string" ? v : undefined;
}

/** An attribute's value where it is an array of strings, else none. */
export function attributeTexts(a: Attributes, key: string): readonly string[] {
  const v = a[key];
  return Array.isArray(v) && v.every((e): e is string => typeof e === "string") ? v : [];
}

/** An attribute's value where it is an integer. */
export function attributeInteger(a: Attributes, key: string): number | undefined {
  const v = a[key];
  if (typeof v === "bigint") return Number(v);
  return typeof v === "number" && Number.isInteger(v) ? v : undefined;
}

/** The installation record a resource holds; unknown fields are `unknown`. */
export function installationOf(r: Resource): Installation {
  const a = r.attributes;
  const revision = attributeText(a, "vcs.ref.head.revision");
  const lockfileSha256 = attributeText(a, "ifc.test.lockfile.sha256");
  const pinsSha256 = attributeText(a, "ifc.test.pins.sha256");
  return {
    runtime: attributeText(a, "process.runtime.name") ?? "unknown",
    runtimeVersion: attributeText(a, "process.runtime.version") ?? "unknown",
    os: attributeText(a, "os.type") ?? "unknown",
    arch: attributeText(a, "host.arch") ?? "unknown",
    ...(revision === undefined ? {} : { revision }),
    ...(lockfileSha256 === undefined ? {} : { lockfileSha256 }),
    ...(pinsSha256 === undefined ? {} : { pinsSha256 }),
    role: attributeText(a, "ifc.test.role") ?? "unknown",
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

/** The traces and logs of one OTLP JSON document (an export request, or a run's record holding both), as line `line`. */
export function decodeRecordDocument(value: unknown, line: number): Result<Signals, RecordError> {
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
    const d = decodeRecordDocument(value, i + 1);
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
      const risk = attributeText(a, "ifc.test.risk") ?? "not-high";
      const parent = attributeText(a, "ifc.test.parent");
      const parentSpanId = parent === undefined ? undefined : parseSpanId(parent);
      const c: TestCase = {
        id: attributeText(a, "ifc.test.id") ?? "",
        file: attributeText(a, "test.suite.name") ?? "",
        name: attributeText(a, "test.case.name") ?? "",
        requirements: attributeTexts(a, "ifc.test.requirements"),
        risk: isRisk(risk) ? risk : "not-high",
        start: r.time,
        end: at > r.time ? at : r.time,
        outcome: "cancelled",
        reason: "its process ended before the test did",
        attempt: attributeInteger(a, "ifc.test.attempt") ?? 1,
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
