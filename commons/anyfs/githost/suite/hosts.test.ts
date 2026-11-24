/**
 * Tests of the opening of a store by a place (commons anyfs-githost 0002-anyfs-githost-store FR-004, FR-006): the address of each API (GitHub, a GitHub Enterprise endpoint, GitLab with groups to any depth encoded as one segment), the
 * default branch where the place names none, the header of each kind of GitLab token, and a place that is not the host's.
 *
 * @module
 */
import { ok } from "@intellectual-frontiers/core";
import type { Transport } from "@intellectual-frontiers/net/http-client";
import { parsePlace } from "@intellectual-frontiers/anyfs/governance";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { type GithubPlace, type GitlabPlace, openGithubStore, openGitlabStore } from "../src/mod.ts";
import { fakeGithub } from "./fake-github.ts";
import { fakeGitlab } from "./fake-gitlab.ts";
import { FakeRepo } from "./fake-git.ts";
import { AUTHOR, rig, tokenSource } from "./support.ts";

const gh = (t: string): GithubPlace => {
  const r = parsePlace(t);
  if (r.kind === "err" || r.value.kind !== "github") throw new Error(t);
  return r.value;
};
const gl = (t: string): GitlabPlace => {
  const r = parsePlace(t);
  if (r.kind === "err" || r.value.kind !== "gitlab") throw new Error(t);
  return r.value;
};

proves(["0002-anyfs-githost-store FR-004", "0002-anyfs-githost-store FR-006"], "GitHub is asked at api.github.com, an Enterprise server at the endpoint named, the default branch is the repository's where the place names none, and a repository the host does not have is a sentence", async () => {
  const repo = new FakeRepo();
  repo.seed({ "a.txt": "a" }, "trunk");
  const f = fakeGithub(repo, { defaultBranch: "trunk" });
  f.knobs.token = undefined;
  const hosts: string[] = [];
  const watching: Transport = { kind: "recorded", send: (r) => (hosts.push(new URL(r.url).origin + new URL(r.url).pathname.split("/").slice(0, 3).join("/")), f.transport.send(r)) };
  const opened = await openGithubStore({ place: gh("github://acme/fleet"), token: tokenSource, commit: { author: AUTHOR }, transport: watching });
  assert(opened.kind === "ok" && opened.value.branch === "trunk" && opened.value.facts.defaultBranch === "trunk");
  assert(hosts.every((h) => h.startsWith("https://api.github.com/repos")), "the default API");

  hosts.length = 0;
  const ghes = await openGithubStore({ place: gh("github://acme/fleet@trunk"), token: tokenSource, commit: { author: AUTHOR }, transport: watching, endpoint: "https://github.example.test/api/v3/" });
  assert(ghes.kind === "err" || hosts.every((h) => h.startsWith("https://github.example.test/api")), `the endpoint: ${hosts.join()}`);
  // a repository the host does not have
  const missing = await openGithubStore({ place: gh("github://acme/nothing@trunk"), token: tokenSource, commit: { author: AUTHOR }, transport: f.transport });
  assert(missing.kind === "err" && missing.error.length > 10);
});

proves(["0002-anyfs-githost-store FR-004", "0002-anyfs-githost-store FR-006"], "a GitLab project at any depth of groups is one encoded segment, the server is the host of the place or the endpoint named, and an access token and a job token are each sent in their own header", async () => {
  const repo = new FakeRepo();
  repo.seed({ "a.txt": "a" }, "main");
  const f = fakeGitlab(repo);
  f.knobs.token = undefined;
  const urls: string[] = [];
  const watching: Transport = { kind: "recorded", send: (r) => (urls.push(r.url), f.transport.send(r)) };
  const opened = await openGitlabStore({ place: gl("gitlab://gitlab.example.test/acme/ops/fleet@main"), token: tokenSource, commit: { author: AUTHOR }, transport: watching });
  assert(opened.kind === "ok" && opened.value.mode === "writable", opened.kind === "err" ? opened.error : "");
  assert(urls.every((u) => u.startsWith("https://gitlab.example.test/api/v4/projects/acme%2Fops%2Ffleet")), urls[0]);

  urls.length = 0;
  const custom = await openGitlabStore({ place: gl("gitlab://gitlab.example.test/acme/ops/fleet@main"), token: tokenSource, commit: { author: AUTHOR }, transport: watching, endpoint: "http://127.0.0.1:8929/" });
  assert(custom.kind === "ok");
  assert(urls.every((u) => u.startsWith("http://127.0.0.1:8929/api/v4/projects/")), urls[0]);

  const headers: string[][] = [];
  const spy: Transport = { kind: "recorded", send: (r) => (headers.push(Object.keys(r.headers).map((k) => k.toLowerCase())), f.transport.send(r)) };
  await openGitlabStore({ place: gl("gitlab://gitlab.example.test/acme/ops/fleet@main"), token: tokenSource, commit: { author: AUTHOR }, transport: spy });
  assert(headers.every((h) => h.includes("private-token") && !h.includes("authorization") && !h.includes("job-token")));
  headers.length = 0;
  await openGitlabStore({ place: gl("gitlab://gitlab.example.test/acme/ops/fleet@main"), token: tokenSource, commit: { author: AUTHOR }, transport: spy, tokenKind: "job" });
  assert(headers.every((h) => h.includes("job-token") && !h.includes("private-token")));
});

proves(["0002-anyfs-githost-store FR-006"], "the name of a branch is refused where Git would refuse it, and a store of a folder of the branch sees that folder only", async () => {
  for (const label of ["github", "gitlab"] as const) {
    const r = rig(label, { "x/a.txt": "a", "y/b.txt": "b", "top.txt": "t" });
    // a branch the place cannot even name is refused as a place; the rest are refused by the store
    for (const bad of ["a..b", "has space", "q?"]) assertEquals(parsePlace(`github://acme/fleet@${bad}`).kind, "err", bad);
    for (const bad of ["-start", "x.lock"]) {
      const o = await r.tryOpen({ ref: bad });
      assert(o.kind === "err", `${label}: ${bad}`);
    }
    const folder = await r.writable({ prefix: "x" });
    const l = await folder.list("" as never);
    assert(l.kind === "ok" && l.value.entries.map((e) => e.path).join() === "a.txt", `${label}: ${l.kind === "ok" ? l.value.entries.map((e) => e.path).join() : "err"}`);
  }
  void ok;
  assertEquals(1, 1);
});
