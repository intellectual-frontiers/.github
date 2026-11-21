/**
 * Rewriting a tree (commons data 0067-sql-ast-tools FR-001 to FR-004): from the leaves up, by rules given for sorts of node. A rule for a sort is called for each node that stands in a place of that sort, with
 * its children already rewritten, and returns a node of the same sort or `undefined` to keep it, so a rule cannot put a node of another sort where one does not belong. A rewrite changes nothing it is given:
 * a node no rule changed is the same object in the result, and the whole tree is, where no rule changed anything.
 *
 * @remarks
 * The sorts are those of `ast.ts`. A `name` is an expression where it stands as one (a column), and the `expr` rule is called for it; where a field is typed as a name (the name of a table, of a function, of a
 * qualifier) the `name` rule is. The same holds for a statement (the `statement` rule is called where a script holds it) and the queries and sources inside it. The ranges of the nodes above a replaced one stay
 * those of the text they were read from.
 *
 * @limits
 * A rewritten tree has no text: nothing writes SQL from a tree yet.
 *
 * @example
 * ```ts
 * // lower-case every identifier
 * const lower = rewriteScript(parse("SELECT A FROM T").script, { ident: (i) => (i.name === i.name.toLowerCase() ? undefined : { ...i, name: i.name.toLowerCase() }) });
 * ```
 *
 * Spec: 0067-sql-ast-tools FR-001, FR-002, FR-003, FR-004
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import type {
  Alias,
  AlterAction,
  Argument,
  Assignment,
  Call,
  Check,
  ColumnConstraint,
  ColumnDef,
  Cte,
  DataType,
  Default,
  Expr,
  ForeignKey,
  Frame,
  FrameBound,
  Ident,
  Name,
  NotNull,
  OrderItem,
  PrimaryKey,
  Query,
  Reference,
  Script,
  SelectItem,
  Source,
  Statement,
  TableConstraint,
  TableRef,
  Tuple,
  Unique,
  When,
  WindowSpec,
} from "./ast.ts";

/** What a rewrite calls: a rule for each sort, each given a node and returning a node of the same sort, or `undefined` to keep it. */
export interface Rules {
  /** Called for every identifier. */
  readonly ident?: (n: Ident) => Ident | undefined;
  /** Called for a name where a field is typed as a name: a table's, a function's, a qualifier. */
  readonly name?: (n: Name) => Name | undefined;
  /** Called for every expression, a column (`name`) included. */
  readonly expr?: (n: Expr) => Expr | undefined;
  /** Called for every query that is not a statement of the script: a subquery, a common table expression, a view's. */
  readonly query?: (n: Query) => Query | undefined;
  /** Called for every source in a `FROM` and in a join. */
  readonly source?: (n: Source) => Source | undefined;
  /** Called for every statement of a script. */
  readonly statement?: (n: Statement) => Statement | undefined;
}

/** The list itself where `f` changed none of its items, else a new list. */
function mapList<T>(xs: readonly T[], f: (x: T) => T): readonly T[] {
  let out: T[] | undefined;
  for (const [i, x] of xs.entries()) {
    const y = f(x);
    if (out === undefined && y !== x) out = xs.slice(0, i);
    if (out !== undefined) out.push(y);
  }
  return out ?? xs;
}

const opt = <T>(x: T | undefined, f: (x: T) => T): T | undefined => (x === undefined ? undefined : f(x));

class Rewriter {
  private readonly rules: Rules;
  constructor(rules: Rules) {
    this.rules = rules;
  }

  // ---- names

  ident(n: Ident): Ident {
    return this.rules.ident?.(n) ?? n;
  }
  private parts(n: Name): Name {
    const parts = mapList(n.parts, (p) => this.ident(p));
    return parts === n.parts ? n : { ...n, parts };
  }
  name(n: Name): Name {
    const rebuilt = this.parts(n);
    return this.rules.name?.(rebuilt) ?? rebuilt;
  }

  // ---- expressions

  expr(e: Expr): Expr {
    const rebuilt = this.exprChildren(e);
    return this.rules.expr?.(rebuilt) ?? rebuilt;
  }

