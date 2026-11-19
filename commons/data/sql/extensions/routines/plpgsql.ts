// Spec: 0050-sql-plpgsql FR-001, FR-002, FR-003
/**
 * Typed PL/pgSQL (commons data 0050-sql-plpgsql): the body of a routine written as variables and statements (assign, run, if, while, for each row, raise, return, return a query, try with handlers) and
 * not as text. A variable has a type and a value of that type; a reference to a table, a column, a parameter or a variable is a value, written by the case style; and the block is checked before it
 * is made: a variable that was not declared, a function that can come to its end without returning, a value returned from a procedure, a loop that names a table the schema lacks, are errors as values.
 * The result is the `body` of a routine definition (`language: "plpgsql"`), so everything the routines extension checks is checked too.
 *
 * @limits
 * The SQL inside an expression is the author's, as it is in a text body: `expr` puts typed references in it and does not read it.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import type { LogicalType } from "@intellectual-frontiers/data/sql/logical";
import { standardLiteral } from "@intellectual-frontiers/data/sql/physical";
import type { Ref } from "./routine.ts";

/** A piece of a body: text, or a reference the case style writes. */
export type Part = string | Ref;

/** An expression of a type `T`: parts of a body. The type is the compiler's; it is not in the value. */
export interface Expr<T = unknown> {
  readonly parts: readonly Part[];
  readonly __t?: T;
}

/** A variable of a block. */
export interface Var<T = unknown> extends Expr<T> {
  readonly variable: string;
  readonly type: LogicalType;
}

/** The TypeScript type of the values of a logical type. */
export type Of<L extends LogicalType> = L extends { readonly kind: "text" | "date" | "instant" | "decimal" | "identifier" | "uuid" }
  ? string
  : L extends { readonly kind: "integer" }
    ? number
    : L extends { readonly kind: "boolean" }
      ? boolean
      : unknown;

type Hole = Expr | Ref | string | number | boolean | null;

const isExpr = (x: unknown): x is Expr => typeof x === "object" && x !== null && "parts" in x;

/**
 * An expression from text and values: a variable, a reference, another expression or a literal (written as SQL writes it).
 *
 * @example
 * ```ts
 * expr`${column("invoice", "total")} > ${val(100)}`;
 * ```
 */
export function expr<T = unknown>(strings: TemplateStringsArray, ...holes: readonly Hole[]): Expr<T> {
  const parts: Part[] = [];
  strings.forEach((s, i) => {
    parts.push(s);
    const h = holes[i];
    if (i >= holes.length) return;
    if (h === null) parts.push("NULL");
    else if (typeof h === "string") parts.push(standardLiteral(h));
    else if (typeof h === "number" || typeof h === "boolean") parts.push(standardLiteral(h));
    else if (isExpr(h)) parts.push(...h.parts);
    else parts.push(h as Ref);
  });
  return { parts };
}

/** A literal of a type: a number, a boolean, text or null, written as SQL writes it. */
export const val = <T extends string | number | boolean | null>(v: T): Expr<T> => ({ parts: [v === null ? "NULL" : standardLiteral(v)] });
/** A reference as an expression. */
export const ref = <T = unknown>(r: Ref): Expr<T> => ({ parts: [r] });
/** A parameter of the routine. */
export const param = <T = unknown>(name: string): Expr<T> => ref<T>({ ref: "param", param: name });
/** A column of a table, qualified. */
export const column = <T = unknown>(table: string, name: string): Expr<T> => ref<T>({ ref: "column", table, column: name });
/** A table. */
export const table = (name: string): Expr => ref({ ref: "table", table: name });

/** A variable that a block declares. */
export interface Declared<L extends LogicalType = LogicalType> {
  readonly name: string;
  readonly type: L;
  readonly initial?: Expr<Of<L>>;
}

/** A variable, to be declared in a block and used in its statements. */
export const variable = <L extends LogicalType>(name: string, type: L, initial?: Expr<Of<L>>): Var<Of<L>> & { readonly declared: Declared<L> } => ({
  parts: [{ ref: "var", name }],
  variable: name,
  type,
  declared: { name, type, ...(initial === undefined ? {} : { initial }) },
});

/** A statement of a block. */
export type Stmt =
  | { readonly kind: "assign"; readonly target: string; readonly value: Expr }
  | { readonly kind: "run"; readonly statement: Expr }
  | { readonly kind: "if"; readonly condition: Expr; readonly then: readonly Stmt[]; readonly otherwise: readonly Stmt[] }
  | { readonly kind: "while"; readonly condition: Expr; readonly body: readonly Stmt[] }
  | { readonly kind: "for"; readonly record: string; readonly query: Expr; readonly body: readonly Stmt[] }
  | { readonly kind: "raise"; readonly level: "exception" | "notice"; readonly message: string; readonly args: readonly Expr[]; readonly code?: string }
  | { readonly kind: "return"; readonly value?: Expr }
  | { readonly kind: "return-query"; readonly query: Expr }
  | { readonly kind: "attempt"; readonly body: readonly Stmt[]; readonly handlers: readonly { readonly when: string; readonly then: readonly Stmt[] }[] };

