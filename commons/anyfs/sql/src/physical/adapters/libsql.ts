// Spec: 0003-sql-port FR-006
/**
 * The port of a libSQL client, which is how Turso (and a libSQL file, and a server of sqld) is reached. It is typed by the shape of the client's `execute` and `transaction`, so that this library depends on no client:
 * the client a caller already has is the port. The dialect is SQLite's; the layout, the statements and the revisions are the same as for a file.
 *
 * @example
 * ```ts
 * import { libsqlPort } from "@intellectual-frontiers/anyfs-sql/libsql";
 * // const client = createClient({ url: "libsql://fleet-example.turso.io", authToken });
 * // const port = libsqlPort(client);
 * ```
 *
 * @module
 */
import type { SqlPort, SqlRow, SqlRunner, SqlValue } from "@intellectual-frontiers/anyfs-sql/governance";
import { Gate, rowOf } from "./common.ts";

/** What `execute` gives. */
export interface LibsqlResult {
  readonly rows: readonly unknown[];
}
/** What runs one statement: a client, or a transaction of one. */
export interface LibsqlExecutor {
  execute(statement: { readonly sql: string; readonly args: readonly SqlValue[] }): Promise<LibsqlResult>;
}
/** A transaction of a libSQL client. */
export interface LibsqlTransaction extends LibsqlExecutor {
  commit(): Promise<void>;
  rollback(): Promise<void>;
  close(): void;
}
/** A libSQL client. */
export interface LibsqlClient extends LibsqlExecutor {
  transaction(mode?: "write" | "read" | "deferred"): Promise<LibsqlTransaction>;
  close(): void;
}

const runnerOf = (executor: LibsqlExecutor): SqlRunner => ({
  async query(sql, params): Promise<readonly SqlRow[]> {
    return (await executor.execute({ sql, args: params })).rows.map(rowOf);
  },
  async exec(sql, params): Promise<void> {
    await executor.execute({ sql, args: params });
  },
});

/** The port of a libSQL client. */
export function libsqlPort(client: LibsqlClient): SqlPort {
  const gate = new Gate();
  const direct = runnerOf(client);
  return {
    dialect: "sqlite",
    query: (sql, params) => gate.run(() => direct.query(sql, params)),
    exec: (sql, params) => gate.run(() => direct.exec(sql, params)),
    transaction: <T>(work: (tx: SqlRunner) => Promise<T>): Promise<T> =>
      gate.run(async () => {
        const tx = await client.transaction("write");
        try {
          const value = await work(runnerOf(tx));
          await tx.commit();
          return value;
        } catch (thrown) {
          try {
            await tx.rollback();
          } catch {
            // the transaction is already over
          }
          throw thrown;
        } finally {
          tx.close();
        }
      }),
    close: async () => void client.close(),
  };
}
