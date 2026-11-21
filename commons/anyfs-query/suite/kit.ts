/**
 * What the tests of the query language share: stores in memory with a clock that ticks, a store that counts the operations it is given, a store of a folder and of a Git branch, a context to run a query with, and
 * the reference a query's result is compared with: every object listed and read, and the plan run over them all.
 *
 * @module
 */
import { type Path, expectAny, parsePath, ROOT } from "@intellectual-frontiers/anyfs/governance";
import { type AnyStore, type Op, type OpCapability, makeStore, opCapabilitiesOf } from "@intellectual-frontiers/anyfs/logical";
import { memoryStore, type MemoryStore } from "@intellectual-frontiers/anyfs/memory";
import { type Consent } from "../src/governance/mod.ts";
import { type QueryContext, mountTable, analyze, environmentFunctions, listingRow } from "../src/mod.ts";
import { run, type Row } from "@intellectual-frontiers/lang-sql/aide/exec";
import { assert } from "@intellectual-frontiers/test";

export const NOW = Date.UTC(2026, 0, 10);

export const p = (text: string): Path => {
  const r = parsePath(text);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

const enc = new TextEncoder();

/** A store in memory whose clock ticks one minute at each write, from a start. */
export function timed(name = "fleet"): MemoryStore {
  let t = Date.UTC(2026, 0, 1);
  return memoryStore({ name, clock: () => (t += 60_000) });
}

/** What the tests keep: a fleet's files, a few of them text and one not. */
export const FILES: Readonly<Record<string, string | Uint8Array>> = {
  "machines/alpha.json": '{"host":"alpha","cpu":4,"tags":["web","eu"]}',
  "machines/beta.json": '{"host":"beta","cpu":8,"tags":["db"]}',
  "machines/gamma.json": '{"host":"gamma","cpu":2}',
  "machines/notes.txt": "alpha is the oldest machine",
  "machines/archive/2024.json": '{"host":"old","cpu":1}',
  "docs/readme.md": "# Fleet\nmachines: alpha, beta",
  "docs/img.bin": new Uint8Array([0xff, 0xfe, 0x00, 0xc3, 0x28]),
  "docs/big.txt": "x".repeat(3000),
  "root.txt": "at the root",
};

/** Puts files into a store. */
export async function seed(store: AnyStore, files: Readonly<Record<string, string | Uint8Array>> = FILES): Promise<void> {
  for (const [path, body] of Object.entries(files)) {
    const r = await (store as MemoryStore).write(p(path), typeof body === "string" ? enc.encode(body) : body, expectAny);
    assert(r.kind === "ok", `put ${path}`);
  }
}

/** A store that counts the operations it is given and passes them on. */
export type Counting = { readonly store: AnyStore; readonly ops: Op[]; count(name: Op["op"]): number };

export function counting(inner: AnyStore): Counting {
  const ops: Op[] = [];
  const store = makeStore<OpCapability>({
    id: `${inner.id}-counted`,
    place: inner.place,
    consistency: inner.consistency,
    traits: inner.traits,
    capabilities: opCapabilitiesOf(inner),
    handle: async (op) => {
      ops.push(op);
      return inner.handle(op);
    },
  });
  return { store, ops, count: (name) => ops.filter((o) => o.op === name).length };
}

/** A context for one store named `fleet`, with a clock that stands at `NOW`, or ticks by `tick` milliseconds at each reading. */
export function contextOf(store: AnyStore, consent: Consent = "content", extra: Partial<QueryContext> = {}, tick = 0): QueryContext {
  let t = NOW;
  return { ...mountTable({ fleet: { store, consent } }), clock: { now: () => ((t += tick), t - tick) }, ...extra };
}

/** The rows a query selects from `files` or `content` with nothing pushed down: every object listed, every one read, the plan run over them all. */
export async function reference(store: AnyStore, text: string, readAll = true): Promise<readonly Row[]> {
  const a = analyze(text);
  if (a.kind === "err") throw new Error(JSON.stringify(a.error));
  const all: Row[] = [];
  let after: string | undefined;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for (;;) {
    const r = await store.handle(after === undefined ? { op: "list", prefix: ROOT, limit: 1000 } : { op: "list", prefix: ROOT, limit: 1000, after: after as never });
    if (r.kind !== "ok" || r.value.op !== "list") throw new Error("list");
    for (const s of r.value.value.entries) {
      let row: Row = listingRow("fleet:", s);
      if (a.value.origin.table === "content" && readAll) {
        const b = await store.handle({ op: "read", path: s.path });
        if (b.kind !== "ok" || b.value.op !== "read") throw new Error("read");
        let t: string | null = null;
        try {
          t = decoder.decode(b.value.value.bytes);
        } catch {
          t = null;
        }
        row = { ...row, text: t, is_text: t !== null, redacted: false };
      }
      all.push(row);
    }
    after = r.value.value.next;
    if (after === undefined) break;
  }
  const out = await run(a.value.plan, all, { functions: environmentFunctions(Math.floor(NOW / 1000)) });
  if (out.kind === "err") throw new Error(JSON.stringify(out.error));
  return out.value;
}
