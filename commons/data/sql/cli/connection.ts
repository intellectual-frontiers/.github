// Spec: 0046-arcactl FR-001
/**
 * The connection of `arcactl` (commons data 0046-arcactl FR-001): one PostgreSQL connection that the library's `Driver` runs on. On Bun it is Bun's own client (`Bun.SQL`), which needs no
 * dependency; on Node it is `pg`, an optional dependency that is loaded only there. Both use one connection for the whole run, so that a transaction a statement opens is the one the next statement
 * is in. With no URL the driver reads `PGHOST`, `PGUSER` and the rest of libpq's environment, as `psql` does, and a password comes from libpq's own files and not from `arcactl`.
 *
 * @remarks
 * Not shown here: a real server over the network. The tests of this library run the same checks on PGlite, which is in process.
 *
 * @module
 */
import type { Driver } from "@intellectual-frontiers/data/sql/lifecycle";
import { resolveTarget, urlOfTarget } from "./resolve.ts";

/** A connection: the driver the library runs on, which runtime made it, and how it is closed. */
export interface Connection {
  readonly driver: Driver;
  readonly kind: "bun" | "pg" | "custom";
  close(): Promise<void>;
}

/** What a connection is made with. */
export interface ConnectOptions {
  /** A `postgres://` URL; where none is given the driver reads libpq's environment. */
  readonly url?: string;
  /** Seconds to wait to connect. */
  readonly connectTimeout?: number;
  /** Which client: Bun's where this is Bun, `pg` elsewhere, unless this says (`pg` can be used on Bun too). */
  readonly driver?: "bun" | "pg";
  /** The environment libpq's variables are read from, when there is no URL; the process's by default. */
  readonly env?: Readonly<Record<string, string | undefined>>;
}

type Row = Record<string, unknown>;

const plain = (r: Row): Row => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v]));

interface BunReserved {
  unsafe(sql: string): PromiseLike<readonly Row[]>;
  release(): void | Promise<void>;
}
interface BunSql {
  reserve(): Promise<BunReserved>;
  close(): Promise<void>;
}
interface PgClient {
  connect(): Promise<void>;
  query(sql: string): Promise<{ rows?: Row[] } | readonly { rows?: Row[] }[]>;
  end(): Promise<void>;
}

/** Connects with Bun's client where this is Bun, and with `pg` where it is not. */
export async function connect(given: ConnectOptions = {}): Promise<Connection> {
  // with no URL, connect as psql does: libpq's variables, the service PGSERVICE names, and the password from .pgpass (0046-arcactl FR-014)
  const target = given.url === undefined ? resolveTarget(given.env ?? process.env) : undefined;
  const options: ConnectOptions = target === undefined ? given : { ...given, url: urlOfTarget(target) };
  try {
    return await open(options);
  } catch (thrown) {
    // a driver may quote what it was given: the password that was found in a file is never in the error
    const secret = target?.password;
    if (secret === undefined || secret === "" || !(thrown instanceof Error)) throw thrown;
    const clean = (m: string): string => m.replaceAll(secret, "***").replaceAll(encodeURIComponent(secret), "***");
    throw new Error(clean(thrown.message));
  }
}

async function open(options: ConnectOptions): Promise<Connection> {
  const bun = (globalThis as { Bun?: { SQL?: new (...a: unknown[]) => BunSql } }).Bun;
  if (options.driver === "bun" && bun?.SQL === undefined) throw new Error("Bun's client was asked for and this is not Bun");
  if (bun?.SQL !== undefined && options.driver !== "pg") {
    const sql = options.url === undefined ? new bun.SQL({ max: 1 }) : new bun.SQL(options.url, { max: 1, ...(options.connectTimeout === undefined ? {} : { connectionTimeout: options.connectTimeout }) });
    const one = await sql.reserve();
    return {
      kind: "bun",
      driver: {
        exec: async (q) => void (await one.unsafe(q)),
        query: async (q) => (await one.unsafe(q)).map(plain),
      },
      close: async () => {
        await one.release();
        await sql.close();
      },
    };
  }
  const name = "pg";
  let mod: { default?: { Client: new (c: unknown) => PgClient }; Client?: new (c: unknown) => PgClient };
  try {
    mod = (await import(name)) as typeof mod;
  } catch {
    throw new Error("arcactl on Node needs the `pg` package (npm install pg); on Bun it needs nothing");
  }
  const Client = mod.Client ?? mod.default?.Client;
  if (Client === undefined) throw new Error("the `pg` package has no Client");
  const client = new Client({ ...(options.url === undefined ? {} : { connectionString: options.url }), ...(options.connectTimeout === undefined ? {} : { connectionTimeoutMillis: options.connectTimeout * 1000 }) });
  await client.connect();
  const rowsOf = (r: Awaited<ReturnType<PgClient["query"]>>): Row[] => (Array.isArray(r) ? (r.at(-1)?.rows ?? []) : ((r as { rows?: Row[] }).rows ?? []));
  return {
    kind: "pg",
    driver: { exec: async (q) => void (await client.query(q)), query: async (q) => rowsOf(await client.query(q)).map(plain) },
    close: () => client.end(),
  };
}
