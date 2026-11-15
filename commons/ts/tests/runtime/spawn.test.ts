/**
 * Tests of `proc.spawn` (commons 0005-typescript-runtime FR-052) and of `ppid`, `build.target`, `unrefTimer` and `selfCommand` (FR-053):
 * a program fed a web stream and read as one, its status and signal, `kill`, the abort signal and `await using` with SIGTERM then
 * SIGKILL, `NotFound` at once, `unref` that lets this process end, the `process` span and `TRACEPARENT`; the target triples Deno names, a
 * timer that never keeps a process alive, and the argument vector that runs a program again, on each runtime and from a compiled binary.
 * The running runtime itself runs small scripts, so the tests need no other program (`gzip` is used where there is one).
 *
 * @module
 */
import process from "node:process";
import { gzipSync } from "node:zlib";
import { formatTraceparent } from "../../kernel/otel.ts";
import { defineSignals, memoryProcessor } from "../../kernel/signals.ts";
import { type Equal, expectType } from "../../kernel/types.ts";
import { errors } from "../../runtime/errors.ts";
import { withTempDir, writeTextFile } from "../../runtime/fs.ts";
import { startTelemetry } from "../../runtime/otel.ts";
import { basename, join } from "../../runtime/path.ts";
import * as proc from "../../runtime/proc.ts";
import { assert, assertEquals, assertThrows, proves } from "../../runtime/test.ts";

const SPAWN = "0005-typescript-runtime FR-052";
const PROC = "0005-typescript-runtime FR-053";

const url = (relative: string): string => new URL(relative, import.meta.url).href;

/**
 * A child that copies its input to its output as it reads it (cat) or once it has all of it (sponge), reports, sleeps, or holds out
 * against SIGTERM, by its first argument.
 */
const CHILD = `
import { Buffer } from "node:buffer";
import process from "node:process";
const [mode, arg] = process.argv.slice(2);
if (mode === "cat") process.stdin.pipe(process.stdout);
if (mode === "sponge") { const parts = []; process.stdin.on("data", (c) => parts.push(c)); process.stdin.on("end", () => process.stdout.write(Buffer.concat(parts))); }
if (mode === "say") { process.stdout.write("out:" + (process.env.IFC_X ?? "none")); process.stderr.write("err:" + (process.env.TRACEPARENT ?? "none")); process.exitCode = Number(arg ?? 0); }
if (mode === "sleep") setTimeout(() => {}, 60_000);
if (mode === "stubborn") { process.on("SIGTERM", () => {}); setTimeout(() => {}, 60_000); process.stdout.write("ready"); }
`;

/** A parent that starts a sleeping child, unreferences it, says its id and ends; or that runs itself again. */
const PARENT = `
import process from "node:process";
import * as proc from "${url("../../runtime/proc.ts")}";
const [mode, child] = process.argv.slice(2);
if (mode === "unref") {
  const argv = proc.runtimeName() === "deno" ? [proc.execPath(), "run", "-A", child, "sleep"] : [proc.execPath(), child, "sleep"];
  const c = proc.spawn(argv, { stdin: "null", stdout: "piped", stderr: "null" });
  c.unref();
  process.stdout.write(String(c.pid));
}
if (mode === "timer") {
  proc.unrefTimer(() => process.stdout.write("never"), 30_000);
  const fired = proc.unrefTimer(() => process.stdout.write("fired "), 10);
  setTimeout(() => process.stdout.write("kept"), 100);
  void fired;
}
if (mode === "self") {
  const again = proc.selfCommand(["again", "with space"]);
  const r = await proc.run(again);
  process.stdout.write(JSON.stringify({ again, out: r.stdout, ppid: proc.ppid(), pid: proc.pid }));
}
if (mode === "again") process.stdout.write(JSON.stringify({ args: process.argv.slice(3), ppid: proc.ppid() }));
`;

/** The argument vector that runs a script with the runtime running this test. */
function runtimeArgv(script: string, ...args: string[]): string[] {
  return proc.runtimeName() === "deno" ? [proc.execPath(), "run", "-A", script, ...args] : [proc.execPath(), script, ...args];
}

/** A stream of the bytes given, in chunks of `size`. */
function streamOf(bytes: Uint8Array, size = 16_384): ReadableStream<Uint8Array> {
  let at = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller): void {
      if (at >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice(at, at + size));
      at += size;
    },
  });
}

async function withScripts(f: (child: string, parent: string) => Promise<void>): Promise<void> {
  await withTempDir(async (dir) => {
    const child = join(dir, "child.mjs");
    const parent = join(dir, "parent.ts");
    await writeTextFile(child, CHILD);
    await writeTextFile(parent, PARENT);
    await f(child, parent);
  });
}

const decoder = new TextDecoder();