/** Assigns a variable a value of its type. */
export const set = <T>(target: Var<T>, value: Expr<NoInfer<T>>): Stmt => ({ kind: "assign", target: target.variable, value });
/** Runs a statement for its effect. */
export const run = (statement: Expr): Stmt => ({ kind: "run", statement });
/** Does one thing where a condition holds and, where given, another where it does not. */
export const when = (condition: Expr<boolean>, then: readonly Stmt[], otherwise: readonly Stmt[] = []): Stmt => ({ kind: "if", condition, then, otherwise });
/** Repeats statements while a condition holds. */
export const loop = (condition: Expr<boolean>, body: readonly Stmt[]): Stmt => ({ kind: "while", condition, body });
/** Runs statements for each row of a query; the row's columns of a table are `row(table, column)`. */
export const forEach = (record: string, query: Expr, body: (row: (table: string, column: string) => Expr) => readonly Stmt[]): Stmt => ({
  kind: "for",
  record,
  query,
  body: body((t, c) => ref({ ref: "field", record, table: t, column: c })),
});
/** Stops with an error; `%` in the message is replaced by the arguments, in order; `code` is the SQLSTATE (`P0001` where none is given). */
export const raise = (message: string, ...args: readonly Expr[]): Stmt => ({ kind: "raise", level: "exception", message, args });
/** Stops with an error and a SQLSTATE a handler can name. */
export const raiseCode = (code: string, message: string, ...args: readonly Expr[]): Stmt => ({ kind: "raise", level: "exception", message, args, code });
/** Says something to whoever runs the routine and goes on. */
export const notice = (message: string, ...args: readonly Expr[]): Stmt => ({ kind: "raise", level: "notice", message, args });
/** Returns the value of the function. */
export const ret = (value: Expr): Stmt => ({ kind: "return", value });
/** Returns the rows of a query as the rows of the function. */
export const retQuery = (query: Expr): Stmt => ({ kind: "return-query", query });
/** Returns from a procedure or a function that returns nothing. */
export const done = (): Stmt => ({ kind: "return" });
/** Runs statements and, where one fails with a named condition (`unique_violation`), runs others instead. */
export const attempt = (body: readonly Stmt[], ...handlers: readonly { readonly when: string; readonly then: readonly Stmt[] }[]): Stmt => ({ kind: "attempt", body, handlers });
/** Whether the last statement touched a row. */
export const found: Expr<boolean> = { parts: ["FOUND"] };

/** What a block is checked against. */
export type Shape = "value" | "none";

/** What is wrong with a block. */
export type BlockError =
  | { readonly kind: "undeclared"; readonly variable: string }
  | { readonly kind: "declared-twice"; readonly variable: string }
  | { readonly kind: "no-end"; readonly why: string }
  | { readonly kind: "return-value"; readonly why: string }
  | { readonly kind: "state"; readonly code: string };

const alwaysEnds = (statements: readonly Stmt[]): boolean => {
  const last = statements.at(-1);
  if (last === undefined) return false;
  switch (last.kind) {
    case "return":
    case "return-query":
      return true;
    case "raise":
      return last.level === "exception";
    case "if":
      return last.otherwise.length > 0 && alwaysEnds(last.then) && alwaysEnds(last.otherwise);
    case "attempt":
      return alwaysEnds(last.body) && last.handlers.every((h) => alwaysEnds(h.then));
    default:
      return false;
  }
};

const varsIn = (e: Expr): string[] => e.parts.flatMap((p) => (typeof p !== "string" && p.ref === "var" ? [p.name] : []));
const exprsOf = (s: Stmt): readonly Expr[] => {
  switch (s.kind) {
    case "assign":
      return [s.value];
    case "run":
      return [s.statement];
    case "if":
      return [s.condition];
    case "while":
      return [s.condition];
    case "for":
      return [s.query];
    case "raise":
      return s.args;
    case "return":
      return s.value === undefined ? [] : [s.value];
    case "return-query":
      return [s.query];
    case "attempt":
      return [];
  }
};
const children = (s: Stmt): readonly Stmt[] => (s.kind === "if" ? [...s.then, ...s.otherwise] : s.kind === "while" || s.kind === "for" ? s.body : s.kind === "attempt" ? [...s.body, ...s.handlers.flatMap((h) => h.then)] : []);
const walk = (ss: readonly Stmt[], f: (s: Stmt) => void): void => {
  for (const s of ss) {
    f(s);
    walk(children(s), f);
  }
};

