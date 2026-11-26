/**
 * What the tests of the fleet store share: an asset or two with made up names, the stores they are kept in, and the little functions that make a test read as what it says. Every name is made up.
 *
 * @module
 */
import { assert } from "@intellectual-frontiers/test";
import { memoryStore, type MemoryStore } from "@intellectual-frontiers/anyfs/memory";
import { parsePath, type Path } from "@intellectual-frontiers/anyfs/governance";
import { makeStore, type Op, type OpCapability, opCapabilitiesOf, type Store } from "@intellectual-frontiers/anyfs/logical";
import { parseReplicaName, type ReplicaName } from "@intellectual-frontiers/anyfs-bridge/mirror";
import { type Asset, defineAsset } from "../src/governance/mod.ts";
import { type FleetConfig, type FleetStore, openFleetStore } from "../src/physical/mod.ts";

/** A path from text; the test fails where it is not one. */
export const path = (text: string): Path => {
  const r = parsePath(text);
  assert(r.kind === "ok", `${text} is a path`);
  return r.value;
};

/** A replica name from text. */
export const named = (text: string): ReplicaName => {
  const r = parseReplicaName(text);
  assert(r.kind === "ok", `${text} is a name`);
  return r.value;
};

/** An adopted asset with a made up identity. */
export function adopted(id: string, kind = "server"): Asset {
  const made = defineAsset({ id, kind, state: "adopted", origin: "paired", owners: { observe: "desired-os-state", verify: "desired-os-state" } });
  assert(made.kind === "ok", `${id} is an asset`);
  return made.value;
}

/** A managed asset with a made up identity. */
export function managed(id: string): Asset {
  const made = defineAsset({
    id,
    kind: "server",
    state: "managed",
    owners: { provision: "desired-os-state", identity: "desired-os-state", plan: "desired-os-state", converge: "desired-os-state", verify: "desired-os-state", observe: "desired-os-state", update: "desired-os-state", access: "desired-os-state", backup: "desired-os-state", retire: "desired-os-state" },
  });
  assert(made.kind === "ok", `${id} is an asset`);
  return made.value;
}

/** A clock that gives the same instant, and one that moves on each time it is asked. */
export const fixedClock = (ms: number): (() => number) => () => ms;
export const ticking = (start: number, step = 1000): (() => number) => {
  let now = start - step;
  return () => (now += step);
};

/** A fleet store in memory made for a test; the test fails where it cannot be made. */
export async function fleetOf(store: MemoryStore = memoryStore({ name: "record" }), extra: Partial<FleetConfig> = {}): Promise<{ readonly fleet: FleetStore; readonly store: MemoryStore }> {
  const opened = await openFleetStore({ primary: { name: named("record"), store }, create: true, actor: "operator", clock: ticking(Date.UTC(2026, 10, 20, 9, 0, 0)), ...extra });
  assert(opened.kind === "ok", `the fleet store opens: ${opened.kind === "err" ? JSON.stringify(opened.error) : ""}`);
  return { fleet: opened.value, store };
}

/** The bytes of a text. */
export const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

/** A store that tells a hook of each operation before the store does it: what counts the operations a call makes, or changes the store between two of them. */
export function hooked(base: MemoryStore, hook: (op: Op) => Promise<void> | void): Store<OpCapability> {
  return makeStore({
    id: base.id,
    place: base.place,
    consistency: base.consistency,
    traits: base.traits,
    capabilities: opCapabilitiesOf(base),
    handle: async (op) => {
      await hook(op);
      return base.handle(op);
    },
  });
}
