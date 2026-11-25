/**
 * A world of fakes for the native runners of the tests: the stores, the workshop, the agent and the verbs are values, so that a run needs no machine. Every name is synthetic.
 *
 * @module
 */
import { ok } from "@intellectual-frontiers/core";
import { type ItemEvent, instantOfMs, msOfInstant, parseInstant } from "@intellectual-frontiers/planning/governance";
import { VERBS } from "@intellectual-frontiers/workload/governance";
import { RESTORE_DRILL, type Runbook } from "@intellectual-frontiers/workload/forms/runbook";
import type { AgentPort, EventSink, RunDeps, StoreCatalog, VerbBinding, VerbBindings, WorkshopPort } from "@intellectual-frontiers/workload/physical";
import { AGENT, eventId, ITEM, must } from "./kit.ts";

export const NOW = must(parseInstant("2026-11-25T10:00:00Z"));
export const LATER = must(parseInstant("2026-11-30T10:00:00Z"));

export type World = { deps: RunDeps; events: ItemEvent[]; calls: string[]; workshop: string[]; asked: unknown[]; clock: { now: typeof NOW } };

export function world(over: { bindings?: Record<string, VerbBinding>; agent?: AgentPort; actor?: RunDeps["actor"]; offers?: Record<string, readonly string[]>; rb?: Runbook; fleet?: RunDeps["fleet"] } = {}): World {
  const events: ItemEvent[] = [];
  const calls: string[] = [];
  const workshop: string[] = [];
  const asked: unknown[] = [];
  const clock = { now: NOW };
  let n = 0;
  const bind = (id: string): VerbBinding => async () => {
    calls.push(id);
    return ok({ digests: [`digest-${id}`], outputs: { digest: "0".repeat(64) }, holds: true });
  };
  const bindings: VerbBindings = new Map([...VERBS.list().map((v) => [v.id as string, bind(v.id)] as const), ...Object.entries(over.bindings ?? {})]);
  const rb = over.rb ?? RESTORE_DRILL;
  const sink: EventSink = {
    append: async (e) => {
      events.push(e);
      return ok(undefined);
    },
    read: async () => [...events],
  };
  const stores: StoreCatalog = { offer: (ref) => { const d = rb.stores.find((s) => s.ref === ref); return d === undefined ? undefined : { ref, class: d.class, capabilities: (over.offers?.[ref] ?? d.needs) as never }; } };
  const port: WorkshopPort = { attach: async (r) => (workshop.push(`attach ${r}`), ok(undefined)), detach: async (r) => (workshop.push(`detach ${r}`), ok(undefined)) };
  const agent: AgentPort = over.agent ?? { propose: async (r) => (asked.push(r), { summary: "same", attention: [], outcome: "restored" }) };
  const deps: RunDeps = {
    bindings,
    agent,
    sink,
    stores,
    workshop: port,
    source: { now: () => clock.now, nextEventId: () => (n += 1, eventId(n)), instantAfterHours: (from, h) => must(instantOfMs(msOfInstant(from) + h * 3600000)) },
    actor: over.actor ?? AGENT,
    item: ITEM,
    inputs: { order: "synthetic-order-01" },
    ...(over.fleet === undefined ? {} : { fleet: over.fleet }),
  };
  return { deps, events, calls, workshop, asked, clock };
}

