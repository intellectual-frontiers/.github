// Spec: 0003-sql-port FR-002
/**
 * The statements of a store, built by the language of SQL: a name is written by `identifier` of the dialect, a parameter by `placeholder` in the order it is added, and no value is ever part of the
 * text, so that a path or a prefix with a quote, a percent sign or a backslash in it is only a value. Each dialect differs in three small things the builder hides: the type a column has, how bytes
 * are given to the engine (DuckDB takes them as hex, since it cannot type a binary parameter) and how a row is locked for writing (PostgreSQL's `FOR UPDATE`).
 *
 * @example
 * ```ts
 * import { sqlFor } from "./sql.ts";
 * const sql = sqlFor("postgres", naming);
 * sql.query().text("SELECT rev FROM ").table("objects").text(" WHERE path = ").param("a").done();
 * // { text: 'SELECT rev FROM anyfs_objects WHERE path = $1', params: ["a"] }
 * ```
 *
 * @module
 */
import { identifier, placeholder } from "@intellectual-frontiers/lang-sql";
import { dialect as duckdb } from "@intellectual-frontiers/lang-sql/dialects/duckdb";
import { dialect as postgres } from "@intellectual-frontiers/lang-sql/dialects/postgres";
import { dialect as sqlite } from "@intellectual-frontiers/lang-sql/dialects/sqlite";
import { absurd } from "@intellectual-frontiers/core";
import type { Dialect } from "@intellectual-frontiers/lang-sql";
import { type Naming, type SqlDialect, type SqlValue, type TableRole, tableOf } from "@intellectual-frontiers/anyfs-sql/governance";

/** A statement: its text and the parameters in the order they appear. */
export type Statement = { readonly text: string; readonly params: readonly SqlValue[] };

const LANGUAGE: Readonly<Record<SqlDialect, Dialect>> = { sqlite, postgres, duckdb };

const hexOf = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/** Bytes as an engine gives them back: the bytes themselves, or the bytes of a hex text (DuckDB). */
export function bytesOf(value: SqlValue): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (typeof value === "string") {
    const out = new Uint8Array(value.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
    return out;
  }
  return new Uint8Array(0);
}

/** A number as an engine gives it back: a number, a wide integer or the text of an integer (PostgreSQL gives a `BIGINT` as text). */
export function numberOf(value: SqlValue): number {
  return typeof value === "number" ? value : typeof value === "bigint" ? Number(value) : typeof value === "string" ? Number(value) : 0;
}

/** A text as an engine gives it back. */
export function textOf(value: SqlValue): string {
  return typeof value === "string" ? value : value === null ? "" : String(value);
}

/** The builder of one statement. */
export type Query = {
  /** Adds text written by this library (a keyword, an operator): never a value and never a name. */
  text(sql: string): Query;
  /** Adds a parameter: its placeholder goes into the text, and the value into the parameters. */
  param(value: SqlValue): Query;
  /** Adds the name of a table of the store (with its schema where there is one). */
  table(role: TableRole): Query;
  /** Adds a name written as an identifier of the dialect. */
  name(name: string): Query;
  /** Adds the bytes of an object as a value for a binary column. */
  bytes(value: Uint8Array): Query;
  /** Adds the binary column as it is selected (of a table given by an alias where there is one), so that its bytes come back as bytes or as hex. */
  selectBytes(column: string, qualifier?: string): Query;
  /** Adds ` FOR UPDATE` where the dialect locks a row that way. */
  forUpdate(): Query;
  done(): Statement;
};

/** The statements of the store of a naming in a dialect. */
export function sqlFor(dialect: SqlDialect, naming: Naming) {
  const language = LANGUAGE[dialect];
  const nameOf = (text: string): string => {
    const r = identifier(language, text);
    if (r.kind === "err") throw new Error(`${dialect} cannot write the name ${text}`);
    return r.value;
  };
  const tableName = (role: TableRole): string => (naming.schema === undefined ? nameOf(tableOf(naming, role)) : `${nameOf(naming.schema)}.${nameOf(tableOf(naming, role))}`);

  const query = (): Query => {
    let text = "";
    const params: SqlValue[] = [];
    const self: Query = {
      text(sql) {
        text += sql;
        return self;
      },
      param(value) {
        params.push(value);
        const p = placeholder(language, params.length);
        if (p.kind === "err") throw new Error(`${dialect} has no positional parameter`);
        text += p.value;
        return self;
      },
      table(role) {
        text += tableName(role);
        return self;
      },
      name(name) {
        text += nameOf(name);
        return self;
      },
      bytes(value) {
        if (dialect === "duckdb") {
          text += "unhex(";
          self.param(hexOf(value));
          text += ")";
        } else self.param(value);
        return self;
      },
      selectBytes(column, qualifier) {
        const q = qualifier === undefined ? "" : `${nameOf(qualifier)}.`;
        text += dialect === "duckdb" ? `hex(${q}${nameOf(column)}) AS ${nameOf(column)}` : `${q}${nameOf(column)}`;
        return self;
      },
      forUpdate() {
        if (dialect === "postgres") text += " FOR UPDATE";
        return self;
      },
      done: () => ({ text, params: [...params] }),
    };
    return self;
  };

  return {
    dialect,
    language,
    query,
    name: nameOf,
    table: tableName,
    /** The function that gives the length of a binary value in bytes. */
    byteLength: dialect === "sqlite" ? "length" : "octet_length",
    /** The type of a column in this dialect. */
    type: (kind: "text" | "integer" | "bytes" | "path"): string => {
      switch (kind) {
        case "text":
          return "TEXT";
        case "path":
          return dialect === "postgres" ? 'TEXT COLLATE "C"' : "TEXT";
        case "integer":
          return dialect === "sqlite" ? "INTEGER" : "BIGINT";
        case "bytes":
          return dialect === "postgres" ? "BYTEA" : "BLOB";
        default:
          return absurd(kind);
      }
    },
  };
}

/** The statements of one store. */
export type Sql = ReturnType<typeof sqlFor>;
