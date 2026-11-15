/**
 * Stored routines defined in TypeScript (commons 0009-sql-aide FR-020, FR-021). A routine has a signature built from columns and
 * relations and a body that is one of three things: a typed query, whose rows or value must be what the routine returns, or the
 * definition does not compile; a typed block of statements, which renders as PL/pgSQL; or a template in any language, with typed
 * references to the arguments.
 *
 * The body is a function of the routine's arguments. That is what lets one definition serve three dialects: for PostgreSQL the arguments
 * are the function's own, for a DuckDB macro they are the macro's, and for SQLite, which stores no functions, the body is written in
 * where the routine is called, with what it was called with.
 *
 * @module
 */
import { absurd } from "../../../kernel/mod.ts";
import type { AnyColumn, ColumnSpec } from "../algebra/column.ts";
import type { DomainSpec, SqlValue } from "../algebra/domain.ts";
import type { ColumnMap, SelectRow } from "../algebra/table.ts";
import type { EmitContext } from "../emit/context.ts";
import type { Expr, Operand } from "../emit/expr.ts";
import { type AnySql, bind, type Chunk, chunkOf, chunkText, renderUnchecked, sql, type Sql, type SqlKind } from "../emit/sql.ts";
import type { EntityName } from "../model/entity.ts";

/** The arguments of a routine, by name, each written as a column is. */
export type ArgMap = { readonly [name: string]: AnyColumn };

/** The type of the value of an argument, with null where it may be null. */
export type ArgValue<C> = C extends { readonly __t?: infer T; readonly __null?: infer Null }
  ? NonNullable<T> | (Null extends true ? null : never)
  : never;

/** The arguments of a routine as expressions, by name: what its body is written over. */
export type ArgRefs<A> = { readonly [K in keyof A & string]: Expr<ArgValue<A[K]>> };

/** What a routine is called with: for each argument, an expression or a value of its type. */
export type CallArgs<A> = { readonly [K in keyof A & string]: Operand<ArgValue<A[K]>> };

/** What a routine returns. `T` is the type of the value or of the row, and `S` whether it is nothing, one value or rows. */
export type Returns<T, S extends "void" | "scalar" | "set"> = { readonly __t?: T; readonly shape: S } & (
  | { readonly returns: "void" }
  | { readonly returns: "scalar"; readonly domain: DomainSpec }
  | { readonly returns: "setof"; readonly relation: EntityName }
  | { readonly returns: "table"; readonly columns: readonly (readonly [name: string, spec: ColumnSpec])[] }
);

/** The routine returns nothing. */
export const nothing: Returns<void, "void"> = { returns: "void", shape: "void" };

/**
 * The routine returns one value, of a column's type.
 *
 * @param of - a column whose type and nullability the value has
 */
export const scalar = <C extends AnyColumn>(of: C): Returns<ArgValue<C>, "scalar"> => ({
  returns: "scalar",
  shape: "scalar",
  domain: of.spec.domain,
});

/**
 * The routine returns rows of a table or a view.
 *
 * @param relation - the table or view
 */
export const setOf = <Row>(relation: Sql<"relation", Row, string, never> & EntityName): Returns<Row, "set"> => ({
  returns: "setof",
  shape: "set",
  relation: { name: relation.name, schema: relation.schema },
});

/**
 * The routine returns rows of its own shape.
 *
 * @param columns - the columns of a row, written as a table's are
 */
export const rowsOf = <const C extends ColumnMap>(columns: C): Returns<SelectRow<never, C>, "set"> => ({
  returns: "table",
  shape: "set",
  columns: Object.entries(columns).flatMap(([n, c]) => ("spec" in c ? [[n, c.spec] as const] : [])),
});

/** A variable of a block: an expression of its type that a statement may assign. */
export interface Variable<T> extends Expr<T> {
  /** The variable's name. */
  readonly variable: string;
}

