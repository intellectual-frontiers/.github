// Spec: 0001-telemetry FR-004
/**
 * OTLP/HTTP with JSON, both ways (commons 0001-telemetry FR-004): export requests of traces, logs and metrics as the OTLP specification's
 * JSON encoding writes them (camel-case field names, trace and span ids as hexadecimal, 64-bit integers as decimal strings, enumerations as
 * integers, bytes as base64, signals grouped by resource and scope), the export responses with their partial success, and the decoding of
 * each back to the values of `./otel.ts`: a failure is a `Result` naming the path, a 64-bit integer is read from a JSON number or a string,
 * an enumeration from its number or its name, and a field the decoder does not know is ignored.
 *
 * @example
 * ```ts
 * import { decodeTraces, encodeTraces } from "./otlp.ts";
 * const request = encodeTraces([{ resource: { attributes: { "service.name": "build" } }, scope: { name: "ifc" }, spans: [] }]);
 * decodeTraces(JSON.parse(JSON.stringify(request))); // { kind: "ok", value: [ ...the same batch ] }
 * ```
 *
 * @module
 */
import { absurd, describe, err, ok, type Result } from "@intellectual-frontiers/core";
import type { DecodeError, Decoder } from "@intellectual-frontiers/core";
import { fromBase64, toBase64 } from "@intellectual-frontiers/formats/base64";
import type { Json, JsonObject } from "@intellectual-frontiers/formats/json5";
import {
  type AnyValue,
  type AttributeValue,
  type Attributes,
  formatTracestate,
  type HistogramPoint,
  isSeverityNumber,
  type LogRecord,
  type Metric,
  type MetricData,
  type NumberPoint,
  parseSpanId,
  parseTraceId,
  parseTracestate,
  type Resource,
  type Scope,
  type SeverityNumber,
  type SignalName,
  type SpanData,
  type SpanEvent,
  type SpanId,
  type SpanKind,
  type SpanLink,
  type SpanStatus,
  type Temporality,
  type TraceId,
} from "./otel.ts";

/** The spans of one resource and scope, as OTLP groups them. */
export type TraceBatch = { readonly resource: Resource; readonly scope: Scope; readonly spans: readonly SpanData[] };

/** The log records of one resource and scope, as OTLP groups them. */
export type LogBatch = { readonly resource: Resource; readonly scope: Scope; readonly records: readonly LogRecord[] };

/** The metrics of one resource and scope, as OTLP groups them. */
export type MetricBatch = { readonly resource: Resource; readonly scope: Scope; readonly metrics: readonly Metric[] };

/** An export response: how many signals were rejected (spans, log records or data points) and why; zero and `""` for full success. */
export type ExportResponse = { readonly rejected: number; readonly errorMessage: string };

// ---------------------------------------------------------------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------------------------------------------------------------

const SPAN_KINDS: readonly SpanKind[] = ["internal", "server", "client", "producer", "consumer"];

function encodeDouble(n: number): Json {
  if (Number.isNaN(n)) return "NaN";
  if (n === Infinity) return "Infinity";
  if (n === -Infinity) return "-Infinity";
  return n;
}

/** A value as OTLP's JSON `AnyValue`. */
export function encodeAnyValue(value: AnyValue): JsonObject {
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { boolValue: value };
  if (typeof value === "bigint") return { intValue: value.toString() };
  if (typeof value === "number") return { doubleValue: encodeDouble(value) };
  if (value instanceof Uint8Array) return { bytesValue: toBase64(value) };
  if (Array.isArray(value)) return { arrayValue: { values: value.map((v: AnyValue) => encodeAnyValue(v)) } };
  return { kvlistValue: { values: Object.entries(value).map(([key, v]) => ({ key, value: encodeAnyValue(v) })) } };
}

/** Attributes as OTLP's JSON list of `KeyValue`. */
export function encodeAttributes(attributes: Attributes): Json[] {
  return Object.entries(attributes).map(([key, value]) => ({ key, value: encodeAnyValue(value) }));
}

