/**
 * The examples the documentation shows run as written (commons 0011-documentation FR-005): `examples/use.ts` imports the package by its
 * own name, as a harness does once it has installed the release.
 *
 * @module
 */
import { assertEquals, proves } from "../runtime/test.ts";
import { quarter, textOrNothing } from "../examples/use.ts";

proves(["0011-documentation FR-005"], "the example of using the package runs by the package's own name", async () => {
  assertEquals(quarter(8), { kind: "ok", value: 2 });
  assertEquals(quarter(6), { kind: "err", error: "3 is odd" });
  assertEquals(await textOrNothing("/a/file/that/is/not/there"), undefined);
});
