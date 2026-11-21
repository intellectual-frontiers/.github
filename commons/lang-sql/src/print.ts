/**
 * The printer (commons lang-sql 0009-sql-print FR-001 to FR-004): any node of the tree as text of a dialect, quoting an identifier and a string as the dialect does (0007-sql-emit), parenthesizing an expression where its binding power asks for it, so
 * that the text is read back by the parser of the same dialect as the same tree but for its ranges. A construct that the dialect does not read is written as the printer's dialect has it; nothing here throws.
 *
 * @example
 * ```ts
 * print(parse("select a from t where x = 1 or y = 2 and z = 3", ansi).script.statements[0]!, ansi);
 * // 'SELECT a FROM t WHERE x = 1 OR y = 2 AND z = 3'
 * ```
 *
 * Spec: 0009-sql-print FR-001, FR-003
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import type {
  Alias,
  AlterAction,
  Argument,
  Assignment,
  ColumnConstraint,
  ColumnDef,
  DataType,
  Expr,
  Ident,
  Name,
  Node,
  OnConflict,
  OrderItem,
  Query,
  Script,
  SelectItem,
  Source,
  Statement,
  TableConstraint,
  WindowDef,
  WindowSpec,
} from "./ast.ts";
import type { Dialect } from "./dialect.ts";
import { placeholder, quoteIdent } from "./emit.ts";
import { Prec, RESERVED_WORDS } from "./grammar.ts";
import type { Parsed } from "./parser.ts";

/** What the printer may be asked. */
export interface PrintOptions {
  /** Each clause of a query on a line of its own, indented by two spaces for each level. */
  readonly pretty?: boolean;
}

const RESERVED: ReadonlySet<string> = new Set(RESERVED_WORDS);
const esc = (s: string): string => s.replace(/[\\\]^-]/g, "\\$&");

const CMP: ReadonlySet<string> = new Set(["=", "<>", "!=", "<", "<=", ">", ">="]);

class Printer {
  readonly d: Dialect;
  readonly pretty: boolean;
  level = 0;
  readonly opPrec: ReadonlyMap<string, number>;
  readonly keywords: ReadonlySet<string>;
  readonly plain: RegExp;

  constructor(d: Dialect, pretty: boolean) {
    this.d = d;
    this.pretty = pretty;
    const m = new Map<string, number>();
    for (const o of d.grammar.operators) m.set(o.text, o.prec);
    for (const o of d.grammar.wordOperators) m.set(o.text, o.prec);
    this.opPrec = m;
    this.keywords = new Set(d.lexical.keywords.map((k) => k.toUpperCase()));
    this.plain = new RegExp(`^[A-Za-z_${esc(d.lexical.wordStartChars)}][A-Za-z0-9_${esc(d.lexical.wordChars)}]*$`);
  }

  // ---- names

  ident(i: Ident, bare = false): string {
    const reserved = !bare && i.name.toUpperCase() !== "DEFAULT" && RESERVED.has(i.name.toUpperCase()) && this.keywords.has(i.name.toUpperCase());
    if (i.quoted || !this.plain.test(i.name) || reserved) {
      const q = quoteIdent(this.d, i.name);
      return q.kind === "ok" ? q.value : i.name;
    }
    return i.name;
  }

  name(n: Name, callee = false): string {
    const only = n.parts.length === 1 ? n.parts[0] : undefined;
    if (only !== undefined && !only.quoted && (only.name === "GROUPING SETS" || (only.name === "ALL" && !callee))) return only.name;
    return n.parts.map((p, k) => this.ident(p, k > 0 || (callee && k === n.parts.length - 1))).join(".");
  }

  idents(list: readonly Ident[]): string {
    return `(${list.map((i) => this.ident(i)).join(", ")})`;
  }

  // ---- literals

  string(value: string, prefix: string): string {
    const syntax = this.d.lexical.strings[0];
    const known = prefix !== "" ? this.d.lexical.prefixes.find((p) => p.prefix.toUpperCase() === prefix.toUpperCase()) : undefined;
    const use = known !== undefined ? prefix : "";
    const escape = known?.escape ?? syntax?.escape ?? "double";
    const open = syntax?.open ?? "'";
    const close = syntax?.close ?? "'";
    const body = escape === "backslash" || escape === "both" ? value.split("\\").join("\\\\").split(close).join(`\\${close}`) : value.split(close).join(close + close);
    return use + open + body + close;
  }

  // ---- expressions