/** A statement of a block. */
export type Stmt =
  | { readonly kind: "assign"; readonly target: string; readonly value: AnySql }
  | { readonly kind: "run"; readonly statement: AnySql }
  | { readonly kind: "if"; readonly condition: AnySql; readonly then: readonly Stmt[]; readonly otherwise: readonly Stmt[] }
  | { readonly kind: "while"; readonly condition: AnySql; readonly body: readonly Stmt[] }
  | { readonly kind: "for"; readonly row: string; readonly query: AnySql; readonly body: readonly Stmt[] }
  | { readonly kind: "raise"; readonly level: "exception" | "notice"; readonly message: string; readonly args: readonly AnySql[] }
  | { readonly kind: "return"; readonly value?: AnySql }
  | { readonly kind: "return-query"; readonly query: AnySql }
  | {
      readonly kind: "attempt";
      readonly body: readonly Stmt[];
      readonly handlers: readonly { readonly when: string; readonly then: readonly Stmt[] }[];
    };

/** A block body: variables and statements, written as PL/pgSQL. */
export interface Block {
  /** Says that this body is a block. */
  readonly body: "block";
  /** The variables declared, each with its type and what it starts as. */
  readonly declares: readonly { readonly name: string; readonly domain: DomainSpec; readonly initial?: AnySql }[];
  /** The statements, in order. */
  readonly statements: readonly Stmt[];
}

/** A template body: text in a language the database runs, with typed references in it. */
export interface Template {
  /** Says that this body is a template. */
  readonly body: "template";
  /** The language (`plpgsql`, `sql`, `plpython3u`). */
  readonly language: string;
  /** The text of the body. */
  readonly text: AnySql;
}

/** The builder of a block's statements. `Ret` is what the routine returns, which `ret` and `retQuery` are held to. */
export interface Pl<Ret> {
  /** Declares a variable of a column's type, and what it starts as. */
  readonly declare: <C extends AnyColumn>(name: string, of: C, initial?: Operand<ArgValue<C>>) => Variable<ArgValue<C>>;
  /** Assigns a variable a value of its type. */
  readonly set: <T>(target: Variable<T>, value: Operand<NoInfer<T>>) => Stmt;
  /** Runs a statement for its effect. */
  readonly run: (statement: AnySql) => Stmt;
  /** Does one thing where a condition holds and, where given, another where it does not. */
  readonly when: (condition: Expr<boolean, string, never>, then: readonly Stmt[], otherwise?: readonly Stmt[]) => Stmt;
  /** Repeats statements while a condition holds. */
  readonly loop: (condition: Expr<boolean, string, never>, body: readonly Stmt[]) => Stmt;
  /** Runs statements for each row of a query, the row's columns given as expressions. */
  readonly forEach: <Row>(
    query: Sql<SqlKind, Row, string, never>,
    body: (row: { readonly [K in keyof Row & string]: Expr<Row[K]> }) => readonly Stmt[],
  ) => Stmt;
  /** Stops with an error: `%` in the message is replaced by the arguments, in order. */
  readonly raise: (message: string, ...args: readonly AnySql[]) => Stmt;
  /** Says something to whoever runs the routine and goes on. */
  readonly notice: (message: string, ...args: readonly AnySql[]) => Stmt;
  /** Returns the routine's value. */
  readonly ret: (value: Operand<Ret>) => Stmt;
  /** Returns the rows of a query as the routine's rows. */
  readonly retQuery: (query: Sql<SqlKind, Ret, string, never>) => Stmt;
  /** Returns from a routine that returns nothing. */
  readonly done: () => Stmt;
  /** Runs statements and, where one fails with a named condition (`unique_violation`), runs others instead. */
  readonly attempt: (body: readonly Stmt[], ...handlers: readonly { readonly when: string; readonly then: readonly Stmt[] }[]) => Stmt;
  /** Whether the last statement touched a row. */
  readonly found: Expr<boolean>;
  /** Whether the last statement touched no row. */
  readonly notFound: Expr<boolean>;
  /** A block body of these statements. */
  readonly block: (...statements: readonly Stmt[]) => Block;
  /** A template body in a language. */
  readonly template: (language: string, text: AnySql) => Template;
}