  private exprChildren(e: Expr): Expr {
    switch (e.kind) {
      case "name":
        return this.parts(e);
      case "star": {
        const qualifier = opt(e.qualifier, (q) => this.name(q));
        return qualifier === e.qualifier ? e : { ...e, qualifier };
      }
      case "number":
      case "string":
      case "boolean":
      case "null":
      case "param":
        return e;
      case "unary": {
        const arg = this.expr(e.arg);
        return arg === e.arg ? e : { ...e, arg };
      }
      case "binary": {
        const left = this.expr(e.left);
        const right = this.expr(e.right);
        return left === e.left && right === e.right ? e : { ...e, left, right };
      }
      case "operator": {
        const left = this.expr(e.left);
        const right = this.expr(e.right);
        return left === e.left && right === e.right ? e : { ...e, left, right };
      }
      case "is": {
        const arg = this.expr(e.arg);
        const other = opt(e.other, (x) => this.expr(x));
        return arg === e.arg && other === e.other ? e : { ...e, arg, other };
      }
      case "between": {
        const arg = this.expr(e.arg);
        const low = this.expr(e.low);
        const high = this.expr(e.high);
        return arg === e.arg && low === e.low && high === e.high ? e : { ...e, arg, low, high };
      }
      case "in": {
        const arg = this.expr(e.arg);
        const values = mapList(e.values, (v) => this.expr(v));
        return arg === e.arg && values === e.values ? e : { ...e, arg, values };
      }
      case "in-query": {
        const arg = this.expr(e.arg);
        const query = this.query(e.query);
        return arg === e.arg && query === e.query ? e : { ...e, arg, query };
      }
      case "like": {
        const arg = this.expr(e.arg);
        const pattern = this.expr(e.pattern);
        const escape = opt(e.escape, (x) => this.expr(x));
        return arg === e.arg && pattern === e.pattern && escape === e.escape ? e : { ...e, arg, pattern, escape };
      }
      case "case": {
        const operand = opt(e.operand, (x) => this.expr(x));
        const whens = mapList(e.whens, (w) => this.when(w));
        const otherwise = opt(e.otherwise, (x) => this.expr(x));
        return operand === e.operand && whens === e.whens && otherwise === e.otherwise ? e : { ...e, operand, whens, otherwise };
      }
      case "cast": {
        const arg = this.expr(e.arg);
        const type = this.dataType(e.type);
        return arg === e.arg && type === e.type ? e : { ...e, arg, type };
      }
      case "extract": {
        const arg = this.expr(e.arg);
        return arg === e.arg ? e : { ...e, arg };
      }
      case "interval": {
        const value = this.expr(e.value);
        return value === e.value ? e : { ...e, value };
      }
      case "call":
        return this.call(e);
      case "exists": {
        const query = this.query(e.query);
        return query === e.query ? e : { ...e, query };
      }
      case "scalar-query": {
        const query = this.query(e.query);
        return query === e.query ? e : { ...e, query };
      }
      case "tuple":
        return this.tuple(e);
      default:
        return absurd(e);
    }
  }

  private tuple(t: Tuple): Tuple {
    const items = mapList(t.items, (x) => this.expr(x));
    return items === t.items ? t : { ...t, items };
  }

  private when(w: When): When {
    const cond = this.expr(w.cond);
    const result = this.expr(w.result);
    return cond === w.cond && result === w.result ? w : { ...w, cond, result };
  }

  private arg(a: Argument): Argument {
    if (a.kind !== "named-arg") return this.expr(a);
    const name = this.ident(a.name);
    const value = this.expr(a.value);
    return name === a.name && value === a.value ? a : { ...a, name, value };
  }

  private call(c: Call): Call {
    const name = this.name(c.name);
    const args = mapList(c.args, (a) => this.arg(a));
    const filter = opt(c.filter, (x) => this.expr(x));
    const over = opt(c.over, (w) => this.windowSpec(w));
    return name === c.name && args === c.args && filter === c.filter && over === c.over ? c : { ...c, name, args, filter, over };
  }

  private windowSpec(w: WindowSpec): WindowSpec {
    const base = opt(w.base, (x) => this.ident(x));
    const partitionBy = mapList(w.partitionBy, (x) => this.expr(x));
    const orderBy = mapList(w.orderBy, (x) => this.orderItem(x));
    const frame = opt(w.frame, (x) => this.frame(x));
    return base === w.base && partitionBy === w.partitionBy && orderBy === w.orderBy && frame === w.frame
      ? w
      : { ...w, base, partitionBy, orderBy, frame };
  }