  prec(e: Expr): number {
    switch (e.kind) {
      case "binary":
        return e.op === "OR" ? Prec.Or : e.op === "AND" ? Prec.And : CMP.has(e.op) ? Prec.Compare : e.op === "||" ? Prec.Other : e.op === "+" || e.op === "-" ? Prec.Additive : Prec.Multiplicative;
      case "operator":
        return e.left === undefined ? Prec.Unary : (this.opPrec.get(e.op) ?? (e.op === "AT TIME ZONE" ? Prec.Exponent : Prec.Other));
      case "unary":
        return e.op === "NOT" ? Prec.Not : Prec.Unary;
      case "is":
        return Prec.Is;
      case "between":
      case "in":
      case "in-query":
      case "like":
        return Prec.Like;
      case "cast":
      case "collate":
      case "subscript":
      case "field":
        return Prec.Cast;
      case "lambda":
        return 0;
      default:
        return 1000;
    }
  }

  expr(e: Expr, min = 0): string {
    const s = this.rawExpr(e);
    return this.prec(e) < min ? `(${s})` : s;
  }

  arg(a: Argument): string {
    switch (a.kind) {
      case "named-arg":
        return `${this.ident(a.name)} => ${this.expr(a.value)}`;
      case "keyword-arg": {
        if (a.keyword === "AS" && a.value !== undefined) return `AS ${this.expr(a.value, Prec.Like + 1)}`;
        return a.value === undefined ? a.keyword : `${a.keyword} ${this.expr(a.value, Prec.Like + 1)}`;
      }
      case "lambda":
        return this.rawExpr(a);
      default:
        return this.expr(a);
    }
  }

  args(list: readonly Argument[]): string {
    let out = "";
    for (const [i, a] of list.entries()) {
      const text = this.arg(a);
      const cont = a.kind === "keyword-arg" && !(a.keyword === "BOTH" || a.keyword === "LEADING" || a.keyword === "TRAILING" || a.keyword === "VARIADIC");
      out += i === 0 ? text : cont ? ` ${text}` : `, ${text}`;
    }
    return out;
  }

  order(list: readonly OrderItem[]): string {
    return list
      .map((o) => {
        let s = this.expr(o.expr);
        if (o.opclass !== undefined) s += ` ${o.opclass}`;
        if (o.direction !== undefined) s += o.direction === "asc" ? " ASC" : " DESC";
        if (o.using !== undefined) s += ` USING ${o.using}`;
        if (o.nulls !== undefined) s += o.nulls === "first" ? " NULLS FIRST" : " NULLS LAST";
        return s;
      })
      .join(", ");
  }

  windowSpec(w: WindowSpec): string {
    const parts: string[] = [];
    if (w.base !== undefined) parts.push(this.ident(w.base));
    if (w.partitionBy.length > 0) parts.push(`PARTITION BY ${w.partitionBy.map((x) => this.expr(x)).join(", ")}`);
    if (w.orderBy.length > 0) parts.push(`ORDER BY ${this.order(w.orderBy)}`);
    if (w.frame !== undefined) {
      const bound = (b: { readonly type: string; readonly offset: Expr | undefined }): string =>
        b.type === "unbounded-preceding" ? "UNBOUNDED PRECEDING" : b.type === "unbounded-following" ? "UNBOUNDED FOLLOWING" : b.type === "current-row" ? "CURRENT ROW" : `${b.offset === undefined ? "" : this.expr(b.offset, Prec.Additive)} ${b.type === "preceding" ? "PRECEDING" : "FOLLOWING"}`;
      let f = w.frame.unit.toUpperCase();
      f += w.frame.to === undefined ? ` ${bound(w.frame.from)}` : ` BETWEEN ${bound(w.frame.from)} AND ${bound(w.frame.to)}`;
      if (w.frame.exclude !== undefined) f += ` EXCLUDE ${w.frame.exclude}`;
      parts.push(f);
    }
    return `(${parts.join(" ")})`;
  }

  dataType(t: DataType): string {
    const m = /^(.*?)((?:\[\])*)$/.exec(t.name);
    const base = m?.[1] ?? t.name;
    const dims = m?.[2] ?? "";
    let s = base;
    if (t.args.length > 0) s += `(${t.args.map((a) => this.expr(a)).join(", ")})`;
    if (t.fields.length > 0) {
      const named = t.fields.some((f) => f.name !== undefined);
      const inner = t.fields.map((f) => (f.name === undefined ? this.dataType(f.type) : `${this.ident(f.name)} ${this.dataType(f.type)}`)).join(", ");
      s += named ? `(${inner})` : `<${inner}${inner.endsWith(">") ? " " : ""}>`;
    }
    s += dims;
    if (t.charset !== undefined) s += ` CHARACTER SET ${this.plain.test(t.charset) ? t.charset : this.ident({ kind: "ident", start: 0, end: 0, name: t.charset, quoted: true })}`;
    if (t.collation !== undefined) s += ` COLLATE ${t.collation}`;
    return s;
  }

