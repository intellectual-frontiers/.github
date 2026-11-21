/**
 * Tests of the container target (commons headless 0005-reach-and-targets FR-011): the argument vectors of the runtime's `exec` and `cp`, input and environment and working folder as the runtime takes them, and a name that could be taken
 * for an option or a command with no word as a call that could not be made. Nothing is run: the runtime is a fake. Every name is made up.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import type { Output } from "../src/logical/mod.ts";
import { containerExecutor } from "../src/targets/container/mod.ts";

const ok: Output = { code: 0, success: true, signal: null, stdout: new TextEncoder().encode("out"), stderr: new Uint8Array() };

proves(["0005-reach-and-targets FR-011"], "exec, put and get are the runtime's exec and cp as argument vectors, input, environment and folder are passed as the runtime takes them, and a bad name or an empty command is a call not made", async () => {
  const calls: { argv: readonly string[]; opts: unknown }[] = [];
  const run = async (argv: readonly string[], opts?: unknown): Promise<Output> => (calls.push({ argv, opts }), ok);
  const ex = containerExecutor("docker", "athens", { run });
  assertEquals((await ex.exec(["systemctl", "is-system-running"])).code, 0);
  assertEquals(calls[0]?.argv, ["docker", "exec", "athens", "systemctl", "is-system-running"]);
  await ex.exec(["sh", "-s"], { input: "echo hi", env: { A: "1" }, cwd: "/srv" });
  assertEquals(calls[1]?.argv, ["docker", "exec", "-i", "-e", "A=1", "-w", "/srv", "athens", "sh", "-s"]);
  assertEquals(calls[1]?.opts, { input: "echo hi" }, "the input stays with the local call, the environment and the folder go to the runtime");
  await ex.put?.(["/tmp/a.txt", "/tmp/b.txt"], "/opt/x");
  assertEquals(calls.slice(2).map((c) => c.argv), [
    ["docker", "exec", "athens", "mkdir", "-p", "/opt/x"],
    ["docker", "cp", "/tmp/a.txt", "athens:/opt/x/a.txt"],
    ["docker", "cp", "/tmp/b.txt", "athens:/opt/x/b.txt"],
  ]);
  await ex.get?.("/etc/hostname", "/tmp/h");
  assertEquals(calls.at(-1)?.argv, ["docker", "cp", "athens:/etc/hostname", "/tmp/h"]);
  assertEquals((await containerExecutor("podman", "sparta", { run }).exec(["id"])).code, 0);
  assertEquals(calls.at(-1)?.argv, ["podman", "exec", "sparta", "id"]);

  const before = calls.length;
  for (const name of ["-v", "a b", "", "x;y"]) {
    const bad = containerExecutor("docker", name, { run });
    const r = await bad.exec(["id"]);
    assertEquals(r.code, 255, JSON.stringify(name));
    assert(new TextDecoder().decode(r.stderr).includes("not a container name"));
    assertEquals((await bad.get?.("/x", "/y"))?.code, 255);
    assertEquals((await bad.put?.(["/a"], "/b"))?.code, 255);
    let threw = false;
    try { bad.spawn?.(["id"]); } catch { threw = true; }
    assert(threw, "spawn throws for a bad name");
  }
  assertEquals((await ex.exec([])).code, 255, "a command with no word");
  assertEquals(calls.length, before, "no call was made for any of them");

  const failing = containerExecutor("docker", "athens", { run: async (argv): Promise<Output> => (calls.push({ argv, opts: undefined }), { ...ok, code: 1, success: false }) });
  const stopped = calls.length;
  assertEquals((await failing.put?.(["/a"], "/b"))?.code, 1, "a failed mkdir stops the copy");
  assertEquals(calls.length, stopped + 1);
});
