/**
 * Test evidence (commons 0008-test-evidence): the record of a test run as OpenTelemetry and every report rendered from it, purely.
 *
 * - Capture (FR-001 to FR-004) is `./test-record.ts`: the model of a test case and an installation, and the signals a test process writes.
 * - The run (FR-005 to FR-007): the exit rule (`judge`), the run's `test run` span and the one OTLP JSON document of a run
 *   (`assembleRecord`), read back only through the OTLP decoders of 0006-signals FR-004 into a typed model (`readRecord`). The requirement
 *   lists a run is held to: ids one per line, or a spec-kit enforcement register's rows of mechanism `check` (`parseRequirementList`), and
 *   requirements declared reviewed (`parseReviewList`).
 * - Reports (FR-008 to FR-010): TAP version 14, JUnit XML, CTRF JSON, SARIF 2.1.0, OSCAL 1.2.3 assessment results and a completion report
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
import { formatDecodeError, unknownValue } from "./decode.ts";
import { type DsseEnvelope, type DsseKey, type ResourceDescriptor, type Statement, statement, verifyStatement } from "./dsse.ts";
import { formatLedgerBreak, type LedgerBreak, type LedgerEntry, type LedgerRecord, verifyLedger } from "./evidence.ts";
import { type ControlRef, type ControlSummary, type Finding, type Instant, instantFromEpochMs, type Severity, type Status } from "./grc.ts";
import type { Json, JsonObject } from "./json5.ts";
import { assessmentResults, renderOscal } from "./oscal.ts";
import { type LogRecord, parseSpanId, parseTraceId, type SpanData, type SpanId, type TraceId } from "./otel.ts";
import { encodeLogs, encodeTraces } from "./otlp.ts";
import { err, ok, type Result } from "./result.ts";
import type { Sha256 } from "./sha256.ts";
import { NAMESPACE_URL, uuidV5 } from "./uuid.ts";
import { el, type XmlChild, type XmlElement, writeXml } from "./xml.ts";
import {
  attributeInteger,
  attributeText,
  attributeTexts,
  closeOrphans,
  decodeRecordDocument,
  EVENTS,
  type Installation,
  installationOf,
  installationResource,
  isOutcome,
  isPersonAttribute,
  isRisk,
  mergeBatches,
  OUTCOMES,
  type Outcome,
  type RecordError,
  type Review,
  reviewLog,
  type Risk,
  type RunnerOutcome,
  runnerLog,
  RUN_SPAN,
  type Signals,
  STEP_SPAN,
  isStepOutcome,
  type TestCase,
  type TestStep,
  TEST_SCOPE,
  TEST_SPAN,
  warningLog,
} from "./test-record.ts";
import { toYaml } from "./yaml.ts";

// ---------------------------------------------------------------------------------------------------------------------------- the model

/** A test of a run: the case, the runtime it ran on (its process's `process.runtime.name`) and the id of its span. */
export type RunTest = TestCase & { readonly runtime: string; readonly spanId: string };

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

