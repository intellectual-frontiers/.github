/**
 * Tests of lenses, plates and their compositions (commons dossier 0002-dossier-core FR-004, FR-005): the slug and the citations of a plate, the plate of an empty input, and the laws of the compositions.
 *
 * @module
 */
import fc from "fast-check";
import { ok } from "@intellectual-frontiers/core";
import type { Block, Lens } from "@intellectual-frontiers/dossier/governance";
import { defineLens, emptyPlate, freshness, inputOf, plateOf, redact, restrict, rollup, slugOf, text, unionOf } from "@intellectual-frontiers/dossier/logical";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { runsLens, sources as made, WHEN } from "./fixtures.ts";

proves(["0002-dossier-core FR-004"], "a plate has a stable slug and sorted citations, an empty input says what is absent, and freshness says how old", () => {
  assertEquals(slugOf("Runs of Tests!"), "runs-of-tests");
  assertEquals(slugOf("!!!"), "x");
  const p = plateOf({ lens: { id: "x", ceiling: "public" }, title: "A Title", blocks: [], cites: ["b", "a", "b"] });
  assertEquals(p.slug, "a-title");
  assertEquals(p.cites, ["a", "b"]);
  const e = emptyPlate({ id: "x", ceiling: "public" }, "T", "a run");
  assertEquals(JSON.stringify(e.blocks).includes("no evidence of a run"), true);
  assertEquals(freshness("2026-11-20T09:00:00Z", WHEN), "observed 2026-11-20T09:00:00Z, 6 days before the date of the dossier");
  assertEquals(freshness(WHEN, WHEN), "observed 2026-11-26T12:00:00Z, on the date of the dossier");
});

const fake = (id: string, words: string): Lens<unknown> =>
  defineLens<unknown>({ id, version: "1", title: id, inputs: ["k"], ceiling: "public", decode: (r) => ok(r), plate: () => ok(plateOf({ lens: { id, ceiling: "public" }, title: id, blocks: [{ t: "para", inlines: [text(words)] }] })) });

proves(["0002-dossier-core FR-005"], "restrict, redact, rollup and union compose, and a union gives the same blocks however it is grouped", async () => {
  const all = await made();
  const runs = all.filter((s) => s.kind === "quality-run");
  const input = inputOf(runs, { title: "Runs" }, WHEN);
  const none = restrict(runsLens, { kinds: ["nothing"] }).plate(input);
  assert(none.kind === "ok" && JSON.stringify(none.value.blocks).includes("no evidence"), "a selection that no source meets gives a plate that says so, and no error");
  const low = redact(runsLens, "public");
  assertEquals(low.ceiling, "public");
  assert(low.plate(inputOf(runs, { title: "Runs" }, WHEN)).kind === "ok");
  const rolled = rollup(runsLens, (s) => s.signer ?? "unsigned", "By signer").plate(input);
  assert(rolled.kind === "ok" && rolled.value.blocks[0]?.t === "table" && rolled.value.cites.length === 2);
  fc.assert(
    fc.property(fc.string({ minLength: 1, maxLength: 8 }), fc.string({ minLength: 1, maxLength: 8 }), fc.string({ minLength: 1, maxLength: 8 }), (x, y, z) => {
      const [a, b, c] = [fake("a", x), fake("b", y), fake("c", z)];
      const i = inputOf([], [null, null], WHEN);
      const blocks = (l: Lens<readonly unknown[]>, params: readonly unknown[]): readonly Block[] => {
        const r = l.plate({ ...i, params });
        return r.kind === "ok" ? r.value.blocks : [];
      };
      const left = unionOf("u1", "U", [unionOf("u2", "U", [a, b]) as Lens<unknown>, c]);
      const right = unionOf("u3", "U", [a, unionOf("u4", "U", [b, c]) as Lens<unknown>]);
      const flat = unionOf("u5", "U", [a, b, c]);
      const l = blocks(left, [[null, null], null]);
      return JSON.stringify(l) === JSON.stringify(blocks(right, [null, [null, null]])) && JSON.stringify(l) === JSON.stringify(blocks(flat, [null, null, null]));
    }),
  );
});
