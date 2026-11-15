/**
 * An example plugin: pgvector for PostgreSQL, as a dialect extension and a plugin (commons 0009-sql-aide FR-023, FR-024). The extension
 * adds a `vector` feature, the `hnsw` and `ivfflat` index methods and how a vector column is written; the plugin adds a lint rule, that
 * a vector has at most the dimensions pgvector indexes, and a generator that lists the vector columns. Nothing registers it: a context
 * that wants it is made with `postgres().with(pgvectorExtension)` and `plugins: [pgvectorPlugin]`.
 *
 * @module
 */
import { type Column, column } from "../algebra/column.ts";
import { domain } from "../algebra/domain.ts";
import type { DialectExtension, Plugin } from "../emit/context.ts";

/** The features pgvector adds to PostgreSQL. */
export type PgvectorFeature = "vector" | "index:hnsw" | "index:ivfflat";

/** The most dimensions pgvector's indexes take. */
export const PGVECTOR_MAX_INDEXED = 2000;

/** pgvector, as an extension of the PostgreSQL dialect. */
export const pgvectorExtension: DialectExtension<"postgres", PgvectorFeature> = {
  name: "vector",
  dialect: "postgres",
  features: ["vector", "index:hnsw", "index:ivfflat"],
  typeOf: (spec) => (spec.kind === "custom" && /^vector\(\d+\)$/.test(spec.name) ? spec.name : undefined),
  install: "CREATE EXTENSION IF NOT EXISTS vector",
};

/**
 * A column of vectors of a number of dimensions: a dialect needs the `vector` feature, which only PostgreSQL with pgvector has.
 *
 * @param dimensions - how many numbers each vector holds
 */
export const vector = (dimensions: number): Column<readonly number[], false, "required", false, "vector"> =>
  column(domain<readonly number[], "vector">({ kind: "custom", name: `vector(${Math.trunc(dimensions)})` }));

/** pgvector's plugin: its lint rule and its generator. */
export const pgvectorPlugin: Plugin = {
  name: "pgvector",
  version: "0.1.0",
  hooks: {
    lint: [
      {
        id: "vector-dimensions",
        check: ({ spec }) =>
          spec.columns.flatMap(([n, c]) => {
            const m = c.domain.kind === "custom" ? /^vector\((\d+)\)$/.exec(c.domain.name) : null;
            return m !== null && Number(m[1]) > PGVECTOR_MAX_INDEXED
              ? [
                  {
                    rule: "vector-dimensions",
                    table: spec.name,
                    column: n,
                    message: `has more dimensions than pgvector indexes (${PGVECTOR_MAX_INDEXED})`,
                  },
                ]
              : [];
          }),
      },
    ],
    generators: [
      {
        name: "vectors",
        generate: (tables) => [
          {
            path: "vectors.txt",
            text: tables
              .flatMap(({ spec }) =>
                spec.columns
                  .filter(([, c]) => c.domain.kind === "custom" && c.domain.name.startsWith("vector("))
                  .map(([n, c]) => `${spec.name}.${n} ${c.domain.kind === "custom" ? c.domain.name : ""}\n`),
              )
              .join(""),
          },
        ],
      },
    ],
  },
};
