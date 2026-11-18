// Spec: 0007-physical FR-003, FR-005, FR-007
/**
 * How a logical schema is written (commons data 0007-physical): the names of its tables, columns and constraints as a case style writes them, and the text of what goes into a table (a column
 * with its type, nullability and default, a foreign key, a unique, a check). `bind` makes `CREATE TABLE` of them and the lifecycle makes `ALTER TABLE` of them, so that a column is written
 * one way wherever it is written.
 *
 * @module
 */
import { type Words, words } from "@intellectual-frontiers/data/governance";
import type {
  Check,
  CheckExpression,
  Column,
  ForeignKey,
  LogicalDefault,
  LogicalId,
  LogicalSchema,
  Table,
  Unique,
} from "@intellectual-frontiers/data/sql/logical";
import { type Naming, writeCode } from "./case.ts";
import type { Dialect } from "./dialect.ts";
import { qualified } from "./qualify.ts";
import type { PhysicalError, Written } from "./statement.ts";

/** The names of a schema as they are written, once, with what is wrong with them. */
export interface Names extends Written {
  /** The schema tables are qualified by, where the dialect has schemas and a schema was given. */
  readonly qualifier: string | undefined;
  /** The reference to a table by the words of its name. */
  refWords(table: Words): string;
  readonly tables: ReadonlyMap<LogicalId, string>;
  readonly columns: ReadonlyMap<LogicalId, string>;
  readonly constraints: ReadonlyMap<LogicalId, string>;
}

/**
 * Writes every name of a schema, and says which are too long or alike.
 *
 * @param schema - the logical schema
 * @param dialect - the dialect, for the longest a name may be
 * @param naming - the case styles
 * @param errors - where what is wrong is added
 * @param inSchema - the schema the tables are in: qualified where the dialect has schemas, else its words come first in each table's name
 * @returns the names
 */
export function writeNames(schema: LogicalSchema, dialect: Dialect, naming: Naming, errors: PhysicalError[], inSchema?: string): Names {
  const qualifier = inSchema !== undefined && dialect.features.includes("schemas") ? inSchema : undefined;
  const prefix: Words = inSchema !== undefined && qualifier === undefined ? words(inSchema) : [];
  const tableWords = (w: Words): Words => (prefix.length === 0 ? w : [...prefix, ...w]);
  const write = (w: Words, element: LogicalId): string => {
    const name = naming.names.write(w);
    if (name.length > dialect.maxName) errors.push({ kind: "length", element, name, max: dialect.maxName });
    return name;
  };
  const tables = new Map<LogicalId, string>();
  const columns = new Map<LogicalId, string>();
  const constraints = new Map<LogicalId, string>();
  const seenTables = new Map<string, LogicalId>();
  const seenConstraints = new Map<string, LogicalId>();
  for (const t of schema.tables) {
    const tn = write(tableWords(t.name), t.id);
    tables.set(t.id, tn);
    const other = seenTables.get(tn);
    if (other !== undefined) errors.push({ kind: "collision", name: tn, first: other, second: t.id });
    else seenTables.set(tn, t.id);
    const seenColumns = new Map<string, LogicalId>();
    for (const c of t.columns) {
      const cn = write(c.name, c.id);
      columns.set(c.id, cn);
      const o = seenColumns.get(cn);
      if (o !== undefined) errors.push({ kind: "collision", name: cn, table: tn, first: o, second: c.id });
      else seenColumns.set(cn, c.id);
    }
    for (const x of [...t.foreignKeys, ...t.uniques, ...t.checks, ...t.indexes]) {
      const xn = write(x.name, x.id);
      constraints.set(x.id, xn);
      const o = seenConstraints.get(xn);
      if (o !== undefined) errors.push({ kind: "collision", name: xn, table: tn, first: o, second: x.id });
      else seenConstraints.set(xn, x.id);
    }
  }
  return {
    qualifier,
    tables,
    columns,
    constraints,
    table: (id) => tables.get(id),
    column: (id) => columns.get(id),
    constraint: (id) => constraints.get(id),
    ref: (id) => qualified(dialect, qualifier, tables.get(id) ?? ""),
    qualify: (name) => qualified(dialect, qualifier, prefix.length === 0 ? name : naming.names.write([...prefix, ...words(name)])),
    tableName: (name) => (prefix.length === 0 ? name : naming.names.write([...prefix, ...words(name)])),
    refWords: (t) => qualified(dialect, qualifier, naming.names.write(tableWords(t))),
  };
}