function encodeResource(resource: Resource): JsonObject {
  return { attributes: encodeAttributes(resource.attributes) };
}

function encodeScope(scope: Scope): JsonObject {
  const out: Record<string, Json> = { name: scope.name };
  if (scope.version !== undefined) out["version"] = scope.version;
  if (scope.attributes !== undefined) out["attributes"] = encodeAttributes(scope.attributes);
  return out;
}

function withDropped(out: Record<string, Json>, field: string, count: number): void {
  if (count !== 0) out[field] = count;
}

function encodeEvent(e: SpanEvent): JsonObject {
  const out: Record<string, Json> = { timeUnixNano: e.time.toString(), name: e.name, attributes: encodeAttributes(e.attributes) };
  withDropped(out, "droppedAttributesCount", e.droppedAttributesCount);
  return out;
}

function encodeLink(l: SpanLink): JsonObject {
  const out: Record<string, Json> = {
    traceId: l.traceId,
    spanId: l.spanId,
    attributes: encodeAttributes(l.attributes),
    flags: l.traceFlags,
  };
  if (l.traceState.length > 0) out["traceState"] = formatTracestate(l.traceState);
  withDropped(out, "droppedAttributesCount", l.droppedAttributesCount);
  return out;
}

function encodeStatus(s: SpanStatus): JsonObject {
  switch (s.kind) {
    case "unset":
      return { code: 0 };
    case "ok":
      return { code: 1 };
    case "error":
      return s.message === "" ? { code: 2 } : { code: 2, message: s.message };
    default:
      return absurd(s);
  }
}

/** A finished span as OTLP's JSON `Span`. */
export function encodeSpan(s: SpanData): JsonObject {
  const out: Record<string, Json> = { traceId: s.context.traceId, spanId: s.context.spanId };
  if (s.context.traceState.length > 0) out["traceState"] = formatTracestate(s.context.traceState);
  if (s.parentSpanId !== undefined) out["parentSpanId"] = s.parentSpanId;
  out["flags"] = s.context.traceFlags;
  out["name"] = s.name;
  out["kind"] = SPAN_KINDS.indexOf(s.kind) + 1;
  out["startTimeUnixNano"] = s.startTime.toString();
  out["endTimeUnixNano"] = s.endTime.toString();
  out["attributes"] = encodeAttributes(s.attributes);
  withDropped(out, "droppedAttributesCount", s.droppedAttributesCount);
  out["events"] = s.events.map(encodeEvent);
  withDropped(out, "droppedEventsCount", s.droppedEventsCount);
  out["links"] = s.links.map(encodeLink);
  withDropped(out, "droppedLinksCount", s.droppedLinksCount);
  out["status"] = encodeStatus(s.status);
  return out;
}

/** A log record as OTLP's JSON `LogRecord`. */
export function encodeLogRecord(r: LogRecord): JsonObject {
  const out: Record<string, Json> = {
    timeUnixNano: r.time.toString(),
    observedTimeUnixNano: r.observedTime.toString(),
    severityNumber: r.severityNumber,
    severityText: r.severityText,
  };
  if (r.body !== undefined) out["body"] = encodeAnyValue(r.body);
  out["attributes"] = encodeAttributes(r.attributes);
  withDropped(out, "droppedAttributesCount", r.droppedAttributesCount);
  if (r.traceFlags !== undefined) out["flags"] = r.traceFlags;
  if (r.traceId !== undefined) out["traceId"] = r.traceId;
  if (r.spanId !== undefined) out["spanId"] = r.spanId;
  if (r.eventName !== undefined) out["eventName"] = r.eventName;
  return out;
}

function temporalityNumber(t: Temporality): number {
  return t === "delta" ? 1 : 2;
}

function encodeNumberPoint(p: NumberPoint): JsonObject {
  return {
    attributes: encodeAttributes(p.attributes),
    startTimeUnixNano: p.startTime.toString(),
    timeUnixNano: p.time.toString(),
    ...(typeof p.value === "bigint" ? { asInt: p.value.toString() } : { asDouble: encodeDouble(p.value) }),
  };
}

