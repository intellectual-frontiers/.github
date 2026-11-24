/**
 * The contract on a real host (commons anyfs-githost 0003-anyfs-githost-tests FR-002, FR-003): where the environment names a repository on a real GitHub or GitLab and a token for it, the conformance suite of AnyFS runs on it in a folder of its own that
 * it empties afterwards; where it names none, the test says why it did not run, and does not pass silently.
 *
 * ```sh
 * ANYFS_GITHOST_TEST_PLACE=github://owner/throwaway-repo@scratch ANYFS_GITHOST_TEST_TOKEN=<a token that may push to it> bun test suite/real.test.ts
 * ANYFS_GITHOST_TEST_PLACE=gitlab://gitlab.com/group/throwaway@scratch ANYFS_GITHOST_TEST_TOKEN=<a token> bun test suite/real.test.ts
 * ```
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { runConformance } from "@intellectual-frontiers/anyfs/conformance";
import { parsePlace } from "@intellectual-frontiers/anyfs/governance";
import { proc } from "@intellectual-frontiers/system";
import { openGithubStore, openGitlabStore, staticToken } from "../src/mod.ts";
import { AUTHOR } from "./support.ts";

const env = (name: string): string | undefined => proc.env.get(`ANYFS_GITHOST_TEST_${name}`);

proves(["0003-anyfs-githost-tests FR-002", "0003-anyfs-githost-tests FR-003"], "on a real host named by the environment the store passes every case of the conformance suite; where none is named the test says why it did not run", async (t) => {
  const placeText = env("PLACE");
  const tokenText = env("TOKEN");
  if (placeText === undefined || tokenText === undefined) {
    t.skip("no real host was named: set ANYFS_GITHOST_TEST_PLACE (a place on a repository made for the tests) and ANYFS_GITHOST_TEST_TOKEN (a token that may push to it); GitHub and GitLab cannot be run in the sandbox and Gitea does not speak their write API");
    return;
  }
  const place = parsePlace(placeText);
  assert(place.kind === "ok", "the place is a place");
  const token = staticToken(tokenText);
  assert(token.kind === "ok", "the token is a token");
  const options = { token: token.value, commit: { author: AUTHOR } };
  let n = 0;
  const run = `anyfs-test-${Date.now().toString(36)}`;
  const reports = await runConformance(async () => {
    const prefix = `${run}/${n++}`;
    const withPrefix = parsePlace(`${placeText.replace(/\/+$/u, "")}/${prefix}`);
    if (withPrefix.kind === "err") throw new Error(withPrefix.error);
    const opened =
      withPrefix.value.kind === "github"
        ? await openGithubStore({ ...options, place: withPrefix.value })
        : withPrefix.value.kind === "gitlab"
          ? await openGitlabStore({ ...options, place: withPrefix.value })
          : undefined;
    if (opened === undefined || opened.kind === "err") throw new Error(opened === undefined ? "the place is not a host's" : opened.error);
    if (opened.value.mode !== "writable") throw new Error("the token may not push");
    return opened.value.store;
  });
  assertEquals(reports.filter((r) => r.failure !== undefined).map((r) => `${r.id}: ${r.failure}`), []);
});