function isSql(x: unknown): x is AnySql {
  return typeof x === "object" && x !== null && "sqlKind" in x;
}
const operand = (x: unknown, spec?: DomainSpec): AnySql => (isSql(x) ? x : bind(x as SqlValue, spec));
const quote = (n: string): string => `"${n.replaceAll('"', '""')}"`;

function makePl<Ret>(): { readonly pl: Pl<Ret>; readonly declares: () => Block["declares"] } {
  const declares: { name: string; domain: DomainSpec; initial?: AnySql }[] = [];
  let rows = 0;
  const pl: Pl<Ret> = {
    declare: (name, of, initial) => {
      declares.push(
        initial === undefined
          ? { name, domain: of.spec.domain }
          : { name, domain: of.spec.domain, initial: operand(initial, of.spec.domain) },
      );
      return { sqlKind: "expression", chunks: () => [chunkText(quote(name))], variable: name };
    },
    set: (target, value) => ({ kind: "assign", target: target.variable, value: operand(value) }),
    run: (statement) => ({ kind: "run", statement }),
    when: (condition, then, otherwise = []) => ({ kind: "if", condition, then, otherwise }),
    loop: (condition, body) => ({ kind: "while", condition, body }),
    forEach: <Row>(
      query: Sql<SqlKind, Row, string, never>,
      body: (row: { readonly [K in keyof Row & string]: Expr<Row[K]> }) => readonly Stmt[],
    ): Stmt => {
      const row = `r${++rows}`;
      // the row's columns are known only to the compiler, so each is made when it is asked for
      const fields = new Proxy({}, { get: (_, key) => sql("expression", () => [chunkText(`${quote(row)}.${quote(String(key))}`)]) }) as {
        readonly [K in keyof Row & string]: Expr<Row[K]>;
      };
      return { kind: "for", row, query, body: body(fields) };
    },
    raise: (message, ...args) => ({ kind: "raise", level: "exception", message, args }),
    notice: (message, ...args) => ({ kind: "raise", level: "notice", message, args }),
    ret: (value) => ({ kind: "return", value: operand(value) }),
    retQuery: (query) => ({ kind: "return-query", query }),
    done: () => ({ kind: "return" }),
    attempt: (body, ...handlers) => ({ kind: "attempt", body, handlers }),
    found: sql("expression", () => [chunkText("FOUND")]),
    notFound: sql("expression", () => [chunkText("NOT FOUND")]),
    block: (...statements) => ({ body: "block", declares: [...declares], statements }),
    template: (language, text) => ({ body: "template", language, text }),
  };
  return { pl, declares: () => declares };
}

