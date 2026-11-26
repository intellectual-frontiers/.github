/**
 * Tests of the classes of disclosure (commons dossier 0002-dossier-core FR-003): their order, and a value of a higher class that does not compile where a lower one is the ceiling.
 *
 * @module
 */
import { CLASSES, disclosed, higher, mayShow, show } from "@intellectual-frontiers/dossier/governance";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

proves(["0002-dossier-core FR-003"], "the classes are in order and show takes only a class at most its ceiling", () => {
  assertEquals([...CLASSES], ["public", "internal", "cui", "restricted"]);
  assert(mayShow("cui", "internal"));
  assert(!mayShow("internal", "cui"));
  assertEquals(higher("public", "cui"), "cui");
  assertEquals(show("internal", disclosed("public", "hello")), "hello");
  assertEquals(show("restricted", disclosed("restricted", 1)), 1);
  // @ts-expect-error a value of class cui is not for a reader whose ceiling is public
  const refused: string = show("public", disclosed("cui", "no"));
  assertEquals(refused, "no");
});
