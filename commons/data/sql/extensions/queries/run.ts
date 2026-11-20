// Spec: 0024-sql-queries FR-004, FR-005
/**
 * Running queries (commons data 0024-sql-queries): in a transaction that is rolled back, and prepared against a database to find what it refuses.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { Driver } from "@intellectual-frontiers/data/sql/lifecycle";
import type { Catalog, ParamError, ParamType, Query } from "./catalog.ts";

export type RunError = { readonly kind: "params"; readonly errors: readonly ParamError[] } | { readonly kind: "database"; readonly message: string };

const plain = (r: Readonly<Record<string, unknown>>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v]));

/**
 * Runs a query.
 *
 * @param driver - the database
 * @param query - the query
 * @param values - the values of its parameters
 * @returns its rows, or why not
 */
export async function run(driver: Driver, query: Query, values: Readonly<Record<string, unknown>> = {}): Promise<Result<readonly Record<string, unknown>[], RunError>> {
  const sql = query.render(values);
  if (sql.kind === "err") return err({ kind: "params", errors: sql.error });
  await driver.exec("BEGIN");
  try {
    return ok((await driver.query(sql.value)).map(plain));
  } catch (thrown) {
    return err({ kind: "database", message: thrown instanceof Error ? thrown.message : String(thrown) });
  } finally {
    await driver.exec("ROLLBACK").catch(() => undefined);
  }
}

/** A query the engine refused. */
export interface Finding {
  readonly query: string;
  readonly message: string;
}

const SAMPLE: Readonly<Record<ParamType, unknown>> = { text: "x", integer: 0, number: 0, boolean: true };

/**
 * Prepares every query of a catalog against a database.
 *
 * @param driver - the database
 * @param catalog - the catalog
 * @param samples - the values to prepare a query with, by query name and then by parameter; a sample of its type where one is not given
 * @returns what the engine refused
 */
export async function verify(driver: Driver, catalog: Catalog, samples: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {}): Promise<readonly Finding[]> {
  const out: Finding[] = [];
  for (const q of catalog.queries) {
    const values = Object.fromEntries(Object.entries(q.params).map(([k, p]) => [k, samples[q.name]?.[k] ?? SAMPLE[p.type]]));
    const sql = q.render(values);
    if (sql.kind === "err") {
      out.push({ query: q.name, message: `its sample values are not valid: ${JSON.stringify(sql.error)}` });
      continue;
    }
    await driver.exec("BEGIN");
    try {
      await driver.query(`SELECT * FROM (${sql.value}) AS q LIMIT 0;`);
    } catch (thrown) {
      out.push({ query: q.name, message: thrown instanceof Error ? thrown.message : String(thrown) });
    } finally {
      await driver.exec("ROLLBACK").catch(() => undefined);
    }
  }
  return out;
}