  rawExpr(e: Expr): string {
    switch (e.kind) {
      case "name":
        return this.name(e);
      case "star":
        return `${e.qualifier === undefined ? "" : `${this.name(e.qualifier)}.`}*${e.modifiers.map((m) => ` ${m.keyword} (${m.items.map((i) => this.item(i)).join(", ")})`).join("")}`;
      case "number":
        return e.text;
      case "string":
        return this.string(e.value, e.prefix);
      case "boolean":
        return e.value ? "TRUE" : "FALSE";
      case "null":
        return "NULL";
      case "param": {
        if (this.d.lexical.params.includes(e.style)) return e.text;
        const positional = e.style === "question" || e.style === "dollar-number";
        const p = positional ? placeholder(this.d, e.style === "dollar-number" ? Number(e.text.slice(1)) : 1) : placeholder(this.d, 1, e.text.replace(/^[:@$]/, ""));
        return p.kind === "ok" ? p.value : e.text;
      }
      case "unary": {
        if (e.op === "NOT") return `NOT ${this.expr(e.arg, Prec.Not + 1)}`;
        const inner = this.expr(e.arg, Prec.Unary);
        return `${e.op}${inner.startsWith("-") || inner.startsWith("+") ? " " : ""}${inner}`;
      }
      case "binary": {
        const p = this.prec(e);
        return `${this.expr(e.left, p)} ${e.op} ${this.expr(e.right, p + 1)}`;
      }
      case "operator": {
        const p = this.prec(e);
        if (e.left === undefined) return `${e.op} ${this.expr(e.right, Prec.Unary)}`;
        return `${this.expr(e.left, p)} ${e.op} ${this.expr(e.right, p + 1)}`;
      }
      case "is": {
        const head = `${this.expr(e.arg, Prec.Is)} IS ${e.negated ? "NOT " : ""}`;
        switch (e.test) {
          case "null":
            return `${head}NULL`;
          case "true":
            return `${head}TRUE`;
          case "false":
            return `${head}FALSE`;
          case "unknown":
            return `${head}UNKNOWN`;
          case "distinct-from":
            return `${head}DISTINCT FROM ${e.other === undefined ? "NULL" : this.expr(e.other, Prec.Compare + 1)}`;
          default:
            return absurd(e.test);
        }
      }
      case "between":
        return `${this.expr(e.arg, Prec.Like + 1)} ${e.negated ? "NOT " : ""}BETWEEN ${e.symmetric ? "SYMMETRIC " : ""}${this.expr(e.low, Prec.Like + 1)} AND ${this.expr(e.high, Prec.Like + 1)}`;
      case "in":
        return `${this.expr(e.arg, Prec.Like + 1)} ${e.negated ? "NOT " : ""}IN ${e.bare ? e.values.map((v) => this.expr(v)).join(", ") : `(${e.values.map((v) => this.expr(v)).join(", ")})`}`;
      case "in-query":
        return `${this.expr(e.arg, Prec.Like + 1)} ${e.negated ? "NOT " : ""}IN (${this.nested(e.query)})`;
      case "like":
        return `${this.expr(e.arg, Prec.Like + 1)} ${e.negated ? "NOT " : ""}${e.op} ${this.expr(e.pattern, Prec.Like + 1)}${e.escape === undefined ? "" : ` ESCAPE ${this.expr(e.escape, Prec.Like + 1)}`}`;
      case "case":
        return `CASE${e.operand === undefined ? "" : ` ${this.expr(e.operand)}`}${e.whens.map((w) => ` WHEN ${this.expr(w.cond)} THEN ${this.expr(w.result)}`).join("")}${e.otherwise === undefined ? "" : ` ELSE ${this.expr(e.otherwise)}`} END`;
      case "cast":
        return `${e.try ? "TRY_CAST" : "CAST"}(${this.expr(e.arg)} AS ${this.dataType(e.type)}${e.format === undefined ? "" : ` FORMAT ${this.expr(e.format)}`})`;
      case "extract":
        return `EXTRACT(${e.field} FROM ${this.expr(e.arg)})`;
      case "interval":
        return `INTERVAL ${this.expr(e.value, Prec.Unary)}${e.unit === undefined ? "" : ` ${e.unit}`}`;
      case "array":
        return `ARRAY[${e.items.map((x) => this.expr(x)).join(", ")}]`;
      case "subscript": {
        const arg = this.expr(e.arg, Prec.Cast);
        if (!e.slice) return `${arg}[${e.index === undefined ? "" : this.expr(e.index)}]`;
        return `${arg}[${e.index === undefined ? "" : this.expr(e.index)}:${e.upper === undefined ? "" : this.expr(e.upper)}]`;
      }
      case "field":
        return `${e.arg.kind === "name" ? `(${this.expr(e.arg)})` : this.expr(e.arg, Prec.Cast)}.${e.field === undefined ? "*" : this.ident(e.field, true)}`;
      case "typed-string":
        return `${e.type} ${this.string(e.value.value, e.value.prefix)}`;
      case "struct":
        return `${e.prefix ?? ""}{${e.entries.map((x) => `${this.expr(x.key)}: ${this.expr(x.value)}`).join(", ")}}`;
      case "lambda":
        return `${e.params.length === 1 ? this.ident(e.params[0] ?? { kind: "ident", start: 0, end: 0, name: "x", quoted: false }) : this.idents(e.params)} -> ${this.expr(e.body)}`;
      case "collate":
        return `${this.expr(e.arg, Prec.Cast)} COLLATE ${this.name(e.collation)}`;
      case "call": {
        let s = `${this.name(e.name, true)}(`;
        if (e.parameters.length > 0) s += `${this.args(e.parameters)})(`;
        s += `${e.distinct ? "DISTINCT " : ""}${this.args(e.args)}${e.orderBy.length > 0 ? ` ORDER BY ${this.order(e.orderBy)}` : ""})`;
        if (e.nullTreatment !== undefined) s += ` ${e.nullTreatment === "ignore" ? "IGNORE" : "RESPECT"} NULLS`;
        if (e.withinGroup.length > 0) s += ` WITHIN GROUP (ORDER BY ${this.order(e.withinGroup)})`;
        if (e.filter !== undefined) s += ` FILTER (WHERE ${this.expr(e.filter)})`;
        if (e.over !== undefined) s += ` OVER ${e.over.base !== undefined && e.over.partitionBy.length === 0 && e.over.orderBy.length === 0 && e.over.frame === undefined ? this.ident(e.over.base) : this.windowSpec(e.over)}`;
        return s;
      }
      case "exists":
        return `EXISTS (${this.nested(e.query)})`;
      case "scalar-query":
        return `(${this.nested(e.query)})`;
      case "tuple":
        return `(${e.items.map((x) => this.expr(x)).join(", ")})`;
      default:
        return absurd(e);
    }
  }

