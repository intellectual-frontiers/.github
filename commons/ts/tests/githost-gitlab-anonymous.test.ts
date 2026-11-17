/**
 * What GitLab answers a caller with no credential for a public project (commons 0023-if-workspaces FR-015, FR-019): the answer gitlab.com gave when this was written, with the keys
 * it carries, and no `archived` among them. The adapter reads it as a public, unarchived project instead of refusing it (found by asking the real host; the recorded answers of
 * `githost-adapters.test.ts` had carried the key).
 *
 * @module
 */
import { gitlabClient } from "../githost/gitlab.ts";
import { type Exchange, recordedTransport } from "../runtime/http-client.ts";
import { assertEquals, proves } from "../runtime/test.ts";

const answer: Exchange = {
  method: "GET",
  url: "https://gitlab.com/api/v4/projects/gitlab-org%2Fgitlab",
  status: 200,
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    id: 278964,
    name: "GitLab",
    path: "gitlab",
    path_with_namespace: "gitlab-org/gitlab",
    default_branch: "master",
    visibility: "public",
    http_url_to_repo: "https://gitlab.com/gitlab-org/gitlab.git",
    ssh_url_to_repo: "git@gitlab.com:gitlab-org/gitlab.git",
    web_url: "https://gitlab.com/gitlab-org/gitlab",
    topics: [],
  }),
};

proves(
  ["0023-if-workspaces FR-015", "0023-if-workspaces FR-019"],
  "a public GitLab project answered with no credential, and with no archived key, is read as public and unarchived",
  async () => {
    const c = gitlabClient({ transport: recordedTransport([answer]) });
    const r = await c.repository({ kind: "Gitlab", host: "gitlab.com", path: ["gitlab-org", "gitlab"] });
    assertEquals(r.kind === "ok" ? [r.value.visibility, r.value.archived, r.value.defaultBranch, r.value.cloneUrl] : r, [
      "public",
      false,
      "master",
      "https://gitlab.com/gitlab-org/gitlab.git",
    ]);
  },
);
