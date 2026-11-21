/**
 * Tests of the store of a working tree (commons anyfs-git 0004-git-worktree FR-001 to FR-005), in real repositories in temporary folders: the folder of Git is never a path, links and odd names are not objects,
 * a commit takes the paths asked for by the identity the program gives, something a person has staged is never taken, hooks are not run unless asked, and a commit of nothing is no commit.
 *
 * @module
 */
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { type Cursor, expectAbsent, expectAny, expectRev, parsePrefix, ROOT } from "@intellectual-frontiers/anyfs/governance";
import { gitWorktreeStore, parseIdentity, parseTrailer } from "../src/mod.ts";
import { bytes, fs as tfs, git, osPath, p, text, who, withRepo } from "./kit.ts";

type Opts = Parameters<typeof gitWorktreeStore>[0];

async function worktree(dir: string, extra: Partial<Opts> = {}) {
  const r = await gitWorktreeStore({ dir, commit: { author: who, clock: () => Date.UTC(2026, 2, 3, 4, 5, 6) }, ...extra });
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

const ok = <T>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: unknown }, what: string): T => {
  if (r.kind === "err") throw new Error(`${what}: ${JSON.stringify(r.error)}`);
  return r.value;
};

proves(["0004-git-worktree FR-001"], "the store holds the files below a folder as the store in a folder does, and the folder of Git, links, the files the store makes and names not in their normal form are never paths", async () => {
  await withRepo("worktree", async (dir) => {
    const wt = await worktree(dir);
    const first = ok(await wt.store.write(p("fleet/a.json"), bytes("{}"), expectAbsent), "write");
    assertEquals(text(ok(await wt.store.read(p("fleet/a.json")), "read").bytes), "{}");
    // compare-and-write and rename, as in a folder
    const again = await wt.store.write(p("fleet/a.json"), bytes("x"), expectAbsent);
    assert(again.kind === "err" && again.error.kind === "conflict");
    ok(await wt.store.write(p("fleet/a.json"), bytes("[]"), expectRev(first.rev)), "write at revision");
    ok(await wt.store.rename(p("fleet/a.json"), p("fleet/b.json"), expectAny), "rename");
    // what is on the disk and is not an object of the store
    await tfs.symlink("work.txt", osPath.join(dir, "link"));
    await tfs.mkdir(osPath.join(dir, "empty-folder"));
    await tfs.writeTextFile(osPath.join(dir, ".anyfs-leftover"), "x");
    await tfs.mkdir(osPath.join(dir, "dec"));
    await tfs.writeTextFile(osPath.join(dir, "dec", "é.txt"), "x");
    const listed = ok(await wt.store.list(ROOT), "list").entries.map((e) => e.path);
    assertEquals(listed, [p("fleet/b.json"), p("work.txt")]);
    // the folder of Git cannot be named
    for (const name of [".git/config", ".git/HEAD", "x/.GIT/y"]) {
      const r = await wt.store.read(p(name));
      assert(r.kind === "err" && r.error.kind === "refused", `${name} is refused`);
      assertEquals((await wt.store.write(p(name), bytes("x"), expectAny)).kind, "err");
    }
    assertEquals(ok(await wt.store.list(ok(parsePrefix("fleet"), "prefix")), "list").entries.map((e) => e.path), [p("fleet/b.json")]);
    // a store of a folder
    const part = await worktree(dir, { prefix: ok(parsePrefix("fleet"), "prefix") });
    assertEquals(ok(await part.store.list(ROOT), "list").entries.map((e) => e.path), [p("b.json")]);
    assertEquals(wt.store.consistency, "strong");
    assertEquals(wt.store.place.kind, "git");
    // pages: fifteen files, five at a time
    for (let i = 0; i < 15; i++) ok(await wt.store.write(p(`pg/${String(i).padStart(2, "0")}`), bytes(String(i)), expectAny), "seed");
    const seen: string[] = [];
    let after: Cursor | undefined;
    for (let pages = 0; pages < 10; pages++) {
      const page = ok(await wt.store.list(ok(parsePrefix("pg"), "prefix"), after === undefined ? { limit: 5 } : { limit: 5, after }), "page");
      seen.push(...page.entries.map((e) => e.path));
      if (page.next === undefined) break;
      assertEquals(page.entries.length, 5);
      after = page.next;
    }
    assertEquals(seen.length, 15);
    assertEquals(seen, seen.toSorted());
  });
  // a repository with no working tree has no such store
  await withRepo("bare", async (dir) => {
    const r = await gitWorktreeStore({ dir, commit: { author: who } });
    assertEquals(r.kind, "err");
  });
});

