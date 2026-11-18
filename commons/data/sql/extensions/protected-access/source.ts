// Spec: 0014-sql-protected-access FR-002, FR-003, FR-005, FR-006, FR-007
/**
 * The source of the protection layer (commons data 0014-sql-protected-access): the schema of the views, a view of every table, and where the layer is enforced the rights, the guard and the
 * policies. A table of the schema that is not in the schema of the tables, or a layer asked to be enforced where it cannot be, is an error value.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/commons/ts/kernel";
import type { LogicalSchema, Table } from "@intellectual-frontiers/data/sql/logical";
import type { BindContext, PhysicalError, Statement, StatementSource } from "@intellectual-frontiers/data/sql/physical";
import { featureId } from "./deps.ts";
import { enforcement, guard, rights } from "./guard.ts";
import { type Protection } from "./settings.ts";
import { type ViewContext, type ViewTable, viewStatements } from "./view.ts";

/** A table of the logical schema as a view is made from it. */
export function viewTableOf(t: Table, context: BindContext): ViewTable {
  const { written, naming, dialect } = context;
  return {
    words: t.name,
    name: written.table(t.id) ?? "",
    qualifier: written.qualifier,
    columns: t.columns.map((c) => ({ name: written.column(c.id) ?? "", words: c.name, type: dialect.type(c.type) })),
    primaryKey: t.primaryKey.map((k) => naming.names.write(k)),
    comment: t.comment,
    of: [t.id, ...t.columns.map((c) => c.id)],
  };
}

/** What a view is made with, for a schema and a dialect. */
export function viewContext(
  schema: LogicalSchema,
  context: Pick<BindContext, "dialect" | "naming">,
  settings: Protection,
  enforced: boolean,
): ViewContext {
  return { dialect: context.dialect, naming: context.naming, schema, settings, enforced };
}

/**
 * The source of the layer.
 *
 * @param settings - the settings, with every default filled
 * @returns a statement source
 */
export function protectionSource(settings: Protection): StatementSource {
  return (context: BindContext) => {
    const { dialect, schema } = context;
    const errors: PhysicalError[] = [];
    const { enforced, errors: refused } = enforcement(dialect, settings);
    errors.push(...refused);
    if (context.schemaName !== settings.tablesSchema)
      errors.push({
        kind: "unsupported",
        element: featureId("policy", ["protection"]),
        why: `the tables are in ${context.schemaName === undefined ? "no schema" : context.schemaName}, not in ${settings.tablesSchema}: give bind the schema of the tables`,
      });
    const out: Statement[] = [];
    if (dialect.features.includes("schemas"))
      out.push({ group: "setup", sql: `CREATE SCHEMA IF NOT EXISTS ${dialect.quote(settings.viewsSchema)};`, of: [] });
    const vc = viewContext(schema, context, settings, enforced);
    for (const t of schema.tables) {
      const made = viewStatements(viewTableOf(t, context), vc);
      errors.push(...made.errors);
      out.push(...made.statements);
    }
    if (enforced) {
      out.push(...rights(dialect, settings, schema));
      if (settings.owner !== undefined) {
        const q = (n: string): string => dialect.quote(n);
        const who = featureId("policy", ["protection", "owner"]);
        out.push(
          { group: "policy", sql: `ALTER SCHEMA ${q(settings.tablesSchema)} OWNER TO ${q(settings.owner)};`, of: [who] },
          { group: "policy", sql: `ALTER SCHEMA ${q(settings.viewsSchema)} OWNER TO ${q(settings.owner)};`, of: [who] },
        );
        for (const t of schema.tables)
          out.push({ group: "policy", sql: `ALTER TABLE ${context.written.ref(t.id)} OWNER TO ${q(settings.owner)};`, of: [t.id] });
      }
      if (settings.guard) out.push(...guard(dialect, settings));
    }
    return errors.length > 0 ? err(errors) : ok(out);
  };
}
