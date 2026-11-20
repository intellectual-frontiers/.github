/**
 * The OpenTelemetry data model, written from the OpenTelemetry specification itself (commons 0006-signals FR-001 to FR-008): attribute
 * values and log bodies, trace and span ids as brands made only from bytes the caller gives (the kernel has no randomness of its own), W3C
 * Trace Context Level 2 `traceparent` and `tracestate`, resources, scopes, finished spans, log records and metric points, the
 * configuration read from the `OTEL_*` environment variables (given as a record: the kernel reads no environment), redaction of what must
 * never leave a process, the attribute, event and link limits, and the samplers OpenTelemetry names.
 *
 * @example
 * ```ts
 * import { formatTraceparent, parseTraceparent, redactUrl, resolveConfig } from "./otel.ts";
 * const parent = parseTraceparent("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
 * if (parent.kind === "ok") formatTraceparent(parent.value); // the same header back
 * redactUrl("https://user:pw@host/x?token=abc&page=2"); // "https://REDACTED:REDACTED@host/x?token=REDACTED&page=2"
 * resolveConfig({ OTEL_SERVICE_NAME: "build" }).config.resource; // { "service.name": "build" }
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import type { Brand } from "@intellectual-frontiers/core";
import { fromBase64 } from "@intellectual-frontiers/formats/base64";
import { toHex } from "@intellectual-frontiers/formats/hex";

// ---------------------------------------------------------------------------------------------------------------------------------
// Values (FR-001)
// ---------------------------------------------------------------------------------------------------------------------------------

/**
 * An attribute's value: a string, a boolean, an integer (`bigint`, OTLP's int64), a double (`number`), bytes, or a homogeneous array of
 * one of the primitive types. Nothing else is representable (FR-001).
 */
export type AttributeValue =
  string | boolean | bigint | number | Uint8Array | readonly string[] | readonly boolean[] | readonly bigint[] | readonly number[];

/** A set of attributes: names to values. */
export type Attributes = Readonly<Record<string, AttributeValue>>;

/** A log body, as OTLP's `AnyValue`: what an attribute may be, and also a map or an array of mixed values (FR-001). */
export type AnyValue = AttributeValue | readonly AnyValue[] | AnyMap;

/** A map of `AnyValue`s, as OTLP's `KeyValueList`. */
export type AnyMap = { readonly [key: string]: AnyValue };

// ---------------------------------------------------------------------------------------------------------------------------------
// Ids (FR-002)
// ---------------------------------------------------------------------------------------------------------------------------------

/** A trace id: 32 lower-case hexadecimal digits, not all zeros (FR-002). */
export type TraceId = Brand<string, "TraceId">;

/** A span id: 16 lower-case hexadecimal digits, not all zeros (FR-002). */
export type SpanId = Brand<string, "SpanId">;

const TRACE_ID = /^[0-9a-f]{32}$/;
const SPAN_ID = /^[0-9a-f]{16}$/;
const ZEROS = /^0+$/;

/** A trace id from 16 bytes a caller gives (`traceIdFrom(random(16))`); other lengths and all zeros are refused (FR-002). */
export function traceIdFrom(bytes: Uint8Array): Result<TraceId, string> {
  if (bytes.length !== 16) return err(`a trace id is 16 bytes, not ${bytes.length}`);
  return parseTraceId(toHex(bytes));
}

/** A span id from 8 bytes a caller gives (`spanIdFrom(random(8))`); other lengths and all zeros are refused (FR-002). */
export function spanIdFrom(bytes: Uint8Array): Result<SpanId, string> {
  if (bytes.length !== 8) return err(`a span id is 8 bytes, not ${bytes.length}`);
  return parseSpanId(toHex(bytes));
}

/** A trace id from its text: 32 lower-case hexadecimal digits, not all zeros. */
export function parseTraceId(text: string): Result<TraceId, string> {
  if (!TRACE_ID.test(text)) return err("a trace id is 32 lower-case hexadecimal digits");
  if (ZEROS.test(text)) return err("a trace id of all zeros is not valid");
  // The one place a TraceId is made, after its validation.
  return ok(text as TraceId);
}

