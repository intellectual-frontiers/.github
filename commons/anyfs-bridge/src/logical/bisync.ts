// Spec: 0004-bridge-twoway FR-001, FR-002, FR-003, FR-004
/**
 * A two-way sync against a base. The base is what the two sides agreed on the last time: for each path, the SHA-256 of its bytes. With it a change is told from a difference: a path that only one side
 * changed goes to the other, a path both changed to the same bytes is agreed, and a path both changed differently is a conflict that a policy written as code decides (`newer-wins`, `keep-both`, or
 * `fail`). A sync has no default base, and the bridge does not guess one: the caller gives a base or says `seed`, which agrees on what is equal, copies what is only on one side and leaves what differs
 * to the policy, and deletes nothing. A change beats a delete, so that no data is lost to a deletion made without knowing of it.
 *
 * @example
 * ```ts
 * import { emptyBase } from "./bisync.ts";
 * emptyBase.entries.size; // 0
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { comparePaths, formatPlace, parsePath, type Path } from "@intellectual-frontiers/anyfs/governance";
import { type Action, type DeletePolicy, type Plan, type PlanHash, type PlanRefusal, type Rails } from "@intellectual-frontiers/anyfs-bridge/governance";
import { type DigestCache, digestOf } from "./compare.ts";
import { apply, type ApplyOptions, type Report } from "./apply.ts";
import { actionKey, type Dest, type Endpoint, type Prepared } from "./diff.ts";
import { hashPlan } from "./hash.ts";
import { identity, inventory, keepOf, type Entry } from "./inventory.ts";

/** What the two sides agreed on: the SHA-256 of each path, in hex. */
export type Base = { readonly entries: ReadonlyMap<Path, string> };
/** A base that agrees on nothing. */
export const emptyBase: Base = { entries: new Map() };
/** The first sync, said out loud: agree on what is equal, copy what is on one side only, delete nothing. */
export type Seed = { readonly seed: "union" };

/** A base as pairs in the order of the paths, to keep it in a document. */
export const encodeBase = (base: Base): readonly (readonly [string, string])[] => [...base.entries].sort((x, y) => comparePaths(x[0], y[0]));
/** A base from pairs, or why they are not one. */
export function decodeBase(pairs: readonly (readonly [string, string])[]): Result<Base, string> {
  const entries = new Map<Path, string>();
  for (const [path, digest] of pairs) {
    const p = parsePath(path);
    if (p.kind === "err") return err(p.error);
    if (!/^[0-9a-f]{64}$/u.test(digest)) return err(`${digest} is not a SHA-256`);
    entries.set(p.value, digest);
  }
  return ok({ entries });
}

/** What decides a path both sides changed differently. */
export type ConflictPolicy = "newer-wins" | "keep-both" | "fail";
/** The side of a sync. */
export type SideName = "a" | "b";

/** How a two-way sync is planned. */
export type BiOptions = {
  readonly conflict: ConflictPolicy;
  /** Whether a delete made on one side reaches the other, and at most how many. */
  readonly deletes: DeletePolicy;
  readonly rails?: Pick<Rails, "include" | "exclude">;
  readonly cache?: DigestCache;
  readonly pageSize?: number;
};

/** An action to make at one side: `side` is the side it changes. `rel` is the path of the base it concerns. */
export type BiAction = { readonly side: SideName; readonly rel: Path; readonly action: Action };
/** A path the two sides cannot settle. */
export type BiConflict = { readonly rel: Path; readonly reason: "both-changed" | "no-time"; readonly detail: string };

/** The plan of a two-way sync. `next` is the base once every action is made. */
export type BiPlan = {
  readonly actions: readonly BiAction[];
  readonly conflicts: readonly BiConflict[];
  /** What was settled without an action: a path both sides have as the base says, or as each other. */
  readonly unchanged: number;
  /** What was decided by changing the other side, in words. */
  readonly resolved: readonly string[];
  readonly next: Base;
  /** The base the plan was made against: a path whose change does not succeed goes back to its entry here. */
  readonly prior: Base;
  readonly hash: PlanHash;
};

const hex8 = (digest: string): string => digest.slice(0, 8);
const conflictName = (rel: Path, side: SideName, digest: string): Path => {
  const i = rel.lastIndexOf(".");
  const slash = rel.lastIndexOf("/");
  const stem = i > slash + 1 ? rel.slice(0, i) : rel;
  const ext = i > slash + 1 ? rel.slice(i) : "";
  const made = parsePath(`${stem}.conflict-${side}-${hex8(digest)}${ext}`);
  return made.kind === "ok" ? made.value : rel;
};

type Seen = { readonly entry: Entry; readonly digest: string };