  // ---- queries

  sep(): string {
    return this.pretty ? `\n${"  ".repeat(this.level)}` : " ";
  }

  nested(q: Query | Statement): string {
    this.level++;
    const s = this.stmt(q);
    this.level--;
    return this.pretty ? `\n${"  ".repeat(this.level + 1)}${s}\n${"  ".repeat(this.level)}` : s;
  }

  item(i: SelectItem): string {
    return `${this.expr(i.expr)}${i.alias === undefined ? "" : ` AS ${this.ident(i.alias, true)}`}`;
  }

  alias(a: Alias | undefined): string {
    if (a === undefined) return "";
    const cols = a.columns.length === 0 ? "" : `(${a.columns.map((c, k) => (a.types[k] === undefined ? this.ident(c) : `${this.ident(c)} ${this.dataType(a.types[k] as DataType)}`)).join(", ")})`;
    return ` AS ${this.ident(a.name, true)}${cols}`;
  }

  source(s: Source): string {
    switch (s.kind) {
      case "table": {
        let hint = s.hint ?? "";
        const only = /^ONLY\b/.test(hint);
        if (only) hint = hint.replace(/^ONLY\s*/, "");
        const star = /^\*/.test(hint);
        if (star) hint = hint.replace(/^\*\s*/, "");
        return `${only ? "ONLY " : ""}${this.name(s.name)}${star ? "*" : ""}${this.alias(s.alias)}${hint === "" ? "" : ` ${hint}`}`;
      }
      case "subquery":
        return `${s.lateral ? "LATERAL " : ""}(${this.nested(s.query)})${this.alias(s.alias)}`;
      case "table-fn":
        return `${s.lateral ? "LATERAL " : ""}${this.rawExpr(s.call)}${s.ordinality ? " WITH ORDINALITY" : ""}${this.alias(s.alias)}`;
      case "table-op":
        return `${this.source(s.source)} ${s.text}${this.alias(s.alias)}`;
      case "join": {
        const kind = s.type === "inner" ? "JOIN" : s.type === "cross-apply" ? "CROSS APPLY" : s.type === "outer-apply" ? "OUTER APPLY" : s.type === "semi" ? "LEFT SEMI JOIN" : s.type === "anti" ? "LEFT ANTI JOIN" : `${s.type.toUpperCase()} JOIN`;
        const right = s.right.kind === "join" ? `(${this.source(s.right)})` : this.source(s.right);
        let out = `${this.source(s.left)} ${s.natural ? "NATURAL " : ""}${kind} ${right}`;
        if (s.on !== undefined) out += ` ON ${this.expr(s.on)}`;
        if (s.using.length > 0) out += ` USING ${this.idents(s.using)}${s.usingAlias === undefined ? "" : ` AS ${this.ident(s.usingAlias)}`}`;
        return s.alias === undefined ? out : `(${out})${this.alias(s.alias)}`;
      }
      default:
        return absurd(s);
    }
  }

