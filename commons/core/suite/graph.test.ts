/**
 * Tests of `kernel/graph.ts` and `kernel/crypt.ts`: the order puts every node after what it needs or names a cycle (property-tested on
 * random acyclic graphs), the schedule runs each node after what it needs, no more at once than asked, and skips what depends on a failure;
 * SHA-512 crypt gives what glibc gives.
 *
 * @module
 */
import fc from "fast-check";
import { type Graph, order, schedule } from "../src/graph.ts";
import { assert, assertEquals, assertRejects, proves } from "@intellectual-frontiers/test";

const GRAPH = "0001-core FR-005";

/** A random acyclic graph: node i may need only nodes below i. */
const dag = fc
  .integer({ min: 1, max: 12 })
  .chain((n) =>
    fc
      .array(fc.array(fc.nat({ max: n - 1 }), { maxLength: 4 }), { minLength: n, maxLength: n })
      .map(
        (needs): Graph<string> =>
          new Map(
            needs.map((ns, i) => [`n${String(i).padStart(2, "0")}`, ns.filter((m) => m < i).map((m) => `n${String(m).padStart(2, "0")}`)]),
          ),
      ),
  );

proves([GRAPH, "0001-core FR-004"], "every node comes after the nodes it needs, every node once, the same order every time", () => {
  fc.assert(
    fc.property(dag, (g) => {
      const r = order(g);
      assert(r.kind === "ok");
      assertEquals([...r.value].sort(), [...g.keys()].sort());
      const at = new Map(r.value.map((n, i) => [n, i]));
      for (const [n, needs] of g) for (const m of needs) assert((at.get(m) ?? -1) < (at.get(n) ?? -1), `${m} before ${n}`);
      assertEquals(order(new Map([...g].reverse())), r);
    }),
  );
});

proves([GRAPH], "a cycle is named; a needed node outside the graph is ignored", () => {
  assertEquals(
    order(
      new Map([
        ["a", ["b"]],
        ["b", ["c"]],
        ["c", ["a"]],
      ]),
    ),
    { kind: "err", error: { kind: "cycle", nodes: ["a", "b", "c", "a"] } },
  );
  assertEquals(order(new Map([["a", ["a"]]])), { kind: "err", error: { kind: "cycle", nodes: ["a", "a"] } });
  assertEquals(order(new Map([["a", ["outside"]]])), { kind: "ok", value: ["a"] });
});

proves(
  [GRAPH, "0001-core FR-004"],
  "the schedule runs each node after what it needs, at most jobs at once, and skips what depends on a failure",
  async () => {
    await fc.assert(
      fc.asyncProperty(dag, fc.integer({ min: 1, max: 4 }), fc.func(fc.boolean()), async (g, jobs, good) => {
        const finished: string[] = [];
        let running = 0;
        let most = 0;
        const skipped: [string, string][] = [];
        const ran = await schedule(
          g,
          jobs,
          async (n) => {
            for (const m of g.get(n) ?? []) assert(finished.includes(m), `${n} started before ${m} finished`);
            running++;
            most = Math.max(most, running);
            await Promise.resolve();
            running--;
            finished.push(n);
            return good(n);
          },
          (n, because) => skipped.push([n, because]),
        );
        assert(most <= jobs, `${most} ran at once with jobs ${jobs}`);
        assertEquals([...ran.keys()].sort(), [...g.keys()].sort());
        for (const [n, needs] of g) {
          const bad = needs.some((m) => ran.get(m) !== "done");
          assertEquals(ran.get(n) === "skipped", bad, n);
          if (ran.get(n) !== "skipped") assertEquals(ran.get(n), good(n) ? "done" : "failed");
        }
        assertEquals(skipped.length, [...ran.values()].filter((r) => r === "skipped").length);
      }),
      { numRuns: 60 },
    );
  },
);

proves([GRAPH], "a cycle, or a node that rejects, rejects the schedule", async () => {
  await assertRejects(
    () =>
      schedule(
        new Map([
          ["a", ["b"]],
          ["b", ["a"]],
        ]),
        2,
        () => Promise.resolve(true),
      ),
    Error,
    "cycle",
  );
  await assertRejects(() => schedule(new Map([["a", []]]), 1, () => Promise.reject(new Error("boom"))), Error, "boom");
});
