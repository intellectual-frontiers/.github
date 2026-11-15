/**
 * Tests of `kernel/graph.ts` and `kernel/crypt.ts`: the order puts every node after what it needs or names a cycle (property-tested on
 * random acyclic graphs), the schedule runs each node after what it needs, no more at once than asked, and skips what depends on a failure;
 * SHA-512 crypt gives what glibc gives.
 *
 * @module
 */
import fc from "fast-check";
import { CRYPT_ROUNDS, cryptSalt, sha512Crypt, verifySha512Crypt } from "../../kernel/crypt.ts";
import { type Graph, order, schedule } from "../../kernel/graph.ts";
import { assert, assertEquals, assertRejects, proves } from "../../runtime/test.ts";

const GRAPH = "0005-typescript-runtime FR-033";
const CRYPT = "0005-typescript-runtime FR-034";

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

proves(
  [GRAPH, "0005-typescript-runtime FR-014"],
  "every node comes after the nodes it needs, every node once, the same order every time",
  () => {
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
  },
);

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
  [GRAPH, "0005-typescript-runtime FR-014"],
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

proves([CRYPT], "SHA-512 crypt gives what glibc's crypt(3) gives, rounds clamped as glibc clamps them", async () => {
  const glibc: readonly (readonly [string, string, number | undefined, string])[] = [
    [
      "Hello world!",
      "saltstring",
      undefined,
      "$6$saltstring$svn8UoSVapNtMuq1ukKS4tPQd8iKwSMHWjl/O817G3uBnIFNjnQJuesI68u4OTLiBFdcbYEdFCoEOfaS35inz1",
    ],
    [
      "Hello world!",
      "saltstringsaltstring",
      10000,
      "$6$rounds=10000$saltstringsaltst$OW1/O6BYHV6BcXZu8QVeXbDWra3Oeqh0sbHbbMCVNSnCM/UrjmM0Dp8vOuZeHBy/YTBmSK6H9qs/y3RnOaw5v.",
    ],
    [
      "This is just a test",
      "toolongsaltstring",
      5000,
      "$6$rounds=5000$toolongsaltstrin$lQ8jolhgVRVhY4b5pZKaysCLi0QBxGoNeKQzQ3glMhwllF7oGDZxUhx1yxdYcz/e1JSbq3y6JMxxl8audkUEm0",
    ],
    [
      "the minimum number is still observed",
      "roundstoolow",
      10,
      "$6$rounds=1000$roundstoolow$kUMsbe306n21p9R.FRkW3IGn.S9NPN0x50YhH1xhLsPuWGsUSklZt58jaTfF4ZEQpyUNGc0dqbpBYYBaHHrsX.",
    ],
  ];
  for (const [password, salt, rounds, hash] of glibc) {
    assertEquals(await sha512Crypt(password, salt, rounds), hash);
    assert(await verifySha512Crypt(password, hash));
    assert(!(await verifySha512Crypt(`${password}x`, hash)));
  }
  assert(!(await verifySha512Crypt("x", "$1$md5$notours")));
  assertEquals(CRYPT_ROUNDS.default, 5000);
});

proves(
  [CRYPT, "0005-typescript-runtime FR-014"],
  "a salt from bytes is of crypt's alphabet, and a password hashed with it verifies",
  async () => {
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ minLength: 1, maxLength: 20 }), fc.string({ maxLength: 12 }), async (bytes, password) => {
        const salt = cryptSalt(bytes);
        assert(/^[./0-9A-Za-z]{1,16}$/.test(salt), salt);
        assert(await verifySha512Crypt(password, await sha512Crypt(password, salt, 1000)));
      }),
      { numRuns: 15 },
    );
  },
);
