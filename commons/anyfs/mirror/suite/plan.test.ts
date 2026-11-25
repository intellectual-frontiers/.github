/**
 * Tests of the policy, the reports and the pure part of the mirrored store (commons anyfs-mirror 0002-mirror-governance FR-001 to FR-004, 0003-mirror-logical FR-001 to FR-005): the paths an operation changes, how two
 * listings differ, the steps that make them the same and the traits of a mirror.
 *
 * @module
 */
import { expectAny, type Revision, parseRevision } from "@intellectual-frontiers/anyfs/governance";
import { assertEquals, proves } from "@intellectual-frontiers/test";
import fc from "fast-check";
import { DEFAULT_POLICY, describeDrift, describeFailurePolicy, describeLag, driftSize, FAILURE_POLICIES, isFailurePolicy, isInSync } from "../src/governance/mod.ts";
import { affectedPaths, driftOf, type Entry, isMutation, largestWrite, mirrorTraits, stepsOf, traitsProblem } from "../src/logical/mod.ts";
import { bytes, p } from "./kit.ts";

const rev = (n: string): Revision => {
  const r = parseRevision(`sha256:${n}`);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const entry = (path: string, n: string): Entry => ({ path: p(path), rev: rev(n) });

proves(["0002-mirror-governance FR-001", "0002-mirror-governance FR-002"], "the ways to answer a secondary's failure are two, the default records the lag, and each is described", () => {
  assertEquals([...FAILURE_POLICIES], ["record", "report"]);
  assertEquals(DEFAULT_POLICY.onSecondaryFailure, "record");
  assertEquals(isFailurePolicy("report"), true);
  assertEquals(isFailurePolicy("ignore"), false);
  for (const f of FAILURE_POLICIES) assertEquals(describeFailurePolicy(f).length > 10, true);
});

proves(["0002-mirror-governance FR-003", "0002-mirror-governance FR-004"], "a drift is empty exactly where nothing differs, and a drift and a lag are said in one sentence", () => {
  const empty = { member: "b", missing: [], different: [], extra: [] };
  assertEquals(isInSync(empty), true);
  assertEquals(describeDrift(empty), "b is the same as the primary");
  const some = { member: "b", missing: [p("a")], different: [p("c")], extra: [] };
  assertEquals(driftSize(some), 2);
  assertEquals(isInSync(some), false);
  assertEquals(describeDrift(some), "b differs from the primary: 1 missing, 1 at another revision, 0 that the primary does not have");
  assertEquals(describeLag({ member: "b", path: p("a"), reason: "down" }), "b did not take a: down");
});

proves(["0003-mirror-logical FR-001"], "an operation that reads changes no path, and one that changes names each path once in the order of the paths", () => {
  const w = { op: "write", path: p("b"), bytes: bytes("x"), expect: expectAny } as const;
  assertEquals([isMutation(w), affectedPaths(w)], [true, [p("b")]]);
  assertEquals(affectedPaths({ op: "rename", from: p("z"), to: p("a"), expect: expectAny }), [p("a"), p("z")]);
  assertEquals(
    affectedPaths({ op: "batch", changes: [{ kind: "put", path: p("b"), bytes: bytes("1"), expect: expectAny }, { kind: "delete", path: p("a"), expect: expectAny }, { kind: "put", path: p("b"), bytes: bytes("2"), expect: expectAny }] }),
    [p("a"), p("b")],
  );
  for (const op of [{ op: "read", path: p("a") }, { op: "stat", path: p("a") }, { op: "history", path: p("a") }] as const) assertEquals([isMutation(op), affectedPaths(op)], [false, []]);
});

proves(["0003-mirror-logical FR-002", "0003-mirror-logical FR-003"], "two listings differ by what is missing, what is at another revision and what is extra, the steps copy before they remove, and applying the steps leaves no drift", () => {
  const d = driftOf("b", [entry("a", "1"), entry("b", "2"), entry("c", "3")], [entry("b", "9"), entry("c", "3"), entry("z", "4")]);
  assertEquals([d.missing, d.different, d.extra], [[p("a")], [p("b")], [p("z")]]);
  assertEquals(stepsOf(d), [{ kind: "copy", path: p("a") }, { kind: "copy", path: p("b") }, { kind: "remove", path: p("z") }]);
  assertEquals(isInSync(driftOf("b", [entry("a", "1")], [entry("a", "1")])), true);
  const names = fc.uniqueArray(fc.constantFrom("a", "b", "c", "d", "e/f", "e/g"), { maxLength: 6 });
  const hex = fc.constantFrom("1", "2", "3");
  fc.assert(
    fc.property(fc.array(fc.tuple(names, fc.array(hex, { minLength: 6, maxLength: 6 })), { minLength: 2, maxLength: 2 }), (pair) => {
      const lists = pair.map(([ns, hs]) => ns.map((n, i) => entry(n, hs[i] ?? "1")));
      const [a = [], b = []] = lists;
      // applying the steps to the secondary gives the primary's listing
      const d2 = driftOf("m", a, b);
      const result = new Map(b.map((e) => [e.path as string, e.rev]));
      for (const s of stepsOf(d2)) {
        if (s.kind === "remove") result.delete(s.path);
        else result.set(s.path, a.find((e) => e.path === s.path)?.rev ?? rev("0"));
      }
      return isInSync(driftOf("m", a, [...result].map(([path, r]) => ({ path: p(path), rev: r }))));
    }),
  );
});

proves(["0003-mirror-logical FR-004", "0003-mirror-logical FR-005", "0003-mirror-logical FR-006"], "the traits of a mirror are the narrowest of its stores, and a secondary that folds case cannot follow a primary that does not", () => {
  assertEquals(mirrorTraits([{ caseSensitive: true }, { caseSensitive: true, maxObject: 100 }, { caseSensitive: true, maxObject: 50 }]), { caseSensitive: true, maxObject: 50 });
  assertEquals(mirrorTraits([{ caseSensitive: true }, { caseSensitive: false }]), { caseSensitive: false });
  assertEquals(traitsProblem({ caseSensitive: true }, { caseSensitive: false })?.includes("two paths") ?? false, true);
  assertEquals(traitsProblem({ caseSensitive: false }, { caseSensitive: true }), undefined);
  assertEquals(largestWrite({ op: "write", path: p("a"), bytes: bytes("abcd"), expect: expectAny }), 4);
  assertEquals(largestWrite({ op: "read", path: p("a") }), 0);
});
