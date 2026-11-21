// Spec: 0006-estate-fleet-store FR-006, FR-007
/**
 * A snapshot of a fleet store (commons estate 0006-estate-fleet-store): everything the estate's logical layer judges, read from the documents and put in the shapes its functions take, so that
 * operational truth, the invariants and the status of each policy run unchanged on stored data. `assessSnapshot` is pure: the same snapshot gives the same answer whether it was read from a store
 * or made in memory.
 *
 * @example
 * ```ts
 * import { assessSnapshot, type FleetSnapshot } from "./snapshot.ts";
 * declare const snapshot: FleetSnapshot;
 * const a = assessSnapshot(snapshot, "2026-11-20T12:00:00Z", "PT30M");
 * a.kind; // "ok"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Finding } from "@intellectual-frontiers/anyfs/docs";
import type { Json } from "@intellectual-frontiers/grc/governance";
import type { Asset } from "@intellectual-frontiers/estate/governance";
import {
  type AcceptedRisk,
  checkInvariants,
  type JudgedPolicy,
  judgePolicy,
  type Observation,
  operationalTruth,
  type PolicyOutcome,
  type Truth,
  type Violation,
} from "@intellectual-frontiers/estate/logical";
import type { Manifest, StoredEvidence } from "./documents.ts";

/** An observation with the asset it is of. */
export type ObservationOf = { readonly asset: string; readonly observation: Observation };

/** What a store holds of an estate, in the shapes the logical layer takes. */
export type FleetSnapshot = {
  readonly manifest: Manifest;
  readonly assets: readonly Asset[];
  /** What is declared of each asset, by its identity; an asset with nothing declared is not a key. */
  readonly declared: Readonly<Record<string, Readonly<Record<string, Json>>>>;
  /** The observations read: the latest of each asset, or all of them. */
  readonly observations: readonly ObservationOf[];
  /** The results of the policies in the latest observation of each asset. */
  readonly results: readonly (PolicyOutcome & { readonly asset: string })[];
  /** The risks accepted of each asset, by its identity. */
  readonly acceptances: Readonly<Record<string, readonly AcceptedRisk[]>>;
  /** The references to the evidence of each asset, where they were asked for. */
  readonly evidence: readonly StoredEvidence[];
  /** What was in the folders that is not a good document. */
  readonly findings: readonly Finding[];
  /** Whether the documents were the same when the reading ended as when it began. */
  readonly stable: boolean;
};

/** What the logical layer says of a snapshot. */
export type Assessment = {
  readonly truths: readonly Truth[];
  readonly violations: readonly Violation[];
  /** The status of each policy result of each asset, with the risks accepted taken into account. */
  readonly judged: readonly { readonly asset: string; readonly policy: JudgedPolicy }[];
};

const byAt = (a: ObservationOf, b: ObservationOf): number => (a.observation.at < b.observation.at ? -1 : a.observation.at > b.observation.at ? 1 : 0);

/** The latest observation of an asset in a snapshot, or nothing where it was never observed. */
export function latestOf(snapshot: FleetSnapshot, asset: string): Observation | undefined {
  const mine = snapshot.observations.filter((o) => o.asset === asset).sort(byAt);
  return mine[mine.length - 1]?.observation;
}

/**
 * The operational truth of every asset, the violations of the invariants an estate checks, and the status of every policy result, all by the functions of the logical layer. `now` is an instant and
 * `within` is how long an observation is good for (an ISO 8601 duration). Where a duration or an instant is not one, the reason is the error.
 */
export function assessSnapshot(snapshot: FleetSnapshot, now: string, within: string): Result<Assessment, string> {
  const truths: Truth[] = [];
  for (const asset of snapshot.assets) {
    const truth = operationalTruth({ asset, declared: snapshot.declared[asset.id] ?? {}, observed: latestOf(snapshot, asset.id), now, within });
    if (truth.kind === "err") return err(truth.error);
    truths.push(truth.value);
  }
  const violations = checkInvariants({ assets: snapshot.assets, observations: snapshot.observations, results: snapshot.results });
  const judged: { asset: string; policy: JudgedPolicy }[] = [];
  for (const r of snapshot.results) {
    const observed = latestOf(snapshot, r.asset) !== undefined;
    judged.push({ asset: r.asset, policy: judgePolicy({ result: { id: r.id, status: r.status, controls: r.controls }, observed, accepted: snapshot.acceptances[r.asset] ?? [], now }) });
  }
  return ok({ truths, violations, judged });
}
