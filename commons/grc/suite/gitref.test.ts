/**
 * Tests of the branch store (commons grc 0013-grc-gitref FR-001 to FR-006) with real Git in temporary repositories: a commit only of what differs, a working tree and index never touched, paths refused, a branch that moved, files read from the
 * branch and the state at an instant, and a push that is never forced. Every name is made up.
 *
 * @module
 */
import { fs, path, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { gitRefStore, type GitRefStore } from "../src/stores/gitref/mod.ts";

const text = (b: Uint8Array | undefined): string | undefined => (b === undefined ? undefined : new TextDecoder().decode(b));
const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);
const ID = { name: "collector", email: "collector@localhost" };

async function git(dir: string, ...args: string[]): Promise<string> {
  const r = await proc.run(["git", "-c", "user.name=person", "-c", "user.email=person@example.test", "-c", "commit.gpgsign=false", ...args], { cwd: dir });
  if (!r.success) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

async function withRepo<T>(f: (dir: string, store: GitRefStore) => Promise<T>): Promise<T> {
  return fs.withTempDir(async (dir) => {
    await git(dir, "init", "-q", "-b", "main");
    return f(dir, gitRefStore({ repo: dir, branch: "evidence", identity: ID }));
  });
}

const skip = proc.which("git") === undefined ? { skip: "git is not installed" } : {};

proves(["0013-grc-gitref FR-001"], "a commit writes only the files that differ, makes none where none does, and creates the branch with no parent", async () => {
  await withRepo(async (_dir, store) => {
    assertEquals(await store.head(), undefined);
    const first = await store.commit([{ path: "state/a.json", bytes: bytes("1\n") }, { path: "state/b.json", bytes: bytes("2\n") }], "first");
    assert(first.kind === "ok" && first.value.commit !== undefined);
    assertEquals(first.value.changed, ["state/a.json", "state/b.json"]);
    const parents = await git(_dir, "rev-list", "--parents", "-n", "1", "evidence");
    assertEquals(parents.split(" ").length, 1, "no parent");
    const again = await store.commit([{ path: "state/a.json", bytes: bytes("1\n") }, { path: "state/b.json", bytes: bytes("2\n") }], "again");
    assertEquals(again, { kind: "ok", value: { commit: undefined, changed: [] } });
    const one = await store.commit([{ path: "state/a.json", bytes: bytes("1\n") }, { path: "state/b.json", bytes: bytes("3\n") }], "second");
    assert(one.kind === "ok" && one.value.changed.length === 1 && one.value.changed[0] === "state/b.json");
    assertEquals(await git(_dir, "rev-list", "--count", "evidence"), "2");
    assertEquals(text(await store.read("state/a.json")), "1\n");
    assertEquals(text(await store.read("state/b.json")), "3\n");
    assertEquals(await store.commit([], "nothing"), { kind: "ok", value: { commit: undefined, changed: [] } });
  });
}, skip);

proves(["0013-grc-gitref FR-002"], "a commit leaves the working tree, the index and the checked-out branch as they were, is made at the instant given and is not signed", async () => {
  await withRepo(async (dir, store) => {
    await fs.writeTextFile(path.join(dir, "work.txt"), "a person's work\n");
    await git(dir, "add", "work.txt");
    await git(dir, "commit", "-q", "-m", "work");
    await fs.writeTextFile(path.join(dir, "work.txt"), "uncommitted\n");
    await fs.writeTextFile(path.join(dir, "new.txt"), "untracked\n");
    await git(dir, "add", "new.txt");
    const before = await git(dir, "status", "--porcelain=v1");
    const mainBefore = await git(dir, "rev-parse", "main");
    const kept = await store.commit([{ path: "state/a.json", bytes: bytes("1\n") }], "synthetic-server-01: first", "2026-12-01T10:00:00Z");
    assert(kept.kind === "ok");
    assertEquals(await git(dir, "status", "--porcelain=v1"), before, "the work and the index are as they were");
    assertEquals(await git(dir, "rev-parse", "main"), mainBefore);
    assertEquals(await git(dir, "symbolic-ref", "--short", "HEAD"), "main");
    assertEquals(await fs.readTextFile(path.join(dir, "work.txt")), "uncommitted\n");
    // the instant as seconds since the epoch: Git writes a UTC offset as `Z` or `+00:00` by its version
    assertEquals(await git(dir, "log", "-1", "--format=%ct|%an|%ae|%G?", "evidence"), `${Date.parse("2026-12-01T10:00:00Z") / 1000}|collector|collector@localhost|N`);
  });
}, skip);

proves(["0013-grc-gitref FR-003"], "a path that is not a relative path of the branch is refused and nothing is written", async () => {
  await withRepo(async (_dir, store) => {
    for (const bad of ["", "/abs", "../x", "a/../b", "a b", "-x", "a//b", "a/-b", ".."]) {
      const r = await store.commit([{ path: "ok.json", bytes: bytes("x") }, { path: bad, bytes: bytes("x") }], "bad");
      assert(r.kind === "err" && r.error.kind === "path", JSON.stringify(bad));
    }
    assertEquals(await store.head(), undefined, "nothing was written");
    assertEquals((await store.commit([{ path: "journal/synthetic-server-01/2026/12/01.jsonl", bytes: bytes("x") }], "good")).kind, "ok");
  });
}, skip);

proves(["0013-grc-gitref FR-004"], "a branch that moved while a commit was made is refused as moved and left as the other writer made it", async () => {
  await withRepo(async (dir, store) => {
    await store.commit([{ path: "a", bytes: bytes("1") }], "first");
    const other = gitRefStore({ repo: dir, branch: "evidence", identity: ID });
    // a second writer commits between the first writer's read of the tip and its update of the ref: made here by racing many writers
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => other.commit([{ path: `f${i}`, bytes: bytes(String(i)) }], `writer ${i}`)));
    const moved = results.filter((r) => r.kind === "err" && r.error.kind === "moved").length;
    const made = results.filter((r) => r.kind === "ok" && r.value.commit !== undefined).length;
    assertEquals(moved + made, 8, "each writer either made its commit or was told the branch moved");
    assert(made >= 1);
    assertEquals(Number(await git(dir, "rev-list", "--count", "evidence")), 1 + made, "no commit was lost or overwritten");
    assertEquals((await store.list("")).length, 1 + made);
  });
}, skip);

