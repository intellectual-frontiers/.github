/**
 * Tests of the conformance of the bridge (commons anyfs-bridge 0005-bridge-conformance FR-001, FR-002): every law holds for the stores of the library, in memory and in a folder, in every pairing, with a
 * destination that has no compare-and-write, and a pair that breaks a law is named.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { fs, path as osPath } from "@intellectual-frontiers/system";
import { makeStore, type OpCapability, only } from "@intellectual-frontiers/anyfs/logical";
import { localStore } from "@intellectual-frontiers/anyfs/local";
import { memoryStore } from "@intellectual-frontiers/anyfs/memory";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { BRIDGE_CASES, type MakePair, runBridgeConformance } from "../src/conformance/mod.ts";
import type { Dest } from "../src/logical/mod.ts";

const failures = (reports: Awaited<ReturnType<typeof runBridgeConformance>>): readonly string[] => reports.filter((r) => r.failure !== undefined).map((r) => `${r.id}: ${r.failure}`);

async function withFolders<T>(count: number, use: (roots: readonly string[]) => Promise<T>): Promise<T> {
  const roots: string[] = [];
  try {
    for (let i = 0; i < count; i++) roots.push(await fs.makeTempDir({ prefix: "anyfs-bridge-" }));
    return await use(roots);
  } finally {
    for (const r of roots) await fs.remove(r, { recursive: true }).catch(() => undefined);
  }
}

async function local(root: string): Promise<Dest> {
  const r = await localStore(root, { create: true });
  if (r.kind === "err") throw new Error(r.error);
  return r.value as unknown as Dest;
}

proves(["0005-bridge-conformance FR-001"], "every law holds between two stores in memory, and the suite has a law for each promise of a transfer", async () => {
  const reports = await runBridgeConformance(async () => ({ source: memoryStore({ name: "s" }), dest: memoryStore({ name: "d" }) }));
  assertEquals(failures(reports), []);
  assertEquals(reports.length, BRIDGE_CASES.length);
  assert(BRIDGE_CASES.length >= 8);
  assertEquals(new Set(BRIDGE_CASES.map((c) => c.id)).size, BRIDGE_CASES.length);
});

proves(["0005-bridge-conformance FR-001"], "every law holds in every pairing of a store in memory and a store in a folder", async () => {
  for (const [from, to] of [["memory", "local"], ["local", "memory"], ["local", "local"]] as const) {
    await withFolders(2, async ([x = "", y = ""]) => {
      const make: MakePair = async () => {
        // a new, empty folder for each law
        const a = from === "memory" ? memoryStore({ name: "s" }) : await local(await fs.makeTempDir({ prefix: "anyfs-bridge-src-", dir: x }));
        const b = to === "memory" ? memoryStore({ name: "d" }) : await local(await fs.makeTempDir({ prefix: "anyfs-bridge-dst-", dir: y }));
        return { source: a as unknown as Dest, dest: b as unknown as Dest };
      };
      assertEquals(failures(await runBridgeConformance(make)), [], `${from} to ${to}`);
    });
  }
  void osPath;
});

proves(["0005-bridge-conformance FR-001"], "the laws hold for a destination that cannot compare and write: its writes are unguarded, and the report says so", async () => {
  const make: MakePair = async () => ({ source: memoryStore({ name: "s" }), dest: only(memoryStore({ name: "d" }), ["read", "write", "list", "stat", "delete"]) as unknown as Dest });
  assertEquals(failures(await runBridgeConformance(make)), []);
});

proves(["0005-bridge-conformance FR-002"], "a destination that says it deleted and did not breaks the laws of a sync, and the suite names them", async () => {
  const make: MakePair = async () => {
    const inner = memoryStore({ name: "d" });
    const caps = [...inner.capabilities].filter((c): c is OpCapability => c !== "watch" && c !== "lock");
    const forgetful = makeStore({
      id: "forgetful",
      place: inner.place,
      consistency: inner.consistency,
      traits: inner.traits,
      capabilities: caps,
      handle: async (op) => (op.op === "delete" ? ok({ op: "delete", value: { existed: true } }) : inner.handle(op)),
    }) as unknown as Dest;
    return { source: memoryStore({ name: "s" }), dest: forgetful };
  };
  const reports = await runBridgeConformance(make);
  const broken = failures(reports).map((f) => f.split(":")[0]);
  assert(broken.includes("sync-is-idempotent"), `the second sync plans the delete again: ${broken.join(", ")}`);
});

proves(["0005-bridge-conformance FR-002"], "a pair whose stores cannot be listed fails every law with a sentence, and nothing is thrown", async () => {
  const make: MakePair = async () => {
    const inner = memoryStore({ name: "d" });
    const caps = [...inner.capabilities].filter((c): c is OpCapability => c !== "watch" && c !== "lock");
    const deaf = makeStore({ id: "deaf", place: inner.place, consistency: inner.consistency, traits: inner.traits, capabilities: caps, handle: async (op) => (op.op === "list" ? err({ kind: "unavailable", detail: "down", retryable: true }) : inner.handle(op)) }) as unknown as Dest;
    return { source: memoryStore({ name: "s" }), dest: deaf };
  };
  const reports = await runBridgeConformance(make);
  assert(failures(reports).length > 0, "the laws that list failed");
  assert(reports.every((r) => r.failure === undefined || r.failure.length > 0));
});