function writeStatements(statements: readonly Stmt[], indent: string, out: Chunk[]): void {
  const line = (...chunks: Chunk[]): void => {
    out.push(chunkText(indent), ...chunks, chunkText("\n"));
  };
  for (const s of statements) {
    switch (s.kind) {
      case "assign":
        line(chunkText(`${quote(s.target)} := `), chunkOf(s.value), chunkText(";"));
        break;
      case "run":
        line(chunkOf(s.statement), chunkText(";"));
        break;
      case "if":
        line(chunkText("IF "), chunkOf(s.condition), chunkText(" THEN"));
        writeStatements(s.then, `${indent}    `, out);
        if (s.otherwise.length > 0) {
          line(chunkText("ELSE"));
          writeStatements(s.otherwise, `${indent}    `, out);
        }
        line(chunkText("END IF;"));
        break;
      case "while":
        line(chunkText("WHILE "), chunkOf(s.condition), chunkText(" LOOP"));
        writeStatements(s.body, `${indent}    `, out);
        line(chunkText("END LOOP;"));
        break;
      case "for":
        line(chunkText(`FOR ${quote(s.row)} IN `), chunkOf(s.query), chunkText(" LOOP"));
        writeStatements(s.body, `${indent}    `, out);
        line(chunkText("END LOOP;"));
        break;
      case "raise": {
        const args = s.args.flatMap((a) => [chunkText(", "), chunkOf(a)]);
        line(chunkText(`RAISE ${s.level.toUpperCase()} '${s.message.replaceAll("'", "''")}'`), ...args, chunkText(";"));
        break;
      }
      case "return":
        if (s.value === undefined) line(chunkText("RETURN;"));
        else line(chunkText("RETURN "), chunkOf(s.value), chunkText(";"));
        break;
      case "return-query":
        line(chunkText("RETURN QUERY "), chunkOf(s.query), chunkText(";"));
        break;
      case "attempt":
        line(chunkText("BEGIN"));
        writeStatements(s.body, `${indent}    `, out);
        line(chunkText("EXCEPTION"));
        for (const h of s.handlers) {
          line(chunkText(`    WHEN ${h.when} THEN`));
          writeStatements(h.then, `${indent}        `, out);
        }
        line(chunkText("END;"));
        break;
      default:
        absurd(s);
    }
  }
}

function writeBlock(block: Block, declares: Block["declares"], ctx: EmitContext): Chunk[] {
  const out: Chunk[] = [];
  if (declares.length > 0) {
    out.push(chunkText("DECLARE\n"));
    for (const d of declares) {
      out.push(chunkText(`    ${quote(d.name)} ${ctx.dialect.typeOf(d.domain)}`));
      if (d.initial !== undefined) out.push(chunkText(" := "), chunkOf(d.initial));
      out.push(chunkText(";\n"));
    }
  }
  out.push(chunkText("BEGIN\n"));
  writeStatements(block.statements, "    ", out);
  out.push(chunkText("END;"));
  return out;
}

/** Whether statements end by returning or raising on every path: a function that returns a value must. */
function alwaysEnds(statements: readonly Stmt[]): boolean {
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
    case "assign":
    case "run":
    case "while":
    case "for":
      return false;
    default:
      return absurd(last);
  }
}

/** What a body is, for the compiler: a query, a block or a template. */
export type BodyKind<B> = B extends Block ? "block" : B extends Template ? "template" : "query";

/** The dialects a routine's definition renders for: a query body also as a DuckDB macro. */
export type DefinedFor<K extends "function" | "procedure", B extends string> = K extends "function"
  ? B extends "query"
    ? "postgres" | "duckdb"
    : "postgres"
  : "postgres";

/** The dialects a call of a routine renders for: a function with a query body is written in where it is called in SQLite. */
export type CallableIn<K extends "function" | "procedure", B extends string> = K extends "function"
  ? B extends "query"
    ? "postgres" | "duckdb" | "sqlite"
    : "postgres"
  : "postgres";

/** Holds a query body to what the routine returns: the same value for a scalar, the same row for rows. */
export type BodyFits<Ret, B> = B extends Block | Template
  ? B
  : B extends Sql<SqlKind, infer T, string, never>
    ? [T] extends [Ret]
      ? [Ret] extends [T]
        ? B
        : never
      : never
    : never;

/** How a function behaves, as PostgreSQL may be told. */
export interface RoutineOptions {
  /** The schema it lives in. */
  readonly schema?: string;
  /** Whether it gives the same result for the same arguments always (`immutable`), within one statement (`stable`), or neither. */
  readonly volatility?: "immutable" | "stable" | "volatile";
  /** Whether it runs with the rights of whoever defined it. */
  readonly security?: "definer" | "invoker";
  /** Whether it is null whenever an argument is, without being run. */
  readonly strict?: boolean;
  /** Whether it may run in a parallel query. */
  readonly parallel?: "safe" | "restricted" | "unsafe";
  /** The entities its body reads or writes, so that it is defined after them. */
  readonly uses?: readonly EntityName[];
  /** Its description, for a routine a function makes: a routine a person writes takes it from its TSDoc comment. */
  readonly doc?: string;
}