  private frame(f: Frame): Frame {
    const from = this.frameBound(f.from);
    const to = opt(f.to, (x) => this.frameBound(x));
    return from === f.from && to === f.to ? f : { ...f, from, to };
  }

  private frameBound(b: FrameBound): FrameBound {
    const offset = opt(b.offset, (x) => this.expr(x));
    return offset === b.offset ? b : { ...b, offset };
  }

  private orderItem(o: OrderItem): OrderItem {
    const expr = this.expr(o.expr);
    return expr === o.expr ? o : { ...o, expr };
  }

  private dataType(d: DataType): DataType {
    const args = mapList(d.args, (x) => this.expr(x));
    return args === d.args ? d : { ...d, args };
  }

  // ---- queries and sources

  query(q: Query): Query {
    const rebuilt = this.queryChildren(q);
    return this.rules.query?.(rebuilt) ?? rebuilt;
  }

  private selectItem(i: SelectItem): SelectItem {
    const expr = this.expr(i.expr);
    const alias = opt(i.alias, (x) => this.ident(x));
    return expr === i.expr && alias === i.alias ? i : { ...i, expr, alias };
  }

  private queryChildren(q: Query): Query {
    switch (q.kind) {
      case "select": {
        const items = mapList(q.items, (x) => this.selectItem(x));
        const from = mapList(q.from, (x) => this.source(x));
        const where = opt(q.where, (x) => this.expr(x));
        const groupBy = mapList(q.groupBy, (x) => this.expr(x));
        const having = opt(q.having, (x) => this.expr(x));
        const orderBy = mapList(q.orderBy, (x) => this.orderItem(x));
        const limit = opt(q.limit, (x) => this.expr(x));
        const offset = opt(q.offset, (x) => this.expr(x));
        return items === q.items &&
          from === q.from &&
          where === q.where &&
          groupBy === q.groupBy &&
          having === q.having &&
          orderBy === q.orderBy &&
          limit === q.limit &&
          offset === q.offset
          ? q
          : { ...q, items, from, where, groupBy, having, orderBy, limit, offset };
      }
      case "set-op": {
        const left = this.query(q.left);
        const right = this.query(q.right);
        const orderBy = mapList(q.orderBy, (x) => this.orderItem(x));
        const limit = opt(q.limit, (x) => this.expr(x));
        const offset = opt(q.offset, (x) => this.expr(x));
        return left === q.left && right === q.right && orderBy === q.orderBy && limit === q.limit && offset === q.offset
          ? q
          : { ...q, left, right, orderBy, limit, offset };
      }
      case "values": {
        const rows = mapList(q.rows, (x) => this.tuple(x));
        return rows === q.rows ? q : { ...q, rows };
      }
      case "with": {
        const ctes = mapList(q.ctes, (x) => this.cte(x));
        const body = this.query(q.body);
        return ctes === q.ctes && body === q.body ? q : { ...q, ctes, body };
      }
      default:
        return absurd(q);
    }
  }

  private cte(c: Cte): Cte {
    const name = this.ident(c.name);
    const columns = mapList(c.columns, (x) => this.ident(x));
    const query = this.query(c.query);
    return name === c.name && columns === c.columns && query === c.query ? c : { ...c, name, columns, query };
  }

  private alias(a: Alias): Alias {
    const name = this.ident(a.name);
    const columns = mapList(a.columns, (x) => this.ident(x));
    return name === a.name && columns === a.columns ? a : { ...a, name, columns };
  }

  source(s: Source): Source {
    const rebuilt = this.sourceChildren(s);
    return this.rules.source?.(rebuilt) ?? rebuilt;
  }

  private sourceChildren(s: Source): Source {
    switch (s.kind) {
      case "table":
        return this.tableRef(s);
      case "subquery": {
        const query = this.query(s.query);
        const alias = opt(s.alias, (x) => this.alias(x));
        return query === s.query && alias === s.alias ? s : { ...s, query, alias };
      }
      case "table-fn": {
        const call = this.call(s.call);
        const alias = opt(s.alias, (x) => this.alias(x));
        return call === s.call && alias === s.alias ? s : { ...s, call, alias };
      }
      case "join": {
        const left = this.source(s.left);
        const right = this.source(s.right);
        const on = opt(s.on, (x) => this.expr(x));
        const using = mapList(s.using, (x) => this.ident(x));
        return left === s.left && right === s.right && on === s.on && using === s.using ? s : { ...s, left, right, on, using };
      }
      default:
        return absurd(s);
    }
  }

