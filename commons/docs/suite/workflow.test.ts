/**
 * The workflows of the generator (commons 0011-documentation FR-020, FR-022): the one that tests, checks and publishes commons' site, and
 * the job that installs the commit as a Git dependency and runs the smoke tests; and no workflow that makes a GitHub release.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { ROOT } from "./helpers.ts";

proves(["0011-documentation FR-020"], "docs.yml tests and checks on pull requests and pushes, and publishes from main with GitHub's Pages actions", async () => {
  const yml = await fs.readTextFile(path.join(ROOT, ".github/workflows/docs.auto.yml"));
  for (const needed of ["pull_request:", "push:", "bun run verify", "actions/upload-pages-artifact@", "actions/deploy-pages@", "pages: write", "id-token: write", "github.ref == 'refs/heads/main'", "bun main.ts build --out"]) {
    assertStringIncludes(yml, needed);
  }
  assert(!/git (add|commit|push)/.test(yml), "the site is never committed");
});

proves(["0011-documentation FR-022"], "ifc-typescript.yml's git-dependency job runs both smoke tests from git+file: on three systems, and nothing releases", async () => {
  const yml = await fs.readTextFile(path.join(ROOT, ".github/workflows/ifc-typescript.auto.yml"));
  const job = yml.slice(yml.indexOf("\n  git-dependency:"));
  assert(job.length > 0 && yml.includes("\n  git-dependency:"), "ifc-typescript.yml has the job git-dependency");
  for (const needed of [
    "os: [ubuntu-latest, macos-latest, windows-latest]",
    "./.github/actions/bun",
    "node-version: ${{ env.NODE_VERSION }}",
    'bun tools/smoke.ts --repo "$GITHUB_WORKSPACE" --commit "$GITHUB_SHA"',
    "working-directory: commons/ts",
    "working-directory: commons/docs",
  ]) {
    assertStringIncludes(job, needed);
  }
  assertStringIncludes(yml, 'NODE_VERSION: "26.');
  for (const f of fs.readDirSync(path.join(ROOT, ".github/workflows"))) {
    const text = await fs.readTextFile(path.join(ROOT, ".github/workflows", f.name));
    assert(!/gh release (create|upload)|softprops\/action-gh-release/.test(text), `${f.name} makes a release`);
    // the write permission is for the job that makes the tag of a published version, in the workflow a library is published by, and for nothing else
    const tag = text.indexOf("\n  tag:\n");
    const rest = tag < 0 || !f.name.endsWith("-publish.auto.yml") ? text : text.slice(0, tag) + text.slice(tag).replace(/^\n {2}tag:\n[\s\S]*?(?=\n {2}[a-z][\w-]*:\n|$)/, "");
    assert(!/contents: write/.test(rest), `${f.name} has a write permission that is not the tag job's`);
  }
  assert(!/git (add|commit|push)/.test(job), "the job commits nothing");
});
