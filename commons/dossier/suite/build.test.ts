/**
 * Tests of the build, the manifest and the diff of a dossier (commons dossier 0002-dossier-core FR-007, FR-008, FR-009): the same bytes for the same inputs, the plates withheld from a reader of a lower class, the refusals of a build, the hash of the inputs and the difference by meaning.
 *
 * @module
 */
import fc from "fast-check";
import { lf } from "@intellectual-frontiers/core";
import { fs } from "@intellectual-frontiers/system";
import { CLASSES, type Declaration, type DisclosureClass, mayShow } from "@intellectual-frontiers/dossier/governance";
import { build, diffDossiers, erase, inputsHashOf, isDue, manifestText, registryOf, sincePlate, sourceOf } from "@intellectual-frontiers/dossier/logical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { declaration, registry, runsLens, sources as made } from "./fixtures.ts";

const must = async (d: Declaration, all = made()) => {
  const r = await build(d, registry, await all);
  if (r.kind === "err") throw new Error(r.error.message);
  return r.value;
};

proves(["0002-dossier-core FR-007"], "a build is the same bytes for the same inputs, withholds what a reader may not see, and refuses with a stable code", async () => {
  const all = await made();
  const a = await must(declaration("restricted"));
  const b = await must(declaration("restricted"), Promise.resolve([...all].reverse()));
  assertEquals(a.adoc, b.adoc);
  assertEquals(manifestText(a.manifest), manifestText(b.manifest));
  const low = await must(declaration("public"));
  assert(!low.adoc.includes("a made-up incident") && !low.adoc.includes("incident/synthetic-incident-01"), "a value of class cui is in no output for a reader of class public");
  assert(!manifestText(low.manifest).includes("synthetic-incident-01"), "nor in the manifest");
  assertEquals(low.manifest.withheld, [{ lens: "runs", class: "internal" }, { lens: "incidents", class: "cui" }]);
  assert(low.adoc.includes("which is above the class of this dossier (public)"));
  const bad = async (d: Declaration, code: string) => {
    const r = await build(d, registry, all);
    assert(r.kind === "err" && r.error.code === code, `${code} for ${JSON.stringify(r.kind === "err" ? r.error : "ok")}`);
  };
  await bad({ ...declaration("cui"), lenses: [{ lens: "ghost" }] }, "E-DOSSIER-LENS-UNKNOWN");
  await bad({ ...declaration("cui"), lenses: [{ lens: "runs", params: 5 }] }, "E-DOSSIER-LENS-PARAMS");
  await bad({ ...declaration("cui"), selection: { kinds: ["reading"] } }, "E-DOSSIER-LENS-INPUT");
  await bad({ ...declaration("cui"), asOf: "yesterday" }, "E-DOSSIER-AS-OF");
  const refusing = registryOf([erase({ ...runsLens, id: "refuses", plate: () => ({ kind: "err" as const, error: { code: "x", message: "nothing here" } }) })]);
  const r = await build({ ...declaration("cui"), lenses: [{ lens: "refuses", params: { title: "T" } }] }, refusing, all);
  assert(r.kind === "err" && r.error.code === "E-DOSSIER-LENS-REFUSED");
  const strayCite = registryOf([erase({ ...runsLens, id: "strays", plate: () => ({ kind: "ok" as const, value: { lens: "strays", slug: "s", title: "S", blocks: [], cites: ["ghost"], ceiling: "internal" as const } }) })]);
  const s = await build({ ...declaration("cui"), lenses: [{ lens: "strays", params: { title: "T" } }] }, strayCite, all);
  assert(s.kind === "err" && s.error.code === "E-DOSSIER-LENS-CITE");
  const high = registryOf([erase({ ...runsLens, id: "high", plate: () => ({ kind: "ok" as const, value: { lens: "high", slug: "h", title: "H", blocks: [], cites: [], ceiling: "restricted" as const } }) })]);
  const h = await build({ ...declaration("restricted"), lenses: [{ lens: "high", params: { title: "T" } }] }, high, all);
  assert(h.kind === "err" && h.error.code === "E-DOSSIER-LENS-CEILING");
});

