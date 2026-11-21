// Spec: 0006-bridge-mirrored FR-001, FR-002, FR-003, FR-004, FR-005, FR-008
/**
 * A mirrored store: one primary, which is the authority, and replicas that are brought up to it. A write goes to the primary and nowhere else, and is queued for the replicas, which are converged by bridge plans
 * when `settle` is called or, if the policy says so, after each write; a replica that fails never fails a write, it is `behind`; a replica that someone else changed is `diverged` and is never merged. Reads
 * are the primary's alone, so that no stale replica is read by mistake through the store; `read` of the mirror answers from a replica where the primary cannot be reached, and says that it did, which replica, and
 * what the replica is known to hold. The ledgers, which say what each replica was last brought to, are kept on the primary below a reserved prefix that the store never shows and never lets be changed.
 * The store has the capabilities of the primary, and a replica can become the primary, as an explicit act, only where it has all of them.
 *
 * @example
 * ```ts
 * import { openMirror, parseReplicaName } from "./mirror.ts";
 * // const mirror = await openMirror({ name: ssh, store: sshStore }, [{ name: git, store: gitStore }], { deletes: allowDeletes(50), fallback: "never", auto: "manual" });
 * // await mirror.value.settle();
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { type DocId, parseDocId } from "@intellectual-frontiers/anyfs/docs";
import { type Capability, comparePaths, type CoreCapability, type Path, type Prefix, type Problem, parsePrefix, refused, type Revision, ROOT } from "@intellectual-frontiers/anyfs/governance";
import { type AnyStore, type Carried, carriedCapabilities, type Done, type Handler, makeStore, type Op, type Read, type Store, supports } from "@intellectual-frontiers/anyfs/logical";
import { type DeletePolicy, type Glob, parseGlob, type PlanRefusal } from "@intellectual-frontiers/anyfs-bridge/governance";
import { converge, type Dest, type Endpoint, type Ledger, promote as promoteLedger, type PromoteOptions, type PromoteRefusal, type ReplicaState, replicaStatus } from "@intellectual-frontiers/anyfs-bridge/logical";
import { type EventHub, eventHub, type MirrorEvent } from "./events.ts";
import { ledgerBook, type LedgerBook, type LedgerProblem } from "./ledger.ts";

/** The name of a store in a mirror: an identifier, because the ledger of a replica is a document of that name. */
export type ReplicaName = DocId;

/** A name from text, or why it is not one. */
export function parseReplicaName(text: string): Result<ReplicaName, string> {
  return parseDocId(text);
}

/** A store of a mirror, with its name. */
export type Member<S> = { readonly name: ReplicaName; readonly store: S };

/** How a mirror works. */
export type MirrorPolicy = {
  /** What a convergence may delete at a replica: nothing, or at most so many paths each time. */
  readonly deletes: DeletePolicy;
  /** Whether `read` answers from a replica where the primary cannot be reached. */
  readonly fallback: "never" | "unavailable";
  /** Whether a convergence is started after each write (never waited for), or only when `settle` is called. */
  readonly auto: "manual" | "after-write";
  /** Where the ledgers are kept on the primary: `_mirror-ledger` where not given. */
  readonly ledgerPrefix?: Prefix;
  readonly pageSize?: number;
  /** The time in milliseconds since the epoch, for the events: the system's where not given. */
  readonly now?: () => number;
};

/** Why a mirror could not be made or did not do what was asked. */
export type MirrorProblem =
  | { readonly kind: "primary-lacks"; readonly missing: readonly Capability[] }
  | { readonly kind: "duplicate-name"; readonly name: string }
  | { readonly kind: "bad-prefix"; readonly detail: string }
  | { readonly kind: "ledger"; readonly problem: LedgerProblem }
  | { readonly kind: "unknown-replica"; readonly name: string }
  | { readonly kind: "capability"; readonly replica: string; readonly missing: readonly Capability[] }
  | { readonly kind: "refused"; readonly refusal: PromoteRefusal }
  | { readonly kind: "unavailable"; readonly refusal: PlanRefusal };

/** A replica as `status` and `settle` report it: its state against the primary, as the bridge names the states, and whether it could be reached. */
export type ReplicaStatus = { readonly replica: ReplicaName; readonly state: ReplicaState; readonly reachable: boolean; readonly detail?: string };

