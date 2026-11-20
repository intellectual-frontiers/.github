// Spec: 0008-sql-documentation FR-003, FR-007, FR-008, FR-009
/**
 * The governance tables extension (commons data 0008-sql-documentation FR-003, FR-009): what governance says, in tables a program reads. `governance_annotation` holds every annotation of the
 * domain as a row (the element, the position among the element's annotations, the kind and the value as JSON), where the annotations that the schema cannot express itself are carried as
 * data; `governance_trace` holds each table and column as it is written in the database with the governance element and the logical element it was made from.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import type { Annotation, ElementId } from "@intellectual-frontiers/data/governance";
import type { BindContext, Literal, Statement, StatementSource } from "@intellectual-frontiers/data/sql/physical";
import { createTables, INTEGER, JSON_TYPE, reload, TEXT } from "./fragment.ts";
import type { DocumentationSettings } from "./settings.ts";

/** The source of the governance tables. */
export function governanceTablesSource(settings: DocumentationSettings): StatementSource {
  return (context: BindContext) => {
    if (settings.governanceTables === "off") return ok([]);
    const made = createTables(context, [
      {
        name: settings.names.governanceAnnotation,
        comment: "Every annotation of governance: what it says of an element, as JSON",
        columns: [
          { name: "elementId", type: TEXT, comment: "The governance element the annotation is on" },
          { name: "position", type: INTEGER, comment: "Its place among the element's annotations" },
          { name: "annotation", type: TEXT, comment: "Its kind, such as privacy.personal" },
          { name: "value", type: JSON_TYPE, comment: "What it says, as JSON" },
        ],
        key: ["elementId", "position"],
      },
      {
        name: settings.names.governanceTrace,
        comment: "The governance element and the logical element each table and column was made from",
        columns: [
          { name: "tableName", type: TEXT, comment: "The table" },
          { name: "columnName", type: TEXT, comment: "The column, or the empty text for the table itself" },
          { name: "elementId", type: TEXT, comment: "The governance element it was made from" },
          { name: "logicalId", type: TEXT, comment: "The logical element it was made from" },
        ],
        key: ["tableName", "columnName"],
      },
    ]);
    if (made.kind === "err") return err(made.error);

    // every annotation of the domain, once: the elements that carry them are the schema, its value sets, its tables and its columns
    const seen = new Map<string, Literal[]>();
    const carry = (element: ElementId, annotations: readonly Annotation[]): void => {
      annotations.forEach((a, position) => {
        const key = `${element}|${position}`;
        if (!seen.has(key)) seen.set(key, [element, position, a.kind, JSON.stringify(a.value)]);
      });
    };
    carry(context.schema.from, context.schema.governance);
    for (const v of context.schema.valueSets) carry(v.from, v.governance);
    for (const t of context.schema.tables) {
      carry(t.from, t.governance);
      for (const c of t.columns) carry(c.from, c.governance);
    }
    const annotations = [...seen.values()];
    const trace: Literal[][] = [];
    for (const t of context.schema.tables) {
      const table = context.written.table(t.id) ?? "";
      trace.push([table, "", t.from, t.id]);
      for (const c of t.columns) trace.push([table, context.written.column(c.id) ?? "", c.from, c.id]);
    }
    const statements: Statement[] = [...made.value.statements];
    const [annotationTable, traceTable] = made.value.tables;
    if (annotationTable !== undefined) statements.push(...reload(context, annotationTable, annotations, 2));
    if (traceTable !== undefined) statements.push(...reload(context, traceTable, trace, 2));
    return ok(statements);
  };
}
