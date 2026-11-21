/**
 * Planning (commons lang-sql 0010-aide FR-006, FR-007): a query over one table as a plan of `scan`, `filter`, `sort`, `project` and `limit`, written as text by `explain`, and `split`, which divides a plan between a backend that can do some of it and the
 * process that does the rest, so that the residual run on what the backend gives is what the whole plan gives.
 *
 * Spec: 0010-aide FR-006, FR-007
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { children, type Expr, type Node, type OrderItem, print, ansi, type SelectItem, type Select } from "../../mod.ts";
import type { Bound } from "../catalog/mod.ts";
import { conjoin, conjuncts, simplify } from "../normalize/mod.ts";

/** A logical plan of a query over one table. */
export type Plan =
  | { readonly kind: "scan"; readonly table: string; readonly alias: string; /** the backend has done the work of the plan below it */ readonly pushed: boolean }
  | { readonly kind: "filter"; readonly input: Plan; readonly predicate: Expr }
  | { readonly kind: "sort"; readonly input: Plan; readonly order: readonly OrderItem[] }
  | { readonly kind: "project"; readonly input: Plan; readonly items: readonly SelectItem[]; readonly distinct: boolean }
  | { readonly kind: "limit"; readonly input: Plan; readonly limit: number | undefined; readonly offset: number | undefined };

/** A construct the planner does not plan. */
export interface PlanError {
  readonly start: number;
  readonly end: number;
  readonly message: string;
}

const AGGREGATES: ReadonlySet<string> = new Set(["count", "sum", "avg", "min", "max", "group_concat"]);

function hasAggregate(n: Node): boolean {
  if (n.kind === "call" && AGGREGATES.has((n.name.parts[n.name.parts.length - 1]?.name ?? "").toLowerCase())) return true;
  return children(n).some((c) => hasAggregate(c));
}

function hasWindow(n: Node): boolean {
  if (n.kind === "call" && n.over !== undefined) return true;
  return children(n).some((c) => hasWindow(c));
}

function intOf(e: Expr | undefined): number | undefined | "bad" {
  if (e === undefined) return undefined;
  return e.kind === "number" && /^\d+$/.test(e.text) ? Number(e.text) : "bad";
}

/** The plan of a query over one table; an error value for a construct it does not plan. */
export function plan(select: Select, bound: Bound): Result<Plan, readonly PlanError[]> {
  const errors: PlanError[] = [];
  const no = (n: Node, what: string): void => {
    errors.push({ start: n.start, end: n.end, message: `${what} is not planned` });
  };
  if (select.from.length !== 1) no(select, "a query that does not read exactly one table");
  const src = select.from[0];
  if (src !== undefined && src.kind === "join") no(src, "a query that does not read exactly one table");
  else if (src !== undefined && src.kind !== "table") no(src, `a ${src.kind} source`);
  if (select.groupBy.length > 0 || select.groupAll || select.having !== undefined) no(select, "grouping");
  if (select.windows.length > 0 || select.qualify !== undefined || select.distinctOn.length > 0) no(select, "a window or QUALIFY");
  for (const i of select.items) {
    if (hasAggregate(i.expr)) no(i.expr, "an aggregate");
    if (hasWindow(i.expr)) no(i.expr, "a window function");
  }
  const limit = intOf(select.limit);
  const offset = intOf(select.offset);
  if (limit === "bad" && select.limit !== undefined) no(select.limit, "a LIMIT that is not a number");
  if (offset === "bad" && select.offset !== undefined) no(select.offset, "an OFFSET that is not a number");
  if (src === undefined || src.kind !== "table" || errors.length > 0) return err(errors);
  const table = bound.tables[0]?.name ?? src.name.parts.map((p) => p.name).join(".");
  let p: Plan = { kind: "scan", table, alias: src.alias?.name.name ?? table, pushed: false };
  if (select.where !== undefined) p = { kind: "filter", input: p, predicate: simplify(select.where) };
  if (select.orderBy.length > 0) p = { kind: "sort", input: p, order: select.orderBy };
  p = { kind: "project", input: p, items: select.items, distinct: select.distinct };
  if (limit !== undefined || offset !== undefined) p = { kind: "limit", input: p, limit: typeof limit === "number" ? limit : undefined, offset: typeof offset === "number" ? offset : undefined };
  return ok(p);
}

const text = (e: Expr): string => print(e, ansi);

