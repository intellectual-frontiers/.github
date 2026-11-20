/**
 * Tests of `otel/mod.ts`: a run of a command reported in OpenTelemetry through the observer port of the command line, with a memory processor of the telemetry
 * to read what was recorded (commons headless 0004-headless-cli FR-015).
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { createTelemetry, memoryProcessor } from "@intellectual-frontiers/telemetry/signals";
import { headlessSignals, observerOf } from "../src/otel/mod.ts";
import { run } from "../src/surfaces/cli/run.ts";
import { sample, world } from "./world.ts";

function telemetry() {
  let t = 1000n;
  let call = 0;
  const memory = memoryProcessor();
  return {
    memory,
    telemetry: createTelemetry({
      registry: headlessSignals,
      resource: { attributes: { "service.name": "tool" } },
      scope: { name: "headless", version: "0.1.0" },
      clock: () => t++,
      random: (n) => new Uint8Array(n).fill(++call),
      processors: [memory],
    }),
  };
}

const attr = (a: unknown, key: string): unknown => (a as Record<string, unknown>)[key];

proves(["0004-headless-cli FR-015"], "a run is a headless.run span with the program, the command, the status and the counts, a phase event for each phase and a problem log for each problem", async () => {
  const { memory, telemetry: t } = telemetry();
  const r = await run(sample(), ["sync", "--warn", "--wait"], world({ observer: observerOf(t) }));
  assertEquals(r.code, 0);
  assertEquals(memory.spans.length, 1);
  const span = memory.spans[0]!;
  assertEquals(span.name, "headless.run");
  assertEquals(span.status, { kind: "ok" });
  const a = span.attributes;
  assertEquals(
    ["headless.program", "headless.version", "headless.command", "headless.exit.code", "headless.exit.name", "headless.problems.fail", "headless.problems.warn", "headless.problems.pending", "headless.problems.action"].map((k) => String(attr(a, k))),
    ["tool", "1.2.3", "sync", "0", "ok", "0", "1", "1", "0"],
  );
  assertEquals(span.events.map((e) => [e.name, String(attr(e.attributes, "headless.phase.name"))]), [["headless.phase", "Files"]]);
  assertEquals(memory.logs.map((l) => [l.eventName, l.body, String(attr(l.attributes, "headless.problem.level")), String(attr(l.attributes, "headless.problem.code"))]), [
    ["headless.problem", "b.txt is large", "warn", "E001-LARGE"],
    ["headless.problem", "no token yet", "pending", "P001-TOKEN"],
  ]);
  assertEquals(memory.logs.map((l) => l.severityNumber), [13, 9]);
  assertEquals(memory.logs.every((l) => l.spanId === span.context.spanId), true, "the logs are in the run's span");
});

proves(["0004-headless-cli FR-015"], "a run whose status is not 0 ends its span as an error, with the status named; a refusal before the command is no run", async () => {
  const { memory, telemetry: t } = telemetry();
  const r = await run(sample(), ["sync", "--fail"], world({ observer: observerOf(t) }));
  assertEquals(r.code, 1);
  const span = memory.spans[0]!;
  assertEquals(span.status.kind, "error");
  assertEquals([String(attr(span.attributes, "headless.exit.code")), String(attr(span.attributes, "headless.exit.name"))], ["1", "findings"]);
  assertEquals(memory.logs.map((l) => l.severityNumber), [17]);
  const before = memory.spans.length;
  const refused = await run(sample(), ["wipe"], world({ observer: observerOf(t) }));
  assertEquals(refused.code, 2);
  assertEquals(memory.spans.length, before, "nothing ran, so nothing is a span");
  // the result is the same with an observer as without one
  const plain = await run(sample(), ["sync", "--fail"], world());
  assertEquals(plain, r);
});

proves(["0004-headless-cli FR-005", "0004-headless-cli FR-015"], "the surface does not import the telemetry: the observer is a port, and only the adapter names the telemetry", async () => {
  const { fs, path } = await import("@intellectual-frontiers/system");
  const root = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..", "src");
  const named: string[] = [];
  for (const rel of await fs.walkFiles(root)) {
    if (!rel.endsWith(".ts")) continue;
    const text = await fs.readTextFile(path.join(root, rel));
    if (/from\s+["']@intellectual-frontiers\/telemetry/.test(text)) named.push(rel);
  }
  assertEquals(named, ["otel/mod.ts"]);
  assert(true);
});
