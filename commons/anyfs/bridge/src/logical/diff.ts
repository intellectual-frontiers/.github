// Spec: 0003-bridge-transfer FR-003, FR-004, FR-005, FR-006, FR-007
/**
 * The plan of a transfer: two inventories, compared, become a list of actions and nothing is changed. `copy` makes what is missing or different at the destination and never deletes; `sync` also makes
 * the destination equal, within an allowance of deletes that is refused where it is exceeded; `move` is a copy that then removes the source, and needs a comparator that is sure; `check` lists the
 * differences. The plan says how each file was compared, what the destination would not keep of it, and holds every rail the caller set. A plan is made from two lists and the comparisons, and is the
 * same wherever it is made.
 *
 * @example
 * ```ts
 * import { diff } from "./diff.ts";
 * // const plan = await diff({ kind: "copy" }, { store: a, prefix: ROOT }, { store: b, prefix: ROOT });
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { comparePaths, formatPlace, type Path, portabilityFindings, type Prefix } from "@intellectual-frontiers/anyfs/governance";
import type { Store } from "@intellectual-frontiers/anyfs/logical";
import {
  ACTION_ORDER,
  type Action,
  anyGlobMatches,
  type Comparator,
  type ConflictReason,
  type Loss,
  type Mode,
  type Plan,
  type PlanRefusal,
  type Rails,
} from "@intellectual-frontiers/anyfs-bridge/governance";
import { compare, type DigestCache, isContentHash } from "./compare.ts";
import { hashPlan } from "./hash.ts";
import { type Entry, identity, inventory, keepOf, type Rewrite } from "./inventory.ts";

/** A source: a store that can be read and listed, and where it is read from. */
export type Source = Store<"read" | "list" | "stat">;
/** A destination: a store that can be written. */
export type Dest = Store<"read" | "write" | "list" | "stat" | "delete">;
/** A store with a prefix: one end of a transfer. */
export type Endpoint<S> = { readonly store: S; readonly prefix: Prefix };

/** The source a mode needs: a move removes the source, so it must be able to delete. */
export type SourceFor<M extends Mode> = M extends { readonly kind: "move" } ? Store<"read" | "list" | "stat" | "delete"> : Source;
/** The destination a mode needs: a check changes nothing, so it only reads. */
export type DestFor<M extends Mode> = M extends { readonly kind: "check" } ? Source : Dest;

/** How a plan is made. */
export type DiffOptions = {
  /** The comparators in order; where none decides, the files are taken to differ. Default: the revisions where both are hashes, then the bytes. */
  readonly comparators?: readonly Comparator[];
  readonly rails?: Rails;
  /** Maps the path at the source to the path at the destination. Default: the same path. */
  readonly rewrite?: Rewrite;
  /** Rename a file at the destination that has the content of a missing one, in a sync, where the destination can rename. Default: true. */
  readonly renames?: boolean;
  readonly cache?: DigestCache;
  readonly pageSize?: number;
  /** Refuse a plan that loses anything at the destination. */
  readonly strict?: boolean;
};

/** The comparators a plan uses where none is given: the revisions, then the bytes. */
export const DEFAULT_COMPARATORS: readonly Comparator[] = ["native-digest", "content-hash"];
const PAGE = 500;

/** A plan with the stores it was made from and the means to make it again: what an apply is given. */
export type Prepared = {
  readonly plan: Plan;
  readonly mode: Mode;
  readonly source: Endpoint<Source>;
  readonly dest: Endpoint<Dest>;
  readonly replan: () => Promise<Result<Plan, PlanRefusal>>;
};

const fold = (store: Source): ((p: Path) => string) => (store.traits.caseSensitive ? (p) => p : (p) => p.toLowerCase());
/** The path an action is about, for ordering. */
export const actionKey = (a: Action): Path => (a.kind === "rename" ? a.to : a.kind === "remove-source" ? a.rel : a.target);
const lossesOf = (a: Action): readonly Loss[] => (a.kind === "create" || a.kind === "update" ? a.losses : []);

