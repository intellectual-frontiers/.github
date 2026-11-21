// Spec: 0003-bridge-transfer FR-008, FR-009, FR-010, FR-011, FR-012
/**
 * The apply of a plan: the only place a bridge changes anything. It refuses a plan that is not the one a person approved or that the stores no longer make; it runs the actions with a bounded number at once;
 * it writes only what the plan says, each write expecting what the plan saw (so that a change made since is a conflict and not an overwrite); it uses the batch of the destination where it has one and the
 * caller asks for it; it checks what it wrote; and it tells what it did as events and ends with a report of every action. Nothing is thrown: a store that fails makes a failed outcome.
 *
 * @example
 * ```ts
 * import { apply } from "./apply.ts";
 * // const report = await apply(prepared, { verify: "auto" });
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { below, type Expect, expectAny, expectRev, type Path, type Problem, type Revision, schemeOf } from "@intellectual-frontiers/anyfs/governance";
import type { AnyStore, Change } from "@intellectual-frontiers/anyfs/logical";
import type { Action, Loss, PlanHash, PlanRefusal } from "@intellectual-frontiers/anyfs-bridge/governance";
import type { Prepared } from "./diff.ts";

/** How what was written is checked: `auto` by the revision where it is the hash of the bytes and by reading it back where it is not, `read-back` always by reading, `none` not at all. */
export type VerifyMode = "auto" | "read-back" | "none";

/** A record of what is done, so that an apply that stopped can go on: a key is marked when its action is finished. */
export type Journal = { isDone(key: string): Promise<boolean>; markDone(key: string): Promise<void> };

/** A journal in memory. */
export function memoryJournal(done: Iterable<string> = []): Journal & { readonly keys: () => readonly string[] } {
  const kept = new Set<string>(done);
  return { isDone: async (key) => kept.has(key), markDone: async (key) => void kept.add(key), keys: () => [...kept] };
}

/** How an apply runs. */
export type ApplyOptions = {
  /** At most this many actions at once. Default 4. */
  readonly concurrency?: number;
  readonly verify?: VerifyMode;
  /** Make the writes, updates and deletes as one batch where the destination has one. Default false. */
  readonly atomic?: boolean;
  /** Make the plan again first and refuse if it is not the same plan. Default true. */
  readonly recheck?: boolean;
  /** Go on with a plan that was applied in part: do not make the plan again, and skip what the journal says is done. */
  readonly resume?: boolean;
  readonly journal?: Journal;
  /** The hash of the plan a person approved. */
  readonly approved?: PlanHash;
  /** Leave the conflicts of the plan and do the rest. Default false: a plan with conflicts is refused. */
  readonly skipConflicts?: boolean;
};

/** Whether what was written is what the plan meant. */
export type Verified = "verified" | "unverifiable";

/** Why an action did not happen. */
export type Failure =
  | { readonly kind: "problem"; readonly problem: Problem }
  | { readonly kind: "stale-source"; readonly detail: string }
  | { readonly kind: "mismatch"; readonly detail: string }
  | { readonly kind: "not-run"; readonly detail: string };

/** What one action came to. `guarded` says whether its write expected a revision. */
export type Outcome = { readonly action: Action; readonly status: "done" | "failed" | "skipped"; readonly verified?: Verified; readonly failure?: Failure; readonly guarded: boolean };

/** What an apply did. */
export type Report = {
  readonly hash: PlanHash;
  readonly outcomes: readonly Outcome[];
  readonly done: number;
  readonly failed: number;
  readonly skipped: number;
  readonly bytes: number;
  /** The writes that expected no revision, because the destination cannot. */
  readonly unguarded: number;
};

/** What an apply tells as it goes. */
export type ApplyEvent =
  | { readonly kind: "planned"; readonly actions: number }
  | { readonly kind: "started"; readonly action: Action }
  | { readonly kind: "outcome"; readonly outcome: Outcome }
  | { readonly kind: "finished"; readonly report: Report };

/** Why an apply did not start. */
export type ApplyRefusal =
  | { readonly kind: "stale"; readonly approved: PlanHash; readonly found: PlanHash }
  | { readonly kind: "not-applicable"; readonly detail: string }
  | { readonly kind: "replan"; readonly refusal: PlanRefusal }
  | { readonly kind: "lossy"; readonly losses: readonly Loss[] }
  | { readonly kind: "conflicts"; readonly count: number };

