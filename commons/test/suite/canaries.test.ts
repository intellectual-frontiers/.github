/**
 * Tests of `src/canaries.ts` (0001-test FR-009): every canary has a unique id, a kind and a rule, its text carries `CANARY`, the lookup names the ids there are where one is missing, and the module imports nothing.
 * That the scanner of `repoctl commit` catches each canary by its rule is proved in the suite of Repoctl (0016-repoctl-canaries), which depends on this library.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, assertThrows, proves } from "@intellectual-frontiers/test";
import { CANARIES, canary, canaryText } from "@intellectual-frontiers/test/canaries";
import { fs, path } from "@intellectual-frontiers/system";

proves(["0001-test FR-009"], "every canary has a unique id, a kind, a rule and a text that carries CANARY", () => {
  assert(CANARIES.length > 0);
  assertEquals(new Set(CANARIES.map((c) => c.id)).size, CANARIES.length, "ids are unique");
  for (const c of CANARIES) {
    assert(["private-key", "token", "access-key"].includes(c.kind), c.id);
    assert(c.rule !== "", `${c.id} names its rule`);
    assertStringIncludes(c.text, "CANARY", c.id);
    assertEquals(canaryText(c.id), c.text);
    assertEquals(canary(c.id), c);
  }
});

proves(["0001-test FR-009"], "a canary that is not there throws and names the ids there are", () => {
  assertThrows(() => canary("nope"), Error, "openssh-private-key");
});

proves(["0001-test FR-009"], "the module imports nothing", () => {
  const source = fs.readTextFileSync(path.join(path.dirname(path.fromFileUrl(import.meta.url)), "../src/canaries.ts"));
  assertEquals(source.split("\n").filter((l) => /^\s*(import|export .* from)\b/.test(l)), []);
});
