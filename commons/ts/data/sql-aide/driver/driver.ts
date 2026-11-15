/**
 * Drivers: adapters typed by the shape of the client a caller passes in (node:sqlite's `DatabaseSync`, a `pg` client, PGlite, a DuckDB
 * connection), importing no driver, returning failures as values. A driver renders a statement for its dialect, checked at compile time
 * as `render` is, binds its values as parameters, and decodes the values it reads by their columns' domains, so that a row typed by the
 * model is the row the program gets: SQLite's 0 and 1 are booleans, a PostgreSQL `bigint` is a `bigint`, a date is `YYYY-MM-DD` text,
 * a moment is a `Date`, JSON is parsed (commons 0009-sql-aide FR-042).
 *
 * @module
 */
import { absurd, err, ok, type Result } from "../../../kernel/mod.ts";
import type { DomainSpec, SqlValue } from "../algebra/domain.ts";
import { duckdb, postgres, sqlite } from "../dialect/dialects.ts";
import type { Duckdb, Postgres, Sqlite } from "../dialect/dialects.ts";
import { context, type Dialect, type Durability, type EmitContext } from "../emit/context.ts";
import { type AnySql, type Fits, renderUnchecked, type Sql, type SqlKind, statementUnchecked } from "../emit/sql.ts";
import { domainOf, type Shaped } from "../query/builder.ts";
import type { Runner } from "../test/assert.ts";

/** A statement a driver could not run, and what the database said. */
export type DriverError = { readonly kind: "driver"; readonly dialect: string; readonly message: string; readonly statement: string };

/** What a partial must be for a driver of dialect `D` to run it: the same check as `render`'s. */
export type RunsIn<D extends Dialect, Req extends string, Dx extends string> = Fits<D, Req, Dx>;

/** A driver: typed statements in, typed rows or a failure out. */
export interface Driver<D extends Dialect, U extends Durability = Durability> {
  /** The context statements are rendered in. */
  readonly ctx: EmitContext<D, U>;
  /** Runs a query and gives its rows, each value decoded by its column's domain where the query knows it. */
  rows<Row, Req extends string, Dx extends string>(
    query: Sql<"statement" | "fragment", Row, Req, Dx> & RunsIn<D, Req, Dx>,
  ): Promise<Result<readonly Row[], DriverError>>;
  /** Runs a statement, with its values bound, or a script (a fragment), with its values written as the dialect quotes them. */
  run<Req extends string, Dx extends string>(
    statement: Sql<SqlKind, unknown, Req, Dx> & RunsIn<D, Req, Dx>,
  ): Promise<Result<void, DriverError>>;
  /** Gives the value of an expression: a call of a stored function, a computation. */
  value<T, Req extends string, Dx extends string>(
    expression: Sql<"expression", T, Req, Dx> & RunsIn<D, Req, Dx>,
  ): Promise<Result<T, DriverError>>;
  /** The same database as a runner of text, for ISLM and the tests made from a model: it throws where the database refuses. */
  readonly runner: Runner;
}

type Raw = Readonly<Record<string, unknown>>;

/** What a driver needs of a client: rows of a statement with parameters, and a script run whole. */
interface Port {
  readonly all: (text: string, params: readonly SqlValue[]) => Promise<readonly Raw[]>;
  readonly exec: (text: string) => Promise<void>;
  /** How the client gives a date: as text, or as a `Date` at midnight where it is read (`local`) or in UTC. */
  readonly dates: "text" | "local" | "utc";
}

const pad = (n: number, w = 2): string => String(n).padStart(w, "0");

function moment(v: unknown): Date | unknown {
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(v);
  if (typeof v !== "string") return v;
  const m = /^(\d{4}-\d\d-\d\d)[ T](\d\d:\d\d:\d\d(?:\.\d+)?)(?:(Z)|([+-]\d\d)(?::?(\d\d))?)?$/.exec(v);
  if (m === null) return new Date(v);
  const zone = m[3] === "Z" || m[4] === undefined ? "Z" : `${m[4]}:${m[5] ?? "00"}`;
  return new Date(`${m[1]}T${m[2]}${zone}`);
}

function bytesOf(v: unknown): unknown {
  if (v instanceof Uint8Array) return new Uint8Array(v);
  if (typeof v !== "string") return v;
  // DuckDB writes a blob as text with \xNN for each byte that is not printable
  const out: number[] = [];
  for (let i = 0; i < v.length; i++) {
    if (v[i] === "\\" && v[i + 1] === "x") {
      out.push(Number.parseInt(v.slice(i + 2, i + 4), 16));
      i += 3;
    } else out.push(v.charCodeAt(i));
  }
  return new Uint8Array(out);
}

