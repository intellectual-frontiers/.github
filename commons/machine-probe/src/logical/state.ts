// Spec: 0005-machine-probe-state FR-001, FR-002, FR-003, FR-004
/**
 * The state of a machine as it is kept in Git: the keyed records of an observation and the status of each policy, with no time, no probe version and no counter that changes on its own, written as JSON with its keys in order so that a machine that did
 * not change gives the same bytes and so no change in Git; and the structured difference of two states, which names each path added, removed or changed with both values, and each policy whose status moved.
 *
 * @example
 * ```ts
 * import { diffStates, stateText, type MachineState } from "./state.ts";
 * const a: MachineState = { format: "machine-state/1", records: { os: { family: "ubuntu" } }, policies: { firewall: "fail" } };
 * stateText(a) === stateText(a); // true
 * diffStates(a, a).equal; // true
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Json } from "@intellectual-frontiers/grc/governance";
import { drift, type Drift } from "@intellectual-frontiers/grc/logical";
import { observedState, type Observed } from "./observed.ts";
import { evaluate } from "./policies.ts";

/** The state of a machine: what was observed of it and how each policy judges it. */
export type MachineState = {
  readonly format: "machine-state/1";
  readonly records: Readonly<Record<string, Json>>;
  /** The finding of each policy that does not depend on the time (a policy about how old the observation is is the journal's). */
  readonly policies: Readonly<Record<string, string>>;
};

/** The policies that depend on the time and not on the machine: they are left out of the state. */
const TIME_POLICIES: readonly string[] = ["observed"];

/** The state of an observation. */
export function stateOf(o: Observed): MachineState {
  const policies: Record<string, string> = {};
  for (const r of evaluate(o, o.at)) if (!TIME_POLICIES.includes(r.id)) policies[r.id] = r.status;
  return { format: "machine-state/1", records: observedState(o), policies };
}

function sorted(value: Json): Json {
  if (Array.isArray(value)) return value.map(sorted);
  if (typeof value === "object" && value !== null) return Object.fromEntries(Object.keys(value).sort().map((k) => [k, sorted((value as Record<string, Json>)[k] as Json)]));
  return value;
}

/** The text of a state: JSON with the keys in order, two spaces and a final line break, the same for the same state, so that a line that changed is a line Git shows. */
export function stateText(s: MachineState): string {
  return `${JSON.stringify(sorted(s as unknown as Json), null, 2)}\n`;
}

/** A state from its text, or why it is not one. */
export function readState(text: string): Result<MachineState, string> {
  try {
    const v = JSON.parse(text) as Partial<MachineState> | null;
    if (v === null || typeof v !== "object" || v.format !== "machine-state/1" || typeof v.records !== "object" || v.records === null || typeof v.policies !== "object" || v.policies === null) return err("the text is not a machine state");
    return ok(v as MachineState);
  } catch {
    return err("the text is not JSON");
  }
}

/** A policy whose finding moved. */
export type PolicyMove = { readonly id: string; readonly from: string | null; readonly to: string | null };

/** What differs between two states. */
export type StateDiff = { readonly equal: boolean; readonly records: Drift; readonly policies: readonly PolicyMove[] };

/** The difference between an earlier state and a later one: the keyed records as `grc` tells drift (added, removed and changed, naming the path and both values) and each policy that moved, in order of the policies' ids. */
export function diffStates(from: MachineState, to: MachineState): StateDiff {
  const records = drift(from.records, to.records);
  const ids = [...new Set([...Object.keys(from.policies), ...Object.keys(to.policies)])].sort();
  const policies = ids.flatMap((id): PolicyMove[] => {
    const a = from.policies[id] ?? null;
    const b = to.policies[id] ?? null;
    return a === b ? [] : [{ id, from: a, to: b }];
  });
  return { equal: records.added.length === 0 && records.removed.length === 0 && records.changed.length === 0 && policies.length === 0, records, policies };
}