const keyOfAction = (a: Action): string => {
  switch (a.kind) {
    case "create":
      return `create:${a.target}:${a.src}`;
    case "update":
      return `update:${a.target}:${a.src}`;
    case "delete":
      return `delete:${a.target}:${a.dst}`;
    case "rename":
      return `rename:${a.from}:${a.to}`;
    case "remove-source":
      return `remove-source:${a.rel}:${a.src}`;
    case "skip":
      return `skip:${a.target}`;
    case "conflict":
      return `conflict:${a.target}`;
    default: {
      const never: never = a;
      return never;
    }
  }
};

/** A queue of events that is read as it fills. */
function channel<T>(): { push(value: T): void; close(): void; stream(): AsyncIterable<T> } {
  const queue: T[] = [];
  let wake: (() => void) | undefined;
  let closed = false;
  return {
    push(value) {
      queue.push(value);
      wake?.();
    },
    close() {
      closed = true;
      wake?.();
    },
    async *stream() {
      for (;;) {
        const next = queue.shift();
        if (next !== undefined) {
          yield next;
          continue;
        }
        if (closed) return;
        await new Promise<void>((resolve) => (wake = resolve));
      }
    },
  };
}

/** Runs the thunks with at most `limit` at once. */
async function pool(thunks: readonly (() => Promise<void>)[], limit: number): Promise<void> {
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = next++;
      const thunk = thunks[i];
      if (thunk === undefined) return;
      await thunk();
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, thunks.length)) }, worker));
}

const expectAt = (store: AnyStore, rev: Revision): { readonly expect: Expect; readonly guarded: boolean } =>
  store.capabilities.has("cas") ? { expect: expectRev(rev), guarded: true } : { expect: expectAny, guarded: false };

const problem = (p: Problem): Failure => ({ kind: "problem", problem: p });

/** Runs a prepared plan, telling what it does as events: the last is `finished` with the report. A refusal is the value of the first step. */
export async function applyStream(prepared: Prepared, options: ApplyOptions = {}): Promise<Result<AsyncIterable<ApplyEvent>, ApplyRefusal>> {
  const { plan } = prepared;
  if (plan.mode === "check") return err({ kind: "not-applicable", detail: "a check changes nothing, so there is nothing to apply" });
  const conflicts = plan.actions.filter((a) => a.kind === "conflict").length;
  if (conflicts > 0 && options.skipConflicts !== true) return err({ kind: "conflicts", count: conflicts });
  if (options.approved !== undefined && options.approved !== plan.hash) return err({ kind: "stale", approved: options.approved, found: plan.hash });
  if (options.recheck !== false && options.resume !== true) {
    const again = await prepared.replan();
    if (again.kind === "err") return err({ kind: "replan", refusal: again.error });
    if (again.value.hash !== plan.hash) return err({ kind: "stale", approved: plan.hash, found: again.value.hash });
  }
  const events = channel<ApplyEvent>();
  void run(prepared, options, events).finally(() => events.close());
  return ok(events.stream());
}

/** Runs a prepared plan and ends with the report. */
export async function apply(prepared: Prepared, options: ApplyOptions = {}): Promise<Result<Report, ApplyRefusal>> {
  const started = await applyStream(prepared, options);
  if (started.kind === "err") return started;
  let report: Report | undefined;
  for await (const event of started.value) if (event.kind === "finished") report = event.report;
  return report === undefined ? err({ kind: "not-applicable", detail: "the apply ended without a report" }) : ok(report);
}