/** Makes the plan of a transfer and nothing else. */
export async function diff<M extends Mode>(mode: M, source: Endpoint<SourceFor<M>>, dest: Endpoint<DestFor<M>>, options: DiffOptions = {}): Promise<Result<Plan, PlanRefusal>> {
  const src = source as Endpoint<Source>;
  const dst = dest as Endpoint<Source>;
  const comparators = options.comparators ?? DEFAULT_COMPARATORS;
  const rails = options.rails ?? {};
  const pageSize = options.pageSize ?? PAGE;
  if (mode.kind === "move") {
    if (!src.store.capabilities.has("delete")) return err({ kind: "capability", detail: `${src.store.id} cannot delete, so a move cannot remove its source` });
    if (comparators.includes("size-mtime")) return err({ kind: "capability", detail: "a move removes the source and needs a comparator that is sure: not the size and the time" });
  }
  if (mode.kind !== "check" && !dst.store.capabilities.has("write")) return err({ kind: "capability", detail: `${dst.store.id} cannot be written` });

  const from = await inventory(src.store, src.prefix, { keep: keepOf(rails), rewrite: options.rewrite ?? identity, pageSize });
  if (from.kind === "err") return err(from.error.kind === "store" ? { kind: "unavailable", problem: from.error.problem } : { kind: "rewrite", rel: from.error.rel, detail: from.error.detail });
  const to = await inventory(dst.store, dst.prefix, { keep: () => true, rewrite: identity, pageSize });
  if (to.kind === "err") return err(to.error.kind === "store" ? { kind: "unavailable", problem: to.error.problem } : { kind: "rewrite", rel: to.error.rel, detail: to.error.detail });
  if (rails.requireEmptyDestination === true && to.value.length > 0) return err({ kind: "rails", reason: "destination-not-empty", detail: `${dst.store.id} holds ${to.value.length} files below its prefix` });

  const key = fold(dst.store);
  const actions: Action[] = [];
  const allLosses: Loss[] = [];
  let unchanged = 0;

  // two files that would become one at the destination are a conflict, and neither is copied
  const groups = new Map<string, Entry[]>();
  for (const e of from.value) groups.set(key(e.target), [...(groups.get(key(e.target)) ?? []), e]);
  const settled: Entry[] = [];
  for (const group of groups.values()) {
    if (group.length === 1 && group[0] !== undefined) {
      settled.push(group[0]);
      continue;
    }
    const exact = new Set(group.map((e) => e.target)).size === 1;
    const reason: ConflictReason = exact ? "target-collision" : "case-collision";
    for (const e of group) actions.push({ kind: "conflict", target: e.target, reason, detail: `${e.rel} and ${group.length - 1} other file${group.length === 2 ? "" : "s"} would be one file at ${dst.store.id}` });
  }

  const destByKey = new Map<string, Entry>(to.value.map((e) => [key(e.target), e]));
  const matched = new Set<string>();
  const creates: Extract<Action, { kind: "create" }>[] = [];
  const kept: Entry[] = [];

  for (const e of settled) {
    const found = destByKey.get(key(e.target));
    const losses: Loss[] = [];
    const findings = portabilityFindings(e.target);
    if (findings.length > 0) losses.push({ kind: "unportable-name", target: e.target, detail: findings.join("; ") });
    if (found !== undefined && found.target !== e.target) losses.push({ kind: "case-folded", target: e.target, detail: `${dst.store.id} holds it as ${found.target}` });
    const max = dst.store.traits.maxObject;
    if (max !== undefined && e.stat.size > max) {
      actions.push({ kind: "skip", target: e.target, reason: "too-large" });
      losses.push({ kind: "too-large", target: e.target, detail: `${e.stat.size} bytes is more than ${dst.store.id} holds (${max})` });
      allLosses.push(...losses);
      continue;
    }
    if (rails.maxObjectBytes !== undefined && e.stat.size > rails.maxObjectBytes) {
      actions.push({ kind: "skip", target: e.target, reason: "too-large" });
      continue;
    }
    if (found === undefined) {
      const create: Extract<Action, { kind: "create" }> = { kind: "create", rel: e.rel, target: e.target, size: e.stat.size, src: e.stat.rev, decided: "absent", losses };
      creates.push(create);
      kept.push(e);
      continue;
    }
    matched.add(key(e.target));
    const verdict = await compare({ store: src.store, stat: e.stat }, { store: dst.store, stat: found.stat }, comparators, options.cache);
    if (verdict.kind === "err") return err({ kind: "unavailable", problem: verdict.error });
    kept.push(e);
    if (verdict.value.same) {
      unchanged++;
      continue;
    }
    if (rails.neverOverwrite === true) {
      actions.push({ kind: "skip", target: e.target, reason: "never-overwrite" });
      continue;
    }
    actions.push({ kind: "update", rel: e.rel, target: e.target, size: e.stat.size, src: e.stat.rev, dst: found.stat.rev, decided: verdict.value.by, losses });
  }

  // what is at the destination and not at the source
  const protect = rails.protect ?? [];
  const extras = to.value.filter((e) => !matched.has(key(e.target)));
  let removals = 0;
  const wantsRemoval = mode.kind === "sync" || mode.kind === "check";
  const mayDelete = mode.kind === "check" || (mode.kind === "sync" && mode.deletes.kind === "allow");
  const renamed = new Set<Entry>();
  if (mode.kind === "sync" && mayDelete && options.renames !== false && dst.store.capabilities.has("rename")) {
    const bySha = new Map<string, Entry[]>();
    for (const x of extras) if (isContentHash(x.stat.rev) && !anyGlobMatches(protect, x.target)) bySha.set(x.stat.rev, [...(bySha.get(x.stat.rev) ?? []), x]);
    for (const c of [...creates]) {
      if (!isContentHash(c.src)) continue;
      const candidates = bySha.get(c.src);
      const x = candidates?.shift();
      if (x === undefined) continue;
      renamed.add(x);
      creates.splice(creates.indexOf(c), 1);
      actions.push({ kind: "rename", from: x.target, to: c.target, dst: x.stat.rev });
      removals++;
    }
  }
  actions.push(...creates);
  if (wantsRemoval) {
    for (const x of extras) {
      if (renamed.has(x)) continue;
      if (anyGlobMatches(protect, x.target)) actions.push({ kind: "skip", target: x.target, reason: "protected" });
      else if (!mayDelete) actions.push({ kind: "skip", target: x.target, reason: "delete-not-allowed" });
      else {
        actions.push({ kind: "delete", target: x.target, dst: x.stat.rev });
        removals++;
      }
    }
  }
  if (mode.kind === "sync" && mode.deletes.kind === "allow" && removals > mode.deletes.max) return err({ kind: "delete-budget", wanted: removals, max: mode.deletes.max });

  if (mode.kind === "move") {
    const refusedRel = new Set(actions.filter((a) => a.kind === "skip" || a.kind === "conflict").map((a) => (a.kind === "skip" || a.kind === "conflict" ? a.target : "")));
    for (const e of kept) if (!refusedRel.has(e.target)) actions.push({ kind: "remove-source", rel: e.rel, src: e.stat.rev });
  }

  const writes = actions.filter((a): a is Extract<Action, { kind: "create" | "update" }> => a.kind === "create" || a.kind === "update");
  const bytes = writes.reduce((n, a) => n + a.size, 0);
  if (rails.maxFiles !== undefined && writes.length > rails.maxFiles) return err({ kind: "rails", reason: "max-files", detail: `${writes.length} files would be written and the rail is ${rails.maxFiles}` });
  if (rails.maxBytes !== undefined && bytes > rails.maxBytes) return err({ kind: "rails", reason: "max-bytes", detail: `${bytes} bytes would be written and the rail is ${rails.maxBytes}` });

  actions.sort((a, b) => ACTION_ORDER.indexOf(a.kind) - ACTION_ORDER.indexOf(b.kind) || comparePaths(actionKey(a), actionKey(b)));
  const losses = [...allLosses, ...actions.flatMap(lossesOf)].sort((a, b) => comparePaths(a.target, b.target) || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0));
  if (options.strict === true && losses.length > 0) return err({ kind: "lossy", losses });
  const body = {
    mode: mode.kind,
    source: `${formatPlace(src.store.place)}#${src.prefix}`,
    dest: `${formatPlace(dst.store.place)}#${dst.prefix}`,
    actions,
    unchanged,
    carries: ["bytes"] as const,
    bytes,
    losses,
  };
  return ok({ ...body, hash: await hashPlan(body) });
}

/** Makes the plan and what an apply needs to check it again: the stores, the mode and the means to make the plan once more. */
export async function prepare<M extends Mode>(mode: M, source: Endpoint<SourceFor<M>>, dest: Endpoint<DestFor<M>>, options: DiffOptions = {}): Promise<Result<Prepared, PlanRefusal>> {
  const plan = await diff(mode, source, dest, options);
  if (plan.kind === "err") return plan;
  return ok({
    plan: plan.value,
    mode,
    source: source as Endpoint<Source>,
    dest: dest as Endpoint<Dest>,
    replan: () => diff(mode, source, dest, options),
  });
}