  setOperand(q: Query, node: { readonly op: string }, right: boolean): string {
    const lvl = (op: string): number => (op === "intersect" ? 2 : 1);
    const needs =
      q.kind === "with" ||
      (q.kind === "set-op" && (right ? lvl(q.op) <= lvl(node.op) : lvl(q.op) < lvl(node.op))) ||
      ((q.kind === "select" || q.kind === "set-op") && (q.orderBy.length > 0 || q.limit !== undefined || q.offset !== undefined || q.locking !== undefined || q.settings !== undefined));
    const s = this.queryText(q);
    return needs ? `(${s})` : s;
  }

  queryText(q: Query): string {
    const sp = this.sep();
    switch (q.kind) {
      case "select": {
        const parts: string[] = [];
        let head = q.items.length === 0 && this.d.grammar.fromFirst && q.from.length > 0 ? "" : "SELECT";
        if (q.distinct) head += " DISTINCT";
        if (q.top !== undefined) head += ` TOP ${q.top.kind === "number" ? q.top.text : `(${this.expr(q.top)})`}${q.topOptions === undefined ? "" : ` ${q.topOptions}`}`;
        if (q.distinctOn.length > 0) head += ` ON (${q.distinctOn.map((x) => this.expr(x)).join(", ")})`;
        if (q.items.length > 0) head += ` ${q.items.map((i) => this.item(i)).join(", ")}`;
        if (q.into !== undefined) head += ` ${q.into}`;
        if (head !== "") parts.push(head);
        if (q.from.length > 0) parts.push(`FROM ${q.from.map((s) => this.source(s)).join(", ")}`);
        if (q.where !== undefined) parts.push(`WHERE ${this.expr(q.where)}`);
        if (q.groupAll || q.groupBy.length > 0) parts.push(`GROUP BY ${q.groupAll ? "ALL" : ""}${q.groupAll && q.groupBy.length > 0 ? " " : ""}${q.groupBy.map((x) => this.expr(x)).join(", ")}`);
        if (q.having !== undefined) parts.push(`HAVING ${this.expr(q.having)}`);
        if (q.windows.length > 0) parts.push(`WINDOW ${q.windows.map((w: WindowDef) => `${this.ident(w.name)} AS ${this.windowSpec(w.spec)}`).join(", ")}`);
        if (q.qualify !== undefined) parts.push(`QUALIFY ${this.expr(q.qualify)}`);
        this.tail(q, parts);
        return parts.join(sp);
      }
      case "set-op": {
        const parts = [this.setOperand(q.left, q, false), `${q.op.toUpperCase()}${q.quantifier === undefined ? "" : ` ${q.quantifier.toUpperCase()}`}${q.byName ? " BY NAME" : ""}`, this.setOperand(q.right, q, true)];
        const out = [parts.join(sp)];
        this.tail(q, out);
        return out.join(sp);
      }
      case "values":
        return `VALUES ${q.rows.map((r) => `(${r.items.map((x) => this.expr(x)).join(", ")})`).join(", ")}`;
      case "with": {
        const ctes = q.ctes.map((c) => `${this.ident(c.name)}${c.columns.length > 0 ? ` ${this.idents(c.columns)}` : ""} AS ${c.materialized === "materialized" ? "MATERIALIZED " : c.materialized === "not-materialized" ? "NOT MATERIALIZED " : ""}(${this.nested(c.query)})${c.trailer === undefined ? "" : ` ${c.trailer}`}`);
        return `WITH ${q.recursive ? "RECURSIVE " : ""}${ctes.join(", ")}${sp}${this.stmt(q.body)}`;
      }
      default:
        return absurd(q);
    }
  }

