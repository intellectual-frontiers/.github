// Spec: 0009-anyfs-merge-physical FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
/**
 * The laws a database keeps so that its rows can be dumped and replayed into another and be merged by the replaying alone, as typed code: which tables are the mergeable set (the version rows, whose primary key is the
 * id and the sum with a conflict rule that ignores a second insert, and the blobs, whose primary key is the SHA-256), which are derived (views and caches made only from those rows, never dumped as a source) and which are
 * local (the identity of the replica, whom it trusts, the epochs it holds, its caches: never in a dump and never written by an import); the procedure that makes a dump and replays it; the epoch that lets rows be
 * collected without a replay of an old dump bringing them back; and the identity of a replica, which a copy of a database does not keep.
 *
 * @example
 * ```ts
 * import { isMergeableTable, dumpCommand } from "./layout.ts";
 * isMergeableTable("anyfs_versions"); // true
 * dumpCommand("x.db"); // 'sqlite3 x.db ".dump --data-only anyfs_versions anyfs_blobs"'
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Fingerprint, type ReplicaId, type Version, type VersionVector } from "@intellectual-frontiers/anyfs/governance";
import { versionKey } from "./rows.ts";

/** The tables a dump carries: the version rows (primary key `id` with `sum`, on conflict ignore, without a rowid) and the blobs (primary key `sha`, on conflict ignore). A row of them is immutable and an equal key is an equal row. */
export const MERGEABLE_TABLES = ["anyfs_versions", "anyfs_blobs"] as const;
/** The tables made from the rows and nothing else: the heads, the names, the siblings and the vector. Views, or caches a rebuild makes again, and never dumped as a source. */
export const DERIVED_TABLES = ["anyfs_heads", "anyfs_names", "anyfs_siblings", "anyfs_vector"] as const;
/** The tables that belong to one replica: its identity, the trust it gives, the epochs it holds and its caches. An import never writes them. */
export const LOCAL_TABLES = ["anyfs_meta", "anyfs_trust", "anyfs_epochs", "anyfs_cache"] as const;

/** The three kinds of table of a merge database. */
export type TableKind = "mergeable" | "derived" | "local";

/** What kind of table a table is, or nothing where it is none of ours. */
export function kindOfTable(name: string): TableKind | undefined {
  if ((MERGEABLE_TABLES as readonly string[]).includes(name)) return "mergeable";
  if ((DERIVED_TABLES as readonly string[]).includes(name)) return "derived";
  if ((LOCAL_TABLES as readonly string[]).includes(name)) return "local";
  return undefined;
}

/** Whether a table is one a dump carries. */
export const isMergeableTable = (name: string): boolean => kindOfTable(name) === "mergeable";

/** The columns of the version table, in order: no autoincrement, no column unique but the key, nothing that depends on the order of an import. `merged` is the ids merged with, as a list of text. */
export const VERSION_COLUMNS = ["id", "sum", "replica", "seq", "path", "parent", "merged", "kind", "blob"] as const;
/** The columns of the blob table: the digest and the bytes. */
export const BLOB_COLUMNS = ["sha", "bytes"] as const;

/** The command that makes the dump of a database: the data of the mergeable tables alone, as one `INSERT` for each row, with no schema. */
export const dumpCommand = (database: string): string => `sqlite3 ${database} ".dump --data-only ${MERGEABLE_TABLES.join(" ")}"`;

/** The steps of taking a dump into a database, in order: make the schema first (a dump has none, and a full dump with its schema cannot be replayed twice), replay each dump inside one transaction in any order and as often as you like, and then verify, because a raw import passed through no check of ours. */
export const RESTORE_STEPS = ["create-schema", "replay-in-one-transaction", "verify"] as const;

/** The conflict rule of the primary key of a mergeable table: ignore the second row, so that replaying a dump twice, or two overlapping dumps, is replaying their union. */
export const CONFLICT_RULE = "ON CONFLICT IGNORE" as const;

/** How trust is held where a raw import bypasses the application: a trigger before the insert refuses a row of a replica that is not in the trust table, and the verify step checks the rest (sums, ids, blobs, time), which a trigger cannot. */
export const IMPORT_CHECKS = { trigger: ["replica-in-trust-table"], verify: ["sum", "id", "blob-digest", "future-id", "duplicate-id", "dangling-parent", "missing-blob"] } as const;

/** An epoch: a compaction of the rows against a roster of replicas that is known to be complete. A row whose number the horizon covers is dead unless the epoch retains its key, so that replaying an old dump cannot bring back what was collected. */
export type Epoch = { readonly n: number; readonly horizon: VersionVector; readonly roster: readonly ReplicaId[]; readonly retained: readonly string[] };

/**
 * The horizon of a roster: for each replica, the least number any replica of the roster holds of its rows. Every replica of the roster must have reported its vector: otherwise the roster is not known to be complete,
 * and the refusal says who is missing.
 */
export function horizonOf(reports: Readonly<Record<string, VersionVector>>, roster: readonly ReplicaId[]): Result<VersionVector, string> {
  if (roster.length === 0) return err("a roster is at least one replica");
  for (const who of roster) if (reports[who] === undefined) return err(`replica ${who} has not reported what it holds: the roster is not known to be complete`);
  const horizon: Record<string, number> = {};
  for (const replica of roster) {
    const least = Math.min(...roster.map((who) => (reports[who] as VersionVector)[replica] ?? 0));
    if (least > 0) horizon[replica] = least;
  }
  return ok(horizon);
}

/** Whether a row is dead after an epoch: its number is covered by the horizon and the epoch does not retain it. */
export function deadAfter(epoch: Epoch, v: Version): boolean {
  return v.seq <= (epoch.horizon[v.replica] ?? 0) && !epoch.retained.includes(versionKey(v));
}

/** What a replica keeps of its identity: who it is and what the host it was made on was. */
export type StoredIdentity = { readonly replica: ReplicaId; readonly fingerprint: Fingerprint };

/** What opening a database ended with: the identity to use, and whether the database is a copy that was given a new one. */
export type Identity = { readonly replica: ReplicaId; readonly fingerprint: Fingerprint; readonly forkedFrom: ReplicaId | undefined };

/**
 * The identity of a replica when its database is opened. Where the database holds one and the fingerprint is the one the host makes now, it is kept. Where the fingerprint is not (the file was copied, or restored
 * from a backup into another place), the replica takes a new identity, so that two copies never make the same ids, and says which it was copied from. Nothing was stored: a new identity.
 */
export function openIdentity(stored: StoredIdentity | undefined, now: Fingerprint, fresh: () => ReplicaId): Identity {
  if (stored !== undefined && stored.fingerprint === now) return { replica: stored.replica, fingerprint: now, forkedFrom: undefined };
  return { replica: fresh(), fingerprint: now, forkedFrom: stored?.replica };
}
