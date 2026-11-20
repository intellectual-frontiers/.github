/**
 * Tests of the contract of a layered model (commons kanon 0001-kanon-checker FR-006): the ids are built as Data and Headless agreed, by smart constructors that refuse what is not an id, and the
 * agreed kinds are listed.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { cliId, headlessId, mcpId, operandId, optionId, parseElementId, PROGRAM_KINDS, PROJECTION_KINDS, restId } from "../src/mod.ts";

function text(r: ReturnType<typeof parseElementId>): string {
  assert(r.kind === "ok");
  return r.value;
}

proves(["0001-kanon-checker FR-006"], "the ids are built as agreed", () => {
  const verb = headlessId("arcactl", "db migrate");
  assertEquals(text(verb), "headless:arcactl/db migrate");
  assertEquals(text(cliId("arcactl", "db migrate")), "cli:arcactl db migrate");
  assertEquals(text(mcpId("arcactl_db_migrate")), "mcp:arcactl_db_migrate");
  assertEquals(text(restId("POST", "/db/migrate")), "rest:POST /db/migrate");
  assert(verb.kind === "ok");
  assertEquals(text(optionId(verb.value, "--dry-run")), "headless:arcactl/db migrate#--dry-run");
  assertEquals(text(operandId(verb.value, "target")), "headless:arcactl/db migrate#target");
});

proves(["0001-kanon-checker FR-006", "0001-kanon-checker FR-009"], "text that is not an id is refused, as a value and not a throw", () => {
  for (const bad of ["", "no scheme", " cli:x", "cli:x ", "cli:", "Cli:x"]) assertEquals(parseElementId(bad).kind, "err", bad);
});

proves(["0001-kanon-checker FR-006"], "the agreed kinds are the six a program says and the three a surface projects them into", () => {
  assertEquals([...PROGRAM_KINDS], ["action", "verb", "option", "operand", "problem-code", "outcome"]);
  assertEquals([...PROJECTION_KINDS], ["cli-command", "mcp-tool", "rest-route"]);
});