// ---------------------------------------------------------------------------------------------------------------------------------
// FR-052
// ---------------------------------------------------------------------------------------------------------------------------------

const GZIP = proc.which("gzip");

proves(
  [SPAWN],
  "a spawned gzip -dc fed a stream and read as one: the bytes out are the bytes in, unzipped",
  async () => {
    const plain = new TextEncoder().encode("the quick brown fox jumps over the lazy dog\n".repeat(20_000));
    const zipped = new Uint8Array(gzipSync(plain));
    const gzip = GZIP ?? "gzip";
    const child = proc.spawn([gzip, "-dc"], { stdin: "piped", stdout: "piped", stderr: "piped" });
    assert(child.stdin !== null && child.stdout !== null && child.stderr !== null);
    const fed = streamOf(zipped).pipeTo(child.stdin);
    const out = await child.output();
    await fed;
    assertEquals([out.code, out.success, out.signal], [0, true, null]);
    assertEquals(out.stdout.length, plain.length);
    assert(
      out.stdout.every((b, i) => b === plain[i]),
      "the bytes out are the bytes in, unzipped",
    );
  },
  GZIP === undefined ? { skip: "no gzip on PATH; the next test shows the same with the runtime copying its input" } : {},
);

/**
 * Deno on Windows: a Deno child copying a megabyte back while it is still being fed never finished in CI (the job hung there), where the
 * same test passes on Node and Bun on Windows and on every runtime elsewhere. There the child takes the whole of its input before it
 * answers, so each pipe still carries a megabyte with backpressure, one after the other rather than both at once.
 */
const ONE_WAY_AT_A_TIME = proc.runtimeName() === "deno" && proc.build.os === "windows";

proves(
  [SPAWN],
  "a program fed a megabyte through its stdin stream gives it back through its stdout stream, with backpressure",
  async () => {
    await withScripts(async (script) => {
      const bytes = new Uint8Array(1 << 20).map((_, i) => (i * 31) % 251);
      const mode = ONE_WAY_AT_A_TIME ? "sponge" : "cat";
      await using child = proc.spawn(runtimeArgv(script, mode), { stdin: "piped", stdout: "piped", stderr: "null" });
      assert(child.pid > 0);
      assertEquals(child.stderr, null, "a stream not piped is null");
      assert(child.stdin !== null && child.stdout !== null);
      const fed = streamOf(bytes).pipeTo(child.stdin);
      const chunks: Uint8Array[] = [];
      for await (const chunk of child.stdout) chunks.push(chunk);
      await fed;
      const got = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
      let at = 0;
      for (const c of chunks) {
        got.set(c, at);
        at += c.length;
      }
      assertEquals(got.length, bytes.length);
      assert(
        got.every((b, i) => b === bytes[i]),
        "the same bytes",
      );
      assertEquals(await child.status, { code: 0, success: true, signal: null });
    });
  },
  { timeout: 60_000 },
);

proves([SPAWN], "the status, the environment and the working folder; output() with a stream not piped gives it empty", async () => {
  await withScripts(async (script) => {
    const child = proc.spawn(runtimeArgv(script, "say", "4"), { stdin: "null", stdout: "piped", stderr: "null", env: { IFC_X: "y" } });
    const out = await child.output();
    assertEquals([out.code, out.success, out.signal, decoder.decode(out.stdout), out.stderr.length], [4, false, null, "out:y", 0]);
    assertEquals(await child.status, { code: 4, success: false, signal: null });
    const inherited = proc.spawn(runtimeArgv(script, "say"), { stdin: "null", stdout: "null", stderr: "null" });
    assertEquals([inherited.stdin, inherited.stdout, inherited.stderr], [null, null, null]);
    assertEquals((await inherited.status).code, 0);
  });
});

proves([SPAWN], "kill sends a signal: the status says which, and the code is 128 plus its number", async () => {
  await withScripts(async (script) => {
    const child = proc.spawn(runtimeArgv(script, "sleep"), { stdin: "null", stdout: "null", stderr: "null" });
    child.kill("SIGKILL");
    const s = await child.status;
    assert(!s.success);
    if (proc.build.os !== "windows") assertEquals([s.signal, s.code], ["SIGKILL", 137]);
    child.kill(); // nothing, where it has ended
  });
});

