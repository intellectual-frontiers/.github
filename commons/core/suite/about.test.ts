/**
 * Tests of `src/about.ts` (commons 0001-core FR-008): the types of the facts a library states of itself are checked by the compiler, with negative controls, and the entry exports no value.
 *
 * @module
 */
import type { About, AboutArea, AboutFolder } from "../src/about.ts";
import * as entry from "../src/about.ts";
import { assertEquals, proves } from "@intellectual-frontiers/test";

proves(["0001-core FR-008"], "an About value of every shape is accepted, one with an unknown field or no title is refused, and the entry exports no value", () => {
  const folder: AboutFolder = { path: "src/", what: "The modules.", mayImport: ["src/ only"] };
  const area: AboutArea = { title: "Core", slug: "core", entryPoints: ["src/mod.ts"] };
  const about: About = {
    title: "Example",
    summary: "What the example is.",
    spec: { repo: "commons", id: "0001-example" },
    folders: [folder],
    commands: [{ run: "bun run verify", does: "Proves the library." }],
    rules: [{ rule: "Nothing is imported.", enforcedBy: [{ kind: "review" }] }],
    areas: [area],
  };
  // @ts-expect-error an unknown field is refused, so a misspelled fact does not pass for a fact
  const unknown: About = { title: "x", summary: "y", colour: "red" };
  // @ts-expect-error a title is required
  const untitled: About = { summary: "y" };
  void [unknown, untitled];
  assertEquals(about.title, "Example");
  assertEquals(Object.keys(entry), []);
});
