// Spec: 0006-estate-fleet-store FR-011
/**
 * The fleet store for development and tests (commons estate 0006-estate-fleet-store): a store in memory or in a folder, with no replicas and no host, opened with the same function and holding the same documents
 * as the store of a fleet, so that everything the estate does with stored data can be done and tried before a host is named.
 *
 * @example
 * ```ts
 * import { devFleetStore } from "./dev.ts";
 * const fleet = await devFleetStore({ kind: "memory" }, { actor: "operator" });
 * fleet.kind; // "ok"
 * ```
 *
 * @module
 */
import { err, type Result } from "@intellectual-frontiers/core";
import { localStore } from "@intellectual-frontiers/anyfs/local";
import { memoryStore } from "@intellectual-frontiers/anyfs/memory";
import { parseReplicaName } from "@intellectual-frontiers/anyfs-bridge/mirror";
import { type FleetConfig, type FleetStore, openFleetStore } from "./fleet.ts";
import { documentsProblem, type FleetProblem } from "./problem.ts";

/** Where a development store is kept: in memory, or in a folder that is made when it is not there. */
export type DevPlace = { readonly kind: "memory" } | { readonly kind: "folder"; readonly dir: string };

/** What a development store is opened with beyond where it is: who writes, and the clock. The store is made a fleet store where it is not one. */
export type DevOptions = Pick<FleetConfig, "actor" | "clock" | "attempts"> & { readonly identity?: string };

/** A fleet store in memory or in a folder, with no replicas. */
export async function devFleetStore(place: DevPlace, options: DevOptions): Promise<Result<FleetStore, FleetProblem>> {
  const name = parseReplicaName("dev");
  if (name.kind === "err") return err({ kind: "refused", reasons: [name.error] });
  let store;
  if (place.kind === "memory") store = memoryStore({ name: "dev" });
  else {
    const opened = await localStore(place.dir, { create: true });
    if (opened.kind === "err") return err(documentsProblem({ kind: "refused", detail: opened.error }));
    store = opened.value;
  }
  return openFleetStore({ primary: { name: name.value, store }, create: true, ...options });
}
