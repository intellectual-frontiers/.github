/**
 * A world of fakes for the native runner of the reconcile form: a system with settings that a person or a program changes, the wanted settings, and verbs bound to them, so that a pass needs no machine. Every name is synthetic.
 *
 * @module
 */
import { ok } from "@intellectual-frontiers/core";
import { type ItemEvent, instantOfMs, msOfInstant } from "@intellectual-frontiers/planning/governance";
import { CONVERGE_SETTINGS, parsePlan, type Reconcile, type Value } from "@intellectual-frontiers/workload/forms/reconcile";
import type { EventSink, ReconcileDeps, VerbBinding, VerbBindings } from "@intellectual-frontiers/workload/physical";
import { AGENT, eventId, ITEM, must } from "./kit.ts";
import { NOW } from "./world.ts";

export type RWorld = {
  deps: ReconcileDeps;
  events: ItemEvent[];
  live: Record<string, Value>;
  desired: Record<string, Value>;
  calls: string[];
  clock: { now: typeof NOW };
};

export function rworld(over: { live?: Record<string, Value>; desired?: Record<string, Value>; actor?: ReconcileDeps["actor"]; bindings?: Record<string, VerbBinding> } = {}): RWorld {
  const events: ItemEvent[] = [];
  const calls: string[] = [];
  const live: Record<string, Value> = { ...(over.live ?? { "synthetic-setting-a": "on", "synthetic-setting-b": 1, "synthetic-setting-z": true }) };
  const desired: Record<string, Value> = { ...(over.desired ?? { "synthetic-setting-a": "off", "synthetic-setting-b": 1, "synthetic-setting-c": true }) };
  const clock = { now: NOW };
  let n = 0;
  const observe: VerbBinding = async (inputs) => {
    calls.push(`observe ${String(inputs["store"])}`);
    return ok({ digests: [], outputs: { ...(inputs["store"] === "synthetic-live-01" ? live : desired) } });
  };
  const apply: VerbBinding = async (inputs) => {
    calls.push(`apply ${String(inputs["key"])}`);
    for (const c of parsePlan(String(inputs["changes"])) ?? []) {
      if (c.action === "delete") delete live[c.key];
      else if (c.to !== undefined) live[c.key] = c.to;
    }
    return ok({ digests: [String(inputs["key"])], outputs: {} });
  };
  const verify: VerbBinding = async () => {
    calls.push("verify");
    const keys = new Set([...Object.keys(live), ...Object.keys(desired)]);
    return ok({ digests: [], outputs: {}, holds: [...keys].every((k) => live[k] === desired[k]) });
  };
  const bindings: VerbBindings = new Map<string, VerbBinding>([["state.observe", observe], ["state.apply", apply], ["state.verify", verify], ...Object.entries(over.bindings ?? {})]);
  const sink: EventSink = {
    append: async (e) => {
      events.push(e);
      return ok(undefined);
    },
    read: async () => [...events],
  };
  const deps: ReconcileDeps = {
    bindings,
    sink,
    source: { now: () => clock.now, nextEventId: () => (n += 1, eventId(n)), instantAfterHours: (from, h) => must(instantOfMs(msOfInstant(from) + h * 3600000)) },
    actor: over.actor ?? AGENT,
    item: ITEM,
    inputs: {},
  };
  return { deps, events, live, desired, calls, clock };
}

/** The starter loop with a change made to one of its nodes. */
export const withNodes = (f: (nodes: Reconcile["nodes"]) => Reconcile["nodes"]): Reconcile => ({ ...CONVERGE_SETTINGS, nodes: f(CONVERGE_SETTINGS.nodes) });