/** A stored routine. */
export interface Routine<
  N extends string,
  A,
  Ret,
  S extends "void" | "scalar" | "set",
  K extends "function" | "procedure",
  B extends string,
> {
  /** What kind of entity this is. */
  readonly entity: "routine";
  /** Whether it is a function or a procedure. */
  readonly routine: K;
  /** The routine's name. */
  readonly name: N;
  /** The schema it lives in. */
  readonly schema: string | undefined;
  /** Its arguments, in order. */
  readonly args: readonly (readonly [name: string, spec: ColumnSpec])[];
  /** What it returns. */
  readonly returns: Returns<Ret, S>;
  /** The statement that defines it: a function or a procedure for PostgreSQL, a macro for DuckDB where its body is a query. */
  readonly ddl: Sql<"statement", unknown, never, DefinedFor<K, B>>;
  /** The entities it must be defined after. */
  readonly dependsOn: () => readonly EntityName[];
  /**
   * A call of the routine: an expression where it returns a value, a relation where it returns rows, a statement where it is a procedure.
   * For SQLite, which stores no functions, a function whose body is a query is written in where it is called.
   */
  readonly call: (
    args: CallArgs<A>,
  ) => K extends "procedure"
    ? Sql<"statement", void, never, "postgres">
    : S extends "set"
      ? Sql<"relation", Ret, never, CallableIn<K, B>>
      : Expr<Ret, never, CallableIn<K, B>>;
}

type AnyBody = Block | Template | AnySql;

function define<
  N extends string,
  A extends ArgMap,
  Ret,
  S extends "void" | "scalar" | "set",
  K extends "function" | "procedure",
  B extends string,