proves(["0004-git-worktree FR-002"], "a commit takes the paths asked for, or every changed path below the folder, by the identity and the clock the program gives, whatever the configuration of the computer says", async () => {
  await withRepo("worktree", async (dir) => {
    await git(dir, "config", "user.name", "Someone Else");
    await git(dir, "config", "user.email", "else@example.test");
    const committer = parseIdentity("Second Person", "second@example.test");
    const trailer = parseTrailer("Refs", "#21");
    assert(committer.kind === "ok" && trailer.kind === "ok");
    if (committer.kind !== "ok" || trailer.kind !== "ok") return;
    const wt = await worktree(dir, { commit: { author: who, committer: committer.value, trailers: [trailer.value], clock: () => Date.UTC(2026, 2, 3, 4, 5, 6) } });
    ok(await wt.store.write(p("one"), bytes("1"), expectAny), "write");
    ok(await wt.store.write(p("two"), bytes("2"), expectAny), "write");
    const only = ok(await wt.commit({ paths: [p("one")], dirty: "allow" }), "commit one");
    assertEquals(only.paths, [p("one")]);
    assert(only.commit !== undefined);
    assertEquals((await git(dir, "show", "--name-only", "--format=", "HEAD")).trim(), "one");
    const raw = await git(dir, "cat-file", "-p", "HEAD");
    assert(raw.includes("author Fleet Collector <collector@example.test> 1772510706 +0000"), raw);
    assert(raw.includes("committer Second Person <second@example.test> 1772510706 +0000"), raw);
    assert(raw.includes("anyfs: write one\n\nRefs: #21"), raw);
    // every changed path below the folder, a deletion included
    ok(await wt.store.delete(p("work.txt"), expectAny), "delete");
    const all = ok(await wt.commit(), "commit all");
    assertEquals(all.paths.toSorted(), [p("two"), p("work.txt")]);
    assertEquals((await git(dir, "status", "--porcelain=v1")).trim(), "");
    assertEquals((await git(dir, "log", "--format=%s", "-n1")).trim(), "anyfs: 2 changes");
    // a store of a folder commits the paths below the folder
    ok(await wt.store.write(p("fleet/x"), bytes("x"), expectAny), "write");
    ok(await wt.store.write(p("outside"), bytes("o"), expectAny), "write");
    const part = await worktree(dir, { prefix: ok(parsePrefix("fleet"), "prefix") });
    const took = ok(await part.commit({ dirty: "allow" }), "commit of the folder");
    assertEquals(took.paths, [p("x")]);
    assertEquals((await git(dir, "show", "--name-only", "--format=", "HEAD")).trim(), "fleet/x");
    assertEquals((await git(dir, "status", "--porcelain=v1")).trim(), "?? outside");
  });
});

proves(["0004-git-worktree FR-003"], "where something the commit was not asked to take has changed it is refused with the paths, or takes only what it was asked, and it never takes what a person has staged", async () => {
  await withRepo("worktree", async (dir) => {
    const wt = await worktree(dir);
    await tfs.writeTextFile(osPath.join(dir, "persons.txt"), "staged by a person\n");
    await git(dir, "add", "persons.txt");
    ok(await wt.store.write(p("mine"), bytes("m"), expectAny), "write");
    const refused = await wt.commit({ paths: [p("mine")] });
    assert(refused.kind === "err" && refused.error.kind === "dirty" && refused.error.paths.includes("persons.txt"), "refused with the path");
    assertEquals((await git(dir, "log", "--format=%s")).trim(), "first");
    const allowed = ok(await wt.commit({ paths: [p("mine")], dirty: "allow" }), "commit");
    assertEquals(allowed.paths, [p("mine")]);
    assertEquals((await git(dir, "show", "--name-only", "--format=", "HEAD")).trim(), "mine");
    assertEquals((await git(dir, "status", "--porcelain=v1")).trim(), "A  persons.txt", "the person's staging is as it was");
    // a commit of a folder refuses a change outside it
    const part = await worktree(dir, { prefix: ok(parsePrefix("fleet"), "prefix") });
    ok(await part.store.write(p("y"), bytes("y"), expectAny), "write");
    const outside = await part.commit();
    assert(outside.kind === "err" && outside.error.kind === "dirty", "a change outside the folder");
    // a path that is the folder of Git is not committed
    const bad = await wt.commit({ paths: [p("work.txt/.git")], dirty: "allow" }).catch(() => undefined);
    assert(bad !== undefined && bad.kind === "err");
  });
});

proves(["0004-git-worktree FR-004"], "a commit runs no hook and no signature unless the hooks are asked for", async () => {
  await withRepo("worktree", async (dir) => {
    const mark = osPath.join(dir, "hook-ran");
    for (const name of ["pre-commit", "commit-msg"]) {
      await tfs.writeTextFile(osPath.join(dir, ".git", "hooks", name), `#!/bin/sh\necho ${name} >> ${JSON.stringify(mark)}\nexit 1\n`, { mode: 0o755 });
    }
    await git(dir, "config", "commit.gpgsign", "true");
    await git(dir, "config", "gpg.program", "/nonexistent/gpg");
    const wt = await worktree(dir);
    ok(await wt.store.write(p("a"), bytes("a"), expectAny), "write");
    ok(await wt.commit(), "commit with the hooks off");
    assertEquals(await tfs.exists(mark), false, "no hook ran");
    assertEquals((await git(dir, "cat-file", "-p", "HEAD")).includes("gpgsig"), false);
    // asked for, the hooks run, and a hook that fails stops the commit
    ok(await wt.store.write(p("b"), bytes("b"), expectAny), "write");
    const stopped = await wt.commit({ hooks: true });
    assert(stopped.kind === "err" && stopped.error.kind === "git");
    assertEquals(await tfs.exists(mark), true, "the hook ran");
  });
});

proves(["0004-git-worktree FR-005"], "a commit with nothing changed makes no commit and says so", async () => {
  await withRepo("worktree", async (dir) => {
    const wt = await worktree(dir);
    const before = (await git(dir, "rev-parse", "HEAD")).trim();
    const none = ok(await wt.commit(), "commit of nothing");
    assertEquals([none.commit, none.paths], [undefined, []]);
    ok(await wt.store.write(p("a"), bytes("a"), expectAny), "write");
    ok(await wt.commit(), "commit");
    ok(await wt.store.write(p("a"), bytes("a"), expectAny), "the same bytes");
    const again = ok(await wt.commit({ paths: [p("a")] }), "commit of the same");
    assertEquals(again.commit, undefined);
    assert((await git(dir, "rev-parse", "HEAD")).trim() !== before);
    assertEquals((await git(dir, "rev-list", "--count", "HEAD")).trim(), "2");
  });
});
