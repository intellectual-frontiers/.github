// Spec: 0002-query-language FR-003, FR-004, FR-007
/**
 * A query read (commons anyfs-query 0002-query-language FR-003, FR-004, FR-007): text to the plan of one `SELECT` of one source, through the parse, the profile, the binding of names and the types, with every
 * failure one value of the closed type of problems and the span of what was wrong. The source is a table of the language, or a table function over a place: `files('s3://bucket/prefix')`.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Alias, type Expr, type Select, type Source, type TableRef, parse } from "@intellectual-frontiers/lang-sql";
import { type Bound as Bindings, type Type, bind, check, typeOf } from "@intellectual-frontiers/lang-sql/aide/catalog";
import { conform } from "@intellectual-frontiers/lang-sql/aide/profile";
import { type Plan, plan } from "@intellectual-frontiers/lang-sql/aide/plan";
import { type Diagnostic, type QueryProblem, type TableName, columnNames, isTableName } from "@intellectual-frontiers/anyfs-query/governance";
import { CATALOG, PROFILE, anyfsDialect } from "./dialect.ts";

/** What a query reads from: a table and, where the query names one, the place. */
export type Origin = { readonly table: TableName; readonly place: string | undefined };

/** A column a query gives. */
export type OutColumn = { readonly name: string; readonly type: Type };

/** A query that is read, bound, typed and planned. */
export type Analyzed = {
  readonly text: string;
  readonly select: Select;
  readonly origin: Origin;
  readonly plan: Plan;
  readonly bindings: Bindings;
  /** The filter of the plan, as the planner simplified it. */
  readonly predicate: Expr | undefined;
  readonly columns: readonly OutColumn[];
};

const diag = (start: number, end: number, message: string): Diagnostic => ({ start, end, message });

/** The source of a query: its table and place, or the diagnostic that says what is wrong with it. */
function originOf(src: Source | undefined, select: Select): Result<{ readonly origin: Origin; readonly alias: Alias | undefined }, readonly Diagnostic[]> {
  if (src === undefined || select.from.length !== 1) return err([diag(select.start, select.end, "a query reads one source: a table of the language or a table function over a place")]);
  if (src.kind === "table") {
    const name = src.name.parts.map((p) => p.name).join(".").toLowerCase();
    return isTableName(name) ? ok({ origin: { table: name, place: undefined }, alias: src.alias }) : err([diag(src.start, src.end, `${name} is not a table of the language`)]);
  }
  if (src.kind === "table-fn") {
    const name = src.call.name.parts.map((p) => p.name).join(".").toLowerCase();
    if (!isTableName(name)) return err([diag(src.start, src.end, `${name} is not a table function of the language`)]);
    if (src.call.args.length > 1) return err([diag(src.call.start, src.call.end, `${name} takes one argument, the place`)]);
    const a = src.call.args[0];
    if (a === undefined) return ok({ origin: { table: name, place: undefined }, alias: src.alias });
    if (a.kind !== "string") return err([diag(a.start, a.end, `the place of ${name} is a text, such as 'fleet:/machines'`)]);
    return ok({ origin: { table: name, place: a.value }, alias: src.alias });
  }
  return err([diag(src.start, src.end, `a ${src.kind} is not a source of the language`)]);
}

const filterOf = (p: Plan): Expr | undefined => {
  for (let q: Plan = p; ; ) {
    if (q.kind === "filter") return q.predicate;
    if (q.kind === "scan") return undefined;
    q = q.input;
  }
};

/** Reads a query and plans it. */
export function analyze(text: string): Result<Analyzed, QueryProblem> {
  const parsed = parse(text, anyfsDialect);
  const conformed = conform(parsed, PROFILE);
  if (conformed.kind === "err") return err({ kind: parsed.errors.length > 0 ? "syntax" : "profile", diagnostics: conformed.error });
  const stmt = parsed.script.statements[0];
  if (parsed.script.statements.length !== 1 || stmt === undefined || stmt.kind !== "select") return err({ kind: "profile", diagnostics: [diag(0, text.length, "a query is one SELECT")] });
  const found = originOf(stmt.from[0], stmt);
  if (found.kind === "err") return err({ kind: "profile", diagnostics: found.error });
  const { origin, alias } = found.value;
  const template = parse(`SELECT 1 FROM ${origin.table}`, anyfsDialect).script.statements[0];
  const ref = template !== undefined && template.kind === "select" ? template.from[0] : undefined;
  if (ref === undefined || ref.kind !== "table") return err({ kind: "plan", diagnostics: [diag(0, text.length, "the table could not be made")] });
  const select: Select = { ...stmt, from: [{ ...ref, alias } satisfies TableRef] };
  const bound = bind(select, CATALOG);
  if (bound.kind === "err") return err({ kind: "names", diagnostics: bound.error });
  const typed = check(bound.value);
  if (typed.length > 0) return err({ kind: "names", diagnostics: typed });
  const planned = plan(select, bound.value);
  if (planned.kind === "err") return err({ kind: "plan", diagnostics: planned.error });
  const columns: OutColumn[] = [];
  for (const [i, it] of select.items.entries()) {
    if (it.expr.kind === "star") for (const c of columnNames(origin.table)) columns.push({ name: c, type: CATALOG.tables[origin.table]?.columns[c] ?? "unknown" });
    else columns.push({ name: it.alias?.name ?? (it.expr.kind === "name" ? (it.expr.parts[it.expr.parts.length - 1]?.name ?? `column${i + 1}`) : `column${i + 1}`), type: typeOf(it.expr, bound.value) });
  }
  return ok({ text, select, origin, plan: planned.value, bindings: bound.value, predicate: filterOf(planned.value), columns });
}