/** What writes the parts of a table. */
export interface Expressor {
  /** A list of columns, each written and quoted. */
  list(words: readonly Words[]): string;
  defaultOf(d: LogicalDefault): string;
  /** The text of a check's condition, or none where the dialect cannot say it (an error is then added). */
  checkOf(c: Check): string | undefined;
  /** A column as a line of `CREATE TABLE` or of `ADD COLUMN`: its name, type, `NOT NULL`, default and, where it is the whole key and `inlineKey` is true, `PRIMARY KEY`. */
  columnLine(t: Table, c: Column, inlineKey?: boolean): string;
  fkClause(f: ForeignKey): string;
  uniqueClause(u: Unique): string;
  checkClause(c: Check): string | undefined;
}

/**
 * The writer of the parts of a table.
 *
 * @param dialect - the dialect
 * @param naming - the case styles
 * @param names - the written names
 * @param errors - where what the dialect cannot express is added
 * @returns the writer
 */
export function expressor(dialect: Dialect, naming: Naming, names: Names, errors: PhysicalError[]): Expressor {
  const q = (n: string): string => dialect.quote(n);
  const list = (ws: readonly Words[]): string => ws.map((w) => q(naming.names.write(w))).join(", ");
  const defaultOf = (d: LogicalDefault): string => {
    switch (d.kind) {
      case "literal":
        return dialect.literal(d.value);
      case "now":
        return dialect.now;
      case "code":
        return dialect.literal(writeCode(naming, d.name));
    }
  };
  const checkOf = (c: Check): string | undefined => {
    const e: CheckExpression = c.expression;
    const col = (w: Words): string => q(naming.names.write(w));
    switch (e.kind) {
      case "differs":
        return `${col(e.columns[0])} <> ${col(e.columns[1])}`;
      case "oneOf":
        return `${col(e.column)} IN (${e.codes.map((x) => dialect.literal(writeCode(naming, x))).join(", ")})`;
      case "range": {
        const parts = [
          ...(e.min === undefined ? [] : [`${col(e.column)} >= ${dialect.literal(e.min)}`]),
          ...(e.max === undefined ? [] : [`${col(e.column)} <= ${dialect.literal(e.max)}`]),
        ];
        return parts.join(" AND ");
      }
      case "pattern": {
        if (dialect.pattern === undefined) {
          errors.push({ kind: "unsupported", element: c.id, why: `${dialect.name} has no regular expression to check a pattern with` });
          return undefined;
        }
        return dialect.pattern(col(e.column), e.pattern);
      }
    }
  };
  return {
    list,
    defaultOf,
    checkOf,
    columnLine: (t, c, inlineKey = true) => {
      const key = inlineKey && t.primaryKey.length === 1 && t.primaryKey[0]?.join(".") === c.name.join(".");
      return `${q(names.columns.get(c.id) ?? "")} ${dialect.type(c.type)}${c.nullable ? "" : " NOT NULL"}${c.default === undefined ? "" : ` DEFAULT ${defaultOf(c.default)}`}${key ? " PRIMARY KEY" : ""}`;
    },
    fkClause: (f) =>
      `CONSTRAINT ${q(names.constraints.get(f.id) ?? "")} FOREIGN KEY (${list(f.columns)}) REFERENCES ${names.refWords(f.references.table)} (${list(f.references.columns)})`,
    uniqueClause: (u) => `CONSTRAINT ${q(names.constraints.get(u.id) ?? "")} UNIQUE (${list(u.columns)})`,
    checkClause: (c) => {
      const expr = checkOf(c);
      return expr === undefined ? undefined : `CONSTRAINT ${q(names.constraints.get(c.id) ?? "")} CHECK (${expr})`;
    },
  };
}