const q = (s: string): string => s.replaceAll("'", "''");

function write(ss: readonly Stmt[], indent: string, out: Part[]): void {
  const line = (...parts: Part[]): void => void out.push(indent, ...parts, "\n");
  for (const s of ss) {
    switch (s.kind) {
      case "assign":
        line({ ref: "var", name: s.target }, " := ", ...s.value.parts, ";");
        break;
      case "run":
        line(...s.statement.parts, ";");
        break;
      case "if":
        line("IF ", ...s.condition.parts, " THEN");
        write(s.then, `${indent}    `, out);
        if (s.otherwise.length > 0) {
          line("ELSE");
          write(s.otherwise, `${indent}    `, out);
        }
        line("END IF;");
        break;
      case "while":
        line("WHILE ", ...s.condition.parts, " LOOP");
        write(s.body, `${indent}    `, out);
        line("END LOOP;");
        break;
      case "for":
        line("FOR ", { ref: "var", name: s.record }, " IN ", ...s.query.parts, " LOOP");
        write(s.body, `${indent}    `, out);
        line("END LOOP;");
        break;
      case "raise":
        line(`RAISE ${s.level.toUpperCase()} '${q(s.message)}'`, ...s.args.flatMap((a) => [", ", ...a.parts]), s.code === undefined ? "" : ` USING ERRCODE = '${q(s.code)}'`, ";");
        break;
      case "return":
        line(...(s.value === undefined ? ["RETURN;"] : ["RETURN ", ...s.value.parts, ";"]));
        break;
      case "return-query":
        line("RETURN QUERY ", ...s.query.parts, ";");
        break;
      case "attempt":
        line("BEGIN");
        write(s.body, `${indent}    `, out);
        line("EXCEPTION");
        for (const h of s.handlers) {
          line(`    WHEN ${h.when} THEN`);
          write(h.then, `${indent}        `, out);
        }
        line("END;");
        break;
    }
  }
}

/**
 * A block as the body of a routine.
 *
 * @param spec - the variables it declares and its statements, and whether the routine returns a value or nothing
 * @returns the body (text and references), or what is wrong with the block
 */
export function block(spec: { readonly declare?: readonly (Var & { readonly declared: Declared })[]; readonly body: readonly Stmt[]; readonly returns: Shape }): Result<readonly Part[], readonly BlockError[]> {
  const errors: BlockError[] = [];
  const declared = new Map<string, Declared>();
  for (const v of spec.declare ?? []) {
    if (declared.has(v.variable)) errors.push({ kind: "declared-twice", variable: v.variable });
    declared.set(v.variable, v.declared);
  }
  const loops = new Set<string>();
  walk(spec.body, (s) => {
    if (s.kind === "for") loops.add(s.record);
  });
  walk(spec.body, (s) => {
    for (const e of exprsOf(s)) for (const name of varsIn(e)) if (!declared.has(name) && !loops.has(name)) errors.push({ kind: "undeclared", variable: name });
    if (s.kind === "assign" && !declared.has(s.target)) errors.push({ kind: "undeclared", variable: s.target });
    if (s.kind === "return" && s.value !== undefined && spec.returns === "none") errors.push({ kind: "return-value", why: "a routine that returns nothing returns a value" });
    if (s.kind === "return" && s.value === undefined && spec.returns === "value") errors.push({ kind: "return-value", why: "a function that returns a value returns none" });
    if (s.kind === "raise" && s.code !== undefined && !/^[0-9A-Z]{5}$/.test(s.code)) errors.push({ kind: "state", code: s.code });
  });
  for (const d of declared.values()) for (const name of d.initial === undefined ? [] : varsIn(d.initial)) if (!declared.has(name)) errors.push({ kind: "undeclared", variable: name });
  if (spec.returns === "value" && !alwaysEnds(spec.body)) errors.push({ kind: "no-end", why: "a function that returns a value can come to its end without returning or raising" });
  if (errors.length > 0) return err(errors);
  const out: Part[] = [];
  if (declared.size > 0 || loops.size > 0) {
    out.push("DECLARE\n");
    for (const d of declared.values()) out.push("    ", { ref: "var", name: d.name }, " ", { ref: "type", type: d.type }, ...(d.initial === undefined ? [] : [" := ", ...d.initial.parts]), ";\n");
    // the variable of a loop over rows is a record
    for (const r of loops) out.push("    ", { ref: "var", name: r }, " RECORD;\n");
  }
  out.push("BEGIN\n");
  write(spec.body, "    ", out);
  out.push("END;");
  return ok(out);
}
