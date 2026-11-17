/**
 * The canonical record of a run (commons 0021-ifqs FR-013 to FR-015, FR-020): the record of 0008-test-evidence (one OTLP/JSON document,
 * a `test` span and a log record for each case) extended with what the quality system adds, and read back through the same decoders.
 *
 * - `canonicalize` takes the document a run assembled (`assembleRecord`) and returns the file to keep: the body of each case's log
 *   record is a CTRF test object (FR-013), a case that never started is a log record with the outcome `not_run` and its reason
 *   (FR-005, FR-014), each case carries its grade (FR-006), every resource carries `ifc.quality.previous.sha256` (FR-017), and every
 *   text is redacted and names no person (FR-020).
 * - `readQuality` reads a file back into a `QualityRecord`: the model of 0008 (`TestRun`, five outcomes) and, beside it, every case with
 *   its outcome, `not_run` included, its grade and, for a check's case, its rule and line.
 * - `checkRun` makes the record of a check of Mizan (FR-015): each rule a case, each finding a failed case with its rule id, file and line.
 *
 * @example
 * ```ts
 * import { readQuality } from "./record.ts";
 * // const q = readQuality(await readTextFile("quality/evidence/2026/11/17/4bf92f3577b34da6a3ce929d0e0e4736.otlp.json"));
 * // if (q.kind === "ok") console.log(q.value.counts.notRun, q.value.grade);
 * ```
 *
 * @module
 */
import { absurd } from "../../kernel/absurd.ts";
import type { DecodeError } from "../../kernel/decode.ts";
import { formatDecodeError } from "../../kernel/decode.ts";
import { GENESIS } from "../../kernel/evidence.ts";
import type { JsonObject } from "../../kernel/json5.ts";
import {
  type AnyMap,
  type AnyValue,
  type AttributeValue,
  type Attributes,
  type LogRecord,
  parseSpanId,
  parseTraceId,
  redactAnyValue,
  redactText,
  type Resource,
  SEVERITY,
  type SpanData,
  type SpanId,
  type TraceId,
} from "../../kernel/otel.ts";
import { decodeLogs, decodeTraces, encodeLogs, encodeTraces, type LogBatch, type TraceBatch } from "../../kernel/otlp.ts";
import { err, ok, type Result } from "../../kernel/result.ts";
import { type Sha256, sha256Of } from "../../kernel/sha256.ts";
import {
  assembleRecord,
  type Counts,
  countsOf,
  isoTime,
  readRecord,
  recordText,
  type RunTest,
  type TestRun,
} from "../../kernel/test-report.ts";
import {
  attributeInteger,
  attributeText,
  attributeTexts,
  type Installation,
  mergeBatches,
  type Outcome,
  formatRecordError,
  type RecordError,
  RUN_SPAN,
  type Risk,
  type RunnerOutcome,
  type Signals,
  TEST_SCOPE,
  testCaseLog,
  testCaseSpan,
  testId,
} from "../../kernel/test-record.ts";
import { ATTR, CASE_EVENT, type Grade, isGrade, isQualityOutcome, NO_GRADE, type QualityOutcome, RUN_GRADE } from "./names.ts";

// ---------------------------------------------------------------------------------------------------------------------------- the model

/** One case of a run, whatever became of it: a test of 0008-test-evidence, a case that did not run, or a check's rule or finding. */
export type QualityCase = {
  readonly id: string;
  /** Its file, relative to the working folder, with `/`. */
  readonly file: string;
  readonly name: string;
  readonly requirements: readonly string[];
  readonly risk: Risk;
  readonly characteristic?: string;
  readonly outcome: QualityOutcome;
  /** A skip's, a todo's or a cancellation's reason, and why a case did not run (FR-014). */
  readonly reason?: string;
  readonly message?: string;
  readonly expected?: string;
  readonly actual?: string;
  readonly attempt: number;
  readonly start: bigint;
  readonly end: bigint;
  /** The runtime it ran on; `none` for a case that did not run. */
  readonly runtime: string;
  /** What the case is worth (FR-006, FR-021). */
  readonly grade: Grade;
  /** The rule of a check that the case reports (FR-015). */
  readonly rule?: string;
  /** The line of its file a finding points to (FR-015). */
  readonly line?: number;
};