/** What a convergence of one replica did: the replica's state afterwards, the changes made and failed, and whether its ledger was saved. */
export type Settled = ReplicaStatus & { readonly applied: number; readonly failed: number; readonly ledger: "saved" | LedgerProblem };

/** What a replica is known to hold of a path: what it was last brought to (`converged`), that and the primary has changed it since (`pending`), something else (`diverged`) or nothing is known (`unknown`). */
export type Standing = "converged" | "pending" | "diverged" | "unknown";

/** A read that says where it was answered: by the primary, or by a replica, which is degraded and says what the replica is known to hold. */
export type Answered<T> = { readonly from: "primary"; readonly degraded: false; readonly value: T } | { readonly from: ReplicaName; readonly degraded: true; readonly standing: Standing; readonly value: T };

/** What a promotion did. */
export type Promoted = { readonly from: ReplicaName; readonly to: ReplicaName; readonly lost: number; readonly ledgers: "saved" | readonly LedgerProblem[] };

/** The roles of the stores of a mirror. */
export type Roles = { readonly primary: ReplicaName; readonly replicas: readonly ReplicaName[] };

/** What a primary must have, checked by the compiler: the core capabilities, whatever else it has. */
export type CoreOf<C extends Capability> = [CoreCapability] extends [C] ? unknown : { readonly "a primary has the capabilities": CoreCapability };

/** A mirror: the store, and what is done with the replicas. */
export type Mirror<C extends Capability> = {
  /** The store: the capabilities of the primary, its reads, its writes, and nothing of the ledgers. */
  readonly store: Store<Carried<C>>;
  /** Brings the replicas (or the one named) up to the primary, one after the other. */
  settle(only?: ReplicaName): Promise<Result<readonly Settled[], MirrorProblem>>;
  /** The state of each replica against the primary; nothing is changed. */
  status(): Promise<readonly ReplicaStatus[]>;
  /** Reads a path: the primary's answer, or, where the policy says so and the primary cannot be reached, a replica's, marked as degraded. */
  read(path: Path): Promise<Result<Answered<Read>, Problem>>;
  /** Makes a replica the primary: the old primary becomes a replica. Only as the bridge allows, and only where the replica has every capability of the store. */
  promote(replica: ReplicaName, options?: Pick<PromoteOptions, "acceptLoss" | "acceptDivergence">): Promise<Result<Promoted, MirrorProblem>>;
  roles(): Roles;
  /** Calls `listener` for each event; the function it gives stops it. */
  subscribe(listener: (event: MirrorEvent) => void): () => void;
  /** The events from now on, until the mirror is closed. */
  events(): AsyncIterable<MirrorEvent>;
  /** Waits for the convergences that were started. */
  drain(): Promise<void>;
  /** Waits for them, stops starting more and ends the events. */
  close(): Promise<void>;
};

/** An event before it is given its time. */
type Fresh = MirrorEvent extends infer E ? (E extends { readonly at: number } ? Omit<E, "at"> : never) : never;

type Slot = { name: ReplicaName; store: Dest; ledger: Ledger; readonly pending: Set<Path>; reachable: boolean; detail?: string };

const at = <S>(store: S): Endpoint<S> => ({ store, prefix: ROOT });
const CORE = ["read", "write", "list", "stat", "delete"] as const;
const hasOperation = (c: Capability): boolean => c !== "watch" && c !== "lock";

function describeRefusal(r: PlanRefusal): string {
  return r.kind === "unavailable" ? `${r.problem.kind}${"detail" in r.problem ? `: ${r.problem.detail}` : ""}` : r.kind;
}

/**
 * Opens a mirror: the ledgers of the replicas are read from the primary (a replica with none is brought to nothing), and the mirror is ready. A ledger that cannot be read is a problem, never an empty ledger.
 */
