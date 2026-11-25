// Spec: 0005-mirror-conformance FR-003
/**
 * The acceptance run of the mirrored store against a Git host (commons anyfs-mirror 0005-mirror-conformance FR-003, run against a host): the branch of a repository on GitHub is the primary and a SQLite file in a new folder is the
 * secondary. It writes a few files through the mirror, reads the branch and the file by their own stores and says whether they hold the same paths, revisions and bytes, then removes what it wrote. It is not part
 * of `verify`: it needs a network and a token, and it writes commits to the branch it is given, so give it a branch made for the run.
 *
 * ```sh
 * GITHUB_TOKEN=... bun tools/acceptance-github.ts --owner OWNER --repo REPO --branch BRANCH [--from BASE]
 * ```
 *
 * `--from` names the branch to start `BRANCH` from where it does not exist. The token is read from `GITHUB_TOKEN` and never printed.
 *
 * @module
 */
import process from "node:process";
import { CORE_CAPABILITIES, type CoreCapability, expectAny, parsePath, parsePlace, type Path, ROOT } from "@intellectual-frontiers/anyfs/governance";
import { type Store, view } from "@intellectual-frontiers/anyfs/logical";
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
if (process.env["GITHUB_TOKEN"] === undefined) fail("GITHUB_TOKEN is not set");
const place = must(parsePlace(`github://${owner}/${repo}@${branch}`), "the place");
if (place.kind !== "github") fail("the place is not a GitHub place");
const author = must(parseIdentity("AnyFS Mirror Acceptance", "anyfs-mirror@example.test"), "identity");

const opened = must(await openGithubStore({ place: place as Extract<typeof place, { kind: "github" }>, token: { kind: "environment", env: (name) => process.env[name], name: "GITHUB_TOKEN" }, commit: { author }, ...(from === undefined ? {} : { createFrom: from }) }), "open the repository");
const primary: Store<CoreCapability> = must(view(opened.store, CORE_CAPABILITIES), "the primary");

const dir = await fs.makeTempDir({ prefix: "anyfs-mirror-acceptance-" });
const file = path.join(dir, "mirror.db");
try {
  const secondary = must(view(must(await openSqlStore(must(await openSqliteFile(file), "sqlite"), { target: "mirror.db" }), "sql store").store, CORE_CAPABILITIES), "the secondary");
  const m = must(await mirrorStore({ primary, secondaries: [secondary] }), "mirror");
  const prefix = `mirror-acceptance/${new Date().toISOString().replace(/[:.]/gu, "-")}`;
  const names = ["a.txt", "b/c.txt", "b/d.txt"].map((n) => pathOf(`${prefix}/${n}`));
  for (const [i, p] of names.entries()) must(await m.store.write(p, new TextEncoder().encode(`object ${i}`), expectAny), `write ${p}`);
  must(await m.store.delete(names[2] as Path, expectAny), "delete");
  const drift = must(await m.verify(), "verify");
  const left = (await Promise.all([primary, secondary].map(async (s) => (must(await s.list(ROOT), "list").entries.filter((e) => e.path.startsWith(prefix)).map((e) => `${e.path} ${e.rev}`)).join("\n")))) as [string, string];
  const same = left[0] === left[1] && left[0].split("\n").length === 2 && drift.every((d) => d.missing.length + d.different.length + d.extra.length === 0);
  console.log(`primary   ${primary.id}\nsecondary ${secondary.id}\n${left[0]}\n${same ? "the secondary holds what the primary holds" : "THE STORES DIFFER"}`);
  for (const p of names) must(await m.store.delete(p, expectAny), `remove ${p}`);
  if (!same) process.exitCode = 1;
} finally {
  await fs.remove(dir, { recursive: true }).catch(() => undefined);
}