proves([SPAWN], "an abort signal stops it with SIGTERM; one that holds out is ended with SIGKILL after killAfterMs", async () => {
  await withScripts(async (script) => {
    const ctl = new AbortController();
    const child = proc.spawn(runtimeArgv(script, "sleep"), { stdin: "null", stdout: "null", stderr: "null", signal: ctl.signal });
    ctl.abort();
    const s = await child.status;
    assert(!s.success);
    if (proc.build.os !== "windows") assertEquals(s.signal, "SIGTERM");

    const stubborn = proc.spawn(runtimeArgv(script, "stubborn"), { stdin: "null", stdout: "piped", stderr: "null", killAfterMs: 200 });
    assert(stubborn.stdout !== null);
    const reader = stubborn.stdout.getReader();
    assertEquals(decoder.decode((await reader.read()).value), "ready");
    reader.releaseLock();
    const started = Date.now();
    await stubborn[Symbol.asyncDispose]();
    const st = await stubborn.status;
    assert(Date.now() - started < 10_000);
    if (proc.build.os !== "windows") assertEquals(st.signal, "SIGKILL");
  });
});

proves([SPAWN], "await using stops a program that still runs when the block ends, and waits for it", async () => {
  await withScripts(async (script) => {
    let status: Promise<proc.Status> | undefined;
    const started = Date.now();
    {
      await using child = proc.spawn(runtimeArgv(script, "sleep"), { stdin: "null", stdout: "piped", stderr: "piped" });
      status = child.status;
    }
    const s = await status;
    assert(!s.success && Date.now() - started < 10_000);
    if (proc.build.os !== "windows") assertEquals(s.signal, "SIGTERM");
  });
});

proves([SPAWN], "a program that does not exist is NotFound at once, as Deno throws; an empty argument vector is refused", () => {
  const e = assertThrows(() => proc.spawn(["no-such-program-ifc-ts"]), errors.NotFound);
  assertEquals(e.code, "ENOENT");
  assertThrows(() => proc.spawn(["./no/such/program"]), errors.NotFound);
  const name = basename(proc.execPath()).replace(/\.exe$/i, "");
  assertThrows(() => proc.spawn([name, "--version"], { env: { PATH: "" }, clearEnv: true }), errors.NotFound, "no such program");
  assertThrows(() => proc.spawn([]), errors.InvalidData);
});

proves([SPAWN], "unref lets this process end while the program it started runs on", async () => {
  await withScripts(async (child, parent) => {
    const started = Date.now();
    const r = await proc.run(runtimeArgv(parent, "unref", child), { stdin: "null" });
    assertEquals(r.code, 0, r.stderr);
    const pid = Number(r.stdout);
    assert(pid > 0, r.stdout);
    assert(Date.now() - started < 30_000, "the parent ended without waiting for its sleeping child");
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* it has ended already */
    }
  });
});

proves([SPAWN], "where a pipeline is installed, a spawned program is a process span until it ends, and gets its TRACEPARENT", async () => {
  const registry = defineSignals({});
  const memory = memoryProcessor();
  const s = startTelemetry({ registry, env: { OTEL_SDK_DISABLED: "true" }, processors: [memory] });
  try {
    await withScripts(async (script) => {
      const child = proc.spawn(runtimeArgv(script, "say", "2"), { stdin: "null", stdout: "null", stderr: "piped" });
      const out = await child.output();
      assertEquals(out.code, 2);
      const span = memory.spans.find((x) => x.name === "process");
      assert(span !== undefined, "a process span");
      assertEquals(decoder.decode(out.stderr), `err:${formatTraceparent(span.context)}`);
      assertEquals(span.attributes["process.exit.code"], 2n);
      assertEquals(span.status.kind, "error");
    });
  } finally {
    await s.pipeline.shutdown(200);
  }
});

proves([SPAWN], "the handle's types are Deno's shapes", () => {
  expectType<Equal<proc.Child["stdin"], WritableStream<Uint8Array> | null>>();
  expectType<Equal<proc.Child["stdout"], ReadableStream<Uint8Array> | null>>();
  expectType<Equal<Awaited<proc.Child["status"]>, proc.Status>>();
  const never = (c: proc.Child): void => {
    // @ts-expect-error a signal is named, never a number
    c.kill(9);
  };
  assertEquals(typeof never, "function");
});

// ---------------------------------------------------------------------------------------------------------------------------------
// FR-053
// ---------------------------------------------------------------------------------------------------------------------------------

proves([PROC], "build.target is the triple Deno names, and ppid is the parent's id", () => {
  assertEquals(proc.tripleOf("linux", "x86_64"), "x86_64-unknown-linux-gnu");
  assertEquals(proc.tripleOf("linux", "aarch64"), "aarch64-unknown-linux-gnu");
  assertEquals(proc.tripleOf("darwin", "aarch64"), "aarch64-apple-darwin");
  assertEquals(proc.tripleOf("darwin", "x86_64"), "x86_64-apple-darwin");
  assertEquals(proc.tripleOf("windows", "x86_64"), "x86_64-pc-windows-msvc");
  assertEquals(proc.tripleOf("android", "aarch64"), "aarch64-linux-android");
  assertEquals(proc.tripleOf("freebsd", "x86_64"), "x86_64-unknown-freebsd");
  assertEquals(proc.build.target, proc.tripleOf(proc.build.os, proc.build.arch));
  assert(proc.ppid() > 0 && proc.ppid() !== proc.pid);
});

