// Spec: 0008-sql-documentation FR-007
/**
 * The tables of the extensions, made by the physical schema's own machinery (commons data 0008-sql-documentation FR-007): each is a small logical schema of its own, bound with the dialect and the
 * naming of the schema it documents, so that its names are written by the case style, its types are the dialect's and its statements are `CREATE TABLE IF NOT EXISTS`. A table of the
 * documented schema that has one of its names is an error value.
 *
 * @module
 */
import { type ElementId, words } from "@intellectual-frontiers/data/governance";
import {
  type Column,
  columnId,
  type LogicalSchema,
  type LogicalType,
  schemaId,
  type Table,
  tableId,
} from "@intellectual-frontiers/data/sql/logical";
import {
  bind,
  type BindContext,
  type Literal,
  type PhysicalError,
  type Statement,
  upsert,
} from "@intellectual-frontiers/data/sql/physical";
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";

/** A column of a table of an extension. */
export interface ColumnSpec {
  readonly name: string;
  readonly type: LogicalType;
  readonly comment: string;
}

/** A table of an extension: its name as governance writes it, its columns and its key, all required. */
export interface TableSpec {
  readonly name: string;
  readonly comment: string;
  readonly columns: readonly ColumnSpec[];
  readonly key: readonly string[];
}

/** The text type. */
export const TEXT: LogicalType = { kind: "text" };
/** The integer type. */
export const INTEGER: LogicalType = { kind: "integer" };
/** The JSON type. */
export const JSON_TYPE: LogicalType = { kind: "json" };

/** The logical table of a spec, owned by the domain it documents. */
export function tableOfSpec(spec: TableSpec, from: ElementId): Table {
  const name = words(spec.name);
  const columns: Column[] = spec.columns.map((c) => ({
    id: columnId(name, words(c.name)),
    from,
    name: words(c.name),
    type: c.type,
    nullable: false,
    comment: c.comment,
    governance: [],
    role: "attribute",
  }));
  return {
    id: tableId(name),
    from,
    name,
    comment: spec.comment,
    role: "concept",
    columns,
    primaryKey: spec.key.map(words),
    foreignKeys: [],
    uniques: [],
    checks: [],
    indexes: [],
    governance: [],
  };
}

/**
 * Binds tables of an extension for the schema of a context, or returns why it cannot.
 *
 * @param context - what the extension is given
 * @param specs - the tables to make
 * @returns the statements that create them, and the tables as bound, or the errors, among which a table of the schema that has a name of theirs
 */
export function createTables(
  context: BindContext,
  specs: readonly TableSpec[],
): Result<{ readonly statements: readonly Statement[]; readonly tables: readonly Table[] }, readonly PhysicalError[]> {
  const from = context.schema.from;
  const tables = specs.map((s) => tableOfSpec(s, from));
  const taken = new Map(context.schema.tables.map((t) => [context.written.table(t.id) ?? "", t.id]));
  const errors: PhysicalError[] = [];
  for (const t of tables) {
    const written = context.written.tableName(context.naming.names.write(t.name));
    const first = taken.get(written);
    if (first !== undefined) errors.push({ kind: "collision", name: written, first, second: t.id });
  }
  if (errors.length > 0) return err(errors);
  const fragment: LogicalSchema = {
    id: schemaId(`${context.schema.domain}.documentation`),
    from,
    domain: context.schema.domain,
    comment: "",
    tables,
    valueSets: [],
    governance: [],
  };
  const bound = bind(fragment, {
    dialect: context.dialect,
    naming: context.naming,
    ...(context.schemaName === undefined ? {} : { schema: context.schemaName }),
  });
  return bound.kind === "err" ? err(bound.error) : ok({ statements: bound.value.statements, tables });
}

/**
 * The statements that load a table of an extension whole: what is there is cleared, then the rows are upserted, so that a row of what is gone is never read as current and a load run twice
 * leaves the same rows.
 *
 * @param context - what the extension is given
 * @param table - the table, as bound
 * @param rows - the rows, in the order of the table's columns
 * @param keyLength - how many of the first columns are the key
 * @returns the statements, in the group of data
 */
export function reload(context: BindContext, table: Table, rows: readonly (readonly Literal[])[], keyLength: number): readonly Statement[] {
  const name = context.naming.names.write(table.name);
  const names = table.columns.map((c) => context.naming.names.write(c.name));
  return [
    { group: "data", sql: `DELETE FROM ${context.written.qualify(name)};`, of: [table.id] },
    ...(rows.length === 0
      ? []
      : [
          {
            group: "data" as const,
            sql: upsert(
              context.dialect,
              context.written.tableName(name),
              names,
              names.slice(0, keyLength),
              rows,
              context.written.qualifier,
            ),
            of: [table.id],
          },
        ]),
  ];
}
