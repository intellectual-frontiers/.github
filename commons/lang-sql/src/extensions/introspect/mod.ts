/**
 * Introspection (commons lang-sql 0008-sql-introspect): SQL over the syntax tree. `introspect` parses a text and gives an {@link Introspection} whose `query` answers a small SQL over the relations of the parse (statements, nodes, attributes,
 * ancestors, tokens, comments, names, calls, parameters, common table expressions, diagnostics and the language of the dialect), and whose `diagnostics` are the errors of the parse and the rows of the rules, which are queries too. An extension of the core: it
 * imports the core and nothing else.
 *
 * @example
 * ```ts
 * const i = introspect("DELETE FROM t; SELECT * FROM u", postgres);
 * i.query("SELECT name, access FROM table_ref");   // t write, u read
 * i.diagnostics().map((d) => d.code);              // ["delete-without-where", "select-star"]
 * ```
 *
 * Spec: 0008-sql-introspect FR-001, FR-004, FR-007
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Dialect, type FunctionSpec, parse, type Parsed } from "../../mod.ts";
import { createEngine, type Engine, type QueryError, type Rows, type ScalarFunction, type Value } from "./engine.ts";
import { parseDiagnostics, relationsOf, SCHEMA } from "./relations.ts";
import { BUILTIN_RULES, type Rule } from "./rules.ts";

export { astsql, createEngine, type Engine, type QueryError, type Rows, type ScalarFunction, type Table, type Value } from "./engine.ts";
export { BUILTIN_RULES, type Rule } from "./rules.ts";
export { SCHEMA } from "./relations.ts";

/** What introspection may be given. */
export interface IntrospectOptions {
  /** The functions of the `function` relation. */
  readonly functions?: readonly FunctionSpec[];
}

/** A diagnostic: where, how bad, and why. */
export interface Diagnostic {
  readonly severity: "error" | "warning" | "info";
  readonly code: string;
  readonly message: string;
  readonly start: number;
  readonly end: number;
  readonly rule: string;
  /** The id of the node in the `node` relation, 0 for a parse error. */
  readonly node: number;
}

/** The introspection of a parse. */
export interface Introspection {
  readonly parsed: Parsed;
  /** Answers a query over the relations. */
  query(sql: string, params?: readonly Value[]): Result<Rows, QueryError>;
  /** The relations and their columns. */
  tables(): Readonly<Record<string, readonly string[]>>;
  /** The relations built so far. */
  built(): readonly string[];
  /** The errors of the parse and the findings of the rules. */
  diagnostics(): readonly Diagnostic[];
  /** Adds a rule; an error value where its query does not run or has no `node` column. */
  addRule(rule: Rule): Result<Rule, QueryError>;
}

const SEVERITIES = new Set(["error", "warning", "info"]);

/** Reads a text in a dialect and gives its introspection. */
export function introspect(text: string, dialect: Dialect, options: IntrospectOptions = {}): Introspection {
  const parsed = parse(text, dialect);
  const rules: Rule[] = [...BUILTIN_RULES];
  const rows = (rule: Rule, pre: Result<Rows, QueryError>): readonly Diagnostic[] => {
    if (pre.kind === "err") return [];
    const flat = relations.flat();
    const byId = new Map(flat.map((f) => [f.id, f]));
    const i = pre.value.columns.indexOf("node");
    const out: Diagnostic[] = [];
    for (const r of pre.value.rows) {
      const id = r[i];
      if (typeof id !== "number") continue;
      const f = byId.get(id);
      if (f !== undefined) out.push({ severity: rule.severity, code: rule.code, message: rule.message, start: f.node.start, end: f.node.end, rule: rule.code, node: id });
    }
    return out;
  };
  let diagnosticCache: readonly Diagnostic[] | undefined;
  const compute = (): readonly Diagnostic[] => {
    const out: Diagnostic[] = [];
    for (const r of parseDiagnostics(parsed)) {
      out.push({ severity: "error", code: String(r[2]), message: String(r[3]), start: Number(r[4]), end: Number(r[5]), rule: String(r[6]), node: 0 });
    }
    for (const rule of rules) out.push(...rows(rule, engine.run(rule.sql)));
    return out.sort((a, b) => a.start - b.start);
  };
  const diagnosticRows = (): readonly (readonly Value[])[] => {
    diagnosticCache ??= compute();
    return diagnosticCache.map((d, i) => [i + 1, d.severity, d.code, d.message, d.start, d.end, d.rule, d.node === 0 ? null : d.node]);
  };
  const relations = relationsOf(parsed, dialect, options.functions ?? [], diagnosticRows);
  const fns = new Map<string, ScalarFunction>([
    ["text_of", (a) => {
      const id = a[0];
      const f = typeof id === "number" ? relations.flat().find((x) => x.id === id) : undefined;
      return f === undefined ? null : text.slice(f.node.start, f.node.end);
    }],
    ["line_of", (a) => {
      const off = a[0];
      if (typeof off !== "number") return null;
      let line = 1;
      for (let i = 0; i < Math.min(off, text.length); i++) if (text.charCodeAt(i) === 10) line++;
      return line;
    }],
  ]);
  const engine: Engine = createEngine((name) => relations.get(name), fns);
  return {
    parsed,
    query: (sql, params) => engine.run(sql, params),
    tables: () => SCHEMA,
    built: () => relations.built(),
    diagnostics() {
      diagnosticCache ??= compute();
      return diagnosticCache;
    },
    addRule(rule) {
      if (rule.code.trim() === "" || !SEVERITIES.has(rule.severity)) return err({ message: "a rule has a code and a severity" });
      const r = engine.run(rule.sql);
      if (r.kind === "err") return err({ message: `the query of rule ${rule.code} does not run: ${r.error.message}` });
      if (!r.value.columns.includes("node")) return err({ message: `the query of rule ${rule.code} gives no column named node` });
      rules.push(rule);
      diagnosticCache = undefined;
      return ok(rule);
    },
  };
}
