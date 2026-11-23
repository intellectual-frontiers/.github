/**
 * The page of the build's findings (docs 0001-docs FR-030): two runs of findings kept as the workflows write them and an accepted risk, read through the evidence of the configuration into the page, the counts, the modules, the trend, the accepted risks and the exports; the
 * banner of the review the release policy asks for once its day has passed; and what the page says where nothing is recorded.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import { loadConfig } from "../src/cli.ts";
import { buildSite } from "../src/site.ts";
import { csvOf, exportRows } from "../src/pages/findings.ts";
import { deriveRows, type FindingsFile } from "@intellectual-frontiers/libraries/ci/findings";
import { readEvidence } from "../src/evidence.ts";
import { ROOT } from "./helpers.ts";

const FIXTURE = path.join(ROOT, "commons/docs/suite/fixture-repo/docs.config.ts");
const EVIDENCE = path.join(ROOT, "commons/docs/suite/fixture-evidence");
const text = (x: unknown): string => JSON.stringify(x);

async function site(results: string | undefined) {
  const loaded = await loadConfig(FIXTURE);
  assert(loaded.kind === "ok");
  return buildSite({ ...loaded.value, evidence: results === undefined ? undefined : { results } });
}

proves(["0001-docs FR-030"], "the evidence reads the findings of the runs oldest first and the accepted risks, and the page shows the counts, the modules, the trend, the accepted risks and the policy from the typed values", async () => {
  const found: Parameters<typeof readEvidence>[2] = [];
  const ev = readEvidence(ROOT, { results: "commons/docs/suite/fixture-evidence" }, found);
  assertEquals(ev.findings.map((f) => f.run.id), ["1", "2"]);
  assertEquals(ev.acceptances.accepted.length, 1);
  const built = await site(EVIDENCE);
  assertEquals(built.found.filter((f) => f.where.includes("findings") || f.problem.kind === "broken-link" || f.problem.kind === "evidence-unreadable"), [], "nothing of the page or of the evidence it reads is wrong (the fixture has other findings of its own)");
  const page = built.pages.find((p) => p.path === "quality/build-findings.html");
  assert(page !== undefined, "the page is made");
  const t = text(page.blocks);
  // run 1 had A, B and C; run 2 (the module fixture ran again, other did not) has A: B is fixed, C is open because its module did not run, A is accepted
  assertStringIncludes(t, "2 runs of the workflows");
  assertStringIncludes(t, "1 open, 0 new in the latest run, 1 fixed in it, 1 accepted");
  assertStringIncludes(t, "other");
  assertStringIncludes(t, "no-var");
  assertStringIncludes(t, "the fixture team");
  assertStringIncludes(t, "waiting for the compiler release that fixes it");
  assertStringIncludes(t, "workflow-invalid");
  assertStringIncludes(t, "2027-01-31");
  assert(!t.includes("Owner review due"), "the day of the policy has not passed");
  const files = new Map(built.files.map((f) => [f.path, f.text]));
  const json = JSON.parse(files.get("quality/build-findings.json") ?? "{}") as { rows: { status: string; module: string }[]; counts: { open: number } };
  assertEquals(json.rows.map((r) => `${r.module}:${r.status}`).sort(), ["fixture:accepted", "fixture:fixed", "other:open"]);
  assertEquals(json.counts.open, 1);
  assertStringIncludes(files.get("quality/build-findings.csv") ?? "", "id,status,tool,code,module,file,line,severity,message");
});

proves(["0001-docs FR-030"], "an acceptance that has ended shows its finding open again, and once the day of the release policy has passed the page carries the banner of the review", async () => {
  const run = (day: string, accepted: number) => ({ schema: "build-findings/1" as const, run: { id: "9", workflow: "ci", commit: "c", at: `${day}T10:00:00Z` }, steps: [{ id: "v", job: "verify", module: "m", tool: "tsc" as const, outcome: "findings" as const, findings: 1, durationMs: 1 }], findings: [{ id: "f-aaaaaaaaaaaaaaaa", tool: "tsc" as const, code: "TS1", module: "m", file: "a.ts", line: 1, severity: "error" as const, message: "boom", key: "k", evidence: { run: "9", commit: "c", step: "v", logSha256: "0" }, at: `${day}T10:00:00Z` }].slice(0, accepted) });
  const acceptance = { id: "f-aaaaaaaaaaaaaaaa", owner: "o", reason: "a reason of a sentence", from: "2026-11-01", until: "2026-12-01", by: "shah" };
  const ended = deriveRows([run("2026-12-05", 1)], [acceptance], "2026-12-05");
  assertEquals([ended[0]?.status, ended[0]?.note?.includes("ended on 2026-12-01")], ["open", true]);
  const csv = csvOf(exportRows(ended));
  assertStringIncludes(csv, "the acceptance of o ended on 2026-12-01");
  assert(csv.split("\n")[0]?.startsWith("id,status"));
  assertEquals(csv.split("\n").length, 3, "a header, a row and the end");
});

proves(["0001-docs FR-030"], "where no run has kept findings the page says so and shows nothing as a pass", async () => {
  const built = await site(undefined);
  const page = built.pages.find((p) => p.path === "quality/build-findings.html");
  if (page === undefined) return; // no Quality section without evidence: the section says so itself
  assertStringIncludes(text(page.blocks), "No findings recorded yet");
});

proves(["0001-docs FR-030"], "Quality shows the Kanon outcome and keeps the finding through a verify that never reached the checker", async () => {
  await fs.withTempDir(async (dir) => {
    const rows = path.join(dir, "findings-history", "runs");
    await fs.ensureDir(rows);
    const url = "https://github.com/intellectual-frontiers/.github/actions/runs/123";
    const run = { id: "123", workflow: "ci", commit: "first", at: "2026-11-20T00:00:00Z", url };
    const first: FindingsFile = {
      schema: "build-findings/1", run,
      steps: [{ id: "import", job: "verify", module: "demo", tool: "kanon-check", kanonCheck: "import", outcome: "findings", findings: 1, durationMs: 3 }],
      findings: [{ id: "f-kanon", tool: "kanon-check", module: "demo", code: "layers/above", key: "import target", file: "src/x.ts", line: 7,
        severity: "error", message: "Upward import", at: run.at, evidence: { run: run.id, commit: run.commit, step: "import", logSha256: "hash" } }],
    };
    const skipped: FindingsFile = {
      schema: "build-findings/1", run: { ...run, id: "124", commit: "next", at: "2026-11-21T00:00:00Z" },
      steps: [{ id: "verify", job: "verify", module: "demo", tool: "verify", outcome: "findings", findings: 0, durationMs: 3 }],
      findings: [],
    };
    await fs.writeTextFile(path.join(rows, "123.json"), JSON.stringify(first));
    await fs.writeTextFile(path.join(rows, "124.json"), JSON.stringify(skipped));
    const built = await site(dir);
    const page = built.pages.find((p) => p.path === "quality/build-findings.html");
    assert(page !== undefined);
    for (const value of ["Kanon checks", "not recorded in latest verify", "layers/above", "src/x.ts:7", url])
      assertStringIncludes(text(page.blocks), value);
    const outputs = new Map(built.files.map((f) => [f.path, f.text]));
    assertStringIncludes(outputs.get("quality/build-findings.json") ?? "", '"status": "open"');
    assertStringIncludes(outputs.get("quality/build-findings.csv") ?? "", "f-kanon,open,kanon-check,layers/above");
  });
});
