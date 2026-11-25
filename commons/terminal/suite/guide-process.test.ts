/**
 * The guide on the real standard streams, with no pseudo-terminal: one script (`fixtures/guide-script.ts`) run as a child process under Bun and
 * under Node 26, with piped input of CRLF lines, must write the same plain text and end with the same status; a step for a person ends with
 * E-GUIDE-NEEDS-PERSON and never waits; an interrupt ends with 130 (commons 0002-guide FR-009, FR-005, FR-007).
 *
 * @module
 */
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";

const SCRIPT = fileURLToPath(new URL("./fixtures/guide-script.ts", import.meta.url));
const RUNTIMES = ["bun", "node"] as const;
const ENV = { PATH: process.env["PATH"] ?? "", HOME: process.env["HOME"] ?? "", LANG: "C" };

function runOn(runtime: (typeof RUNTIMES)[number], scenario: string, input: string, env: Record<string, string> = {}) {
  const r = spawnSync(runtime, [SCRIPT, scenario], { input, env: { ...ENV, ...env }, encoding: "utf8", timeout: 60_000 });
  assert(r.error === undefined, `${runtime} could not run: ${String(r.error)}`);
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

proves(["0002-guide FR-009", "0002-guide FR-005"], "Bun and Node 26 write the same plain text and end with the same status for piped CRLF input", () => {
  const results = RUNTIMES.map((rt) => runOn(rt, "flow", "./works\r\n"));
  for (const r of results) {
    assertEquals(r.status, 0, r.stderr);
    assertEquals(r.stderr, "");
  }
  assertEquals(results[0]?.stdout, results[1]?.stdout);
  const out = results[0]?.stdout ?? "";
  assertEquals(out.includes("\u001b"), false, "a pipe is plain");
  assertEquals(out.includes("\r"), false);
  assertStringIncludes(out, "[ask] Choose a folder");
  assertStringIncludes(out, "  > ./works\n");
  assertStringIncludes(out, "folder=./works");
  assertStringIncludes(out, "[done] All set");
});

proves(["0002-guide FR-009", "0002-guide FR-002"], "on a pipe the text is the same, and plain, whatever NO_COLOR, TERM and CI say", () => {
  const base = runOn("bun", "flow", "./works\r\n").stdout;
  for (const env of [{ NO_COLOR: "1" }, { TERM: "dumb" }, { CI: "true" }]) {
    for (const rt of RUNTIMES) assertEquals(runOn(rt, "flow", "./works\r\n", env).stdout, base);
  }
});

proves(["0002-guide FR-005"], "a step for a person on a pipe ends with E-GUIDE-NEEDS-PERSON and status 2, on both runtimes, and never waits", () => {
  for (const rt of RUNTIMES) {
    const r = runOn(rt, "human", "\r\n");
    assertEquals(r.status, 2);
    assertEquals(r.stderr, "E-GUIDE-NEEDS-PERSON\n");
    assertStringIncludes(r.stdout, "[you] Approve the key");
    assertEquals(r.stdout.includes("[done]"), false, "the person's step was not confirmed for them");
  }
});

proves(["0002-guide FR-005"], "a question on input that ends too soon ends with E-GUIDE-NEEDS-PERSON on both runtimes", () => {
  for (const rt of RUNTIMES) {
    const r = runOn(rt, "flow", "");
    assertEquals([r.status, r.stderr], [2, "E-GUIDE-NEEDS-PERSON\n"]);
  }
});

proves(["0002-guide FR-007"], "an interrupt ends a wait with status 130 on both runtimes", async () => {
  if (process.platform === "win32") return; // a signal sent to a child process ends it at once on Windows
  for (const rt of RUNTIMES) {
    const child = spawn(rt, [SCRIPT, "wait"], { env: ENV, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (d: string) => {
      out += d;
    });
    let err = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (d: string) => {
      err += d;
    });
    const deadline = Date.now() + 30_000;
    while (!out.includes("still waiting") && Date.now() < deadline) await new Promise((r) => setTimeout(r, 25));
    assertStringIncludes(out, "[wait] Waiting for the host");
    child.kill("SIGINT");
    const code = await new Promise<number | null>((resolve) => child.on("close", resolve));
    assertEquals([rt, code, err], [rt, 130, "E-GUIDE-ABORTED\n"]);
  }
}, { timeout: 120_000 });
