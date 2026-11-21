// Spec: 0005-sql-store FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
/**
 * The store of a table in a database: every object is one row of the table of objects, its revision the digest of its bytes (`sha256:`, made here so that the same bytes are the same revision in every
 * store), and every operation is one or more statements of the language, run through the port. A write that expects a revision, or no object, is decided by one statement that returns a row only where it
 * changed something, so that two writers cannot both win; a batch, a rename and a delete that moves history and search with them are one transaction, all or none. The order of a list is the order of the
 * bytes of the paths, by a range and never by a pattern, so that a path with a percent sign, an underscore or a backslash in it is an ordinary name.
 *
 * @example
 * ```ts
 * import { openSqlStore } from "./store.ts";
 * const opened = await openSqlStore(port, { target: "fleet.db" });
 * if (opened.kind === "ok") await opened.value.store.write(path, bytes, expectAny);
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import {
  type Change,
  type ChangeResult,
  type Handler,
  type Listing,
  makeStore,
  type Op,
  type Stat,
  type Store,
  type Versions,
  type Hits,
  type Read,
  type Written,
} from "@intellectual-frontiers/anyfs/logical";
import {
  conflict,
  type Cursor,
  type Expect,
  missing,
  parseCursor,
  parsePath,
  parseRevision,
  type Path,
  type Place,
  type Problem,
  refused,
  type Revision,
  tampered,
  unavailable,
} from "@intellectual-frontiers/anyfs/governance";
import { HARD_MAX_OBJECT, type Naming, type NamingOptions, parseNaming, type SqlDialect, type SqlPort, type SqlRow, type SqlRunner, DEFAULT_MAX_OBJECT, SCHEMA_VERSION } from "@intellectual-frontiers/anyfs-sql/governance";
import { hasSearch, layoutVersion, migrate, type MigrateOptions } from "./schema.ts";
import { layoutOf } from "./layout.ts";
import { bytesOf, numberOf, type Query, type Sql, sqlFor, textOf } from "./sql.ts";

/** The capabilities of every SQL store. */
export const SQL_CAPABILITIES = ["read", "write", "list", "stat", "delete", "cas", "batch", "rename", "history"] as const;
/** The type of the store of a table, without search. */
export type SqlStoreOf = Store<(typeof SQL_CAPABILITIES)[number]>;
/** The type of the same store where the engine has search. */
export type SearchableSqlStore = Store<(typeof SQL_CAPABILITIES)[number] | "search">;

/** What a store is opened with. */
export type SqlOptions = {
  /** The prefix of the tables and the schema where the database has one. */
  readonly naming?: NamingOptions;
  /** What the place of the store calls the database: a file name or a label; never a credential. */
  readonly target?: string;
  /** The largest object, in bytes: below the limit of the engine, 64 MiB where not given. */
  readonly maxObject?: number;
  /** The clock that dates a change, in milliseconds. */
  readonly clock?: () => number;
  /** Whether the store has the index of search: `auto` where the engine has one. */
  readonly search?: MigrateOptions["search"];
  /** The most bytes of an object that are indexed for search (1 MiB where not given). */
  readonly searchMaxBytes?: number;
  /** Whether the layout is brought to the latest version (`migrate`, the default) or only checked (`check`: a database at an older version is refused). */
  readonly layout?: "migrate" | "check";
};

/** What the store knows of its database. */
export type SqlFacts = { readonly dialect: SqlDialect; readonly naming: Naming; readonly version: number; readonly search: boolean };

/** An opened store: the store, the same store with search where the engine has it, and the facts of the layout. */
export type SqlStore = { readonly store: SqlStoreOf; readonly searchable: SearchableSqlStore | undefined; readonly facts: SqlFacts };

const PAGE = 1000;
const MAX_PAGE = 10000;
const SEARCH_BYTES = 1024 * 1024;

class Abort extends Error {
  readonly problem: Problem;
  constructor(problem: Problem) {
    super("abort");
    this.problem = problem;
  }
}

const retryable = (e: unknown): boolean => /SQLITE_BUSY|SQLITE_LOCKED|database is locked|deadlock detected|could not serialize|40001|40P01|connection|timeout/i.test(e instanceof Error ? e.message : String(e));

