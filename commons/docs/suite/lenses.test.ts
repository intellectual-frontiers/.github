/**
 * The lenses (commons 0011-documentation FR-013, FR-014, FR-026): a lens is a value of `Lens` that a configuration passes; it reads what is its library's and makes its pages after the order it is given, and what
 * it cannot describe is a finding of the build. The package ships no lens and commons passes none, so the tests pass one of their own.
 *
 * @module
 */
import { assertEquals, proves } from "@intellectual-frontiers/test";
import { readApi } from "../src/extract/api.ts";
import type { Lens } from "../src/lens.ts";
import { fixtureArea, freshBuild, ROOT } from "./helpers.ts";

const demo: Lens = {
  name: "demo",
  read: async (_b, areas) => {
    const names = areas.map((a) => a.slug);
    return (build, after) => {
      names.forEach((n, i) => {
        build.add({ path: `models/${n}/index.html`, title: n, description: `The ${n} model.`, section: "models", group: "Demo", order: after + i, blocks: [] });
        if (n === "undescribed") build.found.push({ where: `models/${n}`, problem: { kind: "undescribed", entity: `table ${n}` } });
      });
      return after + names.length;
    };
  },
};

proves(["0011-documentation FR-013", "0011-documentation FR-026"], "a lens is a value of Lens: it reads what is its library's and makes its pages after the order it is given, and a lens that has nothing makes none", async () => {
  const area = fixtureArea("model", "mod.ts", "Library");
  const apis = await readApi(ROOT, [{ slug: "model", entryPoints: ["commons/docs/suite/fixture/mod.ts"] }]);
  const b = freshBuild();
  const make = await demo.read(b, [area], apis);
  assertEquals(make(b, 300), 301, "one area takes one place");
  assertEquals(b.pages.find((p) => p.path === "models/model/index.html")?.order, 300);
  const none = await demo.read(b, [], apis);
  assertEquals(none(b, 400), 400, "no area, no page");
});

proves(["0011-documentation FR-014"], "what a lens cannot describe is a finding of the build, which names the entity", async () => {
  const b = freshBuild();
  const area = { ...fixtureArea("undescribed", "mod.ts", "Library"), slug: "undescribed" };
  const make = await demo.read(b, [area], []);
  make(b, 100);
  assertEquals(b.found.map((f) => f.problem), [{ kind: "undescribed", entity: "table undescribed" }]);
});
