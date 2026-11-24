/**
 * Tests of push and fetch (commons anyfs-git 0005-git-remote FR-001 to FR-003), between bare repositories in temporary folders: only the branch is pushed, never forced, a remote that has moved is refused and keeps
 * the other writer's commit, a fetch fast-forwards and leaves a branch that has diverged as it is, and the name of a remote is checked before Git sees it.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { expectAny } from "@intellectual-frontiers/anyfs/governance";
import { remoteProblem } from "../src/mod.ts";
import { bytes, fs as tfs, git, p, refIn, text, withRepo } from "./kit.ts";

const ok = <T>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: unknown }, what: string): T => {
  if (r.kind === "err") throw new Error(`${what}: ${JSON.stringify(r.error)}`);
  return r.value;
};

async function three<T>(use: (remote: string, a: string, b: string) => Promise<T>): Promise<T> {
  return withRepo("bare", (remote) => withRepo("bare", (a) => withRepo("bare", (b) => use(remote, a, b))));
}

proves(["0005-git-remote FR-001"], "a push sends the branch and no other, is never forced, and a remote that has commits the branch lacks refuses it and keeps them", async () => {
  await three(async (remote, aDir, bDir) => {
    const a = await refIn(aDir);
    ok(await a.store.write(p("x"), bytes("1"), expectAny), "write");
    // another branch of the repository is not sent
    await git(aDir, "branch", "private", "fleet");
    const pushed = ok(await a.push(remote), "push");
    assertEquals(pushed.tip, (await git(aDir, "rev-parse", "fleet")).trim());
    assertEquals((await git(remote, "rev-parse", "fleet")).trim(), pushed.tip);
    assertEquals((await git(remote, "branch", "--list")).includes("private"), false);
    // a second push of the same tip changes nothing
    ok(await a.push(remote), "push again");
    // another writer made their own history on the same branch name and pushes first
    const b = await refIn(bDir);
    ok(await b.store.write(p("y"), bytes("theirs"), expectAny), "write");
    const refused = await b.push(remote);
    assert(refused.kind === "err" && refused.error.kind === "rejected", "a remote that has moved is refused");
    assertEquals((await git(remote, "rev-parse", "fleet")).trim(), pushed.tip, "the remote keeps what it had");
    // a branch with no commit has nothing to push
    const empty = await refIn(aDir, "nothing-yet");
    const none = await empty.push(remote);
    assert(none.kind === "err" && none.error.kind === "no-branch");
    // a remote that is not there
    const lost = await a.push(`${remote}-nowhere`);
    assert(lost.kind === "err" && lost.error.kind === "failed");
  });
});

proves(["0005-git-remote FR-002"], "a fetch makes the branch, fast-forwards it, says where the store is ahead, and leaves a branch that has diverged as it is", async () => {
  await three(async (remote, aDir, bDir) => {
    const a = await refIn(aDir);
    const b = await refIn(bDir);
    ok(await a.store.write(p("one"), bytes("1"), expectAny), "write");
    ok(await a.push(remote), "push");
    // the branch is made where there was none
    const made = ok(await b.fetch(remote), "fetch");
    assertEquals(made.kind, "fast-forwarded");
    assertEquals(text(ok(await b.store.read(p("one")), "read").bytes), "1");
    assertEquals(ok(await b.fetch(remote), "fetch").kind, "up-to-date");
    // the remote moves ahead and the branch follows
    ok(await a.store.write(p("two"), bytes("2"), expectAny), "write");
    ok(await a.push(remote), "push");
    const ff = ok(await b.fetch(remote), "fetch");
    assert(ff.kind === "fast-forwarded" && ff.from !== undefined);
    assertEquals(text(ok(await b.store.read(p("two")), "read").bytes), "2");
    // the store is ahead
    ok(await b.store.write(p("three"), bytes("3"), expectAny), "write");
    assertEquals(ok(await b.fetch(remote), "fetch").kind, "ahead");
    // both moved: the branch is left as it is and the push is refused
    ok(await a.store.write(p("four"), bytes("4"), expectAny), "write");
    ok(await a.push(remote), "push");
    const bTip = (await git(bDir, "rev-parse", "fleet")).trim();
    const diverged = ok(await b.fetch(remote), "fetch");
    assertEquals(diverged.kind, "diverged");
    assertEquals((await git(bDir, "rev-parse", "fleet")).trim(), bTip, "the branch is as it was");
    const rejected = await b.push(remote);
    assert(rejected.kind === "err" && rejected.error.kind === "rejected");
    // a remote with no such branch
    const other = await refIn(bDir, "ghost");
    ok(await other.store.write(p("g"), bytes("g"), expectAny), "write");
    assertEquals(ok(await other.fetch(remote), "fetch").kind, "absent");
  });
});

proves(["0005-git-remote FR-003"], "the name of a remote is refused before Git sees it where it is an option, holds a control character or names a transport that runs a program", async () => {
  for (const bad of ["", " x", "--upload-pack=touch /tmp/pwned", "-x", "ext::sh -c touch% /tmp/pwned", "fd::17", "a\nb", "a\u0000b"]) assert(remoteProblem(bad) !== undefined, JSON.stringify(bad));
  for (const good of ["/srv/git/fleet.git", "https://example.test/fleet.git", "ssh://git@example.test/fleet.git", "origin", "file:///srv/fleet.git"]) assertEquals(remoteProblem(good), undefined, good);
  await withRepo("bare", async (dir) => {
    const ref = await refIn(dir);
    ok(await ref.store.write(p("x"), bytes("1"), expectAny), "write");
    const marker = `${dir}-pwned`;
    const pushed = await ref.push(`--upload-pack=touch ${marker}`);
    assert(pushed.kind === "err" && pushed.error.kind === "failed");
    const fetched = await ref.fetch(`ext::sh -c "touch ${marker}"`);
    assert(fetched.kind === "err");
    assertEquals(await tfs.exists(marker), false, "nothing was run");
  });
});