const revisionOf = async (bytes: Uint8Array): Promise<Revision> => {
  const r = parseRevision(`sha256:${await sha256(bytes)}`);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

const revOf = (text: string): Revision => {
  const r = parseRevision(text);
  if (r.kind === "err") throw new Error(`the database holds ${JSON.stringify(text)}, which is not a revision`);
  return r.value;
};

const pathOf = (text: string): Path => {
  const r = parsePath(text);
  if (r.kind === "err") throw new Error(`the database holds ${JSON.stringify(text)}, which is not a path`);
  return r.value;
};

/** The conflict an expectation finds against what is there, or nothing where it holds. */
function check(path: Path, expect: Expect, there: Revision | undefined): Problem | undefined {
  switch (expect.kind) {
    case "any":
      return undefined;
    case "absent":
      return there === undefined ? undefined : conflict(path, expect, { kind: "rev", rev: there });
    case "rev":
      if (there === undefined) return conflict(path, expect, { kind: "absent" });
      return there === expect.rev ? undefined : conflict(path, expect, { kind: "rev", rev: there });
    default:
      return unavailable("an expectation of no known kind", false);
  }
}

/** The text a body is, for the index of search: its words where it is UTF-8 with no NUL and small enough, and nothing otherwise. */
function textFor(bytes: Uint8Array, limit: number): string | undefined {
  if (bytes.length === 0 || bytes.length > limit) return undefined;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return text.includes("\u0000") ? undefined : text;
  } catch {
    return undefined;
  }
}

/** The query of FTS5 for some words: each word a phrase, so that no operator of the syntax can be written by the caller. */
const ftsQuery = (text: string): string =>
  text
    .split(/\s+/u)
    .filter((w) => w !== "")
    .map((w) => `"${w.split('"').join('""')}"`)
    .join(" ");

