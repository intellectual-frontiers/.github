/**
 * The GRC host (commons 0007-grc FR-022): waivers, risk registers, impact declarations and any other data the caller has a decoder for,
 * loaded from TOML, YAML, JSON or JSON5 files (chosen by the file's extension) with the kernel's parsers and decoders. An error names the
 * file and either where its text stops parsing (line and column) or the path of the value that does not decode (`$.waivers[1].expiresAt`).
 * A list file holds its items either as its top-level array or under one key (`waivers`, `risks`, `declarations`), so TOML, whose top
 * level is a table, writes them as `[[waivers]]`. TOML dates and times are read as their ISO 8601 text, so a TOML offset date-time
 * decodes as an `Instant`. Packs are code (their checks are functions), so a harness defines them in TypeScript and loads a pack's
 * settings with `loadData` and a decoder of its own.
 *
 * Its signals (FR-019): `runPackObserved` runs a pack as `runPack` does, to the same assessment, and says so in the signals of
 * `GRC_SIGNALS` (0006-signals): a `grc.pack` span for the run, a `grc.control` span under it for each control and subject checked, ending
 * `error` where the check's outcome is `fail` or `error` and `ok` otherwise, and each finding a log record in its check's span whose body is
 * its OCSF Compliance Finding (`ocsfBody`; an integer is an OTLP `intValue`). The record's severity is the finding's:
 *
 * | finding severity | log record severity | log kind |
 * | --- | --- | --- |
 * | `info`, `low` | 9 `INFO` | `grc.finding.info` |
 * | `medium` | 13 `WARN` | `grc.finding.warn` |
 * | `high` | 17 `ERROR` | `grc.finding.error` |
 * | `critical` | 21 `FATAL` | `grc.finding.fatal` |
 *
 * A log kind's severity is fixed where it is declared, so each severity is a kind of its own; the finding's own severity is the
 * record's `grc.severity` attribute, which tells `info` from `low`.
 *
 * @example
 * ```ts
 * import { formatLoadError, loadWaivers } from "./grc.ts";
 * const w = await loadWaivers("grc/waivers.toml");
 * if (w.kind === "err") console.error(formatLoadError(w.error));
 * ```
 *
 * @module
 */
import { absurd } from "../kernel/absurd.ts";
import { type ImpactDeclaration, impactDeclarationDecoder, type RiskInput, riskDecoder } from "../kernel/assess.ts";
import { array, type DecodeError, type Decoder, describe, formatDecodeError } from "../kernel/decode.ts";
import {
  type Assessment,
  applyWaivers,
  type CheckContext,
  controlSummary,
  type Finding,
  joinAll,
  countOutcomes,
  type Outcome,
  type Pack,
  runCheck,
  runPack,
  type Severity,
  subjectRef,
  type Waiver,
  waiverDecoder,
} from "../kernel/grc.ts";
import { parseJson5 } from "../kernel/json5.ts";
import { complianceFinding, type OcsfComplianceFinding, type OcsfProduct } from "../kernel/ocsf.ts";
import { type AnyMap, type AnyValue, SEVERITY, type Scope, type SeverityNumber } from "../kernel/otel.ts";
import { err, ok, type Result } from "../kernel/result.ts";
import { defineSignals, type Telemetry } from "../kernel/signals.ts";
import { isTomlDateTime, parseToml, type TomlValue } from "../kernel/toml.ts";
import { parseYaml } from "../kernel/yaml.ts";
import { readTextFile } from "./fs.ts";
import { installed, type Pipeline } from "./otel.ts";

/** A data file's format. */
export type DataFormat = "toml" | "yaml" | "json" | "json5";

const EXTENSIONS: ReadonlyMap<string, DataFormat> = new Map([
  ["toml", "toml"],
  ["yaml", "yaml"],
  ["yml", "yaml"],
  ["json", "json"],
  ["json5", "json5"],
]);

/** The format of a file by its extension (`.toml`, `.yaml` or `.yml`, `.json`, `.json5`, in any case), or undefined for any other. */
export function formatOf(path: string): DataFormat | undefined {
  const ext = /\.([A-Za-z0-9]+)$/.exec(path)?.[1]?.toLowerCase();
  return ext === undefined ? undefined : EXTENSIONS.get(ext);
}

/** Why a data file could not be loaded, each naming the file. */
export type LoadError =
  | { readonly kind: "read"; readonly file: string; readonly reason: string }
  | { readonly kind: "format"; readonly file: string }
  | {
      readonly kind: "parse";
      readonly file: string;
      readonly format: DataFormat;
      readonly line: number;
      readonly column: number;
      readonly message: string;
    }
  | { readonly kind: "decode"; readonly file: string; readonly error: DecodeError };

