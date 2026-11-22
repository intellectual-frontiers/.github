/**
 * `repoctl ci step` (commons repoctl 0013-repoctl-ci): the verb is declared once and local, comes only where the capability is on, runs a real command that fails and ends 0 with the finding kept, and ends 2 only for a wrong call.
 *
 * @module
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { err, ok } from "@intellectual-frontiers/core";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { VERBS, verbIds } from "@intellectual-frontiers/repoctl/governance";
import { execute, hostOf } from "./world.ts";
import type { World } from "@intellectual-frontiers/repoctl/logical";

const world = (libraries: () => ReturnType<World["libraries"]["list"]>): World => ({
  repo: "/repo",
  process: { run: () => Promise.resolve({ code: 0, stdout: "", stderr: "" }) },
  files: {
    read: () => Promise.resolve(undefined),
    write: () => Promise.resolve(),
    remove: () => Promise.resolve(),
    exists: () => Promise.resolve(false),
    list: () => Promise.resolve([]),
    walk: () => Promise.resolve([]),
    makeTemp: () => Promise.resolve("/tmp/x"),
    removeTree: () => Promise.resolve(),
  },
  registry: { view: () => Promise.resolve(ok("absent")) },
  credentials: { npmToken: () => undefined },
  libraries: { list: libraries },
  docs: { load: () => Promise.resolve(err("no docs")) },
});

proves(["0013-repoctl-ci FR-001"], "the verb is declared once as a local action and comes only where the capability is on", async () => {
  assert(verbIds().includes("ci step") && VERBS["ci step"].effect === "mutate" && !VERBS["ci step"].channels.includes("mcp"));
  const on = hostOf(world(() => Promise.resolve(ok([]))), { config: { capabilities: { ci: true } } });
  assertEquals((await execute(on, ["ci", "step", "--help"])).code, 0);
  const off = hostOf(world(() => Promise.resolve(ok([]))), { config: { capabilities: { ci: false } } });
  assert((await execute(off, ["ci", "step", "--id", "s", "--", "true"])).code !== 0, "the verb is not there where the capability is off");
});

proves(["0013-repoctl-ci FR-002"], "a failing command ends 0 with its finding kept and its output printed, and a wrong call ends 2", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ci-verb-"));
  try {
    const host = hostOf(world(() => Promise.resolve(ok([]))), { config: { capabilities: { ci: true } } });
    const failing = await execute(host, ["ci", "step", "--id", "t", "--tool", "tsc", "--out", dir, "--", "bash", "-c", "echo \"a.ts(3,1): error TS2322: no\"; exit 1"]);
    assertEquals(failing.code, 0, `${failing.err} ${failing.out}`);
    assertStringIncludes(failing.out, "1 findings");
    const files = readdirSync(dir);
    assertEquals(files.length, 1);
    assertStringIncludes(readFileSync(join(dir, files[0] ?? ""), "utf8"), "TS2322");
    const wrong = await execute(host, ["ci", "step", "--id", "t", "--out", dir]);
    assertEquals(wrong.code, 2);
    assertEquals((await execute(host, ["ci", "step", "--id", "bad id", "--out", dir, "--", "true"])).code, 2);
    assertEquals((await execute(host, ["ci", "step", "--id", "t", "--tool", "nope", "--out", dir, "--", "true"])).code, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