/** A span id from its text: 16 lower-case hexadecimal digits, not all zeros. */
export function parseSpanId(text: string): Result<SpanId, string> {
  if (!SPAN_ID.test(text)) return err("a span id is 16 lower-case hexadecimal digits");
  if (ZEROS.test(text)) return err("a span id of all zeros is not valid");
  // The one place a SpanId is made, after its validation.
  return ok(text as SpanId);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// W3C Trace Context Level 2 (FR-003)
// ---------------------------------------------------------------------------------------------------------------------------------

/** One `tracestate` member. */
export type TraceStateMember = { readonly key: string; readonly value: string };

/** A `tracestate`: its members, newest first, at most 32, each key once. */
export type TraceState = readonly TraceStateMember[];

/** The `sampled` trace flag. */
export const SAMPLED = 0x01;

/** The `random` trace flag of Level 2: the trace id's right-most 7 bytes are random. */
export const RANDOM = 0x02;

/** The trace flags this version of Trace Context defines; the others are written as zero. */
const KNOWN_FLAGS = SAMPLED | RANDOM;

/** The most members a `tracestate` keeps. */
export const TRACESTATE_MAX_MEMBERS = 32;

/** What propagates: the ids, the flags, the trace state, and whether it came from another process. */
export type SpanContext = {
  readonly traceId: TraceId;
  readonly spanId: SpanId;
  readonly traceFlags: number;
  readonly traceState: TraceState;
  readonly isRemote: boolean;
};

/** Whether a context's `sampled` flag is set. */
export function isSampled(context: { readonly traceFlags: number }): boolean {
  return (context.traceFlags & SAMPLED) === SAMPLED;
}

const HEX2 = /^[0-9a-f]{2}$/;

/**
 * A `traceparent` header read (FR-003): version `00` exactly as written (55 characters, lower-case hexadecimal, ids not all zeros),
 * version `ff` refused, a later version read by its first four fields. The context is remote and its trace state empty; the flags this
 * version does not define are dropped.
 */
export function parseTraceparent(header: string): Result<SpanContext, string> {
  const h = header.replace(/^[ \t]+|[ \t]+$/g, "");
  const version = h.slice(0, 2);
  if (!HEX2.test(version) || h[2] !== "-") return err("the version is not two lower-case hexadecimal digits and a dash");
  if (version === "ff") return err("the version ff is not valid");
  if (version === "00" ? h.length !== 55 : h.length < 55 || (h.length > 55 && h[55] !== "-")) {
    return err("the header does not have the length of its version");
  }
  if (h[35] !== "-" || h[52] !== "-") return err("the fields are not separated by dashes");
  const traceId = parseTraceId(h.slice(3, 35));
  if (traceId.kind === "err") return traceId;
  const spanId = parseSpanId(h.slice(36, 52));
  if (spanId.kind === "err") return spanId;
  const flags = h.slice(53, 55);
  if (!HEX2.test(flags)) return err("the trace flags are not two lower-case hexadecimal digits");
  return ok({
    traceId: traceId.value,
    spanId: spanId.value,
    traceFlags: Number.parseInt(flags, 16) & KNOWN_FLAGS,
    traceState: [],
    isRemote: true,
  });
}

/** A `traceparent` header (version `00`) for a context. */
export function formatTraceparent(context: { readonly traceId: TraceId; readonly spanId: SpanId; readonly traceFlags: number }): string {
  const flags = (context.traceFlags & KNOWN_FLAGS).toString(16).padStart(2, "0");
  return `00-${context.traceId}-${context.spanId}-${flags}`;
}

const KEY_CHAR = "[a-z0-9_\\-*/]";
const TRACESTATE_KEY = new RegExp(`^(?:[a-z]${KEY_CHAR}{0,255}|[a-z0-9]${KEY_CHAR}{0,240}@[a-z]${KEY_CHAR}{0,13})$`);
const TRACESTATE_VALUE = /^[\x20-\x2b\x2d-\x3c\x3e-\x7e]{0,255}[\x21-\x2b\x2d-\x3c\x3e-\x7e]$/;

/** Whether a key is a `tracestate` key of the grammar. */
export function isTraceStateKey(key: string): boolean {
  return TRACESTATE_KEY.test(key);
}

/** Whether a value is a `tracestate` value of the grammar. */
export function isTraceStateValue(value: string): boolean {
  return TRACESTATE_VALUE.test(value);
}

/**
 * A `tracestate` header read (FR-003): members split on commas with optional white space, a member that breaks the grammar or repeats a
 * key dropped (never the header), at most 32 members kept. Several header fields are read joined with commas.
 */
export function parseTracestate(header: string): TraceState {
  const out: TraceStateMember[] = [];
  const seen = new Set<string>();
  for (const raw of header.split(",")) {
    if (out.length >= TRACESTATE_MAX_MEMBERS) break;
    const member = raw.replace(/^[ \t]+|[ \t]+$/g, "");
    if (member === "") continue;
    const eq = member.indexOf("=");
    if (eq < 0) continue;
    const key = member.slice(0, eq);
    const value = member.slice(eq + 1);
    if (!isTraceStateKey(key) || !isTraceStateValue(value) || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, value });
  }
  return out;
}

/** A `tracestate` header: the members newest first, as they are held. */
export function formatTracestate(state: TraceState): string {
  return state
    .slice(0, TRACESTATE_MAX_MEMBERS)
    .map((m) => `${m.key}=${m.value}`)
    .join(",");
}

/** The value of a key in a trace state. */
export function traceStateGet(state: TraceState, key: string): string | undefined {
  return state.find((m) => m.key === key)?.value;
}

/** A trace state with a key set: the member moved to the front (newest), the oldest dropped beyond 32; a key or value of no grammar refused. */
export function traceStateSet(state: TraceState, key: string, value: string): Result<TraceState, string> {
  if (!isTraceStateKey(key)) return err(`${JSON.stringify(key)} is not a tracestate key`);
  if (!isTraceStateValue(value)) return err(`${JSON.stringify(value)} is not a tracestate value`);
  return ok([{ key, value }, ...state.filter((m) => m.key !== key)].slice(0, TRACESTATE_MAX_MEMBERS));
}

/** A trace state without a key. */
export function traceStateDelete(state: TraceState, key: string): TraceState {
  return state.filter((m) => m.key !== key);
}

/**
 * The context carried by a `traceparent` and a `tracestate` (an HTTP request's headers, or the `TRACEPARENT` and `TRACESTATE` of the
 * environment): undefined when there is no valid `traceparent`, whose `tracestate` is then ignored too.
 */