/** A load error as one line: `grc/waivers.toml: $.waivers[0].expiresAt: expected ...`. */
export function formatLoadError(e: LoadError): string {
  switch (e.kind) {
    case "read":
      return `${e.file}: cannot read: ${e.reason}`;
    case "format":
      return `${e.file}: not a .toml, .yaml, .yml, .json or .json5 file`;
    case "parse":
      return `${e.file}:${e.line}:${e.column}: not ${e.format.toUpperCase()}: ${e.message}`;
    case "decode":
      return `${e.file}: ${formatDecodeError(e.error)}`;
    default:
      return absurd(e);
  }
}

/** A TOML value as plain data: each date or time its ISO 8601 text. */
function plainToml(v: TomlValue): unknown {
  if (Array.isArray(v)) return v.map(plainToml);
  if (typeof v !== "object") return v;
  if (isTomlDateTime(v)) return v.text;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) out[k] = plainToml(x);
  return out;
}

/** The line and column (from 1) of a character offset in a text. */
function position(text: string, offset: number): { readonly line: number; readonly column: number } {
  const before = text.slice(0, offset).split("\n");
  return { line: before.length, column: (before[before.length - 1] ?? "").length + 1 };
}

/** A text of a format as plain data, or where it stops being that format; `file` names it in the error. */
export function parseData(text: string, format: DataFormat, file: string): Result<unknown, LoadError> {
  switch (format) {
    case "toml": {
      const r = parseToml(text);
      return r.kind === "ok"
        ? ok(plainToml(r.value))
        : err({ kind: "parse", file, format, line: r.error.line, column: r.error.column, message: r.error.message });
    }
    case "yaml": {
      const r = parseYaml(text);
      return r.kind === "ok"
        ? r
        : err({ kind: "parse", file, format, line: r.error.line, column: r.error.column, message: r.error.message });
    }
    case "json5": {
      const r = parseJson5(text);
      return r.kind === "ok"
        ? r
        : err({ kind: "parse", file, format, line: r.error.line, column: r.error.column, message: r.error.message });
    }
    case "json": {
      try {
        const value: unknown = JSON.parse(text);
        return ok(value);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const at = /position (\d+)/.exec(message);
        const { line, column } = at === null ? { line: 1, column: 1 } : position(text, Number(at[1]));
        return err({ kind: "parse", file, format, line, column, message });
      }
    }
    default:
      return absurd(format);
  }
}

/** A text of a format decoded, or the error naming `file` and where the text or the value goes wrong. */
export function decodeData<T>(text: string, format: DataFormat, file: string, decoder: Decoder<T>): Result<T, LoadError> {
  const parsed = parseData(text, format, file);
  if (parsed.kind === "err") return parsed;
  const r = decoder(parsed.value, "$");
  return r.kind === "ok" ? r : err({ kind: "decode", file, error: r.error });
}

/** A file read, parsed by its extension's format and decoded; or the error naming the file and what went wrong where. */
export async function loadData<T>(path: string, decoder: Decoder<T>): Promise<Result<T, LoadError>> {
  const format = formatOf(path);
  if (format === undefined) return err({ kind: "format", file: path });
  let text: string;
  try {
    text = await readTextFile(path);
  } catch (e) {
    return err({ kind: "read", file: path, reason: e instanceof Error ? e.message : String(e) });
  }
  return decodeData(text.replace(/^\ufeff/, ""), format, path, decoder);
}

/** A list of items decoded from either a top-level array or the array under `key` of a top-level table (`[[key]]` in TOML). */
export function listOf<T>(key: string, item: Decoder<T>): Decoder<readonly T[]> {
  const items = array(item);
  return (input, path = "$") => {
    if (Array.isArray(input)) return items(input, path);
    if (typeof input === "object" && input !== null && key in input) {
      const inner: unknown = Reflect.get(input, key);
      return items(inner, `${path}.${key}`);
    }
    return err({ kind: "decode", path, expected: `an array, or a table with an array \`${key}\``, found: describe(input) });
  };
}

/** The waivers a file holds (a list, or under `waivers`), each refused as `defineWaiver` refuses (no expiry, an expiry before its grant, ...). */
export function loadWaivers(path: string): Promise<Result<readonly Waiver[], LoadError>> {
  return loadData(path, listOf("waivers", waiverDecoder));
}

/** The risks a file holds (a list, or under `risks`), for `riskRegister`. */
export function loadRisks(path: string): Promise<Result<readonly RiskInput[], LoadError>> {
  return loadData(path, listOf("risks", riskDecoder));
}

/** The impact declarations a file holds (a list, or under `declarations`), for `gate`. */
export function loadImpactDeclarations(path: string): Promise<Result<readonly ImpactDeclaration[], LoadError>> {
  return loadData(path, listOf("declarations", impactDeclarationDecoder));
}

// ---------------------------------------------------------------------------------------------------------------------------- signals (FR-019)

