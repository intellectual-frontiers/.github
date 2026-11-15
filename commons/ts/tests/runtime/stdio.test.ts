/**
 * Tests of `runtime/stdio.ts` (commons 0005-typescript-runtime FR-054): standard input read as a web stream, by `read` into a buffer
 * (what does not fit kept for the next read, and given first to the stream), and whole as bytes or text, for any chunking (a property);
 * a child run by this same runtime that reads its input whole or by `read`, and writes by `write`, `writeSync` and `writable` to standard
 * output and standard error; and JSON written to standard output while the console shows progress on standard error comes out whole,
 * with no escape sequence in it.
 *
 * @module
 */
import fc from "fast-check";
import { withTempDir, writeTextFile } from "../../runtime/fs.ts";
import { join } from "../../runtime/path.ts";
import * as proc from "../../runtime/proc.ts";
import { stdinOf } from "../../runtime/stdio.ts";
import { assert, assertEquals, proves } from "../../runtime/test.ts";

const FR = "0005-typescript-runtime FR-054";
const E = "\u001b";

const url = (relative: string): string => new URL(relative, import.meta.url).href;

/** A stream of the chunks given. */
function chunked(chunks: readonly Uint8Array[]): () => ReadableStream<Uint8Array> {
  return () => {
    let i = 0;
    return new ReadableStream<Uint8Array>({
      pull(controller): void {
        const c = chunks[i++];
        if (c === undefined) controller.close();
        else controller.enqueue(c);
      },
    });
  };
}

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

proves(
  [FR],
  "read fills a buffer and keeps the rest for the next read; null at the end; the stream gives what read left first",
  async () => {
    const input = stdinOf(chunked([bytes("hello "), bytes("world")]));
    const buf = new Uint8Array(4);
    assertEquals(await input.read(buf), 4);
    assertEquals(new TextDecoder().decode(buf), "hell");
    assertEquals(await input.read(new Uint8Array(0)), 0);
    assertEquals(await input.text(), "o world");
    const empty = stdinOf(chunked([]));
    assertEquals(await empty.read(new Uint8Array(8)), null);
    assertEquals((await empty.bytes()).length, 0);
    const streamed = stdinOf(chunked([bytes("a"), bytes("bc")]));
    assertEquals(await streamed.read(new Uint8Array(1)), 1);
    assert(streamed.readable === streamed.readable, "one stream, made once");
    const parts: string[] = [];
    for await (const c of streamed.readable) parts.push(new TextDecoder().decode(c));
    assertEquals(parts, ["bc"]);
  },
);

proves([FR], "for any chunking of the input and any buffer size, read and then the rest whole give the input back", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.uint8Array({ minLength: 1, maxLength: 40 }), { maxLength: 8 }),
      fc.integer({ min: 1, max: 17 }),
      fc.integer({ min: 0, max: 5 }),
      async (chunks, size, reads) => {
        const input = stdinOf(chunked(chunks));
        const got: number[] = [];
        for (let i = 0; i < reads; i++) {
          const buf = new Uint8Array(size);
          const n = await input.read(buf);
          if (n === null) break;
          got.push(...buf.subarray(0, n));
        }
        got.push(...(await input.bytes()));
        assertEquals(
          got,
          chunks.flatMap((c) => [...c]),
        );
      },
    ),
    { numRuns: 100 },
  );
});

const CHILD = `
import process from "node:process";
import { stdin, stdout, stderr } from "${url("../../runtime/stdio.ts")}";
const mode = process.argv[2];
if (mode === "whole") {
  const request = JSON.parse(await stdin.text());
  const n = await stdout.write(JSON.stringify({ got: request }) + "\\n");
  stdout.writeSync(new TextEncoder().encode("sync " + n + "\\n"));
  const w = stdout.writable.getWriter();
  await w.write(new TextEncoder().encode("stream\\n"));
  w.releaseLock();
  await stderr.write("to stderr");
  stderr.writeSync(" and sync");
}
if (mode === "read") {
  const buf = new Uint8Array(3);
  const counts = [];
  for (;;) {
    const n = await stdin.read(buf);
    if (n === null) break;
    counts.push(n);
  }
  stdout.writeSync(counts.join(","));
}
`;

/** A child that shows progress through the console on standard error and writes its result as JSON through stdio. */
const PROGRESS = `
import { createTelemetry, defineSignals } from "${url("../../kernel/signals.ts")}";
import { ok } from "${url("../../kernel/result.ts")}";
import { consoleProcessor } from "${url("../../runtime/console.ts")}";
import { stdout } from "${url("../../runtime/stdio.ts")}";
const registry = defineSignals({ step: { signal: "span", role: "step", attributes: { target: "string" } } });
let t = 1700000000000000000n;
const telemetry = createTelemetry({
  registry,
  resource: { attributes: { "service.name": "child" } },
  scope: { name: "child" },
  clock: () => (t += 250000000n),
  random: (k) => new Uint8Array(k).fill(7),
  processors: [consoleProcessor({ registry, exporters: [] })],
});
const result = { items: Array.from({ length: 200 }, (_, i) => ({ i, name: "item " + i })) };
for (let i = 0; i < 20; i++) {
  telemetry.span("step", { target: "part " + i }, () => ok(i));
  if (i === 10) await stdout.write(JSON.stringify(result));
}
await telemetry.shutdown(1000);
`;

function runtimeArgv(script: string, ...args: string[]): string[] {
  return proc.runtimeName() === "deno" ? [proc.execPath(), "run", "-A", script, ...args] : [proc.execPath(), script, ...args];
}

proves([FR], "a program reads its input whole or by read, and writes by write, writeSync and writable to both streams", async () => {
  await withTempDir(async (dir) => {
    const script = join(dir, "child.ts");
    await writeTextFile(script, CHILD);
    const whole = await proc.run(runtimeArgv(script, "whole"), { input: JSON.stringify({ a: [1, "é"] }) });
    assertEquals(whole.code, 0, whole.stderr);
    const line = `${JSON.stringify({ got: { a: [1, "é"] } })}\n`;
    assertEquals(whole.stdout, `${line}sync ${bytes(line).length}\nstream\n`, "write gives the bytes it wrote");
    assertEquals(whole.stderr, "to stderr and sync");
    const read = await proc.run(runtimeArgv(script, "read"), { input: "abcdefgh" });
    assertEquals(read.code, 0, read.stderr);
    assertEquals(
      read.stdout
        .split(",")
        .map(Number)
        .reduce((a, b) => a + b, 0),
      8,
    );
    assert(
      read.stdout.split(",").every((n) => Number(n) >= 1 && Number(n) <= 3),
      read.stdout,
    );
  });
});

proves(
  [FR],
  "JSON written by stdio while the console shows progress on standard error is whole, with no escape sequence in it",
  async () => {
    await withTempDir(async (dir) => {
      const script = join(dir, "progress.ts");
      await writeTextFile(script, PROGRESS);
      for (const env of [{}, { FORCE_COLOR: "1" }]) {
        const r = await proc.run(runtimeArgv(script), { env: { IFC_CONSOLE: "", NO_COLOR: "", FORCE_COLOR: "", ...env } });
        assertEquals(r.code, 0, r.stderr);
        assert(!r.stdout.includes(E), "no escape byte in the JSON");
        const parsed: unknown = JSON.parse(r.stdout);
        assertEquals(parsed, { items: Array.from({ length: 200 }, (_, i) => ({ i, name: `item ${i}` })) });
        assert(r.stderr.includes("part 19"), r.stderr);
      }
    });
  },
);
