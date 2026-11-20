/**
 * Tests of the launcher and of a program run as a process of its own: the typed failures to start with their statuses of the range 64 to 78, `launch` with the
 * process's world (a pipe, the real signals), and the one place that binds the surface to a process (commons headless 0004-headless-cli FR-009, FR-013).
 *
 * @module
 */
import { spawn } from "node:child_process";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import { hostIo, launch, processSignals, processTimer, readStdinLine } from "../src/surfaces/cli/host.ts";
import { formatStartupFailure, STARTUP_KINDS, startupExit } from "../src/surfaces/cli/launcher.ts";
import { sample } from "./world.ts";

const ENTRY = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "fixtures", "entry.ts");

type Ended = { readonly code: number | null; readonly signal: string | null; readonly out: string; readonly err: string };

/** Runs the fixture as a process; `during` is given the child once it has said `ready`, to send it a signal. */
function child(args: readonly string[], env: Record<string, string> = {}, during?: (c: ReturnType<typeof spawn>) => void): Promise<Ended> {
  return new Promise((resolve, reject) => {
    const c = spawn(process.execPath, [ENTRY, ...args], { env: { ...process.env, NO_COLOR: "1", FIXTURE_PLAIN: "1", ...env }, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    let sent = false;
    c.stdout.on("data", (d: Buffer) => {
      out += d.toString();
      if (!sent && out.includes("ready") && during !== undefined) {
        sent = true;
        during(c);
      }
    });
    c.stderr.on("data", (d: Buffer) => (err += d.toString()));
    c.on("error", reject);
    c.on("close", (code, signal) => resolve({ code, signal, out, err }));
    c.stdin.end();
  });
}

proves(["0004-headless-cli FR-013"], "a failure to start is typed, has the status of its kind in the range 64 to 78, and is one line and a fix line", () => {
  assertEquals(
    STARTUP_KINDS.map((k) => startupExit({ kind: k, message: "m" })),
    [64, 69, 70, 72, 78],
  );
  assertEquals(formatStartupFailure("tool", { kind: "osfile", message: "tool.toml is missing", fix: "tool init" }), "tool: tool.toml is missing\nfix: tool init\n");
  assertEquals(formatStartupFailure("tool", { kind: "config", message: "tool.toml has no [server]" }), "tool: tool.toml has no [server]\n");
  assert(STARTUP_KINDS.every((k) => startupExit({ kind: k, message: "" }) >= 64 && startupExit({ kind: k, message: "" }) <= 78));
});

proves(["0004-headless-cli FR-013"], "a launcher that cannot start gives one line and the status of its kind; one that can runs the program with the process's world", async () => {
  for (const [kind, code] of [["usage", 64], ["unavailable", 69], ["software", 70], ["osfile", 72], ["config", 78]] as const) {
    const r = await child(["status"], { FIXTURE_FAIL: kind });
    assertEquals([r.code, r.out], [code, ""], kind);
    assertEquals(r.err, `fixture: cannot start: ${kind}\n${kind === "osfile" ? "fix: fixture init\n" : ""}`);
  }
  const ok = await child(["status"]);
  assertEquals(ok, { code: 0, signal: null, out: "hello\n", err: "" });
  const unknown = await child(["nope"]);
  assertEquals(unknown.code, 2);
  assertStringIncludes(unknown.err, "nope is not a command of fixture");
  const version = await child(["--version"]);
  assertEquals(version.out, "fixture 9.9.9\n");
  assertEquals((await child([])).code, 0);
});

proves(["0004-headless-cli FR-013"], "a check of the start that throws is a failure of the kind software, and a launch can be given its own arguments", async () => {
  const p = sample();
  const out: string[] = [];
  const code = await launch(p, { argv: ["status"], ready: () => Promise.reject(new Error("no config")), io: { sink: { out: () => undefined, err: (t) => void out.push(t) } } });
  assertEquals(code, 70);
  assertEquals(out.join(""), "tool: no config\n");
  const said: string[] = [];
  const r = await launch(p, { argv: ["--version"], io: { sink: { out: (t) => void said.push(t), err: () => undefined } } });
  assertEquals([r, said], [0, ["tool 1.2.3\n"]]);
});

proves(["0004-headless-cli FR-009"], "a real SIGINT ends a running program with 130 and a real SIGTERM with 143, and the program says Stopped", async () => {
  // Windows has no signals to send to a process: it ends it (erga 274-agora FR-025: SIGTERM where the platform has it); the fake signals of cli-run.test.ts prove the same there
  if (process.platform === "win32") return;
  for (const [signal, code] of [["SIGINT", 130], ["SIGTERM", 143]] as const) {
    const r = await child(["wait"], {}, (c) => void c.kill(signal));
    assertEquals([r.code, r.signal], [code, null], signal);
    assertStringIncludes(r.err, "[stop] Stopped");
  }
});

proves(["0004-headless-cli FR-011", "0004-headless-cli FR-013"], "the host binds the world of the process and nothing else does: the environment, the streams' kind, the clock, the signals, the timer and a line of input", async () => {
  const io = hostIo();
  assertEquals(io.pid, process.pid);
  assertEquals(io.env("PATH") === process.env["PATH"], true);
  assertEquals(io.env("HEADLESS_SURELY_NOT_SET"), undefined);
  assertEquals(typeof io.terminal.stdout, "boolean");
  assert(Math.abs(io.now() - Date.now()) < 1000);
  assert(io.state !== undefined && io.signals === processSignals && io.timer === processTimer && io.sink !== undefined);
  // the timer ticks and stops; the signals' listeners come and go
  let ticks = 0;
  const stop = processTimer.every(5, () => (ticks += 1));
  await new Promise((r) => setTimeout(r, 60));
  stop();
  const seen = ticks;
  await new Promise((r) => setTimeout(r, 30));
  assert(seen >= 1 && ticks === seen);
  const before = process.listenerCount("SIGINT");
  const off = processSignals.on("SIGINT", () => undefined);
  assertEquals(process.listenerCount("SIGINT"), before + 1);
  off();
  assertEquals(process.listenerCount("SIGINT"), before);
  assertEquals(typeof readStdinLine, "function");
  await fs.withTempDir(async (dir) => {
    const store = hostIo().state;
    store?.writeText(path.join(dir, "x"), "y");
    assertEquals(store?.readText(path.join(dir, "x")), "y");
  });
});
