/**
 * Tests of the layout laws of a merge database (commons anyfs 0009-anyfs-merge-physical FR-001 to FR-007): the three kinds of table and which a dump carries, the commands and steps of a dump and its replay, the
 * checks a raw import is held to, the identity of a replica that is a copy, and the epoch that lets rows be collected with no old dump bringing them back.
 *
 * @module
 */
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { type Fingerprint, type ReplicaId, replicaIdOfBytes, type Version } from "../src/governance/mod.ts";
import {
  applyDelta,
  BLOB_COLUMNS,
  CONFLICT_RULE,
  DERIVED_TABLES,
  deadAfter,
  deltaSince,
  dumpCommand,
  type Epoch,
  horizonOf,
  IMPORT_CHECKS,
  isMergeableTable,
  kindOfTable,
  LOCAL_TABLES,
  MERGEABLE_TABLES,
  type MergeState,
  newState,
  openIdentity,
  RESTORE_STEPS,
  defaultConfig,
  transact,
  vectorOf,
  versionKey,
  VERSION_COLUMNS,
  viewOf,
  viewText,
  withBlob,
  withVersion,
} from "../src/merge/mod.ts";

const rid = (n: number): ReplicaId => {
  const r = replicaIdOfBytes(new Uint8Array(16).fill(n));
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};
const enc = new TextEncoder();
const open = (r: ReplicaId): MergeState => newState(r, { ...defaultConfig(r), trust: { kind: "open" } });

async function put(s: MergeState, path: string, text: string, wall: number): Promise<MergeState> {
  const sha = await sha256(enc.encode(text));
  const m = await transact(s, [{ kind: "put", path, blob: sha }], new Map([[sha, enc.encode(text)]]), wall);
  if (m.kind === "err") throw new Error(m.error);
  return m.value.state;
}

proves(["0009-anyfs-merge-physical FR-001", "0009-anyfs-merge-physical FR-002"], "the tables are three kinds that share none: the mergeable set is the rows and the blobs, what is derived is made from them and never dumped, and what is local is never in a dump", () => {
  const all = [...MERGEABLE_TABLES, ...DERIVED_TABLES, ...LOCAL_TABLES];
  assertEquals(new Set(all).size, all.length);
  for (const t of MERGEABLE_TABLES) assertEquals(kindOfTable(t), "mergeable");
  for (const t of DERIVED_TABLES) assertEquals(kindOfTable(t), "derived");
  for (const t of LOCAL_TABLES) assertEquals(kindOfTable(t), "local");
  assertEquals(kindOfTable("other"), undefined);
  assert(isMergeableTable("anyfs_versions") && isMergeableTable("anyfs_blobs") && !isMergeableTable("anyfs_meta") && !isMergeableTable("anyfs_heads"));
});

proves(["0009-anyfs-merge-physical FR-003", "0009-anyfs-merge-physical FR-004"], "the version table has no autoincrement and no key but the id with the sum, and the dump is the data of the mergeable tables alone, replayed after the schema is made", () => {
  assertEquals([...VERSION_COLUMNS], ["id", "sum", "replica", "seq", "path", "parent", "merged", "kind", "blob"]);
  assertEquals([...BLOB_COLUMNS], ["sha", "bytes"]);
  for (const c of [...VERSION_COLUMNS, ...BLOB_COLUMNS]) assert(!/rowid|autoincrement|serial/iu.test(c), c);
  assertEquals(CONFLICT_RULE, "ON CONFLICT IGNORE");
  assertEquals(dumpCommand("x.db"), 'sqlite3 x.db ".dump --data-only anyfs_versions anyfs_blobs"');
  assertEquals([...RESTORE_STEPS], ["create-schema", "replay-in-one-transaction", "verify"]);
  assert(IMPORT_CHECKS.trigger.includes("replica-in-trust-table"));
  for (const c of ["sum", "id", "blob-digest", "future-id", "duplicate-id", "dangling-parent", "missing-blob"]) assert((IMPORT_CHECKS.verify as readonly string[]).includes(c), c);
});

