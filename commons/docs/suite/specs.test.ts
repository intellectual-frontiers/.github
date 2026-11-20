/**
 * The pages of the spec kit (commons 0011-documentation FR-015): a page for each specification in force with an anchor and the
 * enforcement of each requirement, the register, the matrix, and the pages that cite a requirement.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { parseSpec } from "../src/extract/specs.ts";
import { ROW_BUDGET, citedBy, specPages } from "../src/pages/specs.ts";
import { freshBuild } from "./helpers.ts";

proves(["0011-documentation FR-015"], "a specification is read into its header, input and requirements", () => {
  const s = parseSpec("0099-x", "# Feature Specification: X\n\n**Spec ID:** 0099-x\n**Status:** Draft\n**Owner:** if\n**Domain:** commons\n**Part of:** 0005-typescript-practice\n\n**Input:** Why.\n\n## A\n\n- **FR-001**: One.\n- **FR-002**: Two,\n  on two lines.\n");
  assertEquals([s.title, s.status, s.partOf, s.input], ["X", "Draft", "0005-typescript-practice", "Why."]);
  assertEquals(s.requirements, [{ id: "FR-001", text: "One." }, { id: "FR-002", text: "Two, on two lines." }]);
});

proves(["0011-documentation FR-015", "0011-documentation FR-039"], "every specification in force has a page with an anchor and the enforcement of each requirement", () => {
  const b = freshBuild();
  specPages(b);
  const chunks = b.pages.filter((p) => p.path.startsWith("specs/matrix/"));
  assert(chunks.length >= 1, "the matrix is split by library");
  assertEquals(b.pages.length, b.kit.specs.length + 2 + chunks.length, "the register, the matrix, its chunks and a page each");
  const own = b.pages.find((p) => p.path === "specs/0011-documentation.html");
  const entries = (own?.blocks ?? []).filter((x) => x.kind === "entry");
  assertEquals(entries.filter((e) => e.kind === "entry" && e.name.startsWith("FR-")).length, b.kit.specs.find((s) => s.id === "0011-documentation")?.requirements.length);
  const first = entries[0];
  assertEquals(first?.kind === "entry" ? [first.id, first.badges[0]?.text] : [], ["fr-001", "check"]);
  assertStringIncludes(JSON.stringify(first), "cd commons/docs && bun run verify");
  const rows = chunks.reduce((n, c) => n + c.blocks.filter((x) => x.kind === "table").reduce((m, t) => m + (t.kind === "table" ? t.rows.length : 0), 0), 0);
  assertEquals(rows, [...b.kit.specs].reduce((n, s) => n + s.requirements.length, 0));
  for (const c of chunks) {
    const n = c.blocks.reduce((m, t) => m + (t.kind === "table" ? t.rows.length : 0), 0);
    assert(n <= Math.max(ROW_BUDGET, ...b.kit.specs.map((s) => s.requirements.length)), `${c.path} stays within the row budget`);
  }
});

proves(["0011-documentation FR-015"], "a requirement cited by another page says so", () => {
  const b = freshBuild();
  specPages(b);
  b.md("As commons 0011-documentation FR-010 says.", { page: "specs/index.html", file: "x.ts" });
  citedBy(b);
  const own = b.pages.find((p) => p.path === "specs/0011-documentation.html");
  const fr = own?.blocks.find((x) => x.kind === "entry" && x.name === "FR-010");
  assert(fr?.kind === "entry" && JSON.stringify(fr.blocks).includes("Cited by"));
});
