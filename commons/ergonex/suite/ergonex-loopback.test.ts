/**
 * The loopback switch is never silent (commons 0002-workspace-model FR-037): while `ERGONEX_ALLOW_LOOPBACK_HTTP=1` is set, every command that honors it
 * writes the one line on standard error and the run's report holds an informational finding, and the exit status is what it was without the switch.
 * `ergonex` is run as a real program on the runtime that runs this file (Bun or Node 26), in a real temporary workspace with real Git; the pure parts
 * (the line, the finding) are checked as values.
 *
 * @module
 */
import { execPath, which } from "../src/platform/r-proc.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { LOOPBACK_NOTICE, loopbackAllowed, loopbackFinding } from "../src/host/workspace.ts";
import { Ergonex, needsWorld, withWorld } from "./ergonex-fixtures.ts";

const needs =
  "skip" in needsWorld || which("bun") === undefined || which("node") === undefined
    ? {
        skip: "needs git, sh, bun and node, on Unix paths (the Windows job runs the pure tests)",
      }
    : {};

const SWITCH = { ERGONEX_ALLOW_LOOPBACK_HTTP: "1" };

/** The findings of the loopback rule in a `--json` report: the rule and the severity of each. */
function loopbackFindings(json: string): readonly { readonly ruleId: string; readonly severity: unknown }[] {
  const report: unknown = JSON.parse(json);
  assert(typeof report === "object" && report !== null && "findings" in report && Array.isArray(report.findings), "a report with findings");
  const found: { ruleId: string; severity: unknown }[] = [];
  const list: readonly unknown[] = report.findings;
  for (const f of list) {
    if (typeof f === "object" && f !== null && "ruleId" in f && f.ruleId === "ergonex/loopback-http")
      found.push({
        ruleId: f.ruleId,
        severity: "severity" in f ? f.severity : undefined,
      });
  }
  return found;
}

proves(
  ["0002-workspace-model FR-037"],
  "the switch is on only where the environment says 1, and its line and finding are the ones the specification states",
  () => {
    assertEquals(loopbackAllowed({ ERGONEX_ALLOW_LOOPBACK_HTTP: "1" }), true);
    assertEquals(loopbackAllowed({ ERGONEX_ALLOW_LOOPBACK_HTTP: "true" }), false);
    assertEquals(loopbackAllowed({}), false);
    assertEquals(
      LOOPBACK_NOTICE,
      "ergonex: ERGONEX_ALLOW_LOOPBACK_HTTP is set: http to the loopback interface is accepted (the SHA-256 is still checked)",
    );
    const f = loopbackFinding("2026-11-17");
    assertEquals([f.ruleId, f.severity, f.firstSeen], ["ergonex/loopback-http", "Informational", "2026-11-17"]);
  },
);

proves(
  ["0002-workspace-model FR-037"],
  "ergonex writes the one line on standard error and puts an informational finding in the report while the switch is set, and not otherwise; the exit status does not change",
  async () => {
    await withWorld(async (w) => {
      assertEquals((await w.ergonex("init")).code, 0);
      for (const words of [["status"], ["plan"], ["tools"]]) {
        const quiet = await w.ergonexOn(execPath(), Ergonex, [...words, "--json"]);
        const loud = await w.ergonexOn(execPath(), Ergonex, [...words, "--json"], SWITCH);
        const name = words.join(" ");
        assertEquals(quiet.stderr.includes("ERGONEX_ALLOW_LOOPBACK_HTTP"), false, `${name}: the line without the switch`);
        assertEquals(loud.stderr.split("\n").filter((l) => l === LOOPBACK_NOTICE).length, 1, `${name}: the line, once, on standard error`);
        assertEquals(loud.code, quiet.code, `${name}: the exit status is the same`);
        const mine = loopbackFindings(loud.stdout);
        assertEquals(
          mine,
          [{ ruleId: "ergonex/loopback-http", severity: "Informational" }],
          `${name}: one informational finding in the report`,
        );
        assertEquals(loopbackFindings(quiet.stdout), [], `${name}: none without the switch`);
      }
    });
  },
  needs,
);
