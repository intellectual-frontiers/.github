/**
 * Tests of `src/host/console.ts` (commons 0001-telemetry FR-024): a child process run by this same runtime, with its output piped (so
 * `plain`), shows its spans and log records as lines with no escape byte, says once at the end where signals were not sent, writes OTLP
 * JSON lines where `IFC_CONSOLE=json` asks for them, and on an uncaught exception or an unhandled rejection renders the error and exits
 * with status 1. The rule that the console is the one writer for a person, and `system/stdio` the one for a program (0005-typescript-runtime
 * FR-054): no other file of `runtime/` writes to standard output or standard error, or calls `console.log` and the like, in its code.
 *
 * @module
 */
import { decodeLogs } from "../src/otlp.ts";
import { chooseMode } from "../src/render.ts";
import { createTelemetry, defineSignals, type Telemetry } from "../src/signals.ts";
import { type Equal, expectType } from "@intellectual-frontiers/core";
import { consoleProcessor, exceptionOf, type UncaughtTarget, uncaughtSignals } from "../src/host/console.ts";
import { readDir, readTextFile, withTempDir, writeTextFile } from "@intellectual-frontiers/system/fs";
import { fromFileUrl, join } from "@intellectual-frontiers/system/path";
import * as proc from "@intellectual-frontiers/system/proc";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";

const FR = "0001-telemetry FR-024";
const E = "\u001b";

const url = (relative: string): string => new URL(relative, import.meta.url).href;

const SCRIPT = `
import process from "node:process";
import { createTelemetry, defineSignals } from "${url("../src/signals.ts")}";
import { ok } from "${url("../../core/src/mod.ts")}";
import { consoleProcessor, installUncaught, uncaughtSignals } from "${url("../src/host/console.ts")}";

const registry = defineSignals({
  ...uncaughtSignals,
  build: { signal: "span", role: "step", attributes: { target: "string" } },
  hint: { signal: "log", role: "hint", severity: 9, attributes: { text: "string" } },
  quiet: { signal: "span", role: "none", attributes: {} },
});
const mode = process.argv[2];
const one = { exported: 0, failed: 0, rejected: 0, dropped: 0 };
const watched = {
  stats: () => ({ traces: mode === "warn" ? { ...one, failed: 2, lastError: "connection refused" } : one, logs: one, metrics: one }),
  forceFlush: () => Promise.resolve({ kind: "done" }),
};
let t = 1700000000000000000n;
let n = 0;
const telemetry = createTelemetry({
  registry,
  resource: { attributes: { "service.name": "child" } },
  scope: { name: "child" },
  clock: () => (t += 250000000n),
  random: (k) => new Uint8Array(k).map((_, i) => (i === k - 1 ? ++n : 0)),
  processors: [consoleProcessor({ registry, exporters: [watched] })],
});
installUncaught(telemetry);
telemetry.span("build", { target: "site" }, (b) => {
  b.log("hint", { text: "look here" });
  b.span("quiet", {}, () => ok(0));
  return ok(1);
});
if (mode === "throw") setTimeout(() => { throw new Error("boom"); }, 0);
else if (mode === "reject") void Promise.reject(new TypeError("bad input"));
else await telemetry.shutdown(1000);
`;

/** Runs the child script with this runtime, its output piped. */
async function child(dir: string, mode: string, extra: Readonly<Record<string, string>> = {}): Promise<proc.TextOutput> {
  const script = join(dir, "child.ts");
  await writeTextFile(script, SCRIPT);
  const argv = [proc.execPath(), script, mode];
  return await proc.run(argv, { env: { LANG: "C.UTF-8", LC_ALL: "C.UTF-8", IFC_CONSOLE: "", NO_COLOR: "", FORCE_COLOR: "", ...extra } });
}

proves(
  [FR],
  "piped, the console writes plain lines with no escape byte, and says once at the end where signals were not sent",
  async () => {
    await withTempDir(async (dir) => {
      const ran = await child(dir, "ok");
      assertEquals(ran.code, 0, ran.stderr);
      assertEquals(ran.stdout, "");
      assertEquals(ran.stderr, "  👉 look here\n✅ build site 1.0s\n");
      const warned = await child(dir, "warn");
      assertEquals(warned.code, 0, warned.stderr);
      assertEquals(warned.stderr, "  👉 look here\n✅ build site 1.0s\n\u{26a0}\u{fe0f} 2 signals were not sent: connection refused\n");
      for (const out of [ran.stderr, warned.stderr]) assert(!out.includes(E), "no escape byte when piped");
    });
  },
);

proves([FR], "IFC_CONSOLE=json: one OTLP JSON logs request per line on standard output", async () => {
  await withTempDir(async (dir) => {
    const ran = await child(dir, "ok", { IFC_CONSOLE: "json" });
    assertEquals(ran.code, 0, ran.stderr);
    assertEquals(ran.stderr, "");
    const names = ran.stdout
      .trim()
      .split("\n")
      .map((l) => {
        const r = decodeLogs(JSON.parse(l));
        assert(r.kind === "ok");
        return r.value[0]?.records[0]?.eventName;
      });
    assertEquals(names, ["hint", "build"]);
  });
});