function encodeHistogramPoint(p: HistogramPoint): JsonObject {
  const out: Record<string, Json> = {
    attributes: encodeAttributes(p.attributes),
    startTimeUnixNano: p.startTime.toString(),
    timeUnixNano: p.time.toString(),
    count: String(p.count),
  };
  if (p.sum !== undefined) out["sum"] = encodeDouble(p.sum);
  out["bucketCounts"] = p.bucketCounts.map(String);
  out["explicitBounds"] = p.bounds.map(encodeDouble);
  if (p.min !== undefined) out["min"] = encodeDouble(p.min);
  if (p.max !== undefined) out["max"] = encodeDouble(p.max);
  return out;
}

function encodeMetricData(d: MetricData): Record<string, Json> {
  switch (d.kind) {
    case "sum":
      return {
        sum: {
          dataPoints: d.points.map(encodeNumberPoint),
          aggregationTemporality: temporalityNumber(d.temporality),
          isMonotonic: d.monotonic,
        },
      };
    case "gauge":
      return { gauge: { dataPoints: d.points.map(encodeNumberPoint) } };
    case "histogram":
      return { histogram: { dataPoints: d.points.map(encodeHistogramPoint), aggregationTemporality: temporalityNumber(d.temporality) } };
    default:
      return absurd(d);
  }
}

/** A metric as OTLP's JSON `Metric`. */
export function encodeMetric(m: Metric): JsonObject {
  return { name: m.name, description: m.description, unit: m.unit, ...encodeMetricData(m.data) };
}

