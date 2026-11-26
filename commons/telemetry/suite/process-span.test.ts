/**
 * Test of the `process` span of a spawned program (commons 0001-system FR-010, 0001-telemetry FR-018): where a telemetry pipeline is installed, `proc.spawn` is a `process` span until the program ends and the
 * program is given its `TRACEPARENT`. The telemetry installs the function that makes a program a span (`proc.setProcessTracer`) when its module is loaded, which is what this test runs through.
 *
 * @module
 */
import { formatTraceparent } from "../src/logical/otel.ts";
import { defineSignals, memoryProcessor } from "../src/logical/signals.ts";
import { withTempDir, writeTextFile } from "@intellectual-frontiers/system/fs";
import { join } from "@intellectual-frontiers/system/path";
import * as proc from "@intellectual-frontiers/system/proc";
import { startTelemetry } from "../src/physical/otel.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const SPAWN = "0001-system FR-010";
const decoder = new TextDecoder();

/** A child that says what it is given: its IFC_X variable and its TRACEPARENT, and exits with the code it is told. */
const CHILD = `
import process from "node:process";
const [mode, arg] = process.argv.slice(2);
if (mode === "say") { process.stdout.write("out:" + (process.env.IFC_X ?? "none")); process.stderr.write("err:" + (process.env.TRACEPARENT ?? "none")); process.exitCode = Number(arg ?? 0); }
`;

async function withScript(f: (script: string) => Promise<void>): Promise<void> {
  await withTempDir(async (dir) => {
    const child = join(dir, "child.mjs");
    await writeTextFile(child, CHILD);
    await f(child);
  });
}

const runtimeArgv = (script: string, ...args: string[]): string[] => [proc.execPath(), script, ...args];

proves([SPAWN], "where a pipeline is installed, a spawned program is a process span until it ends, and gets its TRACEPARENT", async () => {
  const registry = defineSignals({});
  const memory = memoryProcessor();
  const s = startTelemetry({ registry, env: { OTEL_SDK_DISABLED: "true" }, processors: [memory] });
  try {
    await withScript(async (script) => {
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
