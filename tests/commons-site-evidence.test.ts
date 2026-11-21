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

proves(["0011-documentation FR-042"], "the workflow site runs the tests of every library and of the repository on main, keeps each report, fetches the open issues and publishes the site whether or not a test failed", () => {
  const w = read(".github/workflows/site.auto.yml");
  for (const said of [
    "plan.ts --all",
    "matrix: ${{ fromJSON(needs.plan.outputs.linux) }}",
    "commons/docs/tools/evidence.ts --library \\\"${{ matrix.name }}\\\"",
    "commons/docs/tools/evidence.ts --library repository",
    "continue-on-error: true",
    "name: evidence-${{ matrix.name }}",
    "name: evidence-repository",
    "actions/download-artifact@v4",
    "merge-multiple: true",
    "_evidence/github-issues.json",
    "_evidence/meta.json",
    "needs: [check, evidence, repository]",
    "always() && needs.check.result == 'success'",
    "needs: [site]",
  ]) assertStringIncludes(w, said);
  // the site is built in the one job and published by the other, and the check does not build it
  const check = w.slice(w.indexOf("\n  check:"), w.indexOf("\n  plan:"));
  assert(!check.includes("src/main.ts build"), "the check job builds no site");
  // a run in progress on main is finished, not cancelled by the next push
  assertStringIncludes(w, "cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}");
});

proves(["0011-documentation FR-041"], "commons' configuration gives the evidence: the results folder, the GitHub snapshot in it, and the issues of data with their scopes", () => {
  const c = read("commons/docs.config.ts");
  for (const said of ['results: "_evidence"', 'github: "_evidence/github-issues.json"', "dataIssues.issues", "scope: set.scope", "evidence,"]) assertStringIncludes(c, said);
  assertStringIncludes(read(".gitignore"), "_evidence");
});
