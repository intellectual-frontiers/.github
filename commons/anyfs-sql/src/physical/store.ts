// Spec: 0005-sql-store FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
/**
 * The store of a database that merges: a file is the winner among the heads of its path, a set of immutable version rows in the table of versions (each write or delete a new row that replaces the heads of its path, the
 * bytes of a put in the table of blobs under the digest), its revision the digest of its bytes (`sha256:`, made here so that the same bytes are the same revision in every store), and every operation is one or more statements
 * of the language, run through the port in one transaction. The winner, the siblings and the next id are the pure model's (`@intellectual-frontiers/anyfs/merge`), applied to the rows of the path; an expectation of a
 * revision or of no file is decided against the winner in the same transaction that writes, so that two writers of one database cannot both win. The store also merges: it says what it holds (the version vector), gives the
 * delta past a vector and takes a delta, whole or not at all. The order of a list is the order of the bytes of the paths, by a range and never by a pattern, so that a path with a percent sign, an underscore or a backslash
 * in it is an ordinary name.
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
  type Hits,
  type Listing,
  makeStore,
  type Op,
  type Read,
  type Stat,
  type Store,
  type Versions,
  type Written,
} from "@intellectual-frontiers/anyfs/logical";
import {
  conflict,
  type Cursor,
  defaultTrust,
  type Expect,
  type MergeFinding,
  missing,
  parseCursor,
  parseFingerprint,
  parsePath,
  parseReplicaId,
  parseRevision,
  type Path,
  type Place,
  type Problem,
  refused,
  type ReplicaId,
  replicaIdOfBytes,
  type Revision,
  tampered,
  type Trust,
  unavailable,
  type Version,
} from "@intellectual-frontiers/anyfs/governance";
import {
  blobSha,
  DEFAULT_LIMITS,
  DEFAULT_MAX_DRIFT,
  fromBase64,
  type Limits,
  type MergeState,
  openIdentity,
  type PathOp,
  transact,
  viewOf,
  withBlob,
} from "@intellectual-frontiers/anyfs/merge";
import { DEFAULT_MAX_OBJECT, HARD_MAX_OBJECT, type Naming, type NamingOptions, parseNaming, SCHEMA_VERSION, type SqlDialect, type SqlPort, type SqlRunner } from "@intellectual-frontiers/anyfs-sql/governance";
import { type Compacted, type CompactInput, compactDatabase, adoptEpoch, type EpochProposal, retireReplica, retiredOf, type Retired, epochsOf } from "./compact.ts";
import { type Ctx, type EpochRow, deltaOfDatabase, execQ, runQ, siblingsOfPath, stateOf, takeDelta, vectorOfDatabase, verifyDatabase } from "./merge.ts";
import { hasSearch, layoutVersion, migrate, type MigrateOptions } from "./schema.ts";
import { type Layout, layoutOf } from "./layout.ts";
import { bytesOf, numberOf, type Sql, sqlFor, textOf } from "./sql.ts";

/** The capabilities of every SQL store: those of a store that merges. */
export const SQL_CAPABILITIES = ["read", "write", "list", "stat", "delete", "cas", "batch", "rename", "history", "merge"] as const;
/** The type of the store of a database, without search. */
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
  /** The clock that makes ids, in milliseconds. */
  readonly clock?: () => number;
  /** Whether the store has the index of search: `auto` where the engine has one. */
  readonly search?: MigrateOptions["search"];
  /** The most bytes of an object that are indexed for search (1 MiB where not given). */
  readonly searchMaxBytes?: number;
  /** Whether the layout is brought to the latest version (`migrate`, the default) or only checked (`check`: a database at an older version is refused). */
  readonly layout?: "migrate" | "check";
  /** The identity of the replica a new database takes: random where not given. A database that has one keeps it. */
  readonly replica?: ReplicaId;
  /** What tells a copy of the database from the original (the identity of its file): a database whose stored fingerprint is another is a copy and takes a new replica identity. `none` where not given. */
  readonly fingerprint?: string;
  /** Whom the database takes changes and rows from: itself alone where not given. `open` takes any, `allowlist` the replicas named (and itself), `signed` the deltas a verifier accepts. */
  readonly trust?: Trust;
  /** How far ahead of the wall clock an id is taken: five minutes where not given. */
  readonly maxDrift?: number;
  /** What a delta may hold: the defaults where not given. */
  readonly limits?: Limits;
};