  tail(q: { readonly orderBy: readonly OrderItem[]; readonly limit: Expr | undefined; readonly limitOptions: string | undefined; readonly offset: Expr | undefined; readonly locking: string | undefined; readonly settings: string | undefined }, parts: string[]): void {
    if (q.orderBy.length > 0) parts.push(`ORDER BY ${this.order(q.orderBy)}`);
    if (q.limit !== undefined && q.limitOptions !== undefined) {
      // the words a LIMIT cannot say: the offset comes before the fetch
      if (q.offset !== undefined) parts.push(`OFFSET ${this.expr(q.offset)} ROWS`);
      parts.push(`FETCH FIRST ${this.expr(q.limit)} ${q.limitOptions.includes("PERCENT") ? "PERCENT " : ""}ROWS ${q.limitOptions.includes("TIES") ? "WITH TIES" : "ONLY"}`);
    } else {
      if (q.limit !== undefined) parts.push(`LIMIT ${this.expr(q.limit)}`);
      if (q.offset !== undefined) parts.push(`OFFSET ${this.expr(q.offset)}`);
    }
    if (q.locking !== undefined) parts.push(q.locking);
    if (q.settings !== undefined) parts.push(q.settings);
  }

  // ---- statements

  assignment(a: Assignment): string {
    return `${this.expr(a.target, Prec.Cast)} = ${this.expr(a.value)}`;
  }

  onConflict(c: OnConflict): string {
    if (c.duplicateKey) return `ON DUPLICATE KEY UPDATE ${c.assignments.map((a) => this.assignment(a)).join(", ")}`;
    let s = "ON CONFLICT";
    if (c.constraint !== undefined) s += ` ON CONSTRAINT ${this.ident(c.constraint)}`;
    else if (c.targets.length > 0) s += ` (${c.targets.map((x) => this.expr(x)).join(", ")})${c.targetWhere === undefined ? "" : ` WHERE ${this.expr(c.targetWhere)}`}`;
    if (!c.update) return `${s} DO NOTHING`;
    return `${s} DO UPDATE SET ${c.assignments.map((a) => this.assignment(a)).join(", ")}${c.where === undefined ? "" : ` WHERE ${this.expr(c.where)}`}`;
  }

  returning(list: readonly SelectItem[]): string {
    return list.length === 0 ? "" : ` RETURNING ${list.map((i) => this.item(i)).join(", ")}`;
  }

  constraint(c: ColumnConstraint | TableConstraint): string {
    const n = (name: Ident | undefined): string => (name === undefined ? "" : `CONSTRAINT ${this.ident(name)} `);
    const o = (x: string | undefined): string => (x === undefined ? "" : ` ${x}`);
    switch (c.kind) {
      case "not-null":
        return `${n(c.name)}NOT NULL`;
      case "default":
        return `${n(c.name)}DEFAULT ${this.expr(c.expr, Prec.Is + 1)}`;
      case "primary-key":
        return `${n(c.name)}PRIMARY KEY${c.columns.length > 0 ? ` ${this.idents(c.columns)}` : ""}${o(c.options)}`;
      case "unique":
        return `${n(c.name)}UNIQUE${c.columns.length > 0 ? ` ${this.idents(c.columns)}` : ""}${o(c.options)}`;
      case "check":
        return `${n(c.name)}CHECK (${this.expr(c.expr)})${o(c.options)}`;
      case "foreign-key": {
        const r = c.reference;
        const acts = (a: string | undefined, w: string): string => (a === undefined ? "" : ` ON ${w} ${a.toUpperCase().replace(/-/g, " ")}`);
        return `${n(c.name)}${c.columns.length > 0 ? `FOREIGN KEY ${this.idents(c.columns)} ` : ""}REFERENCES ${this.name(r.table)}${r.columns.length > 0 ? ` ${this.idents(r.columns)}` : ""}${acts(r.onDelete, "DELETE")}${acts(r.onUpdate, "UPDATE")}${o(r.options)}${o(c.options)}`;
      }
      case "column-option":
        return `${n(c.name)}${c.text}`;
      case "table-like":
        return `LIKE ${this.name(c.table)}${o(c.options)}`;
      default:
        return absurd(c);
    }
  }

  columnDef(c: ColumnDef): string {
    return `${this.ident(c.name)} ${this.dataType(c.type)}${c.constraints.map((x) => ` ${this.constraint(x)}`).join("")}`;
  }

