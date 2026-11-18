// Spec: 0015-sql-safety FR-009, FR-010
/**
 * Verification (commons data 0015-sql-safety FR-009, FR-010): each step says what must be true after it, from its change and from the states it is between, and the run checks it in the step's
 * transaction. A step that changes the structure and not the data must find the same number of rows in the table as before.
 *
 * @module
 */
import { sameWords } from "@intellectual-frontiers/data/sql/logical";
import type { Check, Capture, StepContext, StepDraft, StepTransform } from "@intellectual-frontiers/data/sql/lifecycle";
import { qualified } from "@intellectual-frontiers/data/sql/physical";
import type { Safety } from "./settings.ts";

const SAME_ROWS = new Set([
  "renameTable",
  "renameColumn",
  "addColumn",
  "dropColumn",
  "alterType",
  "alterNullable",
  "alterDefault",
  "addConstraint",
  "dropConstraint",
]);

/**
 * The verification transform.
 *
 * @param settings - the settings
 * @returns the transform
 */
export function verification(settings: Safety): StepTransform {
  return (draft, context): StepDraft => {
    if (!settings.verify) return draft;
    const { dialect } = context;
    const probes = dialect.probes;
    if (probes === undefined) return draft;
    const c = draft.change;
    const q = context.after.qualifier ?? context.before.qualifier;
    const after: Check[] = [];
    const before: Capture[] = [];
    const exists = (describe: string, query: string | undefined, expect: "rows" | "none"): void =>
      void (query === undefined ? 0 : after.push({ describe, query, expect }));
    const countOf = (name: string, state: StepContext["before"]): string =>
      `SELECT COUNT(*) FROM ${qualified(dialect, state.qualifier, name)}`;
    switch (c.kind) {
      case "createTable":
        exists(`the table ${c.table.name} exists`, probes.table(c.table.name, q), "rows");
        for (const col of c.table.columns)
          exists(`the column ${c.table.name}.${col.name} exists`, probes.column(c.table.name, col.name, q), "rows");
        break;
      case "dropTable":
        exists(`the table ${c.table.name} is gone`, probes.table(c.table.name, q), "none");
        break;
      case "renameTable":
        exists(`the table ${c.toName} exists`, probes.table(c.toName, q), "rows");
        exists(`the table ${c.fromName} is gone`, probes.table(c.fromName, q), "none");
        break;
      case "addColumn":
        exists(`the column ${c.table.name}.${c.column.name} exists`, probes.column(c.table.name, c.column.name, q), "rows");
        break;
      case "dropColumn":
        exists(`the column ${c.table.name}.${c.column.name} is gone`, probes.column(c.table.name, c.column.name, q), "none");
        break;
      case "renameColumn":
        exists(`the column ${c.table.name}.${c.to.name} exists`, probes.column(c.table.name, c.to.name, q), "rows");
        if (c.from.name !== c.to.name)
          exists(`the column ${c.table.name}.${c.from.name} is gone`, probes.column(c.table.name, c.from.name, q), "none");
        break;
      case "addConstraint":
        if (c.constraint.kind === "index") exists(`the index ${c.constraint.name} exists`, probes.index(c.constraint.name, q), "rows");
        else
          exists(
            `the constraint ${c.constraint.name} exists and is valid`,
            (probes.validConstraint ?? probes.constraint)(c.table.name, c.constraint.name, q),
            "rows",
          );
        break;
      case "dropConstraint":
        if (c.constraint.kind === "index") exists(`the index ${c.constraint.name} is gone`, probes.index(c.constraint.name, q), "none");
        else exists(`the constraint ${c.constraint.name} is gone`, probes.constraint(c.table.name, c.constraint.name, q), "none");
        break;
      default:
        break;
    }
    if (SAME_ROWS.has(c.kind)) {
      const t = "table" in c && "words" in c.table ? c.table.words : c.kind === "renameTable" ? c.toWords : undefined;
      const was =
        t === undefined ? undefined : context.before.tables.find((x) => sameWords(x.words, c.kind === "renameTable" ? c.fromWords : t));
      const is = t === undefined ? undefined : context.after.tables.find((x) => sameWords(x.words, t));
      if (was !== undefined && is !== undefined) {
        before.push({ key: "rows", query: countOf(was.name, context.before) });
        after.push({
          describe: `${is.name} has the same number of rows as before`,
          query: countOf(is.name, context.after),
          expect: { sameAs: "rows" },
        });
      }
    }
    if (after.length === 0) return draft;
    return {
      ...draft,
      verify: { before: [...(draft.verify?.before ?? []), ...before], after: [...(draft.verify?.after ?? []), ...after] },
    };
  };
}