export function extractContext(traceparent: string | undefined, tracestate: string | undefined): SpanContext | undefined {
  if (traceparent === undefined) return undefined;
  const parent = parseTraceparent(traceparent);
  if (parent.kind === "err") return undefined;
  return { ...parent.value, traceState: tracestate === undefined ? [] : parseTracestate(tracestate) };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Resources, scopes, spans, logs, metrics (FR-001)
// ---------------------------------------------------------------------------------------------------------------------------------

/** The entity that makes the signals: `service.name` and the others. */
export type Resource = { readonly attributes: Attributes };

/** The instrumentation scope: the library or harness that makes the signals. */
export type Scope = { readonly name: string; readonly version?: string; readonly attributes?: Attributes };

/** A span's kind. */
export type SpanKind = "internal" | "server" | "client" | "producer" | "consumer";

/** A span's status: unset, ok, or an error with its description. */
export type SpanStatus = { readonly kind: "unset" } | { readonly kind: "ok" } | { readonly kind: "error"; readonly message: string };

/** Something that happened at a time during a span. */
export type SpanEvent = {
  readonly name: string;
  readonly time: bigint;
  readonly attributes: Attributes;
  readonly droppedAttributesCount: number;
};

/** A span's link to another span's context. */
export type SpanLink = {
  readonly traceId: TraceId;
  readonly spanId: SpanId;
  readonly traceState: TraceState;
  readonly traceFlags: number;
  readonly attributes: Attributes;
  readonly droppedAttributesCount: number;
};

/** A finished span. Times are nanoseconds since the Unix epoch. */
export type SpanData = {
  readonly name: string;
  readonly context: SpanContext;
  readonly parentSpanId?: SpanId;
  readonly kind: SpanKind;
  readonly startTime: bigint;
  readonly endTime: bigint;
  readonly attributes: Attributes;
  readonly events: readonly SpanEvent[];
  readonly links: readonly SpanLink[];
  readonly status: SpanStatus;
  readonly droppedAttributesCount: number;
  readonly droppedEventsCount: number;
  readonly droppedLinksCount: number;
};

/** A severity number of the log data model, 1 (TRACE) to 24 (FATAL4). */
export type SeverityNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24;

/** The first severity number of each range of the log data model. */
export const SEVERITY = { TRACE: 1, DEBUG: 5, INFO: 9, WARN: 13, ERROR: 17, FATAL: 21 } as const satisfies Readonly<
  Record<string, SeverityNumber>
>;

/** Whether a number is a severity number (an integer from 1 to 24). */
export function isSeverityNumber(n: number): n is SeverityNumber {
  return Number.isInteger(n) && n >= 1 && n <= 24;
}

/** The short name the log data model gives a severity number: `INFO`, `INFO2`, ... `FATAL4`. */
export function severityText(n: SeverityNumber): string {
  const names = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"] as const;
  const range = names[Math.floor((n - 1) / 4)] ?? "FATAL";
  const step = (n - 1) % 4;
  return step === 0 ? range : `${range}${step + 1}`;
}

/** A log record. Times are nanoseconds since the Unix epoch. */
export type LogRecord = {
  readonly time: bigint;
  readonly observedTime: bigint;
  readonly severityNumber: SeverityNumber;
  readonly severityText: string;
  readonly body?: AnyValue;
  readonly attributes: Attributes;
  readonly droppedAttributesCount: number;
  readonly eventName?: string;
  readonly traceId?: TraceId;
  readonly spanId?: SpanId;
  readonly traceFlags?: number;
};

/** How a sum or a histogram accumulates: since the last collection, or since the series began. */
export type Temporality = "delta" | "cumulative";

/** A point of a sum or a gauge: an integer (`bigint`) or a double. */
export type NumberPoint = {
  readonly attributes: Attributes;
  readonly startTime: bigint;
  readonly time: bigint;
  readonly value: bigint | number;
};

/** A point of an explicit-bucket histogram: `bucketCounts` has one more element than `bounds`, bucket `i` holding (bounds[i-1], bounds[i]]. */
export type HistogramPoint = {
  readonly attributes: Attributes;
  readonly startTime: bigint;
  readonly time: bigint;
  readonly count: number;
  readonly sum?: number;
  readonly min?: number;
  readonly max?: number;
  readonly bounds: readonly number[];
  readonly bucketCounts: readonly number[];
};

/** The data of a metric: a sum (monotonic or not), a gauge, or a histogram. */
export type MetricData =
  | { readonly kind: "sum"; readonly temporality: Temporality; readonly monotonic: boolean; readonly points: readonly NumberPoint[] }
  | { readonly kind: "gauge"; readonly points: readonly NumberPoint[] }
  | { readonly kind: "histogram"; readonly temporality: Temporality; readonly points: readonly HistogramPoint[] };

/** A metric: its name, description, unit and data. */
export type Metric = { readonly name: string; readonly description: string; readonly unit: string; readonly data: MetricData };

/** OpenTelemetry's default explicit bucket bounds for a histogram (FR-013). */
export const DEFAULT_HISTOGRAM_BOUNDS: readonly number[] = [0, 5, 10, 25, 50, 75, 100, 250, 500, 750, 1000, 2500, 5000, 7500, 10000];

// ---------------------------------------------------------------------------------------------------------------------------------
// Limits (FR-007)
// ---------------------------------------------------------------------------------------------------------------------------------

/** The limits of FR-005, applied by FR-007. `attributeValueLength` is `Infinity` where there is none. */
export type Limits = {
  readonly attributeValueLength: number;
  readonly attributeCount: number;
  readonly eventCount: number;
  readonly linkCount: number;
};

/** OpenTelemetry's default limits: no value length limit, 128 attributes, events and links. */
export const DEFAULT_LIMITS: Limits = { attributeValueLength: Infinity, attributeCount: 128, eventCount: 128, linkCount: 128 };

function cut(s: string, length: number): string {
  if (s.length <= length) return s;
  // Cut by code points, so that a surrogate pair is never split.
  return Array.from(s).slice(0, length).join("");
}

/** A value cut to the value length limit: a string, or each string of an array of strings; other values unchanged. */
export function truncateValue(value: AttributeValue, length: number): AttributeValue {
  if (!Number.isFinite(length)) return value;
  if (typeof value === "string") return cut(value, length);
  if (Array.isArray(value) && value.every((v): v is string => typeof v === "string")) return value.map((v) => cut(v, length));
  return value;
}

/**
 * Attributes added to others under the limits (FR-007): a value cut to the length limit, an existing key replaced, a new key beyond the
 * count dropped and counted.
 */
export function mergeAttributes(
  current: Attributes,
  added: Attributes,
  limits: Pick<Limits, "attributeValueLength" | "attributeCount">,
): { readonly attributes: Attributes; readonly dropped: number } {
  const out: Record<string, AttributeValue> = { ...current };
  let count = Object.keys(out).length;
  let dropped = 0;
  for (const [key, value] of Object.entries(added)) {
    if (!Object.hasOwn(out, key)) {
      if (count >= limits.attributeCount) {
        dropped++;
        continue;
      }
      count++;
    }
    out[key] = truncateValue(value, limits.attributeValueLength);
  }
  return { attributes: out, dropped };
}

/** Attributes under the limits: what `mergeAttributes` gives from none. */
export function limitAttributes(
  attributes: Attributes,
  limits: Pick<Limits, "attributeValueLength" | "attributeCount">,
): { readonly attributes: Attributes; readonly dropped: number } {
  return mergeAttributes({}, attributes, limits);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Samplers (FR-008)
// ---------------------------------------------------------------------------------------------------------------------------------

/** A sampler for a span with no parent. */
export type RootSampler =
  { readonly kind: "always_on" } | { readonly kind: "always_off" } | { readonly kind: "traceidratio"; readonly ratio: number };

/** A sampler: a root sampler, or `parentbased` (the parent's `sampled` flag where there is a parent, `root` where there is none). */
export type Sampler = RootSampler | { readonly kind: "parentbased"; readonly root: RootSampler };

/** OpenTelemetry's default sampler: `parentbased_always_on`. */
export const DEFAULT_SAMPLER: Sampler = { kind: "parentbased", root: { kind: "always_on" } };

const TWO_56 = 2 ** 56;

/**
 * The rejection threshold of `TraceIdRatioBased` for a ratio: a trace is sampled where its trace id's right-most 56 bits, read as an
 * unsigned integer, are at least the threshold (`(1 - ratio) * 2^56`). Every process of a trace decides alike from the id alone.
 */
export function ratioThreshold(ratio: number): bigint {
  const r = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 1;
  return BigInt(Math.round((1 - r) * TWO_56));
}

/** Whether a sampler samples a new span of a trace, given its parent (FR-008). */
export function shouldSample(sampler: Sampler, traceId: TraceId, parent: SpanContext | undefined): boolean {
  switch (sampler.kind) {
    case "always_on":
      return true;
    case "always_off":
      return false;
    case "traceidratio":
      return BigInt(`0x${traceId.slice(18)}`) >= ratioThreshold(sampler.ratio);
    case "parentbased":
      return parent === undefined ? shouldSample(sampler.root, traceId, undefined) : isSampled(parent);
    default:
      return absurd(sampler);
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Redaction (FR-006)
// ---------------------------------------------------------------------------------------------------------------------------------

/** What a redacted secret is written as. */
export const REDACTED = "REDACTED";

const CREDENTIAL_PARTS = [
  "token",
  "secret",
  "password",
  "passwd",
  "passphrase",
  "signature",
  "credential",
  "apikey",
  "auth",
  "cookie",
  "jwt",
];
const CREDENTIAL_WORDS = new Set(["key", "code", "sig", "pwd", "pass", "session", "sid", "otp", "awsaccesskeyid", "sas", "se", "sp", "sv"]);

/** Whether a query parameter's or a field's name says it holds a credential (`token`, `key`, `secret`, `password`, `signature`, `code`, ...). */
export function isCredentialName(name: string): boolean {
  const n = name.toLowerCase();
  if (CREDENTIAL_PARTS.some((p) => n.includes(p))) return true;
  return n.split(/[^a-z0-9]+/).some((w) => CREDENTIAL_WORDS.has(w) || (w.length > 3 && w.endsWith("key")));
}

function decodedName(name: string): string {
  try {
    return decodeURIComponent(name.replaceAll("+", " "));
  } catch {
    return name;
  }
}

const URL_HEAD = /^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^/?#]*)/;

/**
 * A URL with its secrets replaced (FR-006): the user and password of its authority, and the value of each query parameter whose name says
 * it is a credential, become `REDACTED`. The rest of the text is kept as written.
 */
export function redactUrl(url: string): string {
  let out = url;
  const head = URL_HEAD.exec(out);
  if (head !== null) {
    const scheme = head[1] ?? "";
    const authority = head[2] ?? "";
    const at = authority.lastIndexOf("@");
    if (at >= 0) {
      const userinfo = authority.slice(0, at);
      const replaced = userinfo.includes(":") ? `${REDACTED}:${REDACTED}` : REDACTED;
      out = `${scheme}${replaced}@${authority.slice(at + 1)}${out.slice(head[0].length)}`;
    }
  }
  const q = out.indexOf("?");
  if (q < 0) return out;
  const hash = out.indexOf("#", q);
  const end = hash < 0 ? out.length : hash;
  const query = out
    .slice(q + 1, end)
    .split("&")
    .map((pair) => {
      const eq = pair.indexOf("=");
      if (eq < 0) return pair;
      return isCredentialName(decodedName(pair.slice(0, eq))) ? `${pair.slice(0, eq)}=${REDACTED}` : pair;
    })
    .join("&");
  return `${out.slice(0, q + 1)}${query}${out.slice(end)}`;
}

const URL_IN_TEXT = /[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s"'<>`]+/g;
const PRIVATE_KEY = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/g;
const BEARER = /\b(Bearer)[ \t]+[A-Za-z0-9._~+/-]{8,}=*/gi;
const BASIC = /\b(Basic)[ \t]+([A-Za-z0-9+/]{4,}={0,2})/gi;
// `Authorization: <scheme> <credential>` (or `=`), quoted or not: the scheme kept, the credential replaced up to a space, quote, `,` or `;`.
const AUTHORIZATION = /\b((?:proxy-)?authorization["']?[ \t]*[:=][ \t]*["']?)(?:([A-Za-z][A-Za-z0-9-]*)[ \t]+)?([^\s"',;]+)/gi;
// `name=value`, `name: value`, `"name": "value"`: the name an identifier (with `-` and `.`), the value quoted or up to a delimiter.
const PAIR = /(["']?)\b([A-Za-z_][A-Za-z0-9_.-]*)\1([ \t]*[:=][ \t]*)("[^"\n]*"|'[^'\n]*'|[^\s"',;&)}\]]+)/g;
const SECRET_NAME_ENDINGS = [
  "token",
  "secret",
  "password",
  "passwd",
  "passphrase",
  "apikey",
  "accesskey",
  "secretkey",
  "privatekey",
  "credential",
  "signature",
] as const;
const KNOWN_TOKENS = [
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g, // GitHub
  /\bgithub_pat_[A-Za-z0-9_]{30,}\b/g,
  /\bglpat-[A-Za-z0-9_-]{20,}/g, // GitLab
  /\bxox[abposr]-[A-Za-z0-9-]{10,}/g, // Slack
  /\bxapp-[0-9]-[A-Za-z0-9-]{10,}/g,
  /\bya29\.[A-Za-z0-9._-]{20,}/g, // Google access, refresh and client secret, API key
  /(?<![A-Za-z0-9])1\/\/[A-Za-z0-9_-]{30,}/g,
  /\bGOCSPX-[A-Za-z0-9_-]{20,}/g,
  /\bAIza[0-9A-Za-z_-]{35}\b/g,
  /\bcf[au]t_[A-Za-z0-9_-]{20,}/g, // Cloudflare account and user API tokens
  /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/g, // Anthropic, OpenAI
  /\b[rs]k_(?:live|test)_[A-Za-z0-9]{16,}/g, // Stripe
  /\bnpm_[A-Za-z0-9]{36}\b/g, // npm
  /\bdo[opr]_v1_[a-f0-9]{64}\b/g, // DigitalOcean
  /\bdckr_pat_[A-Za-z0-9_-]{20,}/g, // Docker
  /\bhf_[A-Za-z]{30,}\b/g, // Hugging Face
  /\blin_(?:api|oauth)_[A-Za-z0-9]{30,}\b/g, // Linear
  /\bAT(?:ATT|BB)[A-Za-z0-9_=-]{20,}/g, // Atlassian, Bitbucket
  /\beyJ[A-Za-z0-9_-]{4,}\.eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]+/g, // JSON Web Token
  /\$(?:6|5|y|gy|2[aby])\$[^\s:"']{8,}/g, // crypt password hashes
];

function isBasicCredential(token: string): boolean {
  const bytes = fromBase64(token);
  if (bytes.kind === "err") return false;
  return new TextDecoder().decode(bytes.value).includes(":");
}

/**
 * Whether a field's name in text says its value is a secret (FR-006): it ends in `token`, `secret`, `password`, `passwd`, `passphrase`,
 * `apikey`, `accesskey`, `secretkey`, `privatekey`, `credential` or `signature`, with case, `-`, `_` and `.` ignored (`api_token`,
 * `AWS_SECRET_ACCESS_KEY`, `X-Amz-Signature`, `clientSecret`), but not `max_tokens` or `token_type`. Narrower than
 * {@link isCredentialName}, which judges a URL's query parameters, because prose is full of `code=` and `key:`.
 */
export function isSecretFieldName(name: string): boolean {
  const n = name.toLowerCase().replace(/[-_.]/g, "");
  return SECRET_NAME_ENDINGS.some((e) => n.endsWith(e));
}

/**
 * Text with its secrets replaced (FR-006), the one redaction for signals and for what a harness mails: each exact secret named in
 * `secrets` (four characters or more; a shorter one would garble the text and hide nothing), a private key block, each URL as
 * `redactUrl` writes it, a bearer token, a basic credential (base64 of `user:pass`), the credential of an `Authorization` header with any
 * scheme, the value of a `name=value` or `name: value` pair whose name {@link isSecretFieldName} judges secret (quoted or bare, in prose,
 * JSON, YAML or an environment file), and the token formats that announce themselves (GitHub, GitLab, Slack, Google, Cloudflare,
 * Anthropic, OpenAI, Stripe, npm, DigitalOcean, Docker, Hugging Face, Linear, Atlassian, JSON Web Tokens) and crypt password hashes
 * become `REDACTED`.
 */
export function redactText(text: string, secrets: Iterable<string> = []): string {
  let out = text;
  const exact = [...new Set(secrets)].filter((s) => s.length >= 4).sort((a, b) => b.length - a.length);
  for (const s of exact) out = out.split(s).join(REDACTED);
  out = out.replace(PRIVATE_KEY, REDACTED);
  out = out.replace(URL_IN_TEXT, (u) => redactUrl(u));
  out = out.replace(
    AUTHORIZATION,
    (_m, head: string, scheme: string | undefined) => `${head}${scheme === undefined ? "" : `${scheme} `}${REDACTED}`,
  );
  out = out.replace(BEARER, (_m, word: string) => `${word} ${REDACTED}`);
  out = out.replace(BASIC, (m, word: string, token: string) => (isBasicCredential(token) ? `${word} ${REDACTED}` : m));
  out = out.replace(PAIR, (m, quote: string, name: string, sep: string, value: string) => {
    if (!isSecretFieldName(name)) return m;
    const q = value.startsWith('"') || value.startsWith("'") ? value.charAt(0) : "";
    return `${quote}${name}${quote}${sep}${q}${REDACTED}${q}`;
  });
  for (const re of KNOWN_TOKENS) out = out.replace(re, REDACTED);
  return out;
}

/** An attribute value with its secrets replaced: `redactText` on a string and on each string of an array. */
export function redactValue(value: AttributeValue): AttributeValue {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value) && value.every((v): v is string => typeof v === "string")) return value.map((v) => redactText(v));
  return value;
}

