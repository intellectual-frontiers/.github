// Spec: 0004-bridge-twoway FR-005, FR-006, FR-007, FR-008
/**
 * A mirror: one store is the primary and the others are replicas of it, and a replica is in one of three states. It is `in-sync` where it holds what the primary holds; it is `behind` where the
 * primary has changed and the replica has not been touched; it is `diverged` where the replica was changed by someone other than the mirror. A ledger records, for each path, the bytes the replica was last
 * brought to, and the states are decided against it. A diverged path is never merged and never overwritten: the mirror leaves it, says which it is, and a person decides. A replica can be made the
 * primary only as an explicit act, which says what would be lost.
 *
 * @example
 * ```ts
 * import { emptyLedger } from "./mirror.ts";
 * emptyLedger.applied.size; // 0
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { comparePaths, formatPlace, type Path } from "@intellectual-frontiers/anyfs/governance";
import { type Action, type DeletePolicy, type PlanRefusal, type Rails } from "@intellectual-frontiers/anyfs-bridge/governance";
import { type DigestCache, digestOf } from "./compare.ts";
import { apply, type ApplyOptions, type Report } from "./apply.ts";
import { type Dest, type Endpoint, type Prepared, type Source } from "./diff.ts";
import { hashPlan } from "./hash.ts";
import { identity, inventory, keepOf, type Entry } from "./inventory.ts";

/** For each path, the SHA-256 in hex of the bytes the replica was last brought to. */
export type Ledger = { readonly applied: ReadonlyMap<Path, string> };
/** A ledger of a replica that has been brought to nothing. */
export const emptyLedger: Ledger = { applied: new Map() };

/** The state of a replica against its primary. */
export type ReplicaState =
  | { readonly kind: "in-sync" }
  | { readonly kind: "behind"; readonly pending: number }
  | { readonly kind: "diverged"; readonly paths: readonly Path[]; readonly pending: number };

/** How a mirror reads its two ends. */
export type MirrorOptions = { readonly rails?: Pick<Rails, "include" | "exclude">; readonly cache?: DigestCache; readonly pageSize?: number };

type Seen = { readonly entry: Entry; readonly digest: string };

async function seen(e: Endpoint<Source>, options: MirrorOptions): Promise<Result<Map<Path, Seen>, PlanRefusal>> {
  const inv = await inventory(e.store, e.prefix, { keep: keepOf(options.rails ?? {}), rewrite: identity, pageSize: options.pageSize ?? 500 });
  if (inv.kind === "err") return err(inv.error.kind === "store" ? { kind: "unavailable", problem: inv.error.problem } : { kind: "rewrite", rel: inv.error.rel, detail: inv.error.detail });
  const out = new Map<Path, Seen>();
  for (const entry of inv.value) {
    const digest = await digestOf({ store: e.store, stat: entry.stat }, options.cache);
    if (digest.kind === "err") return err({ kind: "unavailable", problem: digest.error });
    out.set(entry.rel, { entry, digest: digest.value });
  }
  return ok(out);
}

/** What a path is, between the primary, the replica and the ledger. */
type PathState = "same" | "behind" | "diverged";

/** The state of one path: `same` where the two hold the same bytes, `diverged` where the replica is not what the ledger says, and `behind` otherwise. */
export function pathState(primary: string | undefined, replica: string | undefined, ledger: string | undefined): PathState {
  if (primary === replica) return "same";
  return replica !== ledger ? "diverged" : "behind";
}

type Surveyed = { readonly state: ReplicaState; readonly p: Map<Path, Seen>; readonly r: Map<Path, Seen>; readonly behind: readonly Path[]; readonly diverged: readonly Path[] };

async function survey(primary: Endpoint<Source>, replica: Endpoint<Source>, ledger: Ledger, options: MirrorOptions): Promise<Result<Surveyed, PlanRefusal>> {
  const p = await seen(primary, options);
  if (p.kind === "err") return p;
  const r = await seen(replica, options);
  if (r.kind === "err") return r;
  const behind: Path[] = [];
  const diverged: Path[] = [];
  const rels = [...new Set<Path>([...p.value.keys(), ...r.value.keys(), ...ledger.applied.keys()])].sort(comparePaths);
  for (const rel of rels) {
    const s = pathState(p.value.get(rel)?.digest, r.value.get(rel)?.digest, ledger.applied.get(rel));
    if (s === "behind") behind.push(rel);
    else if (s === "diverged") diverged.push(rel);
  }
  const state: ReplicaState = diverged.length > 0 ? { kind: "diverged", paths: diverged, pending: behind.length } : behind.length > 0 ? { kind: "behind", pending: behind.length } : { kind: "in-sync" };
  return ok({ state, p: p.value, r: r.value, behind, diverged });
}

/** The state of a replica: nothing is changed. */
export async function replicaStatus(primary: Endpoint<Source>, replica: Endpoint<Source>, ledger: Ledger, options: MirrorOptions = {}): Promise<Result<ReplicaState, PlanRefusal>> {
  const s = await survey(primary, replica, ledger, options);
  return s.kind === "err" ? s : ok(s.value.state);
}

/** What a convergence did. `before` is the state it found; `ledger` is what the replica was brought to. */
export type Convergence = { readonly before: ReplicaState; readonly report: Report; readonly ledger: Ledger };