proves(["0013-grc-gitref FR-005"], "files are read, listed and followed through the history from the branch, and the state at an instant is the newest commit at or before it", async () => {
  await withRepo(async (_dir, store) => {
    const at = ["2026-12-01T10:00:00Z", "2026-12-01T11:00:00Z", "2026-12-01T12:00:00Z"];
    const c1 = await store.commit([{ path: "state/a.json", bytes: bytes("v1") }, { path: "journal/a/1.jsonl", bytes: bytes("j1") }], "one", at[0]);
    const c2 = await store.commit([{ path: "journal/a/1.jsonl", bytes: bytes("j1\nj2") }], "two: journal", at[1]);
    const c3 = await store.commit([{ path: "state/a.json", bytes: bytes("v2") }], "three", at[2]);
    assert(c1.kind === "ok" && c2.kind === "ok" && c3.kind === "ok");
    const [h1, h2, h3] = [c1.value.commit, c2.value.commit, c3.value.commit];
    assertEquals(await store.head(), h3);
    assertEquals(await store.list("state"), ["state/a.json"]);
    assertEquals(await store.list(""), ["journal/a/1.jsonl", "state/a.json"]);
    assertEquals(await store.list("nowhere"), []);
    assertEquals(text(await store.read("state/a.json", h1)), "v1");
    assertEquals(text(await store.read("state/a.json")), "v2");
    assertEquals(await store.read("state/none.json"), undefined);
    assertEquals((await store.history("state/a.json")).map((r) => [r.commit, r.at, r.subject]), [[h3, "2026-12-01T12:00:00.000Z", "three"], [h1, "2026-12-01T10:00:00.000Z", "one"]]);
    assertEquals(await store.at("2026-12-01T09:59:59Z"), undefined);
    assertEquals(await store.at("2026-12-01T10:00:00Z"), h1, "the second itself is included");
    assertEquals(await store.at("2026-12-01T10:30:00Z"), h1);
    assertEquals(await store.at("2026-12-01T11:00:00Z"), h2);
    assertEquals(await store.at("2027-01-01T00:00:00Z"), h3);
    assertEquals(await store.at("yesterday"), undefined);
    const none = gitRefStore({ repo: _dir, branch: "nothing-here", identity: ID });
    assertEquals([await none.head(), await none.list(""), await none.history("x"), await none.at("2026-12-01T10:00:00Z"), await none.read("x")], [undefined, [], [], undefined, undefined]);
  });
}, skip);

proves(["0013-grc-gitref FR-006"], "the branch and only it is pushed, and a remote that has moved is refused and not forced", async () => {
  await fs.withTempDir(async (root) => {
    const remote = path.join(root, "remote.git");
    const a = path.join(root, "a");
    const b = path.join(root, "b");
    await fs.mkdir(a, { recursive: true });
    await fs.mkdir(b, { recursive: true });
    await git(root, "init", "-q", "--bare", remote);
    for (const d of [a, b]) {
      await git(d, "init", "-q", "-b", "main");
      await git(d, "remote", "add", "origin", remote);
    }
    await fs.writeTextFile(path.join(a, "x.txt"), "x\n");
    await git(a, "add", "x.txt");
    await git(a, "commit", "-q", "-m", "main work");
    const sa = gitRefStore({ repo: a, branch: "evidence", identity: ID });
    const sb = gitRefStore({ repo: b, branch: "evidence", identity: ID });
    await sa.commit([{ path: "s", bytes: bytes("1") }], "a one");
    assertEquals((await sa.push("origin")).kind, "ok");
    assertEquals((await git(remote, "branch", "--list")).replace(/\s+/g, " ").trim(), "evidence", "main was not pushed");
    await sb.commit([{ path: "s", bytes: bytes("other") }], "b one");
    const rejected = await sb.push("origin");
    assert(rejected.kind === "err" && rejected.error.kind === "git", "a remote that moved is refused");
    assertEquals(await git(remote, "log", "-1", "--format=%s", "evidence"), "a one", "and the remote was not overwritten");
    assertEquals((await sa.push("nowhere")).kind, "err");
  });
}, skip);
