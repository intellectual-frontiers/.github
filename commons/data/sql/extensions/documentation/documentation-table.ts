// Spec: 0008-sql-documentation FR-002, FR-007, FR-008
/**
 * The documentation tables extension (commons data 0008-sql-documentation FR-002): a table of the description of each table and column, where the dialect has no `COMMENT ON` (the default),
 * everywhere, or nowhere. It is keyed by the table and the column, the empty text naming the table itself, and loaded by an upsert, so that a load run twice leaves the same rows.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/commons/ts/kernel";
import type { BindContext, Literal, Statement, StatementSource } from "@intellectual-frontiers/data/sql/physical";
import { createTables, reload, TEXT } from "./fragment.ts";
import type { DocumentationSettings } from "./settings.ts";

/** The source of the documentation table. */
export function documentationTableSource(settings: DocumentationSettings): StatementSource {
  return (context: BindContext) => {
    const wanted =
      settings.documentationTables === "always" ||
      (settings.documentationTables === "when-no-comment" && !context.dialect.features.includes("comment-on"));
    if (!wanted) return ok([]);
    const made = createTables(context, [
      {
        name: settings.names.documentation,
        comment: "What each table and column of this database is, in words",
        columns: [
          { name: "tableName", type: TEXT, comment: "The table" },
          { name: "columnName", type: TEXT, comment: "The column, or the empty text where the description is of the table" },
          { name: "description", type: TEXT, comment: "What it is" },
        ],
        key: ["tableName", "columnName"],
      },
    ]);
    if (made.kind === "err") return err(made.error);
    const rows: Literal[][] = [];
    for (const t of context.schema.tables) {
      const table = context.written.table(t.id) ?? "";
      if (t.comment.trim() !== "") rows.push([table, "", t.comment]);
      for (const c of t.columns) if (c.comment.trim() !== "") rows.push([table, context.written.column(c.id) ?? "", c.comment]);
    }
    const table = made.value.tables[0];
    const statements: Statement[] = [...made.value.statements, ...(table === undefined ? [] : reload(context, table, rows, 2))];
    return ok(statements);
  };
}
