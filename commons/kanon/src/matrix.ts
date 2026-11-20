// Spec: 0001-kanon-checker FR-014
/**
 * The matrix of requirement by instance (commons 0033-kanon FR-023): for each annotation of each element of Governance, and for each instance (dialect) of the model, how it ends: expressed, carried
 * or unexpressed with its reason, or dropped where it ends in none (a finding). A typed value, and its two renderings for the documentation lens: Markdown and JSON.
 *
 * @remarks
 * Pure and total. The rows are made from the same reading of the dispositions as the check of dropped annotations (`accountOf`), so a `dropped` cell is exactly a `kanon/dropped` finding. A row is
 * keyed by the element's `ElementId` and the annotation's name, which are those of the `LayeredModel` the documentation generator reads, so that a page can link a row to its element. The
 * columns are the model's instances in their order; a model with no instances has no columns and each row has no cells.
 *
 * @example
 * ```ts
 * import { buildMatrix, matrixMarkdown, type LayeredModel } from "@intellectual-frontiers/kanon";
 * declare const model: LayeredModel;
 * matrixMarkdown(buildMatrix(model));
 * ```
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { accountOf, type Cell, OUTCOMES } from "./account.ts";
import type { InstanceName } from "./family.ts";
import type { ElementId, LayeredModel } from "./model.ts";

/** One cell of a row: the instance and how the annotation ends for it. */
export type MatrixCell = { readonly instance: InstanceName; readonly cell: Cell };

/** One row: an annotation of an element of Governance, with a cell for each instance of the matrix, in its order. */
export type MatrixRow = {
  readonly element: ElementId;
  readonly name: string;
  readonly annotation: string;
  readonly cells: readonly MatrixCell[];
};

/** The matrix of a model: its instances and the rows. */
export type Matrix = {
  readonly model: string;
  readonly instances: readonly InstanceName[];
  readonly rows: readonly MatrixRow[];
};

/** The matrix of a model: a row for each annotation of each element of its first layer and a cell for each instance. */
export function buildMatrix(model: LayeredModel): Matrix {
  const top = model.layers[0]?.id;
  const rows: MatrixRow[] = [];
  for (const el of model.elements) {
    if (el.layer !== top) continue;
    for (const annotation of Object.keys(el.properties))
      rows.push({
        element: el.id,
        name: el.name,
        annotation,
        cells: model.instances.map((instance) => ({ instance, cell: accountOf(model, el, annotation, instance) })),
      });
  }
  return { model: model.name, instances: model.instances, rows };
}

/** How many cells end each way: a registry with an entry for every outcome. */
export function matrixTotals(matrix: Matrix): Readonly<Record<Cell["outcome"], number>> {
  const totals: Record<Cell["outcome"], number> = { expressed: 0, carried: 0, unexpressed: 0, dropped: 0 };
  for (const row of matrix.rows) for (const c of row.cells) totals[c.cell.outcome] += 1;
  return totals;
}

/** The words of a cell, for a table: `expressed (by X)`, `carried (by X)`, `unexpressed: the reason`, `dropped`. */
export function cellText(cell: Cell): string {
  switch (cell.outcome) {
    case "expressed":
    case "carried":
      return `${cell.outcome} (${cell.target})`;
    case "unexpressed":
      return `unexpressed: ${cell.reason}`;
    case "dropped":
      return "dropped";
    default:
      return absurd(cell);
  }
}

const escapeCell = (text: string): string => text.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

/** The matrix as a Markdown table, for the documentation lens: one row for each annotation, one column for each instance, then a line of totals. */
export function matrixMarkdown(matrix: Matrix): string {
  const head = ["Requirement", "Annotation", ...matrix.instances];
  const lines = [
    `| ${head.map(escapeCell).join(" | ")} |`,
    `| ${head.map(() => "---").join(" | ")} |`,
    ...matrix.rows.map(
      (r) => `| ${[`${r.name} (${r.element})`, r.annotation, ...r.cells.map((c) => cellText(c.cell))].map(escapeCell).join(" | ")} |`,
    ),
  ];
  const totals = matrixTotals(matrix);
  return `${lines.join("\n")}\n\n${OUTCOMES.map((o) => `${totals[o]} ${o}`).join(", ")}\n`;
}

/** The matrix as JSON text, two spaces to a level and a final newline: the matrix is plain data, so this is the value itself. */
export function matrixJson(matrix: Matrix): string {
  return `${JSON.stringify(matrix, null, 2)}\n`;
}