/** The counts of a run: those of 0008-test-evidence for what ran, and the cases that did not (FR-005). */
export type QualityCounts = Counts & { readonly notRun: number };

/** A run's record as the quality system reads it. */
export type QualityRecord = {
  readonly traceId: string;
  /** The model of 0008-test-evidence over the same file: the cases that ran. */
  readonly run: TestRun;
  /** Every case, in a stable order: what ran as the model orders it, then what did not run by file and name. */
  readonly cases: readonly QualityCase[];
  readonly counts: QualityCounts;
  /** The grade the file claims for itself (FR-006). */
  readonly grade: Grade;
  /** The SHA-256 of the evidence file before this one (FR-017); none where the file is not yet chained. */
  readonly previous?: Sha256;
};

/** Why a record could not be made or read. */
export type QualityError =
  | { readonly kind: "record"; readonly error: RecordError }
  | { readonly kind: "otlp"; readonly error: DecodeError }
  | { readonly kind: "case"; readonly spanId: string; readonly reason: string }
  | { readonly kind: "previous"; readonly reason: string }
  | { readonly kind: "person"; readonly key: string };

/** A quality error as one sentence. */
export function formatQualityError(e: QualityError): string {
  switch (e.kind) {
    case "record":
      return formatRecordError(e.error);
    case "otlp":
      return `the record is not OTLP JSON: ${formatDecodeError(e.error)}`;
    case "case":
      return `the case ${e.spanId} is not a quality case: ${e.reason}`;
    case "previous":
      return `the chain attribute ${ATTR.previous} is not right: ${e.reason}`;
    case "person":
      return `the record names a person or a machine of one (${e.key}), which evidence must not`;
    default:
      return absurd(e);
  }
}

/** The counts of cases. */
export function qualityCounts(cases: readonly { readonly outcome: QualityOutcome }[]): QualityCounts {
  const ran = countsOf(cases.filter((c): c is { readonly outcome: Outcome } => c.outcome !== "not_run"));
  return { ...ran, notRun: cases.filter((c) => c.outcome === "not_run").length };
}

// ---------------------------------------------------------------------------------------------------------------------------- the CTRF body (FR-013)

/** The status CTRF gives an outcome (`other` for `cancelled` and for `not_run`, FR-014). */
export function ctrfStatus(o: QualityOutcome): "passed" | "failed" | "skipped" | "pending" | "other" {
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
    case "not_run":
      return "other";
    default:
      return absurd(o);
  }
}

const ms = (start: bigint, end: bigint): number => Number((end > start ? end - start : 0n) / 1_000_000n);

function failureText(c: QualityCase): string {
  return [
    c.message,
    c.expected === undefined ? undefined : `expected: ${c.expected}`,
    c.actual === undefined ? undefined : `actual: ${c.actual}`,
    c.reason,
  ]
    .filter((x): x is string => x !== undefined)
    .join("\n");
}

/** A case as a CTRF test object (FR-013): `name`, `status` and `duration`, and the other CTRF fields the case has; what CTRF has no field for is under `extra`. */
export function ctrfTest(c: QualityCase): AnyMap {
  const extra: Record<string, AnyValue> = {
    id: c.id,
    requirements: [...c.requirements],
    risk: c.risk,
    outcome: c.outcome,
    grade: c.grade,
    runtime: c.runtime,
  };
  if (c.characteristic !== undefined) extra["characteristic"] = c.characteristic;
  if (c.reason !== undefined) extra["reason"] = c.reason;
  if (c.expected !== undefined) extra["expected"] = c.expected;
  if (c.actual !== undefined) extra["actual"] = c.actual;
  if (c.rule !== undefined) extra["rule"] = c.rule;
  const body: Record<string, AnyValue> = {
    name: c.name,
    status: ctrfStatus(c.outcome),
    duration: ms(c.start, c.end),
    start: Number(c.start / 1_000_000n),
    stop: Number(c.end / 1_000_000n),
    suite: c.file,
    filePath: c.file,
    retries: c.attempt - 1,
  };
  if (c.message !== undefined) body["message"] = c.message;
  if (c.outcome === "fail" || c.outcome === "cancelled") body["trace"] = failureText(c);
  if (c.line !== undefined) body["line"] = c.line;
  body["extra"] = extra;
  return body;
}

