// Spec: 0006-estate-fleet-store FR-012
/**
 * The configuration of a fleet as it is meant to run, written as code (commons estate 0006-estate-fleet-store FR-012): the store of a host reached by SSH is the system of record, a branch of a Git repository
 * is the replica that keeps the history, and a bucket is the replica that keeps a copy elsewhere. The three stores are opened by their own libraries and given here; the configuration says which is which, what
 * the mirror may do and who writes. The names are examples: a fleet points the same code at its own host, repository and bucket.
 *
 * @example
 * ```ts
 * // const ssh = await openSshStore(executor, { place: { host: "fleet.example.test", user: "fleet" }, root: "/srv/fleet", create: true });
 * // const git = await gitRefStore({ repo: "/srv/fleet-history.git", branch: "fleet", commit: { author } });
 * // const cloud = await openS3Store({ place: parsePlace("s3://fleet-copy/estate"), credentials });
 * // const config = fleetConfigExample({ ssh: ssh.value.store, git: git.value.store, cloud: cloud.value.store }, "operator");
 * // const fleet = await openFleetStore({ ...config, create: true });
 * ```
 *
 * @module
 */
import { forbidDeletes } from "@intellectual-frontiers/anyfs-bridge/governance";
import { parseReplicaName, type Member, type ReplicaName } from "@intellectual-frontiers/anyfs-bridge/mirror";
import type { FleetConfig, PrimaryStore, ReplicaStore } from "./fleet.ts";

/** The three stores of the example fleet, opened. */
export type ExampleStores = {
  /** The system of record: the store of a host reached by SSH. */
  readonly ssh: PrimaryStore;
  /** The history: a branch of a Git repository, where a settlement of several changes is one commit. */
  readonly git: ReplicaStore;
  /** The copy elsewhere: a bucket. */
  readonly cloud: ReplicaStore;
};

const named = (text: string): ReplicaName => {
  const made = parseReplicaName(text);
  if (made.kind === "err") throw new Error(made.error);
  return made.value;
};

/** The configuration of the example fleet: the host is the primary, the Git branch and the bucket are its replicas, nothing is deleted at a replica and a settlement is made when it is asked for. */
export function fleetConfigExample(stores: ExampleStores, actor: string): FleetConfig {
  const replicas: readonly Member<ReplicaStore>[] = [
    { name: named("history"), store: stores.git },
    { name: named("copy"), store: stores.cloud },
  ];
  return {
    primary: { name: named("record"), store: stores.ssh },
    replicas,
    mirror: { deletes: forbidDeletes, fallback: "unavailable", auto: "manual" },
    identity: "example-fleet",
    actor,
    attempts: 5,
  };
}
