// Spec: 0010-sql-generators FR-010, FR-012
/**
 * The register (commons data 0010-sql-generators FR-010): what governance says of personal data and of security, read in one place, as Markdown. Every table and column that holds personal data
 * is a row with its category, the class the category is in, the purposes and the retention; every one that carries a classification, access, scope or mask is a row of security.
 *
 * @module
 */
import { ok } from "@intellectual-frontiers/core";
import { vocabularies } from "@intellectual-frontiers/data/governance";
import { carriedOf } from "@intellectual-frontiers/data/sql/logical";
import type { Generator } from "@intellectual-frontiers/data/sql/physical";
import { cell, docOf, lines, securityOf } from "./model.ts";

const { privacy, quality } = vocabularies;

const retention = (e: Parameters<typeof carriedOf>[0]): string => {
  const r = carriedOf(e, quality.retention)[0];
  return r === undefined ? "" : JSON.stringify(r);
};

/** The register: `<domain>.register.md`. */
export const register: Generator = {
  id: "sql.generate.register",
  describe: "A register of personal data and security, in Markdown",
  generate: (context) => {
    const doc = docOf(context);
    const personal: string[] = [];
    const secure: string[] = [];
    for (const t of doc.tables) {
      const tp = carriedOf(t.table, privacy.personal)[0];
      if (tp !== undefined)
        personal.push(
          `| ${cell(t.name)} | | ${cell(tp.category ?? "")} | ${cell(tp.category === undefined ? "" : privacy.dpvClassOf(tp.category))} | ${cell((tp.purposes ?? []).join("; "))} | ${cell(retention(t.table))} |`,
        );
      const ts = securityOf(t.table);
      if (ts.length > 0) secure.push(`| ${cell(t.name)} | | ${cell(ts.join("; "))} |`);
      for (const c of t.columns) {
        if (c.personal !== undefined)
          personal.push(
            `| ${cell(t.name)} | ${cell(c.name)} | ${cell(c.personal.category ?? "")} | ${cell(c.personal.class ?? "")} | ${cell(c.personal.purposes.join("; "))} | ${cell(retention(c.column))} |`,
          );
        const cs = securityOf(c.column);
        if (cs.length > 0) secure.push(`| ${cell(t.name)} | ${cell(c.name)} | ${cell(cs.join("; "))} |`);
      }
    }
    const out = [
      `# Register: ${doc.domain}`,
      "",
      "## Personal data",
      "",
      "| Table | Column | Category | Class | Purposes | Retention |",
      "| --- | --- | --- | --- | --- | --- |",
      ...personal,
      "",
      "## Security",
      "",
      "| Table | Column | What governance says |",
      "| --- | --- | --- |",
      ...secure,
    ];
    return ok([{ path: `${doc.stem}.register.md`, text: lines(out) }]);
  },
};
