// Spec: 0005-sql-store FR-008
/**
 * The one module that knows the tables: every statement the store runs, by name, with the names of the tables and of the columns, the key of the objects (the path), the revision column that decides a conditional write
 * and the history and search tables written next to it. The store (`store.ts`) holds the rules of an operation and calls these by name, and the migrations (`schema.ts`) make the tables these statements read: a
 * different layout of the rows is a different module with the same names, and nothing else in the library changes with it.
 *
 * @example
 * ```ts
 * import { layoutOf } from "./layout.ts";
 * const l = layoutOf(sqlFor("sqlite", naming));
 * l.selectStat(path).done(); // { text: "SELECT rev, size, modified FROM anyfs_objects WHERE path = ?", params: [path] }
 * ```
 *
 * @module
 */
import { mediaTypeOf } from "@intellectual-frontiers/anyfs-sql/governance";
import type { Query, Sql } from "./sql.ts";

/** The statements of the layout, by what each does. Each returns the builder of one statement. */
export type Layout = ReturnType<typeof layoutOf>;

/** The statements of the layout of the tables of a store, in the dialect of its statements. */
export function layoutOf(sql: Sql) {
  const dialect = sql.dialect;
  const range = (q: Query, column: () => Query, prefix: string): void => {
    if (prefix === "") return;
    q.text(" AND ");
    column().text(" >= ").param(`${prefix}/`).text(" AND ");
    column().text(" < ").param(`${prefix}0`);
  };

  return {
    /** The revision and size of the object at a path, locked for writing where the dialect locks a row that way. */
    selectHeld: (path: string, lock: boolean): Query => {
      const q = sql.query().text("SELECT rev, size FROM ").table("objects").text(" WHERE path = ").param(path);
      if (lock) q.forUpdate();
      return q;
    },
    /** The bytes, revision and instant of the object at a path. */
    selectRead: (path: string): Query => sql.query().text("SELECT ").selectBytes("body").text(", rev, modified FROM ").table("objects").text(" WHERE path = ").param(path),
    /** The revision, size and instant of the object at a path. */
    selectStat: (path: string): Query => sql.query().text("SELECT rev, size, modified FROM ").table("objects").text(" WHERE path = ").param(path),
    /** The bytes of the object at a path. */
    selectBody: (path: string): Query => sql.query().text("SELECT ").selectBytes("body").text(" FROM ").table("objects").text(" WHERE path = ").param(path),
    /** A page of objects below a prefix, after a path, in the order of the bytes of the paths: one more than the page, to know whether there is a next. */
    selectPage: (prefix: string, after: string | undefined, limit: number): Query => {
      const q = sql.query().text("SELECT path, rev, size, modified FROM ").table("objects").text(" WHERE 1 = 1");
      range(q, () => q.text("path"), prefix);
      if (after !== undefined) q.text(" AND path > ").param(after);
      return q.text(" ORDER BY path LIMIT ").param(limit + 1);
    },
    /** Makes an object only where there is none at its path: a row comes back where it did. */
    insertObject: (path: string, rev: string, bytes: Uint8Array, modified: string): Query =>
      sql
        .query()
        .text("INSERT INTO ")
        .table("objects")
        .text(" (path, rev, size, media_type, modified, body) VALUES (")
        .param(path)
        .text(", ")
        .param(rev)
        .text(", ")
        .param(bytes.length)
        .text(", ")
        .param(mediaTypeOf(path) ?? null)
        .text(", ")
        .param(modified)
        .text(", ")
        .bytes(bytes)
        .text(") ON CONFLICT (path) DO NOTHING RETURNING path"),
    /** Replaces the object at a path, only where it is at `onlyAt` where that is given: a row comes back where it did. */
    updateObject: (path: string, rev: string, bytes: Uint8Array, modified: string, onlyAt: string | undefined): Query => {
      const q = sql
        .query()
        .text("UPDATE ")
        .table("objects")
        .text(" SET rev = ")
        .param(rev)
        .text(", size = ")
        .param(bytes.length)
        .text(", media_type = ")
        .param(mediaTypeOf(path) ?? null)
        .text(", modified = ")
        .param(modified)
        .text(", body = ")
        .bytes(bytes)
        .text(" WHERE path = ")
        .param(path);
      if (onlyAt !== undefined) q.text(" AND rev = ").param(onlyAt);
      return q.text(" RETURNING path");
    },
    /** Removes the object at a path where it is at a revision: a row comes back where it did. */
    deleteObjectAt: (path: string, rev: string): Query => sql.query().text("DELETE FROM ").table("objects").text(" WHERE path = ").param(path).text(" AND rev = ").param(rev).text(" RETURNING path"),
    /** Removes the object at a path. */
    deleteObject: (path: string): Query => sql.query().text("DELETE FROM ").table("objects").text(" WHERE path = ").param(path),
    /** Copies the object at `from` to `to` where there is none there: a row comes back where it did. */
    copyObject: (from: string, to: string): Query =>
      sql
        .query()
        .text("INSERT INTO ")
        .table("objects")
        .text(" (path, rev, size, media_type, modified, body) SELECT ")
        .param(to)
        .text(", rev, size, ")
        .param(mediaTypeOf(to) ?? null)
        .text(", modified, body FROM ")
        .table("objects")
        .text(" WHERE path = ")
        .param(from)
        .text(" ON CONFLICT (path) DO NOTHING RETURNING path"),
    /** Adds a revision to the history of a path, numbered after the ones it has. */
    addRevision: (path: string, rev: string, size: number, modified: string): Query =>
      sql
        .query()
        .text("INSERT INTO ")
        .table("revisions")
        .text(" (path, seq, rev, size, modified) VALUES (")
        .param(path)
        .text(", (SELECT COALESCE(MAX(seq), 0) + 1 FROM ")
        .table("revisions")
        .text(" WHERE path = ")
        .param(path)
        .text("), ")
        .param(rev)
        .text(", ")
        .param(size)
        .text(", ")
        .param(modified)
        .text(")"),
    /** The revisions of a path, newest first. */
    selectHistory: (path: string, limit: number): Query => sql.query().text("SELECT rev, size, modified FROM ").table("revisions").text(" WHERE path = ").param(path).text(" ORDER BY seq DESC LIMIT ").param(limit),
    /** Removes the history of a path. */
    deleteHistory: (path: string): Query => sql.query().text("DELETE FROM ").table("revisions").text(" WHERE path = ").param(path),
    /** Moves the history of a path to another. */
    moveHistory: (from: string, to: string): Query => sql.query().text("UPDATE ").table("revisions").text(" SET path = ").param(to).text(" WHERE path = ").param(from),
    /** Removes the words of a path from the index of search. */
    deleteWords: (path: string): Query => sql.query().text("DELETE FROM ").table("search").text(" WHERE path = ").param(path),
    /** Puts the words of a path into the index of search. */
    insertWords: (path: string, text: string): Query => {
      const q = sql.query().text("INSERT INTO ").table("search").text(" (path, text) VALUES (").param(path).text(", ");
      return dialect === "postgres" ? q.text("to_tsvector('simple', ").param(text).text("))") : q.param(text).text(")");
    },
    /** The objects whose words hold all of `words`, below a prefix, best first: SQLite's index takes the words as phrases, PostgreSQL's as plain text. */
    searchWords: (prefix: string, words: string, limit: number): Query => {
      const q = sql.query().text("SELECT ").table("objects").text(".path AS path, ").table("objects").text(".rev AS rev FROM ").table("search").text(" JOIN ").table("objects").text(" ON ").table("objects").text(".path = ").table("search").text(".path WHERE ");
      if (dialect === "postgres") q.table("search").text(".text @@ plainto_tsquery('simple', ").param(words).text(")");
      else q.table("search").text(" MATCH ").param(words);
      range(q, () => q.table("objects").text(".path"), prefix);
      if (dialect === "postgres") return q.text(" ORDER BY ts_rank(").table("search").text(".text, plainto_tsquery('simple', ").param(words).text(")) DESC, ").table("objects").text(".path LIMIT ").param(limit);
      return q.text(" ORDER BY rank, ").table("objects").text(".path LIMIT ").param(limit);
    },
  };
}
