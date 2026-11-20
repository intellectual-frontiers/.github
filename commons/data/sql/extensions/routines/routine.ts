// Spec: 0009-sql-features FR-011, FR-012, FR-013
/**
 * Routines (commons data 0009-sql-features FR-011 to FR-013): a function or procedure with typed parameters and a body that is text and typed references. A reference to a table, a column of a
 * table or a parameter is written by the case style as the name that table, column or parameter has, so a body never holds a name by hand that the case style could write differently.
 *
 * @limits
 * The SQL between the references is the author's: it is not read, and the engine is what refuses it.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { words } from "@intellectual-frontiers/data/governance";
import { columnNamed, featureId, type LogicalId, type LogicalType, tableNamed } from "@intellectual-frontiers/data/sql/logical";
import type { BindContext, PhysicalError, Statement, StatementSource } from "@intellectual-frontiers/data/sql/physical";

/** A reference in a body. */
export type Ref =
  | { readonly ref: "table"; readonly table: string }
  | { readonly ref: "column"; readonly table: string; readonly column: string }
  | { readonly ref: "columnName"; readonly table: string; readonly column: string }
  | { readonly ref: "param"; readonly param: string }
  /** A variable of a block, by its name as governance writes names (0050-sql-plpgsql). */
  | { readonly ref: "var"; readonly name: string }
  /** A type, written for the dialect. */
  | { readonly ref: "type"; readonly type: LogicalType }
  /** A column of a record a loop gives, by the table it is a row of. */
  | { readonly ref: "field"; readonly record: string; readonly table: string; readonly column: string };

/** A reference to a table, as governance names it. */
export const table = (name: string): Ref => ({ ref: "table", table: name });
/** A reference to a column of a table, as governance names them. */
export const column = (tableName: string, columnName: string): Ref => ({ ref: "column", table: tableName, column: columnName });
/** A reference to the name of a column alone, where SQL does not take it qualified (the target of `SET`). */
export const columnName = (tableName: string, columnName_: string): Ref => ({ ref: "columnName", table: tableName, column: columnName_ });
/** A reference to a parameter of the routine, written with the routine's name before it. */
export const param = (name: string): Ref => ({ ref: "param", param: name });

/** A parameter. */
export interface Param {
  readonly name: string;
  readonly type: LogicalType;
}

/** What a function returns: a type, the rows of a table, or rows of columns. */
export type Returns =
  | { readonly type: LogicalType }
  | { readonly setOf: string }
  | { readonly columns: readonly { readonly name: string; readonly type: LogicalType }[] };

/** A routine. */
export interface RoutineDefinition {
  readonly kind: "function" | "procedure";
  /** Its name as governance writes names, lower camel case. */
  readonly name: string;
  readonly description: string;
  readonly params?: readonly Param[];
  /** What a function returns; a procedure returns nothing. */
  readonly returns?: Returns;
  readonly language: "sql" | "plpgsql";
  readonly volatility?: "immutable" | "stable" | "volatile";
  readonly body: readonly (string | Ref)[];
}

const TAG = "$ifc$";

/**
 * The source of routines.
 *
 * @param definitions - the routines, in the order they are made
 * @returns a statement source
 */
