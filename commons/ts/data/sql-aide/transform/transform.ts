/**
 * Transforms: a model is a typed query that other models read by importing it, materialized as a view, a table, an incremental table, a
 * materialized view or nothing at all (ephemeral, written in where it is read). The order of a build comes from what each model's query
 * refers to, found by walking the query itself; and each model says its lineage (commons 0009-sql-aide FR-028, FR-043).
 *
 * @module
 */
import { absurd } from "../../../kernel/mod.ts";
import { duckdb, postgres, sqlite } from "../dialect/dialects.ts";
import { context, type EmitContext } from "../emit/context.ts";
import type { Expr } from "../emit/expr.ts";
import { type AnySql, type Chunk, chunkOf, chunkText, sql, type Sql } from "../emit/sql.ts";
import type { LineageEdge } from "../integrate/integration.ts";
import type { Shaped } from "../query/builder.ts";
import { type EntityName, entityKey } from "../model/entity.ts";

/** How a model is kept in the database. */
export type Materialization =
  /** A view: read through each time. */
  | "view"
  /** A table made again from the query on every build. */
  | "table"
  /** A table to which each build adds the rows whose key it does not hold yet. */
  | "incremental"
  /** A materialized view, refreshed on every build: PostgreSQL's. */
  | "materialized-view"
  /** Nothing: the query is written in where another model reads it. */
  | "ephemeral"
  /** A way a plugin of the context keeps it, by the plugin's name for it (FR-024). */
  | `plugin:${string}`;

const isPlugin = (m: Materialization): m is `plugin:${string}` => m.startsWith("plugin:");

/** What a materialization asks of a dialect. */
export type MaterializationReq<M extends Materialization> = M extends "view"
  ? "views"
  : M extends "materialized-view"
    ? "materialized-views"
    : never;

/** A query a model is made of: one that says the names of its columns, as the query builder's do. */
export type ModelQuery<Row, Req extends string, Dx extends string> = Sql<"statement", Row, Req, Dx> & Shaped;

/** A transform model: used in SQL it is the relation it is materialized as; `ddl` builds it. */
export interface Model<
  N extends string,
  Row,
  Req extends string,
  Dx extends string,
  M extends Materialization = Materialization,
> extends Sql<"relation", Row, Req | MaterializationReq<M>, Dx> {
  /** What kind of entity this is. */
  readonly entity: "transform";
  /** The model's name. */
  readonly name: N;
  /** Its schema. */
  readonly schema: string | undefined;
  /** How it is kept. */
  readonly materialization: M;
  /** Its query. */
  readonly query: ModelQuery<Row, Req, Dx>;
  /** The columns of its rows, as expressions: what a model that reads it uses. */
  readonly c: { readonly [K in keyof Row]: Expr<Row[K]> };
  /** The statements that build it. */
  readonly ddl: Sql<"statement", unknown, Req | MaterializationReq<M>, Dx>;
  /** The relations its query refers to: tables, views and other models. */
  readonly dependsOn: () => readonly EntityName[];
  /** From each relation it reads to it (FR-028). */
  readonly lineage: () => readonly LineageEdge[];
}

/** Any model. */
export type AnyModel = Model<string, unknown, string, string, Materialization>;

/** What a model may say beyond its query. */
export interface ModelOptions<Row, M extends Materialization> {
  /** How it is kept; a view where not said. */
  readonly materialized?: M;
  /** The columns a row is known by, for an incremental model: a row whose key the table holds is not added again. */
  readonly key?: readonly (keyof Row & string)[];
  /** The schema it lives in. */
  readonly schema?: string;
}

/** Contexts to walk a query in: the first whose dialect the query has a case for is used. */
const walkers = [context({ dialect: postgres() }), context({ dialect: duckdb() }), context({ dialect: sqlite() })];

function referenced(query: AnySql, self: string): readonly EntityName[] {
  const found = new Map<string, EntityName>();
  const visit = (chunks: readonly Chunk[], ctx: EmitContext): void => {
    for (const c of chunks) {
      if (c.kind !== "sql") continue;
      const p: object = c.sql;
      if ("entity" in p && "name" in p && typeof p.name === "string" && p.name !== self) {
        const schema = "schema" in p && typeof p.schema === "string" ? p.schema : undefined;
        found.set(entityKey({ name: p.name, schema }), { name: p.name, schema });
        // a model, table or view read is a node of its own: its own references are its
        if (p.entity === "transform" || p.entity === "table" || p.entity === "view") continue;
      }
      if ("owner" in p && typeof p.owner === "function") {
        const o: unknown = p.owner();
        if (typeof o === "object" && o !== null && "name" in o && typeof o.name === "string" && o.name !== self) {
          const schema = "schema" in o && typeof o.schema === "string" ? o.schema : undefined;
          found.set(entityKey({ name: o.name, schema }), { name: o.name, schema });
        }
      }
      visit(c.sql.chunks(ctx), ctx);
    }
  };
  for (const ctx of walkers) {
    try {
      visit(query.chunks(ctx), ctx);
      return [...found.values()];
    } catch {
      found.clear();
    }
  }
  return [];
}

