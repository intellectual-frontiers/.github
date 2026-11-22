/**
 * Tests of the port of a source and of the sources over real places (commons planning 0004-planning-sources FR-002, FR-003, FR-005, FR-010, FR-011): `defineSource` and its refusals, a patch held to its preview, the
 * same Markdown source over a store in memory, a folder and a SQLite database with a write that finds the file changed a conflict, the Git host source over a real temporary Git repository and a local fake of the
 * host's client (the part that needs an account is left untested: the live client is `githost`'s own and its tests are its own), the reserved names, the matrix of every source, and a journal of Evidence Capture that
 * no source reads or changes.
 *
 * @module
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { err, ok } from "@intellectual-frontiers/core";
import { expectAny, parsePath, parsePrefix } from "@intellectual-frontiers/anyfs/governance";
import { localStore } from "@intellectual-frontiers/anyfs/local";
import { memoryStore } from "@intellectual-frontiers/anyfs/memory";
import { openSqlStore } from "@intellectual-frontiers/anyfs-sql";
import { openSqliteFile } from "@intellectual-frontiers/anyfs-sql/sqlite";
import { encodeEntry, journalPath, textDigest } from "@intellectual-frontiers/evidence-capture/logical";
import { type GitHostClient, type HostResult, type IssueInfo, type RepoRef } from "@intellectual-frontiers/githost";
import { output } from "@intellectual-frontiers/system/proc";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { type Capability, makeEvent, makePatch } from "@intellectual-frontiers/planning/governance";
import { FIELDS, matrixFindings } from "@intellectual-frontiers/planning/logical";
import {
  applyPatch,
  BUILT_SOURCES,
  citeJournalEntry,
  commitReferences,
  defineSource,
  fileSource,
  githostSource,
  isJournalPath,
  markdownLens,
  registerSource,
  RESERVED_SOURCES,
  SOURCE_ROWS,
  type PlanningStoreBackend,
  type Source,
} from "@intellectual-frontiers/planning/physical";
import { ADA, eventIds, itemId, must } from "./support.ts";
import { snapshotOf, storeWith } from "./harness.ts";
import { instant } from "./world.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const acquireNothing = async () => ok({ observations: [], findings: [] });

proves(["0004-planning-sources FR-002"], "defineSource makes a source from a typed record and refuses one that says it cannot write and has a write, or says it can and has none", () => {
  const reader = defineSource({ name: "table", place: "t", capabilities: ["read"], acquire: acquireNothing });
  assert(reader.kind === "ok" && reader.value.preview === undefined && reader.value.write === undefined, "a reader has no write");
  const plan = async () => err({ kind: "unexpressed" as const, reason: "x" });
  const wrote = async () => ok({ observations: [], findings: [] });
  assertEquals(defineSource({ name: "table", place: "t", capabilities: ["read"], acquire: acquireNothing, preview: plan, write: wrote }).kind, "err");
  assertEquals(defineSource({ name: "table", place: "t", capabilities: ["read", "close"], acquire: acquireNothing }).kind, "err");
  assertEquals(defineSource({ name: "table", place: "t", capabilities: ["read", "close"], acquire: acquireNothing, preview: plan }).kind, "err");
  assertEquals(defineSource({ name: "table", place: "t", capabilities: ["read", "close"], acquire: acquireNothing, preview: plan, write: wrote }).kind, "ok");
  assertEquals(defineSource({ name: "", place: "t", capabilities: ["read"], acquire: acquireNothing }).kind, "err");
});

proves(["0004-planning-sources FR-003"], "a patch needs an explicit target and a source for another place is refused, and a read only source puts every patch in the outbox", async () => {
  const src = must(defineSource({ name: "table", place: "t", capabilities: ["read"], acquire: acquireNothing }));
  const [id] = eventIds(1);
  assert(id !== undefined, "an id");
  const e = must(makeEvent({ id, item: itemId(), at: instant(1), actor: ADA }, { type: "commented", body: "x" }));
  const elsewhere = must(makePatch("table", "other-place", e));
  const r = await applyPatch(src, elsewhere, instant(2));
  assert(r.kind === "failed" && r.problem.kind === "refused", "another place is refused");
  const own = await applyPatch(src, must(makePatch("table", "t", e)), instant(2));
  assert(own.kind === "outbox" && own.entry.waiting.kind === "capability" && own.entry.waiting.capability === "append-event", "the outbox names the capability");
  const other = await applyPatch(src, must(makePatch("not-this", "t", e)), instant(2));
  assertEquals(other.kind, "failed");
});

const TASKS = "# Tasks\n- [ ] one\n- [ ] two\n";

async function closeOne(source: Source, title: string) {
  const o = must(await source.acquire()).observations.find((x) => x.content.title === title);
  assert(o !== undefined, `${title} is read`);
  const [id] = eventIds(1, undefined, 1_790_000_000_000 + title.length);
  assert(id !== undefined, "an id");
  return must(makePatch("markdown", source.place, must(makeEvent({ id, item: itemId(), at: instant(1), actor: ADA }, { type: "closed", reason: "completed" })), o.fingerprint));
}

async function overBackend(name: string, backend: PlanningStoreBackend, place: string, read: (path: string) => Promise<string>) {
  must(await backend.write(must(parsePath(place === "." ? "t.md" : `${place}t.md`)), encoder.encode(TASKS), expectAny));
  const source = must(fileSource(backend, markdownLens(), place));
  const patch = await closeOne(source, "one");
  const dry = await applyPatch(source, patch, instant(2));
  assert(dry.kind === "dry-run", `${name}: a dry run`);
  const target = place === "." ? "t.md" : `${place}t.md`;
  assertEquals(await read(target), TASKS);
  const done = await applyPatch(source, patch, instant(2), dry.preview.hash);
  assert(done.kind === "written", `${name}: written`);
  assertEquals(await read(target), TASKS.replace("- [ ] one", "- [x] one"));
  // a write that finds the file changed after it was read is a conflict, and changes nothing
  const patch2 = await closeOne(source, "two");
  const preview = await applyPatch(source, patch2, instant(3));
  assert(preview.kind === "dry-run", `${name}: a preview`);
  const planned = await source.preview?.(patch2);
  assert(planned?.kind === "ok", `${name}: a plan`);
  const plan = planned.value;
  must(await backend.write(must(parsePath(target)), encoder.encode("# Tasks\n- [x] one\n- [ ] two\n- [ ] changed by another\n"), expectAny));
  // the file changed after it was read: the write of that plan is a conflict
  const raced = await source.write?.(plan);
  assert(raced?.kind === "err" && raced.error.kind === "conflict", `${name}: a conflict`);
  // and the preview of the old file is stale now
  const stale = await applyPatch(source, patch2, instant(3), preview.preview.hash);
  assertEquals(stale.kind, "stale");
  assertEquals(await read(target), "# Tasks\n- [x] one\n- [ ] two\n- [ ] changed by another\n");
}

proves(["0004-planning-sources FR-005", "0004-planning-sources FR-008"], "the same Markdown source works over a store in memory, a folder and a SQLite database, and a write that finds the file changed is a conflict that changes nothing", async () => {
  const mem = memoryStore({ name: "mem", clock: () => 1_700_000_000_000 });
  await overBackend("memory", mem, "notes/", async (p) => decoder.decode(must(await mem.read(must(parsePath(p)))).bytes));
  const dir = mkdtempSync(join(tmpdir(), "planning-folder-"));
  try {
    const folder = must(await localStore(dir));
    await overBackend("folder", folder, ".", async (p) => decoder.decode(must(await folder.read(must(parsePath(p)))).bytes));
    const portDir = mkdtempSync(join(tmpdir(), "planning-sqlite-"));
    try {
      const port = must(await openSqliteFile(join(portDir, "p.db")));
      const sql = must(await openSqlStore(port)).store;
      await overBackend("sqlite", sql, ".", async (p) => decoder.decode(must(await sql.read(must(parsePath(p)))).bytes));
    } finally {
      rmSync(portDir, { recursive: true, force: true });
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---- the Git host

const REF: RepoRef = { kind: "Github", host: "github.com", path: ["owner", "repo"] };
const ISSUES: Readonly<Record<number, IssueInfo>> = {
  7: { number: 7, title: "Seven", body: "The seventh.", state: "open", url: "https://github.com/owner/repo/issues/7", children: [8], labels: ["bug"] },
  8: { number: 8, title: "Eight", body: "", state: "closed", url: "https://github.com/owner/repo/issues/8", parent: 7, children: [], labels: [] },
  10: { number: 10, title: "Ten", body: "", state: "closed", closeReason: "not_planned", url: "https://github.com/owner/repo/issues/10", children: [], labels: [] },
  11: { number: 11, title: "Eleven", body: "", state: "closed", closeReason: "duplicate", url: "https://github.com/owner/repo/issues/11", children: [], labels: [] },
  9: { number: 9, title: "Nine", body: "", state: "open", url: "https://github.com/owner/repo/issues/9", children: [], labels: [], hierarchy: "unavailable" },
};
/** A local fake of the host's client with answers written by hand: the real client needs an account and is `githost`'s own, tested there. */
const fakeClient = (): GitHostClient => ({
  kind: "Github",
  capabilities: new Set(["Issues"]),
  repository: async () => err({ kind: "unsupported", host: "Github", capability: "DefaultBranch" }),
  issue: async (_ref, n): Promise<HostResult<IssueInfo>> => {
    const i = ISSUES[n];
    return i === undefined ? err({ kind: "not-found", what: `issue ${n}` }) : ok(i);
  },
  changeRequest: async () => err({ kind: "unsupported", host: "Github", capability: "ChangeRequests" }),
  branchProtection: async () => err({ kind: "unsupported", host: "Github", capability: "ProtectedBranches" }),
  commitVerified: async () => err({ kind: "unsupported", host: "Github", capability: "SignedCommits" }),
});

