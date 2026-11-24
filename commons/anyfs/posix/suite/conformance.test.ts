/**
 * Tests of the conformance suite of AnyFS POSIX (commons anyfs-posix 0005-anyfs-posix-conformance FR-001 to FR-004): the suite chooses its cases by the capabilities of a store, every view the library makes passes
 * every case it is held to (a store in memory, a store of the core capabilities alone and a store in a folder, each with and without markers), the model cases are seeded, and a view that pretends is found.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import type { Capability } from "@intellectual-frontiers/anyfs/governance";
import { ALL_CASES, CASES, casesFor, generator, MODEL_SEEDS, MODEL_STEPS, modelCase, runCase, runPosixConformance, type World } from "../src/logical/conformance/mod.ts";
import { err } from "@intellectual-frontiers/core";
import type { Posix } from "../src/logical/mod.ts";
import { coreWorld, folderRoot, keepPolicy, localWorld, memoryWorld } from "./worlds.ts";
import { defaultPolicy, native } from "../src/governance/mod.ts";
import { posix } from "../src/physical/mod.ts";
import { memoryStoreOf } from "./stores.ts";

const CORE: readonly Capability[] = ["read", "write", "list", "stat", "delete"];
const ids = (cs: readonly { readonly id: string }[]): readonly string[] => cs.map((c) => c.id);

proves(["0005-anyfs-posix-conformance FR-001"], "the suite chooses its cases by what the store has and lacks, and a case that needs a trace is run only for a world that gives one", () => {
  const rich = ids(casesFor([...CORE, "cas", "rename", "batch"]));
  const core = ids(casesFor(CORE));
  assert(rich.includes("close-conflict") && rich.includes("append-and-truncate") && !rich.includes("unguarded-close") && !rich.includes("read-modify-write-refused"));
  assert(core.includes("unguarded-close") && core.includes("read-modify-write-refused") && !core.includes("close-conflict") && !core.includes("append-and-truncate"));
  assert(!rich.includes("plans-cover-execution") && ids(casesFor(CORE, true)).includes("plans-cover-execution"));
  assertEquals(ids(casesFor(["read", "list", "stat"])).filter((i) => !i.startsWith("model")).length > 0, true);
  for (const id of ids(casesFor(["read", "list", "stat"]))) assert(!id.startsWith("model-"), "a store that cannot be written is not given the model cases");
  assertEquals(new Set(ids(ALL_CASES)).size, ALL_CASES.length, "case ids are unique");
  assertEquals(ids(ALL_CASES).filter((i) => i.startsWith("model-")).length, MODEL_SEEDS.length);
  assert(CASES.every((c) => c.title.length > 20));
});

async function failures(make: () => Promise<World>): Promise<{ readonly failed: readonly string[]; readonly ran: number }> {
  const reports = await runPosixConformance(make);
  return { failed: reports.filter((r) => r.failure !== undefined).map((r) => `${r.id}: ${r.failure}`), ran: reports.length };
}

proves(["0005-anyfs-posix-conformance FR-002"], "a view of a store in memory, with and without markers, passes every case it is held to", async () => {
  for (const policy of [defaultPolicy(), keepPolicy()]) {
    const r = await failures(async () => memoryWorld(policy, true));
    assertEquals(r.failed, []);
    assert(r.ran >= 20, `${r.ran} cases ran`);
  }
});

proves(["0005-anyfs-posix-conformance FR-002"], "a view of a store of the five core capabilities, with and without markers, passes every case it is held to, and is shown what it lacks", async () => {
  for (const policy of [defaultPolicy(), keepPolicy()]) {
    const r = await failures(async () => coreWorld(policy, true));
    assertEquals(r.failed, []);
    assert(r.ran >= 20);
  }
});

proves(["0005-anyfs-posix-conformance FR-002"], "a view of a store in a folder, with and without markers, passes every case it is held to", async () => {
  const root = await folderRoot();
  try {
    let n = 0;
    for (const policy of [defaultPolicy(), keepPolicy()]) {
      const r = await failures(async () => localWorld(root.dir, n++, policy));
      assertEquals(r.failed, []);
      assert(r.ran >= 20);
    }
  } finally {
    await root.done();
  }
});

proves(["0005-anyfs-posix-conformance FR-003"], "a seed gives the same sequence every time, the model cases pass, and a view that differs from the model is named with the seed and the step", async () => {
  const a = generator(3);
  const b = generator(3);
  assertEquals([a(), a(), a()], [b(), b(), b()]);
  assert(generator(3)() !== generator(4)());
  assertEquals(MODEL_STEPS, 250);
  for (const seed of MODEL_SEEDS) {
    const report = await runCase(modelCase(seed, 120), async () => memoryWorld());
    assertEquals(report.failure, undefined, `seed ${seed}`);
  }
  // a view that loses the last byte of what it reads differs from the model at a step
  const lossy = async (): Promise<World> => {
    const w = memoryWorld();
    const view: Posix = {
      ...w.posix,
      readFile: async (path) => {
        const r = await w.posix.readFile(path);
        return r.kind === "ok" && r.value.value.length > 0 ? { kind: "ok", value: { ...r.value, value: r.value.value.slice(0, -1) } } : r;
      },
    };
    return { posix: view };
  };
  const failed = await runCase(modelCase(1, 250), lossy);
  assert(failed.failure !== undefined, "a view that loses bytes differs from the model");
  assertStringIncludes(failed.failure ?? "", "seed 1, step");
});

proves(["0005-anyfs-posix-conformance FR-004"], "a view that pretends is found: a wrong fidelity, a loss of bytes and an operation the plan does not name each fail a case", async () => {
  // a view that says every rename is native, whatever the store did
  const lyingWorld = async (): Promise<World> => {
    const w = coreWorld(defaultPolicy(), true);
    const view: Posix = {
      ...w.posix,
      rename: async (from, to) => {
        const r = await w.posix.rename(from, to);
        return r.kind === "ok" ? { kind: "ok", value: { ...r.value, fidelity: native } } : r;
      },
    };
    return { ...w, posix: view };
  };
  const lie = await runCase(CASES.find((c) => c.id === "rename-file")!, lyingWorld);
  assert(lie.failure !== undefined && lie.failure.includes("expected emulated, got native"), `a view that calls a copy and a delete native: ${lie.failure}`);
  // a view that stores nothing it is asked to write
  const forgetting = async (): Promise<World> => {
    const w = memoryWorld();
    return { posix: { ...w.posix, writeFile: async () => ({ kind: "ok", value: { value: undefined, fidelity: native, notes: [] } }) } };
  };
  const forgot = await runCase(CASES.find((c) => c.id === "round-trip")!, forgetting);
  assert(forgot.failure !== undefined, "a view that forgets what it writes");
  // a view whose stat asks the store for a list that the plan of stat-file does not name
  const sneaky = async (): Promise<World> => {
    const s = memoryStoreOf("sneaky");
    const { traced } = await import("./worlds.ts");
    const t = traced(s);
    const real = posix(t.store);
    const view: Posix = {
      ...real,
      stat: async (path) => {
        await t.store.handle({ op: "list", prefix: "" as never, limit: 1 });
        return real.stat(path);
      },
    };
    return { posix: view, trace: t.trace, reset: t.reset };
  };
  const extra = await runCase(CASES.find((c) => c.id === "plans-cover-execution")!, sneaky);
  assert(extra.failure !== undefined && extra.failure.includes("which its plan does not name"), `an operation outside the plan: ${extra.failure}`);
  const none = await runCase(CASES.find((c) => c.id === "plans-cover-execution")!, async () => ({ posix: memoryWorld().posix }));
  assert(none.failure !== undefined && none.failure.includes("records the operations"), "a case that needs a trace says so");
  assert(err("x").kind === "err");
});
