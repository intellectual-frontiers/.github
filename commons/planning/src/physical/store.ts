// Spec: 0004-planning-sources FR-001
/**
 * The store of events over an AnyFS store (0037-planning FR-007, FR-038): one file for each event at `<item>/<event>.json5`, the traces of the sources under `.traces/` and the outbox under `.outbox/`. Loading is
 * total (a file that is not of the schema is a finding and is not read), gives each item by `fold` and gives the clock after every id it holds, so that the next id is after every id taken; an event is written
 * expecting its file to be absent, so that an event is never replaced; two stores merge by the union of their event files.
 *
 * @example
 * ```ts
 * import { loadStore } from "./store.ts";
 * // const loaded = await loadStore(store, { clock, wallMs, policy });
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { expectAbsent, expectAny, type Path, parsePath, ROOT, type Problem, describeProblem } from "@intellectual-frontiers/anyfs/governance";
import type { Store } from "@intellectual-frontiers/anyfs/logical";
import { DEFAULT_POLICY, type Item, type ItemEvent, type OutboxEntry, type Policy, type Trace } from "@intellectual-frontiers/planning/governance";
import { type Clock, fold, seeId } from "@intellectual-frontiers/planning/logical";
import { decodeEvent, decodeOutbox, decodeTrace, encodeEvent, encodeOutbox, encodeTrace, eventPath } from "@intellectual-frontiers/planning/records";

/** An AnyFS store of what a planning store needs: read, write, list and the expectation of a revision. */
export type PlanningStoreBackend = Store<"read" | "write" | "list" | "cas">;

/** A file of the store that could not be read, and why. */
export type StoreFinding = { readonly path: string; readonly message: string };

/** Why the store could not be read or written. */
export type StoreProblem = { readonly kind: "store"; readonly message: string };

/** What a store holds. */
export type Loaded = {
  readonly events: readonly ItemEvent[];
  readonly items: readonly Item[];
  readonly traces: readonly Trace[];
  readonly outbox: readonly OutboxEntry[];
  readonly findings: readonly StoreFinding[];
  /** The clock after every id the store holds: the next id made from it comes after them all. */
  readonly clock: Clock;
};

const fail = (message: string): { readonly kind: "err"; readonly error: StoreProblem } => err({ kind: "store", message });
const decoder = new TextDecoder();
const encoder = new TextEncoder();
const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const pathOf = (text: string): Result<Path, StoreProblem> => {
  const p = parsePath(text);
  return p.kind === "ok" ? ok(p.value) : fail(p.error);
};
const problem = (p: Problem): StoreProblem => ({ kind: "store", message: describeProblem(p) });

/** Every file path of the store, in order. */
async function allPaths(store: PlanningStoreBackend): Promise<Result<readonly Path[], StoreProblem>> {
  const out: Path[] = [];
  let after: Parameters<PlanningStoreBackend["list"]>[1];
  for (;;) {
    const page = await store.list(ROOT, after);
    if (page.kind === "err") return err(problem(page.error));
    out.push(...page.value.entries.map((e) => e.path));
    if (page.value.next === undefined) break;
    after = { after: page.value.next };
  }
  return ok(out.sort(byText));
}

