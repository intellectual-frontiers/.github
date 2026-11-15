/**
 * Tests of `runtime/proc.ts` and `runtime/path.ts`: the environment, the platform's names, and programs run by their argument vector (the
 * running runtime itself runs a small script, so the test needs no other program and runs on every platform).
 *
 * @module
 */
import { assert, assertEquals, assertInstanceOf, assertRejects, proves } from "../../runtime/test.ts";
import { errors } from "../../runtime/errors.ts";
import { withTempDir, writeTextFile } from "../../runtime/fs.ts";
import { basename, delimiter, dirname, fromFileUrl, join, posix, toFileUrl, toPosix, win32 } from "../../runtime/path.ts";
import * as proc from "../../runtime/proc.ts";

const FR = "0005-typescript-runtime FR-022";

const SCRIPT = `
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => { input += c; });
process.stdin.on("end", () => {
  const [mode, arg] = process.argv.slice(2);
  if (mode === "echo") { process.stdout.write("out:" + input); process.stderr.write("err:" + (process.env.IFC_X ?? "none")); process.exit(Number(arg ?? 0)); }
  if (mode === "lines") { process.stdout.write("a\\r\\nb\\nc"); process.stderr.write("e1\\n"); }
  if (mode === "sleep") setTimeout(() => {}, 60_000);
});
`;

/** The argument vector that runs a script with the runtime running this test. */
function runtimeArgv(script: string, ...args: string[]): string[] {
  return proc.runtimeName() === "deno" ? [proc.execPath(), "run", "-A", script, ...args] : [proc.execPath(), script, ...args];
}

proves([FR], "the environment, by the names Deno gave it", () => {
  proc.env.set("IFC_TS_TEST", "1");
  assert(proc.env.has("IFC_TS_TEST"));
  assertEquals(proc.env.get("IFC_TS_TEST"), "1");
  assertEquals(proc.env.toObject()["IFC_TS_TEST"], "1");
  proc.env.delete("IFC_TS_TEST");
  assertEquals(proc.env.get("IFC_TS_TEST"), undefined);
  assert(!proc.env.has("IFC_TS_TEST"));
});

proves([FR], "the platform, by the names Deno gave it, the runtime's name and version, the process", () => {
  assertEquals([proc.osOf("win32"), proc.osOf("darwin"), proc.osOf("linux"), proc.osOf("sunos"), proc.osOf("plan9")], ["windows", "darwin", "linux", "solaris", "other"]);
  assertEquals([proc.archOf("x64"), proc.archOf("arm64"), proc.archOf("mips")], ["x86_64", "aarch64", "other"]);
  assert(["linux", "darwin", "windows"].includes(proc.build.os));
  assert(["deno", "node", "bun"].includes(proc.runtimeName()));
  assert(/^\d+\.\d+/.test(proc.runtimeVersion()), proc.runtimeVersion());
  assert(Array.isArray(proc.args));
  assert(proc.pid > 0 && proc.cwd() !== "" && proc.homeDir() !== "" && proc.hostname() !== "");
  assertEquals(proc.isRoot(), proc.uid() === 0);
  assertEquals(proc.signalNumber("SIGTERM"), 15);
  assertEquals(proc.signalNumber("SIGKILL"), 9);
});

proves([FR], "which finds a program on PATH as command -v does, and nothing where there is none", () => {
  const exe = proc.execPath();
  const name = basename(exe);
  assertEquals(proc.which(name, dirname(exe)), exe);
  assertEquals(proc.which(exe), exe);
  assertEquals(proc.which("no-such-program-ifc", dirname(exe)), undefined);
  assertEquals(proc.which(name, ""), undefined);
  assert(proc.isExecutable(exe));
  assert(!proc.isExecutable(dirname(exe)));
});

