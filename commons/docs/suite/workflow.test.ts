/**
 * The workflows of the generator (commons 0011-documentation FR-020, FR-022): the one that tests, checks and publishes commons' site, and no workflow that makes a GitHub release.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { assert, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { ROOT } from "./helpers.ts";

proves(["0011-documentation FR-020"], "site.yml tests and checks on pull requests and pushes, and publishes from main with GitHub's Pages actions", async () => {
  const yml = await fs.readTextFile(path.join(ROOT, ".github/workflows/site.auto.yml"));
  for (const needed of ["pull_request:", "push:", "bun run verify", "actions/upload-pages-artifact@", "actions/deploy-pages@", "pages: write", "id-token: write", "github.ref == 'refs/heads/main'", "bun src/main.ts build --out"]) {
    assertStringIncludes(yml, needed);
  }
  assert(!/git (add|commit|push)/.test(yml), "the site is never committed");
});

proves(["0011-documentation FR-022"], "no workflow makes a GitHub release, and the write permission is the release job's and the one job that keeps the findings on the history branch", async () => {
  for (const f of fs.readDirSync(path.join(ROOT, ".github/workflows"))) {
    const text = await fs.readTextFile(path.join(ROOT, ".github/workflows", f.name));
    assert(!/gh release (create|upload)|softprops\/action-gh-release/.test(text), `${f.name} makes a release`);
    // the write permission is for the job that publishes the libraries and makes their tags, in the release workflow, and for nothing else
    const at = text.indexOf("\n  publish:\n");
    const withoutPublish = at < 0 || f.name !== "release.auto.yml" ? text : text.slice(0, at) + text.slice(at).replace(/^\n {2}publish:\n[\s\S]*?(?=\n {2}[a-z][\w-]*:\n|$)/, "");
    // and for the job that keeps the findings of a run on the history branch (0038-build-policy FR-012): on the default branch only, after no pull request, and never a red run
    const rest = withoutPublish.replace(/\n {2}keep-findings:\n[\s\S]*?(?=\n {2}[a-z][\w-]*:\n|$)/, "");
    // and for the job that makes the tag of a version by hand, in the maintenance workflow, on a commit of the default branch (it never replaces a tag)
    const rest2 = f.name === "maintenance.auto.yml" ? rest.replace(/\n {2}tag:\n[\s\S]*?(?=\n {2}[a-z][\w-]*:\n|$)/, "") : rest;
    assert(!/contents: write/.test(rest2), `${f.name} has a write permission that is not the release job's`);
  }
});