/** Opens the store of a table of a database: brings the layout to its version, and gives the store. */
export async function openSqlStore(port: SqlPort, options: SqlOptions = {}): Promise<Result<SqlStore, string>> {
  const naming = parseNaming(options.naming ?? {});
  if (naming.kind === "err") return naming;
  const maxObject = Math.min(options.maxObject ?? DEFAULT_MAX_OBJECT, HARD_MAX_OBJECT[port.dialect]);
  if (!Number.isInteger(maxObject) || maxObject < 1) return err("the largest object is a whole number of bytes, at least 1");
  const clock = options.clock ?? ((): number => Date.now());
  const searchBytes = options.searchMaxBytes ?? SEARCH_BYTES;
  const sql: Sql = sqlFor(port.dialect, naming.value);
  const l = layoutOf(sql);
  const dialect = port.dialect;

  let found: { readonly version: number; readonly search: boolean };
  if (options.layout === "check") {
    const version = await layoutVersion(port, naming.value);
    if (version !== SCHEMA_VERSION) return err(`the database is at version ${version} of the layout and this library writes version ${SCHEMA_VERSION}: it was asked only to check`);
    found = { version, search: options.search !== "off" && (await hasSearch(port, naming.value)) };
  } else {
    const migrated = await migrate(port, naming.value, { search: options.search ?? "auto" });
    if (migrated.kind === "err") return migrated;
    found = migrated.value;
  }
  const searching = found.search;

  const place: Place = { kind: "sql", dialect, target: options.target ?? "memory" };
  const instant = (): string => new Date(clock()).toISOString();
  const run = (r: SqlRunner, q: Query): Promise<readonly SqlRow[]> => {
    const st = q.done();
    return r.query(st.text, st.params);
  };
  const exec = (r: SqlRunner, q: Query): Promise<void> => {
    const st = q.done();
    return r.exec(st.text, st.params);
  };

  /** What the object at a path is: its revision and size, or nothing. */
  const there = async (r: SqlRunner, path: Path, lock: boolean): Promise<{ readonly rev: Revision; readonly size: number } | undefined> => {
    const rows = await run(r, l.selectHeld(path, lock));
    const row = rows[0];
    return row === undefined ? undefined : { rev: revOf(textOf(row["rev"] ?? null)), size: numberOf(row["size"] ?? null) };
  };

  /** The index of search after a change: the words of the object, or nothing where it is not text. */
  const index = async (r: SqlRunner, path: Path, bytes: Uint8Array | undefined): Promise<void> => {
    if (!searching) return;
    await exec(r, l.deleteWords(path));
    const text = bytes === undefined ? undefined : textFor(bytes, searchBytes);
    if (text === undefined) return;
    await exec(r, l.insertWords(path, text));
  };

  /** A revision added to the history of a path. */
  const remember = async (r: SqlRunner, path: Path, rev: Revision, size: number, modified: string): Promise<void> => {
    await exec(r, l.addRevision(path, rev, size, modified));
  };

  /** One write, inside a transaction: the expectation decides it, a statement that changes something only where it holds makes it. */
  const writeIn = async (r: SqlRunner, path: Path, bytes: Uint8Array, rev: Revision, expect: Expect): Promise<Result<Written, Problem>> => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const had = await there(r, path, true);
      const bad = check(path, expect, had?.rev);
      if (bad !== undefined) return err(bad);
      if (had !== undefined && had.rev === rev) return ok({ rev, created: false });
      const modified = instant();
      if (had === undefined) {
        const made = await run(r, l.insertObject(path, rev, bytes, modified));
        if (made.length === 0) {
          // another writer made the object between the look and the insert: look again, and the expectation decides
          continue;
        }
        await remember(r, path, rev, bytes.length, modified);
        await index(r, path, bytes);
        return ok({ rev, created: true });
      }
      const changed = await run(r, l.updateObject(path, rev, bytes, modified, expect.kind === "any" ? undefined : had.rev));
      if (changed.length === 0) continue;
      await remember(r, path, rev, bytes.length, modified);
      await index(r, path, bytes);
      return ok({ rev, created: false });
    }
    return err(unavailable("the object kept changing under the write", true, path));
  };

  /** One delete, inside a transaction. */
  const deleteIn = async (r: SqlRunner, path: Path, expect: Expect): Promise<Result<{ readonly existed: boolean }, Problem>> => {
    const had = await there(r, path, true);
    const bad = check(path, expect, had?.rev);
    if (bad !== undefined) return err(bad);
    if (had === undefined) return ok({ existed: false });
    const gone = await run(r, l.deleteObjectAt(path, had.rev));
    if (gone.length === 0) return err(conflict(path, expect, { kind: "absent" }));
    await exec(r, l.deleteHistory(path));
    await index(r, path, undefined);
    return ok({ existed: true });
  };

  const tooLarge = (path: Path, size: number): Problem => refused("too-large", `${size} bytes is more than the ${maxObject} this store holds in one object`, path);

  const handle: Handler = async (op: Op) => {
    try {
      switch (op.op) {
        case "read": {
          const rows = await run(port, l.selectRead(op.path));
          const row = rows[0];
          if (row === undefined) return err(missing(op.path));
          const bytes = bytesOf(row["body"] ?? null).slice();
          const rev = revOf(textOf(row["rev"] ?? null));
          if (rev.startsWith("sha256:") && rev !== (await revisionOf(bytes))) return err(tampered(op.path, "the bytes in the database are not the ones their revision names"));
          const value: Read = { bytes, rev, modified: textOf(row["modified"] ?? null) };
          return ok({ op: "read", value });
        }
        case "stat": {
          const rows = await run(port, l.selectStat(op.path));
          const row = rows[0];
          if (row === undefined) return err(missing(op.path));
          const value: Stat = { path: op.path, size: numberOf(row["size"] ?? null), rev: revOf(textOf(row["rev"] ?? null)), modified: textOf(row["modified"] ?? null) };
          return ok({ op: "stat", value });
        }
        case "write": {
          if (op.bytes.length > maxObject) return err(tooLarge(op.path, op.bytes.length));
          const rev = await revisionOf(op.bytes);
          const done = await port.transaction((tx) => writeIn(tx, op.path, op.bytes, rev, op.expect));
          return done.kind === "err" ? done : ok({ op: "write", value: done.value });
        }
        case "delete": {
          const done = await port.transaction((tx) => deleteIn(tx, op.path, op.expect));
          return done.kind === "err" ? done : ok({ op: "delete", value: done.value });
        }
        case "list": {
          const limit = Math.min(Math.max(1, Math.floor(op.limit ?? PAGE)), MAX_PAGE);
          const after = op.after === undefined ? undefined : decodeURIComponent(op.after);
          const rows = await run(port, l.selectPage(op.prefix, after, limit));
          const entries: Stat[] = rows.slice(0, limit).map((row) => ({ path: pathOf(textOf(row["path"] ?? null)), size: numberOf(row["size"] ?? null), rev: revOf(textOf(row["rev"] ?? null)), modified: textOf(row["modified"] ?? null) }));
          const last = entries[entries.length - 1];
          let next: Cursor | undefined;
          if (rows.length > limit && last !== undefined) {
            const c = parseCursor(encodeURIComponent(last.path));
            if (c.kind === "err") return err(unavailable(c.error, false));
            next = c.value;
          }
          const value: Listing = next === undefined ? { entries } : { entries, next };
          return ok({ op: "list", value });
        }
        case "batch": {
          const prepared: { readonly change: Change; readonly rev: Revision | undefined }[] = [];
          for (const c of op.changes) {
            if (c.kind === "put" && c.bytes.length > maxObject) return err(tooLarge(c.path, c.bytes.length));
            prepared.push({ change: c, rev: c.kind === "put" ? await revisionOf(c.bytes) : undefined });
          }
          try {
            const results = await port.transaction(async (tx) => {
              const out: ChangeResult[] = [];
              for (const { change, rev } of prepared) {
                if (change.kind === "put") {
                  if (rev === undefined) throw new Abort(unavailable("a put with no digest", false));
                  const done = await writeIn(tx, change.path, change.bytes, rev, change.expect);
                  if (done.kind === "err") throw new Abort(done.error);
                  out.push({ kind: "put", path: change.path, rev, created: done.value.created });
                } else {
                  const done = await deleteIn(tx, change.path, change.expect);
                  if (done.kind === "err") throw new Abort(done.error);
                  out.push({ kind: "delete", path: change.path, existed: done.value.existed });
                }
              }
              return out;
            });
            return ok({ op: "batch", value: { results } });
          } catch (thrown) {
            if (thrown instanceof Abort) return err(thrown.problem);
            throw thrown;
          }
        }
        case "rename": {
          if (op.from === op.to) return err(refused("outside-scope", "a rename to the same path moves nothing", op.from));
          try {
            const value = await port.transaction(async (tx): Promise<Written> => {
              const had = await there(tx, op.from, true);
              if (had === undefined) throw new Abort(missing(op.from));
              const bad = check(op.from, op.expect, had.rev);
              if (bad !== undefined) throw new Abort(bad);
              const target = await there(tx, op.to, true);
              if (target !== undefined) throw new Abort(conflict(op.to, { kind: "absent" }, { kind: "rev", rev: target.rev }));
              const made = await run(tx, l.copyObject(op.from, op.to));
              if (made.length === 0) throw new Abort(conflict(op.to, { kind: "absent" }, { kind: "absent" }));
              await exec(tx, l.deleteObject(op.from));
              await exec(tx, l.moveHistory(op.from, op.to));
              if (searching) {
                const rows = await run(tx, l.selectBody(op.to));
                const row = rows[0];
                await index(tx, op.from, undefined);
                await index(tx, op.to, row === undefined ? undefined : bytesOf(row["body"] ?? null));
              }
              return { rev: had.rev, created: true };
            });
            return ok({ op: "rename", value });
          } catch (thrown) {
            if (thrown instanceof Abort) return err(thrown.problem);
            throw thrown;
          }
        }
        case "history": {
          const exists = await there(port, op.path, false);
          if (exists === undefined) return err(missing(op.path));
          const limit = Math.min(Math.max(1, Math.floor(op.limit ?? PAGE)), MAX_PAGE);
          const rows = await run(port, l.selectHistory(op.path, limit));
          const value: Versions = { versions: rows.map((row) => ({ rev: revOf(textOf(row["rev"] ?? null)), size: numberOf(row["size"] ?? null), modified: textOf(row["modified"] ?? null) })) };
          return ok({ op: "history", value });
        }
        case "search": {
          if (!searching) return err(refused("capability-absent", `this ${dialect} store has no index of search`));
          const limit = Math.min(Math.max(1, Math.floor(op.limit ?? PAGE)), MAX_PAGE);
          const words = dialect === "sqlite" ? ftsQuery(op.text) : op.text.trim();
          if (words === "") return ok({ op: "search", value: { hits: [] } });
          const rows = await run(port, l.searchWords(op.prefix, words, limit));
          const value: Hits = { hits: rows.map((row) => ({ path: pathOf(textOf(row["path"] ?? null)), rev: revOf(textOf(row["rev"] ?? null)) })) };
          return ok({ op: "search", value });
        }
        case "rangeRead":
        case "append":
          return err(refused("capability-absent", `the store of ${dialect} does not have ${op.op}`));
        default:
          return err(unavailable("an operation of no known kind", false));
      }
    } catch (thrown) {
      return err(unavailable(`the database failed: ${thrown instanceof Error ? thrown.message : String(thrown)}`, retryable(thrown)));
    }
  };

  const id = `sql:${dialect}:${options.target ?? "memory"}`;
  const traits = { caseSensitive: true, maxObject } as const;
  const store = makeStore({ id, place, consistency: "strong", traits, capabilities: SQL_CAPABILITIES, handle });
  const searchable = searching ? makeStore({ id, place, consistency: "strong", traits, capabilities: [...SQL_CAPABILITIES, "search"] as const, handle }) : undefined;
  return ok({ store, searchable, facts: { dialect, naming: naming.value, version: found.version, search: searching } });
}