  private tableRef(t: TableRef): TableRef {
    const name = this.name(t.name);
    const alias = opt(t.alias, (x) => this.alias(x));
    return name === t.name && alias === t.alias ? t : { ...t, name, alias };
  }

  // ---- statements

  statement(s: Statement): Statement {
    const rebuilt = this.statementChildren(s);
    return this.rules.statement?.(rebuilt) ?? rebuilt;
  }

  private statementChildren(s: Statement): Statement {
    switch (s.kind) {
      case "select":
      case "set-op":
      case "values":
      case "with":
        return this.queryChildren(s);
      case "insert": {
        const table = this.name(s.table);
        const columns = mapList(s.columns, (x) => this.ident(x));
        const source = opt(s.source, (x) => this.query(x));
        const returning = mapList(s.returning, (x) => this.selectItem(x));
        return table === s.table && columns === s.columns && source === s.source && returning === s.returning
          ? s
          : { ...s, table, columns, source, returning };
      }
      case "update": {
        const table = this.tableRef(s.table);
        const assignments = mapList(s.assignments, (x) => this.assignment(x));
        const from = mapList(s.from, (x) => this.source(x));
        const where = opt(s.where, (x) => this.expr(x));
        const returning = mapList(s.returning, (x) => this.selectItem(x));
        return table === s.table && assignments === s.assignments && from === s.from && where === s.where && returning === s.returning
          ? s
          : { ...s, table, assignments, from, where, returning };
      }
      case "delete": {
        const table = this.tableRef(s.table);
        const where = opt(s.where, (x) => this.expr(x));
        const returning = mapList(s.returning, (x) => this.selectItem(x));
        return table === s.table && where === s.where && returning === s.returning ? s : { ...s, table, where, returning };
      }
      case "create-table": {
        const name = this.name(s.name);
        const elements = mapList(s.elements, (el) => (el.kind === "column-def" ? this.columnDef(el) : this.tableConstraint(el)));
        return name === s.name && elements === s.elements ? s : { ...s, name, elements };
      }
      case "create-index": {
        const name = opt(s.name, (x) => this.name(x));
        const table = this.name(s.table);
        const items = mapList(s.items, (x) => this.orderItem(x));
        const where = opt(s.where, (x) => this.expr(x));
        return name === s.name && table === s.table && items === s.items && where === s.where ? s : { ...s, name, table, items, where };
      }
      case "create-view": {
        const name = this.name(s.name);
        const columns = mapList(s.columns, (x) => this.ident(x));
        const query = this.query(s.query);
        return name === s.name && columns === s.columns && query === s.query ? s : { ...s, name, columns, query };
      }
      case "alter-table": {
        const table = this.name(s.table);
        const actions = mapList(s.actions, (x) => this.alterAction(x));
        return table === s.table && actions === s.actions ? s : { ...s, table, actions };
      }
      case "drop": {
        const names = mapList(s.names, (x) => this.name(x));
        return names === s.names ? s : { ...s, names };
      }
      case "unparsed":
        return s;
      default:
        return absurd(s);
    }
  }

  private assignment(a: Assignment): Assignment {
    const target = this.name(a.target);
    const value = this.expr(a.value);
    return target === a.target && value === a.value ? a : { ...a, target, value };
  }

  // ---- definitions

  private columnDef(c: ColumnDef): ColumnDef {
    const name = this.ident(c.name);
    const type = this.dataType(c.type);
    const constraints = mapList(c.constraints, (x) => this.columnConstraint(x));
    return name === c.name && type === c.type && constraints === c.constraints ? c : { ...c, name, type, constraints };
  }