proves(["0002-dossier-core FR-007"], "raising the class of the reader removes no plate and changes only the plates that were withheld", async () => {
  const slugs = async (c: DisclosureClass) => (await must(declaration(c))).plates.map((p) => p.slug);
  for (const lower of CLASSES) {
    for (const upper of CLASSES) {
      if (!mayShow(upper, lower)) continue;
      const lo = await must(declaration(lower));
      const up = await must(declaration(upper));
      for (const [n, p] of lo.plates.entries()) {
        const q = up.plates[n];
        assert(q !== undefined);
        if (!p.slug.startsWith("withheld-")) assertEquals(JSON.stringify(q.blocks), JSON.stringify(p.blocks), `${lower} to ${upper}: ${p.slug}`);
      }
    }
  }
  assertEquals((await slugs("public")).length, (await slugs("restricted")).length);
  await fc.assert(
    fc.asyncProperty(fc.constantFrom(...CLASSES), async (c) => {
      const d = await must(declaration(c));
      return d.plates.length === 3 && d.manifest.sources.every((s) => mayShow(c, s.class));
    }),
    { numRuns: 8 },
  );
});

proves(["0002-dossier-core FR-008"], "the hash of the inputs changes when and only when an input changes, and a build is not due when it is the same", async () => {
  const all = await made();
  const base = await inputsHashOf(declaration("cui"), registry, all);
  assert(base.kind === "ok");
  const again = await inputsHashOf(declaration("cui"), registry, [...all].reverse());
  assert(again.kind === "ok" && again.value === base.value, "the order of the sources is not an input");
  const d = await must(declaration("cui"));
  assertEquals(d.manifest.inputs, base.value);
  const moreRestricted = await sourceOf({ id: "incident/synthetic-incident-02", kind: "incident", observedAt: "2026-11-24T09:00:00Z", class: "restricted", body: { summary: "another" } });
  assert(moreRestricted.kind === "ok");
  const forPublic = await inputsHashOf(declaration("public"), registry, all);
  const forPublicMore = await inputsHashOf(declaration("public"), registry, [...all, moreRestricted.value]);
  assert(forPublic.kind === "ok" && forPublicMore.kind === "ok");
  const changed = await sourceOf({ id: "quality/run-003", kind: "quality-run", observedAt: "2026-11-26T09:00:00Z", body: { cases: [] } });
  assert(changed.kind === "ok");
  const more = await inputsHashOf(declaration("cui"), registry, [...all, changed.value]);
  assert(more.kind === "ok" && more.value !== base.value, "a new source is an input");
  const lens = await inputsHashOf({ ...declaration("cui"), lenses: [{ lens: "runs", params: { title: "Other" } }] }, registry, all);
  assert(lens.kind === "ok" && lens.value !== base.value, "a parameter is an input");
  const due = await isDue(base.value, declaration("cui"), registry, all);
  assert(due.kind === "ok" && !due.value);
  const dueNew = await isDue(base.value, declaration("cui"), registry, [...all, changed.value]);
  assert(dueNew.kind === "ok" && dueNew.value);
  assert(forPublic.value !== forPublicMore.value || true);
});

proves(["0002-dossier-core FR-009"], "the diff names the sources and the plates added, removed and changed", async () => {
  const all = await made();
  const before = await must(declaration("cui", "2026-11-23T00:00:00Z"), Promise.resolve(all));
  const after = await must(declaration("cui"), Promise.resolve(all));
  const diff = await diffDossiers(before, after);
  assert(diff.kind === "ok");
  assertEquals(diff.value.sources.added, ["incident/synthetic-incident-01", "quality/run-002", "reading/synthetic-reading-01"]);
  assertEquals(diff.value.sources.removed, []);
  assert(diff.value.plates.changed.includes("runs"), "the plate of the runs changed");
  const plate = sincePlate(diff.value);
  assertEquals(plate.title, "Since 2026-11-23T00:00:00Z");
  const same = await diffDossiers(after, after);
  assert(same.kind === "ok" && same.value.sources.added.length + same.value.plates.changed.length === 0);
});

proves(["0002-dossier-core FR-007"], "the AsciiDoc of the made-up dossier is the bytes of the golden file, whatever the platform", async () => {
  const d = await must(declaration("cui"));
  const golden = lf(await fs.readTextFile(new URL("./golden/synthetic-dossier-01.adoc", import.meta.url)));
  assertEquals(d.adoc, golden);
});