  action(a: AlterAction): string {
    switch (a.kind) {
      case "add-column":
        return `ADD COLUMN ${a.ifNotExists ? "IF NOT EXISTS " : ""}${this.columnDef(a.column)}`;
      case "drop-column":
        return `DROP COLUMN ${a.ifExists ? "IF EXISTS " : ""}${this.ident(a.name)}${a.behavior === undefined ? "" : ` ${a.behavior.toUpperCase()}`}`;
      case "add-constraint":
        return `ADD ${this.constraint(a.constraint)}${a.options === undefined ? "" : ` ${a.options}`}`;
      case "drop-constraint":
        return `DROP CONSTRAINT ${a.ifExists ? "IF EXISTS " : ""}${this.ident(a.name)}${a.behavior === undefined ? "" : ` ${a.behavior.toUpperCase()}`}`;
      case "rename-table":
        return `RENAME TO ${this.ident(a.to)}`;
      case "rename-column":
        return `RENAME COLUMN ${this.ident(a.from)} TO ${this.ident(a.to)}`;
      default:
        return absurd(a);
    }
  }

  stmt(s: Statement | Query): string {
    switch (s.kind) {
      case "select":
      case "set-op":
      case "values":
      case "with":
        return this.queryText(s);
      case "insert": {
        const cols = s.columns.length === 0 ? "" : ` (${s.columns.map((c) => this.expr(c, Prec.Cast)).join(", ")})`;
        const head = s.conflict === "REPLACE" ? "REPLACE" : s.conflict === "OVERWRITE" ? "INSERT OVERWRITE" : s.conflict !== undefined ? `INSERT OR ${s.conflict}` : "INSERT";
        let out = `${head}${s.conflict === "REPLACE" ? " INTO" : s.conflict === "OVERWRITE" ? " TABLE" : " INTO"} ${this.name(s.table)}${s.alias === undefined ? "" : ` AS ${this.ident(s.alias)}`}${s.partition === undefined ? "" : ` ${s.partition}`}${cols}`;
        out += s.byName ? " BY NAME" : "";
        out += s.source === undefined ? " DEFAULT VALUES" : ` ${this.queryText(s.source)}`;
        if (s.onConflict !== undefined) out += ` ${this.onConflict(s.onConflict)}`;
        return out + this.returning(s.returning);
      }
      case "update":
        return `UPDATE ${this.source(s.table)} SET ${s.assignments.map((a) => this.assignment(a)).join(", ")}${s.from.length > 0 ? ` FROM ${s.from.map((x) => this.source(x)).join(", ")}` : ""}${s.where === undefined ? "" : ` WHERE ${this.expr(s.where)}`}${this.returning(s.returning)}`;
      case "delete":
        return `DELETE FROM ${this.source(s.table)}${s.using.length > 0 ? ` USING ${s.using.map((x) => this.source(x)).join(", ")}` : ""}${s.where === undefined ? "" : ` WHERE ${this.expr(s.where)}`}${this.returning(s.returning)}`;
      case "create-table": {
        let out = `CREATE ${s.temporary ? "TEMPORARY " : ""}TABLE ${s.ifNotExists ? "IF NOT EXISTS " : ""}${this.name(s.name)}`;
        if (s.elements.length > 0 || s.query === undefined) out += ` (${s.elements.map((e) => (e.kind === "column-def" ? this.columnDef(e) : this.constraint(e))).join(", ")})`;
        if (s.options !== undefined) out += ` ${s.options}`;
        if (s.query !== undefined) out += ` AS ${this.queryText(s.query)}`;
        return out;
      }
      case "create-index":
        return `CREATE ${s.unique ? "UNIQUE " : ""}INDEX ${s.concurrently ? "CONCURRENTLY " : ""}${s.ifNotExists ? "IF NOT EXISTS " : ""}${s.name === undefined ? "" : `${this.name(s.name)} `}ON ${s.only ? "ONLY " : ""}${this.name(s.table)}${s.method === undefined ? "" : ` USING ${s.method}`} (${this.order(s.items)})${s.options === undefined ? "" : ` ${s.options}`}${s.where === undefined ? "" : ` WHERE ${this.expr(s.where)}`}`;
      case "create-view":
        return `CREATE ${s.orReplace ? "OR REPLACE " : ""}VIEW ${this.name(s.name)}${s.columns.length > 0 ? ` ${this.idents(s.columns)}` : ""}${s.options === undefined ? "" : ` ${s.options}`} AS ${this.queryText(s.query)}${s.checkOption === undefined ? "" : ` ${s.checkOption}`}`;
      case "alter-table":
        return `ALTER TABLE ${s.ifExists ? "IF EXISTS " : ""}${this.name(s.table)} ${s.actions.map((a) => this.action(a)).join(", ")}`;
      case "drop":
        return `DROP ${s.object.toUpperCase()} ${s.concurrently ? "CONCURRENTLY " : ""}${s.ifExists ? "IF EXISTS " : ""}${s.names.map((n) => this.name(n)).join(", ")}${s.behavior === undefined ? "" : ` ${s.behavior.toUpperCase()}`}`;
      case "create-routine": {
        const params = s.params.map((p) => `${p.mode === undefined ? "" : `${p.mode.toUpperCase()} `}${p.name === undefined ? "" : `${this.ident(p.name)} `}${this.dataType(p.type)}${p.default === undefined ? "" : ` DEFAULT ${this.expr(p.default)}`}`);
        let out = `CREATE ${s.orReplace ? "OR REPLACE " : ""}${s.object.toUpperCase()} ${this.name(s.name)}(${params.join(", ")})`;
        if (s.returns !== undefined) out += ` RETURNS ${s.setof ? "SETOF " : ""}${this.dataType(s.returns)}`;
        else if (s.table.length > 0) out += ` RETURNS TABLE (${s.table.map((c) => this.columnDef(c)).join(", ")})`;
        if (s.language !== undefined) out += ` LANGUAGE ${s.language}`;
        if (s.options !== undefined) out += ` ${s.options}`;
        if (s.body !== undefined) out += ` AS ${s.body.text}`;
        return out;
      }
      case "command":
        return s.text === "" ? s.keyword : `${s.keyword} ${s.text}`;
      case "unparsed":
        return "";
      default:
        return absurd(s);
    }
  }
}

