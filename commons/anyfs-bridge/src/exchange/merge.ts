// Spec: 0008-bridge-merge-mode FR-001, FR-002, FR-003, FR-004, FR-005
/**
 * The merge of two stores that both merge. It is a plan before it is anything else, as every transfer of the bridge is: the vectors of the two stores, the delta each takes from the other (the rows it lacks and the blobs
 * they name) and the hash of all of it. Applying it takes the hash the plan had; where the stores have changed since, the plan is stale and nothing is applied. A merge has no conflict, so there is no policy to choose: what
 * the plan says is what each store takes. The rails are a maximum of rows and of bytes, which refuse a plan that is too large to be taken at once.
 *
 * @example
 * ```ts
 * import { applyMerge, planMerge } from "./mod.ts";
 * // const prepared = await planMerge(a, b, {}); if (prepared.kind === "ok") await applyMerge(a, b, prepared.value, { approved: prepared.value.plan.hash });
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { describeProblem, type Delta, type MergeOutcome, type Problem, type VersionVector } from "@intellectual-frontiers/anyfs/governance";
import { deltaId } from "@intellectual-frontiers/anyfs/merge";
import type { Mergeable } from "./exchange.ts";

/** What one store takes in a merge. */
export type Taking = { readonly versions: number; readonly blobs: number; readonly bytes: number; readonly id: string | undefined };

/** The rails of a merge: the most rows and the most bytes of blobs one store may take at once. */
export type MergeRails = { readonly maxVersions?: number; readonly maxBytes?: number };

/** A merge as a plan: what each store holds and takes, and the hash of that. */
export type MergePlan = { readonly a: VersionVector; readonly b: VersionVector; readonly toA: Taking; readonly toB: Taking; readonly hash: string };

/** A plan with the deltas it was made from. */
export type PreparedMerge = { readonly plan: MergePlan; readonly toA: Delta | undefined; readonly toB: Delta | undefined };

/** Why a merge was not planned or applied. */
export type MergeProblem =
  | { readonly kind: "store"; readonly which: "a" | "b"; readonly problem: Problem }
  | { readonly kind: "rails"; readonly which: "a" | "b"; readonly detail: string }
  | { readonly kind: "stale"; readonly planned: string; readonly now: string }
  | { readonly kind: "unapproved"; readonly hash: string };

/** One sentence for a problem. */
export function describeMergeProblem(p: MergeProblem): string {
  switch (p.kind) {
    case "store":
      return `store ${p.which}: ${describeProblem(p.problem)}`;
    case "rails":
      return `the merge is too large for store ${p.which}: ${p.detail}`;
    case "stale":
      return `the plan ${p.planned.slice(0, 12)} is stale: the stores are now at ${p.now.slice(0, 12)}`;
    case "unapproved":
      return `a merge changes stores and needs the hash of its plan, ${p.hash.slice(0, 12)}`;
  }
}

const sortedVector = (v: VersionVector): Record<string, number> => Object.fromEntries(Object.entries(v).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)));
const isEmpty = (d: Delta): boolean => d.versions.length === 0 && d.blobs.length === 0;
const bytesOf = (d: Delta): number => d.blobs.reduce((n, b) => n + Math.floor((b.bytes.length * 3) / 4), 0);

async function takingOf(d: Delta | undefined): Promise<Taking> {
  return d === undefined ? { versions: 0, blobs: 0, bytes: 0, id: undefined } : { versions: d.versions.length, blobs: d.blobs.length, bytes: bytesOf(d), id: await deltaId(d) };
}

/** The plan of a merge between two stores, and the deltas it is made of; nothing is changed. */
export async function planMerge(a: Mergeable, b: Mergeable, rails: MergeRails = {}): Promise<Result<PreparedMerge, MergeProblem>> {
  const va = await a.versionVector();
  if (va.kind === "err") return err({ kind: "store", which: "a", problem: va.error });
  const vb = await b.versionVector();
  if (vb.kind === "err") return err({ kind: "store", which: "b", problem: vb.error });
  const forB = await a.deltaSince(vb.value);
  if (forB.kind === "err") return err({ kind: "store", which: "a", problem: forB.error });
  const forA = await b.deltaSince(va.value);
  if (forA.kind === "err") return err({ kind: "store", which: "b", problem: forA.error });
  const toB = isEmpty(forB.value) ? undefined : forB.value;
  const toA = isEmpty(forA.value) ? undefined : forA.value;
  const takingA = await takingOf(toA);
  const takingB = await takingOf(toB);
  for (const [which, t] of [["a", takingA], ["b", takingB]] as const) {
    if (rails.maxVersions !== undefined && t.versions > rails.maxVersions) return err({ kind: "rails", which, detail: `${t.versions} rows, at most ${rails.maxVersions}` });
    if (rails.maxBytes !== undefined && t.bytes > rails.maxBytes) return err({ kind: "rails", which, detail: `${t.bytes} bytes of blobs, at most ${rails.maxBytes}` });
  }
  const hash = await sha256(JSON.stringify({ a: sortedVector(va.value), b: sortedVector(vb.value), toA: takingA.id ?? null, toB: takingB.id ?? null }));
  return ok({ plan: { a: va.value, b: vb.value, toA: takingA, toB: takingB, hash }, toA, toB });
}

/** What a merge did: what each store said of the delta it took. */
export type MergeReport = { readonly toA: MergeOutcome | undefined; readonly toB: MergeOutcome | undefined; readonly vectorsEqual: boolean };

/**
 * Applies a merge: the plan is made again, and where its hash is not the one approved nothing is applied; otherwise each store takes its delta, whole or not at all, and a second merge of the same stores changes
 * nothing.
 */
export async function applyMerge(a: Mergeable, b: Mergeable, prepared: PreparedMerge, options: { readonly approved: string | undefined; readonly rails?: MergeRails }): Promise<Result<MergeReport, MergeProblem>> {
  if (options.approved !== prepared.plan.hash) return err(options.approved === undefined ? { kind: "unapproved", hash: prepared.plan.hash } : { kind: "stale", planned: options.approved, now: prepared.plan.hash });
  const again = await planMerge(a, b, options.rails ?? {});
  if (again.kind === "err") return again;
  if (again.value.plan.hash !== options.approved) return err({ kind: "stale", planned: options.approved, now: again.value.plan.hash });
  let toB: MergeOutcome | undefined;
  let toA: MergeOutcome | undefined;
  if (again.value.toB !== undefined) {
    const r = await b.applyDelta(again.value.toB);
    if (r.kind === "err") return err({ kind: "store", which: "b", problem: r.error });
    toB = r.value;
  }
  if (again.value.toA !== undefined) {
    const r = await a.applyDelta(again.value.toA);
    if (r.kind === "err") return err({ kind: "store", which: "a", problem: r.error });
    toA = r.value;
  }
  const va = await a.versionVector();
  const vb = await b.versionVector();
  if (va.kind === "err") return err({ kind: "store", which: "a", problem: va.error });
  if (vb.kind === "err") return err({ kind: "store", which: "b", problem: vb.error });
  return ok({ toA, toB, vectorsEqual: JSON.stringify(sortedVector(va.value)) === JSON.stringify(sortedVector(vb.value)) });
}
