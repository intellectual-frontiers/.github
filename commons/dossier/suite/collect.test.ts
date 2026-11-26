/**
 * Tests of collectors (commons dossier 0003-dossier-collectors FR-001 to FR-006): the order, the gaps, the refusals, and the instant of an empty dossier.
 *
 * @module
 */
import { assertEquals, proves } from "@intellectual-frontiers/test";
import { err, ok } from "@intellectual-frontiers/core";
import { build, collect, defineCollector, registryOf, withGaps, type Collector } from "@intellectual-frontiers/dossier/logical";
import { type Declaration, GAP_KIND } from "@intellectual-frontiers/dossier/governance";

type Env = { readonly facts: readonly { readonly id: string; readonly at: string; readonly n: number }[] };

const counts: Collector<Env> = defineCollector({
  id: "counts",
  version: "1.0.0",
  kinds: ["count"],
  collect: async (env) => ok({ gaps: [], sources: env.facts.map((f) => ({ id: `count/${f.id}`, kind: "count", observedAt: f.at, body: { n: f.n } })) }),
});
const nothing: Collector<Env> = defineCollector({ id: "nothing", version: "1.0.0", kinds: ["rare", "other"], collect: async () => ok({ gaps: [{ collector: "nothing", kind: "other", reason: "the folder is not there" }], sources: [] }) });

const env: Env = { facts: [{ id: "b", at: "2026-11-26T10:00:00Z", n: 2 }, { id: "a", at: "2026-11-25T10:00:00Z", n: 1 }] };

proves(["0003-dossier-collectors FR-002", "0003-dossier-collectors FR-006"], "collectors run in the order of their ids and give the sources in the order of theirs, the same for the same evidence", async () => {
  const one = await collect([nothing, counts], env);
  const two = await collect([counts, nothing], { facts: [...env.facts].reverse() });
  if (one.kind !== "ok" || two.kind !== "ok") throw new Error("collect failed");
  assertEquals(one.value.sources.map((s) => s.id), ["count/a", "count/b"]);
  assertEquals(one.value.sources.map((s) => s.hash), two.value.sources.map((s) => s.hash));
  assertEquals(one.value.ran.map((r) => r.id), ["counts", "nothing"]);
});

proves(["0003-dossier-collectors FR-003"], "a kind a collector declares and finds none of is a gap it names, and a gap it already named is kept", async () => {
  const r = await collect([nothing], env);
  if (r.kind !== "ok") throw new Error("collect failed");
  assertEquals(r.value.gaps.map((g) => `${g.kind}: ${g.reason}`), ["other: the folder is not there", "rare: none found"]);
});

proves(["0003-dossier-collectors FR-001", "0003-dossier-collectors FR-002"], "a source of a kind the collector does not declare, a collector that fails and two collectors with one id are refused", async () => {
  const wrong = defineCollector<Env>({ id: "wrong", version: "1", kinds: ["a"], collect: async () => ok({ gaps: [], sources: [{ id: "x", kind: "b", observedAt: "2026-11-26T10:00:00Z", body: 1 }] }) });
  const bad = defineCollector<Env>({ id: "bad", version: "1", kinds: ["a"], collect: async () => err("the folder cannot be read") });
  const k = await collect([wrong], env);
  const f = await collect([bad], env);
  const d = await collect([counts, counts], env);
  assertEquals(k.kind === "err" ? k.error.code : "", "E-DOSSIER-COLLECTOR-KIND");
  assertEquals(f.kind === "err" ? f.error.message : "", "bad: the folder cannot be read");
  assertEquals(d.kind === "err" ? d.error.code : "", "E-DOSSIER-COLLECTOR-DUPLICATE");
});

proves(["0003-dossier-collectors FR-004"], "the gaps become one source as of the newest of the others, and where nothing was collected there is no instant and the collection is refused", async () => {
  const c = await collect([counts, nothing], env);
  if (c.kind !== "ok") throw new Error("collect failed");
  const all = await withGaps(c.value);
  if (all.kind !== "ok") throw new Error("withGaps failed");
  const gap = all.value.find((s) => s.kind === GAP_KIND);
  assertEquals(gap?.observedAt, "2026-11-26T10:00:00Z");
  const empty = await collect([nothing], env);
  if (empty.kind !== "ok") throw new Error("collect failed");
  const refused = await withGaps(empty.value);
  assertEquals(refused.kind === "err" ? refused.error.code : "", "E-DOSSIER-EMPTY");
});

proves(["0003-dossier-collectors FR-005"], "a dossier as of latest that selects no source is refused and is never dated 1970", async () => {
  const decl: Declaration = { id: "d", title: "D", audience: "internal", asOf: "latest", selection: {}, lenses: [], renditions: ["adoc"], triggers: [] };
  const r = await build(decl, registryOf([]), []);
  assertEquals(r.kind === "err" ? r.error.code : "", "E-DOSSIER-EMPTY");
});
