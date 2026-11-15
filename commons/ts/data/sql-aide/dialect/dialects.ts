/**
 * The three dialects the library is written for first: PostgreSQL, SQLite and DuckDB (commons 0006-sql-aide FR-010). Each is a value; its
 * features are a union the compiler knows, so that a model asking for one a dialect lacks does not compile.
 *
 * @module
 */
import type { DomainSpec, SqlValue } from "../algebra/domain.ts";
import { absurd } from "../../../kernel/mod.ts";
import type { Dialect, DialectExtension } from "../emit/context.ts";

/** What every one of the three dialects can do. */
export type CommonFeature = "upsert" | "returning" | "cte" | "index:btree" | "check" | "views";

/** What PostgreSQL can do. */
export type PostgresFeature =
  | CommonFeature
  | "schemas"
  | "comments"
  | "functions"
  | "procedures"
  | "triggers"
  | "plpgsql"
  | "enums"
  | "domains"
  | "sequences"
  | "materialized-views"
  | "partitions"
  | "rls"
  | "extensions"
  | "arrays"
  | "identity"
  | "merge"
  | "copy"
  | "fk:actions"
  | "index:hash"
  | "index:gin"
  | "index:gist"
  | "index:brin"
  | "index:spgist"
  | "index:include"
  | "index:concurrently"
  | "index:partial"
  | "index:expression";

/** What SQLite can do. */
export type SqliteFeature = CommonFeature | "triggers" | "attach" | "autoincrement" | "fk:actions" | "index:partial" | "index:expression";

/** What DuckDB can do. */
export type DuckdbFeature =
  CommonFeature | "schemas" | "comments" | "macros" | "enums" | "sequences" | "arrays" | "attach" | "read-files" | "index:expression";

/** The PostgreSQL dialect's type. */
export type Postgres = Dialect<"postgres", PostgresFeature>;
/** The SQLite dialect's type. */
export type Sqlite = Dialect<"sqlite", SqliteFeature>;
/** The DuckDB dialect's type. */
export type Duckdb = Dialect<"duckdb", DuckdbFeature>;

/** The names of the three dialects: what a portable model has a case for. */
export type TierOne = "postgres" | "sqlite" | "duckdb";

const hex = (bytes: Uint8Array): string => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
const quoted = (s: string): string => `'${s.replaceAll("'", "''")}'`;
const isJson = (value: SqlValue): boolean =>
  typeof value === "object" && value !== null && !(value instanceof Date) && !(value instanceof Uint8Array);

interface Definition<N extends string> {
  readonly name: N;
  readonly maxNameLength: number | undefined;
  readonly replacesViews: boolean;
  readonly features: readonly string[];
  readonly typeOf: (spec: DomainSpec, self: (spec: DomainSpec) => string) => string;
  readonly bytes: (bytes: Uint8Array) => string;
  readonly nonFinite: (n: number) => string;
  readonly array?: (items: readonly string[]) => string;
  readonly param: (index: number) => string;
  readonly encode: (value: SqlValue, spec?: DomainSpec) => SqlValue;
  readonly comment: Dialect["comment"];
  readonly identity: Dialect["identity"];
  readonly generated: Dialect["generated"];
}

function build<N extends string, F extends string>(def: Definition<N>, extensions: readonly DialectExtension<N, string>[]): Dialect<N, F> {
  const typeOf = (spec: DomainSpec): string => {
    for (const e of extensions) {
      const t = e.typeOf?.(spec);
      if (t !== undefined) return t;
    }
    return def.typeOf(spec, typeOf);
  };
  const literal = (value: SqlValue, spec?: DomainSpec): string => {
    if (value === null) return "NULL";
    switch (typeof value) {
      case "boolean":
        return value ? "TRUE" : "FALSE";
      case "number":
        return Number.isFinite(value) ? String(value) : def.nonFinite(value);
      case "bigint":
        return String(value);
      case "string":
        return quoted(value);
      default:
        break;
    }
    if (value instanceof Date) return quoted(value.toISOString());
    if (value instanceof Uint8Array) return def.bytes(value);
    if (Array.isArray(value) && spec?.kind === "array" && def.array !== undefined)
      return def.array(value.map((v: SqlValue) => literal(v, spec.of)));
    return quoted(JSON.stringify(value));
  };
  return {
    name: def.name,
    maxNameLength: def.maxNameLength,
    replacesViews: def.replacesViews,
    features: new Set([...def.features, ...extensions.flatMap((e) => e.features)]),
    extensions,
    typeOf,
    quoteName: (n) => `"${n.replaceAll('"', '""')}"`,
    literal,
    param: def.param,
    encode: def.encode,
    comment: def.comment,
    identity: def.identity,
    generated: def.generated,
    with: <F2 extends string>(extension: DialectExtension<N, F2>): Dialect<N, F | F2> => build<N, F | F2>(def, [...extensions, extension]),
  };
}

const commentOn: Dialect["comment"] = (target, name, text) => `COMMENT ON ${target.toUpperCase()} ${name} IS ${quoted(text)}`;
const common: readonly CommonFeature[] = ["upsert", "returning", "cte", "index:btree", "check", "views"];

/**
 * The PostgreSQL dialect.
 *
 * @example
 * const ctx = context({ dialect: postgres() });
 */
