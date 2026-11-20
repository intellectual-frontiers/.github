// Spec: 0003-headless-output FR-006, FR-007
/**
 * The machine's view of a run (commons headless 0003-headless-output FR-006, FR-007): one JSON document, with a fixed shape and order of keys, that
 * says how the run ended, what it found and what it returned; and the same findings as SARIF 2.1.0 for the tools that read it. Nothing here is
 * coloured, marked or cut to a width: a document is not drawn.
 *
 * @example
 * ```ts
 * import { envelopeOf, jsonText } from "./envelope.ts";
 * import { outcomeOf } from "./outcome.ts";
 * jsonText(envelopeOf({ program: "tool", command: "status", outcome: outcomeOf({ n: 1 }), code: 0 })).startsWith("{"); // true
 * ```
 *
 * @module
 */
import { countsOf, exitNameOf, type Counts, type Problem } from "@intellectual-frontiers/headless/governance";
import { findingsOfProblems, type Finding, type Hint, type Outcome } from "./outcome.ts";

/** The name and version of the document's shape: a reader checks it. */
export const ENVELOPE_SCHEMA = "headless.envelope/1";

/** A JSON value. */
export type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };

/**
 * A value as JSON: what JSON cannot say is made what it can (`undefined` properties are left out, a `bigint` is its digits as a string, a `Date`
 * its ISO text, a number that is not finite `null`, a function or symbol left out), so that writing it never throws.
 */
export function toJson(value: unknown): Json {
  if (value === null || value === undefined) return null;
  switch (typeof value) {
    case "boolean":
    case "string":
      return value;
    case "number":
      return Number.isFinite(value) ? value : null;
    case "bigint":
      return value.toString();
    case "function":
    case "symbol":
      return null;
    case "object": {
      if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
      if (Array.isArray(value)) return value.map((v) => toJson(v));
      // `fromEntries` defines each key as an own property: a key named `__proto__` is data here, never the prototype
      return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined && typeof v !== "function" && typeof v !== "symbol").map(([k, v]) => [k, toJson(v)]));
    }
    default:
      return null;
  }
}

/** The document a run ends with. */
export type Envelope = {
  readonly schema: typeof ENVELOPE_SCHEMA;
  readonly program: string;
  readonly version?: string;
  readonly command: string;
  readonly ok: boolean;
  readonly exit: { readonly code: number; readonly name: string };
  readonly counts: Counts;
  readonly problems: readonly Problem[];
  readonly outcomes: readonly string[];
  readonly hints: readonly Hint[];
  readonly next: readonly string[];
  readonly data: Json;
};

/** What an envelope is made from. */
export type EnvelopeInput = {
  readonly program: string;
  readonly version?: string;
  /** The words of the command as typed (`work build`); empty for the program itself. */
  readonly command: string;
  readonly outcome: Outcome;
  /** The status the run ends with. */
  readonly code: number;
};

/** The envelope of a run. `ok` is whether nothing failed; `exit.name` is the table's name of the status, or `other`. */
export function envelopeOf(i: EnvelopeInput): Envelope {
  const counts = countsOf(i.outcome.problems);
  return {
    schema: ENVELOPE_SCHEMA,
    program: i.program,
    ...(i.version === undefined ? {} : { version: i.version }),
    command: i.command,
    ok: counts.fail === 0 && i.code === 0,
    exit: { code: i.code, name: exitNameOf(i.code) ?? "other" },
    counts,
    problems: i.outcome.problems,
    outcomes: i.outcome.outcomes,
    hints: i.outcome.hints,
    next: i.outcome.next,
    data: toJson(i.outcome.data),
  };
}

/** The envelope as the one document a run writes: indented, ending in a newline. */
export function jsonText(e: Envelope): string {
  return `${JSON.stringify(e, null, 2)}\n`;
}

/** What SARIF takes of a run. */
export type SarifInput = { readonly program: string; readonly version?: string; readonly outcome: Outcome };

/** A SARIF 2.1.0 log of a run's findings (those it returned, else those its failures and warnings make). */
export function sarifOf(i: SarifInput): Json {
  const findings: readonly Finding[] = i.outcome.findings.length > 0 ? i.outcome.findings : findingsOfProblems(i.outcome.problems);
  const rules = [...new Set(findings.map((f) => f.ruleId))].sort();
  return toJson({
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: { driver: { name: i.program, ...(i.version === undefined ? {} : { version: i.version }), rules: rules.map((id) => ({ id })) } },
        results: findings.map((f) => ({
          ruleId: f.ruleId,
          level: f.level,
          message: { text: f.message },
          ...(f.file === undefined
            ? {}
            : { locations: [{ physicalLocation: { artifactLocation: { uri: f.file }, ...(f.line === undefined ? {} : { region: { startLine: f.line } }) } }] }),
        })),
      },
    ],
  });
}

/** SARIF as the one document a run writes. */
export function sarifText(i: SarifInput): string {
  return `${JSON.stringify(sarifOf(i), null, 2)}\n`;
}