/** What a store holds: the events (each file read once), the items folded under the policy, the traces and the outbox. */
export async function loadStore(store: PlanningStoreBackend, options: { readonly clock: Clock; readonly wallMs: number; readonly policy?: Policy }): Promise<Result<Loaded, StoreProblem>> {
  const paths = await allPaths(store);
  if (paths.kind === "err") return paths;
  const events: ItemEvent[] = [];
  const traces: Trace[] = [];
  const outbox: OutboxEntry[] = [];
  const findings: StoreFinding[] = [];
  for (const path of paths.value) {
    if (!path.endsWith(".json5")) continue;
    const read = await store.read(path);
    if (read.kind === "err") {
      findings.push({ path, message: describeProblem(read.error) });
      continue;
    }
    const text = decoder.decode(read.value.bytes);
    if (path.startsWith(".traces/")) {
      const t = decodeTrace(text);
      if (t.kind === "ok") traces.push(t.value);
      else findings.push({ path, message: t.error.message });
    } else if (path.startsWith(".outbox/")) {
      const o = decodeOutbox(text);
      if (o.kind === "ok") outbox.push(o.value);
      else findings.push({ path, message: o.error.message });
    } else {
      const e = decodeEvent(text);
      if (e.kind === "ok") events.push(e.value);
      else findings.push({ path, message: e.error.message });
    }
  }
  let clock = options.clock;
  for (const e of events) {
    const seen = seeId(clock, e.id, options.wallMs);
    if (seen.kind === "ok") clock = seen.value;
    else findings.push({ path: eventPath(e), message: `the id ${e.id} is further ahead of the clock than its limit` });
  }
  const by = new Map<string, ItemEvent[]>();
  for (const e of events) by.set(e.item, [...(by.get(e.item) ?? []), e]);
  const items: Item[] = [];
  for (const [id, list] of [...by.entries()].sort(([a], [b]) => byText(a, b))) {
    const f = fold(list, options.policy ?? DEFAULT_POLICY);
    if (f.kind === "ok") items.push(f.value);
    else findings.push({ path: id, message: `the events of ${id} are not an item: ${f.error.kind}` });
  }
  return ok({ events: events.sort((a, b) => byText(a.id, b.id)), items, traces: traces.sort((a, b) => byText(a.source, b.source) || byText(a.fingerprint, b.fingerprint)), outbox, findings, clock });
}

/** Writes events: each file expects to be absent, an event already there with the same text is not an error and one with other text is. Returns how many were new. */
export async function writeEvents(store: PlanningStoreBackend, events: readonly ItemEvent[]): Promise<Result<number, StoreProblem>> {
  let made = 0;
  for (const e of events) {
    const path = pathOf(eventPath(e));
    if (path.kind === "err") return path;
    const text = encodeEvent(e);
    const w = await store.write(path.value, encoder.encode(text), expectAbsent);
    if (w.kind === "ok") {
      made++;
      continue;
    }
    if (w.error.kind !== "conflict") return err(problem(w.error));
    const have = await store.read(path.value);
    if (have.kind === "err") return err(problem(have.error));
    if (decoder.decode(have.value.bytes) !== text) return fail(`the event ${e.id} is in the store with another content: an event is never replaced`);
  }
  return ok(made);
}

/** The path of a trace: the source and the hash of the fingerprint. */
export async function tracePath(t: Pick<Trace, "source" | "fingerprint">): Promise<string> {
  return `.traces/${t.source.replace(/[^A-Za-z0-9._-]/gu, "_")}/${(await sha256(t.fingerprint)).slice(0, 32)}.json5`;
}

/** Writes traces, each replacing the one before it. */
export async function writeTraces(store: PlanningStoreBackend, traces: readonly Trace[]): Promise<Result<number, StoreProblem>> {
  for (const t of traces) {
    const path = pathOf(await tracePath(t));
    if (path.kind === "err") return path;
    const w = await store.write(path.value, encoder.encode(encodeTrace(t)), expectAny);
    if (w.kind === "err") return err(problem(w.error));
  }
  return ok(traces.length);
}

/** The path of an outbox entry. */
export const outboxPath = (e: OutboxEntry): string => `.outbox/${e.patch.source.replace(/[^A-Za-z0-9._-]/gu, "_")}.${e.patch.event.id}.json5`;

/** Writes outbox entries. */
export async function writeOutbox(store: PlanningStoreBackend, entries: readonly OutboxEntry[]): Promise<Result<number, StoreProblem>> {
  for (const e of entries) {
    const path = pathOf(outboxPath(e));
    if (path.kind === "err") return path;
    const w = await store.write(path.value, encoder.encode(encodeOutbox(e)), expectAny);
    if (w.kind === "err") return err(problem(w.error));
  }
  return ok(entries.length);
}

/** The union of two stores' event files: every event file of `from` that `into` lacks is written to it. Returns how many were copied. */
export async function mergeInto(into: PlanningStoreBackend, from: PlanningStoreBackend): Promise<Result<number, StoreProblem>> {
  const paths = await allPaths(from);
  if (paths.kind === "err") return paths;
  let copied = 0;
  for (const path of paths.value) {
    if (!path.endsWith(".json5") || path.startsWith(".")) continue;
    const read = await from.read(path);
    if (read.kind === "err") return err(problem(read.error));
    const w = await into.write(path, read.value.bytes, expectAbsent);
    if (w.kind === "ok") copied++;
    else if (w.error.kind !== "conflict") return err(problem(w.error));
  }
  return ok(copied);
}
