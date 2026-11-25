// Spec: 0004-mirror-store FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009
/**
 * The mirrored store: a primary store and one or more secondaries of any backends, kept in step as one store. The primary answers every read and decides every write (its expectations, its conflicts, its revisions);
 * when it has taken a change, each secondary is made to hold the same objects at the paths the change touched, by the operations of the store type alone, so that a backend added to AnyFS later works as a primary or a
 * secondary with no change here. A secondary that cannot take a change is recorded as lagging and never stops the primary; `verify` compares the revision of every object and `reconcile` makes a secondary the same.
 *
 * @remarks
 * Writes are queued, so that every secondary sees the changes in the order the primary took them. A batch on the primary is one change there; a secondary follows it path by path, so a failure halfway leaves a secondary
 * with some of a batch and records the rest as lagging, and `reconcile` makes it whole. Every store of AnyFS gives an object the revision `sha256:` and the digest of its bytes, so two backends agree on a revision and
 * a drift is a comparison of texts. Only one process is assumed to write through a mirror: two writers on two computers meet in the primary and may leave a secondary behind until a reconcile.
 *
 * @limits It does not merge replicas, watch, lock, or follow history: the history of a path is the primary's. It is not a way to recover a primary from a secondary while the primary is alive; use `reconcile` with the
 * stores in the other order for that.
 *
 * @example
 * ```ts
 * import { mirrorStore } from "./mirror.ts";
 * // const m = await mirrorStore({ primary: gitBranchStore, secondaries: [sqliteStore] });
 * // m.kind === "ok" && (await m.value.store.write(path, bytes, expectAny)); // the branch and the file hold the object
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Capability, CORE_CAPABILITIES, type CoreCapability, type Cursor, describeProblem, expectAny, type Path, type Problem, refused, ROOT, unavailable } from "@intellectual-frontiers/anyfs/governance";
import { type Carried, carriedCapabilities, type Done, type Handler, makeStore, type Store, view } from "@intellectual-frontiers/anyfs/logical";
import { DEFAULT_POLICY, type Drift, describeLag, type Lag, type MirrorPolicy, type Reconciled } from "@intellectual-frontiers/anyfs-mirror/governance";
import { affectedPaths, driftOf, type Entry, isMutation, largestWrite, mirrorTraits, stepsOf, traitsProblem } from "@intellectual-frontiers/anyfs-mirror/logical";

/** The capabilities a primary may have: the core ones and the ones whose effect a secondary can follow by reading the primary. A merge, a watch and a lock are of one replica and cannot be followed, so a mirror has none of them. */
export type Mirrorable = CoreCapability | "cas" | "batch" | "rename" | "history" | "append" | "rangeRead" | "search";

/** The capabilities of a mirror of a primary of `C`: the same. */
export type Mirrored<C extends Mirrorable> = Carried<C>;

/** What a mirror is made from. */
export type MirrorOptions<C extends Mirrorable> = {
  /** The store that answers every read and decides every write. It may have any capabilities. */
  readonly primary: Store<C | CoreCapability>;
  /** The stores that follow it: at least one, of any backend, each with the core capabilities. */
  readonly secondaries: readonly Store<CoreCapability>[];
  /** What to do when a secondary does not take a change: `record` where not given. */
  readonly policy?: Partial<MirrorPolicy>;
};

/** A mirror: the store, and what a program reads of the stores it keeps in step. */
export type Mirror<C extends Mirrorable> = {
  readonly store: Store<Mirrored<C>>;
  readonly primary: string;
  readonly secondaries: readonly string[];
  readonly policy: MirrorPolicy;
  /** The paths a secondary did not take, in the order of the secondaries and of the paths: empty where every secondary follows. */
  lag(): readonly Lag[];
  /** How each secondary differs from the primary, by the revision of every object, after the changes in flight are done. */
  verify(): Promise<Result<readonly Drift[], Problem>>;
  /** Makes each secondary hold the objects of the primary and no other. */
  reconcile(): Promise<Result<readonly Reconciled[], Problem>>;
};

/** Every object of a store with its revision, in the order of the paths, however many pages the store gives. */
async function entriesOf(store: Store<CoreCapability>): Promise<Result<readonly Entry[], Problem>> {
  const out: Entry[] = [];
  let after: Cursor | undefined;
  do {
    const page = await store.list(ROOT, after === undefined ? {} : { after });
    if (page.kind === "err") return page;
    for (const e of page.value.entries) out.push({ path: e.path, rev: e.rev });
    after = page.value.next;
  } while (after !== undefined);
  return ok(out);
}

const isMerge = (c: Capability): boolean => c === "merge";