const FINDING_ATTRIBUTES = {
  "grc.pack.id": "string",
  "grc.control.id": "string",
  "grc.subject.kind": "string",
  "grc.subject.id": "string",
  "grc.status": "string",
  "grc.outcome": "string",
  "grc.severity": "string",
  "grc.waiver.id?": "string",
} as const;

const findingLog = (severity: SeverityNumber, name: string) =>
  ({
    signal: "log",
    severity,
    role: "none",
    description: `A finding of ${name} severity; its body is the finding's OCSF Compliance Finding (class 2003).`,
    attributes: FINDING_ATTRIBUTES,
  }) as const;

/** The signals of a pack run (0006-signals FR-009): the run's span, a span for each check, and a log kind for each record severity. */
export const GRC_SIGNALS = defineSignals({
  "grc.pack": {
    signal: "span",
    role: "step",
    description: "A pack run: its id, how many controls and subjects, and how many findings of each outcome.",
    attributes: {
      "grc.pack.id": "string",
      "grc.pack.controls": "int",
      "grc.pack.subjects": "int",
      "grc.pack.findings?": "int",
      "grc.outcome?": "string",
      "grc.findings.not-applicable?": "int",
      "grc.findings.pass?": "int",
      "grc.findings.accepted?": "int",
      "grc.findings.warn?": "int",
      "grc.findings.gap?": "int",
      "grc.findings.fail?": "int",
      "grc.findings.error?": "int",
    },
  },
  "grc.control": {
    signal: "span",
    role: "detail",
    description: "One control's check of one subject: the join of its findings' statuses and of their outcomes, waivers applied.",
    attributes: {
      "grc.pack.id": "string",
      "grc.control.id": "string",
      "grc.subject.kind": "string",
      "grc.subject.id": "string",
      "grc.status?": "string",
      "grc.outcome?": "string",
      "grc.findings?": "int",
    },
  },
  "grc.finding.info": findingLog(SEVERITY.INFO, "info or low"),
  "grc.finding.warn": findingLog(SEVERITY.WARN, "medium"),
  "grc.finding.error": findingLog(SEVERITY.ERROR, "high"),
  "grc.finding.fatal": findingLog(SEVERITY.FATAL, "critical"),
});

/** The kinds of the GRC registry. */
export type GrcKinds = (typeof GRC_SIGNALS)["kinds"];

/** The scope of the GRC signals. */
export const GRC_SCOPE: Scope = { name: "ifc-ts/grc" };

/** The log kind of a finding of each severity (the table in the module's documentation). */
export const FINDING_LOG_KIND = {
  info: "grc.finding.info",
  low: "grc.finding.info",
  medium: "grc.finding.warn",
  high: "grc.finding.error",
  critical: "grc.finding.fatal",
} as const satisfies Readonly<Record<Severity, keyof GrcKinds>>;

/** A JSON value as an OTLP `AnyValue`: an integer as an `intValue` (a `bigint`), any other number a `doubleValue`, `null` left out. */
export function toAnyValue(json: unknown): AnyValue | undefined {
  if (typeof json === "string" || typeof json === "boolean") return json;
  if (typeof json === "number") return Number.isSafeInteger(json) ? BigInt(json) : json;
  if (Array.isArray(json)) return json.flatMap((v: unknown) => toAnyValue(v) ?? []);
  return typeof json === "object" && json !== null ? toAnyMap(json) : undefined;
}

function toAnyMap(json: object): AnyMap {
  const out: Record<string, AnyValue> = {};
  for (const [k, v] of Object.entries(json)) {
    const a = toAnyValue(v);
    if (a !== undefined) Object.defineProperty(out, k, { value: a, enumerable: true, writable: true, configurable: true });
  }
  return out;
}

/** An OTLP `AnyValue` as JSON, undoing `toAnyValue`: an integer a `number`, bytes a list of numbers (an OCSF body holds none). */
export function fromAnyValue(value: AnyValue): unknown {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Uint8Array) return [...value];
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v: AnyValue) => fromAnyValue(v));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    Object.defineProperty(out, k, { value: fromAnyValue(v), enumerable: true, writable: true, configurable: true });
  }
  return out;
}

/** An OCSF Compliance Finding as a log record's body: an OTLP map, each integer an `intValue`. */
export function ocsfBody(doc: OcsfComplianceFinding): AnyMap {
  return toAnyMap(doc);
}

/** What `runPackObserved` takes beside the pack, its subjects and the context. */
export type ObservedOptions = {
  readonly waivers?: readonly Waiver[];
  /** The telemetry to say the run in; the installed pipeline's by default, and none (the run unobserved) where none is installed. */
  readonly telemetry?: Telemetry<GrcKinds>;
  /** The product the OCSF documents name as their writer. */
  readonly product: OcsfProduct;
};

