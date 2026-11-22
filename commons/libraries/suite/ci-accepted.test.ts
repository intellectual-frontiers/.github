/**
 * The accepted risks (commons 0002-libraries-ci-findings FR-009, 0038-build-policy FR-008) as real typed files in a temporary folder: a good acceptance is read, and each rule of an acceptance is found where it is broken, naming the file; the real program ends 1 for a problem and 0 for none.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadAcceptances } from "../src/ci/accepted.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const SPEC = "0002-libraries-ci-findings";
const file = (o: Record<string, string>): string => `export const acceptance = ${JSON.stringify({ id: "f-1111111111111111", owner: "the core team", reason: "waiting for the compiler release that fixes it", from: "2026-11-01", until: "2026-12-01", by: "shah", ...o })};\n`;

proves([`${SPEC} FR-009`], "a good acceptance is read and each rule is found in a real file, naming it; the program ends 1 for a problem and 0 for none", async () => {
  const dir = mkdtempSync(join(tmpdir(), "accepted-"));
  try {
    writeFileSync(join(dir, "f-1111111111111111.ts"), file({}));
    const good = await loadAcceptances(dir);
    assertEquals([good.acceptances.length, good.problems.length], [1, 0]);
    const program = new URL("../src/ci/accepted.ts", import.meta.url).pathname;
    assertEquals(spawnSync("bun", [program, dir], { encoding: "utf8" }).status, 0);
    writeFileSync(join(dir, "f-2222222222222222.ts"), file({ id: "f-2222222222222222", by: "claude" }));
    writeFileSync(join(dir, "f-3333333333333333.ts"), file({ id: "f-3333333333333333", reason: "no", until: "2029-01-01" }));
    writeFileSync(join(dir, "wrong-name.ts"), file({ id: "f-4444444444444444" }));
    writeFileSync(join(dir, "f-5555555555555555.ts"), "export const nothing = 1;\n");
    writeFileSync(join(dir, "f-6666666666666666.ts"), file({ id: "f-1111111111111111" }));
    const bad = await loadAcceptances(dir);
    const text = bad.problems.join("\n");
    assert(text.includes("f-2222222222222222.ts: claude is not an approver"), text);
    assert(text.includes("f-3333333333333333.ts") && text.includes("at most 366 days") && text.includes("reason is given in a sentence"), text);
    assert(text.includes("wrong-name.ts: the file is named for the finding"), text);
    assert(text.includes("f-5555555555555555.ts: exports no `acceptance`"), text);
    assert(text.includes("f-6666666666666666.ts") && text.includes("is accepted twice") || text.includes("f-1111111111111111 is accepted twice"), text);
    const run = spawnSync("bun", [program, dir], { encoding: "utf8" });
    assertEquals(run.status, 1);
    assertEquals((await loadAcceptances(join(dir, "none"))).problems.length, 0, "no folder is no acceptance");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
