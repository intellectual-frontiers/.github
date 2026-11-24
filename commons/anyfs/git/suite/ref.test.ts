/**
 * Tests of the store of a branch (commons anyfs-git 0003-git-ref FR-001 to FR-008), in real repositories in temporary folders: a revision is the digest of the bytes and Git's names are given beside it, the working
 * tree, the index and the head are never touched, concurrent writers are decided by what they expect, a batch is one commit, a history is the commits that changed a file, a branch with no commit is made with no
 * parent in a bare repository or not, links and names that cannot be held are refused, and a list is in order and in pages.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { expectAbsent, expectAny, expectRev, ROOT, parsePrefix } from "@intellectual-frontiers/anyfs/governance";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { parseIdentity, parseTrailer } from "../src/mod.ts";
import { bytes, commitsOf, fs as tfs, git, osPath, p, proc, refIn, text, who, withRepo } from "./kit.ts";

const ok = <T>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: unknown }, what: string): T => {
  if (r.kind === "err") throw new Error(`${what}: ${JSON.stringify(r.error)}`);
  return r.value;
};

proves(["0003-git-ref FR-001"], "the revision of a file is sha256 and the digest of its bytes, and Git's names for the blob, the mode and the newest commit are given beside it", async () => {
  await withRepo("bare", async (dir) => {
    const ref = await refIn(dir);
    const w = ok(await ref.store.write(p("a/b.txt"), bytes("hello"), expectAny), "write");
    assertEquals(w.rev, `sha256:${await sha256(bytes("hello"))}`);
    const r = ok(await ref.store.read(p("a/b.txt")), "read");
    assertEquals([text(r.bytes), r.rev], ["hello", w.rev]);
    const s = ok(await ref.store.stat(p("a/b.txt")), "stat");
    assertEquals([s.size, s.rev], [5, w.rev]);
    const info = ok(await ref.info(p("a/b.txt")), "info");
    const blob = (await git(dir, "rev-parse", "fleet:a/b.txt")).trim();
    assertEquals([info.blob, info.mode, info.size, info.rev, info.commit], [blob, "100644", 5, w.rev, (await git(dir, "rev-parse", "fleet")).trim()]);
    // the same bytes elsewhere are the same revision
    const w2 = ok(await ref.store.write(p("other"), bytes("hello"), expectAny), "write");
    assertEquals(w2.rev, w.rev);
  });
});

proves(["0003-git-ref FR-002"], "a store of a branch never changes the working tree, the index or the head, and a branch that is checked out is refused unless the caller allows it", async () => {
  await withRepo("worktree", async (dir) => {
    // a person's work: a changed file, a staged file and a file Git does not track
    await tfs.writeTextFile(osPath.join(dir, "work.txt"), "changed\n");
    await tfs.writeTextFile(osPath.join(dir, "staged.txt"), "staged\n");
    await git(dir, "add", "staged.txt");
    await tfs.writeTextFile(osPath.join(dir, "loose.txt"), "loose\n");
    const look = async (): Promise<readonly string[]> => [await git(dir, "status", "--porcelain=v1"), await git(dir, "rev-parse", "HEAD"), await git(dir, "symbolic-ref", "HEAD"), await git(dir, "ls-files", "-s"), await tfs.readTextFile(osPath.join(dir, "work.txt"))];
    const before = await look();
    const ref = await refIn(dir);
    ok(await ref.store.write(p("state/one.json"), bytes("{}"), expectAny), "write");
    ok(await ref.store.batch([{ kind: "put", path: p("state/two.json"), bytes: bytes("[]"), expect: expectAny }, { kind: "delete", path: p("state/one.json"), expect: expectAny }]), "batch");
    ok(await ref.store.delete(p("state/two.json"), expectAny), "delete");
    assertEquals(await look(), before);
    assertEquals((await git(dir, "branch", "--list", "fleet")).includes("fleet"), true);
    // the branch that is checked out is refused
    const opened = await import("../src/mod.ts").then((m) => m.gitRefStore({ repo: dir, branch: "main", commit: { author: who } }));
    assertEquals(opened.kind, "err");
    assert(opened.kind === "err" && opened.error.includes("checked out"));
    const allowed = await import("../src/mod.ts").then((m) => m.gitRefStore({ repo: dir, branch: "main", commit: { author: who }, allowCheckedOut: true }));
    assertEquals(allowed.kind, "ok");
    // a branch checked out in another working tree is refused too
    await git(dir, "branch", "elsewhere");
    const other = await tfs.makeTempDir({ prefix: "anyfs-git-wt-" });
    try {
      await git(dir, "worktree", "add", "-q", osPath.join(other, "wt"), "elsewhere");
      const refused = await import("../src/mod.ts").then((m) => m.gitRefStore({ repo: dir, branch: "elsewhere", commit: { author: who } }));
      assertEquals(refused.kind, "err");
    } finally {
      await tfs.remove(other, { recursive: true }).catch(() => undefined);
    }
  });
});

proves(["0003-git-ref FR-003"], "writers are decided by what they expect: two who expect the same revision cannot both win, writers of different files all win, and no commit is lost", async () => {
  await withRepo("bare", async (dir) => {
    const a = await refIn(dir);
    const b = await refIn(dir);
    const first = ok(await a.store.write(p("shared"), bytes("v0"), expectAbsent), "write");
    const race = await Promise.all([a.store.write(p("shared"), bytes("from a"), expectRev(first.rev)), b.store.write(p("shared"), bytes("from b"), expectRev(first.rev))]);
    const wins = race.filter((r) => r.kind === "ok");
    const lost = race.filter((r) => r.kind === "err");
    assertEquals([wins.length, lost.length], [1, 1]);
    const loser = lost[0];
    assert(loser?.kind === "err" && loser.error.kind === "conflict");
    // a write that expects no object is a conflict where the object is there
    const again = await b.store.write(p("shared"), bytes("x"), expectAbsent);
    assert(again.kind === "err" && again.error.kind === "conflict");
    // twelve writers of twelve files, at once, all win and every commit is kept
    const before = await commitsOf(dir, "fleet");
    const many = await Promise.all(Array.from({ length: 12 }, (_, i) => (i % 2 === 0 ? a : b).store.write(p(`many/${i}`), bytes(`n${i}`), expectAny)));
    assertEquals(many.filter((r) => r.kind === "ok").length, 12);
    assertEquals(await commitsOf(dir, "fleet"), before + 12);
  });
  // a branch that is moved by another process between the read and the move is read again: the other writer's commit is kept and the change is made on it, or is a conflict where the other writer changed the same file
  await withRepo("bare", async (dir) => {
    const seed = await refIn(dir);
    const first = ok(await seed.store.write(p("shared"), bytes("v0"), expectAbsent), "seed");
    const wrapper = async (name: string, other: string): Promise<string> => {
      const script = osPath.join(dir, `${name}.sh`);
      const mark = osPath.join(dir, `${name}.mark`);
      await tfs.writeTextFile(
        script,
        `#!/bin/sh\nfor a in "$@"; do\n  if [ "$a" = update-ref ] && [ ! -e "${mark}" ]; then\n    touch "${mark}"\n    export GIT_AUTHOR_NAME=o GIT_AUTHOR_EMAIL=o@example.test GIT_COMMITTER_NAME=o GIT_COMMITTER_EMAIL=o@example.test\n    ${other}\n  fi\ndone\nexec git "$@"\n`,
        { mode: 0o755 },
      );
      return script;
    };
    const g = `git --git-dir=${JSON.stringify(dir)}`;
    const moveOnly = await wrapper("move-only", `tip=$(${g} rev-parse refs/heads/fleet); c=$(${g} commit-tree "$(${g} rev-parse "$tip^{tree}")" -p "$tip" -m other); ${g} update-ref refs/heads/fleet "$c" "$tip"`);
    const patient = await refIn(dir, "fleet", { program: moveOnly });
    const before = await commitsOf(dir, "fleet");
    const moved = ok(await patient.store.write(p("mine"), bytes("m"), expectAbsent), "write after a move");
    assertEquals(moved.created, true);
    assertEquals(await commitsOf(dir, "fleet"), before + 2, "the other writer's commit is kept and ours is on it");
    // the other writer changed the very file this one expects to be as it read it
    const changeShared = await wrapper(
      "change-shared",
      `blob=$(printf 'theirs' | ${g} hash-object -w --stdin); tip=$(${g} rev-parse refs/heads/fleet); idx=$(mktemp -u); GIT_INDEX_FILE=$idx GIT_WORK_TREE=$(dirname "$idx") ${g} read-tree "$tip"; GIT_INDEX_FILE=$idx GIT_WORK_TREE=$(dirname "$idx") ${g} update-index --add --cacheinfo 100644,$blob,shared; tree=$(GIT_INDEX_FILE=$idx GIT_WORK_TREE=$(dirname "$idx") ${g} write-tree); rm -f "$idx"; c=$(${g} commit-tree "$tree" -p "$tip" -m theirs); ${g} update-ref refs/heads/fleet "$c" "$tip"`,
    );
    const loser = await refIn(dir, "fleet", { program: changeShared });
    const lost = await loser.store.write(p("shared"), bytes("ours"), expectRev(first.rev));
    assert(lost.kind === "err" && lost.error.kind === "conflict", "the change that expected the old file is a conflict");
    assertEquals(text(ok(await seed.store.read(p("shared")), "read").bytes), "theirs", "the other writer's file is as they made it");
    // a branch that keeps moving ends as a retryable failure, and nothing is made
    const alwaysMoving = osPath.join(dir, "always.sh");
    await tfs.writeTextFile(
      alwaysMoving,
      `#!/bin/sh\nfor a in "$@"; do\n  if [ "$a" = update-ref ]; then\n    export GIT_AUTHOR_NAME=o GIT_AUTHOR_EMAIL=o@example.test GIT_COMMITTER_NAME=o GIT_COMMITTER_EMAIL=o@example.test\n    tip=$(${g} rev-parse refs/heads/fleet); c=$(${g} commit-tree "$(${g} rev-parse "$tip^{tree}")" -p "$tip" -m again); ${g} update-ref refs/heads/fleet "$c" "$tip"\n  fi\ndone\nexec git "$@"\n`,
      { mode: 0o755 },
    );
    const hopeless = await refIn(dir, "fleet", { program: alwaysMoving, attempts: 3 });
    const failed = await hopeless.store.write(p("never"), bytes("x"), expectAny);
    assert(failed.kind === "err" && failed.error.kind === "unavailable" && failed.error.retryable, "a branch that keeps moving is retryable");
    assertEquals((await seed.store.read(p("never"))).kind, "err");
  });
});

proves(["0003-git-ref FR-004"], "a batch is one commit with every change, each checked against the changes before it, all or none, and a change that changes nothing is no commit", async () => {
  await withRepo("bare", async (dir) => {
    const ref = await refIn(dir);
    const done = ok(
      await ref.store.batch([
        { kind: "put", path: p("b/one"), bytes: bytes("1"), expect: expectAbsent },
        { kind: "put", path: p("b/two"), bytes: bytes("2"), expect: expectAbsent },
        { kind: "put", path: p("b/three"), bytes: bytes("3"), expect: expectAny },
      ]),
      "batch",
    );
    assertEquals(done.results.map((r) => r.kind), ["put", "put", "put"]);
    assertEquals(await commitsOf(dir, "fleet"), 1);
    assertEquals((await git(dir, "show", "--stat", "--format=", "fleet")).split("\n").filter((l) => l.includes("|")).length, 3);
    // the later change sees the earlier: a put and then a put that expects its revision
    const rev1 = ok(await ref.store.read(p("b/one")), "read").rev;
    const chained = await ref.store.batch([
      { kind: "put", path: p("b/one"), bytes: bytes("1b"), expect: expectRev(rev1) },
      { kind: "delete", path: p("b/two"), expect: expectAny },
    ]);
    ok(chained, "chained");
    assertEquals(await commitsOf(dir, "fleet"), 2);
    // none: the second change conflicts, so nothing is made
    const failed = await ref.store.batch([
      { kind: "put", path: p("b/new"), bytes: bytes("n"), expect: expectAny },
      { kind: "put", path: p("b/one"), bytes: bytes("again"), expect: expectRev(rev1) },
    ]);
    assert(failed.kind === "err" && failed.error.kind === "conflict");
    assertEquals(await commitsOf(dir, "fleet"), 2);
    assertEquals((await ref.store.stat(p("b/new"))).kind, "err");
    // no change, no commit
    const same = ok(await ref.store.write(p("b/three"), bytes("3"), expectAny), "same bytes");
    assertEquals(same.created, false);
    ok(await ref.store.delete(p("b/never-was"), expectAny), "delete of nothing");
    ok(await ref.store.batch([]), "empty batch");
    assertEquals(await commitsOf(dir, "fleet"), 2);
  });
});

proves(["0003-git-ref FR-005"], "a history is the commits that changed the file, newest first, with who made them, and a file that is not at the tip has none", async () => {
  await withRepo("bare", async (dir) => {
    let now = Date.UTC(2026, 5, 1, 10, 0, 0);
    const committer = parseIdentity("Second Person", "second@example.test");
    const trailer = parseTrailer("Refs", "#21");
    assert(committer.kind === "ok" && trailer.kind === "ok");
    if (committer.kind !== "ok" || trailer.kind !== "ok") return;
    const ref = await refIn(dir, "fleet", {
      commit: { author: who, committer: committer.value, trailers: [trailer.value], subject: (c) => `fleet: ${c.length} change`, clock: () => (now += 60_000) },
    });
    ok(await ref.store.write(p("f"), bytes("one"), expectAny), "1");
    ok(await ref.store.write(p("g"), bytes("other file"), expectAny), "other");
    ok(await ref.store.write(p("f"), bytes("two three"), expectAny), "2");
    ok(await ref.store.write(p("f"), bytes("four"), expectAny), "3");
    const h = ok(await ref.store.history(p("f")), "history");
    assertEquals(h.versions.map((v) => v.size), [4, 9, 3]);
    assertEquals(h.versions.map((v) => v.rev), [await rev("four"), await rev("two three"), await rev("one")]);
    assertEquals(h.versions[0]?.modified, "2026-06-01T10:04:00.000Z");
    const log = ok(await ref.log(p("f")), "log");
    assertEquals(log.length, 3);
    assertEquals(log[0]?.author, { name: "Fleet Collector", email: "collector@example.test" });
    assertEquals(log[0]?.subject, "fleet: 1 change");
    assertEquals(log[0]?.rev, await rev("four"));
    const raw = await git(dir, "cat-file", "-p", "fleet");
    assertStringIncludes(raw, "author Fleet Collector <collector@example.test>");
    assertStringIncludes(raw, "committer Second Person <second@example.test>");
    assertStringIncludes(raw, "\n\nfleet: 1 change\n\nRefs: #21\n");
    // a deletion is a commit of the log with no revision, and a deleted file has no history
    ok(await ref.store.delete(p("f"), expectAny), "delete");
    const gone = await ref.store.history(p("f"));
    assert(gone.kind === "err" && gone.error.kind === "missing");
    const limited = ok(await ref.store.history(p("g"), 1), "limited");
    assertEquals(limited.versions.length, 1);
  });
});

const rev = async (t: string): Promise<string> => `sha256:${await sha256(bytes(t))}`;

proves(["0003-git-ref FR-006"], "a branch with no commit reads as empty and is made by the first write with no parent, in a bare repository and in one that is not, and a branch name may have folders", async () => {
  for (const kind of ["bare", "worktree"] as const) {
    await withRepo(kind, async (dir) => {
      const ref = await refIn(dir, "fleet/state");
      assertEquals(ok(await ref.tip(), "tip"), undefined);
      assertEquals(ok(await ref.store.list(ROOT), "list").entries, []);
      const m = await ref.store.read(p("x"));
      assert(m.kind === "err" && m.error.kind === "missing");
      ok(await ref.store.write(p("x"), bytes("1"), expectAbsent), "write");
      assertEquals((await git(dir, "rev-list", "--parents", "-n1", "fleet/state")).trim().split(" ").length, 1, "a root commit has no parent");
      assertEquals(text(ok(await ref.store.read(p("x")), "read").bytes), "1");
    });
  }
  await withRepo("bare", async (dir) => {
    const bad = await import("../src/mod.ts").then((m) => m.gitRefStore({ repo: dir, branch: "bad..name", commit: { author: who } }));
    assertEquals(bad.kind, "err");
    const dash = await import("../src/mod.ts").then((m) => m.gitRefStore({ repo: dir, branch: "-x", commit: { author: who } }));
    assertEquals(dash.kind, "err");
    const none = await import("../src/mod.ts").then((m) => m.gitRefStore({ repo: "/nonexistent-anyfs-git", branch: "x", commit: { author: who } }));
    assertEquals(none.kind, "err");
  });
});

proves(["0003-git-ref FR-007"], "links and other repositories are refused and left out of a list, a file and a folder of one name are refused, names Git reads specially are refused, and an object over the limit is refused", async () => {
  await withRepo("worktree", async (dir) => {
    // a branch that holds a file, a symbolic link and a link to another repository, made the way a person would
    await git(dir, "checkout", "-q", "--orphan", "fleet");
    await git(dir, "rm", "-rfq", ".");
    await tfs.writeTextFile(osPath.join(dir, "real.txt"), "real\n");
    await tfs.symlink("real.txt", osPath.join(dir, "link"));
    await tfs.mkdir(osPath.join(dir, "dir"));
    await tfs.writeTextFile(osPath.join(dir, "dir", "inside.txt"), "inside\n");
    await git(dir, "add", "-A");
    const sub = (await git(dir, "rev-parse", "main")).trim();
    await git(dir, "update-index", "--add", "--cacheinfo", `160000,${sub},module`);
    await git(dir, "commit", "-q", "-m", "mixed");
    await git(dir, "checkout", "-q", "main");
    const ref = await refIn(dir, "fleet", { maxObjectBytes: 100 });
    const listed = ok(await ref.store.list(ROOT), "list").entries.map((e) => e.path);
    assertEquals(listed, [p("dir/inside.txt"), p("real.txt")]);
    for (const name of ["link", "module"]) {
      const r = await ref.store.read(p(name));
      assert(r.kind === "err" && r.error.kind === "refused" && r.error.reason === "outside-scope", `${name} is refused`);
      assertEquals((await ref.store.write(p(name), bytes("x"), expectAny)).kind, "err");
      assertEquals((await ref.store.delete(p(name), expectAny)).kind, "err");
    }
    // a file where a folder is, and a folder where a file is
    const onFolder = await ref.store.write(p("dir"), bytes("x"), expectAny);
    assert(onFolder.kind === "err" && onFolder.error.kind === "refused" && onFolder.error.reason === "unportable-path");
    const underFile = await ref.store.write(p("real.txt/below"), bytes("x"), expectAny);
    assert(underFile.kind === "err" && underFile.error.kind === "refused");
    const clash = await ref.store.batch([{ kind: "put", path: p("n/a"), bytes: bytes("1"), expect: expectAny }, { kind: "put", path: p("n"), bytes: bytes("2"), expect: expectAny }]);
    assertEquals(clash.kind, "err");
    // the folder of Git itself, in every spelling, and names Windows cannot hold
    for (const bad of [".git/config", "a/.GIT/hooks/x", "a/git~1/x", "con", "a/b."]) {
      const r = await ref.store.write(p(bad), bytes("x"), expectAny);
      assert(r.kind === "err" && r.error.kind === "refused" && r.error.reason === "unportable-path", `${bad} is refused`);
    }
    // a limit
    const big = await ref.store.write(p("big"), new Uint8Array(101), expectAny);
    assert(big.kind === "err" && big.error.kind === "refused" && big.error.reason === "too-large");
    assertStringIncludes(big.kind === "err" && big.error.kind === "refused" ? big.error.detail : "", "100");
    assertEquals(ref.store.traits.maxObject, 100);
    assertEquals((await ref.store.write(p("fits"), new Uint8Array(100), expectAny)).kind, "ok");
    // portability can be turned off
    const lax = await refIn(dir, "lax", { portable: false });
    assertEquals((await lax.store.write(p("a:b"), bytes("x"), expectAny)).kind, "ok");
    assertEquals((await lax.store.write(p(".git/x"), bytes("x"), expectAny)).kind, "err", "the folder of Git is never held");
  });
});

proves(["0003-git-ref FR-008"], "a list gives the files below a prefix in order, in pages with a cursor, with their revisions, a name that is not in its normal form is not listed, and a rename is one commit that keeps the file", async () => {
  await withRepo("bare", async (dir) => {
    const ref = await refIn(dir);
    const names = Array.from({ length: 25 }, (_, i) => `page/${String(i).padStart(2, "0")}`);
    ok(await ref.store.batch(names.map((n) => ({ kind: "put" as const, path: p(n), bytes: bytes(n), expect: expectAny }))), "seed");
    ok(await ref.store.write(p("other/x"), bytes("x"), expectAny), "other");
    const seen: string[] = [];
    let after: Parameters<typeof ref.store.list>[1] extends infer O ? (O extends { after?: infer A } ? A : never) : never = undefined as never;
    let pages = 0;
    for (;;) {
      const page = ok(await ref.store.list(ok(parsePrefix("page"), "prefix"), after === undefined ? { limit: 10 } : { limit: 10, after }), "page");
      pages++;
      seen.push(...page.entries.map((e) => e.path));
      for (const e of page.entries) assertEquals(e.rev, await rev(e.path));
      if (page.next === undefined) break;
      assertEquals(page.entries.length, 10);
      after = page.next;
    }
    assertEquals([pages, seen], [3, names]);
    // names with glob characters and magic are read as they are written (on a store that does not refuse the names Windows reserves)
    const lax = await refIn(dir, "fleet", { portable: false });
    ok(await lax.store.write(p("g/a*b"), bytes("star"), expectAny), "star");
    ok(await lax.store.write(p("g/axb"), bytes("x"), expectAny), "x");
    ok(await lax.store.write(p("g/[1]"), bytes("bracket"), expectAny), "bracket");
    ok(await lax.store.write(p(":(top)y"), bytes("magic"), expectAny), "magic");
    assertEquals(text(ok(await lax.store.read(p("g/a*b")), "read").bytes), "star");
    assertEquals(text(ok(await lax.store.read(p("g/axb")), "read").bytes), "x");
    assertEquals(text(ok(await lax.store.read(p(":(top)y")), "read").bytes), "magic");
    assertEquals(ok(await lax.store.list(ok(parsePrefix("g"), "prefix")), "list").entries.map((e) => e.path), [p("g/[1]"), p("g/a*b"), p("g/axb")]);
    // a name that is not text in its normal form (a letter and a combining accent) is not an object of the store
    const decomposed = "dec/é.txt";
    const blob = (await proc.run(["git", "-C", dir, "hash-object", "-w", "--stdin"], { input: "raw" })).stdout.trim();
    await git(dir, "read-tree", "fleet", "--index-output=/dev/null").catch(() => "");
    const idx = osPath.join(dir, "tmp-index");
    const env = { GIT_INDEX_FILE: idx, GIT_WORK_TREE: dir };
    await proc.must(["git", "-C", dir, "read-tree", "fleet"], { env });
    await proc.must(["git", "-C", dir, "update-index", "--add", "--cacheinfo", `100644,${blob},${decomposed}`], { env });
    const tree = (await proc.must(["git", "-C", dir, "write-tree"], { env })).trim();
    const tip = (await git(dir, "rev-parse", "fleet")).trim();
    const commit = (await proc.must(["git", "-C", dir, "commit-tree", tree, "-p", tip, "-m", "decomposed"], { env: { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@x", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@x" } })).trim();
    await git(dir, "update-ref", "refs/heads/fleet", commit, tip);
    await tfs.remove(idx).catch(() => undefined);
    assertEquals(ok(await ref.store.list(ROOT), "list").entries.some((e) => e.path.startsWith("dec/")), false);
    // a rename is one commit, keeps the bytes, and does not overwrite
    const before = await commitsOf(dir, "fleet");
    const moved = ok(await ref.store.rename(p("page/00"), p("moved/zero"), expectAny), "rename");
    assertEquals(moved.rev, await rev("page/00"));
    assertEquals(await commitsOf(dir, "fleet"), before + 1);
    assertEquals((await ref.store.read(p("page/00"))).kind, "err");
    assertEquals(text(ok(await ref.store.read(p("moved/zero")), "read").bytes), "page/00");
    const over = await ref.store.rename(p("page/01"), p("moved/zero"), expectAny);
    assert(over.kind === "err" && over.error.kind === "conflict");
    const gone = await ref.store.rename(p("nothing"), p("elsewhere"), expectAny);
    assert(gone.kind === "err" && gone.error.kind === "missing");
    const same = await ref.store.rename(p("page/01"), p("page/01"), expectAny);
    assertEquals(same.kind, "err");
    assertEquals(await commitsOf(dir, "fleet"), before + 1);
  });
  // a store of a folder of a branch sees the paths below the folder only
  await withRepo("bare", async (dir) => {
    const whole = await refIn(dir);
    ok(await whole.store.write(p("fleet/m1/state.json"), bytes("m1"), expectAny), "write");
    ok(await whole.store.write(p("elsewhere/x"), bytes("x"), expectAny), "write");
    const part = await refIn(dir, "fleet", { prefix: ok(parsePrefix("fleet"), "prefix") });
    assertEquals(ok(await part.store.list(ROOT), "list").entries.map((e) => e.path), [p("m1/state.json")]);
    assertEquals(text(ok(await part.store.read(p("m1/state.json")), "read").bytes), "m1");
    ok(await part.store.write(p("m2/state.json"), bytes("m2"), expectAny), "write");
    assertEquals(text(ok(await whole.store.read(p("fleet/m2/state.json")), "read").bytes), "m2");
    assertEquals((await part.store.read(p("elsewhere/x"))).kind, "err");
  });
});
