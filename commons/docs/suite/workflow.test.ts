/**
 * The workflow that tests, checks and publishes the site (commons 0011-documentation FR-020).
 *
 * @module
 */
import { fs, path } from "../../ts/runtime/mod.ts";
import { assert, assertStringIncludes, proves } from "../../ts/runtime/test.ts";
import { ROOT } from "./helpers.ts";

proves(["0011-documentation FR-020"], "docs.yml tests and checks on pull requests and pushes, and publishes from main with GitHub's Pages actions", async () => {
  const yml = await fs.readTextFile(path.join(ROOT, ".github/workflows/docs.yml"));
  for (const needed of ["pull_request:", "push:", "bun run verify", "actions/upload-pages-artifact@", "actions/deploy-pages@", "pages: write", "id-token: write", "github.ref == 'refs/heads/main'", "bun main.ts --out"]) {
    assertStringIncludes(yml, needed);
  }
  assert(!/git (add|commit|push)/.test(yml), "the site is never committed");
});