proves(["0004-planning-sources FR-010"], "a closed issue is read with the reason the host gives: not planned, duplicate, and completed where the host gives none", async () => {
  const source = must(githostSource({ client: fakeClient(), ref: REF, issues: [8, 10, 11] }));
  const read = must(await source.acquire());
  const reason = (n: number): unknown => {
    const o = read.observations.find((x) => x.locator.kind === "url" && x.locator.url.endsWith(`/issues/${n}`));
    return o?.content.kind === "issue" && o.content.state.kind === "closed" ? o.content.state.reason : undefined;
  };
  assertEquals([reason(8), reason(10), reason(11)], ["completed", "not-planned", "duplicate"]);
});

proves(["0004-planning-sources FR-010"], "the references of a commit are the Refs line and the closing keywords of the host, for this repository only", () => {
  assertEquals(commitReferences("Fix the thing\n\nRefs #12\nCloses #13", ["owner", "repo"]), [{ number: 12, how: "refs" }, { number: 13, how: "closes" }]);
  assertEquals(commitReferences("fixes owner/repo#4, resolved: #5 and Fixes other/place#6 but Refs #4", ["owner", "repo"]).map((r) => [r.number, r.how]), [[4, "closes"], [5, "closes"]]);
  assertEquals(commitReferences("Refs #1 mentioned\n  Refs #2\nrefs #3", ["o", "r"]), []);
  assertEquals(commitReferences("closed #9\nclose #9\n", ["o", "r"]), [{ number: 9, how: "closes" }]);
});

