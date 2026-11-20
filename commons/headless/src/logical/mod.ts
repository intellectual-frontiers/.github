// Spec: 0001-headless-layers FR-001
/**
 * Layer 2 of Headless, the logical layer: what a command is and what it returns, whatever surface draws it (commons headless 0003-headless-output).
 * The command model (a verb of the terminal's declaration with the facts of its action and the function that runs it), the typed outcome, the
 * verbosity modes, the closing block as data, the one JSON document and SARIF, the mechanism of `explain` and `translate`, the cadence of hints, a
 * run nested in a run, and the redaction of an outcome. It imports Core, the governance layer, and the terminal's `args` and `commands`; it
 * draws nothing, so it needs no marks, no colour and no host.
 *
 * @example
 * ```ts
 * import { closingOf, outcomeOf } from "@intellectual-frontiers/headless/logical";
 * closingOf(outcomeOf(null), { fix: { commands: [], own: [] }, shownHints: [] }).verdict.text; // "Up to date"
 * ```
 *
 * @module
 */
export * from "./closing.ts";
export * from "./compose.ts";
export * from "./envelope.ts";
export * from "./executor.ts";
export * from "./explain.ts";
export * from "./fix.ts";
export * from "./hints.ts";
export * from "./machine.ts";
export * from "./model.ts";
export * from "./nested.ts";
export * from "./outcome.ts";
export * from "./program.ts";
export * from "./redaction.ts";
export * from "./remote.ts";
export * from "./verbosity.ts";
export * from "./visibility.ts";
