// Spec: 0009-anyfs-merge-physical FR-011, FR-012
/**
 * The conformance suite of a store that merges: the laws every replica obeys, written as cases that run against replicas a backend makes. They are the laws a SQL dump of such a database relies on: a merge is a union of
 * rows, so it is the same in any order, however grouped and however often, and what a path holds is a function of the rows alone. A case needs replicas that trust one another, and the cases of refusal need one that does
 * not; each failure is a sentence that says what differed. The suite is held by a test that runs it against deliberately broken replicas and sees each one fail.
 *
 * @example
 * ```ts
 * import { runMergeConformance } from "./merge.ts";
 * // const report = await runMergeConformance(async (n, o) => replicasOfMyBackend(n, o))
 * ```
 *
 * @module
 */
import {
  type Delta,
  expectAny,
  type MergeOutcome,
  parsePath,
  type Path,
  ROOT,
  type Revision,
  type ReplicaId,
  type VersionVector,
  makeVersionId,
  describeProblem,
  type Problem,
} from "@intellectual-frontiers/anyfs/governance";
import type { Result } from "@intellectual-frontiers/core";
import { blobSha, deltaId, makeVersion, toBase64 } from "@intellectual-frontiers/anyfs/merge";
import type { Store } from "../store.ts";
import { ConformanceFailure, expect } from "./kit.ts";

/** The capabilities a replica under test has. */
export type MergeFaceCapabilities = "read" | "write" | "list" | "stat" | "delete" | "merge" | "history";

/** A replica as the suite sees it: its store, who it is and, where it can say so, the heads of a path that did not win. */
export type MergeFace = {
  readonly store: Store<MergeFaceCapabilities>;
  readonly replica: ReplicaId;
  readonly siblings?: (path: Path) => readonly { readonly id: string }[];
};

/** What a backend gives the suite: that many new replicas that hold nothing, trusting one another or, where `trusting` is false, taking changes from themselves alone. */
export type MakeReplicas = (count: number, options: { readonly trusting: boolean }) => Promise<readonly MergeFace[]>;

/** A case of the merge suite. */
export type MergeCase = { readonly id: string; readonly title: string; readonly run: (make: MakeReplicas) => Promise<void> };

const enc = new TextEncoder();
const dec = new TextDecoder();
const p = (s: string): Path => {
  const r = parsePath(s);
  if (r.kind === "err") throw new ConformanceFailure(`the suite names ${JSON.stringify(s)}, which is not a path: ${r.error}`);
  return r.value;
};
const ok = <T>(r: Result<T, Problem>, what: string): T => {
  if (r.kind === "err") throw new ConformanceFailure(`${what}: expected ok, the store said ${describeProblem(r.error)}`);
  return r.value;
};

const put = async (f: MergeFace, path: string, text: string): Promise<void> => {
  ok(await f.store.write(p(path), enc.encode(text), expectAny), `write ${path}`);
};
const del = async (f: MergeFace, path: string): Promise<void> => {
  ok(await f.store.delete(p(path), expectAny), `delete ${path}`);
};

/** What a replica holds as one text: every path that is there, with its bytes and the revisions of its history. */
async function snapshot(f: MergeFace): Promise<string> {
  const listing = ok(await f.store.list(ROOT, { limit: 10000 }), "list");
  const rows: string[] = [];
  for (const e of listing.entries) {
    const r = ok(await f.store.read(e.path), `read ${e.path}`);
    const h = ok(await f.store.history(e.path, 10000), `history ${e.path}`);
    rows.push(`${e.path}=${dec.decode(r.bytes)}@${r.rev}#${h.versions.map((v) => v.rev).sort().join(",")}`);
  }
  return rows.join("\n");
}

async function pull(from: MergeFace, to: MergeFace): Promise<MergeOutcome> {
  const since = ok(await to.store.versionVector(), "versionVector");
  const delta = ok(await from.store.deltaSince(since), "deltaSince");
  return ok(await to.store.applyDelta(delta), "applyDelta");
}

async function settle(faces: readonly MergeFace[]): Promise<void> {
  for (let round = 0; round < faces.length + 1; round++) {
    for (const a of faces) for (const b of faces) if (a !== b) await pull(a, b);
  }
}

async function same(faces: readonly MergeFace[], what: string): Promise<string> {
  const texts = await Promise.all(faces.map(snapshot));
  const first = texts[0] ?? "";
  for (let i = 1; i < texts.length; i++) if (texts[i] !== first) throw new ConformanceFailure(`${what}: replica 0 holds ${JSON.stringify(first)} and replica ${i} holds ${JSON.stringify(texts[i])}`);
  return first;
}