proves(["0009-anyfs-merge-physical FR-005"], "a replica takes its identity from the fingerprint of the host: where it is not the one stored, the database is a copy and the replica is a new one that says which it was copied from", () => {
  const fp = (t: string): Fingerprint => t as Fingerprint;
  let n = 100;
  const fresh = (): ReplicaId => rid(++n);
  assertEquals(openIdentity(undefined, fp("host-1"), fresh), { replica: rid(101), fingerprint: fp("host-1"), forkedFrom: undefined });
  assertEquals(openIdentity({ replica: rid(7), fingerprint: fp("host-1") }, fp("host-1"), fresh).replica, rid(7));
  const copy = openIdentity({ replica: rid(7), fingerprint: fp("host-1") }, fp("host-2"), fresh);
  assertEquals(copy.forkedFrom, rid(7));
  assert(copy.replica !== rid(7));
});

proves(["0009-anyfs-merge-physical FR-006"], "the horizon of a roster is what every replica of it holds, is refused where a replica has not reported, and a row it covers is dead unless the epoch retains it", async () => {
  assertEquals(horizonOf({}, []).kind, "err");
  assertEquals(horizonOf({ [rid(1)]: { [rid(1)]: 3 } }, [rid(1), rid(2)]).kind, "err");
  const h = horizonOf({ [rid(1)]: { [rid(1)]: 5, [rid(2)]: 2 }, [rid(2)]: { [rid(1)]: 3, [rid(2)]: 4 } }, [rid(1), rid(2)]);
  assertEquals(h.kind === "ok" ? h.value : undefined, { [rid(1)]: 3, [rid(2)]: 2 });
  const a = await put(open(rid(1)), "p", "x", 1000);
  const row = [...a.versions.values()][0] as Version;
  const epoch: Epoch = { n: 1, horizon: { [rid(1)]: 1 }, roster: [rid(1)], retained: [] };
  assert(deadAfter(epoch, row));
  assert(!deadAfter({ ...epoch, retained: [versionKey(row)] }, row));
  assert(!deadAfter({ ...epoch, horizon: {} }, row));
});

proves(["0009-anyfs-merge-physical FR-007"], "after an epoch, replaying an old dump does not bring back a file that was deleted and collected, and rows made after the horizon still count", async () => {
  // A writes p, B takes it, A deletes p, B takes the delete: all hold the same rows
  let a = open(rid(1));
  let b = open(rid(2));
  a = await put(a, "p", "v1", 1000);
  b = (await applyDelta(b, deltaSince(a, vectorOf(b)), 1001)).state;
  const old = [...a.versions.values()];
  const oldBlobs = new Map(a.blobs);
  const gone = await transact(a, [{ kind: "remove", path: "p" }], new Map(), 1100);
  if (gone.kind === "err") throw new Error(gone.error);
  a = gone.value.state;
  b = (await applyDelta(b, deltaSince(a, vectorOf(b)), 1101)).state;
  // the roster {A, B} has agreed on every row: the epoch covers them all and retains nothing
  const horizon = horizonOf({ [rid(1)]: vectorOf(a), [rid(2)]: vectorOf(b) }, [rid(1), rid(2)]);
  if (horizon.kind === "err") throw new Error(horizon.error);
  const epoch: Epoch = { n: 1, horizon: horizon.value, roster: [rid(1), rid(2)], retained: [] };
  const fold = (rows: readonly Version[], blobs: ReadonlyMap<string, Uint8Array>, withEpoch: boolean): MergeState => {
    let s = open(rid(9));
    for (const [sha, bytes] of blobs) s = withBlob(s, sha, bytes);
    for (const v of rows) if (!withEpoch || !deadAfter(epoch, v)) s = withVersion(s, v);
    return s;
  };
  // without the epoch the old dump alone brings the file back; with it, the file stays gone
  assert(viewOf(fold(old, oldBlobs, false), "p").present, "an old dump on its own shows the file");
  assertEquals(viewText(fold(old, oldBlobs, true)), "");
  // the whole of what A holds with the old dump replayed again is the same as without it
  const everything = [...a.versions.values(), ...old];
  assertEquals(viewText(fold(everything, oldBlobs, true)), viewText(fold([], new Map(), true)));
  // a row made after the horizon is alive
  const later = await put(a, "q", "new", 1200);
  assert(viewOf(fold([...later.versions.values()], later.blobs, true), "q").present);
});
