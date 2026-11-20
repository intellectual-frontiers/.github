// Spec: 0002-workspace-model FR-033
/**
 * What a check of the workspace reports (commons 0002-workspace-model FR-033, FR-035): a finding has a rule, a severity (`ergonex:Informational`, `ergonex:Warning`, `ergonex:Error`), a message, what it is
 * about and the day it was first seen; it is written as a SARIF 2.1.0 log whose results have the level of the severity; and a finding about something outside the catalog grows from informational
 * to a warning once it is more than the grace days old, counted from the day first seen and never restarted by a later run.
 *
 * @remarks
 * Days are `YYYY-MM-DD` texts, and every function takes the day it needs as an argument: nothing here reads a clock. A finding's message says what is wrong and what to do, and holds no secret:
 * the caller gives the file and the line, never the line's text.
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";

/** The severities of a finding, the keys of the code list `ergonex:Severity`. */
export type Severity = "Informational" | "Warning" | "Error";

/** All the severities, least serious first. */
export const SEVERITIES: readonly Severity[] = ["Informational", "Warning", "Error"];

/** What a check reports. */
export type Finding = {
  /** The rule that found it, such as `ergonex/path-too-long`. */
  readonly ruleId: string;
  readonly severity: Severity;
  /** What is wrong and what to do about it. */
  readonly message: string;
  /** What it is about: a path, a repository, a tool. */
  readonly subject: string;
  /** The day it was first seen, `YYYY-MM-DD`. */
  readonly firstSeen: string;
};

/** The SARIF level of a severity, the `ergonex:sarifLevel` of the code list. */
export function sarifLevel(severity: Severity): "note" | "warning" | "error" {
  switch (severity) {
    case "Informational":
      return "note";
    case "Warning":
      return "warning";
    case "Error":
      return "error";
    default:
      return absurd(severity);
  }
}

/** The most serious severity of a list, or undefined for none. */
export function worst(findings: readonly Finding[]): Severity | undefined {
  let top: Severity | undefined;
  for (const f of findings) if (top === undefined || SEVERITIES.indexOf(f.severity) > SEVERITIES.indexOf(top)) top = f.severity;
  return top;
}

/** The exit status of a run with these findings: `Findings` where one is a warning or an error, `Ok` where there is none or all are informational (0001-ergonex FR-010). */
export function exitStatusOf(findings: readonly Finding[]): "Ok" | "Findings" {
  const top = worst(findings);
  return top === "Warning" || top === "Error" ? "Findings" : "Ok";
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A day as the number of days since 1970-01-01, or undefined where the text is not a real day. */
export function dayNumber(day: string): number | undefined {
  const m = DAY.exec(day);
  if (m === null) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d);
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return undefined;
  return Math.round(ms / 86_400_000);
}

/** The whole days from one day to another (negative where `to` is before `from`), or an error naming the text that is not a day. */
export function daysBetween(from: string, to: string): Result<number, string> {
  const a = dayNumber(from);
  const b = dayNumber(to);
  if (a === undefined) return err(`${JSON.stringify(from)} is not a day (YYYY-MM-DD)`);
  if (b === undefined) return err(`${JSON.stringify(to)} is not a day (YYYY-MM-DD)`);
  return ok(b - a);
}

/** The grace period of a tool or module outside the catalog, in days (`ergonex:unapprovedGraceDays`). */
export const UNAPPROVED_GRACE_DAYS = 90;

/**
 * The severity of a tool or module outside the catalog first seen on `firstSeen`, judged on `today`: informational from the day it is first seen, a warning once it is more than `graceDays` old
 * (FR-033). The 90th day is still informational and the 91st is a warning. A day that is not a day, or is in the future, is informational (a clock set wrong must not fail a run).
 */
export function unapprovedSeverity(firstSeen: string, today: string, graceDays: number = UNAPPROVED_GRACE_DAYS): Severity {
  const age = daysBetween(firstSeen, today);
  return age.kind === "ok" && age.value > graceDays ? "Warning" : "Informational";
}

/**
 * The day to record for something seen `today`: the day it was recorded before where there is one, so that a later run never restarts the clock (FR-033), else today. `previous` is the state
 * record's days by key.
 */
export function firstSeenOf(previous: Readonly<Record<string, string>>, key: string, today: string): string {
  const before = Object.hasOwn(previous, key) ? previous[key] : undefined;
  return before !== undefined && dayNumber(before) !== undefined ? before : today;
}

/** A SARIF 2.1.0 log of findings: one run, the rules that found them, one result each at the level of its severity. */
export type SarifLog = {
  readonly $schema: string;
  readonly version: "2.1.0";
  readonly runs: readonly [
    {
      readonly tool: {
        readonly driver: {
          readonly name: string;
          readonly informationUri: string;
          readonly rules: readonly { readonly id: string }[];
        };
      };
      readonly results: readonly {
        readonly ruleId: string;
        readonly level: "note" | "warning" | "error";
        readonly message: { readonly text: string };
        readonly locations: readonly {
          readonly logicalLocations: readonly { readonly name: string }[];
        }[];
        readonly properties: { readonly firstSeen: string };
      }[];
    },
  ];
};

/** The findings as a SARIF 2.1.0 log (FR-035); `tool` is the name of the command that made them. */
export function toSarif(findings: readonly Finding[], tool = "ergonex"): SarifLog {
  const rules = [...new Set(findings.map((f) => f.ruleId))].sort().map((id) => ({ id }));
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: tool,
            informationUri: "https://intellectual-frontiers.github.io/.github/",
            rules,
          },
        },
        results: findings.map((f) => ({
          ruleId: f.ruleId,
          level: sarifLevel(f.severity),
          message: { text: f.message },
          locations: [{ logicalLocations: [{ name: f.subject }] }],
          properties: { firstSeen: f.firstSeen },
        })),
      },
    ],
  };
}
