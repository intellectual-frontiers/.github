/**
 * A demonstration of the build policy (commons 0038-build-policy): a test that fails on purpose, on a branch, to show that a module's failing test is a finding and never a red run for the other modules. It is removed again.
 *
 * @module
 */
import { assertEquals, proves } from "@intellectual-frontiers/test";

proves(["0002-soc2-package FR-001"], "a demonstration: this test fails on purpose", () => {
  assertEquals(1 + 1, 3);
});