/** Plans the sync of two sides against a base, and changes nothing. */
export async function planBisync(a: Endpoint<Dest>, b: Endpoint<Dest>, base: Base | Seed, options: BiOptions): Promise<Result<BiPlan, PlanRefusal>> {
  const seeded = "seed" in base;
  const known: ReadonlyMap<Path, string> = seeded ? new Map() : base.entries;
  const pageSize = options.pageSize ?? 500;
  const keep = keepOf(options.rails ?? {});
  const listed = async (e: Endpoint<Dest>): Promise<Result<Map<Path, Seen>, PlanRefusal>> => {
    const inv = await inventory(e.store, e.prefix, { keep, rewrite: identity, pageSize });
    if (inv.kind === "err") return err(inv.error.kind === "store" ? { kind: "unavailable", problem: inv.error.problem } : { kind: "rewrite", rel: inv.error.rel, detail: inv.error.detail });
    const seen = new Map<Path, Seen>();
    for (const entry of inv.value) {
      const digest = await digestOf({ store: e.store, stat: entry.stat }, options.cache);
      if (digest.kind === "err") return err({ kind: "unavailable", problem: digest.error });
      seen.set(entry.rel, { entry, digest: digest.value });
    }
    return ok(seen);
  };
  const sa = await listed(a);
  if (sa.kind === "err") return sa;
  const sb = await listed(b);
  if (sb.kind === "err") return sb;

  const rels = [...new Set<Path>([...sa.value.keys(), ...sb.value.keys(), ...known.keys()])].sort(comparePaths);
  const actions: BiAction[] = [];
  const conflicts: BiConflict[] = [];
  const resolved: string[] = [];
  const next = new Map<Path, string>();
  let unchanged = 0;
  let removals = 0;

  const copyTo = (side: SideName, rel: Path, from: Seen, to: Seen | undefined, target: Path = rel): void => {
    const action: Action =
      to === undefined || target !== rel
        ? { kind: "create", rel, target, size: from.entry.stat.size, src: from.entry.stat.rev, decided: "content-hash", losses: [] }
        : { kind: "update", rel, target, size: from.entry.stat.size, src: from.entry.stat.rev, dst: to.entry.stat.rev, decided: "content-hash", losses: [] };
    actions.push({ side, rel, action });
  };
  const deleteAt = (side: SideName, rel: Path, at: Seen): void => {
    if (options.deletes.kind === "forbid") {
      actions.push({ side, rel, action: { kind: "skip", target: rel, reason: "delete-not-allowed" } });
      return;
    }
    removals++;
    actions.push({ side, rel, action: { kind: "delete", target: rel, dst: at.entry.stat.rev } });
  };

  for (const rel of rels) {
    const x = sa.value.get(rel);
    const y = sb.value.get(rel);
    const was = known.get(rel);
    if (x === undefined && y === undefined) continue; // gone from both: it leaves the base
    if (x !== undefined && y !== undefined && x.digest === y.digest) {
      unchanged++;
      next.set(rel, x.digest);
      continue;
    }
    const xChanged = x?.digest !== was;
    const yChanged = y?.digest !== was;
    if (was !== undefined && !xChanged && !yChanged) {
      unchanged++;
      next.set(rel, was);
      continue;
    }
    // only one side changed since the base: it goes to the other
    if (was !== undefined && xChanged !== yChanged) {
      if (xChanged) {
        if (x === undefined) {
          if (y !== undefined) deleteAt("b", rel, y);
          if (options.deletes.kind === "forbid") next.set(rel, was);
        } else {
          copyTo("b", rel, x, y);
          next.set(rel, x.digest);
        }
      } else if (y === undefined) {
        if (x !== undefined) deleteAt("a", rel, x);
        if (options.deletes.kind === "forbid") next.set(rel, was);
      } else {
        copyTo("a", rel, y, x);
        next.set(rel, y.digest);
      }
      continue;
    }
    // no base for this path, or both changed
    if (x === undefined && y !== undefined) {
      copyTo("a", rel, y, undefined);
      next.set(rel, y.digest);
      if (was !== undefined) resolved.push(`${rel}: deleted at a, changed at b: the change is kept`);
      continue;
    }
    if (y === undefined && x !== undefined) {
      copyTo("b", rel, x, undefined);
      next.set(rel, x.digest);
      if (was !== undefined) resolved.push(`${rel}: changed at a, deleted at b: the change is kept`);
      continue;
    }
    if (x === undefined || y === undefined) continue;
    // both sides hold it, differently
    const ta = x.entry.stat.modified;
    const tb = y.entry.stat.modified;
    const decide = (): { winner: SideName } | { conflict: BiConflict } => {
      if (options.conflict === "fail") return { conflict: { rel, reason: "both-changed", detail: "both sides changed it and the policy is `fail`" } };
      if (ta !== undefined && tb !== undefined && ta !== tb) return { winner: ta > tb ? "a" : "b" };
      if (options.conflict === "keep-both") return { winner: "a" };
      return { conflict: { rel, reason: ta === undefined || tb === undefined ? "no-time" : "both-changed", detail: ta === undefined || tb === undefined ? "a side did not say when it changed, so which is newer is not known" : "both sides changed it at the same time" } };
    };
    const verdict = decide();
    if ("conflict" in verdict) {
      conflicts.push(verdict.conflict);
      if (was !== undefined) next.set(rel, was);
      continue;
    }
    const win = verdict.winner === "a" ? x : y;
    const lose = verdict.winner === "a" ? y : x;
    const loseSide: SideName = verdict.winner === "a" ? "b" : "a";
    const winSide: SideName = verdict.winner;
    copyTo(loseSide, rel, win, lose);
    next.set(rel, win.digest);
    if (options.conflict === "keep-both") {
      // the loser's bytes are kept beside the winner at the winner's side now, and reach the loser's side at the next sync
      copyTo(winSide, rel, lose, undefined, conflictName(rel, loseSide, lose.digest));
      resolved.push(`${rel}: both changed; ${winSide} wins and the other is kept as ${conflictName(rel, loseSide, lose.digest)}`);
    } else resolved.push(`${rel}: both changed; the newer, at ${winSide}, wins`);
  }

  if (options.deletes.kind === "allow" && removals > options.deletes.max) return err({ kind: "delete-budget", wanted: removals, max: options.deletes.max });
  actions.sort((p, q) => comparePaths(p.rel, q.rel) || (p.side < q.side ? -1 : p.side > q.side ? 1 : 0));
  const body = {
    a: `${formatPlace(a.store.place)}#${a.prefix}`,
    b: `${formatPlace(b.store.place)}#${b.prefix}`,
    actions,
    conflicts,
    unchanged,
    resolved,
    next: encodeBase({ entries: next }),
  };
  const hash = await hashPlan(body as unknown as Omit<Plan, "hash">);
  return ok({ actions, conflicts, unchanged, resolved, next: { entries: next }, prior: { entries: known }, hash });
}