>(
  kind: K,
  name: N,
  argColumns: A,
  returns: Returns<Ret, S>,
  body: (args: ArgRefs<A>, pl: Pl<Ret>) => AnyBody,
  options: RoutineOptions,
): Routine<N, A, Ret, S, K, B> {
  const args = Object.entries(argColumns).map(([n, c]) => [n, c.spec] as const);
  const schema = options.schema;
  const refs = (render: (argName: string) => AnySql): ArgRefs<A> =>
    // the arguments' names are the keys of `argColumns`: Object.fromEntries cannot say so
    Object.fromEntries(args.map(([n]) => [n, { sqlKind: "expression", chunks: render(n).chunks }])) as ArgRefs<A>;
  const built = (r: ArgRefs<A>): { readonly body: AnyBody; readonly declares: Block["declares"] } => {
    const { pl, declares } = makePl<Ret>();
    const b = body(r, pl);
    return { body: b, declares: declares() };
  };
  const probe = built(refs((n) => sql("expression", () => [chunkText(quote(n))]))).body;
  if (!isSql(probe) && probe.body === "block" && returns.returns !== "void" && kind === "function" && !alwaysEnds(probe.statements)) {
    throw new Error(`function ${name} returns a value, but its block does not end by returning or raising on every path`);
  }
  const qualified = (ctx: EmitContext): Chunk => ({ kind: "name", parts: ctx.naming.table(name, schema) });

  const postgres = (ctx: EmitContext): Chunk[] => {
    const d = ctx.dialect;
    const own = renderUnchecked(
      sql("identifier", () => [{ kind: "name", parts: [name] }]),
      ctx,
    );
    const { body: b, declares } = built(refs((n) => sql("expression", () => [chunkText(`${own}.${quote(n)}`)])));
    const out: Chunk[] = [
      chunkText(`CREATE OR REPLACE ${kind === "function" ? "FUNCTION" : "PROCEDURE"} `),
      qualified(ctx),
      chunkText("("),
    ];
    args.forEach(([n, c], i) => {
      out.push(chunkText(`${i === 0 ? "" : ", "}${quote(n)} ${d.typeOf(c.domain)}`));
      if (c.default !== undefined) out.push(chunkText(" DEFAULT "), chunkOf(c.default));
    });
    out.push(chunkText(")"));
    if (kind === "function") {
      switch (returns.returns) {
        case "void":
          out.push(chunkText(" RETURNS void"));
          break;
        case "scalar":
          out.push(chunkText(` RETURNS ${d.typeOf(returns.domain)}`));
          break;
        case "setof":
          out.push(chunkText(" RETURNS SETOF "), { kind: "name", parts: ctx.naming.table(returns.relation.name, returns.relation.schema) });
          break;
        case "table":
          out.push(chunkText(` RETURNS TABLE (${returns.columns.map(([n, c]) => `${quote(n)} ${d.typeOf(c.domain)}`).join(", ")})`));
          break;
        default:
          absurd(returns);
      }
    }
    const language = isSql(b) ? "sql" : b.body === "block" ? "plpgsql" : b.language;
    out.push(chunkText(` LANGUAGE ${language}`));
    if (kind === "function") {
      if (options.volatility !== undefined) out.push(chunkText(` ${options.volatility.toUpperCase()}`));
      if (options.strict === true) out.push(chunkText(" STRICT"));
      if (options.parallel !== undefined) out.push(chunkText(` PARALLEL ${options.parallel.toUpperCase()}`));
    }
    if (options.security !== undefined) out.push(chunkText(` SECURITY ${options.security.toUpperCase()}`));
    out.push(chunkText(" AS $ifc$\n"));
    if (isSql(b)) out.push(...(returns.shape === "scalar" ? [chunkText("SELECT ")] : []), chunkOf(b));
    else if (b.body === "block") out.push(...writeBlock(b, declares, ctx));
    else out.push(chunkOf(b.text));
    out.push(chunkText("\n$ifc$;"));
    const doc = options.doc ?? ctx.docs.get(made)?.summary;
    if (doc !== undefined) {
      const signature = `${renderUnchecked(
        sql("identifier", () => [qualified(ctx)]),
        ctx,
      )}(${args.map(([, c]) => d.typeOf(c.domain)).join(", ")})`;
      const comment = d.comment("function", signature, doc);
      if (comment !== undefined)
        out.push(chunkText(`\n${kind === "procedure" ? comment.replace("COMMENT ON FUNCTION", "COMMENT ON PROCEDURE") : comment};`));
    }
    return out;
  };

  const duckdb = (ctx: EmitContext): Chunk[] => {
    const { body: b } = built(refs((n) => sql("expression", () => [chunkText(quote(n))])));
    if (!isSql(b)) throw new Error(`${name} is not a query, so it cannot be a DuckDB macro`);
    const head: Chunk[] = [
      chunkText("CREATE OR REPLACE MACRO "),
      qualified(ctx),
      chunkText(`(${args.map(([n]) => quote(n)).join(", ")}) AS `),
    ];
    return returns.shape === "scalar"
      ? [...head, chunkText("("), chunkOf(b), chunkText(");")]
      : [...head, chunkText("TABLE "), chunkOf(b), chunkText(";")];
  };

  const call = (given: CallArgs<A>): AnySql => {
    const values = args.map(([n, c]) => operand((given as Readonly<Record<string, unknown>>)[n], c.domain));
    const made = sql(kind === "procedure" ? "statement" : returns.shape === "set" ? "relation" : "expression", (ctx) => {
      if (ctx.dialect.name === "sqlite") {
        const inlined = built(refs((n) => values[args.findIndex(([a]) => a === n)] ?? bind(null))).body;
        if (!isSql(inlined)) throw new Error(`${name} is not a query, so it cannot be written in where it is called`);
        return [chunkText("("), chunkOf(inlined), chunkText(")")];
      }
      if (ctx.dialect.name !== "duckdb" && !ctx.dialect.features.has(kind === "function" ? "functions" : "procedures")) {
        throw new Error(`${ctx.dialect.name} stores no ${kind}s, so ${name} cannot be called in it`);
      }
      const list = values.flatMap((v, i) => (i === 0 ? [chunkOf(v)] : [chunkText(", "), chunkOf(v)]));
      return [...(kind === "procedure" ? [chunkText("CALL ")] : []), qualified(ctx), chunkText("("), ...list, chunkText(")")];
    });
    // a call of a function that returns a value says the value's domain, by which a driver decodes it
    if (returns.returns !== "scalar") return made;
    const withDomain = { ...made, domain: returns.domain };
    return withDomain;
  };

  const made: Routine<N, A, Ret, S, K, B> = {
    entity: "routine",
    routine: kind,
    name,
    schema,
    args,
    returns,
    ddl: sql("statement", (ctx) => {
      if (ctx.dialect.name === "duckdb") return duckdb(ctx);
      if (!ctx.dialect.features.has(kind === "function" ? "functions" : "procedures"))
        throw new Error(`${ctx.dialect.name} stores no ${kind}s, so ${name} is not defined for it`);
      return postgres(ctx);
    }),
    dependsOn: () => [...(options.uses ?? []), ...(returns.returns === "setof" ? [returns.relation] : [])],
    // the kind of what a call gives follows from the routine's kind and what it returns, as the conditional type of `call` says
    call: call as Routine<N, A, Ret, S, K, B>["call"],
  };
  return made;
}