/** A plan as text, one operator on a line, the input of an operator below it and indented. */
export function explain(p: Plan): string {
  const lines: string[] = [];
  const go = (q: Plan, depth: number): void => {
    const pad = "  ".repeat(depth);
    switch (q.kind) {
      case "scan":
        lines.push(`${pad}scan ${q.table}${q.alias === q.table ? "" : ` AS ${q.alias}`}${q.pushed ? " (pushed down)" : ""}`);
        return;
      case "filter":
        lines.push(`${pad}filter ${text(q.predicate)}`);
        return go(q.input, depth + 1);
      case "sort":
        lines.push(`${pad}sort ${q.order.map((o) => `${text(o.expr)}${o.direction === "desc" ? " DESC" : ""}`).join(", ")}`);
        return go(q.input, depth + 1);
      case "project":
        lines.push(`${pad}project${q.distinct ? " distinct" : ""} ${q.items.map((i) => text(i.expr) + (i.alias === undefined ? "" : ` AS ${i.alias.name}`)).join(", ")}`);
        return go(q.input, depth + 1);
      case "limit":
        lines.push(`${pad}limit ${q.limit ?? "all"}${q.offset === undefined ? "" : ` offset ${q.offset}`}`);
        return go(q.input, depth + 1);
    }
  };
  go(p, 0);
  return lines.join("\n");
}

/** What a backend can do. */
export interface Capabilities {
  /** Whether the backend evaluates this expression exactly as SQL does. */
  canEval(expr: Expr): boolean;
  /** Whether it orders by expressions it can evaluate. */
  readonly sort: boolean;
  /** Whether it limits the rows it gives. */
  readonly limit: boolean;
}

/** What goes to the backend. */
export interface Pushed {
  readonly table: string;
  readonly alias: string;
  readonly predicate: Expr | undefined;
  readonly sort: readonly OrderItem[] | undefined;
  readonly limit: { readonly limit: number | undefined; readonly offset: number | undefined } | undefined;
}

/** A plan divided between a backend and the process. */
export interface Split {
  readonly pushed: Pushed;
  /** What the process runs on the rows of the pushed part. */
  readonly residual: Plan;
}

/** Divides a plan: each conjunct the backend can evaluate is pushed, the sort where the backend can, the limit where nothing stands between. */
export function split(p: Plan, caps: Capabilities): Split {
  let scan: Plan | undefined;
  let predicate: Expr | undefined;
  let order: readonly OrderItem[] = [];
  let project: Extract<Plan, { kind: "project" }> | undefined;
  let lim: Extract<Plan, { kind: "limit" }> | undefined;
  for (let q: Plan = p; ; ) {
    if (q.kind === "limit") {
      lim = q;
      q = q.input;
    } else if (q.kind === "project") {
      project = q;
      q = q.input;
    } else if (q.kind === "sort") {
      order = q.order;
      q = q.input;
    } else if (q.kind === "filter") {
      predicate = q.predicate;
      q = q.input;
    } else {
      scan = q;
      break;
    }
  }
  if (scan === undefined || scan.kind !== "scan") return { pushed: { table: "", alias: "", predicate: undefined, sort: undefined, limit: undefined }, residual: p };
  const parts = predicate === undefined ? [] : conjuncts(predicate);
  const pushedParts = parts.filter((c) => caps.canEval(c));
  const residualParts = parts.filter((c) => !caps.canEval(c));
  const pushSort = order.length > 0 && caps.sort && order.every((o) => caps.canEval(o.expr));
  const pushLimit = lim !== undefined && caps.limit && residualParts.length === 0 && (order.length === 0 || pushSort) && !(project?.distinct ?? false) && project !== undefined;
  let r: Plan = { kind: "scan", table: scan.table, alias: scan.alias, pushed: true };
  const rp = conjoin(residualParts);
  if (rp !== undefined) r = { kind: "filter", input: r, predicate: rp };
  if (order.length > 0 && !pushSort) r = { kind: "sort", input: r, order };
  if (project !== undefined) r = { kind: "project", input: r, items: project.items, distinct: project.distinct };
  if (lim !== undefined && !pushLimit) r = { kind: "limit", input: r, limit: lim.limit, offset: lim.offset };
  return {
    pushed: { table: scan.table, alias: scan.alias, predicate: conjoin(pushedParts), sort: pushSort ? order : undefined, limit: pushLimit && lim !== undefined ? { limit: lim.limit, offset: lim.offset } : undefined },
    residual: r,
  };
}
