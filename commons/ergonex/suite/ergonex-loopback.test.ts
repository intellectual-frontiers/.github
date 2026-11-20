/**
 * The loopback switch is never silent (commons 0002-workspace-model FR-037): while `ERGONEX_ALLOW_LOOPBACK_HTTP=1` is set, every command that honors it
 * says so on standard error (the closing block) and the run's problems hold an informational finding, and the exit status is what it was without the switch.
 * `ergonex` is run as a real program on the runtime that runs this file (Bun or Node 26), in a real temporary workspace with real Git; the pure parts
 * (the line, the finding) are checked as values.
 *
 * @module
 */
import { execPath, which } from "../src/platform/r-proc.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { loopbackAllowed, loopbackFinding } from "../src/host/workspace.ts";
import { Ergonex, needsWorld, withWorld } from "./ergonex-fixtures.ts";

const needs =
  "skip" in needsWorld || which("bun") === undefined || which("node") === undefined
    ? {
        skip: "needs git, sh, bun and node, on Unix paths (the Windows job runs the pure tests)",
      }
    : {};

const SWITCH = { ERGONEX_ALLOW_LOOPBACK_HTTP: "1" };

/** The problems of the loopback rule in a `--json` report: the code and the level of each. */
function loopbackFindings(json: string): readonly { readonly code: unknown; readonly level: unknown }[] {
  const report: unknown = JSON.parse(json);
  assert(typeof report === "object" && report !== null && "problems" in report && Array.isArray(report.problems), "a report with problems");
  const found: { code: unknown; level: unknown }[] = [];
  const list: readonly unknown[] = report.problems;
  for (const f of list) {
    if (typeof f === "object" && f !== null && "code" in f && f.code === "E-LOOPBACK-HTTP") found.push({ code: f.code, level: "level" in f ? f.level : undefined });
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
    const f = loopbackFinding("2026-11-17");
    assertEquals([f.ruleId, f.severity, f.firstSeen], ["ergonex/loopback-http", "Informational", "2026-11-17"]);
  },
);

proves(
  ["0002-workspace-model FR-037"],
  "ergonex says so once on standard error and puts an informational finding in the report while the switch is set, and not otherwise; the exit status does not change",
  async () => {
    await withWorld(async (w) => {
      assertEquals((await w.ergonex("init")).code, 0);
      for (const words of [["status"], ["plan"], ["tools"]]) {
        const quiet = await w.ergonexOn(execPath(), Ergonex, [...words, "--json"]);
        const loud = await w.ergonexOn(execPath(), Ergonex, [...words, "--json"], SWITCH);
        const name = words.join(" ");
        assertEquals(quiet.stderr.includes("ERGONEX_ALLOW_LOOPBACK_HTTP"), false, `${name}: the line without the switch`);
        assertEquals(loud.stderr.split("\n").filter((l) => l.includes("ERGONEX_ALLOW_LOOPBACK_HTTP is set: http to the loopback interface")).length, 0, `${name}: --json writes only the document`);
        assertEquals(loud.code, quiet.code, `${name}: the exit status is the same`);
        const mine = loopbackFindings(loud.stdout);
        assertEquals(
          mine,
          [{ code: "E-LOOPBACK-HTTP", level: "warn" }],
          `${name}: one informational finding in the report`,
        );
        assertEquals(loopbackFindings(quiet.stdout), [], `${name}: none without the switch`);
      }
    });
  },
  needs,
);
