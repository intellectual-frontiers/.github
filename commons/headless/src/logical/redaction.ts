// Spec: 0003-headless-output FR-011
/**
 * The redaction policy of an outcome (commons headless 0003-headless-output FR-011): before anything is drawn, logged or returned, every text of the
 * outcome (messages, fixes, raw errors, outcome lines, steps, hints, the report's text, and every string of its data, however deep) passes
 * through the program's redactor, so that no surface has to remember to. The mask is the governance's; the policy is where it is applied.
 *
 * @example
 * ```ts
 * import { redactOutcome } from "./redaction.ts";
 * import { outcomeOf } from "./outcome.ts";
 * import { redactor } from "@intellectual-frontiers/headless/governance";
 * redactOutcome(outcomeOf({ url: "postgres://a:hunter22@h/x" }), redactor([])).data; // { url: "postgres://a:***@h/x" }
 * ```
 *
 * @module
 */
import type { Problem, Redactor } from "@intellectual-frontiers/headless/governance";
import type { Finding, Hint, Outcome } from "./outcome.ts";
import type { ProgressEvent } from "./model.ts";

/** A value with every string in it redacted, whatever it is made of (arrays and plain objects are walked; other values are kept as they are). */
export function redactValue(value: unknown, redact: Redactor): unknown {
  if (typeof value === "string") return redact(value);
  if (Array.isArray(value)) return value.map((v) => redactValue(v, redact));
  if (value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactValue(v, redact)]));
  }
  return value;
}

function redactProblem(p: Problem, redact: Redactor): Problem {
  return {
    ...p,
    message: redact(p.message),
    ...(p.fix === undefined ? {} : { fix: redact(p.fix) }),
    ...(p.raw === undefined ? {} : { raw: redact(p.raw) }),
  };
}

function redactHint(h: Hint, redact: Redactor): Hint {
  return { ...h, message: redact(h.message), ...(h.command === undefined ? {} : { command: redact(h.command) }) };
}

function redactFinding(f: Finding, redact: Redactor): Finding {
  return { ...f, message: redact(f.message) };
}

/** The outcome with every text redacted. Redacting twice is redacting once. */
export function redactOutcome<D>(o: Outcome<D>, redact: Redactor): Outcome<D> {
  return {
    data: redactValue(o.data, redact) as D,
    text: o.text === undefined ? undefined : redact(o.text),
    problems: o.problems.map((p) => redactProblem(p, redact)),
    outcomes: o.outcomes.map(redact),
    hints: o.hints.map((h) => redactHint(h, redact)),
    next: o.next.map(redact),
    findings: o.findings.map((f) => redactFinding(f, redact)),
    title: o.title === undefined ? undefined : redact(o.title),
    cancelled: o.cancelled,
  };
}

/** A progress event with every text redacted: what a command tells while it runs is held to the policy as much as what it returns. */
export function redactEvent(event: ProgressEvent, redact: Redactor): ProgressEvent {
  switch (event.kind) {
    case "header":
      return { ...event, title: redact(event.title), subtitle: redact(event.subtitle) };
    case "phase":
      return { ...event, name: redact(event.name) };
    case "step":
      return { ...event, label: redact(event.label) };
    case "item":
      return { ...event, message: redact(event.message) };
    case "problem":
      return { ...event, problem: redactProblem(event.problem, redact) };
    case "outcome":
      return { ...event, text: redact(event.text) };
    case "hint":
      return { ...event, hint: redactHint(event.hint, redact) };
    case "live":
      return { ...event, message: redact(event.message) };
    case "done":
      return { ...event, result: redact(event.result) };
  }
}