proves(
  [FR],
  "an uncaught exception or an unhandled rejection is rendered as an error record, and the process exits with status 1",
  async () => {
    await withTempDir(async (dir) => {
      const thrown = await child(dir, "throw");
      assertEquals(thrown.code, 1, thrown.stderr);
      assertEquals(thrown.stderr, "  👉 look here\n✅ build site 1.0s\n❌ Error: boom\n");
      const rejected = await child(dir, "reject");
      assertEquals(rejected.code, 1, rejected.stderr);
      assertStringIncludes(rejected.stderr, "❌ TypeError: bad input\n");
    });
    const e = exceptionOf(new RangeError("too far"));
    assertEquals(
      [e.attributes["exception.type"], e.attributes["exception.message"], e.text],
      ["RangeError", "too far", "RangeError: too far"],
    );
    assert(e.attributes["exception.stacktrace"]?.includes("too far") === true);
    assertEquals(exceptionOf("plain").text, "string: plain");
  },
);

proves([FR], "a telemetry whose registry declares the uncaught kind is what installUncaught takes; the mode follows the terminal", () => {
  const registry = defineSignals({ ...uncaughtSignals, build: { signal: "span", role: "step", attributes: {} } });
  const telemetry = createTelemetry({
    registry,
    resource: { attributes: {} },
    scope: { name: "t" },
    clock: () => 0n,
    random: (k) => new Uint8Array(k).fill(1),
    processors: [],
  });
  const target: UncaughtTarget = telemetry;
  assert(target === telemetry);
  type Other = { readonly build: { readonly signal: "span"; readonly role: "step"; readonly attributes: Readonly<Record<string, never>> } };
  expectType<Equal<Telemetry<Other> extends UncaughtTarget ? true : false, false>>();
  expectType<Equal<Telemetry<typeof registry.kinds> extends UncaughtTarget ? true : false, true>>();
  assertEquals(consoleProcessor({ registry, env: { IFC_CONSOLE: "quiet" } }).mode, "quiet");
  assertEquals(consoleProcessor({ registry, env: {}, look: { tty: false, colour: false, emoji: true, columns: 80 } }).mode, "plain");
  assertEquals(consoleProcessor({ registry, env: {}, look: { tty: true, colour: true, emoji: true, columns: 80 } }).mode, "attended");
  assertEquals(chooseMode({ requested: "json", tty: true }), "json");
});

/** Lines of TypeScript code, without comments (a JSDoc's example writes `console.log` and is not code). */
function codeLines(text: string): readonly { readonly n: number; readonly line: string }[] {
  let inBlock = false;
  const out: { n: number; line: string }[] = [];
  text.split("\n").forEach((raw, i) => {
    let line = raw;
    if (inBlock) {
      const end = line.indexOf("*/");
      if (end < 0) return;
      line = line.slice(end + 2);
      inBlock = false;
    }
    line = line.replace(/\/\*.*?\*\//g, "");
    const open = line.indexOf("/*");
    if (open >= 0) {
      inBlock = true;
      line = line.slice(0, open);
    }
    line = line.replace(/(^|[^:])\/\/.*$/, "$1");
    if (line.trim() !== "") out.push({ n: i + 1, line });
  });
  return out;
}

const WRITER =
  /\bprocess\.(stdout|stderr)\.write\b|\b(stdout|stderr)\.write\s*\(|\bconsole\.(log|error|warn|info|debug|trace|dir|table)\s*\(/;

/** The folders of the host's code, and the files of each that write to standard output or standard error: the console, for a person; stdio, for a program (FR-054). */
const FOLDERS: readonly { readonly dir: string; readonly label: string; readonly writers: ReadonlySet<string> }[] = [
  { dir: "../src/host/", label: "telemetry/src/host", writers: new Set(["console.ts"]) },
  { dir: "../../system/src/", label: "system/src", writers: new Set(["stdio.ts"]) },
  { dir: "../../ts/runtime/", label: "ts/runtime", writers: new Set() },
];

proves(
  [FR],
  "the console is the one writer for a person and stdio the one for a program: no other file of the host's code writes to standard output or standard error",
  async () => {
    const found: string[] = [];
    for (const folder of FOLDERS) {
      const dir = fromFileUrl(url(folder.dir));
      for await (const entry of readDir(dir)) {
        if (!entry.isFile || !entry.name.endsWith(".ts") || folder.writers.has(entry.name)) continue;
        const text = await readTextFile(join(dir, entry.name));
        for (const { n, line } of codeLines(text)) if (WRITER.test(line)) found.push(`${folder.label}/${entry.name}:${n}: ${line.trim()}`);
      }
    }
    assertEquals(found, []);
    assert(
      codeLines("/**\n * console.log(1)\n */\nconst a = 1; // console.log(2)\n").every((l) => !WRITER.test(l.line)),
      "comments are not code",
    );
    assert(WRITER.test('process.stdout.write("x")') && WRITER.test("console.error(e)"), "the rule sees a writer");
  },
);