/** A node as text of a dialect. */
export function print(node: Node, dialect: Dialect, options: PrintOptions = {}): string {
  const p = new Printer(dialect, options.pretty === true);
  switch (node.kind) {
    case "script":
      return node.statements.map((s) => p.stmt(s)).join(";\n");
    case "ident":
      return p.ident(node);
    case "name":
      return p.name(node);
    case "order-item":
      return p.order([node]);
    case "select-item":
      return p.item(node);
    case "window-spec":
      return p.windowSpec(node);
    case "alias":
      return p.alias(node).replace(/^ AS /, "");
    case "data-type":
      return p.dataType(node);
    case "column-def":
      return p.columnDef(node);
    case "when":
      return `WHEN ${p.expr(node.cond)} THEN ${p.expr(node.result)}`;
    default:
      break;
  }
  if (isStatement(node)) return p.stmt(node);
  if (isSource(node)) return p.source(node);
  if (isExpr(node)) return p.expr(node);
  return `/* ${node.kind} */`;
}

const STATEMENTS: ReadonlySet<string> = new Set(["select", "set-op", "values", "with", "insert", "update", "delete", "create-table", "create-index", "create-view", "alter-table", "drop", "create-routine", "command", "unparsed"]);
const SOURCES: ReadonlySet<string> = new Set(["table", "subquery", "table-fn", "join", "table-op"]);
const NOT_EXPR: ReadonlySet<string> = new Set([...STATEMENTS, ...SOURCES, "script", "ident", "alias", "order-item", "select-item", "window-spec", "window-def", "frame", "frame-bound", "when", "data-type", "type-field", "column-def", "not-null", "default", "primary-key", "unique", "check", "reference", "foreign-key", "column-option", "table-like", "add-column", "drop-column", "add-constraint", "drop-constraint", "rename-table", "rename-column", "cte", "assignment", "on-conflict", "star-modifier", "struct-entry", "named-arg", "keyword-arg", "routine-param", "routine-body"]);
const isStatement = (n: Node): n is Statement => STATEMENTS.has(n.kind);
const isSource = (n: Node): n is Source => SOURCES.has(n.kind);
const isExpr = (n: Node): n is Expr => !NOT_EXPR.has(n.kind) && !n.kind.startsWith("pl-");

/** A script as text of a dialect: its statements ended by `;`, a statement that could not be read by its source text. */
export function printScript(parsed: Parsed, dialect: Dialect, options: PrintOptions = {}): string {
  const p = new Printer(dialect, options.pretty === true);
  const s: Script = parsed.script;
  return s.statements.map((st) => `${st.kind === "unparsed" ? parsed.text.slice(st.start, st.end) : p.stmt(st)};`).join("\n");
}
