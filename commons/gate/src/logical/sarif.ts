// Spec: 0002-policy-gate FR-008
/**
 * The verdict as SARIF 2.1.0 (0002-policy-gate FR-008), so that a CI system or a code host shows each violation where a developer looks: one result for each violation that blocks or warns, at the level `error` or `warning`; a waived violation is a result that is suppressed, with the
 * waiver's reason as its justification. The document is a pure function of the verdict.
 *
 * @example
 * ```ts
 * import { toSarif } from "./sarif.ts";
 * toSarif({ pass: true, blocking: [], warnings: [], waived: [], unusedWaivers: [], checked: 0 }, "gate").version; // "2.1.0"
 * ```
 *
 * @module
 */
import type { Verdict, Violation } from "@intellectual-frontiers/gate/governance";

/** The SARIF document of a verdict, `tool` being the name that runs the gate. */
export function toSarif(v: Verdict, tool: string): { readonly version: "2.1.0"; readonly runs: readonly unknown[] } {
  const all: readonly Violation[] = [...v.blocking, ...v.warnings, ...v.waived];
  const rules = [...new Map(all.map((x) => [x.rule, x])).values()].map((x) => ({ id: x.rule, name: x.rule, shortDescription: { text: x.title }, properties: { controls: [...x.controls] } }));
  return {
    version: "2.1.0",
    runs: [{
      tool: { driver: { name: tool, rules } },
      results: all.map((x) => ({
        ruleId: x.rule,
        level: x.severity === "block" ? "error" : "warning",
        message: { text: `${x.subject}: ${x.message}` },
        locations: [{ logicalLocations: [{ name: x.subject }] }],
        ...(x.waived === undefined ? {} : { suppressions: [{ kind: "external", justification: `${x.waived.reason} (by ${x.waived.by}, until ${x.waived.until})` }] }),
      })),
    }],
  };
}
