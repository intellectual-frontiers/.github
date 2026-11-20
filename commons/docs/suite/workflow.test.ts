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

proves(["0011-documentation FR-022"], "no workflow makes a GitHub release, and the write permission is the release job's alone", async () => {
  for (const f of fs.readDirSync(path.join(ROOT, ".github/workflows"))) {
    const text = await fs.readTextFile(path.join(ROOT, ".github/workflows", f.name));
    assert(!/gh release (create|upload)|softprops\/action-gh-release/.test(text), `${f.name} makes a release`);
    // the write permission is for the job that publishes the libraries and makes their tags, in the release workflow, and for nothing else
    const at = text.indexOf("\n  publish:\n");
    const rest = at < 0 || f.name !== "release.auto.yml" ? text : text.slice(0, at) + text.slice(at).replace(/^\n {2}publish:\n[\s\S]*?(?=\n {2}[a-z][\w-]*:\n|$)/, "");
    assert(!/contents: write/.test(rest), `${f.name} has a write permission that is not the release job's`);
  }
});
