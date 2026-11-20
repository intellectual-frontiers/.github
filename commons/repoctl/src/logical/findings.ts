// Spec: 0002-repoctl-governance FR-004
/**
 * What a verb finds, as values (commons repoctl 0002-repoctl-governance FR-004): a finding has a level, a code of the closed union, a sentence that names its subject, and the command that fixes it. The Physical layer turns
 * a finding into Headless' problem; nothing here knows how it is drawn.
 *
 * @example
 * ```ts
 * import { finding } from "./findings.ts";
 * finding("fail", "E-STALE-GENERATED", "readme: README.md is stale", "bun commons/libraries/src/readme.ts").code; // "E-STALE-GENERATED"
 * ```
 *
 * @module
 */
import type { ProblemCode } from "@intellectual-frontiers/repoctl/governance";

/** How serious a finding is: a failure fails the run, a warning does not. */
export type Level = "fail" | "warn";

/** A finding: its level, its code, what is wrong and what to run. */
export type Finding = { readonly level: Level; readonly code: ProblemCode; readonly message: string; readonly fix: string };

/** A finding of the given level and code. */
export function finding(level: Level, code: ProblemCode, message: string, fix: string): Finding {
  return { level, code, message, fix };
}

/** The lines of a program's output that say something, without the blank ones and trimmed, at most `n` of them from the end. */
export function tailLines(text: string, n: number): readonly string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "")
    .slice(-n);
}