// ---------------------------------------------------------------------------------------------------------------------------- redaction (FR-020)

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;

/** A text with its secrets (0006-signals FR-006) and its e-mail addresses (0008-test-evidence FR-003) replaced by `REDACTED`. */
export function redactEvidence(text: string): string {
  return redactText(text).replace(EMAIL, "REDACTED");
}

function redactValue(v: AttributeValue): AttributeValue {
  if (typeof v === "string") return redactEvidence(v);
  if (Array.isArray(v) && v.every((x): x is string => typeof x === "string")) return v.map(redactEvidence);
  return v;
}

function redactAttrs(a: Attributes): Attributes {
  const out: Record<string, AttributeValue> = {};
  for (const [k, v] of Object.entries(a)) out[k] = redactValue(v);
  return out;
}

function redactBody(v: AnyValue): AnyValue {
  const r = redactAnyValue(v);
  if (typeof r === "string") return redactEvidence(r);
  if (r instanceof Uint8Array || typeof r !== "object") return r;
  if (Array.isArray(r)) return r.map((x: AnyValue) => redactBody(x));
  const out: Record<string, AnyValue> = {};
  for (const [k, x] of Object.entries(r))
    Object.defineProperty(out, k, { value: redactBody(x), enumerable: true, writable: true, configurable: true });
  return out;
}

function redactSpan(s: SpanData): SpanData {
  return {
    ...s,
    attributes: redactAttrs(s.attributes),
    status: s.status.kind === "error" ? { kind: "error", message: redactEvidence(s.status.message) } : s.status,
  };
}

function redactLog(r: LogRecord): LogRecord {
  return { ...r, ...(r.body === undefined ? {} : { body: redactBody(r.body) }), attributes: redactAttrs(r.attributes) };
}

// ---------------------------------------------------------------------------------------------------------------------------- not_run (FR-005, FR-014)

/** A case, check or requirement that was planned and did not run, with the reason (FR-005). */
export type NotRun = {
  /** The requirements it would have proved. */
  readonly requirements: readonly string[];
  /** The case's name, or the requirement's id where only a requirement was planned. */
  readonly name: string;
  /** Its file, or `plan` where there is none. */
  readonly file?: string;
  readonly reason: string;
  readonly risk?: Risk;
  readonly rule?: string;
};

async function notRunCase(n: NotRun, traceId: TraceId, at: bigint): Promise<LogRecord> {
  const file = n.file ?? "plan";
  const id = await testId(file, n.name);
  const attributes: Record<string, AttributeValue> = {
    "test.case.name": n.name,
    "test.suite.name": file,
    "code.file.path": file,
    "ifc.test.id": id,
    "ifc.test.requirements": [...n.requirements],
    "ifc.test.risk": n.risk ?? "not-high",
    "ifc.test.outcome": "not_run",
    "ifc.test.reason": n.reason,
    "ifc.test.attempt": 1n,
    [ATTR.grade]: NO_GRADE,
  };
  if (n.rule !== undefined) attributes[ATTR.rule] = n.rule;
  const c: QualityCase = {
    id,
    file,
    name: n.name,
    requirements: n.requirements,
    risk: n.risk ?? "not-high",
    outcome: "not_run",
    reason: n.reason,
    attempt: 1,
    start: at,
    end: at,
    runtime: "none",
    grade: NO_GRADE,
    ...(n.rule === undefined ? {} : { rule: n.rule }),
  };
  return {
    time: at,
    observedTime: at,
    severityNumber: SEVERITY.WARN,
    severityText: "WARN",
    body: ctrfTest(c),
    attributes,
    droppedAttributesCount: 0,
    eventName: CASE_EVENT,
    traceId,
  };
}