/**
 * Defines a function.
 *
 * @param name - the function's name
 * @param definition - its arguments, what it returns, its body as a function of its arguments, and how it behaves
 * @example
 * const bornSince = fn("born_since", {
 *   args: { since: date() },
 *   returns: setOf(person),
 *   body: ({ since }) => select(person).where(gte(person.c.birth_date, since)),
 * });
 */
export function fn<
  const N extends string,
  const A extends ArgMap,
  Ret,
  S extends "void" | "scalar" | "set",
  B extends Block | Template | AnySql,
>(
  name: N,
  definition: RoutineOptions & {
    readonly args: A;
    readonly returns: Returns<Ret, S>;
    readonly body: (args: ArgRefs<A>, pl: Pl<Ret>) => B & BodyFits<Ret, B>;
  },
): Routine<N, A, Ret, S, "function", BodyKind<B>> {
  return define("function", name, definition.args, definition.returns, definition.body, definition);
}

/**
 * Defines a procedure: a routine run for its effect, in PostgreSQL.
 *
 * @param name - the procedure's name
 * @param definition - its arguments and its body, a block or a template
 * @example
 * const retire = proc("retire_party", {
 *   args: { id: text(), by: text() },
 *   body: ({ id, by }, pl) => pl.block(pl.run(SQL`UPDATE ${party} SET "deleted_by" = ${by} WHERE ${party.c.party_id.bare} = ${id}`), pl.when(pl.notFound, [pl.raise("no party %", id)])),
 * });
 */
export function proc<const N extends string, const A extends ArgMap, B extends Block | Template>(
  name: N,
  definition: RoutineOptions & { readonly args: A; readonly body: (args: ArgRefs<A>, pl: Pl<void>) => B },
): Routine<N, A, void, "void", "procedure", BodyKind<B>> {
  return define("procedure", name, definition.args, nothing, definition.body, definition);
}

/** When a trigger runs, and for what. */
export interface TriggerOptions {
  /** Before or after the change. */
  readonly timing: "before" | "after";
  /** The changes it runs for. */
  readonly events: readonly ("insert" | "update" | "delete")[];
}

