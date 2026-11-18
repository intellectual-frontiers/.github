// Spec: 0002-engine FR-002
/**
 * A contribution point (commons data 0002-engine FR-002): it carries its name, it is frozen, and a name with no namespace does not compile, which the compiler checks
 * where this file is compiled and the line marked `@ts-expect-error` says.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/commons/ts/runtime/test";
import { type ContributionPoint, point } from "@intellectual-frontiers/data/engine";

proves(["0002-engine FR-002"], "a point carries its name and is frozen, and a name with no namespace does not compile", () => {
  const vocabulary: ContributionPoint<{ readonly term: string }> = point<{ readonly term: string }>("governance.vocabulary");
  assertEquals(vocabulary.name, "governance.vocabulary");
  assert(Object.isFrozen(vocabulary));
  assertEquals(point<number>("a.b").name, "a.b");
  // @ts-expect-error a name with no namespace is not a PointName
  const bad: ContributionPoint<number> = point<number>("vocabulary");
  assertEquals(bad.name, "vocabulary");
});