proves([PROC], "an unreferenced timer never keeps the process alive, and fires while something else does", async () => {
  await withScripts(async (child, parent) => {
    void child;
    const started = Date.now();
    const r = await proc.run(runtimeArgv(parent, "timer"), { stdin: "null" });
    assertEquals([r.code, r.stdout], [0, "fired kept"], r.stderr);
    assert(Date.now() - started < 25_000, "the 30-second timer was not waited for");
  });
  let called = false;
  {
    using t = proc.unrefTimer(() => (called = true), 1);
    void t;
  }
  await proc.sleep(20);
  assert(!called, "a timer cleared by using is not called");
});

proves([PROC], "selfCommand runs the running program again with other arguments, on this runtime", async () => {
  await withScripts(async (child, parent) => {
    void child;
    const r = await proc.run(runtimeArgv(parent, "self"), { stdin: "null" });
    assertEquals(r.code, 0, r.stderr);
    const got: unknown = JSON.parse(r.stdout);
    assert(typeof got === "object" && got !== null && "out" in got && "pid" in got && typeof got.out === "string", r.stdout);
    const again: unknown = JSON.parse(got.out);
    assertEquals(again, { args: ["with space"], ppid: got.pid });
  });
});

const facts = (over: Partial<proc.SelfFacts>): proc.SelfFacts => ({
  runtime: "bun",
  execPath: "/home/u/.bun/bin/bun",
  argv: ["/home/u/.bun/bin/bun", "/w/main.ts"],
  execArgv: [],
  ...over,
});

proves([PROC], "selfCommand on Bun, Node and Deno, and from a binary that Bun, Deno or Node compiled: the binary alone", () => {
  assertEquals(proc.selfCommandOf(facts({}), ["a"]), ["/home/u/.bun/bin/bun", "/w/main.ts", "a"]);
  assertEquals(proc.selfCommandOf(facts({ execArgv: ["--smol"] }), []), ["/home/u/.bun/bin/bun", "--smol", "/w/main.ts"]);
  const node = facts({ runtime: "node", execPath: "/usr/bin/node", argv: ["/usr/bin/node", "/w/m.ts"], execArgv: ["--no-warnings"] });
  assertEquals(proc.selfCommandOf(node, ["x"]), ["/usr/bin/node", "--no-warnings", "/w/m.ts", "x"]);
  assertEquals(proc.selfCommandOf({ ...node, execPath: "/opt/node26/bin/node26" }, []).length, 3, "a versioned node is a runtime");
  const deno = facts({ runtime: "deno", execPath: "C:\\deno\\deno.exe", argv: ["C:\\deno\\deno.exe", "C:\\w\\m.ts"] });
  assertEquals(proc.selfCommandOf(deno, ["x"]), ["C:\\deno\\deno.exe", "run", "-A", "C:\\w\\m.ts", "x"]);
  // A binary Bun compiled: Bun's argv[0] is "bun", the script is in its embedded file system.
  const bunBinary = facts({ execPath: "/usr/local/bin/tool", argv: ["bun", "/$bunfs/root/tool", "x"] });
  assert(proc.isCompiled(bunBinary));
  assertEquals(proc.selfCommandOf(bunBinary, ["y"]), ["/usr/local/bin/tool", "y"]);
  const bunWindows = facts({ execPath: "C:\\tools\\bun.exe", argv: ["bun", "B:\\~BUN\\root\\bun.exe"] });
  assert(proc.isCompiled(bunWindows), "Bun's mark is enough, even for a binary named bun");
  assertEquals(proc.selfCommandOf(bunWindows, []), ["C:\\tools\\bun.exe"]);
  const denoBinary = facts({ runtime: "deno", execPath: "/opt/tool", argv: ["/opt/tool", "/opt/tool"] });
  assertEquals(proc.selfCommandOf(denoBinary, ["z"]), ["/opt/tool", "z"]);
  const sea = facts({ runtime: "node", execPath: "C:\\tool.exe", argv: ["C:\\tool.exe", "C:\\tool.exe"] });
  assertEquals(proc.selfCommandOf(sea, []), ["C:\\tool.exe"]);
  assert(!proc.isCompiled(facts({})) && !proc.isCompiled(deno) && !proc.isCompiled(node));
  assertEquals(
    proc.selfCommandOf(facts({ argv: ["/home/u/.bun/bin/bun"] }), ["e"]),
    ["/home/u/.bun/bin/bun", "e"],
    "no script: the runtime",
  );
  assertEquals(proc.selfCommand(["q"]).at(-1), "q");
});
