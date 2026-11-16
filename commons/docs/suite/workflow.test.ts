/**
 * The workflows of the generator (commons 0011-documentation FR-020, FR-022): the one that tests, checks and publishes commons' site, and
 * the one that releases the package.
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/ifc-ts/runtime";
import { assert, assertStringIncludes, proves } from "@intellectual-frontiers/ifc-ts/runtime/test";
import { ROOT } from "./helpers.ts";

proves(["0011-documentation FR-020"], "docs.yml tests and checks on pull requests and pushes, and publishes from main with GitHub's Pages actions", async () => {
  const yml = await fs.readTextFile(path.join(ROOT, ".github/workflows/docs.yml"));
  for (const needed of ["pull_request:", "push:", "bun run verify", "actions/upload-pages-artifact@", "actions/deploy-pages@", "pages: write", "id-token: write", "github.ref == 'refs/heads/main'", "bun main.ts build --out"]) {
    assertStringIncludes(yml, needed);
  }
  assert(!/git (add|commit|push)/.test(yml), "the site is never committed");
});

proves(["0011-documentation FR-022"], "ifc-docs-release.yml releases on an ifc-docs-v tag or by hand from main, after it checks, tests, packs and smokes", async () => {
  const yml = await fs.readTextFile(path.join(ROOT, ".github/workflows/ifc-docs-release.yml"));
  for (const needed of [
    '- "ifc-docs-v*"',
    "workflow_dispatch:",
    "refs/heads/main",
    "ifc-docs-v[0-9]*.[0-9]*.[0-9]*",
    "./.github/actions/bun",
    "NODE_VERSION: \"26.",
    "bun install --frozen-lockfile",
    "bun run check",
    "bun test suite/",
    'bun run --silent pack --tag "$TAG"',
    'bun run --silent smoke "$tarball"',
    'gh release view "$TAG"',
    'gh release create "$TAG" "$TARBALL" "$TARBALL.sha256" --target "$GITHUB_SHA"',
    "contents: write",
  ]) {
    assertStringIncludes(yml, needed);
  }
  assert(!/git (add|commit|push)/.test(yml), "a release commits nothing");
});