/** A log body with its secrets replaced, at every depth. */
export function redactAnyValue(value: AnyValue): AnyValue {
  if (typeof value === "string") return redactText(value);
  if (value instanceof Uint8Array || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v: AnyValue) => redactAnyValue(v));
  const out: Record<string, AnyValue> = {};
  for (const [k, v] of Object.entries(value)) {
    Object.defineProperty(out, k, { value: redactAnyValue(v), enumerable: true, writable: true, configurable: true });
  }
  return out;
}

/** Attributes with the secret ones left out (never written, FR-006) and every other string redacted by `redactText`. */
export function redactAttributes(attributes: Attributes, secretKeys: Iterable<string> = []): Attributes {
  const secret = new Set(secretKeys);
  const out: Record<string, AttributeValue> = {};
  for (const [key, value] of Object.entries(attributes)) if (!secret.has(key)) out[key] = redactValue(value);
  return out;
}

/**
 * A command line as it may be recorded (FR-006): the program's name (its last path segment) and the names of its options alone, never a
 * value, an operand or a subcommand. `--opt=value` is kept as `--opt`, a short option as its first letter (`-pSECRET` as `-p`), and
 * nothing after `--`.
 */
export function commandShape(argv: readonly string[]): readonly string[] {
  const [program, ...rest] = argv;
  if (program === undefined) return [];
  const out = [program.split(/[/\\]/).pop() ?? program];
  for (const arg of rest) {
    if (arg === "--") break;
    if (arg.startsWith("--")) out.push(arg.split("=")[0] ?? arg);
    else if (arg.startsWith("-") && arg.length > 1 && !/^-[0-9.]/.test(arg)) out.push(arg.slice(0, 2));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Configuration (FR-005)
// ---------------------------------------------------------------------------------------------------------------------------------

/** The three signals. */
export type SignalName = "traces" | "logs" | "metrics";

/** Where and how one signal is exported. `endpoint` is undefined where none is configured (the runtime then probes the default). */
export type ExporterConfig = {
  readonly enabled: boolean;
  readonly endpoint: string | undefined;
  readonly headers: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
};

/** The settings of a batch processor (`OTEL_BSP_*`, `OTEL_BLRP_*`). */
export type BatchConfig = {
  readonly scheduleDelayMs: number;
  readonly exportTimeoutMs: number;
  readonly maxQueueSize: number;
  readonly maxExportBatchSize: number;
};

/** The SDK's own log level (`OTEL_LOG_LEVEL`). */
export type LogLevel = "none" | "error" | "warn" | "info" | "debug" | "verbose" | "all";

/** The configuration the `OTEL_*` variables give. */
export type OtelConfig = {
  readonly disabled: boolean;
  readonly resource: Attributes;
  readonly exporters: { readonly [S in SignalName]: ExporterConfig };
  readonly sampler: Sampler;
  readonly spanBatch: BatchConfig;
  readonly logBatch: BatchConfig;
  readonly metricExportIntervalMs: number;
  readonly metricExportTimeoutMs: number;
  readonly limits: Limits;
  readonly logLevel: LogLevel;
};

/** The endpoint an OTLP/HTTP exporter uses where none is configured. */
export const DEFAULT_OTLP_ENDPOINT = "http://localhost:4318";

/** The path of each signal under a base endpoint. */
export const SIGNAL_PATHS: { readonly [S in SignalName]: string } = { traces: "v1/traces", logs: "v1/logs", metrics: "v1/metrics" };

const SIGNAL_VARIABLE: { readonly [S in SignalName]: string } = { traces: "TRACES", logs: "LOGS", metrics: "METRICS" };

const LOG_LEVELS: readonly LogLevel[] = ["none", "error", "warn", "info", "debug", "verbose", "all"];

function isUrl(text: string): boolean {
  try {
    const u = new URL(text);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** A base endpoint with a signal's path appended, with one `/` between them. */
export function signalEndpoint(base: string, signal: SignalName): string {
  return `${base.endsWith("/") ? base : `${base}/`}${SIGNAL_PATHS[signal]}`;
}

/** `key=value` pairs separated by commas, values percent-decoded; undefined where one pair is not valid. */
function keyValues(text: string): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const raw of text.split(",")) {
    const pair = raw.trim();
    if (pair === "") continue;
    const eq = pair.indexOf("=");
    if (eq <= 0) return undefined;
    const key = pair.slice(0, eq).trim();
    if (key === "") return undefined;
    try {
      out[decodeURIComponent(key)] = decodeURIComponent(pair.slice(eq + 1).trim());
    } catch {
      return undefined;
    }
  }
  return out;
}

/**
 * The configuration of the OpenTelemetry environment variables, from a record of them (FR-005): the kernel reads no environment. A value
 * that is not valid is a warning and its default is used; an empty value counts as unset; no vendor's variable is read. A protocol other
 * than `http/json` is a warning and disables the export of that signal.
 */
export function resolveConfig(env: Readonly<Record<string, string | undefined>>): {
  readonly config: OtelConfig;
  readonly warnings: readonly string[];
} {
  const warnings: string[] = [];
  const get = (name: string): string | undefined => {
    const v = env[name]?.trim();
    return v === undefined || v === "" ? undefined : v;
  };
  const bool = (name: string): boolean => {
    const v = get(name);
    if (v === undefined) return false;
    if (v.toLowerCase() === "true") return true;
    if (v.toLowerCase() !== "false") warnings.push(`${name}=${v} is not true or false; false is used`);
    return false;
  };
  const int = (name: string, fallback: number, min = 0): number => {
    const v = get(name);
    if (v === undefined) return fallback;
    if (!/^[0-9]+$/.test(v) || Number(v) < min || !Number.isSafeInteger(Number(v))) {
      warnings.push(`${name}=${v} is not an integer of at least ${min}; ${fallback} is used`);
      return fallback;
    }
    return Number(v);
  };

  const disabled = bool("OTEL_SDK_DISABLED");

  const resource: Record<string, AttributeValue> = {};
  const attrs = get("OTEL_RESOURCE_ATTRIBUTES");
  if (attrs !== undefined) {
    const parsed = keyValues(attrs);
    if (parsed === undefined) warnings.push("OTEL_RESOURCE_ATTRIBUTES is not a list of key=value pairs; it is ignored");
    else Object.assign(resource, parsed);
  }
  const serviceName = get("OTEL_SERVICE_NAME");
  if (serviceName !== undefined) resource["service.name"] = serviceName;

  const genericHeaders = (() => {
    const v = get("OTEL_EXPORTER_OTLP_HEADERS");
    if (v === undefined) return {};
    const parsed = keyValues(v);
    if (parsed === undefined) warnings.push("OTEL_EXPORTER_OTLP_HEADERS is not a list of key=value pairs; it is ignored");
    return parsed ?? {};
  })();
  const genericEndpoint = (() => {
    const v = get("OTEL_EXPORTER_OTLP_ENDPOINT");
    if (v === undefined || isUrl(v)) return v;
    warnings.push(`OTEL_EXPORTER_OTLP_ENDPOINT=${redactUrl(v)} is not an http or https URL; it is ignored`);
    return undefined;
  })();
  const genericTimeout = int("OTEL_EXPORTER_OTLP_TIMEOUT", 10000);
  const genericProtocol = get("OTEL_EXPORTER_OTLP_PROTOCOL");

  const exporter = (signal: SignalName): ExporterConfig => {
    const S = SIGNAL_VARIABLE[signal];
    let enabled = true;
    const protocolName =
      get(`OTEL_EXPORTER_OTLP_${S}_PROTOCOL`) === undefined ? "OTEL_EXPORTER_OTLP_PROTOCOL" : `OTEL_EXPORTER_OTLP_${S}_PROTOCOL`;
    const protocol = get(`OTEL_EXPORTER_OTLP_${S}_PROTOCOL`) ?? genericProtocol ?? "http/json";
    if (protocol !== "http/json") {
      warnings.push(`${protocolName}=${protocol} is not supported (only http/json is); ${signal} are not exported`);
      enabled = false;
    }
    const exporterName = get(`OTEL_${S}_EXPORTER`) ?? "otlp";
    const names = exporterName.split(",").map((n) => n.trim());
    if (names.includes("none")) enabled = false;
    else if (!names.includes("otlp")) {
      warnings.push(`OTEL_${S}_EXPORTER=${exporterName} is not supported (only otlp and none are); ${signal} are not exported`);
      enabled = false;
    }
    let endpoint = genericEndpoint === undefined ? undefined : signalEndpoint(genericEndpoint, signal);
    const own = get(`OTEL_EXPORTER_OTLP_${S}_ENDPOINT`);
    if (own !== undefined) {
      if (isUrl(own)) endpoint = own;
      else warnings.push(`OTEL_EXPORTER_OTLP_${S}_ENDPOINT=${redactUrl(own)} is not an http or https URL; it is ignored`);
    }
    let headers = genericHeaders;
    const ownHeaders = get(`OTEL_EXPORTER_OTLP_${S}_HEADERS`);
    if (ownHeaders !== undefined) {
      const parsed = keyValues(ownHeaders);
      if (parsed === undefined) warnings.push(`OTEL_EXPORTER_OTLP_${S}_HEADERS is not a list of key=value pairs; it is ignored`);
      else headers = parsed;
    }
    const timeoutMs = int(`OTEL_EXPORTER_OTLP_${S}_TIMEOUT`, genericTimeout);
    return { enabled: enabled && !disabled, endpoint, headers, timeoutMs };
  };

  const ratio = (() => {
    const v = get("OTEL_TRACES_SAMPLER_ARG");
    if (v === undefined) return 1;
    const n = Number(v);
    if (!/^[0-9.eE+-]+$/.test(v) || !Number.isFinite(n) || n < 0 || n > 1) {
      warnings.push(`OTEL_TRACES_SAMPLER_ARG=${v} is not a ratio from 0 to 1; 1 is used`);
      return 1;
    }
    return n;
  })();
  const sampler = ((): Sampler => {
    const v = get("OTEL_TRACES_SAMPLER");
    switch (v) {
      case undefined:
        return DEFAULT_SAMPLER;
      case "always_on":
        return { kind: "always_on" };
      case "always_off":
        return { kind: "always_off" };
      case "traceidratio":
        return { kind: "traceidratio", ratio };
      case "parentbased_always_on":
        return { kind: "parentbased", root: { kind: "always_on" } };
      case "parentbased_always_off":
        return { kind: "parentbased", root: { kind: "always_off" } };
      case "parentbased_traceidratio":
        return { kind: "parentbased", root: { kind: "traceidratio", ratio } };
      default:
        warnings.push(`OTEL_TRACES_SAMPLER=${v} is not supported; parentbased_always_on is used`);
        return DEFAULT_SAMPLER;
    }
  })();

  const batch = (prefix: "OTEL_BSP" | "OTEL_BLRP", scheduleDelay: number): BatchConfig => {
    const maxQueueSize = int(`${prefix}_MAX_QUEUE_SIZE`, 2048, 1);
    let maxExportBatchSize = int(`${prefix}_MAX_EXPORT_BATCH_SIZE`, Math.min(512, maxQueueSize), 1);
    if (maxExportBatchSize > maxQueueSize) {
      warnings.push(`${prefix}_MAX_EXPORT_BATCH_SIZE is more than ${prefix}_MAX_QUEUE_SIZE; ${maxQueueSize} is used`);
      maxExportBatchSize = maxQueueSize;
    }
    return {
      scheduleDelayMs: int(`${prefix}_SCHEDULE_DELAY`, scheduleDelay),
      exportTimeoutMs: int(`${prefix}_EXPORT_TIMEOUT`, 30000),
      maxQueueSize,
      maxExportBatchSize,
    };
  };

  const valueLength =
    get("OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT") === undefined ? Infinity : int("OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT", Infinity);
  const limits: Limits = {
    attributeValueLength: valueLength,
    attributeCount: int("OTEL_ATTRIBUTE_COUNT_LIMIT", 128),
    eventCount: int("OTEL_SPAN_EVENT_COUNT_LIMIT", 128),
    linkCount: int("OTEL_SPAN_LINK_COUNT_LIMIT", 128),
  };

  const logLevel = ((): LogLevel => {
    const v = get("OTEL_LOG_LEVEL")?.toLowerCase();
    if (v === undefined) return "info";
    const found = LOG_LEVELS.find((l) => l === v);
    if (found === undefined) warnings.push(`OTEL_LOG_LEVEL=${v} is not one of ${LOG_LEVELS.join(", ")}; info is used`);
    return found ?? "info";
  })();

  const config: OtelConfig = {
    disabled,
    resource,
    exporters: { traces: exporter("traces"), logs: exporter("logs"), metrics: exporter("metrics") },
    sampler,
    spanBatch: batch("OTEL_BSP", 5000),
    logBatch: batch("OTEL_BLRP", 1000),
    metricExportIntervalMs: int("OTEL_METRIC_EXPORT_INTERVAL", 60000),
    metricExportTimeoutMs: int("OTEL_METRIC_EXPORT_TIMEOUT", 30000),
    limits,
    logLevel,
  };
  return { config, warnings };
}
