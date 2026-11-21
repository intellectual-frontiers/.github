/**
 * The links between items (commons planning 0002-planning-core FR-007): the links of kind blocks make a graph with no cycle, and a link that would close one is refused with the items of the cycle named.
 *
 * @module
 */
import fc from "fast-check";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import type { ItemId, Link, LinkKind } from "@intellectual-frontiers/planning/governance";
import { addLink, findBlocksCycle } from "@intellectual-frontiers/planning/logical";
import { itemId, must } from "./support.ts";

const ITEMS: readonly ItemId[] = [0, 1, 2, 3, 4].map((n) => itemId(n));
const at = (i: number): ItemId => ITEMS[i] as ItemId;
const blocks = (a: number, b: number): Link => ({ kind: "blocks", from: at(a), to: at(b) });

proves(["0002-planning-core FR-007"], "a link that would close a cycle of blocks is refused, naming the items of the cycle", () => {
  const two = must(addLink([], blocks(0, 1)));
  const r2 = addLink(two, blocks(1, 0));
  assert(r2.kind === "err" && r2.error.kind === "cycle" && [...r2.error.items].sort().join() === [at(0), at(1)].sort().join());
  const three = must(addLink(must(addLink([], blocks(0, 1))), blocks(1, 2)));
  const r3 = addLink(three, blocks(2, 0));
  assert(r3.kind === "err" && r3.error.kind === "cycle" && [...r3.error.items].sort().join() === [at(0), at(1), at(2)].sort().join());
  assertEquals(findBlocksCycle(three), undefined);
  assertEquals(findBlocksCycle([...three, blocks(2, 0)])?.length, 3);
});

proves(["0002-planning-core FR-007"], "an item is not linked to itself, a link twice is once, and only blocks must be acyclic", () => {
  const self = addLink([], blocks(1, 1));
  assert(self.kind === "err" && self.error.kind === "self-link" && self.error.item === at(1));
  const once = must(addLink([], blocks(0, 1)));
  assertEquals(must(addLink(once, blocks(0, 1))), once);
  // Relations with no order may go both ways.
  const kinds: readonly LinkKind[] = ["same-as", "relates-to", "parent-of"];
  for (const kind of kinds) {
    const there = must(addLink([], { kind, from: at(0), to: at(1) }));
    assert(addLink(there, { kind, from: at(1), to: at(0) }).kind === "ok", kind);
  }
  // A blocks link and a link of another kind the other way are no cycle, whatever the kind.
  for (const kind of ["relates-to", "same-as", "parent-of"] as const) assert(addLink(once, { kind, from: at(1), to: at(0) }).kind === "ok", kind);
  for (const kind of ["relates-to", "same-as", "parent-of"] as const) {
    const mixed = must(addLink(must(addLink([], { kind, from: at(1), to: at(2) })), blocks(0, 1)));
    assert(addLink(mixed, blocks(2, 0)).kind === "ok", `${kind} is no edge of blocks`);
    assertEquals(findBlocksCycle([...mixed, blocks(2, 0)]), undefined);
  }
});

proves(["0002-planning-core FR-007"], "whatever links are added, the accepted blocks have no cycle, and a link is refused exactly when its target already reaches its source", () => {
  const reaches = (links: readonly Link[], from: ItemId, to: ItemId): boolean => {
    const seen = new Set<ItemId>();
    const walk = (n: ItemId): boolean => n === to || (!seen.has(n) && (seen.add(n), links.filter((l) => l.kind === "blocks" && l.from === n).some((l) => walk(l.to))));
    return walk(from);
  };
  fc.assert(
    fc.property(fc.array(fc.tuple(fc.integer({ min: 0, max: 4 }), fc.integer({ min: 0, max: 4 })), { maxLength: 30 }), (pairs) => {
      let links: readonly Link[] = [];
      for (const [a, b] of pairs) {
        const link = blocks(a, b);
        const r = addLink(links, link);
        if (a === b) {
          assert(r.kind === "err" && r.error.kind === "self-link");
        } else if (r.kind === "err") {
          assert(r.error.kind === "cycle" && reaches(links, at(b), at(a)), "refused only for a cycle");
        } else {
          assert(!reaches(links, at(b), at(a)) || links.some((l) => l.from === at(a) && l.to === at(b)), "accepted only without a cycle");
          links = r.value;
        }
        assertEquals(findBlocksCycle(links), undefined);
      }
      return true;
    }),
    { numRuns: 300 },
  );
});