/** Brings a replica up to its primary: the paths that are behind are copied, deleted, or made; the paths that are diverged are left as they are, and the ledger keeps what it had for them. */
export async function converge(
  primary: Endpoint<Source>,
  replica: Endpoint<Dest>,
  ledger: Ledger,
  options: MirrorOptions & { readonly deletes: DeletePolicy; readonly apply?: ApplyOptions },
): Promise<Result<Convergence, PlanRefusal>> {
  const s = await survey(primary, replica, ledger, options);
  if (s.kind === "err") return s;
  const actions: Action[] = [];
  let removals = 0;
  for (const rel of s.value.behind) {
    const from = s.value.p.get(rel);
    const to = s.value.r.get(rel);
    if (from !== undefined) {
      actions.push(
        to === undefined
          ? { kind: "create", rel, target: rel, size: from.entry.stat.size, src: from.entry.stat.rev, decided: "content-hash", losses: [] }
          : { kind: "update", rel, target: rel, size: from.entry.stat.size, src: from.entry.stat.rev, dst: to.entry.stat.rev, decided: "content-hash", losses: [] },
      );
    } else if (to !== undefined) {
      if (options.deletes.kind === "forbid") actions.push({ kind: "skip", target: rel, reason: "delete-not-allowed" });
      else {
        removals++;
        actions.push({ kind: "delete", target: rel, dst: to.entry.stat.rev });
      }
    }
  }
  if (options.deletes.kind === "allow" && removals > options.deletes.max) return err({ kind: "delete-budget", wanted: removals, max: options.deletes.max });
  const body = {
    mode: "sync" as const,
    source: `${formatPlace(primary.store.place)}#${primary.prefix}`,
    dest: `${formatPlace(replica.store.place)}#${replica.prefix}`,
    actions,
    unchanged: 0,
    carries: ["bytes"] as const,
    bytes: actions.reduce((n, a) => (a.kind === "create" || a.kind === "update" ? n + a.size : n), 0),
    losses: [],
  };
  const hash = await hashPlan(body);
  const prepared: Prepared = {
    plan: { ...body, hash },
    mode: { kind: "sync", deletes: options.deletes },
    source: primary as Endpoint<Source>,
    dest: replica,
    replan: async () => ok({ ...body, hash }),
  };
  const done = await apply(prepared, { ...options.apply, recheck: false });
  if (done.kind === "err") return err({ kind: "capability", detail: `the apply did not start: ${done.error.kind}` });
  const failed = new Set<Path>();
  for (const o of done.value.outcomes) if (o.status === "failed") failed.add(o.action.kind === "rename" ? o.action.to : o.action.kind === "remove-source" ? o.action.rel : o.action.target);
  const applied = new Map(ledger.applied);
  for (const rel of s.value.behind) {
    if (failed.has(rel)) continue;
    const from = s.value.p.get(rel);
    if (from === undefined) {
      if (options.deletes.kind === "allow") applied.delete(rel);
    } else applied.set(rel, from.digest);
  }
  for (const rel of s.value.p.keys()) if (!s.value.diverged.includes(rel) && !failed.has(rel) && s.value.p.get(rel)?.digest === s.value.r.get(rel)?.digest) applied.set(rel, s.value.p.get(rel)?.digest ?? "");
  return ok({ before: s.value.state, report: done.value, ledger: { applied } });
}

/** What a person accepts in making a replica the primary. */
export type PromoteOptions = { readonly acceptLoss?: number; readonly acceptDivergence?: boolean } & MirrorOptions;

/** Why a replica was not made the primary. */
export type PromoteRefusal =
  | { readonly kind: "behind"; readonly pending: number }
  | { readonly kind: "diverged"; readonly paths: readonly Path[] }
  | { readonly kind: "unavailable"; readonly refusal: PlanRefusal };

/** The result of a promotion: the roles swapped, with the ledger the old primary has as a replica of the new, and how many changes of the old primary the new one does not have. */
export type Promotion = { readonly primary: Endpoint<Source>; readonly replica: Endpoint<Source>; readonly ledger: Ledger; readonly lost: number };

/**
 * Makes the replica the primary, as an explicit act. A replica that is behind is promoted only where the caller accepts to lose that many changes; a replica that is diverged only where the caller
 * accepts the divergence. The old primary becomes a replica of the new, and its ledger holds the paths where the two agree: whatever else it holds is seen as diverged until a person decides.
 */
export async function promote(primary: Endpoint<Source>, replica: Endpoint<Source>, ledger: Ledger, options: PromoteOptions = {}): Promise<Result<Promotion, PromoteRefusal>> {
  const s = await survey(primary, replica, ledger, options);
  if (s.kind === "err") return err({ kind: "unavailable", refusal: s.error });
  if (s.value.state.kind === "diverged" && options.acceptDivergence !== true) return err({ kind: "diverged", paths: s.value.state.paths });
  const pending = s.value.state.kind === "in-sync" ? 0 : s.value.state.pending;
  if (pending > (options.acceptLoss ?? 0)) return err({ kind: "behind", pending });
  const applied = new Map<Path, string>();
  for (const [rel, r] of s.value.r) if (s.value.p.get(rel)?.digest === r.digest) applied.set(rel, r.digest);
  return ok({ primary: replica, replica: primary, ledger: { applied }, lost: pending + (s.value.state.kind === "diverged" ? s.value.state.paths.length : 0) });
}