/** A mirror of a primary store and its secondaries, or why they cannot be mirrored. */
export async function mirrorStore<C extends Mirrorable>(options: MirrorOptions<C>): Promise<Result<Mirror<C | CoreCapability>, string>> {
  const { primary, secondaries } = options;
  const core = view(primary, CORE_CAPABILITIES);
  if (core.kind === "err") return core;
  const reader = core.value;
  const policy: MirrorPolicy = { ...DEFAULT_POLICY, ...options.policy };
  if (secondaries.length === 0) return err("a mirror needs a primary and at least one secondary");
  const ids = [primary.id, ...secondaries.map((s) => s.id)];
  const repeated = ids.find((id, i) => ids.indexOf(id) !== i);
  if (repeated !== undefined) return err(`${repeated} is given twice: every store of a mirror has its own id`);
  for (const s of secondaries) {
    const problem = traitsProblem(primary.traits, s.traits);
    if (problem !== undefined) return err(`${s.id} cannot follow ${primary.id}: ${problem}`);
  }
  const traits = mirrorTraits([primary.traits, ...secondaries.map((s) => s.traits)]);
  const lagging = new Map<string, Lag>();
  const keyOf = (member: string, path: string): string => `${member}\u0000${path}`;

  // writers queue, so that each secondary sees the changes in the order the primary took them
  let tail: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(job: () => Promise<T>): Promise<T> => {
    const run = tail.then(job, job);
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  /** Makes one secondary hold at `path` what the primary holds now; the reason it could not, or nothing. */
  async function follow(secondary: Store<CoreCapability>, path: Path, hint: Uint8Array | undefined): Promise<string | undefined> {
    let bytes: Uint8Array;
    if (hint !== undefined) {
      bytes = hint;
    } else {
      const held = await reader.read(path);
      if (held.kind === "err") {
        if (held.error.kind !== "missing") return `the primary could not be read: ${describeProblem(held.error)}`;
        const gone = await secondary.delete(path, expectAny);
        return gone.kind === "ok" ? undefined : describeProblem(gone.error);
      }
      bytes = held.value.bytes;
    }
    const wrote = await secondary.write(path, bytes, expectAny);
    return wrote.kind === "ok" ? undefined : describeProblem(wrote.error);
  }

  const handle: Handler = async (op) => {
    if (!isMutation(op)) return primary.handle(op);
    return exclusive(async (): Promise<Result<Done, Problem>> => {
      if (traits.maxObject !== undefined && largestWrite(op) > traits.maxObject) {
        return err(refused("too-large", `an object over ${traits.maxObject} bytes would be refused by one of the stores of the mirror`));
      }
      const done = await primary.handle(op);
      if (done.kind === "err") return done;
      const failed: Lag[] = [];
      for (const secondary of secondaries) {
        for (const path of affectedPaths(op)) {
          const hint = op.op === "write" ? op.bytes : undefined;
          const reason = await follow(secondary, path, hint);
          if (reason === undefined) {
            lagging.delete(keyOf(secondary.id, path));
          } else {
            const lag: Lag = { member: secondary.id, path, reason };
            lagging.set(keyOf(secondary.id, path), lag);
            failed.push(lag);
          }
        }
      }
      if (failed.length > 0 && policy.onSecondaryFailure === "report") {
        return err(unavailable(`${primary.id} took the change, but ${failed.map(describeLag).join("; ")}; reconcile the mirror`, true));
      }
      return done;
    });
  };

  const store = makeStore({
    id: `mirror(${ids.join("+")})`,
    place: primary.place,
    consistency: primary.consistency,
    traits,
    capabilities: carriedCapabilities(primary).filter((c) => !isMerge(c)),
    handle,
  });

  const verify = (): Promise<Result<readonly Drift[], Problem>> =>
    exclusive(async () => {
      const mine = await entriesOf(reader);
      if (mine.kind === "err") return mine;
      const drifts: Drift[] = [];
      for (const s of secondaries) {
        const theirs = await entriesOf(s);
        if (theirs.kind === "err") return theirs;
        drifts.push(driftOf(s.id, mine.value, theirs.value));
      }
      return ok(drifts);
    });

  const reconcile = (): Promise<Result<readonly Reconciled[], Problem>> =>
    exclusive(async () => {
      const mine = await entriesOf(reader);
      if (mine.kind === "err") return mine;
      const reports: Reconciled[] = [];
      for (const s of secondaries) {
        const theirs = await entriesOf(s);
        if (theirs.kind === "err") return theirs;
        const before = driftOf(s.id, mine.value, theirs.value);
        const copied: Path[] = [];
        const removed: Path[] = [];
        const failed: Lag[] = [];
        for (const step of stepsOf(before)) {
          const reason = await follow(s, step.path, undefined);
          if (reason === undefined) (step.kind === "copy" ? copied : removed).push(step.path);
          else failed.push({ member: s.id, path: step.path, reason });
        }
        for (const key of [...lagging.keys()]) if (key.startsWith(`${s.id}\u0000`)) lagging.delete(key);
        for (const f of failed) lagging.set(keyOf(f.member, f.path), f);
        reports.push({ member: s.id, before, copied, removed, failed });
      }
      return ok(reports);
    });

  return ok({
    store,
    primary: primary.id,
    secondaries: secondaries.map((s) => s.id),
    policy,
    lag: () => [...lagging.values()].sort((a, b) => (a.member === b.member ? (a.path < b.path ? -1 : a.path > b.path ? 1 : 0) : ids.indexOf(a.member) - ids.indexOf(b.member))),
    verify,
    reconcile,
  });
}