export async function openMirror<C extends Capability>(primary: Member<Store<C>> & CoreOf<C>, replicas: readonly Member<Dest>[], policy: MirrorPolicy): Promise<Result<Mirror<C>, MirrorProblem>> {
  const head = primary.store;
  if (!supports(head, ...CORE)) return err({ kind: "primary-lacks", missing: CORE.filter((c) => !head.capabilities.has(c)) });
  const names = new Set<string>([primary.name]);
  for (const r of replicas) {
    if (names.has(r.name)) return err({ kind: "duplicate-name", name: r.name });
    names.add(r.name);
    const lacking = CORE.filter((c) => !r.store.capabilities.has(c));
    if (lacking.length > 0) return err({ kind: "capability", replica: r.name, missing: lacking });
  }
  const ledgerPrefix = policy.ledgerPrefix ?? parsePrefix("_mirror-ledger");
  const prefix = typeof ledgerPrefix === "string" ? ledgerPrefix : ledgerPrefix.kind === "ok" ? ledgerPrefix.value : undefined;
  if (prefix === undefined || prefix === "") return err({ kind: "bad-prefix", detail: "the ledgers need a prefix of their own, and a prefix that is not the root" });
  const glob: Result<Glob, string> = parseGlob(`${prefix}/**`);
  if (glob.kind === "err") return err({ kind: "bad-prefix", detail: glob.error });
  const rails = { exclude: [glob.value] as const };
  const hidden = (p: string): boolean => p === prefix || p.startsWith(`${prefix}/`);
  const now = policy.now ?? (() => Date.now());
  const pageSize = policy.pageSize ?? 500;
  const hub: EventHub = eventHub();
  const emit = (event: Fresh): void => hub.emit({ ...event, at: now() } as MirrorEvent);

  // the store the mirror talks to: its own handler, whatever it can do; and the same store as the bridge reads and writes it
  let current: AnyStore = head;
  let currentDest: Dest = head;
  let currentName: ReplicaName = primary.name;
  const book = (store: Dest): LedgerBook => {
    const b = ledgerBook(store, prefix as Prefix);
    if (b.kind === "err") throw new Error(b.error);
    return b.value;
  };
  let ledgers = book(currentDest);
  const slots: Slot[] = [];
  for (const r of replicas) {
    const loaded = await ledgers.load(r.name);
    if (loaded.kind === "err") return err({ kind: "ledger", problem: loaded.error });
    slots.push({ name: r.name, store: r.store, ledger: loaded.value, pending: new Set(), reachable: true });
  }

  const declared = carriedCapabilities<C>(head);
  const members = [primary.store, ...replicas.map((r) => r.store)];
  const traits = {
    caseSensitive: members.every((s) => s.traits.caseSensitive),
    ...(() => {
      const limits = members.flatMap((s) => (s.traits.maxObject === undefined ? [] : [s.traits.maxObject]));
      return limits.length === 0 ? {} : { maxObject: Math.min(...limits) };
    })(),
  };

  let chain: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(f: () => Promise<T>): Promise<T> => {
    const run = chain.then(f, f);
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
  let scheduled = false;
  let closed = false;

  const settleOne = async (slot: Slot): Promise<Settled> => {
    const batch = slot.store.capabilities.has("batch");
    const done = await converge(at(currentDest), at(slot.store), slot.ledger, { deletes: policy.deletes, rails, pageSize, apply: { atomic: batch } });
    if (done.kind === "err") {
      slot.reachable = false;
      slot.detail = describeRefusal(done.error);
      const pending = Math.max(slot.pending.size, 1);
      emit({ kind: "behind", replica: slot.name, pending, reachable: false });
      return { replica: slot.name, state: { kind: "behind", pending }, reachable: false, detail: slot.detail, applied: 0, failed: 0, ledger: "saved" };
    }
    slot.reachable = true;
    delete slot.detail;
    slot.ledger = done.value.ledger;
    const failed = done.value.report.failed;
    const applied = done.value.report.done;
    const before = done.value.before;
    if (failed === 0) slot.pending.clear();
    const state: ReplicaState = before.kind === "diverged" ? { kind: "diverged", paths: before.paths, pending: failed } : failed > 0 ? { kind: "behind", pending: failed } : { kind: "in-sync" };
    emit({ kind: "converged", replica: slot.name, applied, failed });
    if (state.kind === "diverged") emit({ kind: "diverged", replica: slot.name, paths: state.paths });
    if (state.kind === "behind") emit({ kind: "behind", replica: slot.name, pending: state.pending, reachable: true });
    return { replica: slot.name, state, reachable: true, applied, failed, ledger: "saved" };
  };

  const settleAll = async (only?: ReplicaName): Promise<Result<readonly Settled[], MirrorProblem>> => {
    const chosen = only === undefined ? slots : slots.filter((s) => s.name === only);
    if (only !== undefined && chosen.length === 0) return err({ kind: "unknown-replica", name: only });
    const done: Settled[] = [];
    for (const slot of chosen) done.push(await settleOne(slot));
    // the ledgers of the replicas that were reached are written together, so that a primary that is a branch makes one commit of them
    const reached = done.filter((d) => d.reachable);
    const saved = await ledgers.saveMany(chosen.filter((c) => reached.some((d) => d.replica === c.name)).map((c) => ({ replica: c.name, ledger: c.ledger })));
    return ok(saved.kind === "ok" ? done : done.map((d) => (d.reachable ? { ...d, ledger: saved.error } : d)));
  };

  const schedule = (): void => {
    if (policy.auto !== "after-write" || scheduled || closed) return;
    scheduled = true;
    void exclusive(async () => {
      scheduled = false;
      await settleAll();
    });
  };

  const changed = (paths: readonly Path[], op: "put" | "delete" | "rename" | "append", revs: readonly (Revision | undefined)[]): void => {
    if (paths.length === 0) return;
    for (const [i, path] of paths.entries()) {
      for (const s of slots) s.pending.add(path);
      const rev = revs[i];
      emit({ kind: "written", op, path, ...(rev === undefined ? {} : { rev }) });
    }
    emit({ kind: "queued", pending: new Set(slots.flatMap((s) => [...s.pending])).size });
    schedule();
  };

  const after = (op: Op, done: Done): void => {
    switch (op.op) {
      case "write":
        if (done.op === "write") changed([op.path], "put", [done.value.rev]);
        return;
      case "append":
        if (done.op === "append") changed([op.path], "append", [done.value.rev]);
        return;
      case "delete":
        if (done.op === "delete" && done.value.existed) changed([op.path], "delete", [undefined]);
        return;
      case "rename":
        if (done.op === "rename") {
          for (const s of slots) s.pending.add(op.from);
          changed([op.to], "rename", [done.value.rev]);
        }
        return;
      case "batch":
        if (done.op === "batch") {
          for (const r of done.value.results) {
            if (r.kind === "put") changed([r.path], "put", [r.rev]);
            else if (r.existed) changed([r.path], "delete", [undefined]);
          }
        }
        return;
      case "read":
      case "stat":
      case "list":
      case "history":
      case "rangeRead":
      case "search":
        return;
    }
  };

  const hiddenOp = (op: Op): Problem | undefined => {
    const refuse = (path: string): Problem => refused("outside-scope", `${path} is below ${prefix}, which the mirror keeps for its ledgers`);
    switch (op.op) {
      case "read":
      case "write":
      case "stat":
      case "delete":
      case "history":
      case "rangeRead":
      case "append":
        return hidden(op.path) ? refuse(op.path) : undefined;
      case "rename":
        return hidden(op.from) ? refuse(op.from) : hidden(op.to) ? refuse(op.to) : undefined;
      case "batch": {
        const bad = op.changes.find((c) => hidden(c.path));
        return bad === undefined ? undefined : refuse(bad.path);
      }
      case "list":
      case "search":
        return hidden(op.prefix) ? refuse(op.prefix) : undefined;
    }
  };

  const handle: Handler = async (op) => {
    const refusal = hiddenOp(op);
    if (refusal !== undefined) return err(refusal);
    const r = await current.handle(op);
    if (r.kind === "err") return r;
    if (op.op === "list" && r.value.op === "list") return ok({ op: "list", value: { ...r.value.value, entries: r.value.value.entries.filter((e) => !hidden(e.path)) } });
    after(op, r.value);
    return r;
  };

  const store = makeStore({ id: `mirror:${primary.name}`, place: primary.store.place, consistency: primary.store.consistency, traits, capabilities: declared, handle });

  const standing = (slot: Slot, path: Path, digest: string): Standing => {
    const known = slot.ledger.applied.get(path);
    return known === undefined ? "unknown" : known !== digest ? "diverged" : slot.pending.has(path) ? "pending" : "converged";
  };

  const mirror: Mirror<C> = {
    store,
    settle: (only) => exclusive(() => settleAll(only)),
    async status() {
      const out: ReplicaStatus[] = [];
      for (const slot of slots) {
        const s = await replicaStatus(at(currentDest), at(slot.store), slot.ledger, { rails, pageSize });
        if (s.kind === "ok") out.push({ replica: slot.name, state: s.value, reachable: true });
        else out.push({ replica: slot.name, state: { kind: "behind", pending: Math.max(slot.pending.size, 1) }, reachable: false, detail: describeRefusal(s.error) });
      }
      return out;
    },
    async read(path) {
      const got = await currentDest.read(path);
      if (got.kind === "ok") return ok({ from: "primary", degraded: false, value: got.value });
      if (got.error.kind !== "unavailable" || policy.fallback !== "unavailable" || hidden(path)) return got;
      for (const slot of slots) {
        const r = await slot.store.read(path);
        if (r.kind === "err") continue;
        const digest = await sha256(r.value.bytes);
        emit({ kind: "degraded-read", path, from: slot.name });
        return ok({ from: slot.name, degraded: true, standing: standing(slot, path, digest), value: r.value });
      }
      return got;
    },
    promote: (replica, options = {}) =>
      exclusive(async () => {
        const slot = slots.find((s) => s.name === replica);
        if (slot === undefined) return err({ kind: "unknown-replica", name: replica });
        const lacking = [...primary.store.capabilities].filter((c) => hasOperation(c) && !slot.store.capabilities.has(c));
        if (lacking.length > 0) return err({ kind: "capability", replica, missing: lacking });
        const done = await promoteLedger(at(currentDest), at(slot.store), slot.ledger, { ...options, rails, pageSize });
        if (done.kind === "err") return err(done.error.kind === "unavailable" ? { kind: "unavailable", refusal: done.error.refusal } : { kind: "refused", refusal: done.error });
        const oldBook = ledgers;
        const formerNames = slots.map((s) => s.name);
        const old = { name: currentName, store: current, dest: currentDest };
        current = slot.store;
        currentDest = slot.store;
        currentName = slot.name;
        ledgers = book(currentDest);
        const index = slots.indexOf(slot);
        slots[index] = { name: old.name, store: old.dest, ledger: done.value.ledger, pending: new Set(), reachable: true };
        // the others are brought to what they share with the new primary: what they hold that it does not is divergence for a person to decide
        for (const other of slots) {
          if (other === slots[index]) continue;
          const agreed = await promoteLedger(at(other.store), at(currentDest), { applied: new Map() }, { acceptLoss: Number.MAX_SAFE_INTEGER, acceptDivergence: true, rails, pageSize });
          other.ledger = agreed.kind === "ok" ? agreed.value.ledger : { applied: new Map() };
          other.pending.clear();
        }
        const problems: LedgerProblem[] = [];
        const saved = await ledgers.saveMany(slots.map((s) => ({ replica: s.name, ledger: s.ledger })));
        if (saved.kind === "err") problems.push(saved.error);
        for (const n of formerNames) await oldBook.remove(n);
        emit({ kind: "promoted", from: old.name, to: slot.name, lost: done.value.lost });
        return ok({ from: old.name, to: slot.name, lost: done.value.lost, ledgers: problems.length === 0 ? ("saved" as const) : problems });
      }),
    roles: () => ({ primary: currentName, replicas: slots.map((s) => s.name) }),
    subscribe: (listener) => hub.subscribe(listener),
    events: () => hub.stream(),
    async drain() {
      for (;;) {
        const seen = chain;
        await seen;
        if (seen === chain) return;
      }
    },
    async close() {
      closed = true;
      await mirror.drain();
      hub.close();
    },
  };
  return ok(mirror);
}

/** The paths of a state that is diverged, in order; none for any other. */
export function divergedPaths(state: ReplicaState): readonly Path[] {
  return state.kind === "diverged" ? [...state.paths].sort(comparePaths) : [];
}
