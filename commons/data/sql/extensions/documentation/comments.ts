// Spec: 0008-sql-documentation FR-001, FR-004
/**
 * The comments extension (commons data 0008-sql-documentation FR-001, FR-004): the description of each table and column, as `COMMENT ON TABLE` and `COMMENT ON COLUMN`, where the dialect has them.
 * The text is the description as it is, a human sentence; what a program reads is in the governance tables. A dialect with no `COMMENT ON` gets nothing from it.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import type { BindContext, Statement, StatementSource } from "@intellectual-frontiers/data/sql/physical";
import type { DocumentationSettings } from "./settings.ts";

/** The source of the comments. */
export function commentsSource(settings: DocumentationSettings): StatementSource {
  return (context: BindContext) => {
    if (settings.comments === "never" || !context.dialect.features.includes("comment-on")) return ok([]);
    const q = (n: string): string => context.dialect.quote(n);
    const out: Statement[] = [];
    for (const t of context.schema.tables) {
      const table = context.written.table(t.id);
      if (table === undefined) return err([{ kind: "unsupported", element: t.id, why: "a table that was not written" }]);
      if (t.comment.trim() !== "")
        out.push({
          group: "documentation",
          sql: `COMMENT ON TABLE ${context.written.ref(t.id)} IS ${context.dialect.literal(t.comment)};`,
          of: [t.id],
        });
      for (const c of t.columns) {
        const column = context.written.column(c.id);
        if (column !== undefined && c.comment.trim() !== "") {
          out.push({
            group: "documentation",
            sql: `COMMENT ON COLUMN ${context.written.ref(t.id)}.${q(column)} IS ${context.dialect.literal(c.comment)};`,
            of: [c.id],
          });
        }
      }
    }
    return ok(out);
  };
}
