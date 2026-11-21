/**
 * Tests of the store of a branch on a host (commons anyfs-githost 0002-anyfs-githost-store FR-006 to FR-014), run on the fake of GitHub's API and on the fake of GitLab's by the same code: the store passes the conformance suite of AnyFS,
 * is made as what the token may do, revises as the bytes do, writes exactly as its expectation says (writers that race: one wins), makes one commit of a batch and of a rename and none of a change that changes nothing, lists in the order of
 * the paths and whole (a tree cut short, pages of a tree), and says what it does not do.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { runConformance } from "@intellectual-frontiers/anyfs/conformance";
import { retrying } from "@intellectual-frontiers/anyfs/layers";
import { memoryStore } from "@intellectual-frontiers/anyfs/memory";
import { expectAbsent, expectAny, expectRev, parsePath, ROOT, parsePrefix, type Path } from "@intellectual-frontiers/anyfs/governance";
import { HOST_CAPABILITIES, HOST_READ_CAPABILITIES } from "../src/mod.ts";
import { bytes, rig, text } from "./support.ts";

const p = (t: string): Path => {
  const r = parsePath(t);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const prefix = (t: string) => {
  const r = parsePrefix(t);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

const LABELS = ["github", "gitlab"] as const;
const failures = (reports: readonly { readonly id: string; readonly failure?: string }[]): readonly string[] => reports.filter((r) => r.failure !== undefined).map((r) => `${r.id}: ${r.failure}`);

proves(["0002-anyfs-githost-store FR-014", "0003-anyfs-githost-tests FR-001"], "the store passes every case of the conformance suite of AnyFS on both hosts, including the race of revisions and the batch", async () => {
  for (const label of LABELS) {
    const r = rig(label);
    let n = 0;
    const reports = await runConformance(async () => (await r.writable({ prefix: `run-${n++}` })));
    assertEquals(failures(reports), [], label);
    for (const id of ["race-revision", "batch-all-or-nothing", "rename-does-not-overwrite", "history-newest-first"]) assert(reports.some((x) => x.id === id && x.failure === undefined), `${label}: ${id} was run`);
  }
});

proves(["0002-anyfs-githost-store FR-006"], "a store of a token that may push has exactly read, write, list, stat, delete, cas, batch, rename and history, is strong, and says what the host said of the branch", async () => {
  for (const label of LABELS) {
    const r = rig(label);
    const o = await r.open();
    assertEquals(o.mode, "writable", label);
    assertEquals([...o.store.capabilities].sort(), [...HOST_CAPABILITIES].sort(), label);
    assertEquals(o.store.consistency, "strong");
    assertEquals(o.facts.branch, "main");
    assertEquals(o.facts.exists, true);
    assertEquals(o.facts.protected, false);
    assertEquals(o.facts.canPush, true);
    assertEquals(o.facts.tip, r.repo.branches.get("main"));
    for (const op of ["rangeRead", "append", "search"] as const) {
      const x = await o.store.handle(op === "rangeRead" ? { op, path: p("a"), start: 0, length: 1 } : op === "append" ? { op, path: p("a"), bytes: bytes("x"), expect: expectAny } : { op, prefix: ROOT, text: "x" });
      assert(x.kind === "err" && x.error.kind === "refused" && x.error.reason === "capability-absent", `${label}: ${op}`);
    }
  }
});

proves(["0002-anyfs-githost-store FR-006", "0002-anyfs-githost-store FR-013"], "a token that may not push gives a store of read, list, stat and history alone, and a branch the host protects is said and a push to it is refused with the host's words", async () => {
  for (const label of LABELS) {
    const r = rig(label);
    r.setPush(false);
    const ro = await r.open();
    assertEquals(ro.mode, "read-only", label);
    assertEquals([...ro.store.capabilities].sort(), [...HOST_READ_CAPABILITIES].sort());
    assertEquals(ro.facts.canPush, false);
    assert((await ro.store.read(p("README.md"))).kind === "ok");

    const q = rig(label);
    q.repo.protectedBranches.add("main");
    const o = await q.open();
    assertEquals(o.facts.protected, true, label);
    if (o.mode !== "writable") continue;
    const w = await o.store.write(p("a.txt"), bytes("x"), expectAny);
    assert(w.kind === "err" && w.error.kind === "refused" && w.error.reason === "read-only", `${label}: ${JSON.stringify(w)}`);
    assertStringIncludes(w.kind === "err" && w.error.kind === "refused" ? w.error.detail : "", "protect");
  }
});

proves(["0002-anyfs-githost-store FR-006"], "a branch that does not exist is read as empty and is not written, unless the store was told which branch to start it from, and then it is made from that branch with its files", async () => {
  for (const label of LABELS) {
    const r = rig(label, { "README.md": "fleet\n", "a/b.txt": "b" });
    const without = await r.writable({ ref: "feature" });
    assertEquals((await without.list(ROOT)).kind === "ok" && (await without.list(ROOT)).kind === "ok" ? "ok" : "err", "ok");
    const listed = await without.list(ROOT);
    assert(listed.kind === "ok" && listed.value.entries.length === 0, label);
    assert((await without.read(p("README.md"))).kind === "err");
    const refused = await without.write(p("x.txt"), bytes("x"), expectAny);
    assert(refused.kind === "err" && refused.error.kind === "refused" && refused.error.reason === "outside-scope", `${label}: ${JSON.stringify(refused)}`);
    assertEquals(r.repo.branches.has("feature"), false);

    const made = await r.writable({ ref: "feature", createFrom: "main" });
    assert((await made.write(p("x.txt"), bytes("x"), expectAny)).kind === "ok", label);
    assert(r.repo.branches.has("feature"), `${label}: the branch was made`);
    const read = await made.read(p("a/b.txt"));
    assert(read.kind === "ok" && text(read.value.bytes) === "b", `${label}: it has the files of main`);
    assertEquals(r.repo.length("main"), 1, "main did not move");
    assertEquals(r.repo.length("feature"), 2);

    const bad = await r.tryOpen({ ref: "ghost", createFrom: "nowhere" });
    assert(bad.kind === "err", label);
  }
});

proves(["0002-anyfs-githost-store FR-007"], "the revision is sha256: and the digest of the bytes, the same as a store in memory gives for them, and the host's blob and commit come back beside it", async () => {
  for (const label of LABELS) {
    const r = rig(label);
    const o = await r.open();
    if (o.mode !== "writable") throw new Error("writable expected");
    const mem = memoryStore({ name: "m" });
    const w = await o.store.write(p("dir/a.txt"), bytes("hello"), expectAny);
    const m = await mem.write(p("dir/a.txt"), bytes("hello"), expectAny);
    assert(w.kind === "ok" && m.kind === "ok" && w.value.rev === m.value.rev, label);
    assertEquals(w.kind === "ok" && w.value.rev.startsWith("sha256:"), true);
    const info = await o.info(p("dir/a.txt"));
    assert(info.kind === "ok" && info.value.rev === (w.kind === "ok" ? w.value.rev : undefined), label);
    assert(info.kind === "ok" && /^[0-9a-f]{40}$/u.test(info.value.blob) && info.value.mode === "100644" && info.value.size === 5, `${label}: ${JSON.stringify(info)}`);
    assert(info.kind === "ok" && info.value.commit === r.repo.branches.get("main"), `${label}: the commit is the tip`);
    const st = await o.store.stat(p("dir/a.txt"));
    assert(st.kind === "ok" && st.value.size === 5 && w.kind === "ok" && st.value.rev === w.value.rev);
  }
});

proves(["0002-anyfs-githost-store FR-007", "0002-anyfs-githost-store FR-012"], "bytes that are not what the name of their blob says are tampered, and a file read after a write is not read again from the host", async () => {
  for (const label of LABELS) {
    const r = rig(label, { "a.txt": "genuine" });
    const o = await r.open();
    if (o.mode !== "writable") throw new Error("writable expected");
    const flat = r.repo.flatten(r.repo.commits.get(r.repo.branches.get("main") ?? "")?.tree);
    const blob = flat.get("a.txt")?.blob ?? "";
    r.repo.blobs.set(blob, bytes("forged!"));
    const bad = await o.store.read(p("a.txt"));
    assert(bad.kind === "err" && bad.error.kind === "tampered", `${label}: ${JSON.stringify(bad)}`);

    const q = rig(label);
    const s = await q.writable();
    assert((await s.write(p("w.txt"), bytes("written"), expectAny)).kind === "ok");
    const before = q.count("GET", label === "github" ? "/git/blobs" : "/repository/blobs");
    const back = await s.read(p("w.txt"));
    assert(back.kind === "ok" && text(back.value.bytes) === "written");
    // the read asks for the blob of the bytes; the digest of what was written was kept, so a stat does not
    const mid = q.count("GET", label === "github" ? "/git/blobs" : "/repository/blobs");
    assertEquals(mid, before + 1, label);
    assert((await s.stat(p("w.txt"))).kind === "ok");
    assertEquals(q.count("GET", label === "github" ? "/git/blobs" : "/repository/blobs"), mid, `${label}: a stat of a file just written reads nothing`);
  }
});

proves(["0002-anyfs-githost-store FR-008"], "a write expects exactly what it says: no object, a revision or any, and a conflict says what the file is at", async () => {
  for (const label of LABELS) {
    const r = rig(label);
    const s = await r.writable();
    const a = await s.write(p("x.txt"), bytes("one"), expectAbsent);
    assert(a.kind === "ok" && a.value.created, label);
    const again = await s.write(p("x.txt"), bytes("two"), expectAbsent);
    assert(again.kind === "err" && again.error.kind === "conflict" && again.error.found.kind === "rev", label);
    const rev1 = a.value.rev;
    const wrong = await s.write(p("x.txt"), bytes("two"), expectRev("sha256:" + "0".repeat(64) as never));
    assert(wrong.kind === "err" && wrong.error.kind === "conflict", label);
    const right = await s.write(p("x.txt"), bytes("two"), expectRev(rev1));
    assert(right.kind === "ok" && !right.value.created, label);
    const gone = await s.write(p("nothing.txt"), bytes("x"), expectRev(rev1));
    assert(gone.kind === "err" && gone.error.kind === "conflict" && gone.error.found.kind === "absent", label);
  }
});

proves(["0002-anyfs-githost-store FR-008"], "of writers that race to make one file exactly one wins and the rest conflict, and writers of different files all win, through stores of their own that meet only at the host", async () => {
  for (const label of LABELS) {
    const r = rig(label);
    const stores = await Promise.all([0, 1, 2, 3, 4, 5].map(() => r.writable({ attempts: 12 })));
    const same = await Promise.all(stores.map((s, i) => s.write(p("race.txt"), bytes(`writer ${i}`), expectAbsent)));
    assertEquals(same.filter((x) => x.kind === "ok").length, 1, `${label}: one winner`);
    assert(same.filter((x) => x.kind === "err").every((x) => x.kind === "err" && x.error.kind === "conflict"), `${label}: the others conflict`);
    const different = await Promise.all(stores.map((s, i) => s.write(p(`own-${i}.txt`), bytes(`file ${i}`), expectAbsent)));
    assertEquals(different.filter((x) => x.kind === "ok").length, 6, `${label}: all of different files win: ${JSON.stringify(different.filter((x) => x.kind === "err"))}`);
    const listed = await stores[0]?.list(ROOT);
    assert(listed?.kind === "ok" && listed.value.entries.length === 1 + 1 + 6, label);
  }
});

proves(["0002-anyfs-githost-store FR-008"], "a branch that moved while a change was made is read again: the change is made on the new tip where its file did not move, and conflicts where it did", async () => {
  for (const label of LABELS) {
    const r = rig(label);
    const a = await r.writable({ attempts: 6 });
    const b = await r.writable();
    // another writer commits between the making of the commit and the moving of the branch, once
    let fired = false;
    r.hookBeforeWrite(() => {
      if (fired) return;
      fired = true;
      r.hookBeforeWrite(undefined);
      void b;
      r.repo.seed({ "other.txt": "from another writer" }, "main", "another writer");
    });
    const w = await a.write(p("mine.txt"), bytes("mine"), expectAbsent);
    assert(w.kind === "ok", `${label}: ${JSON.stringify(w)}`);
    assert(fired, `${label}: the other writer committed in between`);
    const listed = await a.list(ROOT);
    assert(listed.kind === "ok" && listed.value.entries.map((e) => e.path).includes(p("other.txt")) && listed.value.entries.map((e) => e.path).includes(p("mine.txt")), `${label}: both are in the branch`);

    // the same file moved under the writer: the expectation no longer holds
    const first = await a.write(p("shared.txt"), bytes("v1"), expectAny);
    assert(first.kind === "ok");
    let again = false;
    r.hookBeforeWrite(() => {
      if (again) return;
      again = true;
      r.hookBeforeWrite(undefined);
      r.repo.seed({ "shared.txt": "changed by another" }, "main", "another writer");
    });
    const stale = await a.write(p("shared.txt"), bytes("v2"), expectRev(first.value.rev));
    assert(stale.kind === "err" && stale.error.kind === "conflict" && stale.error.found.kind === "rev", `${label}: ${JSON.stringify(stale)}`);
  }
});

proves(["0002-anyfs-githost-store FR-009"], "a batch is exactly one commit, a rename is one commit that moves the blob and makes none, and a change that changes nothing is no commit", async () => {
  for (const label of LABELS) {
    const r = rig(label);
    const s = await r.writable();
    assert((await s.write(p("old.txt"), bytes("keep"), expectAny)).kind === "ok");
    assert((await s.write(p("gone.txt"), bytes("remove me"), expectAny)).kind === "ok");
    const before = r.repo.length("main");
    const done = await s.batch([
      { kind: "put", path: p("a.txt"), bytes: bytes("a"), expect: expectAbsent },
      { kind: "put", path: p("b/c.txt"), bytes: bytes("c"), expect: expectAbsent },
      { kind: "put", path: p("d.txt"), bytes: bytes("d"), expect: expectAny },
      { kind: "delete", path: p("gone.txt"), expect: expectAny },
    ]);
    assert(done.kind === "ok" && done.value.results.length === 4, `${label}: ${JSON.stringify(done)}`);
    assertEquals(r.repo.length("main"), before + 1, `${label}: one commit for the batch`);
    const tip = r.repo.commits.get(r.repo.branches.get("main") ?? "");
    assertStringIncludes(tip?.message ?? "", "4 changes");

    const same = await s.batch([{ kind: "put", path: p("a.txt"), bytes: bytes("a"), expect: expectAny }, { kind: "delete", path: p("absent.txt"), expect: expectAny }]);
    assert(same.kind === "ok", label);
    assertEquals(r.repo.length("main"), before + 1, `${label}: nothing changed, no commit`);

    const blobsBefore = r.count("POST", label === "github" ? "/git/blobs" : "/never");
    const moved = await s.rename(p("old.txt"), p("moved/new.txt"), expectAny);
    assert(moved.kind === "ok", `${label}: ${JSON.stringify(moved)}`);
    assertEquals(r.repo.length("main"), before + 2, `${label}: one commit for the rename`);
    if (label === "github") assertEquals(r.count("POST", "/git/blobs"), blobsBefore, "a rename makes no blob");
    assertEquals((await s.read(p("old.txt"))).kind, "err");
    const back = await s.read(p("moved/new.txt"));
    assert(back.kind === "ok" && text(back.value.bytes) === "keep" && moved.value.rev === back.value.rev, label);
    const clash = await s.rename(p("a.txt"), p("moved/new.txt"), expectAny);
    assert(clash.kind === "err" && clash.error.kind === "conflict", label);
  }
});

proves(["0002-anyfs-githost-store FR-009"], "the message of a commit is the subject a function makes of the change with the lines of each change after it, by the author and the committer the store names", async () => {
  for (const label of LABELS) {
    const r = rig(label);
    const s = await r.writable({ subject: (changes) => `fleet: ${changes.length} change(s)` });
    assert((await s.batch([{ kind: "put", path: p("a"), bytes: bytes("1"), expect: expectAny }, { kind: "put", path: p("b"), bytes: bytes("2"), expect: expectAny }])).kind === "ok");
    const tip = r.repo.commits.get(r.repo.branches.get("main") ?? "");
    assertStringIncludes(tip?.message ?? "", "fleet: 2 change(s)");
    assertStringIncludes(tip?.message ?? "", "- write a");
    assertEquals(tip?.author.name, "Fleet Writer");
    assertEquals(tip?.author.email, "fleet@example.test");
  }
});

proves(["0002-anyfs-githost-store FR-010"], "a list is in the order of the paths, below its prefix only, in pages with a cursor, for a tree of more than a thousand files", async () => {
  for (const label of LABELS) {
    const files: Record<string, string> = {};
    for (let i = 0; i < 1105; i++) files[`many/f${String(i).padStart(4, "0")}.txt`] = `c${i}`;
    files["manyx/other.txt"] = "not below many";
    const r = rig(label, files);
    const s = await r.writable({ prefix: "many" });
    const seen: string[] = [];
    let after: Parameters<typeof s.list>[1] extends infer O ? (O extends { after?: infer C } ? C : never) : never = undefined as never;
    for (let guard = 0; guard < 10; guard++) {
      const page = await s.list(ROOT, { limit: 500, ...(after === undefined ? {} : { after }) });
      assert(page.kind === "ok", label);
      for (const e of page.value.entries) seen.push(e.path);
      if (page.value.next === undefined) break;
      after = page.value.next as never;
    }
    assertEquals(seen.length, 1105, label);
    assertEquals(seen, [...seen].sort());
    assertEquals(new Set(seen).size, 1105);
    const whole = await r.writable();
    const top = await whole.list(prefix("many"));
    assert(top.kind === "ok" && top.value.entries.every((e) => e.path.startsWith("many/")), `${label}: below many only`);
  }
});

proves(["0002-anyfs-githost-store FR-010"], "a tree the host cuts short is read again folder by folder and is never listed in part, and a tree of pages is read to its last page", async () => {
  const files: Record<string, string> = {};
  for (let i = 0; i < 25; i++) files[`d${i % 5}/f${i}.txt`] = `c${i}`;
  const gh = rig("github", files);
  (gh.fake as import("./fake-github.ts").FakeGithub).knobs.truncateAt = 8;
  const s = await gh.writable();
  const all = await s.list(ROOT);
  assert(all.kind === "ok" && all.value.entries.length === 25 + 0, `github: ${all.kind === "ok" ? all.value.entries.length : JSON.stringify(all)}`);
  assert(gh.count("GET", "/git/trees") > 3, "github: the folders were asked for one by one");

  const gl = rig("gitlab", files);
  (gl.fake as import("./fake-gitlab.ts").FakeGitlab).knobs.pageSize = 10;
  const t = await gl.writable();
  const every = await t.list(ROOT);
  assert(every.kind === "ok" && every.value.entries.length === 25, `gitlab: ${every.kind === "ok" ? every.value.entries.length : JSON.stringify(every)}`);
  assert(gl.count("GET", "/repository/tree") >= 3, "gitlab: more than one page of the tree was read");
});

proves(["0002-anyfs-githost-store FR-011"], "history is the commits that changed a file, newest first, with the revision the file had after each, and a file that is not there has none", async () => {
  for (const label of LABELS) {
    const r = rig(label);
    const s = await r.writable();
    const revs: string[] = [];
    for (const v of ["one", "two", "three"]) {
      const w = await s.write(p("h.txt"), bytes(v), expectAny);
      assert(w.kind === "ok");
      revs.push(w.value.rev);
    }
    assert((await s.write(p("other.txt"), bytes("x"), expectAny)).kind === "ok");
    const h = await s.history(p("h.txt"));
    assert(h.kind === "ok", label);
    assertEquals(h.value.versions.map((v) => v.rev), [...revs].reverse(), label);
    const o = await r.open();
    const log = await o.log(p("h.txt"));
    assert(log.kind === "ok" && log.value.length === 3 && log.value[0]?.author.name === "Fleet Writer", `${label}: ${JSON.stringify(log)}`);
    const none = await s.history(p("never.txt"));
    assert(none.kind === "err" && none.error.kind === "missing", label);
  }
});

proves(["0002-anyfs-githost-store FR-012"], "a file larger than the limit is refused before anything is sent, a name Git or another computer would read wrongly is refused, and a file where a folder is (or the other way) is refused", async () => {
  for (const label of LABELS) {
    const r = rig(label, { "f": "a file", "dir/x.txt": "in a folder" });
    const s = await r.writable({ maxObjectBytes: 16 });
    const writes = r.count("POST", "/");
    const big = await s.write(p("big.bin"), new Uint8Array(17), expectAny);
    assert(big.kind === "err" && big.error.kind === "refused" && big.error.reason === "too-large", label);
    assertEquals(r.count("POST", "/"), writes, `${label}: nothing was sent`);
    assertEquals(s.traits.maxObject, 16);
    for (const name of [".git/config", "a/.GIT/x", "a/git~1/x", "con.txt", "trailing."]) {
      const w = await s.write(p(name), bytes("x"), expectAny);
      assert(w.kind === "err" && w.error.kind === "refused" && w.error.reason === "unportable-path", `${label}: ${name} ${JSON.stringify(w)}`);
    }
    const onFile = await s.write(p("f/below.txt"), bytes("x"), expectAny);
    assert(onFile.kind === "err" && onFile.error.kind === "refused" && onFile.error.reason === "unportable-path", `${label}: ${JSON.stringify(onFile)}`);
    const onDir = await s.write(p("dir"), bytes("x"), expectAny);
    assert(onDir.kind === "err" && onDir.error.kind === "refused" && onDir.error.reason === "unportable-path", `${label}: ${JSON.stringify(onDir)}`);
  }
});

proves(["0002-anyfs-githost-store FR-012"], "a symbolic link in the repository is refused when it is named and left out of a list, and a file is read and written beside it", async () => {
  for (const label of LABELS) {
    const r = rig(label, { "real.txt": "real" });
    // a link entry made by hand in the tree of the tip
    const tip = r.repo.branches.get("main") ?? "";
    const tree = r.repo.commits.get(tip)?.tree ?? "";
    const target = r.repo.addBlob(bytes("real.txt"));
    const nodes = [...(r.repo.trees.get(tree) ?? []), { name: "link", mode: "120000", type: "blob" as const, sha: target }];
    const who = { name: "x", email: "x@example.test", date: r.repo.now() };
    const id = r.repo.addCommit({ tree: r.repo.addTree(nodes), parents: [tip], message: "a link", author: who, committer: who });
    r.repo.branches.set("main", id);
    const s = await r.writable();
    const read = await s.read(p("link"));
    assert(read.kind === "err" && read.error.kind === "refused" && read.error.reason === "outside-scope", `${label}: ${JSON.stringify(read)}`);
    const w = await s.write(p("link"), bytes("x"), expectAny);
    assert(w.kind === "err" && w.error.kind === "refused", label);
    const listed = await s.list(ROOT);
    assert(listed.kind === "ok" && listed.value.entries.map((e) => e.path).join() === "real.txt", `${label}: the link is not listed`);
    assert((await s.write(p("beside.txt"), bytes("ok"), expectAny)).kind === "ok");
  }
});

proves(["0002-anyfs-githost-store FR-013"], "a throttle, a host that failed and a connection that was lost are problems worth a try, with how long to wait, and the layer that retries recovers from one", async () => {
  for (const label of LABELS) {
    const r = rig(label);
    const s = await r.writable();
    r.fake.knobs.failNext.push({ status: 403, headers: { "x-ratelimit-remaining": "0", "retry-after": "7" }, body: JSON.stringify({ message: "API rate limit exceeded" }) });
    const limited = await s.read(p("README.md"));
    assert(limited.kind === "err" && limited.error.kind === "unavailable" && limited.error.retryable, `${label}: ${JSON.stringify(limited)}`);
    assertStringIncludes(limited.kind === "err" && limited.error.kind === "unavailable" ? limited.error.detail : "", "7 s");

    r.fake.knobs.failNext.push({ status: 429, headers: { "retry-after": "3" } });
    const tooMany = await s.read(p("README.md"));
    assert(tooMany.kind === "err" && tooMany.error.kind === "unavailable" && tooMany.error.retryable, label);

    r.fake.knobs.failNext.push({ status: 502 });
    const down = await s.read(p("README.md"));
    assert(down.kind === "err" && down.error.kind === "unavailable" && down.error.retryable, label);

    r.fake.knobs.failNext.push({ status: 503 });
    const sturdy = retrying(s, { attempts: 3, baseMs: 1, maxMs: 4 }, { sleep: async () => undefined });
    const ok = await sturdy.read(p("README.md"));
    assert(ok.kind === "ok", `${label}: ${JSON.stringify(ok)}`);

    r.fake.knobs.failNext.push({ status: 401, body: JSON.stringify({ message: "Bad credentials" }) });
    const denied = await s.read(p("README.md"));
    assert(denied.kind === "err" && denied.error.kind === "unavailable" && !denied.error.retryable, label);
  }
});