/** A trigger: statements run for each row a table has inserted, updated or deleted. */
export interface Trigger {
  /** What kind of entity this is. */
  readonly entity: "trigger";
  /** The trigger's name. */
  readonly name: string;
  /** The schema of its table. */
  readonly schema: string | undefined;
  /** The statements that define it. */
  readonly ddl: Sql<"statement", unknown, "triggers", "postgres" | "sqlite">;
  /** The table it is on. */
  readonly dependsOn: () => readonly EntityName[];
}

/**
 * Defines a trigger of statements, for PostgreSQL and SQLite. The statements are written over the row as it will be (`row.new`) and as
 * it was (`row.old`).
 *
 * @param name - the trigger's name
 * @param on - the table
 * @param options - when it runs
 * @param statements - what it runs, for each row
 */
export function trigger<TN extends string, C>(
  name: string,
  on: {
    readonly name: TN;
    readonly schema: string | undefined;
    readonly spec: { readonly columns: readonly (readonly [string, ColumnSpec])[] };
    readonly __t?: C;
  },
  options: TriggerOptions,
  statements: (row: {
    readonly new: { readonly [K in keyof C & string]: Expr<C[K]> };
    readonly old: { readonly [K in keyof C & string]: Expr<C[K]> };
  }) => readonly AnySql[],
): Trigger {
  const side = (which: "NEW" | "OLD"): { readonly [K in keyof C & string]: Expr<C[K]> } =>
    // the columns are the table's own, by name: Object.fromEntries cannot say so
    Object.fromEntries(
      on.spec.columns.map(([n]) => [
        n,
        sql("expression", (ctx) => [chunkText(`${which}.`), { kind: "name", parts: [ctx.naming.column(n)] }]),
      ]),
    ) as {
      readonly [K in keyof C & string]: Expr<C[K]>;
    };
  const body = statements({ new: side("NEW"), old: side("OLD") });
  const ddl = sql<"statement", unknown, "triggers", "postgres" | "sqlite">("statement", (ctx) => {
    if (!ctx.dialect.features.has("triggers")) throw new Error(`${ctx.dialect.name} has no triggers, so ${name} is not defined for it`);
    const table: Chunk = { kind: "name", parts: ctx.naming.table(on.name, on.schema) };
    const lines = body.flatMap((s) => [chunkText("    "), chunkOf(s), chunkText(";\n")]);
    if (ctx.dialect.name === "sqlite") {
      return options.events.flatMap((e, i): Chunk[] => {
        const each: Chunk = { kind: "name", parts: [`${name}_${e}`] };
        return [
          chunkText(`${i === 0 ? "" : "\n"}DROP TRIGGER IF EXISTS `),
          each,
          chunkText(";\nCREATE TRIGGER "),
          each,
          chunkText(` ${options.timing.toUpperCase()} ${e.toUpperCase()} ON `),
          table,
          chunkText(" FOR EACH ROW BEGIN\n"),
          ...lines,
          chunkText("END;"),
        ];
      });
    }
    const fnName: Chunk = { kind: "name", parts: ctx.naming.table(`${name}_fn`, on.schema) };
    const self: Chunk = { kind: "name", parts: [name] };
    return [
      chunkText("CREATE OR REPLACE FUNCTION "),
      fnName,
      chunkText("() RETURNS trigger LANGUAGE plpgsql AS $ifc$\nBEGIN\n"),
      ...lines,
      chunkText("    RETURN COALESCE(NEW, OLD);\nEND;\n$ifc$;\nDROP TRIGGER IF EXISTS "),
      self,
      chunkText(" ON "),
      table,
      chunkText(";\nCREATE TRIGGER "),
      self,
      chunkText(` ${options.timing.toUpperCase()} ${options.events.map((e) => e.toUpperCase()).join(" OR ")} ON `),
      table,
      chunkText(" FOR EACH ROW EXECUTE FUNCTION "),
      fnName,
      chunkText("();"),
    ];
  });
  return { entity: "trigger", name, schema: on.schema, ddl, dependsOn: () => [{ name: on.name, schema: on.schema }] };
}