/** A value read from a client, as its domain says it is in TypeScript. */
export function decode(v: unknown, d: DomainSpec, dates: Port["dates"]): unknown {
  if (v === null || v === undefined) return null;
  switch (d.kind) {
    case "text":
    case "uuid":
    case "enum":
    case "custom":
      return typeof v === "string" ? v : String(v);
    case "numeric":
      // SQLite keeps a NUMERIC column's value as a number: it is written to the column's scale, as the other engines give it
      return typeof v === "number" ? v.toFixed(d.scale) : String(v);
    case "integer":
    case "real":
      return typeof v === "number" ? v : Number(v);
    case "bigint":
      return typeof v === "bigint" ? v : typeof v === "number" || typeof v === "string" ? BigInt(v) : v;
    case "boolean":
      return typeof v === "boolean" ? v : v === 1 || v === 1n || v === "1" || v === "true" || v === "t";
    case "date":
      if (v instanceof Date)
        return dates === "local"
          ? `${pad(v.getFullYear(), 4)}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`
          : `${pad(v.getUTCFullYear(), 4)}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
      return String(v).slice(0, 10);
    case "timestamp":
      return moment(v);
    case "json":
      return typeof v === "string" ? JSON.parse(v) : v;
    case "bytes":
      return bytesOf(v);
    case "array": {
      const items: unknown = typeof v === "string" ? JSON.parse(v) : v;
      return Array.isArray(items) ? items.map((x: unknown) => decode(x, d.of, dates)) : items;
    }
    default:
      return absurd(d);
  }
}

function make<D extends Dialect, U extends Durability>(ctx: EmitContext<D, U>, port: Port): Driver<D, U> {
  const fail = (statement: string, thrown: unknown): DriverError => ({
    kind: "driver",
    dialect: ctx.dialect.name,
    message: thrown instanceof Error ? thrown.message : String(thrown),
    statement,
  });
  const read = async (p: AnySql): Promise<Result<readonly Raw[], DriverError>> => {
    const s = statementUnchecked(p, ctx);
    try {
      return ok(await port.all(s.text, s.params));
    } catch (thrown) {
      return err(fail(s.text, thrown));
    }
  };
  const shapeOf = (p: object): Shaped | undefined => ("columns" in p && Array.isArray(p.columns) ? (p as Shaped) : undefined);
  return {
    ctx,
    async rows<Row>(query: AnySql): Promise<Result<readonly Row[], DriverError>> {
      const got = await read(query);
      if (got.kind === "err") return got;
      const shape = shapeOf(query);
      const decoders = new Map((shape?.columns ?? []).map((c, i) => [c, shape?.domains?.[i]] as const));
      // the rows are the query's: its type said what they are, and decoding by its columns' domains makes them so
      return ok(
        got.value.map(
          (r) =>
            Object.fromEntries(
              Object.entries(r).map(([k, v]) => {
                const d = decoders.get(k);
                return [k, d === undefined ? v : decode(v, d, port.dates)];
              }),
            ) as Row,
        ),
      );
    },
    async run(statement: AnySql): Promise<Result<void, DriverError>> {
      // a statement is run with its values bound; a script (a fragment of several statements) with its values written as literals
      const s =
        statement.sqlKind === "statement" ? statementUnchecked(statement, ctx) : { text: renderUnchecked(statement, ctx), params: [] };
      try {
        if (s.params.length === 0) await port.exec(s.text);
        else await port.all(s.text, s.params);
        return ok(undefined);
      } catch (thrown) {
        return err(fail(s.text, thrown));
      }
    },
    async value<T>(expression: Sql<"expression", T, string, never>): Promise<Result<T, DriverError>> {
      const query: AnySql = {
        sqlKind: "statement",
        chunks: (c) => [
          { kind: "text", text: "SELECT " },
          { kind: "sql", sql: expression },
          { kind: "text", text: ` AS ${c.dialect.quoteName("value")}` },
        ],
      };
      const got = await read(query);
      if (got.kind === "err") return got;
      const d = domainOf(expression);
      const v = got.value[0]?.["value"] ?? null;
      // the value is the expression's, as its type says, decoded by its domain where that is known
      return ok((d === undefined ? v : decode(v, d, port.dates)) as T);
    },
    runner: {
      query: (text) => port.all(text, []),
      exec: (text) => port.exec(text),
    },
  } as Driver<D, U>;
}

/** A value as a SQLite client takes it. */
export type SqliteParam = string | number | bigint | null | Uint8Array;

/** The shape of a SQLite client: node:sqlite's `DatabaseSync` has it, under Node and under Bun. */
export interface SqliteClient {
  /** Runs a script. */
  exec(sql: string): void;
  /** Prepares a statement. */
  prepare(sql: string): {
    /** Its rows. */
    all(...params: SqliteParam[]): unknown[];
    /** Reads integers as `bigint`, where the client can: without it, an integer beyond 2^53 cannot be read. */
    setReadBigInts?(enabled: boolean): unknown;
  };
}

/**
 * A driver over a SQLite client the caller opened.
 *
 * @param client - node:sqlite's `DatabaseSync`, or anything of its shape
 * @param ctx - the context to render in; SQLite's typical one where not given
 * @example
 * const db = sqliteDriver(new DatabaseSync(":memory:"));
 */
export function sqliteDriver<U extends Durability = "durable">(client: SqliteClient, given?: EmitContext<Sqlite, U>): Driver<Sqlite, U> {
  // without a context, a driver renders for a durable database of its dialect, as U says where it is not given
  const ctx = given ?? (context({ dialect: sqlite() }) as EmitContext<Sqlite, U>);
  const param = (v: SqlValue): SqliteParam =>
    typeof v === "boolean"
      ? v
        ? 1
        : 0
      : v === null || typeof v === "string" || typeof v === "number" || typeof v === "bigint" || v instanceof Uint8Array
        ? v
        : v instanceof Date
          ? v.toISOString()
          : JSON.stringify(v);
  return make(ctx, {
    dates: "text",
    all: (text, params) => {
      const prepared = client.prepare(text);
      prepared.setReadBigInts?.(true);
      // an integer that fits a number is given as one; a larger one stays a bigint, which a bigint column's domain asks for anyway
      const small = (v: unknown): unknown =>
        typeof v === "bigint" && v <= BigInt(Number.MAX_SAFE_INTEGER) && v >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(v) : v;
      const rows = prepared.all(...params.map(param)) as Raw[];
      return Promise.resolve(rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, small(v)]))));
    },
    exec: (text) => Promise.resolve(client.exec(text)),
  });
}

/** The shape of a PostgreSQL client: `pg`'s `Client` and `Pool` have it, under Node and under Bun. */
export interface PgClient {
  /** Runs a statement with its parameters. */
  query(text: string, values?: unknown[]): Promise<{ readonly rows: unknown[] }>;
}

/**
 * A driver over a PostgreSQL client the caller connected.
 *
 * @param client - a `pg` client or pool, or anything of its shape
 * @param ctx - the context to render in; PostgreSQL's typical one where not given
 */
export function postgresDriver<U extends Durability = "durable">(client: PgClient, given?: EmitContext<Postgres, U>): Driver<Postgres, U> {
  // without a context, a driver renders for a durable database of its dialect, as U says where it is not given
  const ctx = given ?? (context({ dialect: postgres() }) as EmitContext<Postgres, U>);
  return make(ctx, {
    // pg reads a date as midnight where the program runs
    dates: "local",
    all: async (text, params) => (await client.query(text, [...params])).rows as Raw[],
    exec: async (text) => {
      await client.query(text);
    },
  });
}

/** The shape of PGlite. */
export interface PgliteClient {
  /** Runs a statement with its parameters. */
  query(text: string, params?: unknown[]): Promise<{ readonly rows: unknown[] }>;
  /** Runs a script. */
  exec(text: string): Promise<unknown>;
}

/**
 * A driver over PGlite, PostgreSQL in process.
 *
 * @param client - a PGlite instance, or anything of its shape
 * @param ctx - the context to render in; PostgreSQL's typical one where not given
 */
export function pgliteDriver<U extends Durability = "durable">(
  client: PgliteClient,
  given?: EmitContext<Postgres, U>,
): Driver<Postgres, U> {
  // without a context, a driver renders for a durable database of its dialect, as U says where it is not given
  const ctx = given ?? (context({ dialect: postgres() }) as EmitContext<Postgres, U>);
  return make(ctx, {
    dates: "utc",
    all: async (text, params) => (await client.query(text, [...params])).rows as Raw[],
    exec: async (text) => {
      await client.exec(text);
    },
  });
}

/** A value as a DuckDB connection takes it. */
export type DuckdbParam = string | number | bigint | boolean | null;

/** The shape of a DuckDB connection: `@duckdb/node-api`'s `DuckDBConnection` has it. */
export interface DuckdbConnection {
  /** Runs a statement, or a script, and reads all its rows. */
  runAndReadAll(sql: string, values?: DuckdbParam[]): Promise<{ getRowObjectsJson(): unknown[] }>;
  /** Runs a statement, or a script. */
  run(sql: string, values?: DuckdbParam[]): Promise<unknown>;
}

/**
 * A driver over a DuckDB connection the caller opened.
 *
 * @param connection - a `DuckDBConnection`, or anything of its shape
 * @param ctx - the context to render in; DuckDB's typical one where not given
 */
export function duckdbDriver<U extends Durability = "durable">(
  connection: DuckdbConnection,
  given?: EmitContext<Duckdb, U>,
): Driver<Duckdb, U> {
  // without a context, a driver renders for a durable database of its dialect, as U says where it is not given
  const ctx = given ?? (context({ dialect: duckdb() }) as EmitContext<Duckdb, U>);
  const param = (v: SqlValue): DuckdbParam =>
    v === null || typeof v === "string" || typeof v === "number" || typeof v === "bigint" || typeof v === "boolean"
      ? v
      : v instanceof Date
        ? v.toISOString()
        : v instanceof Uint8Array
          ? [...v].map((b) => `\\x${b.toString(16).padStart(2, "0")}`).join("")
          : JSON.stringify(v);
  return make(ctx, {
    dates: "text",
    all: async (text, params) =>
      (await connection.runAndReadAll(text, params.length === 0 ? undefined : params.map(param))).getRowObjectsJson() as Raw[],
    exec: async (text) => {
      await connection.run(text);
    },
  });
}
