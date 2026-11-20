/**
 * The pages of the spec kit (commons 0011-documentation FR-015): a page for each specification in force with an anchor and the
 * enforcement of each requirement, the register, the matrix, and the pages that cite a requirement.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { parseSpec } from "../extract/specs.ts";
import { citedBy, specPages } from "../pages/specs.ts";
import { freshBuild } from "./helpers.ts";

proves(["0011-documentation FR-015"], "a specification is read into its header, input and requirements", () => {
  const s = parseSpec("0099-x", "# Feature Specification: X\n\n**Spec ID:** 0099-x\n**Status:** Draft\n**Owner:** if\n**Domain:** commons\n**Part of:** 0005-typescript-runtime\n\n**Input:** Why.\n\n## A\n\n- **FR-001**: One.\n- **FR-002**: Two,\n  on two lines.\n");
  assertEquals([s.title, s.status, s.partOf, s.input], ["X", "Draft", "0005-typescript-runtime", "Why."]);
  assertEquals(s.requirements, [{ id: "FR-001", text: "One." }, { id: "FR-002", text: "Two, on two lines." }]);
});

proves(["0011-documentation FR-015"], "every specification in force has a page with an anchor and the enforcement of each requirement", () => {
  const b = freshBuild();
  specPages(b);
  assertEquals(b.pages.length, b.kit.specs.length + 2, "the register, the matrix and a page each");
  const own = b.pages.find((p) => p.path === "specs/0011-documentation.html");
  const entries = (own?.blocks ?? []).filter((x) => x.kind === "entry");
  assertEquals(entries.filter((e) => e.kind === "entry" && e.name.startsWith("FR-")).length, b.kit.specs.find((s) => s.id === "0011-documentation")?.requirements.length);
  const first = entries[0];
  assertEquals(first?.kind === "entry" ? [first.id, first.badges[0]?.text] : [], ["fr-001", "check"]);
  assertStringIncludes(JSON.stringify(first), "cd commons/docs && bun run verify");
  const matrix = b.pages.find((p) => p.path === "specs/matrix.html");
  const table = matrix?.blocks.find((x) => x.kind === "table");
  assertEquals(table?.kind === "table" ? table.rows.length : 0, [...b.kit.specs].reduce((n, s) => n + s.requirements.length, 0));
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
