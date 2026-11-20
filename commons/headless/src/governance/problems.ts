// Spec: 0002-headless-governance FR-008
/**
 * What a run found, as the one contract every headless program shares (commons headless 0002-headless-governance FR-008): a problem has one of
 * four levels, a stable code that can be searched for and written down, a message, and the one step that fixes it. A failure and a warning are
 * problems; `pending` is something not set up yet that is expected until someone does it; `action` is a step that is the person's to take.
 * Neither of the last two is wrong, so neither is a failure.
 *
 * @example
 * ```ts
 * import { countsOf, isProblemCode, problem } from "./problems.ts";
 * const p = problem("fail", "the disk is full", { code: "E105-DISK", fix: "df -h" });
 * isProblemCode(p.code); // true
 * countsOf([p]); // { fail: 1, warn: 0, pending: 0, action: 0 }
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import type { Counts } from "./exits.ts";

/** How serious a problem is: `fail` and `warn` are problems; `pending` waits on time or someone else; `action` is the person's to take. */
export type ProblemLevel = "fail" | "warn" | "pending" | "action";

/** Every level, in the order a closing block shows them. */
export const PROBLEM_LEVELS: readonly ProblemLevel[] = ["fail", "warn", "action", "pending"];

/** A problem a run found. */
export type Problem = {
  readonly level: ProblemLevel;
  /** What happened, in a plain sentence. */
  readonly message: string;
  /** The phase it happened in, where the run has phases. */
  readonly phase?: string;
  /** How to fix it (for `pending` and `action`: the next step): one command, or a sentence that holds one. */
  readonly fix?: string;
  /** A stable code: `E` for a problem, `P` for something pending, then letters and digits and dashes. */
  readonly code?: string;
  /** The raw text of a system error, when `message` is its plain sentence: shown with `--verbose`. */
  readonly raw?: string;
  /** Its line in the run's log, where there is one. */
  readonly logLine?: number;
};

/** A problem's optional fields, given by name. */
export type ProblemFields = {
  readonly phase?: string;
  readonly fix?: string;
  readonly code?: string;
  readonly raw?: string;
  readonly logLine?: number;
};

/** A problem, made with only the fields that are given (a field never holds `undefined`). */
export function problem(level: ProblemLevel, message: string, fields: ProblemFields = {}): Problem {
  return {
    level,
    message,
    ...(fields.phase === undefined ? {} : { phase: fields.phase }),
    ...(fields.fix === undefined ? {} : { fix: fields.fix }),
    ...(fields.code === undefined ? {} : { code: fields.code }),
    ...(fields.raw === undefined ? {} : { raw: fields.raw }),
    ...(fields.logLine === undefined ? {} : { logLine: fields.logLine }),
  };
}

/** The shape of a stable code: `E` or `P`, an optional number or word, a dash, and upper-case words joined by dashes (`E105-DISK`, `P-WAITING`). */
const CODE = /^[EP][0-9A-Z]*-[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

/** Whether a value is a stable problem code. */
export function isProblemCode(text: unknown): text is string {
  return typeof text === "string" && CODE.test(text);
}

/** Whether a code is the code of a pending thing (`P...`), which is never a failure. */
export function isPendingCode(code: string): boolean {
  return isProblemCode(code) && code.startsWith("P");
}

/** The codes a problem carries when its raiser gave none: one per level, a program's own to configure. */
export type GenericCodes = Readonly<Record<ProblemLevel, string>>;

/** The generic codes of a program that has no numbers of its own. */
export const DEFAULT_GENERIC_CODES: GenericCodes = {
  fail: "E000-FAILED",
  warn: "E000-WARNING",
  pending: "P000-WAITING",
  action: "E000-YOURS",
};

/** The problem with the code of its level where it has none. */
export function withCode(p: Problem, generic: GenericCodes = DEFAULT_GENERIC_CODES): Problem {
  return p.code === undefined ? { ...p, code: generic[p.level] } : p;
}

/** How many problems of each level. */
export function countsOf(problems: readonly Problem[]): Counts {
  const n = { fail: 0, warn: 0, pending: 0, action: 0 };
  for (const p of problems) {
    switch (p.level) {
      case "fail":
        n.fail += 1;
        break;
      case "warn":
        n.warn += 1;
        break;
      case "pending":
        n.pending += 1;
        break;
      case "action":
        n.action += 1;
        break;
      default:
        absurd(p.level);
    }
  }
  return n;
}

/** The problems of a level, in the order found. */
export function ofLevel(problems: readonly Problem[], level: ProblemLevel): readonly Problem[] {
  return problems.filter((p) => p.level === level);
}