/**
 * Makes a transform model.
 *
 * @param modelName - its name
 * @param query - its query, whose rows are the model's
 * @param options - how it is kept, the key of an incremental model, its schema
 * @example
 * const contacts = model("party_contacts", from(party).leftJoin(electronicContact).select((s) => ({ ... })), { materialized: "table" });
 */
export function model<const N extends string, Row, Req extends string, Dx extends string, const M extends Materialization = "view">(
  modelName: N,
  query: ModelQuery<Row, Req, Dx>,
  options: ModelOptions<Row, M> = {},
): Model<N, Row, Req, Dx, M> {
  const materialization = (options.materialized ?? "view") as M;
  const schema = options.schema;
  const self = (ctx: EmitContext): Chunk => ({ kind: "name", parts: ctx.naming.table(modelName, schema) });
  const columns = (ctx: EmitContext): Chunk[] =>
    query.columns.flatMap((n, i): Chunk[] => [...(i === 0 ? [] : [chunkText(", ")]), { kind: "name", parts: [ctx.naming.column(n)] }]);
  const key = options.key ?? [];
  if (materialization === "incremental" && key.length === 0) throw new Error(`model ${modelName} is incremental and has no key`);
  const ddl = (ctx: EmitContext): Chunk[] => {
    const q = chunkOf(query);
    const m: Materialization = materialization;
    if (isPlugin(m)) {
      const wanted = m.slice("plugin:".length);
      const hook = ctx.plugins.map((p) => p.hooks?.materializations?.[wanted]).find((h) => h !== undefined);
      if (hook === undefined) throw new Error(`no plugin of the context keeps a model as ${wanted}, as ${modelName} asks`);
      return [chunkText(hook(query, ctx.naming.table(modelName, schema), ctx))];
    }
    switch (m) {
      case "view":
        return ctx.dialect.replacesViews
          ? [chunkText("CREATE OR REPLACE VIEW "), self(ctx), chunkText(" ("), ...columns(ctx), chunkText(") AS\n"), q, chunkText(";")]
          : [
              chunkText("DROP VIEW IF EXISTS "),
              self(ctx),
              chunkText(";\nCREATE VIEW "),
              self(ctx),
              chunkText(" ("),
              ...columns(ctx),
              chunkText(") AS\n"),
              q,
              chunkText(";"),
            ];
      case "table":
        return [
          chunkText("DROP TABLE IF EXISTS "),
          self(ctx),
          chunkText(";\nCREATE TABLE "),
          self(ctx),
          chunkText(" AS\n"),
          q,
          chunkText(";"),
        ];
      case "incremental": {
        const same = key.flatMap((k, i): Chunk[] => [
          chunkText(i === 0 ? "" : " AND "),
          chunkText("t."),
          { kind: "name", parts: [ctx.naming.column(k)] },
          chunkText(" = s."),
          { kind: "name", parts: [ctx.naming.column(k)] },
        ]);
        return [
          chunkText("CREATE TABLE IF NOT EXISTS "),
          self(ctx),
          chunkText(" AS\nSELECT * FROM ("),
          q,
          chunkText(") AS s WHERE 1 = 0;\nINSERT INTO "),
          self(ctx),
          chunkText(" ("),
          ...columns(ctx),
          chunkText(")\nSELECT "),
          ...query.columns.flatMap((n, i): Chunk[] => [
            chunkText(i === 0 ? "s." : ", s."),
            { kind: "name", parts: [ctx.naming.column(n)] },
          ]),
          chunkText(" FROM ("),
          q,
          chunkText(") AS s WHERE NOT EXISTS (SELECT 1 FROM "),
          self(ctx),
          chunkText(" AS t WHERE "),
          ...same,
          chunkText(");"),
        ];
      }
      case "materialized-view":
        return [
          chunkText("CREATE MATERIALIZED VIEW IF NOT EXISTS "),
          self(ctx),
          chunkText(" ("),
          ...columns(ctx),
          chunkText(") AS\n"),
          q,
          chunkText(";\nREFRESH MATERIALIZED VIEW "),
          self(ctx),
          chunkText(";"),
        ];
      case "ephemeral":
        return [chunkText(`-- model ${modelName} is ephemeral: it is written in where it is read`)];
      default:
        return absurd(m);
    }
  };
  const c = Object.fromEntries(
    query.columns.map((n, i) => [
      n,
      {
        ...sql("expression", (ctx) => [{ kind: "name", parts: [...ctx.naming.table(modelName, schema), ctx.naming.column(n)] }]),
        domain: query.domains?.[i],
      },
    ]),
  );
  const dependsOn = (): readonly EntityName[] => referenced(query, modelName);
  return {
    sqlKind: "relation",
    chunks: (ctx) => (materialization === "ephemeral" ? [chunkText("("), chunkOf(query), chunkText(") AS "), self(ctx)] : [self(ctx)]),
    entity: "transform",
    name: modelName,
    schema,
    materialization,
    query,
    // the columns are the query's, each an expression of its value
    c: c as unknown as { readonly [K in keyof Row]: Expr<Row[K]> },
    ddl: sql("statement", ddl),
    dependsOn,
    lineage: () =>
      dependsOn().map((d) => ({
        via: modelName,
        kind: "transform" as const,
        from: entityKey(d),
        to: entityKey({ name: modelName, schema }),
      })),
  };
}