// ---------------------------------------------------------------------------------------------------------------------------- reading

/** What a case's log record says beyond the model of 0008: the grade, the rule and the line. */
type CaseLog = { readonly grade?: Grade; readonly rule?: string; readonly line?: number };

function caseLogs(logs: readonly LogBatch[]): ReadonlyMap<string, CaseLog> {
  const out = new Map<string, CaseLog>();
  for (const b of logs) {
    for (const r of b.records) {
      if (r.eventName !== CASE_EVENT || r.spanId === undefined) continue;
      const g = attributeText(r.attributes, ATTR.grade);
      const rule = attributeText(r.attributes, ATTR.rule);
      const line = attributeInteger(r.attributes, ATTR.line);
      out.set(r.spanId, {
        ...(g !== undefined && isGrade(g) ? { grade: g } : {}),
        ...(rule === undefined ? {} : { rule }),
        ...(line === undefined ? {} : { line }),
      });
    }
  }
  return out;
}

function parse(input: unknown): Result<unknown, QualityError> {
  if (typeof input !== "string") return ok(input);
  try {
    return ok(JSON.parse(input));
  } catch (e) {
    return err({ kind: "record", error: { kind: "json", line: 1, reason: e instanceof Error ? e.message : String(e) } });
  }
}

function previousOf(resources: readonly Resource[]): Result<Sha256 | undefined, QualityError> {
  const seen = new Set<string>();
  for (const r of resources) {
    const v = r.attributes[ATTR.previous];
    seen.add(typeof v === "string" ? v : "");
  }
  seen.delete("");
  if (seen.size > 1) return err({ kind: "previous", reason: "the resources of the file name different predecessors" });
  const [only] = [...seen];
  if (only === undefined) return ok(undefined);
  const d = sha256Of(only);
  return d === undefined ? err({ kind: "previous", reason: `${JSON.stringify(only)} is not a SHA-256` }) : ok(d);
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * A record read into the model of the quality system (FR-013): through the decoders of 0006-signals and the model of 0008-test-evidence
 * (`input` is the file's text, or its JSON parsed), then the cases that did not run, each case's grade, rule and line, the grade of the
 * file, and its link in the chain.
 */
export function readQuality(input: unknown): Result<QualityRecord, QualityError> {
  const value = parse(input);
  if (value.kind === "err") return value;
  const base = readRecord(value.value);
  if (base.kind === "err")
    return err(base.error.kind === "person" ? { kind: "person", key: base.error.key } : { kind: "record", error: base.error });
  const t = decodeTraces(value.value);
  if (t.kind === "err") return err({ kind: "otlp", error: t.error });
  const l = decodeLogs(value.value);
  if (l.kind === "err") return err({ kind: "otlp", error: l.error });
  const run = base.value;
  const extra = caseLogs(l.value);
  const ran: QualityCase[] = run.tests.map((tc: RunTest) => {
    const e = extra.get(tc.spanId);
    return {
      id: tc.id,
      file: tc.file,
      name: tc.name,
      requirements: tc.requirements,
      risk: tc.risk,
      ...(tc.characteristic === undefined ? {} : { characteristic: tc.characteristic }),
      outcome: tc.outcome,
      ...(tc.reason === undefined ? {} : { reason: tc.reason }),
      ...(tc.message === undefined ? {} : { message: tc.message }),
      ...(tc.expected === undefined ? {} : { expected: tc.expected }),
      ...(tc.actual === undefined ? {} : { actual: tc.actual }),
      attempt: tc.attempt,
      start: tc.start,
      end: tc.end,
      runtime: tc.runtime,
      grade: e?.grade ?? (tc.outcome === "pass" || tc.outcome === "fail" ? RUN_GRADE : NO_GRADE),
      ...(e?.rule === undefined ? {} : { rule: e.rule }),
      ...(e?.line === undefined ? {} : { line: e.line }),
    };
  });
  const notRun: QualityCase[] = [];
  for (const b of l.value) {
    for (const r of b.records) {
      if (r.eventName !== CASE_EVENT) continue;
      const outcome = attributeText(r.attributes, "ifc.test.outcome");
      if (outcome !== "not_run") {
        if (outcome === undefined || !isQualityOutcome(outcome))
          return err({
            kind: "case",
            spanId: r.spanId ?? "none",
            reason: `its outcome ${JSON.stringify(outcome)} is not one of the outcomes`,
          });
        continue;
      }
      const name = attributeText(r.attributes, "test.case.name");
      const file = attributeText(r.attributes, "test.suite.name");
      const id = attributeText(r.attributes, "ifc.test.id");
      const reason = attributeText(r.attributes, "ifc.test.reason");
      if (name === undefined || file === undefined || id === undefined)
        return err({ kind: "case", spanId: r.spanId ?? "none", reason: "a case that did not run needs a name, a file and an id" });
      if (reason === undefined || reason.trim() === "")
        return err({ kind: "case", spanId: r.spanId ?? "none", reason: `${name} did not run and gives no reason (0021-ifqs FR-005)` });
      const risk = attributeText(r.attributes, "ifc.test.risk");
      const rule = attributeText(r.attributes, ATTR.rule);
      const g = attributeText(r.attributes, ATTR.grade);
      notRun.push({
        id,
        file,
        name,
        requirements: attributeTexts(r.attributes, "ifc.test.requirements"),
        risk: risk === "high" ? "high" : "not-high",
        outcome: "not_run",
        reason,
        attempt: 1,
        start: r.time,
        end: r.time,
        runtime: "none",
        grade: g !== undefined && isGrade(g) ? g : NO_GRADE,
        ...(rule === undefined ? {} : { rule }),
      });
    }
  }
  notRun.sort((a, b) => byText(a.file, b.file) || byText(a.name, b.name));
  const cases = [...ran, ...notRun];
  const runSpan = t.value.flatMap((b) => b.spans).find((s) => s.name === RUN_SPAN);
  const claimed = runSpan === undefined ? undefined : attributeText(runSpan.attributes, ATTR.grade);
  const previous = previousOf([...t.value.map((b) => b.resource), ...l.value.map((b) => b.resource)]);
  if (previous.kind === "err") return previous;
  return ok({
    traceId: run.traceId,
    run,
    cases,
    counts: qualityCounts(cases),
    grade: claimed !== undefined && isGrade(claimed) ? claimed : RUN_GRADE,
    ...(previous.value === undefined ? {} : { previous: previous.value }),
  });
}

// ---------------------------------------------------------------------------------------------------------------------------- canonicalizing

/** What `canonicalize` is given. */
export type CanonicalInput = {
  /** The run's document as 0008-test-evidence assembles it (`assembleRecord`), or its text. */
  readonly record: unknown;
  /** The SHA-256 of the evidence file before this one, or none for the first (FR-017). */
  readonly previous?: Sha256;
  /** What was planned and did not run (FR-005). */
  readonly notRun?: readonly NotRun[];
};

/** A record made canonical: the text to keep, and the record it reads back as. */
export type Canonical = { readonly text: string; readonly record: QualityRecord };

/**
 * The file to keep for a run (FR-013, FR-017, FR-020): the same OTLP/JSON document with each case's log record bodied as a CTRF test
 * object and carrying its grade, a log record for each case that did not run, `ifc.quality.previous.sha256` on every resource, every
 * text redacted of secrets and e-mail addresses, and nothing that names a person (a refusal). Reading the text gives back the record.
 */
export async function canonicalize(input: CanonicalInput): Promise<Result<Canonical, QualityError>> {
  const value = parse(input.record);
  if (value.kind === "err") return value;
  const read = readQuality(value.value);
  if (read.kind === "err") return read;
  const q = read.value;
  const t = decodeTraces(value.value);
  const l = decodeLogs(value.value);
  if (t.kind === "err") return err({ kind: "otlp", error: t.error });
  if (l.kind === "err") return err({ kind: "otlp", error: l.error });
  const traceId = parseTraceId(q.traceId);
  if (traceId.kind === "err") return err({ kind: "record", error: { kind: "no-run", reason: traceId.error } });
  const bySpan = new Map(
    q.run.tests.flatMap((tc, i) => {
      const c = q.cases[i];
      return c === undefined ? [] : [[tc.spanId, c] as const];
    }),
  );
  const logs: LogBatch[] = l.value.map((b) => ({
    ...b,
    records: b.records.map((r): LogRecord => {
      if (r.eventName !== CASE_EVENT || r.spanId === undefined) return r;
      const c = bySpan.get(r.spanId);
      if (c === undefined) return r;
      return { ...r, body: ctrfTest(c), attributes: { ...r.attributes, [ATTR.grade]: c.grade } };
    }),
  }));
  const runSpanId = parseSpanId(q.run.spanId);
  const spans: TraceBatch[] = t.value.map((b) => ({
    ...b,
    spans: b.spans.map((s) => {
      if (s.name === RUN_SPAN) {
        return { ...s, attributes: { ...s.attributes, [ATTR.grade]: RUN_GRADE, [ATTR.notRun]: BigInt((input.notRun ?? []).length) } };
      }
      const c = bySpan.get(s.context.spanId);
      return c === undefined ? s : { ...s, attributes: { ...s.attributes, [ATTR.grade]: c.grade } };
    }),
  }));
  const at = q.run.end;
  const extra: LogRecord[] = [];
  for (const n of input.notRun ?? []) {
    const r = await notRunCase(n, traceId.value, at);
    extra.push(runSpanId.kind === "ok" ? { ...r, spanId: runSpanId.value } : r);
  }
  const runResource = spans.find((b) => b.spans.some((s) => s.name === RUN_SPAN))?.resource ?? { attributes: {} };
  const withExtra: LogBatch[] = extra.length === 0 ? logs : [...logs, { resource: runResource, scope: TEST_SCOPE, records: extra }];
  const chained = (r: Resource): Resource => ({
    attributes: { ...r.attributes, ...(input.previous === undefined ? {} : { [ATTR.previous]: input.previous }) },
  });
  const merged: Signals = mergeBatches({
    traces: spans.map((b) => ({ ...b, resource: chained(b.resource), spans: b.spans.map(redactSpan) })),
    logs: withExtra.map((b) => ({ ...b, resource: chained(b.resource), records: b.records.map(redactLog) })),
  });
  const doc = { ...encodeTraces(merged.traces), ...encodeLogs(merged.logs) } as JsonObject;
  const text = recordText(doc);
  const back = readQuality(text);
  if (back.kind === "err") return back;
  return ok({ text, record: back.value });
}

/** The first link of the chain (FR-017): 64 zeros. */
export const FIRST_PREVIOUS: Sha256 = GENESIS;

// ---------------------------------------------------------------------------------------------------------------------------- checks (FR-015)

/** One rule of a check and what it found. */
export type CheckRule = { readonly id: string; readonly findings: readonly CheckFinding[]; readonly notRun?: string };

/** One finding of a rule: where it is and what it says. */
export type CheckFinding = { readonly file: string; readonly line?: number; readonly message: string };

/** What `checkRun` is given: the check, its rules and the run's ids, times and installation. */
export type CheckInput = {
  /** The check's name (`mizan`, `changes`). */
  readonly tool: string;
  readonly rules: readonly CheckRule[];
  readonly traceId: TraceId;
  readonly spanId: SpanId;
  /** A span id for each case, in order: one per rule that ran clean and one per finding; the caller supplies them (a host makes them). */
  readonly caseIds: readonly SpanId[];
  readonly start: bigint;
  readonly end: bigint;
  readonly runner: Installation;
  /** The requirements the check proves, which each case names. */
  readonly requirements?: readonly string[];
};

/**
 * The record of a check of Mizan (0021-ifqs FR-015): each rule a case, each finding a failed case with its rule id, file and line, so that
 * its findings render as SARIF results. A rule that ran and found nothing is a `pass`; each finding is a `fail`; a rule that could not
 * run (a plain Git host cannot answer the strict rules of the changes check) is a case that is `not_run` with its reason, never a pass.
 */
export async function checkRun(input: CheckInput): Promise<Result<Canonical, QualityError>> {
  const tests: { readonly c: QualityCase; readonly spanId: SpanId }[] = [];
  const notRun: NotRun[] = [];
  let n = 0;
  const next = (): SpanId | undefined => input.caseIds[n++];
  const requirements = input.requirements ?? [];
  for (const rule of input.rules) {
    if (rule.notRun !== undefined) {
      notRun.push({ requirements, name: rule.id, file: input.tool, reason: rule.notRun, rule: rule.id });
      continue;
    }
    const rows: readonly {
      readonly file: string;
      readonly name: string;
      readonly outcome: "pass" | "fail";
      readonly message?: string;
      readonly line?: number;
    }[] =
      rule.findings.length === 0
        ? [{ file: input.tool, name: rule.id, outcome: "pass" }]
        : rule.findings.map((f) => ({
            file: f.file,
            name: `${rule.id}: ${f.message}`,
            outcome: "fail" as const,
            message: f.message,
            ...(f.line === undefined ? {} : { line: f.line }),
          }));
    for (const row of rows) {
      const spanId = next();
      if (spanId === undefined) return err({ kind: "case", spanId: "none", reason: "the caller supplied too few case ids" });
      tests.push({
        spanId,
        c: {
          id: await testId(row.file, row.name),
          file: row.file,
          name: row.name,
          requirements,
          risk: "not-high",
          outcome: row.outcome,
          ...(row.message === undefined ? {} : { message: row.message }),
          attempt: 1,
          start: input.start,
          end: input.end,
          runtime: input.tool,
          grade: RUN_GRADE,
          rule: rule.id,
          ...(row.line === undefined ? {} : { line: row.line }),
        },
      });
    }
  }
  const ctx = (spanId: SpanId): { readonly traceId: TraceId; readonly spanId: SpanId; readonly parentSpanId: SpanId } => ({
    traceId: input.traceId,
    spanId,
    parentSpanId: input.spanId,
  });
  const extras = (c: QualityCase): Attributes => ({
    [ATTR.rule]: c.rule ?? "",
    ...(c.line === undefined ? {} : { [ATTR.line]: BigInt(c.line) }),
  });
  const resource: Resource = {
    attributes: {
      "service.name": input.tool,
      "process.runtime.name": input.runner.runtime,
      "process.runtime.version": input.runner.runtimeVersion,
      "os.type": input.runner.os,
      "host.arch": input.runner.arch,
      "ifc.test.role": input.runner.role,
      ...(input.runner.revision === undefined ? {} : { "vcs.ref.head.revision": input.runner.revision }),
    },
  };
  const spans = tests.map(({ c, spanId }) => {
    const s = testCaseSpan({ ...c, outcome: c.outcome === "not_run" ? "skip" : c.outcome }, ctx(spanId));
    return { ...s, attributes: { ...s.attributes, ...extras(c) } };
  });
  const records = tests.map(({ c, spanId }) => {
    const r = testCaseLog({ ...c, outcome: c.outcome === "not_run" ? "skip" : c.outcome }, ctx(spanId));
    return { ...r, attributes: { ...r.attributes, ...extras(c) } };
  });
  const runners: readonly RunnerOutcome[] = [
    { kind: "exited", runtime: input.tool, code: tests.some((t) => t.c.outcome === "fail") ? 1 : 0 },
  ];
  const assembled = assembleRecord({
    traceId: input.traceId,
    spanId: input.spanId,
    start: input.start,
    end: input.end,
    runner: input.runner,
    signals: { traces: [{ resource, scope: TEST_SCOPE, spans }], logs: [{ resource, scope: TEST_SCOPE, records }] },
    runners,
    required: [],
  });
  if (assembled.kind === "err") return err({ kind: "record", error: assembled.error });
  return canonicalize({ record: assembled.value.record, notRun });
}

/** A day as `YYYY/MM/DD` in UTC, from nanoseconds since the Unix epoch. */
export function dayOf(nanos: bigint): string {
  return isoTime(nanos).slice(0, 10).replaceAll("-", "/");
}
