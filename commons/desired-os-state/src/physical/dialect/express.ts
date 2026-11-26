// Spec: 0004-desired-os-state-dialects FR-003, FR-004
/**
 * What a dialect can express of a requirement, annotation by annotation, and the matrix of every requirement against every dialect. An annotation is expressed (the dialect carries it out),
 * carried (the dialect passes it on as data for something else to read) or unexpressed, with the reason: so that what a tool cannot do is a named finding and never a surprise.
 *
 * @example
 * ```ts
 * import { matrixTotals } from "./express.ts";
 * // matrixTotals(matrixOf(requirements, dialects)) counts the cells by state
 * ```
 *
 * @module
 */
import { KINDS, kindOf, type DialectId, type KindSpec, type Requirement, type RequirementId, type SubjectClass } from "@intellectual-frontiers/desired-os-state/governance";
import type { Dialect } from "./types.ts";

/** What a requirement asks of a dialect. */
export type Annotation = "kind" | "subject" | "change" | "plan" | "verify";

/** What a dialect does with one annotation. */
export type Expression =
  | { readonly annotation: Annotation; readonly state: "expressed" | "carried" }
  | { readonly annotation: Annotation; readonly state: "unexpressed"; readonly reason: string };

/** The annotations of one requirement for one dialect. */
export type Cell = { readonly dialect: DialectId; readonly expressions: readonly Expression[] };
/** One requirement against every dialect. */
export type Row = { readonly requirement: RequirementId; readonly cells: readonly Cell[] };
/** Every requirement against every dialect. */
export type Matrix = { readonly dialects: readonly DialectId[]; readonly rows: readonly Row[] };
/** The cells counted by state. */
export type Totals = { readonly expressed: number; readonly carried: number; readonly unexpressed: number };

function subjectClasses(requirement: Requirement, catalogue: readonly KindSpec[]): readonly SubjectClass[] {
  if (requirement.subject.by === "class") return [requirement.subject.class];
  return kindOf(requirement.kind, catalogue)?.subjects ?? [];
}

/** What a dialect expresses of a requirement. */
export function expressibility(requirement: Requirement, dialect: Dialect, catalogue: readonly KindSpec[] = KINDS): readonly Expression[] {
  const g = dialect.guarantees;
  const out: Expression[] = [];

  out.push(g.kinds.includes(requirement.kind) ? { annotation: "kind", state: "expressed" } : { annotation: "kind", state: "unexpressed", reason: `${dialect.id} does not carry out ${requirement.kind}` });

  const classes = subjectClasses(requirement, catalogue);
  out.push(classes.some((c) => g.subjects.includes(c)) ? { annotation: "subject", state: "expressed" } : { annotation: "subject", state: "unexpressed", reason: `${dialect.id} cannot reach a subject of ${classes.join(" or ") || "no class"}` });

  const destroys = requirement.change === "destructive" || requirement.ensure === "absent";
  out.push(!destroys || g.destroy ? { annotation: "change", state: "expressed" } : { annotation: "change", state: "unexpressed", reason: `${dialect.id} cannot destroy, and ${requirement.id} is destructive` });

  const planOk = requirement.plan === "faithful" ? g.plan === "faithful" : g.plan !== "none";
  out.push(planOk ? { annotation: "plan", state: "expressed" } : { annotation: "plan", state: "unexpressed", reason: `the plan of ${dialect.id} is ${g.plan}, and ${requirement.id} asks for a ${requirement.plan} plan` });

  switch (requirement.verify.by) {
    case "osquery":
      out.push({ annotation: "verify", state: "carried" });
      break;
    case "none":
      out.push({ annotation: "verify", state: "expressed" });
      break;
    case "dialect":
      out.push(g.plan !== "none" ? { annotation: "verify", state: "expressed" } : { annotation: "verify", state: "unexpressed", reason: `${dialect.id} has no check mode to verify with` });
      break;
  }
  return out;
}

/** Every requirement against every dialect. */
export function matrixOf(requirements: readonly Requirement[], dialects: readonly Dialect[], catalogue: readonly KindSpec[] = KINDS): Matrix {
  return {
    dialects: dialects.map((d) => d.id),
    rows: requirements.map((r) => ({ requirement: r.id, cells: dialects.map((d) => ({ dialect: d.id, expressions: expressibility(r, d, catalogue) })) })),
  };
}

/** The annotations of a matrix counted by state. */
export function matrixTotals(matrix: Matrix): Totals {
  let expressed = 0;
  let carried = 0;
  let unexpressed = 0;
  for (const row of matrix.rows) for (const cell of row.cells) for (const e of cell.expressions) {
    if (e.state === "expressed") expressed++;
    else if (e.state === "carried") carried++;
    else unexpressed++;
  }
  return { expressed, carried, unexpressed };
}

/** Every annotation that no dialect expresses or carries is a finding: the requirement, the dialect and the reason. */
export function unexpressedOf(matrix: Matrix): readonly { readonly requirement: RequirementId; readonly dialect: DialectId; readonly annotation: Annotation; readonly reason: string }[] {
  return matrix.rows.flatMap((row) =>
    row.cells.flatMap((cell) =>
      cell.expressions.flatMap((e) => (e.state === "unexpressed" ? [{ requirement: row.requirement, dialect: cell.dialect, annotation: e.annotation, reason: e.reason }] : [])),
    ),
  );
}