async function run(prepared: Prepared, options: ApplyOptions, events: { push(e: ApplyEvent): void }): Promise<void> {
  const { plan, source, dest } = prepared;
  const outcomes: Outcome[] = [];
  const verify = options.verify ?? "auto";
  const journal = options.journal;
  events.push({ kind: "planned", actions: plan.actions.length });
  const record = (outcome: Outcome): void => {
    outcomes.push(outcome);
    events.push({ kind: "outcome", outcome });
  };
  const path = (prefix: Parameters<typeof below>[0], rel: Path): Path | undefined => {
    const r = below(prefix, rel);
    return r.kind === "ok" ? r.value : undefined;
  };

  const readSource = async (a: Extract<Action, { kind: "create" | "update" }>): Promise<Result<Uint8Array, Failure>> => {
    const at = path(source.prefix, a.rel);
    if (at === undefined) return err({ kind: "not-run", detail: `${a.rel} is not a path below the source` });
    const read = await source.store.read(at);
    if (read.kind === "err") return err(problem(read.error));
    if (read.value.rev !== a.src) return err({ kind: "stale-source", detail: `${a.rel} is at ${read.value.rev} and the plan saw ${a.src}` });
    return ok(read.value.bytes);
  };

  const check = async (at: Path, bytes: Uint8Array, written: Revision): Promise<Result<Verified, Failure>> => {
    if (verify === "none") return ok("unverifiable");
    if (verify === "auto" && schemeOf(written) === "sha256") {
      const want = `sha256:${await sha256(bytes)}`;
      return want === written ? ok("verified") : err({ kind: "mismatch", detail: `${at} was written as ${written} and its bytes are ${want}` });
    }
    const back = await dest.store.read(at);
    if (back.kind === "err") return ok("unverifiable");
    if (back.value.bytes.length !== bytes.length || back.value.bytes.some((b, i) => b !== bytes[i])) return err({ kind: "mismatch", detail: `${at} read back differs from what was written` });
    return ok("verified");
  };

  const one = async (action: Action): Promise<Outcome> => {
    switch (action.kind) {
      case "create":
      case "update": {
        const at = path(dest.prefix, action.target);
        if (at === undefined) return { action, status: "failed", failure: { kind: "not-run", detail: `${action.target} is not a path below the destination` }, guarded: false };
        const bytes = await readSource(action);
        if (bytes.kind === "err") return { action, status: "failed", failure: bytes.error, guarded: false };
        const g = action.kind === "create" ? { expect: { kind: "absent" } as Expect, guarded: true } : expectAt(dest.store, action.dst);
        const wrote = await dest.store.handle({ op: "write", path: at, bytes: bytes.value, expect: g.expect });
        if (wrote.kind === "err") return { action, status: "failed", failure: problem(wrote.error), guarded: g.guarded };
        if (wrote.value.op !== "write") return { action, status: "failed", failure: { kind: "not-run", detail: "the store answered another operation" }, guarded: g.guarded };
        const checked = await check(at, bytes.value, wrote.value.value.rev);
        return checked.kind === "err" ? { action, status: "failed", failure: checked.error, guarded: g.guarded } : { action, status: "done", verified: checked.value, guarded: g.guarded };
      }
      case "delete": {
        const at = path(dest.prefix, action.target);
        if (at === undefined) return { action, status: "failed", failure: { kind: "not-run", detail: `${action.target} is not a path below the destination` }, guarded: false };
        const g = expectAt(dest.store, action.dst);
        const r = await dest.store.handle({ op: "delete", path: at, expect: g.expect });
        return r.kind === "err" ? { action, status: "failed", failure: problem(r.error), guarded: g.guarded } : { action, status: "done", guarded: g.guarded };
      }
      case "rename": {
        const from = path(dest.prefix, action.from);
        const to = path(dest.prefix, action.to);
        if (from === undefined || to === undefined) return { action, status: "failed", failure: { kind: "not-run", detail: "a path is not below the destination" }, guarded: false };
        const g = expectAt(dest.store, action.dst);
        const r = await dest.store.handle({ op: "rename", from, to, expect: g.expect });
        return r.kind === "err" ? { action, status: "failed", failure: problem(r.error), guarded: g.guarded } : { action, status: "done", guarded: g.guarded };
      }
      case "remove-source": {
        const at = path(source.prefix, action.rel);
        if (at === undefined) return { action, status: "failed", failure: { kind: "not-run", detail: `${action.rel} is not a path below the source` }, guarded: false };
        const g = expectAt(source.store, action.src);
        const r = await source.store.handle({ op: "delete", path: at, expect: g.expect });
        return r.kind === "err" ? { action, status: "failed", failure: problem(r.error), guarded: g.guarded } : { action, status: "done", guarded: g.guarded };
      }
      case "skip":
      case "conflict":
        return { action, status: "skipped", guarded: false };
      default: {
        const never: never = action;
        return never;
      }
    }
  };

  const guardedRun = async (action: Action): Promise<void> => {
    const key = keyOfAction(action);
    if (journal !== undefined && (await journal.isDone(key))) {
      record({ action, status: "skipped", failure: { kind: "not-run", detail: "the journal says it is done" }, guarded: false });
      return;
    }
    events.push({ kind: "started", action });
    const outcome = await one(action);
    if (outcome.status === "done" && journal !== undefined) await journal.markDone(key);
    record(outcome);
  };

  const concurrency = options.concurrency ?? 4;
  const phase1 = plan.actions.filter((a) => a.kind !== "remove-source" && a.kind !== "skip" && a.kind !== "conflict");
  const passive = plan.actions.filter((a) => a.kind === "skip" || a.kind === "conflict");
  const removals = plan.actions.filter((a): a is Extract<Action, { kind: "remove-source" }> => a.kind === "remove-source");
  for (const a of passive) record(await one(a));

  if (options.atomic === true && dest.store.capabilities.has("batch")) {
    const grouped = phase1.filter((a) => a.kind === "create" || a.kind === "update" || a.kind === "delete");
    const apart = phase1.filter((a) => a.kind === "rename");
    await pool(apart.map((a) => () => guardedRun(a)), concurrency);
    const changes: Change[] = [];
    const sent: { action: Action; bytes?: Uint8Array; at: Path; guarded: boolean }[] = [];
    for (const a of grouped) {
      if (a.kind === "delete") {
        const at = path(dest.prefix, a.target);
        if (at === undefined) continue;
        const g = expectAt(dest.store, a.dst);
        changes.push({ kind: "delete", path: at, expect: g.expect });
        sent.push({ action: a, at, guarded: g.guarded });
      } else if (a.kind === "create" || a.kind === "update") {
        const at = path(dest.prefix, a.target);
        if (at === undefined) continue;
        const bytes = await readSource(a);
        if (bytes.kind === "err") {
          record({ action: a, status: "failed", failure: bytes.error, guarded: false });
          continue;
        }
        const g = a.kind === "create" ? { expect: { kind: "absent" } as Expect, guarded: true } : expectAt(dest.store, a.dst);
        changes.push({ kind: "put", path: at, bytes: bytes.value, expect: g.expect });
        sent.push({ action: a, bytes: bytes.value, at, guarded: g.guarded });
      }
    }
    if (changes.length > 0) {
      for (const s of sent) events.push({ kind: "started", action: s.action });
      const r = await dest.store.handle({ op: "batch", changes });
      if (r.kind === "err" || r.value.op !== "batch") {
        const failure: Failure = r.kind === "err" ? problem(r.error) : { kind: "not-run", detail: "the store answered another operation" };
        for (const s of sent) record({ action: s.action, status: "failed", failure, guarded: s.guarded });
      } else {
        for (const s of sent) {
          if (s.bytes === undefined) {
            record({ action: s.action, status: "done", guarded: s.guarded });
            continue;
          }
          const result = r.value.value.results.find((x) => x.path === s.at);
          const rev = result?.kind === "put" ? result.rev : undefined;
          const checked = rev === undefined ? ok<Verified>("unverifiable") : await check(s.at, s.bytes, rev);
          record(checked.kind === "err" ? { action: s.action, status: "failed", failure: checked.error, guarded: s.guarded } : { action: s.action, status: "done", verified: checked.value, guarded: s.guarded });
        }
      }
    }
  } else {
    await pool(phase1.map((a) => () => guardedRun(a)), concurrency);
  }

  // a move removes the source only where its file is at the destination: made now, or equal already
  const failedRel = new Set<Path>();
  for (const o of outcomes) if (o.status !== "done" && (o.action.kind === "create" || o.action.kind === "update")) failedRel.add(o.action.rel);
  await pool(
    removals.map((a) => async () => {
      if (failedRel.has(a.rel)) {
        record({ action: a, status: "skipped", failure: { kind: "not-run", detail: "its copy did not succeed, so its source is kept" }, guarded: false });
        return;
      }
      await guardedRun(a);
    }),
    concurrency,
  );

  const count = (s: Outcome["status"]): number => outcomes.filter((o) => o.status === s).length;
  const bytes = outcomes.reduce((n, o) => (o.status === "done" && (o.action.kind === "create" || o.action.kind === "update") ? n + o.action.size : n), 0);
  const report: Report = {
    hash: plan.hash,
    outcomes,
    done: count("done"),
    failed: count("failed"),
    skipped: count("skipped"),
    bytes,
    unguarded: outcomes.filter((o) => o.status === "done" && !o.guarded && o.action.kind !== "skip").length,
  };
  events.push({ kind: "finished", report });
}
