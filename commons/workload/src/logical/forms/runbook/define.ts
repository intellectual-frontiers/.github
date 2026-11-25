// Spec: 0008-form-runbook FR-006, FR-007
/**
 * The validators of a runbook that are about the data and not about the world: an id used twice, a step that names a step that is not where it must be, a store that is not declared, a need that names an installer, and an
 * effect on a system of record with no idempotency key. `defineRunbook` gives the runbook back or every finding; `decodeRunbook` makes a runbook of a value from outside and then runs it. Pure.
 *
 * @example
 * ```ts
 * import { defineRunbook } from "./define.ts";
 * // defineRunbook(runbook): a Result of the same runbook, or the findings
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Finding, finding } from "@intellectual-frontiers/workload/governance";
import { installer } from "@intellectual-frontiers/workload/logical";
import { runbookFinding } from "./catalog.ts";
import { type Runbook, type Step, flatten } from "./step.ts";

/** The runbook, or every reason it is not well formed. */
export function defineRunbook(input: Runbook): Result<Runbook, readonly Finding[]> {
  const out: Finding[] = [];
  const bad = (step: string, message: string): void => void out.push(runbookFinding("E-RB-RUNBOOK-MALFORMED", step, message, { node: message }));
  if (input.steps.length === 0) bad("", "a runbook has at least one step");
  const flat = flatten(input.steps);
  const index = new Map<string, number>();
  for (const [i, s] of flat.entries()) {
    if (index.has(s.id)) bad(s.id, `the step id ${s.id} is used twice`);
    index.set(s.id, i);
  }
  const stores = new Map(input.stores.map((s) => [String(s.ref), s]));
  if (stores.size !== input.stores.length) bad("", "a store is declared twice");
  const stepBad = (s: Step, message: string): void => bad(s.id, `${s.id}: ${message}`);
  const earlier = (s: Step, id: string): boolean => (index.get(id) ?? Number.POSITIVE_INFINITY) < (index.get(s.id) ?? -1);
  const undos = new Set(flat.filter((s) => s.kind === "undo").map((s) => String(s.id)));
  const checkEffect = (s: Step, e: { readonly store: string; readonly class: string; readonly mode: string; readonly compensation?: string; readonly idempotencyKey?: string }, inputs: Readonly<Record<string, unknown>>): void => {
    const decl = stores.get(e.store);
    if (decl === undefined) stepBad(s, `its effect names the store ${e.store}, which the runbook does not declare`);
    else if (decl.class !== e.class) stepBad(s, `its effect says ${e.store} is ${e.class}, and the runbook declares it ${decl.class}`);
    if (e.compensation !== undefined && !undos.has(e.compensation)) stepBad(s, `its effect names the undo ${e.compensation}, which is none`);
    if (e.class === "external" && e.mode !== "read" && (e.idempotencyKey === undefined || !Object.hasOwn(inputs, e.idempotencyKey))) out.push(finding("E-WL-EXTERNAL-NO-KEY", s.id, `${s.id} changes a system of record and names no input as its idempotency key`));
  };
  for (const s of flat) {
    for (const n of s.needs ?? []) if (installer(n)) out.push(finding("E-WL-NEED-INSTALLER", s.id, `the need ${n.id} of ${s.id} names an installer`));
    switch (s.kind) {
      case "verb":
        checkEffect(s, s.effect, s.inputs);
        break;
      case "undo":
        checkEffect(s, s.effect, s.inputs);
        if (!index.has(s.compensates)) stepBad(s, `it compensates ${s.compensates}, which is no step of the runbook`);
        break;
      case "branch":
        if (!earlier(s, s.on)) stepBad(s, `it reads ${s.on}, which is not a step before it`);
        break;
      case "gate":
        for (const g of s.guards) if (!index.has(g) || (index.get(g) ?? -1) <= (index.get(s.id) ?? 0)) stepBad(s, `it guards ${g}, which is not a step after it`);
        break;
      case "check":
      case "ask":
      case "judge":
      case "each":
        break;
      default:
        return s satisfies never;
    }
    const used = s.kind === "verb" || s.kind === "check" || s.kind === "undo" ? s.inputs : {};
    for (const v of Object.values(used)) {
      if (v.kind === "store" && !stores.has(v.store)) stepBad(s, `it names the store ${v.store}, which the runbook does not declare`);
      if (v.kind === "output" && !earlier(s, v.step)) stepBad(s, `it reads the output of ${v.step}, which is not a step before it`);
    }
  }
  for (const n of input.needs) if (installer(n)) out.push(finding("E-WL-NEED-INSTALLER", "", `the need ${n.id} of the runbook names an installer`, { node: "the runbook" }));
  return out.length === 0 ? ok(input) : err(out);
}
