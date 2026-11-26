/**
 * Tests of sources and selections (commons dossier 0002-dossier-core FR-001, FR-002): a hash that is the hash of the body, the refusals of a set, and the order and the as-of of a selection.
 *
 * @module
 */
import fc from "fast-check";
import { canonicalSelection, checkSources, EPOCH, instantOf, intersect, meets, select, sourceOf } from "@intellectual-frontiers/dossier/logical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { sources as made } from "./fixtures.ts";

proves(["0002-dossier-core FR-001"], "a source has the hash of its body, and a set with a wrong hash or two contents for an id is refused", async () => {
  const [a] = await made();
  assert(a !== undefined);
  assertEquals(a.class, "internal");
  assertEquals(a.hash.length, 64);
  const bad = await sourceOf({ id: "Not An Id", kind: "k", observedAt: "2026-11-20T09:00:00Z", body: 1 });
  assertEquals(bad.kind, "err");
  const late = await sourceOf({ id: "x", kind: "k", observedAt: "yesterday", body: 1 });
  assertEquals(late.kind, "err");
  const wrong = await checkSources([{ ...a, hash: "0".repeat(64) }]);
  assert(wrong.kind === "err" && wrong.error.code === "E-DOSSIER-SOURCE-HASH");
  const twice = await checkSources([a, a]);
  assert(twice.kind === "ok" && twice.value.length === 1, "the same id with the same content is held once");
  const other = await sourceOf({ id: a.id, kind: a.kind, observedAt: a.observedAt, body: { other: true } });
  assert(other.kind === "ok");
  const conflict = await checkSources([a, other.value]);
  assert(conflict.kind === "err" && conflict.error.code === "E-DOSSIER-SOURCE-CONFLICT");
});

proves(["0002-dossier-core FR-002"], "a selection gives one list in the order of the ids, as of an instant, whatever the order of the sources", async () => {
  const all = await made();
  const sel = { kinds: ["quality-run"] };
  const asOf = "2026-11-26T00:00:00Z";
  const ids = select(sel, all, asOf).map((s) => s.id);
  assertEquals(ids, ["quality/run-001", "quality/run-002"]);
  assertEquals(select(sel, all, "2026-11-21T00:00:00Z").map((s) => s.id), ["quality/run-001"]);
  fc.assert(fc.property(fc.shuffledSubarray([...all], { minLength: 0 }), (some) => {
    const a = select(sel, some, asOf).map((s) => s.id);
    return JSON.stringify(a) === JSON.stringify([...a].sort());
  }));
  const [first, , , , reading] = all;
  assert(first !== undefined && reading !== undefined);
  assert(!meets({ about: ["synthetic-boundary-01"] }, reading), "a source with no boundary meets no selection of a boundary");
  const both = intersect({ kinds: ["quality-run", "reading"] }, { kinds: ["reading"], tags: ["b", "a"] });
  assertEquals(both, canonicalSelection({ kinds: ["reading"], tags: ["a", "b"] }));
  for (const s of all) assertEquals(meets(both, s), meets({ kinds: ["quality-run", "reading"] }, s) && meets({ kinds: ["reading"], tags: ["b", "a"] }, s));
  assertEquals(instantOf("latest", []), EPOCH);
  assertEquals(instantOf("latest", all), "2026-11-25T09:00:00Z");
  assertEquals(instantOf("2026-01-01T00:00:00Z", all), "2026-01-01T00:00:00Z");
});
