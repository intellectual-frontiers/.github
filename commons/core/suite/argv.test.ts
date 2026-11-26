/**
 * Tests of `src/argv.ts` (0001-core FR-009): a step is words, who runs it and the exit codes expected; it decodes, and what is not safe to run is refused with a sentence.
 *
 * @module
 */
import { argvFindings, argvStep } from "../src/argv.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

proves(["0001-core FR-009"], "a step decodes and a plain command has no finding", () => {
  const ok = argvStep({ argv: ["apt-get", "install", "-y", "git"], as: "root", expect: [0, 2], evidence: { kind: "file-sha256", path: "/tmp/synthetic-file-01" } });
  assert(ok.kind === "ok");
  assertEquals(argvFindings(ok.value), []);
  assertEquals(argvStep({ argv: "apt-get install", as: "root", expect: [0] }).kind, "err");
  assertEquals(argvStep({ argv: ["x"], as: "admin", expect: [0] }).kind, "err");
  assertEquals(argvStep({ argv: ["x"], as: "user", expect: [0], evidence: { kind: "file-sha256" } }).kind, "err");
});

proves(["0001-core FR-009"], "an empty vector, a NUL, a shell given a command string and a bad exit code are refused", () => {
  const step = (argv: readonly string[], expect: readonly number[] = [0]) => ({ argv, as: "user" as const, expect });
  assertEquals(argvFindings(step([])), ["the argument vector is empty"]);
  assert(argvFindings(step([""])).length === 1);
  assert(argvFindings(step(["a\0b"])).length === 1);
  for (const shell of [["sh", "-c", "x"], ["/bin/bash", "-c", "x"], ["cmd.exe", "/C", "x"], ["powershell", "-Command", "x"], ["pwsh.exe", "-command", "x"]]) assert(argvFindings(step(shell)).length === 1, shell.join(" "));
  assertEquals(argvFindings(step(["bash", "script.sh"])), []);
  assert(argvFindings(step(["x"], [])).length === 1);
  assert(argvFindings(step(["x"], [256])).length === 1);
});