/** What the store knows of its database. */
export type SqlFacts = { readonly dialect: SqlDialect; readonly naming: Naming; readonly version: number; readonly search: boolean };

/** A sibling: a head of a path that is not the winner. */
export type SqlSibling = { readonly id: string; readonly kind: "put" | "tombstone"; readonly rev: Revision | undefined; readonly replica: ReplicaId };

/** An opened store: the store, the same store with search where the engine has it, the facts of the layout, and what a program reads of the replica that the interface of a store does not give. */
export type SqlStore = {
  readonly store: SqlStoreOf;
  readonly searchable: SearchableSqlStore | undefined;
  readonly facts: SqlFacts;
  /** Who this copy of the database is. */
  readonly replica: ReplicaId;
  /** Where the file was a copy and took a new identity: the identity it had. */
  readonly forkedFrom: ReplicaId | undefined;
  /** The heads of a path that are not the winner. */
  siblings(path: Path): Promise<readonly SqlSibling[]>;
  /** What is wrong with the rows and blobs the database holds, whatever way they came. */
  verify(): Promise<readonly MergeFinding[]>;
  /** How many deltas the database holds back until what they wait for arrives. */
  pending(): Promise<number>;
  /** The index of search made again from the files, after rows were put in by a SQL import. */
  reindex(): Promise<void>;
  /** The log of the engine folded into the file, so that a file copied now is the whole database: `done` for an engine that keeps a log, `not-needed` for one that does not. Closing the port does it too. */
  checkpoint(): Promise<"done" | "not-needed">;
  /** Collects the rows every replica of a roster holds, against what each has reported; refused where a replica of the roster has not reported, and the epoch it writes keeps an old dump from bringing back what was collected. */
  compact(input: CompactInput): Promise<Result<Compacted, string>>;
  /** Takes an epoch another replica made, where this one holds all the rows it covers. */
  adopt(proposal: EpochProposal): Promise<Result<Compacted | "nothing", string>>;
  /** Retires a replica that will not return: it is no longer trusted, and who did it, when and why is written down. */
  retire(replica: ReplicaId, reason: string, at: string): Promise<Result<Retired, string>>;
  /** The replicas that were retired. */
  retired(): Promise<readonly Retired[]>;
  /** The epochs, oldest first. */
  epochs(): Promise<readonly EpochRow[]>;
  /** The context the merge and the dump work in. */
  readonly ctx: Ctx;
  readonly port: SqlPort;
};

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

const revOf = (sha: string): Revision => {
  const r = parseRevision(`sha256:${sha}`);
  if (r.kind === "err") throw new Error(`the database holds ${JSON.stringify(sha)}, which is not a digest`);
  return r.value;
};

const pathOf = (text: string): Path => {
  const r = parsePath(text);
  if (r.kind === "err") throw new Error(`the database holds ${JSON.stringify(text)}, which is not a path`);
  return r.value;
};

/** The instant an id was made, as ISO 8601 text in UTC. */
const instantOf = (id: string): string => new Date(Number.parseInt(id.replaceAll("-", "").slice(0, 12), 16)).toISOString();

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

const randomReplica = (): ReplicaId => {
  const r = replicaIdOfBytes(globalThis.crypto.getRandomValues(new Uint8Array(16)));
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
};

/** The fact a database holds under a key, or nothing. */
async function factOf(r: SqlRunner, l: Layout, key: string): Promise<string | undefined> {
  const first = (await runQ(r, l.selectFact(key)))[0];
  return first === undefined ? undefined : textOf(first["value"] ?? null);
}

/** A file as the model sees it: its winner and the digest of its bytes. */
type Head = { readonly version: Version; readonly sha: string };

const headOf = (state: MergeState, path: string): Head | undefined => {
  const v = viewOf(state, path);
  return v.present && v.winner !== undefined && v.winner.blob !== null ? { version: v.winner, sha: v.winner.blob } : undefined;
};

