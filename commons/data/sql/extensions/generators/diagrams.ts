// Spec: 0010-sql-generators FR-005
/**
 * The diagrams (commons data 0010-sql-generators FR-005): an entity-relationship diagram in Mermaid and in D2, made of every table with each column's type and key marks and a relationship for
 * each foreign key. A column that only a closed list of codes fills is an `enum`.
 *
 * @module
 */
import { ok } from "@intellectual-frontiers/core";
import type { Generator } from "@intellectual-frontiers/data/sql/physical";
import { docOf, lines, typeName } from "./model.ts";

/** The Mermaid diagram: `<domain>.erd.mmd`. */
export const mermaid: Generator = {
  id: "sql.generate.erd-mermaid",
  describe: "An entity-relationship diagram in Mermaid",
  generate: (context) => {
    const doc = docOf(context);
    const out = ["erDiagram"];
    for (const t of doc.tables) {
      out.push(`    ${t.name} {`);
      for (const c of t.columns) {
        const marks = [...(c.primaryKey ? ["PK"] : []), ...(c.points === undefined ? [] : ["FK"])].join(", ");
        out.push(`        ${c.codes === undefined ? typeName(c.type) : "enum"} ${c.name}${marks === "" ? "" : ` ${marks}`}`);
      }
      out.push("    }");
    }
    for (const t of doc.tables)
      for (const c of t.columns)
        if (c.points !== undefined) out.push(`    ${c.points.table} ||--${c.single ? "o|" : "o{"} ${t.name} : "${c.name}"`);
    return ok([{ path: `${doc.stem}.erd.mmd`, text: lines(out) }]);
  },
};

/** The D2 diagram: `<domain>.erd.d2`. */
export const d2: Generator = {
  id: "sql.generate.erd-d2",
  describe: "An entity-relationship diagram in D2",
  generate: (context) => {
    const doc = docOf(context);
    const out: string[] = [];
    for (const t of doc.tables) {
      out.push(`${t.name}: {`, "  shape: sql_table");
      for (const c of t.columns) {
        const marks = [...(c.primaryKey ? ["primary_key"] : []), ...(c.points === undefined ? [] : ["foreign_key"])];
        const constraint =
          marks.length === 0 ? "" : marks.length === 1 ? ` {constraint: ${marks[0]}}` : ` {constraint: [${marks.join("; ")}]}`;
        out.push(`  ${c.name}: ${c.codes === undefined ? typeName(c.type) : "enum"}${constraint}`);
      }
      out.push("}");
    }
    for (const t of doc.tables)
      for (const c of t.columns) if (c.points !== undefined) out.push(`${t.name}.${c.name} -> ${c.points.table}.${c.points.column}`);
    return ok([{ path: `${doc.stem}.erd.d2`, text: lines(out) }]);
  },
};