const telemetries = new WeakMap<Pipeline, Telemetry<GrcKinds>>();

/** The GRC telemetry of the installed pipeline (one for each pipeline), or undefined where none is installed. */
export function installedGrcTelemetry(): Telemetry<GrcKinds> | undefined {
  const pipeline = installed();
  if (pipeline === undefined) return undefined;
  let t = telemetries.get(pipeline);
  if (t === undefined) {
    t = pipeline.telemetry(GRC_SIGNALS, GRC_SCOPE);
    telemetries.set(pipeline, t);
  }
  return t;
}

const failing = (o: Outcome): boolean => o === "fail" || o === "error";

/** What a span that ends `error` returns: its status message (the span's `describeError` reads `message`) and the value all the same. */
type Failing<T> = { readonly message: string; readonly value: T };

const countAttributes = (findings: readonly Finding[]): Readonly<Record<`grc.findings.${Outcome}`, number>> => {
  const c = countOutcomes(findings);
  return {
    "grc.findings.not-applicable": c["not-applicable"],
    "grc.findings.pass": c.pass,
    "grc.findings.accepted": c.accepted,
    "grc.findings.warn": c.warn,
    "grc.findings.gap": c.gap,
    "grc.findings.fail": c.fail,
    "grc.findings.error": c.error,
  };
};

/**
 * A pack run as `runPack` runs it, to the same assessment, said in signals (FR-019): a `grc.pack` span, a `grc.control` span for each
 * control and subject in the order `runPack` checks them (`error` where its outcome is `fail` or `error`, else `ok`), and a log record of
 * each finding, waivers applied, whose body is its OCSF Compliance Finding. With no telemetry given or installed, it is `runPack`.
 */
export async function runPackObserved<S, C extends CheckContext>(
  pack: Pack<S, C>,
  subjects: readonly S[],
  context: C,
  options: ObservedOptions,
): Promise<Assessment> {
  const waivers = options.waivers ?? [];
  const telemetry = options.telemetry ?? installedGrcTelemetry();
  if (telemetry === undefined) return runPack(pack, subjects, context, { waivers });
  const refs = subjects.map((s, i) => subjectRef(pack, s, i));
  const start = { "grc.pack.id": pack.id, "grc.pack.controls": pack.controls.length, "grc.pack.subjects": subjects.length };
  const run = await telemetry.span("grc.pack", start, async (packSpan): Promise<Result<Assessment, Failing<Assessment>>> => {
    const findings: Finding[] = [];
    for (const control of pack.controls) {
      for (const [i, subject] of subjects.entries()) {
        const ref = refs[i] ?? { kind: pack.subjectKind, id: `#${i}` };
        const at = { "grc.pack.id": pack.id, "grc.control.id": control.id, "grc.subject.kind": ref.kind, "grc.subject.id": ref.id };
        const checked = await packSpan.span(
          "grc.control",
          at,
          async (span): Promise<Result<readonly Finding[], Failing<readonly Finding[]>>> => {
            // Waivers apply to each finding alone, so applying them to one check's findings is applying them to the run's.
            const found = applyWaivers(await runCheck(control, subject, ref, context), waivers, context.at);
            const status = joinAll(found.map((f) => f.status));
            const outcome = joinAll(found.map((f) => f.outcome));
            span.set({ "grc.status": status, "grc.outcome": outcome, "grc.findings": found.length });
            for (const f of found) {
              span.log(
                FINDING_LOG_KIND[f.severity],
                {
                  ...at,
                  "grc.status": f.status,
                  "grc.outcome": f.outcome,
                  "grc.severity": f.severity,
                  ...(f.waiver === undefined ? {} : { "grc.waiver.id": f.waiver }),
                },
                ocsfBody(complianceFinding(f, { product: options.product })),
              );
            }
            return failing(outcome) ? err({ message: `${control.id} ${outcome} for ${ref.kind} ${ref.id}`, value: found }) : ok(found);
          },
        );
        // A failing check's span ends `error`; its findings are the assessment's all the same.
        findings.push(...(checked.kind === "ok" ? checked.value : checked.error.value));
      }
    }
    const outcome = joinAll(findings.map((f) => f.outcome));
    packSpan.set({ "grc.pack.findings": findings.length, "grc.outcome": outcome, ...countAttributes(findings) });
    const assessment: Assessment = {
      pack: { id: pack.id, title: pack.title },
      at: context.at,
      controls: pack.controls.map(controlSummary),
      subjects: refs,
      findings,
    };
    if (!failing(outcome)) return ok(assessment);
    const n = findings.filter((f) => failing(f.outcome)).length;
    return err({ message: `${pack.id}: ${n} of ${findings.length} findings fail or error`, value: assessment });
  });
  return run.kind === "ok" ? run.value : run.error.value;
}
