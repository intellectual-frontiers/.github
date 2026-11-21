/**
 * PL/pgSQL, the language of PostgreSQL's routines (commons lang-sql 0006-sql-routines): `parsePlpgsql` reads the body of a `CREATE FUNCTION`, `CREATE PROCEDURE` or `DO` of a parse as blocks, declarations and
 * statements, with the SQL they hold read by the core parser at its place in the whole text and the comments attached. An extension of the SQL language core: it imports the core and nothing else.
 *
 * @remarks
 * The nodes are this extension's (`pl-block`, `pl-if`, ...), with the core's for the SQL; `plChildren` gives the children of both, so the core's `attachTree` and the walks that take a `children` work on a body.
 *
 * @limits
 * PL/pgSQL only; the routines of other dialects are read as blocks without being read inside.
 *
 * @example
 * ```ts
 * import { parse } from "@intellectual-frontiers/lang-sql";
 * import { dialect as postgres } from "@intellectual-frontiers/lang-sql/dialects/postgres";
 * import { parsePlpgsql } from "@intellectual-frontiers/lang-sql/extensions/plpgsql";
 * const p = parse("CREATE FUNCTION f() RETURNS int AS $$ BEGIN RETURN 1; END $$ LANGUAGE plpgsql", postgres);
 * const body = parsePlpgsql(p, postgres, p.script.statements[0]!);
 * ```
 *
 * Spec: 0006-sql-routines FR-005, FR-006, FR-007, FR-008
 *
 * @module
 */
export * from "./nodes.ts";
export { type PlParse, parsePlpgsql, parsePlpgsqlRange, plpgsqlBodyOf } from "./parse.ts";
