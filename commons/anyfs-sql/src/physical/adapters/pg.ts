// Spec: 0003-sql-port FR-008
/**
 * The port of a PostgreSQL server reached by `pg`: a pool (each transaction takes a connection of its own, so that writers run side by side and the row locks of the database decide between them) or one client (one
 * transaction at a time). It is typed by the shape of `query` and `connect`, so that this library depends on no client. `pg` gives a `BIGINT` as text and bytes as a buffer: both are read as the port reads values.
 *
 * @example
 * ```ts
 * import { pgPort } from "@intellectual-frontiers/anyfs-sql/pg";
 * // const port = pgPort(new Pool({ connectionString })); // the credentials are the caller's, never part of a place
 * ```
 *
 * @module
 */
import type { SqlPort, SqlRow, SqlRunner, SqlValue } from "@intellectual-frontiers/anyfs-sql/governance";
import { Gate, requireDriver, rowOf } from "./common.ts";

/** What `query` gives. */
export interface PgResult {
  readonly rows: readonly unknown[];
}
/** What runs one statement: a client, a pool or a connection taken from a pool. */
export interface PgQueryable {
  query(text: string, values?: SqlValue[]): Promise<PgResult>;
}
/** A connection taken from a pool. */
export interface PgPoolClient extends PgQueryable {
  release(error?: Error | boolean): void;
}
/** A pool of connections. */
export interface PgPool extends PgQueryable {
  connect(): Promise<PgPoolClient>;
  end(): Promise<void>;
}
/** One client. */
export interface PgClient extends PgQueryable {
  end(): Promise<void>;
}

const runnerOf = (q: PgQueryable): SqlRunner => ({
  async query(sql, params): Promise<readonly SqlRow[]> {
    return (await q.query(sql, [...params])).rows.map(rowOf);
  },
  async exec(sql, params): Promise<void> {
    await q.query(sql, [...params]);
  },
});

/** The port of a pool: a transaction takes a connection and gives it back. */
export function pgPort(pool: PgPool): SqlPort {
  requireDriver("pgPort", "pg", ">=8.23.1 <9.0.0", pool, ["query", "connect"]);
  return {
    dialect: "postgres",
    ...runnerOf(pool),
    transaction: async <T>(work: (tx: SqlRunner) => Promise<T>): Promise<T> => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const value = await work(runnerOf(client));
        await client.query("COMMIT");
        client.release();
        return value;
      } catch (thrown) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // the connection is gone: it is given back as broken
          client.release(true);
          throw thrown;
        }
        client.release();
        throw thrown;
      }
    },
    close: () => pool.end(),
  };
}

/** The port of one client: a transaction at a time. */
export function pgClientPort(client: PgClient): SqlPort {
  requireDriver("pgClientPort", "pg", ">=8.23.1 <9.0.0", client, ["query"]);
  const gate = new Gate();
  const direct = runnerOf(client);
  return {
    dialect: "postgres",
    query: (sql, params) => gate.run(() => direct.query(sql, params)),
    exec: (sql, params) => gate.run(() => direct.exec(sql, params)),
    transaction: <T>(work: (tx: SqlRunner) => Promise<T>): Promise<T> =>
      gate.run(async () => {
        await client.query("BEGIN");
        try {
          const value = await work(direct);
          await client.query("COMMIT");
          return value;
        } catch (thrown) {
          try {
            await client.query("ROLLBACK");
          } catch {
            // the connection is gone
          }
          throw thrown;
        }
      }),
    close: () => client.end(),
  };
}