export function routinesSource(definitions: readonly RoutineDefinition[]): StatementSource {
  return (context: BindContext) => {
    const { schema, dialect, written, naming } = context;
    const q = (n: string): string => dialect.quote(n);
    const w = (n: string): string => naming.names.write(words(n));
    const errors: PhysicalError[] = [];
    const out: Statement[] = [];
    for (const r of definitions) {
      const id = featureId("routine", words(r.name));
      const bad = (why: string): string => {
        errors.push({ kind: "unsupported", element: id, why: `the routine ${r.name}: ${why}` });
        return "";
      };
      if (!dialect.features.includes("routines")) {
        bad(`${dialect.name} has no routines`);
        continue;
      }
      const used: LogicalId[] = [];
      const name = w(r.name);
      const params = r.params ?? [];
      const body = r.body
        .map((part) => {
          if (typeof part === "string") {
            if (part.includes(TAG)) bad(`its body holds ${TAG}`);
            return part;
          }
          switch (part.ref) {
            case "table": {
              const t = tableNamed(schema, part.table);
              const n = t === undefined ? undefined : written.table(t.id);
              if (t === undefined || n === undefined) return bad(`the schema has no table ${part.table}`);
              used.push(t.id);
              return written.ref(t.id);
            }
            case "column":
            case "columnName": {
              const t = tableNamed(schema, part.table);
              const c = t === undefined ? undefined : columnNamed(t, part.column);
              const tn = t === undefined ? undefined : written.table(t.id);
              const cn = c === undefined ? undefined : written.column(c.id);
              if (t === undefined || c === undefined || tn === undefined || cn === undefined)
                return bad(`the schema has no column ${part.table}.${part.column}`);
              used.push(t.id, c.id);
              return part.ref === "column" ? `${written.ref(t.id)}.${q(cn)}` : q(cn);
            }
            case "param": {
              if (!params.some((p) => p.name === part.param)) return bad(`it has no parameter ${part.param}`);
              return `${q(name)}.${q(w(part.param))}`;
            }
            case "var":
              return q(w(part.name));
            case "type": {
              const t = dialect.unsupported?.(part.type);
              if (t !== undefined) return bad(t);
              return dialect.type(part.type);
            }
            case "field": {
              const t = tableNamed(schema, part.table);
              const c = t === undefined ? undefined : columnNamed(t, part.column);
              const cn = c === undefined ? undefined : written.column(c.id);
              if (t === undefined || c === undefined || cn === undefined) return bad(`the schema has no column ${part.table}.${part.column}`);
              used.push(t.id, c.id);
              return `${q(w(part.record))}.${q(cn)}`;
            }
          }
        })
        .join("");
      const typeOf = (t: LogicalType): string => (dialect.unsupported?.(t) === undefined ? dialect.type(t) : "");
      const args = params.map((p) => `${q(w(p.name))} ${typeOf(p.type)}`).join(", ");
      let returns = "";
      if (r.kind === "function") {
        const x = r.returns;
        if (x === undefined) bad("a function returns something");
        else if ("type" in x) returns = ` RETURNS ${typeOf(x.type)}`;
        else if ("setOf" in x) {
          const t = tableNamed(schema, x.setOf);
          const n = t === undefined ? undefined : written.table(t.id);
          if (t === undefined || n === undefined) bad(`the schema has no table ${x.setOf}`);
          else {
            used.push(t.id);
            returns = ` RETURNS SETOF ${written.ref(t.id)}`;
          }
        } else returns = ` RETURNS TABLE (${x.columns.map((c) => `${q(w(c.name))} ${typeOf(c.type)}`).join(", ")})`;
      }
      if (errors.length > 0) continue;
      const of = [...new Set(used)];
      const noun = r.kind === "function" ? "FUNCTION" : "PROCEDURE";
      const volatility = r.volatility === undefined || r.volatility === "volatile" ? "" : ` ${r.volatility.toUpperCase()}`;
      out.push({
        group: "routine",
        sql: `CREATE OR REPLACE ${noun} ${q(name)}(${args})${returns} LANGUAGE ${r.language}${volatility} AS ${TAG}\n${body}\n${TAG};`,
        of,
      });
      if (dialect.features.includes("comment-on") && r.description.trim() !== "") {
        const types = params.map((p) => typeOf(p.type)).join(", ");
        out.push({
          group: "routine",
          sql: `COMMENT ON ${noun} ${q(name)}(${types}) IS ${dialect.literal(r.description)};`,
          of,
        });
      }
    }
    return errors.length > 0 ? err(errors) : ok(out);
  };
}