const dominates = (a: VersionVector, b: VersionVector): boolean => Object.entries(b).every(([r, n]) => (a[r] ?? 0) >= n);

const script = async (a: MergeFace, b: MergeFace, c: MergeFace): Promise<void> => {
  await put(a, "docs/a.txt", "a1");
  await put(b, "docs/b.txt", "b1");
  await put(c, "docs/a.txt", "c-a");
  await put(a, "docs/a.txt", "a2");
  await put(b, "x", "b-x");
  await del(c, "x");
  await put(c, "x", "c-x2");
  await put(b, "docs/b.txt", "b2");
  await del(b, "docs/b.txt");
  await put(a, "docs/b.txt", "a-b");
};

/** Every case of the merge suite. */
export const MERGE_CASES: readonly MergeCase[] = [
  {
    id: "convergence",
    title: "replicas that have taken one another's changes hold the same files, whichever replica took which first",
    run: async (make) => {
      const [a, b, c] = await make(3, { trusting: true });
      if (a === undefined || b === undefined || c === undefined) throw new ConformanceFailure("the backend made fewer than three replicas");
      await script(a, b, c);
      await settle([a, b, c]);
      const text = await same([a, b, c], "after every pair exchanged");
      expect(text.includes("docs/a.txt") && text.includes("x="), `the files are not all there: ${JSON.stringify(text)}`);
    },
  },
  {
    id: "any-topology",
    title: "a chain, a star and an all-pairs exchange end with the same files",
    run: async (make) => {
      const texts: string[] = [];
      for (const topology of ["chain", "star", "pairs"] as const) {
        const [a, b, c] = await make(3, { trusting: true });
        if (a === undefined || b === undefined || c === undefined) throw new ConformanceFailure("the backend made fewer than three replicas");
        await script(a, b, c);
        if (topology === "chain") {
          await pull(a, b);
          await pull(b, c);
          await pull(c, b);
          await pull(b, a);
        } else if (topology === "star") {
          await pull(a, b);
          await pull(c, b);
          await pull(b, a);
          await pull(b, c);
        } else await settle([a, b, c]);
        texts.push(await same([a, b, c], `the ${topology}`));
      }
      expect(texts[0] === texts[1] && texts[1] === texts[2], `the topologies end with different files: ${JSON.stringify(texts)}`);
    },
  },
  {
    id: "commutative",
    title: "two deltas taken in either order end with the same files",
    run: async (make) => {
      const [a, b, x, y] = await make(4, { trusting: true });
      if (a === undefined || b === undefined || x === undefined || y === undefined) throw new ConformanceFailure("the backend made fewer than four replicas");
      await put(a, "k", "from-a");
      await put(b, "k", "from-b");
      await put(a, "only-a", "1");
      await put(b, "only-b", "2");
      const da = ok(await a.store.deltaSince({}), "deltaSince a");
      const db = ok(await b.store.deltaSince({}), "deltaSince b");
      ok(await x.store.applyDelta(da), "x takes a");
      ok(await x.store.applyDelta(db), "x takes b");
      ok(await y.store.applyDelta(db), "y takes b");
      ok(await y.store.applyDelta(da), "y takes a");
      await same([x, y], "taken in the two orders");
    },
  },
  {
    id: "idempotent",
    title: "a delta taken twice is the delta taken once: the second time it is a duplicate and nothing changes",
    run: async (make) => {
      const [a, b] = await make(2, { trusting: true });
      if (a === undefined || b === undefined) throw new ConformanceFailure("the backend made fewer than two replicas");
      await put(a, "f", "one");
      await put(a, "g", "two");
      const d = ok(await a.store.deltaSince({}), "deltaSince");
      const first = ok(await b.store.applyDelta(d), "first");
      expect(first.kind === "applied", `the first taking ended ${first.kind}`);
      const before = await snapshot(b);
      const vector = ok(await b.store.versionVector(), "vector");
      const second = ok(await b.store.applyDelta(d), "second");
      expect(second.kind === "duplicate", `the second taking ended ${second.kind}, not duplicate`);
      expect((await snapshot(b)) === before, "taking the delta a second time changed the files");
      expect(JSON.stringify(ok(await b.store.versionVector(), "vector")) === JSON.stringify(vector), "taking the delta a second time changed the version vector");
    },
  },
  {
    id: "vector-monotonic",
    title: "what a replica has seen never goes back: after a change or a delta its vector holds at least what it held",
    run: async (make) => {
      const [a, b] = await make(2, { trusting: true });
      if (a === undefined || b === undefined) throw new ConformanceFailure("the backend made fewer than two replicas");
      let vector = ok(await b.store.versionVector(), "vector");
      for (const step of ["a", "b", "c"]) {
        await put(a, `m/${step}`, step);
        await pull(a, b);
        await put(b, `n/${step}`, step);
        const now = ok(await b.store.versionVector(), "vector");
        expect(dominates(now, vector), `the vector went back: ${JSON.stringify(vector)} then ${JSON.stringify(now)}`);
        vector = now;
      }
    },
  },
  {
    id: "delete-recreate",
    title: "a delete and a new write of the same path made at the same time end with the same file on both replicas, and a later write brings it back",
    run: async (make) => {
      const [a, b] = await make(2, { trusting: true });
      if (a === undefined || b === undefined) throw new ConformanceFailure("the backend made fewer than two replicas");
      await put(a, "p", "v1");
      await pull(a, b);
      await del(a, "p");
      await put(b, "p", "b-v2");
      await settle([a, b]);
      await same([a, b], "after a delete and a write at the same time");
      await del(a, "gone");
      await put(a, "p", "later");
      await settle([a, b]);
      const text = await same([a, b], "after the later write");
      expect(text.includes("p=later"), `the later write is not the file: ${JSON.stringify(text)}`);
    },
  },
  {
    id: "siblings",
    title: "two writes that replaced the same version both survive: one wins on every replica and the other is kept in the history",
    run: async (make) => {
      const [a, b] = await make(2, { trusting: true });
      if (a === undefined || b === undefined) throw new ConformanceFailure("the backend made fewer than two replicas");
      await put(a, "s", "base");
      await pull(a, b);
      await put(a, "s", "from-a");
      await put(b, "s", "from-b");
      await settle([a, b]);
      const text = await same([a, b], "after two writes of one version");
      const revA = await revOf("from-a");
      const revB = await revOf("from-b");
      expect(text.includes(String(revA)) && text.includes(String(revB)), `both writes should be in the history: ${JSON.stringify(text)}`);
      const winner = text.includes("s=from-a") ? "from-a" : "from-b";
      expect(text.includes(`s=${winner}`), "one of the two writes should be the file");
      if (a.siblings !== undefined && b.siblings !== undefined) {
        expect(a.siblings(p("s")).length === 1 && b.siblings(p("s")).length === 1, "the loser should be the one sibling of the path on both replicas");
      }
    },
  },
  {
    id: "deferral",
    title: "a delta whose rows replace a row that is not held waits, and is applied when that row arrives",
    run: async (make) => {
      const [a, b] = await make(2, { trusting: true });
      if (a === undefined || b === undefined) throw new ConformanceFailure("the backend made fewer than two replicas");
      await put(a, "d", "one");
      const d1 = ok(await a.store.deltaSince({}), "d1");
      const seen = ok(await a.store.versionVector(), "vector");
      await put(a, "d", "two");
      const d2 = ok(await a.store.deltaSince(seen), "d2");
      const early = ok(await b.store.applyDelta(d2), "the second delta first");
      expect(early.kind === "deferred", `a delta whose parent is missing ended ${early.kind}, not deferred`);
      const nothing = ok(await b.store.list(ROOT), "list");
      expect(nothing.entries.length === 0, "a deferred delta changed the files");
      ok(await b.store.applyDelta(d1), "the first delta");
      const r = ok(await b.store.read(p("d")), "read after both");
      expect(dec.decode(r.bytes) === "two", `after both deltas the file is ${JSON.stringify(dec.decode(r.bytes))}, not two`);
    },
  },
  {
    id: "trust",
    title: "a replica that trusts itself alone refuses a delta from another",
    run: async (make) => {
      const [a, b] = await make(2, { trusting: false });
      if (a === undefined || b === undefined) throw new ConformanceFailure("the backend made fewer than two replicas");
      await put(a, "t", "x");
      const d = ok(await a.store.deltaSince({}), "deltaSince");
      const out = ok(await b.store.applyDelta(d), "applyDelta");
      expect(out.kind === "refused" && out.refusal.kind === "trust", `a delta from a replica that is not trusted ended ${JSON.stringify(out)}`);
      expect(ok(await b.store.list(ROOT), "list").entries.length === 0, "a refused delta changed the files");
    },
  },
  {
    id: "hostile",
    title: "a delta with a row that is not its checksum, bytes that are not their digest or an id from the far future is refused, and changes nothing",
    run: async (make) => {
      const [a, b] = await make(2, { trusting: true });
      if (a === undefined || b === undefined) throw new ConformanceFailure("the backend made fewer than two replicas");
      await put(a, "h", "honest");
      const honest = ok(await a.store.deltaSince({}), "deltaSince");
      const row = honest.versions[0];
      if (row === undefined) throw new ConformanceFailure("a write made no row");
      const tampered: Delta = { ...honest, versions: [{ ...row, path: "elsewhere" }] };
      const t = ok(await b.store.applyDelta(tampered), "tampered row");
      expect(t.kind === "refused" && t.refusal.kind === "bad-sum", `a row that is not its checksum ended ${JSON.stringify(t)}`);
      const blob = honest.blobs[0];
      if (blob === undefined) throw new ConformanceFailure("a put made no blob");
      const wrongBytes: Delta = { ...honest, blobs: [{ sha: blob.sha, bytes: toBase64(enc.encode("not the bytes")) }] };
      const w = ok(await b.store.applyDelta(wrongBytes), "wrong bytes");
      expect(w.kind === "refused" && w.refusal.kind === "bad-blob", `bytes that are not their digest ended ${JSON.stringify(w)}`);
      const sha = await blobSha(enc.encode("future"));
      const far = await makeVersion({ id: makeVersionId({ ms: Date.now() + 10 * 365 * 86_400_000, counter: 0 }, a.replica), replica: a.replica, seq: 99, path: "f", parent: null, merged: [], kind: "put", blob: sha });
      if (far.kind === "err") throw new ConformanceFailure(far.error);
      const future = ok(await b.store.applyDelta({ format: 1, origin: a.replica, versions: [far.value], blobs: [{ sha, bytes: toBase64(enc.encode("future")) }] }), "future id");
      expect(future.kind === "refused" && future.refusal.kind === "future-id", `an id ten years ahead ended ${JSON.stringify(future)}`);
      expect(ok(await b.store.list(ROOT), "list").entries.length === 0, "a refused delta changed the files");
    },
  },
  {
    id: "duplicate-id",
    title: "a row with the id of a row held and another sum is kept beside it and reported, never dropped in silence",
    run: async (make) => {
      const [a, b] = await make(2, { trusting: true });
      if (a === undefined || b === undefined) throw new ConformanceFailure("the backend made fewer than two replicas");
      await put(a, "dup", "real");
      const honest = ok(await a.store.deltaSince({}), "deltaSince");
      const row = honest.versions[0];
      if (row === undefined) throw new ConformanceFailure("a write made no row");
      const sha = await blobSha(enc.encode("forged"));
      const forged = await makeVersion({ id: row.id, replica: row.replica, seq: row.seq, path: row.path, parent: row.parent, merged: row.merged, kind: "put", blob: sha });
      if (forged.kind === "err") throw new ConformanceFailure(forged.error);
      ok(await b.store.applyDelta(honest), "the honest row");
      const out = ok(await b.store.applyDelta({ format: 1, origin: row.replica, versions: [forged.value], blobs: [{ sha, bytes: toBase64(enc.encode("forged")) }] }), "the forged row");
      expect(out.kind === "applied" && out.findings.some((f) => f.kind === "duplicate-id"), `a row with a held id and another sum ended ${JSON.stringify(out)}: it should be applied with a duplicate-id finding`);
    },
  },
  {
    id: "identity-of-delta",
    title: "a delta has one identity: the same rows made into a delta twice have the same id",
    run: async (make) => {
      const [a] = await make(1, { trusting: true });
      if (a === undefined) throw new ConformanceFailure("the backend made no replica");
      await put(a, "i", "x");
      const one = ok(await a.store.deltaSince({}), "one");
      const two = ok(await a.store.deltaSince({}), "two");
      expect((await deltaId(one)) === (await deltaId(two)), "the same rows have two identities");
    },
  },
];

async function revOf(text: string): Promise<Revision> {
  return `sha256:${await blobSha(enc.encode(text))}` as Revision;
}

/** What one case did. */
export type MergeCaseReport = { readonly id: string; readonly title: string; readonly failure?: string };

/** Runs one case, and reports it with its failure as a sentence. */
export async function runMergeCase(c: MergeCase, make: MakeReplicas): Promise<MergeCaseReport> {
  try {
    await c.run(make);
    return { id: c.id, title: c.title };
  } catch (thrown) {
    const message = thrown instanceof ConformanceFailure ? thrown.message : thrown instanceof Error ? `${thrown.name}: ${thrown.message}` : String(thrown);
    return { id: c.id, title: c.title, failure: message };
  }
}

/** Runs every case of the merge suite against replicas made by `make`, and reports each. */
export async function runMergeConformance(make: MakeReplicas): Promise<readonly MergeCaseReport[]> {
  const reports: MergeCaseReport[] = [];
  for (const c of MERGE_CASES) reports.push(await runMergeCase(c, make));
  return reports;
}