/** What a two-way apply did: what happened at each side, and the base to keep. A path whose action did not succeed keeps its old base entry. */
export type BiReport = { readonly a: Report; readonly b: Report; readonly base: Base };

async function side(plan: BiAction[], from: Endpoint<Dest>, to: Endpoint<Dest>, options: ApplyOptions): Promise<Report> {
  const actions = plan.map((p) => p.action).sort((p, q) => comparePaths(actionKey(p), actionKey(q)));
  const body = {
    mode: "copy" as const,
    source: `${formatPlace(from.store.place)}#${from.prefix}`,
    dest: `${formatPlace(to.store.place)}#${to.prefix}`,
    actions,
    unchanged: 0,
    carries: ["bytes"] as const,
    bytes: 0,
    losses: [],
  };
  const hash = await hashPlan(body);
  const prepared: Prepared = { plan: { ...body, hash }, mode: { kind: "copy" }, source: from, dest: to, replan: async () => ok({ ...body, hash }) };
  const r = await apply(prepared, { ...options, recheck: false });
  if (r.kind === "ok") return r.value;
  return { hash, outcomes: [], done: 0, failed: actions.length, skipped: 0, bytes: 0, unguarded: 0 };
}

const joined = (x: Report, y: Report): Report => ({
  hash: y.hash,
  outcomes: [...x.outcomes, ...y.outcomes],
  done: x.done + y.done,
  failed: x.failed + y.failed,
  skipped: x.skipped + y.skipped,
  bytes: x.bytes + y.bytes,
  unguarded: x.unguarded + y.unguarded,
});

/** Whether an action keeps what a side holds beside the path that is about to change: it is made first, while the file is as the plan saw it. */
const preserves = (x: BiAction): boolean => x.action.kind === "create" && x.action.target !== x.rel;

/** Makes the actions of a two-way plan at both sides and returns the base to keep. The copies that keep a loser's bytes are made first, while the loser's file is as the plan saw it. The plan must have no conflicts the caller did not accept. */
export async function applyBisync(plan: BiPlan, a: Endpoint<Dest>, b: Endpoint<Dest>, options: ApplyOptions = {}): Promise<BiReport> {
  const first = plan.actions.filter(preserves);
  const then = plan.actions.filter((x) => !preserves(x));
  const at = (list: readonly BiAction[], s: SideName): BiAction[] => list.filter((x) => x.side === s);
  const kept = [await side(at(first, "b"), a, b, options), await side(at(first, "a"), b, a, options)] as const;
  const made = [await side(at(then, "b"), a, b, options), await side(at(then, "a"), b, a, options)] as const;
  const reportB = joined(kept[0], made[0]);
  const reportA = joined(kept[1], made[1]);
  const toB = plan.actions.filter((x) => x.side === "b");
  const toA = plan.actions.filter((x) => x.side === "a");
  const failed = new Set<Path>();
  for (const [bi, report] of [[toB, reportB], [toA, reportA]] as const) {
    for (const o of report.outcomes) if (o.status === "failed") for (const x of bi) if (x.action === o.action || JSON.stringify(x.action) === JSON.stringify(o.action)) failed.add(x.rel);
  }
  const base = new Map(plan.next.entries);
  // a path whose change did not succeed is not agreed: it goes back to what the base said, so that the next sync sees the change again
  for (const rel of failed) {
    const before = plan.prior.entries.get(rel);
    if (before === undefined) base.delete(rel);
    else base.set(rel, before);
  }
  return { a: reportA, b: reportB, base: { entries: base } };
}
