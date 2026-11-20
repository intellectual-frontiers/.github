/**
 * Headless describes a real program (commons headless 0015-describe FR-001, FR-003, FR-007, FR-008, FR-010): Ergonex, the worked example, is described for every tier of its ladder, its ids are those agreed with the data library, every verb
 * traces to a command, nothing is dropped, and each model is assignable to the `LayeredModel` of the documentation generator's layered lens (commons 0011-documentation FR-029), which reads it as its own.
 *
 * @module
 */
import type { LayeredModel as DocsLayeredModel } from "@intellectual-frontiers/commons/docs";
import { assert, assertEquals, proves } from "../commons/test/src/test.ts";
import { droppedFindings } from "../commons/kanon/src/mod.ts";
import { ergonexProgram } from "../commons/ergonex/src/commands/program.ts";
import { describe } from "../commons/headless/src/describe/mod.ts";
import { placedCommands } from "../commons/headless/src/logical/mod.ts";

const program = ergonexProgram({
  env: {},
  cwd: "/",
  today: "2026-11-20",
  platform: { os: "linux", arch: "x86_64", windows: false },
  places: undefined,
  homeFor: () => undefined,
  stdin: () => Promise.resolve(""),
  argv: [],
  now: () => 0,
});

proves(
  ["0015-describe FR-001", "0015-describe FR-003", "0015-describe FR-008", "0015-describe FR-010"],
  "Ergonex is described for each tier: the ids are the agreed ones, every verb the tier sees traces to its command, no annotation is dropped, and each model is a LayeredModel of the documentation generator",
  () => {
    const models = describe(program);
    assertEquals(
      models.map((m) => m.name),
      program.tiers.ladder.map((t) => `ergonex-${t}`),
    );
    const placed = placedCommands(program.children);
    assert(placed.length >= 20, `${placed.length} verbs`);
    for (const m of models) {
      const docs: DocsLayeredModel = { ...m };
      assertEquals(docs.elements.length, m.elements.length);
      assertEquals(droppedFindings(m).length, 0);
      const verbs = new Set<string>(m.elements.filter((e) => e.kind === "verb").map((e) => e.id));
      assertEquals(verbs.size, placed.length);
      for (const p of placed) {
        assert(verbs.has(`headless:ergonex/${p.id}`), p.id);
        const commands = m.trace.filter((t) => t.from === `headless:ergonex/${p.id}` && t.to.startsWith("cli:"));
        const hidden = m.elements.find((e) => e.id === `headless:ergonex/${p.id}`)?.properties["projections"];
        assertEquals(commands.length, Array.isArray(hidden) && hidden.length === 0 ? 0 : 1, p.id);
        if (commands.length === 1) assertEquals(commands[0]?.to, `cli:ergonex ${p.id}`);
      }
    }
    const top = models[models.length - 1];
    assert(top !== undefined);
    assertEquals(top.elements.filter((e) => e.kind === "cli-command").length, placed.length, "the highest tier sees every verb");
    assert(top.elements.some((e) => e.id === "headless:ergonex/status"));
    assert(top.elements.some((e) => e.id === "cli:ergonex status"));
    assert(top.elements.some((e) => e.id === "headless:ergonex/repos delete#--yes"));
  },
);
