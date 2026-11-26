// Spec: 0005-sql-store FR-008
/**
 * The one module that knows the tables: every statement the store runs, by name, with the names of the tables and of the columns. The store (`store.ts`), the merge (`merge.ts`) and the dump (`dump.ts`) hold the rules of
 * an operation and call these by name, and the layout (`schema.ts`) makes the tables and views these statements read: a different layout of the rows is a different module with the same names, and nothing else in
 * the library changes with it. The rows are the version rows and the blobs; what a path holds is read from the views the layout makes, or from the rows of the path, and nothing is ever written to a view.
 *
 * @example
 * ```ts
 * import { layoutOf } from "./layout.ts";
 * const l = layoutOf(sqlFor("sqlite", naming));
 * l.selectLastId().done(); // { text: "SELECT MAX(id) AS id FROM anyfs_versions", params: [] }
 * ```
 *
 * @module
 */
import type { Version } from "@intellectual-frontiers/anyfs/governance";
import type { Query, Sql } from "./sql.ts";

/** The statements of the layout, by what each does. Each returns the builder of one statement. */
export type Layout = ReturnType<typeof layoutOf>;

/** How many values a statement is given at a time where it names a list: well below the limit of any engine. */
export const CHUNK = 400;

/** The statements of the layout of the tables of a store, in the dialect of its statements. */
export function layoutOf(sql: Sql) {
  const range = (q: Query, column: string, prefix: string): void => {
    if (prefix === "") return;
    q.text(" AND ").text(column).text(" >= ").param(`${prefix}/`).text(" AND ").text(column).text(" < ").param(`${prefix}0`);
  };
  const inList = (q: Query, values: readonly string[]): void => {
    q.text("(");
    values.forEach((v, i) => {
      if (i > 0) q.text(", ");
      q.param(v);
    });
    q.text(")");
  };
  const VERSION_SELECT = "SELECT id, sum, replica, seq, path, parent, merged, kind, blob FROM ";

  return {
    // ---- the order of writers
    /**
     * What makes the writers of a store go one after another, or nothing where the engine does it already: SQLite takes the write lock at the start of a transaction and DuckDB has one connection, and PostgreSQL, where
     * two connections write side by side, takes an advisory lock that lasts to the end of the transaction, named by the tables of the store so that stores do not wait for one another.
     */
    lockWriters: (): Query | undefined => (sql.dialect === "postgres" ? sql.query().text("SELECT pg_advisory_xact_lock(hashtextextended(").param(sql.table("versions")).text(", 0))") : undefined),

    // ---- the rows of a path, and the clock of the replica
    /** Every version row of a path. */
    selectRowsOfPath: (path: string): Query => sql.query().text(VERSION_SELECT).table("versions").text(" WHERE path = ").param(path).text(" ORDER BY id, sum"),
    /** The greatest id held: the last time the replica made or took. */
    selectLastId: (): Query => sql.query().text("SELECT MAX(id) AS id FROM ").table("versions"),
    /** The greatest number held of the rows of a replica. */
    selectLastSeq: (replica: string): Query => sql.query().text("SELECT MAX(seq) AS seq FROM ").table("versions").text(" WHERE replica = ").param(replica),
    /** Adds a version row where its key is not held: the key comes back where it was added. */
    insertVersion: (v: Version): Query =>
      sql
        .query()
        .text("INSERT INTO ")
        .table("versions")
        .text(" (id, sum, replica, seq, path, parent, merged, kind, blob) VALUES (")
        .param(v.id)
        .text(", ")
        .param(v.sum)
        .text(", ")
        .param(v.replica)
        .text(", ")
        .param(v.seq)
        .text(", ")
        .param(v.path)
        .text(", ")
        .param(v.parent)
        .text(", ")
        .param(JSON.stringify(v.merged))
        .text(", ")
        .param(v.kind)
        .text(", ")
        .param(v.blob)
        .text(") ON CONFLICT DO NOTHING RETURNING id"),
    /** Adds a blob where its digest is not held: the digest comes back where it was added. */
    insertBlob: (sha: string, bytes: Uint8Array): Query => sql.query().text("INSERT INTO ").table("blobs").text(" (sha, bytes) VALUES (").param(sha).text(", ").bytes(bytes).text(") ON CONFLICT DO NOTHING RETURNING sha"),
    /** The bytes of a blob. */
    selectBlob: (sha: string): Query => sql.query().text("SELECT ").selectBytes("bytes").text(" FROM ").table("blobs").text(" WHERE sha = ").param(sha),
    /** Which of some digests are held as blobs. */
    selectBlobsHeld: (shas: readonly string[]): Query => {
      const q = sql.query().text("SELECT sha FROM ").table("blobs").text(" WHERE sha IN ");
      inList(q, shas);
      return q;
    },
    /** The keys of the rows that have one of some ids. */
    selectRowsOfIds: (ids: readonly string[]): Query => {
      const q = sql.query().text("SELECT id, sum FROM ").table("versions").text(" WHERE id IN ");
      inList(q, ids);
      return q;
    },
    /** The keys of the rows that have a number of a replica. */
    selectRowsOfSeq: (replica: string, seq: number): Query => sql.query().text("SELECT id, sum FROM ").table("versions").text(" WHERE replica = ").param(replica).text(" AND seq = ").param(seq),
    /** The rows past what a vector holds: of each replica the rows whose number is above its entry, and every row of a replica it has no entry for. */
    selectRowsSince: (since: Readonly<Record<string, number>>): Query => {
      const known = Object.keys(since).sort();
      const q = sql.query().text(VERSION_SELECT).table("versions");
      if (known.length === 0) return q.text(" ORDER BY id, sum");
      q.text(" WHERE replica NOT IN ");
      inList(q, known);
      for (const r of known) q.text(" OR (replica = ").param(r).text(" AND seq > ").param(since[r] ?? 0).text(")");
      return q.text(" ORDER BY id, sum");
    },
    /** A page of rows after a key, in the order of the key: what a check reads. */
    selectVersionsPage: (after: { readonly id: string; readonly sum: string } | undefined, limit: number): Query => {
      const q = sql.query().text(VERSION_SELECT).table("versions");
      if (after !== undefined) q.text(" WHERE (id > ").param(after.id).text(" OR (id = ").param(after.id).text(" AND sum > ").param(after.sum).text("))");
      return q.text(" ORDER BY id, sum LIMIT ").param(limit);
    },
    /** A page of blobs after a digest. */
    selectBlobsPage: (after: string | undefined, limit: number): Query => {
      const q = sql.query().text("SELECT sha, ").selectBytes("bytes").text(" FROM ").table("blobs");
      if (after !== undefined) q.text(" WHERE sha > ").param(after);
      return q.text(" ORDER BY sha LIMIT ").param(limit);
    },
    countVersions: (): Query => sql.query().text("SELECT COUNT(*) AS n FROM ").table("versions"),
    countBlobs: (): Query => sql.query().text("SELECT COUNT(*) AS n FROM ").table("blobs"),
    /** The rows whose parent or merged id is not held as the id of a row. */
    selectDangling: (limit: number): Query =>
      sql
        .query()
        .text("SELECT v.id AS id, v.parent AS ref FROM ")
        .table("versions")
        .text(" v WHERE v.parent IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ")
        .table("versions")
        .text(" p WHERE p.id = v.parent) LIMIT ")
        .param(limit),
    /** The rows that name a blob that is not held. */
    selectMissingBlobs: (limit: number): Query =>
      sql
        .query()
        .text("SELECT v.id AS id, v.blob AS ref FROM ")
        .table("versions")
        .text(" v WHERE v.blob IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ")
        .table("blobs")
        .text(" b WHERE b.sha = v.blob) LIMIT ")
        .param(limit),
    /** The ids that are on more than one row, and the numbers of a replica that are on more than one. */
    selectDuplicateIds: (limit: number): Query => sql.query().text("SELECT id AS subject FROM ").table("versions").text(" GROUP BY id HAVING COUNT(*) > 1 LIMIT ").param(limit),
    selectDuplicateSeqs: (limit: number): Query => sql.query().text("SELECT replica, seq FROM ").table("versions").text(" GROUP BY replica, seq HAVING COUNT(*) > 1 LIMIT ").param(limit),
    /** The replicas that have rows. */
    selectReplicasHeld: (): Query => sql.query().text("SELECT DISTINCT replica FROM ").table("versions").text(" ORDER BY replica"),

    // ---- the views
    /** The file at a path: its winner, its digest, its size and its bytes. */
    selectCurrent: (path: string): Query =>
      sql.query().text("SELECT n.id AS id, n.blob AS blob, " + sql.byteLength + "(b.bytes) AS size, ").selectBytes("bytes", "b").text(" FROM ").table("names").text(" n JOIN ").table("blobs").text(" b ON b.sha = n.blob WHERE n.path = ").param(path),
    /** The winner of a path, with the size of its bytes. */
    selectCurrentStat: (path: string): Query =>
      sql.query().text("SELECT n.id AS id, n.blob AS blob, " + sql.byteLength + "(b.bytes) AS size FROM ").table("names").text(" n JOIN ").table("blobs").text(" b ON b.sha = n.blob WHERE n.path = ").param(path),
    /** A page of the files below a prefix, after a path, in the order of the bytes of the paths: one more than the page, to know whether there is a next. */
    selectPage: (prefix: string, after: string | undefined, limit: number): Query => {
      const q = sql.query().text("SELECT n.path AS path, n.id AS id, n.blob AS blob, " + sql.byteLength + "(b.bytes) AS size FROM ").table("names").text(" n JOIN ").table("blobs").text(" b ON b.sha = n.blob WHERE 1 = 1");
      range(q, "n.path", prefix);
      if (after !== undefined) q.text(" AND n.path > ").param(after);
      return q.text(" ORDER BY n.path LIMIT ").param(limit + 1);
    },
    /** The versions of a path that are puts, newest first, with the size of their bytes. */
    selectHistory: (path: string, limit: number): Query =>
      sql
        .query()
        .text("SELECT v.id AS id, v.blob AS blob, " + sql.byteLength + "(b.bytes) AS size FROM ")
        .table("versions")
        .text(" v LEFT JOIN ")
        .table("blobs")
        .text(" b ON b.sha = v.blob WHERE v.path = ")
        .param(path)
        .text(" AND v.kind = 'put' ORDER BY v.id DESC, v.sum DESC LIMIT ")
        .param(limit),
    /** The siblings of a path: the heads that did not win. */
    selectSiblings: (path: string): Query => sql.query().text("SELECT id, kind, blob, replica FROM ").table("siblings").text(" WHERE path = ").param(path).text(" ORDER BY id DESC, sum DESC"),
    /** What the replica holds: for each replica, the number of its last row held with none missing before it. */
    selectVector: (): Query => sql.query().text("SELECT replica, n FROM ").table("vector"),

    // ---- the facts, the trust and what is held back
    selectFact: (key: string): Query => sql.query().text("SELECT value FROM ").table("meta").text(" WHERE key = ").param(key),
    upsertFact: (key: string, value: string): Query =>
      sql.query().text("INSERT INTO ").table("meta").text(" (key, value) VALUES (").param(key).text(", ").param(value).text(") ON CONFLICT (key) DO UPDATE SET value = excluded.value"),
    selectTrust: (): Query => sql.query().text("SELECT replica FROM ").table("trust").text(" ORDER BY replica"),
    insertTrust: (replica: string): Query => sql.query().text("INSERT INTO ").table("trust").text(" (replica) VALUES (").param(replica).text(") ON CONFLICT DO NOTHING"),
    deleteTrust: (replica: string): Query => sql.query().text("DELETE FROM ").table("trust").text(" WHERE replica = ").param(replica),
    insertPending: (key: string, text: string): Query =>
      sql.query().text("INSERT INTO ").table("cache").text(" (kind, key, value) VALUES ('pending', ").param(key).text(", ").param(text).text(") ON CONFLICT DO NOTHING"),
    selectPending: (): Query => sql.query().text("SELECT key, value FROM ").table("cache").text(" WHERE kind = 'pending' ORDER BY key"),
    deletePending: (key: string): Query => sql.query().text("DELETE FROM ").table("cache").text(" WHERE kind = 'pending' AND key = ").param(key),
    countPending: (): Query => sql.query().text("SELECT COUNT(*) AS n FROM ").table("cache").text(" WHERE kind = 'pending'"),
    selectEpochs: (): Query => sql.query().text("SELECT n, horizon, roster, retained, bound FROM ").table("epochs").text(" ORDER BY n"),
    insertEpoch: (n: number, horizon: string, roster: string, retained: string, bound: string): Query =>
      sql
        .query()
        .text("INSERT INTO ")
        .table("epochs")
        .text(" (n, horizon, roster, retained, bound) VALUES (")
        .param(n)
        .text(", ")
        .param(horizon)
        .text(", ")
        .param(roster)
        .text(", ")
        .param(retained)
        .text(", ")
        .param(bound)
        .text(")"),
    /** The heads whose number a horizon covers, with their path and kind. */
    selectCoveredHeads: (replica: string, upTo: number): Query =>
      sql.query().text("SELECT id, sum, path, kind FROM ").table("heads").text(" WHERE replica = ").param(replica).text(" AND seq <= ").param(upTo),
    /** The rows of a replica whose number a horizon covers. */
    selectCovered: (replica: string, upTo: number): Query => sql.query().text("SELECT id, sum FROM ").table("versions").text(" WHERE replica = ").param(replica).text(" AND seq <= ").param(upTo),
    /** The numbers of the rows of a replica above a floor, in order. */
    selectSeqsAbove: (replica: string, floor: number): Query => sql.query().text("SELECT seq FROM ").table("versions").text(" WHERE replica = ").param(replica).text(" AND seq > ").param(floor).text(" ORDER BY seq"),
    insertRetired: (replica: string, value: string): Query =>
      sql.query().text("INSERT INTO ").table("cache").text(" (kind, key, value) VALUES ('retired', ").param(replica).text(", ").param(value).text(") ON CONFLICT DO NOTHING"),
    selectRetired: (): Query => sql.query().text("SELECT key, value FROM ").table("cache").text(" WHERE kind = 'retired' ORDER BY key"),
    deleteVersion: (id: string, sum: string): Query => sql.query().text("DELETE FROM ").table("versions").text(" WHERE id = ").param(id).text(" AND sum = ").param(sum),
    deleteBlobsUnnamed: (): Query =>
      sql.query().text("DELETE FROM ").table("blobs").text(" WHERE sha NOT IN (SELECT blob FROM ").table("versions").text(" WHERE blob IS NOT NULL)"),

    // ---- the search table, which is derived
    deleteWords: (path: string): Query => sql.query().text("DELETE FROM ").table("search").text(" WHERE path = ").param(path),
    deleteAllWords: (): Query => sql.query().text("DELETE FROM ").table("search"),
    insertWords: (path: string, text: string): Query => sql.query().text("INSERT INTO ").table("search").text(" (path, text) VALUES (").param(path).text(", ").param(text).text(")"),
    searchWords: (prefix: string, words: string, limit: number): Query => {
      if (sql.dialect === "postgres") {
        // the words are plain text for `plainto_tsquery`, which joins them with AND and has no operator a caller could write
        const p = sql.query().text("SELECT n.path AS path, n.blob AS blob FROM ").table("search").text(" s JOIN ").table("names").text(" n ON n.path = s.path WHERE s.tsv @@ plainto_tsquery('simple', ").param(words).text(")");
        range(p, "n.path", prefix);
        return p.text(" ORDER BY ts_rank(s.tsv, plainto_tsquery('simple', ").param(words).text(")) DESC, n.path LIMIT ").param(limit);
      }
      const q = sql.query().text("SELECT n.path AS path, n.blob AS blob FROM ").table("search").text(" JOIN ").table("names").text(" n ON n.path = ").table("search").text(".path WHERE ").table("search").text(" MATCH ").param(words);
      range(q, "n.path", prefix);
      return q.text(" ORDER BY rank, n.path LIMIT ").param(limit);
    },
    /** The files whose bytes are small enough to be indexed: for the index to be made again after a merge. */
    selectIndexable: (maxBytes: number, after: string | undefined, limit: number): Query => {
      const q = sql.query().text("SELECT n.path AS path, ").selectBytes("bytes", "b").text(" FROM ").table("names").text(" n JOIN ").table("blobs").text(" b ON b.sha = n.blob WHERE " + sql.byteLength + "(b.bytes) <= ").param(maxBytes);
      if (after !== undefined) q.text(" AND n.path > ").param(after);
      return q.text(" ORDER BY n.path LIMIT ").param(limit);
    },

    // ---- the dump: what `.dump --data-only` writes of the mergeable tables, one INSERT for each row, as text made by the engine's own `quote`
    dumpVersions: (): Query =>
      sql
        .query()
        .text("SELECT 'INSERT INTO ' || ")
        .param(sql.table("versions"))
        .text(" || ' VALUES(' || quote(id) || ',' || quote(sum) || ',' || quote(replica) || ',' || quote(seq) || ',' || quote(path) || ',' || quote(parent) || ',' || quote(merged) || ',' || quote(kind) || ',' || quote(blob) || ');' AS line FROM ")
        .table("versions")
        .text(" ORDER BY id, sum"),
    dumpBlobs: (): Query =>
      sql
        .query()
        .text("SELECT 'INSERT INTO ' || ")
        .param(sql.table("blobs"))
        .text(" || ' VALUES(' || quote(sha) || ',X''' || lower(hex(bytes)) || '''' || ');' AS line FROM ")
        .table("blobs")
        .text(" ORDER BY sha"),
    /** A row read from a dump: the values of one INSERT given as parameters, in the order of the columns. */
    replayVersion: (values: readonly (string | number | null)[]): Query => {
      const q = sql.query().text("INSERT INTO ").table("versions").text(" VALUES (");
      values.forEach((v, i) => {
        if (i > 0) q.text(", ");
        q.param(v);
      });
      return q.text(") ON CONFLICT DO NOTHING");
    },
    replayBlob: (sha: string, bytes: Uint8Array): Query => sql.query().text("INSERT INTO ").table("blobs").text(" VALUES (").param(sha).text(", ").bytes(bytes).text(") ON CONFLICT DO NOTHING"),
    /** Every version row, in key order, as the columns of the table: what a dump of an engine that has no `quote` is made from. */
    selectVersionRows: (): Query => sql.query().text(VERSION_SELECT).table("versions").text(" ORDER BY id, sum"),
    /** Every blob, in order of digest. */
    selectBlobRows: (): Query => sql.query().text("SELECT sha, ").selectBytes("bytes").text(" FROM ").table("blobs").text(" ORDER BY sha"),
  };
}
