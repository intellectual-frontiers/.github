// Spec: 0006-workbench-dialects FR-002, FR-003
/**
 * The matrix of requirement by dialect. Every requirement must end, for every dialect (a harness, or the human), as expressed, carried or unexpressed with a reason; a cell no dialect answers is dropped and fails. One rule is
 * added to Kanon's: a requirement an agent dialect cannot carry because a person is needed must be a gate that the human dialect expresses, so that an agent told to stop always has a person who is told to act.
 *
 * @example
 * ```ts
 * import { matrixFindings } from "./matrix.ts";
 * // matrixFindings(matrix, dialects): [] where every cell is answered and every gate has a person
 * ```
 *
 * @module
 */
import type { Contract, Requirement } from "@intellectual-frontiers/workbench/governance";

/** A file a dialect makes: its path from the root of the repository and its text. */
export type RenderedFile = { readonly path: string; readonly text: string };

/** What a dialect does with a requirement. */
export type Disposition =
  | { readonly kind: "expressed"; readonly how: string }
  | { readonly kind: "carried"; readonly how: string }
  | { readonly kind: "unexpressed"; readonly reason: string; readonly needsPerson: boolean };

/** A dialect: how one kind of operator, a harness or the human, receives each requirement. `express` answers nothing (`undefined`) only where the dialect forgot the requirement. */
export type Dialect = {
  readonly name: string;
  readonly holder: "human" | "agent";
  express(requirement: Requirement, contract: Contract): Disposition | undefined;
};

/** The matrix: a row for each requirement, a cell for each dialect. */
export type Matrix = {
  readonly dialects: readonly string[];
  readonly rows: readonly { readonly requirement: string; readonly cells: Readonly<Record<string, Disposition | undefined>> }[];
};

/** What is wrong with a matrix. */
export type MatrixFinding = { readonly kind: "dropped"; readonly requirement: string; readonly dialect: string } | { readonly kind: "no-person"; readonly requirement: string; readonly dialect: string };

/** The matrix of the requirements and the dialects. */
export function matrixOf(requirements: readonly Requirement[], contract: Contract, dialects: readonly Dialect[]): Matrix {
  return {
    dialects: dialects.map((d) => d.name),
    rows: requirements.map((r) => ({ requirement: r.id, cells: Object.fromEntries(dialects.map((d) => [d.name, d.express(r, contract)])) })),
  };
}

/** The findings of a matrix: a cell that is dropped, and an agent dialect's `needs a person` that no human dialect expresses. */
export function matrixFindings(matrix: Matrix, dialects: readonly Dialect[]): readonly MatrixFinding[] {
  const out: MatrixFinding[] = [];
  const humans = dialects.filter((d) => d.holder === "human").map((d) => d.name);
  for (const row of matrix.rows) {
    for (const d of matrix.dialects) if (row.cells[d] === undefined) out.push({ kind: "dropped", requirement: row.requirement, dialect: d });
    for (const d of dialects.filter((x) => x.holder === "agent")) {
      const cell = row.cells[d.name];
      if (cell?.kind === "unexpressed" && cell.needsPerson && !humans.some((h) => row.cells[h]?.kind === "expressed")) out.push({ kind: "no-person", requirement: row.requirement, dialect: d.name });
    }
  }
  return out;
}

/** The matrix as a Markdown table, for a page. */
export function matrixMarkdown(matrix: Matrix): string {
  const cell = (c: Disposition | undefined): string => (c === undefined ? "dropped" : c.kind === "unexpressed" ? `unexpressed: ${c.reason}` : `${c.kind}: ${c.how}`);
  return [`| requirement | ${matrix.dialects.join(" | ")} |`, `|---|${matrix.dialects.map(() => "---").join("|")}|`, ...matrix.rows.map((r) => `| ${r.requirement} | ${matrix.dialects.map((d) => cell(r.cells[d])).join(" | ")} |`)].join("\n") + "\n";
}
