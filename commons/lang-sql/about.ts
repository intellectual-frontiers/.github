// Spec: 0001-sql-lang FR-003
/**
 * The typed facts of Lang Sql, an independent library of commons (commons 0027-commons-libraries). Its specification is in its own spec kit (`spec-kit/`), numbered from 0001; this repository knows it as one requirement of
 * 0027-commons-libraries, proved by `bun run verify` in this folder.
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** Lang Sql. */
export const about: About = {
  title: "Lang Sql",
  summary: "A small, fast, portable multi-dialect SQL language library: a lexer, a closed syntax tree and a parser for thirty dialects, comments as first-class nodes, and extensions for queries, unist, documentation and PL/pgSQL.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    {
      path: "src/",
      what: "The SQL language core (0001-sql-lang): a small, fast, portable front end for SQL in many dialects, published as `@intellectual-frontiers/lang-sql`. The lexical layer (0001-sql-lang): `lex` turns text into tokens and comments with exact positions, a dialect (`defineDialect`) says how it is written, and every comment is kept with its kind, marker, span and place for the features that read them. The syntax tree and the parser (0002-sql-ast-parser): a closed union of nodes whose child fields are typed by sort, `parse` and `parseStrict` for the common ground of SQL (queries, data changes, tables, views, indexes) with a dialect's `Grammar` adding its operators, cast and like-words, a statement that cannot be read kept as an `unparsed` node while the others are read, each comment attached to its node (`commentsOf`), and the walks `children`, `walk`, `findAll` and `fold`. Rewriting, queries and unist (0003-sql-ast-tools): `rewriteScript` and its kin rewrite a tree from the leaves up by rules for sorts, so a rule cannot return a node of another sort and a rewrite that changes nothing returns its input; the extension `extensions/query` gives the table of parents, lazy typed selections (`select(root).find(\"table\")`) and the named analyses `tableUses` (with the scope of common table expressions), `functionsCalled` and `readOnlyProblem`; the extension `extensions/unist` projects a parse, its comments among the children, to a `unist` tree that `unist-util-visit` and `unist-util-select` read as they read Markdown. The dialects are thirty (athena, bigquery, clickhouse, databricks, doris, dremio, drill, druid, duckdb, dune, exasol, fabric, hive, materialize, mysql, oracle, postgres, presto, redshift, risingwave, singlestore, snowflake, solr, spark, spark2, sqlite, starrocks, teradata, trino, tsql: 0005-sql-dialects); DAX, PRQL and Tableau, which sqlglot reads as dialects, are not SQL (a formula language, a pipeline language and a calculation language) and are not among them. The core is the files of the folder; the dialects are `dialects/<name>/` and the extensions will be `extensions/<name>/`, which may import the core and nothing else here. Quoting, placeholders and a registry of dialects with a catalog of functions (0007-sql-emit): `quoteIdent`, `identifier`, `quoteString`, `placeholder` and `createRegistry`, so that a library that builds statements for a dialect, or adds a dialect of its own, writes no quote and no parameter by hand.",
      mayImport: ["@intellectual-frontiers/core, by package name, and nothing else"],
    },
    {
      path: "src/aide/",
      what: "The helpers (0010-aide): what gives meaning to the tree or runs it, as pure modules exported as `./aide/<name>`: `profile` (restrict a parse to a subset of the language), `catalog` (tables and functions, `bind`, `typeOf`, `check`), `normalize` (`simplify`, `conjuncts`), `plan` (`plan`, `explain`, `split` between a backend and the process), `exec` (`compile` to closures with the logic of SQL, `run` a plan over rows) `text` (`transpile`, the `sql` template, `renderDiagnostic`), `relational` (`createEngine`: a read-only SQL engine over the relations of a `Provider`; joins, grouping, subqueries) and `introspect` (SQL over the tree: relations, rules as queries, 0008-sql-introspect) and `guard` (`guard`, `refusal`: a text is one statement that only reads, judged by its tree; 0012-sql-guard).",
      mayImport: ["the core of src/, by relative path", "@intellectual-frontiers/core, by package name"],
    },
    {
      path: "acceptance/",
      what: "Two utilities that are useful in themselves and are the acceptance of the language, of introspection and of aide, and their demos (0011-acceptance): `sqlfs` searches a file system with SQL in this process and `sqlfind` compiles the same language to a `find` command; `shared/` holds their dialect, profile and catalog, the fixture tree and the walks; `aat.ts`, `scenarios.ts` and `demos/` are the automated and user acceptance. Not exported.",
      mayImport: ["src/ and aide/, by relative path", "node: modules"],
    },
    { path: "suite/", what: "The tests, the golden files and the corpora of open-source SQL suites with their provenance and licenses.", mayImport: ["src/, by package name", "the test module of commons' runtime, by package name"] },
    { path: "tools/", what: "The trace check `bun run verify` runs, the benchmark, the golden files and the conformance report.", mayImport: ["src/, by relative path", "the kernel, the runtime and the packer of commons, by package name"] },
  ],
};
