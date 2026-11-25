/**
 * The check of the size of `AGENTS.md` (commons 0011-documentation FR-043): a text past the budget in bytes or in lines is a finding that names it, a text within the budget is none, and a missing file is not a
 * finding. The real file of this repository is reported by `repoctl check` and never asserted here: a finding is not a failed test.
 *
 * @module
 */
import { fs, path } from "../commons/system/src/mod.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../commons/test/src/test.ts";
import { BUDGET, findings, main } from "../commons/tools/agents-md-check.ts";

proves(["0011-documentation FR-043"], "a text past the budget in bytes or in lines is a finding that names the file and the budget, a text within it is none", () => {
  assertEquals(findings("AGENTS.md", "# Index\n\n- one rule, linked\n"), []);
  const long = `${"x".repeat(BUDGET.bytes + 1)}\n`;
  const bytes = findings("AGENTS.md", long);
  assertEquals(bytes.length, 1);
  assertStringIncludes(bytes[0] ?? "", `past its budget of ${BUDGET.bytes}`);
  const many = findings("a/AGENTS.md", `${"y\n".repeat(BUDGET.lines + 1)}`);
  assertEquals(many.length, 1);
  assertStringIncludes(many[0] ?? "", `past its budget of ${BUDGET.lines}`);
  assertStringIncludes(many[0] ?? "", "a/AGENTS.md");
});

proves(["0011-documentation FR-043"], "the program exits 1 for a file past the budget, 0 for one within it and for a file that does not exist", async () => {
  const dir = await fs.makeTempDir({ prefix: "agents-md-" });
  const small = path.join(dir, "small.md");
  const big = path.join(dir, "big.md");
  await fs.writeTextFile(small, "# Index\n");
  await fs.writeTextFile(big, `${"z\n".repeat(BUDGET.lines + 5)}`);
  assertEquals(main([small]), 0);
  assertEquals(main([path.join(dir, "missing.md")]), 0);
  assert(main([big]) === 1, "a file past the budget is reported");
});