proves(["0004-planning-sources FR-010"], "the issues the configuration and the commits of a real temporary Git repository name are read through the client of the host, with parent and children, the commits kept, a missing issue and a missing hierarchy as findings, and every patch in the outbox", async () => {
  const dir = mkdtempSync(join(tmpdir(), "planning-git-"));
  try {
    const git = async (...args: string[]) => {
      const r = await output(["git", "-C", dir, "-c", "user.name=T", "-c", "user.email=t@example.test", "-c", "commit.gpgsign=false", ...args]);
      assert(r.success, `git ${args.join(" ")} failed: ${decoder.decode(r.stderr)}`);
    };
    await git("init", "-q");
    await git("commit", "-q", "--allow-empty", "-m", "First\n\nRefs #7");
    await git("commit", "-q", "--allow-empty", "-m", "Second\n\nCloses #8\nRefs #404");
    const source = must(githostSource({ client: fakeClient(), ref: REF, issues: [9], repo: dir }));
    const read = must(await source.acquire());
    assertEquals(read.observations.map((o) => o.content.title), ["Seven", "Eight", "Nine"]);
    const [seven, eight] = read.observations;
    assert(seven !== undefined && eight !== undefined, "observations");
    assertEquals(eight.content.state, { kind: "closed", reason: "completed" });
    assert(eight.content.parent === seven.fingerprint, "the child names its parent");
    assertEquals(seven.content.labels, ["bug"]);
    assertEquals(seven.content.external, [{ source: "githost", value: "owner/repo#7" }]);
    assertEquals(seven.locator, { kind: "url", url: "https://github.com/owner/repo/issues/7" });
    assert(seven.content.evidence?.[0]?.startsWith("commit ") === true && seven.content.evidence[0].includes("(refs)"), "the commit that names it is kept");
    assert(JSON.stringify(eight.raw).includes('"how":"closes"'), "and in the record as read");
    assertEquals(read.findings.map((f) => f.path).sort(), ["#404", "#9"]);
    const [id] = eventIds(1);
    assert(id !== undefined, "an id");
    const p = must(makePatch("githost", source.place, must(makeEvent({ id, item: itemId(), at: instant(1), actor: ADA }, { type: "closed", reason: "completed" })), seven.fingerprint));
    const r = await applyPatch(source, p, instant(2));
    assert(r.kind === "outbox" && r.entry.waiting.kind === "capability", "a read only source: the outbox");
    // read twice: the same observations in the same order
    assertEquals(JSON.stringify(must(await source.acquire())), JSON.stringify(read));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

proves(["0004-planning-sources FR-011"], "the names of the sources not yet written are reserved and refused, none of the sources built is among them, and every source has a cell for every field with a reason where unexpressed", async () => {
  for (const name of RESERVED_SOURCES) assert(!(BUILT_SOURCES as readonly string[]).includes(name), `${name} is not built`);
  const reader = must(defineSource({ name: "sarif", place: "x.sarif", capabilities: ["read"], acquire: acquireNothing }));
  assertEquals(registerSource([], reader), { kind: "err", error: { kind: "reserved", name: "sarif" } });
  const mine = must(defineSource({ name: "my-table", place: "t", capabilities: ["read"], acquire: acquireNothing }));
  const once = must(registerSource([], mine));
  assertEquals(registerSource(once, mine).kind, "err");
  assertEquals(SOURCE_ROWS.map((r) => r.source).sort(), [...BUILT_SOURCES].sort());
  assertEquals(matrixFindings(SOURCE_ROWS), []);
  for (const row of SOURCE_ROWS) assertEquals(FIELDS.filter((f) => row.cells[f] === undefined), []);
  const caps: Capability[] = ["read"];
  assert(caps.length === 1, "capabilities are a closed list");
});

proves(["0004-planning-sources FR-011"], "a journal made by the real Evidence Capture code is not read as items by any source and not changed, and an entry is cited by a file span and its digest", async () => {
  const at = "2026-12-01T10:00:00Z";
  const path = journalPath(at);
  const digest = await textDigest("state");
  const line = encodeEntry({ kind: "grc.ledger-entry", schema: "1", seq: 1, previous: "0".repeat(64), type: "capture.changed", subject: "asset-1", digest, createdAt: at } as never);
  const store = await storeWith({ [path]: line, "tasks.md": "- [ ] a real task\n" });
  const files = { markdown: markdownLens() };
  const read = must(await must(fileSource(store, files.markdown, ".")).acquire());
  assertEquals(read.observations.map((o) => o.content.title), ["a real task"]);
  assert(isJournalPath(path) && !isJournalPath("notes/journal.jsonl"), "a day's journal is recognized by its path");
  const cite = must(citeJournalEntry(path, 1, digest));
  assertEquals(cite.locator, { kind: "file-span", path, startLine: 1, endLine: 1 });
  assertEquals(cite.fingerprint, digest);
  assertEquals(citeJournalEntry("notes.jsonl", 1, digest).kind, "err");
  assertEquals(citeJournalEntry(path, 0, digest).kind, "err");
  assertEquals(citeJournalEntry(path, 1, "short").kind, "err");
  // a write to the journal is refused by every file source
  const lens = { ...markdownLens(), create: () => ok({ path, text: "tampered\n" }) };
  const src = must(fileSource(store, lens, "."));
  const [id] = eventIds(1);
  assert(id !== undefined, "an id");
  const opened = must(makeEvent({ id, item: itemId(), at: instant(1), actor: ADA }, { type: "opened", kind: "task", title: "x", body: "", labels: [], assignees: [], origin: "declared" }));
  const dry = await applyPatch(src, must(makePatch("markdown", ".", opened)), instant(2));
  assert(dry.kind === "dry-run", "a preview");
  const refused = await applyPatch(src, must(makePatch("markdown", ".", opened)), instant(2), dry.preview.hash);
  assert(refused.kind === "failed" && refused.problem.kind === "refused", "the journal is not written");
  assertEquals((await snapshotOf(store))[path], line);
  void parsePrefix;
});