/** A canonical text of a JSON value, keys in order, to tell equal resources and scopes. */
function canonical(value: Json): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (isJsonArray(value)) return `[${value.map((v) => canonical(v)).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k] ?? null)}`).join(",")}}`;
}

function isJsonArray(value: Json): value is readonly Json[] {
  return Array.isArray(value);
}

/** Batches grouped as OTLP groups them: one entry per distinct resource, one per distinct scope within it, in first-seen order. */
function group<B extends { readonly resource: Resource; readonly scope: Scope }>(
  batches: readonly B[],
  items: (b: B) => readonly Json[],
  resourceField: string,
  scopeField: string,
  itemsField: string,
): JsonObject {
  const resources = new Map<string, { resource: JsonObject; scopes: Map<string, { scope: JsonObject; items: Json[] }> }>();
  for (const b of batches) {
    const resource = encodeResource(b.resource);
    const rk = canonical(resource);
    let r = resources.get(rk);
    if (r === undefined) {
      r = { resource, scopes: new Map() };
      resources.set(rk, r);
    }
    const scope = encodeScope(b.scope);
    const sk = canonical(scope);
    let s = r.scopes.get(sk);
    if (s === undefined) {
      s = { scope, items: [] };
      r.scopes.set(sk, s);
    }
    s.items.push(...items(b));
  }
  return {
    [resourceField]: [...resources.values()].map((r) => ({
      resource: r.resource,
      [scopeField]: [...r.scopes.values()].map((s) => ({ scope: s.scope, [itemsField]: s.items })),
    })),
  };
}

/** Trace batches as an OTLP/JSON `ExportTraceServiceRequest`. */
export function encodeTraces(batches: readonly TraceBatch[]): JsonObject {
  return group(batches, (b) => b.spans.map(encodeSpan), "resourceSpans", "scopeSpans", "spans");
}

/** Log batches as an OTLP/JSON `ExportLogsServiceRequest`. */
export function encodeLogs(batches: readonly LogBatch[]): JsonObject {
  return group(batches, (b) => b.records.map(encodeLogRecord), "resourceLogs", "scopeLogs", "logRecords");
}

/** Metric batches as an OTLP/JSON `ExportMetricsServiceRequest`. */
export function encodeMetrics(batches: readonly MetricBatch[]): JsonObject {
  return group(batches, (b) => b.metrics.map(encodeMetric), "resourceMetrics", "scopeMetrics", "metrics");
}

const REJECTED_FIELD: { readonly [S in SignalName]: string } = {
  traces: "rejectedSpans",
  logs: "rejectedLogRecords",
  metrics: "rejectedDataPoints",
};

/** An export response as OTLP/JSON: `{}` for full success, else `partialSuccess` with the rejected count (a decimal string) and the message. */
export function encodeResponse(signal: SignalName, response: ExportResponse): JsonObject {
  if (response.rejected === 0 && response.errorMessage === "") return {};
  return { partialSuccess: { [REJECTED_FIELD[signal]]: String(response.rejected), errorMessage: response.errorMessage } };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------------------------------------------------------------

/** Thrown inside this module only, by a field reader, and caught by `message`; never seen outside. */
class Failure extends Error {
  readonly error: DecodeError;
  constructor(error: DecodeError) {
    super(error.path);
    this.error = error;
  }
}

function failure(path: string, expected: string, input: unknown): DecodeError {
  return { kind: "decode", path, expected, found: describe(input) };
}

/** The fields of a message, read one by one; a field that fails stops the reading of the message with its error. */
type Fields = {
  /** A field that must be present. */
  readonly req: <T>(key: string, decoder: Decoder<T>) => T;
  /** A field that may be absent or `null`, then `fallback`. */
  readonly opt: <T, F>(key: string, decoder: Decoder<T>, fallback: F) => T | F;
};

function message<T>(build: (f: Fields, path: string) => T): Decoder<T> {
  return (input, path = "$") => {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return err(failure(path, "an object", input));
    const read = <V>(key: string, decoder: Decoder<V>): V => {
      const r = decoder(Reflect.get(input, key), `${path}.${key}`);
      if (r.kind === "err") throw new Failure(r.error);
      return r.value;
    };
    const f: Fields = {
      req: read,
      opt: (key, decoder, fallback) => {
        const v: unknown = Reflect.get(input, key);
        return v === undefined || v === null ? fallback : read(key, decoder);
      },
    };
    try {
      return ok(build(f, path));
    } catch (e) {
      if (e instanceof Failure) return err(e.error);
      throw e;
    }
  };
}

function list<T>(element: Decoder<T>): Decoder<readonly T[]> {
  return (input, path = "$") => {
    if (!Array.isArray(input)) return err(failure(path, "an array", input));
    const out: T[] = [];
    for (const [i, value] of input.entries()) {
      const r = element(value, `${path}[${i}]`);
      if (r.kind === "err") return r;
      out.push(r.value);
    }
    return ok(out);
  };
}

const str: Decoder<string> = (input, path = "$") => (typeof input === "string" ? ok(input) : err(failure(path, "a string", input)));

const bool: Decoder<boolean> = (input, path = "$") => (typeof input === "boolean" ? ok(input) : err(failure(path, "a boolean", input)));

/** A 64-bit integer from a JSON number or a decimal string. */
const int64: Decoder<bigint> = (input, path = "$") => {
  if (typeof input === "number" && Number.isInteger(input)) return ok(BigInt(input));
  if (typeof input === "string" && /^-?[0-9]+$/.test(input)) return ok(BigInt(input));
  return err(failure(path, "a 64-bit integer (a number or a decimal string)", input));
};

/** A non-negative count: an integer from a number or a decimal string, within the safe integers. */
const count: Decoder<number> = (input, path = "$") => {
  const r = int64(input, path);
  if (r.kind === "err") return r;
  return r.value >= 0n && r.value <= BigInt(Number.MAX_SAFE_INTEGER) ? ok(Number(r.value)) : err(failure(path, "a count", input));
};

/** A double from a number, or the strings `NaN`, `Infinity` and `-Infinity` of proto3 JSON. */
const double: Decoder<number> = (input, path = "$") => {
  if (typeof input === "number") return ok(input);
  if (input === "NaN") return ok(NaN);
  if (input === "Infinity") return ok(Infinity);
  if (input === "-Infinity") return ok(-Infinity);
  return err(failure(path, "a double", input));
};

const bytes: Decoder<Uint8Array> = (input, path = "$") => {
  if (typeof input !== "string") return err(failure(path, "base64", input));
  const r = fromBase64(input);
  return r.kind === "ok" ? r : err(failure(path, "base64", input));
};

const traceId: Decoder<TraceId> = (input, path = "$") => {
  const r = typeof input === "string" ? parseTraceId(input.toLowerCase()) : err("");
  return r.kind === "ok" ? r : err(failure(path, "a trace id (32 hexadecimal digits, not all zeros)", input));
};

const spanId: Decoder<SpanId> = (input, path = "$") => {
  const r = typeof input === "string" ? parseSpanId(input.toLowerCase()) : err("");
  return r.kind === "ok" ? r : err(failure(path, "a span id (16 hexadecimal digits, not all zeros)", input));
};

/** An enumeration from its number or its name; `names[i]` is the name of `i`. */
function enumeration(names: readonly string[]): Decoder<number> {
  return (input, path = "$") => {
    if (typeof input === "number" && Number.isInteger(input) && input >= 0 && input < names.length) return ok(input);
    if (typeof input === "string") {
      const i = names.indexOf(input);
      if (i >= 0) return ok(i);
    }
    return err(failure(path, `one of ${names.join(", ")} or its number`, input));
  };
}

const spanKindEnum = enumeration([
  "SPAN_KIND_UNSPECIFIED",
  "SPAN_KIND_INTERNAL",
  "SPAN_KIND_SERVER",
  "SPAN_KIND_CLIENT",
  "SPAN_KIND_PRODUCER",
  "SPAN_KIND_CONSUMER",
]);
const statusCodeEnum = enumeration(["STATUS_CODE_UNSET", "STATUS_CODE_OK", "STATUS_CODE_ERROR"]);
const temporalityEnum = enumeration([
  "AGGREGATION_TEMPORALITY_UNSPECIFIED",
  "AGGREGATION_TEMPORALITY_DELTA",
  "AGGREGATION_TEMPORALITY_CUMULATIVE",
]);
const SEVERITY_NAMES = ["SEVERITY_NUMBER_UNSPECIFIED"].concat(
  ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"].flatMap((r) => ["", "2", "3", "4"].map((n) => `SEVERITY_NUMBER_${r}${n}`)),
);
const severityEnum: Decoder<SeverityNumber> = (input, path = "$") => {
  const r = enumeration(SEVERITY_NAMES)(input, path);
  if (r.kind === "err") return r;
  return isSeverityNumber(r.value) ? ok(r.value) : err(failure(path, "a severity number from 1 to 24", input));
};

/** OTLP's JSON `AnyValue` as a value; an `AnyValue` that holds none is refused. */
export const decodeAnyValue: Decoder<AnyValue> = (input, path = "$") => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return err(failure(path, "an AnyValue object", input));
  const has = (key: string): boolean => {
    const v: unknown = Reflect.get(input, key);
    return v !== undefined && v !== null;
  };
  const at = (key: string): unknown => Reflect.get(input, key);
  if (has("stringValue")) return str(at("stringValue"), `${path}.stringValue`);
  if (has("boolValue")) return bool(at("boolValue"), `${path}.boolValue`);
  if (has("intValue")) return int64(at("intValue"), `${path}.intValue`);
  if (has("doubleValue")) return double(at("doubleValue"), `${path}.doubleValue`);
  if (has("bytesValue")) return bytes(at("bytesValue"), `${path}.bytesValue`);
  if (has("arrayValue")) return message((f) => f.opt("values", list(decodeAnyValue), []))(at("arrayValue"), `${path}.arrayValue`);
  if (has("kvlistValue")) {
    return message((f) => {
      const out: Record<string, AnyValue> = {};
      for (const kv of f.opt("values", list(keyValue(decodeAnyValue)), [])) {
        Object.defineProperty(out, kv.key, { value: kv.value, enumerable: true, writable: true, configurable: true });
      }
      return out;
    })(at("kvlistValue"), `${path}.kvlistValue`);
  }
  return err(failure(path, "an AnyValue holding a value", input));
};

function keyValue<T>(value: Decoder<T>): Decoder<{ readonly key: string; readonly value: T }> {
  return message((f) => ({ key: f.req("key", str), value: f.req("value", value) }));
}

/** An `AnyValue` that is an attribute value: a primitive, or an array of primitives of one type. */
export const decodeAttributeValue: Decoder<AttributeValue> = (input, path = "$") => {
  const r = decodeAnyValue(input, path);
  if (r.kind === "err") return r;
  const v = r.value;
  if (typeof v !== "object" || v instanceof Uint8Array) return ok(v);
  if (Array.isArray(v)) {
    const values: readonly AnyValue[] = v;
    if (values.every((e) => typeof e === "string")) return ok(values.filter((e) => typeof e === "string"));
    if (values.every((e) => typeof e === "boolean")) return ok(values.filter((e) => typeof e === "boolean"));
    if (values.every((e) => typeof e === "bigint")) return ok(values.filter((e) => typeof e === "bigint"));
    if (values.every((e) => typeof e === "number")) return ok(values.filter((e) => typeof e === "number"));
  }
  return err(failure(path, "an attribute value (a primitive or a homogeneous array of primitives)", input));
};

/** OTLP's JSON list of `KeyValue` as attributes. */
export const decodeAttributes: Decoder<Attributes> = (input, path = "$") => {
  const r = list(keyValue(decodeAttributeValue))(input, path);
  if (r.kind === "err") return r;
  const out: Record<string, AttributeValue> = {};
  for (const kv of r.value) Object.defineProperty(out, kv.key, { value: kv.value, enumerable: true, writable: true, configurable: true });
  return ok(out);
};

const resource: Decoder<Resource> = message((f) => ({ attributes: f.opt("attributes", decodeAttributes, {}) }));

const scope: Decoder<Scope> = message((f) => {
  const version = f.opt("version", str, undefined);
  const attributes = f.opt("attributes", decodeAttributes, undefined);
  return {
    name: f.opt("name", str, ""),
    ...(version === undefined ? {} : { version }),
    ...(attributes === undefined ? {} : { attributes }),
  };
});

const event: Decoder<SpanEvent> = message((f) => ({
  name: f.opt("name", str, ""),
  time: f.opt("timeUnixNano", int64, 0n),
  attributes: f.opt("attributes", decodeAttributes, {}),
  droppedAttributesCount: f.opt("droppedAttributesCount", count, 0),
}));

const link: Decoder<SpanLink> = message((f) => ({
  traceId: f.req("traceId", traceId),
  spanId: f.req("spanId", spanId),
  traceState: parseTracestate(f.opt("traceState", str, "")),
  traceFlags: f.opt("flags", count, 0) & 0xff,
  attributes: f.opt("attributes", decodeAttributes, {}),
  droppedAttributesCount: f.opt("droppedAttributesCount", count, 0),
}));

const status: Decoder<SpanStatus> = message((f): SpanStatus => {
  const code = f.opt("code", statusCodeEnum, 0);
  if (code === 1) return { kind: "ok" };
  if (code === 2) return { kind: "error", message: f.opt("message", str, "") };
  return { kind: "unset" };
});

const optionalSpanId: Decoder<SpanId | undefined> = (input, path = "$") => (input === "" ? ok(undefined) : spanId(input, path));

/** OTLP's JSON `Span` as a finished span. */
export const decodeSpan: Decoder<SpanData> = message((f) => {
  const parentSpanId = f.opt("parentSpanId", optionalSpanId, undefined);
  const kind = f.opt("kind", spanKindEnum, 1);
  return {
    name: f.opt("name", str, ""),
    context: {
      traceId: f.req("traceId", traceId),
      spanId: f.req("spanId", spanId),
      traceFlags: f.opt("flags", count, 0) & 0xff,
      traceState: parseTracestate(f.opt("traceState", str, "")),
      isRemote: false,
    },
    ...(parentSpanId === undefined ? {} : { parentSpanId }),
    kind: SPAN_KINDS[kind - 1] ?? "internal",
    startTime: f.opt("startTimeUnixNano", int64, 0n),
    endTime: f.opt("endTimeUnixNano", int64, 0n),
    attributes: f.opt("attributes", decodeAttributes, {}),
    events: f.opt("events", list(event), []),
    links: f.opt("links", list(link), []),
    status: f.opt("status", status, { kind: "unset" }),
    droppedAttributesCount: f.opt("droppedAttributesCount", count, 0),
    droppedEventsCount: f.opt("droppedEventsCount", count, 0),
    droppedLinksCount: f.opt("droppedLinksCount", count, 0),
  };
});

const optionalTraceId: Decoder<TraceId | undefined> = (input, path = "$") => (input === "" ? ok(undefined) : traceId(input, path));

/** OTLP's JSON `LogRecord` as a log record; its severity number must be 1 to 24. */
export const decodeLogRecord: Decoder<LogRecord> = message((f) => {
  const body = f.opt("body", decodeAnyValue, undefined);
  const traceFlags = f.opt("flags", count, undefined);
  const tid = f.opt("traceId", optionalTraceId, undefined);
  const sid = f.opt("spanId", optionalSpanId, undefined);
  const eventName = f.opt("eventName", str, undefined);
  return {
    time: f.opt("timeUnixNano", int64, 0n),
    observedTime: f.opt("observedTimeUnixNano", int64, 0n),
    severityNumber: f.req("severityNumber", severityEnum),
    severityText: f.opt("severityText", str, ""),
    ...(body === undefined ? {} : { body }),
    attributes: f.opt("attributes", decodeAttributes, {}),
    droppedAttributesCount: f.opt("droppedAttributesCount", count, 0),
    ...(eventName === undefined ? {} : { eventName }),
    ...(tid === undefined ? {} : { traceId: tid }),
    ...(sid === undefined ? {} : { spanId: sid }),
    ...(traceFlags === undefined ? {} : { traceFlags: traceFlags & 0xff }),
  };
});

const numberPoint: Decoder<NumberPoint> = message((f, path) => {
  const asInt = f.opt("asInt", int64, undefined);
  const asDouble = f.opt("asDouble", double, undefined);
  const value = asInt ?? asDouble;
  if (value === undefined) throw new Failure(failure(`${path}.asDouble`, "asInt or asDouble", undefined));
  return {
    attributes: f.opt("attributes", decodeAttributes, {}),
    startTime: f.opt("startTimeUnixNano", int64, 0n),
    time: f.opt("timeUnixNano", int64, 0n),
    value,
  };
});

const histogramPoint: Decoder<HistogramPoint> = message((f, path) => {
  const sum = f.opt("sum", double, undefined);
  const min = f.opt("min", double, undefined);
  const max = f.opt("max", double, undefined);
  const bounds = f.opt("explicitBounds", list(double), []);
  const bucketCounts = f.opt("bucketCounts", list(count), []);
  if (bucketCounts.length !== 0 && bucketCounts.length !== bounds.length + 1) {
    throw new Failure(failure(`${path}.bucketCounts`, `${bounds.length + 1} bucket counts`, bucketCounts.length));
  }
  return {
    attributes: f.opt("attributes", decodeAttributes, {}),
    startTime: f.opt("startTimeUnixNano", int64, 0n),
    time: f.opt("timeUnixNano", int64, 0n),
    count: f.opt("count", count, 0),
    ...(sum === undefined ? {} : { sum }),
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
    bounds,
    bucketCounts,
  };
});

function temporalityOf(n: number): Temporality {
  return n === 1 ? "delta" : "cumulative";
}

/** OTLP's JSON `Metric` as a metric: a sum, a gauge or a histogram (other data is refused). */
export const decodeMetric: Decoder<Metric> = message((f, path) => {
  const head = { name: f.opt("name", str, ""), description: f.opt("description", str, ""), unit: f.opt("unit", str, "") };
  const sum = f.opt(
    "sum",
    message((g) => ({
      kind: "sum" as const,
      points: g.opt("dataPoints", list(numberPoint), []),
      temporality: temporalityOf(g.opt("aggregationTemporality", temporalityEnum, 2)),
      monotonic: g.opt("isMonotonic", bool, false),
    })),
    undefined,
  );
  if (sum !== undefined) return { ...head, data: sum };
  const gauge = f.opt(
    "gauge",
    message((g) => ({ kind: "gauge" as const, points: g.opt("dataPoints", list(numberPoint), []) })),
    undefined,
  );
  if (gauge !== undefined) return { ...head, data: gauge };
  const histogram = f.opt(
    "histogram",
    message((g) => ({
      kind: "histogram" as const,
      points: g.opt("dataPoints", list(histogramPoint), []),
      temporality: temporalityOf(g.opt("aggregationTemporality", temporalityEnum, 2)),
    })),
    undefined,
  );
  if (histogram !== undefined) return { ...head, data: histogram };
  throw new Failure(failure(`${path}.sum`, "a sum, a gauge or a histogram", undefined));
});

function ungroup<T>(
  resourceField: string,
  scopeField: string,
  itemsField: string,
  item: Decoder<T>,
): Decoder<readonly { readonly resource: Resource; readonly scope: Scope; readonly items: readonly T[] }[]> {
  return message((f) =>
    f
      .opt(
        resourceField,
        list(
          message((r) => {
            const res = r.opt("resource", resource, { attributes: {} });
            return r
              .opt(
                scopeField,
                list(message((s) => ({ scope: s.opt("scope", scope, { name: "" }), items: s.opt(itemsField, list(item), []) }))),
                [],
              )
              .map((s) => ({ resource: res, ...s }));
          }),
        ),
        [],
      )
      .flat(),
  );
}

/** An OTLP/JSON `ExportTraceServiceRequest` as trace batches, one for each scope of each resource; a failure names its path. */
export function decodeTraces(input: unknown): Result<readonly TraceBatch[], DecodeError> {
  const r = ungroup("resourceSpans", "scopeSpans", "spans", decodeSpan)(input);
  return r.kind === "err" ? r : ok(r.value.map((b) => ({ resource: b.resource, scope: b.scope, spans: b.items })));
}

/** An OTLP/JSON `ExportLogsServiceRequest` as log batches, one for each scope of each resource; a failure names its path. */
export function decodeLogs(input: unknown): Result<readonly LogBatch[], DecodeError> {
  const r = ungroup("resourceLogs", "scopeLogs", "logRecords", decodeLogRecord)(input);
  return r.kind === "err" ? r : ok(r.value.map((b) => ({ resource: b.resource, scope: b.scope, records: b.items })));
}

/** An OTLP/JSON `ExportMetricsServiceRequest` as metric batches, one for each scope of each resource; a failure names its path. */
export function decodeMetrics(input: unknown): Result<readonly MetricBatch[], DecodeError> {
  const r = ungroup("resourceMetrics", "scopeMetrics", "metrics", decodeMetric)(input);
  return r.kind === "err" ? r : ok(r.value.map((b) => ({ resource: b.resource, scope: b.scope, metrics: b.items })));
}

/** An OTLP/JSON export response; an absent `partialSuccess` is full success. */
export function decodeResponse(signal: SignalName, input: unknown): Result<ExportResponse, DecodeError> {
  return message((f) =>
    f.opt(
      "partialSuccess",
      message((p) => ({ rejected: p.opt(REJECTED_FIELD[signal], count, 0), errorMessage: p.opt("errorMessage", str, "") })),
      { rejected: 0, errorMessage: "" },
    ),
  )(input);
}

/** The number of signals in trace, log or metric batches: spans, log records, or data points (what a partial success counts). */
export function countSignals(batches: readonly TraceBatch[] | readonly LogBatch[] | readonly MetricBatch[]): number {
  let n = 0;
  for (const b of batches) {
    if ("spans" in b) n += b.spans.length;
    else if ("records" in b) n += b.records.length;
    else for (const m of b.metrics) n += m.data.points.length;
  }
  return n;
}