// ---------------------------------------------------------------------------------------------------------------------------- the run (FR-005, FR-006)

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function testOf(s: SpanData, runtime: string): Result<RunTest, RecordError> {
  const a = s.attributes;
  const no = (reason: string): Result<never, RecordError> => err({ kind: "test", spanId: s.context.spanId, reason });
  const id = attributeText(a, "ifc.test.id");
  const name = attributeText(a, "test.case.name");
  const file = attributeText(a, "test.suite.name");
  const outcome = attributeText(a, "ifc.test.outcome") ?? "";
  const risk = attributeText(a, "ifc.test.risk") ?? "";
  if (id === undefined) return no("it has no ifc.test.id");
  if (name === undefined) return no("it has no test.case.name");
  if (file === undefined) return no("it has no test.suite.name");
  if (!isOutcome(outcome)) return no(`its outcome ${JSON.stringify(outcome)} is not one of ${OUTCOMES.join(", ")}`);
  if (!isRisk(risk)) return no(`its risk ${JSON.stringify(risk)} is not high or not-high`);
  const reason = attributeText(a, "ifc.test.reason");
  const message = attributeText(a, "ifc.test.message");
  const expected = attributeText(a, "ifc.test.expected");
  const actual = attributeText(a, "ifc.test.actual");
  return ok({
    id,
    file,
    name,
    requirements: attributeTexts(a, "ifc.test.requirements"),
    risk,
    start: s.startTime,
    end: s.endTime,
    outcome,
    ...(reason === undefined ? {} : { reason }),
    ...(message === undefined ? {} : { message }),
    ...(expected === undefined ? {} : { expected }),
    ...(actual === undefined ? {} : { actual }),
    attempt: attributeInteger(a, "ifc.test.attempt") ?? 1,
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

/** The steps whose span's parent is `parent`, each with its own, in the order they ended (0005-typescript-runtime FR-060). */
function stepsUnder(parent: string, children: ReadonlyMap<string, readonly SpanData[]>): readonly TestStep[] {
  return (children.get(parent) ?? [])
    .flatMap((s): TestStep[] => {
      const name = attributeText(s.attributes, "ifc.test.step.name");
      const outcome = attributeText(s.attributes, "ifc.test.outcome") ?? "";
      if (name === undefined || !isStepOutcome(outcome)) return [];
      const message = attributeText(s.attributes, "ifc.test.message");
      const inner = stepsUnder(s.context.spanId, children);
      return [
        {
          name,
          start: s.startTime,
          end: s.endTime,
          outcome,
          ...(message === undefined ? {} : { message }),
          ...(inner.length === 0 ? {} : { steps: inner }),
        },
      ];
    })
    .sort((a, b) => (a.end < b.end ? -1 : a.end > b.end ? 1 : 0));
}

/** The tests of some signals, in a stable order, each with its steps (the `test step` spans under its span). */
export function testsOf(signals: Signals): Result<readonly RunTest[], RecordError> {
  const tests: RunTest[] = [];
  const children = new Map<string, SpanData[]>();
  for (const b of signals.traces) {
    for (const s of b.spans) {
      if (s.name !== STEP_SPAN || s.parentSpanId === undefined) continue;
      const at = children.get(s.parentSpanId) ?? [];
      at.push(s);
      children.set(s.parentSpanId, at);
    }
  }
  for (const b of signals.traces) {
    const runtime = attributeText(b.resource.attributes, "process.runtime.name") ?? "unknown";
    for (const s of b.spans) {
      if (s.name !== TEST_SPAN) continue;
      const t = testOf(s, runtime);
      if (t.kind === "err") return t;
      const steps = stepsUnder(s.context.spanId, children);
      tests.push(steps.length === 0 ? t.value : { ...t.value, steps });
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
      const requirement = attributeText(r.attributes, "ifc.test.requirement");
      const reason = attributeText(r.attributes, "ifc.test.reason");
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
  const d = decodeRecordDocument(value, 1);
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
  const status = attributeText(run.s.attributes, "test.suite.run.status");
  if (status !== "success" && status !== "failure")
    return err({ kind: "no-run", reason: "its span has no test.suite.run.status of success or failure" });
  const tests = testsOf(signals);
  if (tests.kind === "err") return tests;
  const reviews = reviewsOf(signals);
  const required = attributeTexts(run.s.attributes, "ifc.test.required");
  const runners: RunnerOutcome[] = [];
  const warnings: string[] = [];
  for (const b of signals.logs) {
    for (const r of b.records) {
      if (r.eventName === EVENTS.runner) {
        const runtime = attributeText(r.attributes, "process.runtime.name") ?? "unknown";
        const code = attributeInteger(r.attributes, "process.exit.code");
        runners.push(
          r.attributes["ifc.test.runner.found"] === false || code === undefined
            ? { kind: "missing", runtime }
            : { kind: "exited", runtime, code },
        );
      } else if (r.eventName === EVENTS.warning) {
        warnings.push(attributeText(r.attributes, "ifc.test.warning") ?? "");
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
    failures: attributeTexts(run.s.attributes, "ifc.test.failures"),
    unproven: attributeTexts(run.s.attributes, "ifc.test.unproven"),
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

/** A test's steps as a TAP subtest at `indent`, before the test's own line (0005-typescript-runtime FR-060). */
function tapSteps(steps: readonly TestStep[], indent: string, title: string): string {
  let out = `${indent}# Subtest: ${tapDescription(title)}\n${indent}1..${steps.length}\n`;
  for (const [i, s] of steps.entries()) {
    if (s.steps !== undefined && s.steps.length > 0) out += tapSteps(s.steps, `${indent}    `, s.name);
    const name = tapDescription(s.name);
    switch (s.outcome) {
      case "pass":
        out += `${indent}ok ${i + 1} - ${name}\n`;
        break;
      case "skip":
        out += `${indent}ok ${i + 1} - ${name} # SKIP\n`;
        break;
      case "fail":
        out += `${indent}not ok ${i + 1} - ${name}${s.message === undefined ? "" : ` # ${tapDescription(s.message)}`}\n`;
        break;
      default:
        absurd(s.outcome);
    }
  }
  return out;
}

/**
 * The run as TAP version 14 (FR-008): a plan, one subtest per runtime and file, each test `ok` or `not ok` numbered, `# SKIP` and
 * `# TODO` with their reasons, and a YAML diagnostic block for a failure or a cancellation; the counts as closing comments. A test's
 * steps are a subtest of their own before its line (0005-typescript-runtime FR-060).
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
      if (t.steps !== undefined && t.steps.length > 0) out += tapSteps(t.steps, "        ", t.name);
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

/** Each step of a test as `<outcome> <path>`, for JUnit's properties, which nest no test case (0005-typescript-runtime FR-060). */
function stepLines(steps: readonly TestStep[], within: readonly string[] = []): string[] {
  return steps.flatMap((s) => [...stepLines(s.steps ?? [], [...within, s.name]), `${s.outcome} ${[...within, s.name].join(" > ")}`]);
}

/**
 * The run as JUnit XML (FR-008): one `testsuite` per file and runtime with the installation as `properties`, a `testcase` with its
 * `classname` (the file) and its time in seconds, the requirements, risk, id and steps (`step`, as `pass outer > inner`) as its
 * `properties`, and `failure`, `error` (cancelled) or `skipped` (skip and todo).
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
        ...stepLines(t.steps ?? []).map((l) => prop("step", l)),
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
 * The run as OSCAL 1.2.3 assessment results (FR-008, 0007-grc FR-017): one observation per test (its control the test, its subject the
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