proves([FR], "a program runs with its input, environment and working folder, and its status and output come back", async () => {
  await withTempDir(async (dir) => {
    const script = join(dir, "child.mjs");
    await writeTextFile(script, SCRIPT);
    const r = await proc.run(runtimeArgv(script, "echo", "3"), { stdin: "hello", env: { IFC_X: "y" }, cwd: dir });
    assertEquals([r.code, r.success, r.signal, r.stdout, r.stderr], [3, false, null, "out:hello", "err:y"]);
    const b = await proc.output(runtimeArgv(script, "echo"), { stdin: new TextEncoder().encode("bytes") });
    assertEquals([b.code, new TextDecoder().decode(b.stdout)], [0, "out:bytes"]);
    const quiet = await proc.run(runtimeArgv(script, "echo"), { stdout: "null", stderr: "null" });
    assertEquals([quiet.code, quiet.stdout, quiet.stderr], [0, "", ""]);
    assertEquals(await proc.must(runtimeArgv(script, "echo")), "out:");
    await assertRejects(() => proc.must(runtimeArgv(script, "echo", "2")), Error, "failed (2)");
    assertEquals(await proc.firstLine(runtimeArgv(script, "echo")), "out:");
  });
});

proves([FR], "each line comes as it is written, without its line ending, and the output is kept too", async () => {
  await withTempDir(async (dir) => {
    const script = join(dir, "child.mjs");
    await writeTextFile(script, SCRIPT);
    const lines: string[] = [];
    const r = await proc.run(runtimeArgv(script, "lines"), { onLine: (s, l) => lines.push(`${s}:${l}`) });
    assertEquals(lines.filter((l) => l.startsWith("stdout")), ["stdout:a", "stdout:b", "stdout:c"]);
    assertEquals(lines.filter((l) => l.startsWith("stderr")), ["stderr:e1"]);
    assertEquals(r.stdout, "a\r\nb\nc");
  });
});

proves([FR, "0005-typescript-runtime FR-019"], "a program that does not exist is NotFound; an empty argument vector is refused", async () => {
  const e = await assertRejects(() => proc.run(["no-such-program-ifc-ts"]), errors.NotFound);
  assertEquals(e.code, "ENOENT");
  await assertRejects(() => proc.run([]), errors.InvalidData);
  assertEquals(await proc.firstLine(["no-such-program-ifc-ts"]), "");
});

proves([FR], "a program is stopped by its abort signal, with SIGTERM", async () => {
  await withTempDir(async (dir) => {
    const script = join(dir, "child.mjs");
    await writeTextFile(script, SCRIPT);
    const ctl = new AbortController();
    const started = Date.now();
    setTimeout(() => ctl.abort(), 300);
    const r = await proc.run(runtimeArgv(script, "sleep"), { stdin: "", signal: ctl.signal, killAfterMs: 2000 });
    assert(Date.now() - started < 10_000);
    assert(!r.success);
    if (proc.build.os !== "windows") assertEquals([r.signal, r.code], ["SIGTERM", 143]);
  });
});

proves([FR], "sleep waits, and an aborted signal ends it early", async () => {
  const t = Date.now();
  await proc.sleep(20);
  assert(Date.now() - t >= 15);
  const ctl = new AbortController();
  const p = proc.sleep(60_000, ctl.signal);
  ctl.abort(new Error("stop"));
  await assertRejects(() => p, Error, "stop");
  await assertRejects(() => proc.sleep(1, AbortSignal.abort(new Error("already"))), Error, "already");
  const h = (): void => {};
  proc.addSignalListener("SIGUSR2", h);
  proc.removeSignalListener("SIGUSR2", h);
});

proves(["0005-typescript-runtime FR-021"], "paths: the platform's rules, both platforms' rules, file URLs both ways", () => {
  const p = join("a", "b", "..", "c.txt");
  assertEquals(toPosix(p), "a/c.txt");
  assertEquals(posix.join("/x", "y"), "/x/y");
  assertEquals(win32.join("C:\\x", "y"), "C:\\x\\y");
  assertEquals(delimiter, proc.build.os === "windows" ? ";" : ":");
  const abs = proc.cwd();
  assertEquals(fromFileUrl(toFileUrl(abs)), abs);
  assertInstanceOf(toFileUrl(abs), URL);
});
