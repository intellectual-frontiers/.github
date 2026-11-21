/**
 * The site of commons shows the evidence of quality (commons 0011-documentation FR-041, FR-042): its configuration gives `evidence`, and the generated workflow `site` runs the tests of every library and of the
 * repository's own `tests/` on main, keeps each run's CTRF report, fetches the open issues, builds the site from them and publishes it whether or not a test failed.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { path } from "../commons/system/src/mod.ts";
import { assert, assertStringIncludes, proves } from "../commons/test/src/test.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

proves(["0011-documentation FR-042"], "the evidence workflow runs the tests of every library by the hour and keeps each report with its status, and the site workflow publishes on every push from the newest evidence whatever failed", () => {
  const e = read(".github/workflows/evidence.auto.yml");
  for (const said of ["cron: \"17 * * * *\"", "plan.ts --all", "matrix: ${{ fromJSON(needs.plan.outputs.linux) }}", "continue-on-error: true", "status-${{ matrix.name }}.json", "name: evidence-${{ matrix.name }}", "name: evidence-repository", "name: evidence", "merge-multiple: true"]) assertStringIncludes(e, said);
  assert(!e.includes("push:"), "the evidence is not gathered on a push");
  const w = read(".github/workflows/site.auto.yml");
  for (const said of ["gh run download --name evidence", "_evidence/github-issues.json", "tools/ci-runs.ts", "tools/status-site.ts", "steps.build.outcome != 'success'", "workflow_run:", "needs: [check]", "always() && github.event_name != 'pull_request'", "needs: [site]", "always() && needs.site.result == 'success'", "cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}"]) assertStringIncludes(w, said);
  assert(!w.includes("evidence.ts --library"), "the site does not run the tests");
});

proves(["0011-documentation FR-041"], "commons' configuration gives the evidence: the results folder, the GitHub snapshot in it, and the issues of data with their scopes", () => {
  const c = read("commons/docs.config.ts");
  for (const said of ['results: "_evidence"', 'github: "_evidence/github-issues.json"', "await issuesOf([", '"./data/issues/mod.ts"', "issues.scope", "evidence,", "problems,"]) assertStringIncludes(c, said);
  assertStringIncludes(read(".gitignore"), "_evidence");
});