/** Opens the store of a database: brings the layout to its version, settles who this copy is and whom it trusts, and gives the store. */
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
  const fingerprint = parseFingerprint(options.fingerprint ?? "none");
  if (fingerprint.kind === "err") return fingerprint;

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

  // who this copy is: kept where the fingerprint is the one stored, new where the database was copied
  const storedReplica = await factOf(port, l, "replica");
  const storedFingerprint = await factOf(port, l, "fingerprint");
  const parsedReplica = storedReplica === undefined ? undefined : parseReplicaId(storedReplica);
  const parsedFingerprint = storedFingerprint === undefined ? undefined : parseFingerprint(storedFingerprint);
  if (parsedReplica?.kind === "err") return err(`the database holds a replica identity that is not one: ${parsedReplica.error}`);
  const identity = openIdentity(
    parsedReplica?.kind === "ok" && parsedFingerprint?.kind === "ok" ? { replica: parsedReplica.value, fingerprint: parsedFingerprint.value } : undefined,
    fingerprint.value,
    () => options.replica ?? randomReplica(),
  );
  const replica = identity.replica;
  const trust: Trust = options.trust ?? defaultTrust(replica);
  await port.transaction(async (tx) => {
    await execQ(tx, l.upsertFact("replica", replica));
    await execQ(tx, l.upsertFact("fingerprint", identity.fingerprint));
    await execQ(tx, l.insertTrust(replica));
    if (identity.forkedFrom !== undefined) await execQ(tx, l.insertTrust(identity.forkedFrom));
    await execQ(tx, l.upsertFact("trust_mode", trust.kind));
    if (trust.kind === "allowlist") for (const who of trust.replicas) await execQ(tx, l.insertTrust(who));
  });

  const ctx: Ctx = { l, replica, config: { maxDrift: options.maxDrift ?? DEFAULT_MAX_DRIFT, limits: options.limits ?? DEFAULT_LIMITS, trust }, searching, searchBytes };
  const place: Place = { kind: "sql", dialect, target: options.target ?? "memory" };

  /** The index of search after a change: the words of the file now, or nothing where it is not text. */
  const index = async (r: SqlRunner, path: string): Promise<void> => {
    if (!searching) return;
    await execQ(r, l.deleteWords(path));
    const row = (await runQ(r, l.selectCurrent(path)))[0];
    if (row === undefined) return;
    const text = textFor(bytesOf(row["bytes"] ?? null), searchBytes);
    if (text !== undefined) await execQ(r, l.insertWords(path, text));
  };

  /** The index of search made again from every file. */
  const reindex = async (): Promise<void> => {
    if (!searching) return;
    await port.transaction(async (tx) => {
      await execQ(tx, l.deleteAllWords());
      let after: string | undefined;
      for (;;) {
        const page = await runQ(tx, l.selectIndexable(searchBytes, after, 200));
        for (const row of page) {
          const text = textFor(bytesOf(row["bytes"] ?? null), searchBytes);
          if (text !== undefined) await execQ(tx, l.insertWords(textOf(row["path"] ?? null), text));
        }
        const last = page[page.length - 1];
        if (last === undefined || page.length < 200) break;
        after = textOf(last["path"] ?? null);
      }
    });
  };

  /** The rows a transaction made and the blobs they use, added in the transaction the runner is. */
  const keep = async (r: SqlRunner, delta: { readonly versions: readonly Version[]; readonly blobs: readonly { readonly sha: string; readonly bytes: string }[] } | undefined): Promise<void> => {
    if (delta === undefined) return;
    for (const b of delta.blobs) {
      const bytes = fromBase64(b.bytes);
      if (bytes !== undefined) await runQ(r, l.insertBlob(b.sha, bytes));
    }
    for (const v of delta.versions) await runQ(r, l.insertVersion(v));
  };

  const tooLarge = (path: Path, size: number): Problem => refused("too-large", `${size} bytes is more than the ${maxObject} this store holds in one object`, path);

  type Changed = { readonly created: boolean; readonly existed: boolean; readonly sha: string | undefined };

  /** One put or remove inside a transaction: the rows of the path are read, the expectation decides, a new row replaces the heads. */
  const changeIn = async (r: SqlRunner, path: Path, op: { readonly kind: "put"; readonly bytes: Uint8Array } | { readonly kind: "remove" }, expect: Expect): Promise<Result<Changed, Problem>> => {
    const state = await stateOf(r, ctx, [path]);
    const had = headOf(state, path);
    const bad = check(path, expect, had === undefined ? undefined : revOf(had.sha));
    if (bad !== undefined) return err(bad);
    if (op.kind === "remove") {
      if (had === undefined) return ok({ created: false, existed: false, sha: undefined });
      const made = await transact(state, [{ kind: "remove", path }], new Map(), clock());
      if (made.kind === "err") return err(refused("too-large", made.error, path));
      await keep(r, made.value.delta);
      await index(r, path);
      return ok({ created: false, existed: true, sha: had.sha });
    }
    const sha = await blobSha(op.bytes);
    if (had !== undefined && had.sha === sha) return ok({ created: false, existed: true, sha });
    const made = await transact(state, [{ kind: "put", path, blob: sha }], new Map([[sha, op.bytes.slice()]]), clock());
    if (made.kind === "err") return err(refused("too-large", made.error, path));
    await keep(r, made.value.delta);
    await index(r, path);
    return ok({ created: had === undefined, existed: had !== undefined, sha });
  };

  const handle: Handler = async (op: Op) => {
    try {
      switch (op.op) {
        case "read": {
          const row = (await runQ(port, l.selectCurrent(op.path)))[0];
          if (row === undefined) return err(missing(op.path));
          const bytes = bytesOf(row["bytes"] ?? null).slice();
          const sha = textOf(row["blob"] ?? null);
          if ((await sha256(bytes)) !== sha) return err(tampered(op.path, "the bytes in the database are not the ones their revision names"));
          const value: Read = { bytes, rev: revOf(sha), modified: instantOf(textOf(row["id"] ?? null)) };
          return ok({ op: "read", value });
        }
        case "stat": {
          const row = (await runQ(port, l.selectCurrentStat(op.path)))[0];
          if (row === undefined) return err(missing(op.path));
          const value: Stat = { path: op.path, size: numberOf(row["size"] ?? null), rev: revOf(textOf(row["blob"] ?? null)), modified: instantOf(textOf(row["id"] ?? null)) };
          return ok({ op: "stat", value });
        }
        case "write": {
          if (op.bytes.length > maxObject) return err(tooLarge(op.path, op.bytes.length));
          const done = await port.transaction((tx) => changeIn(tx, op.path, { kind: "put", bytes: op.bytes }, op.expect));
          if (done.kind === "err") return done;
          if (done.value.sha === undefined) return err(unavailable("a write made no digest", false));
          const value: Written = { rev: revOf(done.value.sha), created: done.value.created };
          return ok({ op: "write", value });
        }
        case "delete": {
          const done = await port.transaction((tx) => changeIn(tx, op.path, { kind: "remove" }, op.expect));
          return done.kind === "err" ? done : ok({ op: "delete", value: { existed: done.value.existed } });
        }
        case "list": {
          const limit = Math.min(Math.max(1, Math.floor(op.limit ?? PAGE)), MAX_PAGE);
          const after = op.after === undefined ? undefined : decodeURIComponent(op.after);
          const rows = await runQ(port, l.selectPage(op.prefix, after, limit));
          const entries: Stat[] = rows.slice(0, limit).map((row) => ({ path: pathOf(textOf(row["path"] ?? null)), size: numberOf(row["size"] ?? null), rev: revOf(textOf(row["blob"] ?? null)), modified: instantOf(textOf(row["id"] ?? null)) }));
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
          for (const c of op.changes) if (c.kind === "put" && c.bytes.length > maxObject) return err(tooLarge(c.path, c.bytes.length));
          try {
            const results = await port.transaction(async (tx) => {
              const out: ChangeResult[] = [];
              for (const change of op.changes as readonly Change[]) {
                if (change.kind === "put") {
                  const done = await changeIn(tx, change.path, { kind: "put", bytes: change.bytes }, change.expect);
                  if (done.kind === "err") throw new Abort(done.error);
                  if (done.value.sha === undefined) throw new Abort(unavailable("a put made no digest", false));
                  out.push({ kind: "put", path: change.path, rev: revOf(done.value.sha), created: done.value.created });
                } else {
                  const done = await changeIn(tx, change.path, { kind: "remove" }, change.expect);
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
              const state = await stateOf(tx, ctx, [op.from, op.to]);
              const had = headOf(state, op.from);
              if (had === undefined) throw new Abort(missing(op.from));
              const bad = check(op.from, op.expect, revOf(had.sha));
              if (bad !== undefined) throw new Abort(bad);
              const there = headOf(state, op.to);
              if (there !== undefined) throw new Abort(conflict(op.to, { kind: "absent" }, { kind: "rev", rev: revOf(there.sha) }));
              const body = bytesOf((await runQ(tx, l.selectBlob(had.sha)))[0]?.["bytes"] ?? null);
              const ops: readonly PathOp[] = [
                { kind: "put", path: op.to, blob: had.sha },
                { kind: "remove", path: op.from },
              ];
              const made = await transact(withBlob(state, had.sha, body), ops, new Map(), clock());
              if (made.kind === "err") throw new Abort(refused("too-large", made.error));
              await keep(tx, made.value.delta);
              await index(tx, op.from);
              await index(tx, op.to);
              return { rev: revOf(had.sha), created: true };
            });
            return ok({ op: "rename", value });
          } catch (thrown) {
            if (thrown instanceof Abort) return err(thrown.problem);
            throw thrown;
          }
        }
        case "history": {
          const state = await stateOf(port, ctx, [op.path]);
          if (headOf(state, op.path) === undefined) return err(missing(op.path));
          const limit = Math.min(Math.max(1, Math.floor(op.limit ?? PAGE)), MAX_PAGE);
          const rows = await runQ(port, l.selectHistory(op.path, limit));
          const value: Versions = { versions: rows.map((row) => ({ rev: revOf(textOf(row["blob"] ?? null)), size: numberOf(row["size"] ?? null), modified: instantOf(textOf(row["id"] ?? null)) })) };
          return ok({ op: "history", value });
        }
        case "merge": {
          switch (op.action.kind) {
            case "vector":
              return ok({ op: "merge", value: { kind: "vector", vector: await vectorOfDatabase(port, ctx) } });
            case "since":
              return ok({ op: "merge", value: { kind: "delta", delta: await deltaOfDatabase(port, ctx, op.action.since) } });
            case "apply": {
              const delta = op.action.delta;
              const taken = await port.transaction(async (tx) => {
                const t = await takeDelta(tx, ctx, delta, clock());
                for (const p of t.paths) await index(tx, p);
                return t;
              });
              return ok({ op: "merge", value: { kind: "outcome", outcome: taken.outcome } });
            }
            default:
              return err(unavailable("a merge of no known kind", false));
          }
        }
        case "search": {
          if (!searching) return err(refused("capability-absent", `this ${dialect} store has no index of search`));
          const limit = Math.min(Math.max(1, Math.floor(op.limit ?? PAGE)), MAX_PAGE);
          const words = ftsQuery(op.text);
          if (words === "") return ok({ op: "search", value: { hits: [] } });
          const rows = await runQ(port, l.searchWords(op.prefix, words, limit));
          const value: Hits = { hits: rows.map((row) => ({ path: pathOf(textOf(row["path"] ?? null)), rev: revOf(textOf(row["blob"] ?? null)) })) };
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
  const store = makeStore({ id, place, consistency: "eventual-merge", traits, capabilities: SQL_CAPABILITIES, handle });
  const searchable = searching ? makeStore({ id, place, consistency: "eventual-merge", traits, capabilities: [...SQL_CAPABILITIES, "search"] as const, handle }) : undefined;
  return ok({
    store,
    searchable,
    facts: { dialect, naming: naming.value, version: found.version, search: searching },
    replica,
    forkedFrom: identity.forkedFrom,
    siblings: async (path) => (await siblingsOfPath(port, ctx, path)).map((v): SqlSibling => ({ id: v.id, kind: v.kind, rev: v.blob === null ? undefined : revOf(v.blob), replica: v.replica })),
    verify: () => verifyDatabase(port, ctx, clock()),
    pending: async () => numberOf((await runQ(port, l.countPending()))[0]?.["n"] ?? null),
    reindex,
    checkpoint: async () => {
      if (port.checkpoint === undefined) return "not-needed";
      await port.checkpoint();
      return "done";
    },
    compact: (input) => compactDatabase(port, ctx, input),
    adopt: (proposal) => adoptEpoch(port, ctx, proposal),
    retire: (who, reason, at) => retireReplica(port, ctx, who, reason, at),
    retired: () => retiredOf(port, ctx),
    epochs: () => epochsOf(port, ctx),
    ctx,
    port,
  });
}
