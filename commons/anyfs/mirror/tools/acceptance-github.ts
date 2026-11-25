// Spec: 0005-mirror-conformance FR-003
/**
 * The acceptance run of the mirrored store against a Git host (commons anyfs-mirror 0005-mirror-conformance FR-003, run against a host): the branch of a repository on GitHub is the primary and a SQLite file in a new folder is the
 * secondary. It writes a few files through the mirror, reads the branch and the file by their own stores and says whether they hold the same paths, revisions and bytes, then removes what it wrote. It is not part
 * of `verify`: it needs a network and a token, and it writes commits to the branch it is given, so give it a branch made for the run.
 *
 * ```sh
 * GITHUB_TOKEN=... bun tools/acceptance-github.ts --owner OWNER --repo REPO --branch BRANCH [--from BASE]
 * bun tools/acceptance-github.ts --owner OWNER --repo REPO --branch BRANCH --via git
 * ```
 *
 * `--from` names the branch to start `BRANCH` from where it does not exist. The token is read from `GITHUB_TOKEN` and never printed. With `--via git` the primary is the Git backend (`anyfs-git`) in a new bare
 * repository that is fetched from `https://github.com/OWNER/REPO` (the branch must exist there), the writes are pushed with the credentials Git itself has, the pushed tip is read back from the host and compared with the local
 * one, and what was written is removed and pushed again, so the branch gets two commits: for a computer that may push with Git but whose network does not let the REST API write, and may push no other branch.
 *
 * @module
 */
import { execFileSync } from "node:child_process";
import process from "node:process";
import { CORE_CAPABILITIES, type CoreCapability, expectAny, parsePath, parsePlace, type Path, ROOT } from "@intellectual-frontiers/anyfs/governance";
import { type Store, view } from "@intellectual-frontiers/anyfs/logical";
import { gitRefStore, parseIdentity as parseGitIdentity } from "@intellectual-frontiers/anyfs-git";
import { openGithubStore } from "@intellectual-frontiers/anyfs-githost";
import { parseIdentity } from "@intellectual-frontiers/anyfs-githost/governance";
import { openSqlStore } from "@intellectual-frontiers/anyfs-sql";
import { openSqliteFile } from "@intellectual-frontiers/anyfs-sql/sqlite";
import { fs, path } from "@intellectual-frontiers/system";
import { mirrorStore } from "../src/mod.ts";

const flag = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? undefined : process.argv[i + 1];
};
const fail = (message: string): never => {
  console.error(`acceptance-github: ${message}`);
  return process.exit(1);
};
const must = <T>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: unknown }, what: string): T => (r.kind === "ok" ? r.value : fail(`${what}: ${typeof r.error === "string" ? r.error : JSON.stringify(r.error)}`));
const pathOf = (text: string): Path => must(parsePath(text), `path ${text}`);

const owner = flag("owner") ?? fail("--owner is needed");
const repo = flag("repo") ?? fail("--repo is needed");
const branch = flag("branch") ?? fail("--branch is needed");
const from = flag("from");
const via = flag("via") ?? "api";
if (via !== "api" && via !== "git") fail("--via is api or git");
if (via === "api" && process.env["GITHUB_TOKEN"] === undefined) fail("GITHUB_TOKEN is not set");
const place = must(parsePlace(`github://${owner}/${repo}@${branch}`), "the place");
if (place.kind !== "github") fail("the place is not a GitHub place");
const author = must(parseIdentity("AnyFS Mirror Acceptance", "anyfs-mirror@example.test"), "identity");

const dir = await fs.makeTempDir({ prefix: "anyfs-mirror-acceptance-" });

const remote = `https://github.com/${owner}/${repo}`;
let pushBranch: (() => Promise<string>) | undefined;
let primary: Store<CoreCapability>;
if (via === "api") {
  const opened = must(await openGithubStore({ place: place as Extract<typeof place, { kind: "github" }>, token: { kind: "environment", env: (name) => process.env[name], name: "GITHUB_TOKEN" }, commit: { author }, ...(from === undefined ? {} : { createFrom: from }) }), "open the repository");
  primary = must(view(opened.store, CORE_CAPABILITIES), "the primary");
} else {
  await fs.mkdir(path.join(dir, "repo"), { recursive: true });
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", path.join(dir, "repo")]);
  execFileSync("git", ["-C", path.join(dir, "repo"), "fetch", "-q", "--depth", "1", remote, `${branch}:${branch}`], { env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
  const local = must(await gitRefStore({ repo: path.join(dir, "repo"), branch, commit: { author: must(parseGitIdentity("AnyFS Mirror Acceptance", "anyfs-mirror@example.test"), "git identity") } }), "the branch");
  primary = must(view(local.store, CORE_CAPABILITIES), "the primary");
  pushBranch = async () => {
    const pushed = must(await local.push(remote), "push to the host");
    return pushed.tip;
  };
}
const file = path.join(dir, "mirror.db");
try {
  const secondary = must(view(must(await openSqlStore(must(await openSqliteFile(file), "sqlite"), { target: "mirror.db" }), "sql store").store, CORE_CAPABILITIES), "the secondary");
  const m = must(await mirrorStore({ primary, secondaries: [secondary] }), "mirror");
  // the file is new and the branch is not empty: one reconcile makes the file hold what the branch holds, as it would after a loss
  const caught = must(await m.reconcile(), "reconcile");
  console.log(`reconciled: ${caught.map((r) => `${r.copied.length} copied, ${r.removed.length} removed, ${r.failed.length} failed`).join("; ")}`);
  const prefix = `mirror-acceptance/${new Date().toISOString().replace(/[:.]/gu, "-")}`;
  const names = ["a.txt", "b/c.txt", "b/d.txt"].map((n) => pathOf(`${prefix}/${n}`));
  for (const [i, p] of names.entries()) must(await m.store.write(p, new TextEncoder().encode(`object ${i}`), expectAny), `write ${p}`);
  must(await m.store.delete(names[2] as Path, expectAny), "delete");
  const drift = must(await m.verify(), "verify");
  const left = (await Promise.all([primary, secondary].map(async (s) => (must(await s.list(ROOT), "list").entries.filter((e) => e.path.startsWith(prefix)).map((e) => `${e.path} ${e.rev}`)).join("\n")))) as [string, string];
  const same = left[0] === left[1] && left[0].split("\n").length === 2 && drift.every((d) => d.missing.length + d.different.length + d.extra.length === 0);
  console.log(`primary   ${primary.id}\nsecondary ${secondary.id}\n${left[0]}\n${same ? "the secondary holds what the primary holds" : "THE STORES DIFFER"}`);
  let hostSame = true;
  if (pushBranch !== undefined) {
    const tip = await pushBranch();
    const onHost = execFileSync("git", ["ls-remote", remote, `refs/heads/${branch}`], { encoding: "utf8", env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }).split("\t")[0] ?? "";
    hostSame = onHost === tip && tip !== "";
    console.log(`the host holds the branch at ${onHost.slice(0, 12)}, the local tip is ${tip.slice(0, 12)}: ${hostSame ? "the same" : "DIFFERENT"}`);
    for (const p of names.slice(0, 2)) must(await m.store.delete(p, expectAny), `remove ${p}`);
    const cleaned = await pushBranch();
    console.log(`what was written is removed and pushed: the host is at ${cleaned.slice(0, 12)}`);
  } else {
    for (const p of names) must(await m.store.delete(p, expectAny), `remove ${p}`);
  }
  if (!same || !hostSame) process.exitCode = 1;
} finally {
  await fs.remove(dir, { recursive: true }).catch(() => undefined);
}