export function postgres(): Postgres {
  return build<"postgres", PostgresFeature>(
    {
      name: "postgres",
      maxNameLength: 63,
      replacesViews: true,
      features: [
        ...common,
        "schemas",
        "comments",
        "functions",
        "procedures",
        "triggers",
        "plpgsql",
        "enums",
        "domains",
        "sequences",
        "materialized-views",
        "partitions",
        "rls",
        "extensions",
        "arrays",
        "identity",
        "merge",
        "copy",
        "fk:actions",
        "index:hash",
        "index:gin",
        "index:gist",
        "index:brin",
        "index:spgist",
        "index:include",
        "index:concurrently",
        "index:partial",
        "index:expression",
      ],
      typeOf: (spec, self) => {
        switch (spec.kind) {
          case "text":
            return spec.length === undefined ? "TEXT" : `VARCHAR(${spec.length})`;
          case "integer":
            return "INTEGER";
          case "bigint":
            return "BIGINT";
          case "real":
            return "DOUBLE PRECISION";
          case "numeric":
            return `NUMERIC(${spec.precision}, ${spec.scale})`;
          case "boolean":
            return "BOOLEAN";
          case "date":
            return "DATE";
          case "timestamp":
            return spec.zone ? "TIMESTAMPTZ" : "TIMESTAMP";
          case "json":
            return spec.binary ? "JSONB" : "JSON";
          case "uuid":
            return "UUID";
          case "bytes":
            return "BYTEA";
          case "enum":
            return "TEXT";
          case "array":
            return `${self(spec.of)}[]`;
          case "custom":
            return spec.name;
          default:
            return absurd(spec);
        }
      },
      bytes: (b) => `'\\x${hex(b)}'::bytea`,
      nonFinite: (n) => `'${Number.isNaN(n) ? "NaN" : n > 0 ? "Infinity" : "-Infinity"}'::float8`,
      array: (items) => `ARRAY[${items.join(", ")}]`,
      param: (i) => `$${i}`,
      encode: (value, spec) => (isJson(value) && spec?.kind !== "array" ? JSON.stringify(value) : value),
      comment: commentOn,
      identity: () => ({ suffix: "GENERATED BY DEFAULT AS IDENTITY", isPrimaryKey: false }),
      generated: (e) => `GENERATED ALWAYS AS (${e}) STORED`,
    },
    [],
  );
}

/**
 * The SQLite dialect.
 *
 * @example
 * const ctx = context({ dialect: sqlite() });
 */
export function sqlite(): Sqlite {
  return build<"sqlite", SqliteFeature>(
    {
      name: "sqlite",
      maxNameLength: undefined,
      replacesViews: false,
      features: [...common, "triggers", "attach", "autoincrement", "fk:actions", "index:partial", "index:expression"],
      typeOf: (spec) => {
        switch (spec.kind) {
          case "text":
          case "date":
          case "timestamp":
          case "json":
          case "uuid":
          case "enum":
            return "TEXT";
          case "integer":
          case "bigint":
          case "boolean":
            return "INTEGER";
          case "real":
            return "REAL";
          case "numeric":
            return "NUMERIC";
          case "bytes":
            return "BLOB";
          case "array":
            return "TEXT";
          case "custom":
            return spec.name;
          default:
            return absurd(spec);
        }
      },
      bytes: (b) => `X'${hex(b)}'`,
      nonFinite: () => "NULL",
      param: (i) => `?${i}`,
      encode: (value) => {
        if (typeof value === "boolean") return value ? 1 : 0;
        if (value instanceof Date) return value.toISOString();
        return isJson(value) ? JSON.stringify(value) : value;
      },
      comment: () => undefined,
      identity: () => ({ suffix: "PRIMARY KEY AUTOINCREMENT", isPrimaryKey: true }),
      generated: (e) => `GENERATED ALWAYS AS (${e}) STORED`,
    },
    [],
  );
}

/**
 * The DuckDB dialect.
 *
 * @example
 * const ctx = context({ dialect: duckdb() });
 */
export function duckdb(): Duckdb {
  return build<"duckdb", DuckdbFeature>(
    {
      name: "duckdb",
      maxNameLength: undefined,
      replacesViews: true,
      features: [...common, "schemas", "comments", "macros", "enums", "sequences", "arrays", "attach", "read-files", "index:expression"],
      typeOf: (spec, self) => {
        switch (spec.kind) {
          case "text":
          case "enum":
            return "VARCHAR";
          case "integer":
            return "INTEGER";
          case "bigint":
            return "BIGINT";
          case "real":
            return "DOUBLE";
          case "numeric":
            return `DECIMAL(${spec.precision}, ${spec.scale})`;
          case "boolean":
            return "BOOLEAN";
          case "date":
            return "DATE";
          case "timestamp":
            return spec.zone ? "TIMESTAMPTZ" : "TIMESTAMP";
          case "json":
            return "JSON";
          case "uuid":
            return "UUID";
          case "bytes":
            return "BLOB";
          case "array":
            return `${self(spec.of)}[]`;
          case "custom":
            return spec.name;
          default:
            return absurd(spec);
        }
      },
      bytes: (b) => `from_hex('${hex(b)}')`,
      nonFinite: (n) => `'${Number.isNaN(n) ? "NaN" : n > 0 ? "Infinity" : "-Infinity"}'::DOUBLE`,
      array: (items) => `[${items.join(", ")}]`,
      param: (i) => `$${i}`,
      encode: (value, spec) => {
        if (value instanceof Date) return value.toISOString();
        return isJson(value) && spec?.kind !== "array" ? JSON.stringify(value) : value;
      },
      comment: (target, name, text) => (target === "function" ? undefined : commentOn(target, name, text)),
      identity: (sequence) => ({
        suffix: `DEFAULT nextval('${sequence}')`,
        isPrimaryKey: false,
        before: `CREATE SEQUENCE IF NOT EXISTS ${sequence};`,
      }),
      generated: (e) => `GENERATED ALWAYS AS (${e}) VIRTUAL`,
    },
    [],
  );
}