  private constraintName(n: Ident | undefined): Ident | undefined {
    return opt(n, (x) => this.ident(x));
  }
  private notNull(c: NotNull): NotNull {
    const name = this.constraintName(c.name);
    return name === c.name ? c : { ...c, name };
  }
  private defaultValue(c: Default): Default {
    const name = this.constraintName(c.name);
    const expr = this.expr(c.expr);
    return name === c.name && expr === c.expr ? c : { ...c, name, expr };
  }
  private primaryKey(c: PrimaryKey): PrimaryKey {
    const name = this.constraintName(c.name);
    const columns = mapList(c.columns, (x) => this.ident(x));
    return name === c.name && columns === c.columns ? c : { ...c, name, columns };
  }
  private unique(c: Unique): Unique {
    const name = this.constraintName(c.name);
    const columns = mapList(c.columns, (x) => this.ident(x));
    return name === c.name && columns === c.columns ? c : { ...c, name, columns };
  }
  private check(c: Check): Check {
    const name = this.constraintName(c.name);
    const expr = this.expr(c.expr);
    return name === c.name && expr === c.expr ? c : { ...c, name, expr };
  }
  private reference(r: Reference): Reference {
    const table = this.name(r.table);
    const columns = mapList(r.columns, (x) => this.ident(x));
    return table === r.table && columns === r.columns ? r : { ...r, table, columns };
  }
  private foreignKey(c: ForeignKey): ForeignKey {
    const name = this.constraintName(c.name);
    const columns = mapList(c.columns, (x) => this.ident(x));
    const reference = this.reference(c.reference);
    return name === c.name && columns === c.columns && reference === c.reference ? c : { ...c, name, columns, reference };
  }

  private columnConstraint(c: ColumnConstraint): ColumnConstraint {
    switch (c.kind) {
      case "not-null":
        return this.notNull(c);
      case "default":
        return this.defaultValue(c);
      case "primary-key":
        return this.primaryKey(c);
      case "unique":
        return this.unique(c);
      case "check":
        return this.check(c);
      case "foreign-key":
        return this.foreignKey(c);
      default:
        return absurd(c);
    }
  }

  private tableConstraint(c: TableConstraint): TableConstraint {
    switch (c.kind) {
      case "primary-key":
        return this.primaryKey(c);
      case "unique":
        return this.unique(c);
      case "check":
        return this.check(c);
      case "foreign-key":
        return this.foreignKey(c);
      default:
        return absurd(c);
    }
  }

  private alterAction(a: AlterAction): AlterAction {
    switch (a.kind) {
      case "add-column": {
        const column = this.columnDef(a.column);
        return column === a.column ? a : { ...a, column };
      }
      case "drop-column": {
        const name = this.ident(a.name);
        return name === a.name ? a : { ...a, name };
      }
      case "add-constraint": {
        const constraint = this.tableConstraint(a.constraint);
        return constraint === a.constraint ? a : { ...a, constraint };
      }
      case "drop-constraint": {
        const name = this.ident(a.name);
        return name === a.name ? a : { ...a, name };
      }
      case "rename-table": {
        const to = this.ident(a.to);
        return to === a.to ? a : { ...a, to };
      }
      case "rename-column": {
        const from = this.ident(a.from);
        const to = this.ident(a.to);
        return from === a.from && to === a.to ? a : { ...a, from, to };
      }
      default:
        return absurd(a);
    }
  }

  script(s: Script): Script {
    const statements = mapList(s.statements, (x) => this.statement(x));
    return statements === s.statements ? s : { ...s, statements };
  }
}

/**
 * Rewrites a script.
 *
 * @param script - the tree
 * @param rules - what to call for each sort
 * @returns the script, the same object where no rule changed anything
 */
export function rewriteScript(script: Script, rules: Rules): Script {
  return new Rewriter(rules).script(script);
}

/** Rewrites a statement; its own `statement` rule is called too. */
export function rewriteStatement(statement: Statement, rules: Rules): Statement {
  return new Rewriter(rules).statement(statement);
}

/** Rewrites a query; its own `query` rule is called too. */
export function rewriteQuery(query: Query, rules: Rules): Query {
  return new Rewriter(rules).query(query);
}

/** Rewrites a source; its own `source` rule is called too. */
export function rewriteSource(source: Source, rules: Rules): Source {
  return new Rewriter(rules).source(source);
}

/** Rewrites an expression; its own `expr` rule is called too. */
export function rewriteExpr(expr: Expr, rules: Rules): Expr {
  return new Rewriter(rules).expr(expr);
}
