// Spec: 0025-sql-target FR-004, FR-005
/**
 * Making a database from a build, and keeping the committed file current (commons data 0025-sql-target).
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import type { Driver } from "@intellectual-frontiers/data/sql/lifecycle";
import type { TargetBuild } from "./build.ts";

/**
 * Makes a database from a build, in one transaction.
 *
 * @param driver - an empty database
 * @param build - the build
 * @returns the number of statements run, or the database's error
 */
export async function materialize(driver: Driver, build: TargetBuild): Promise<Result<number, { readonly kind: "database"; readonly statement: number; readonly message: string }>> {
  await driver.exec("BEGIN");
  let n = 0;
  try {
    for (const s of build.statements) {
      await driver.exec(s);
      n++;
    }
    await driver.exec("COMMIT");
    return ok(n);
  } catch (thrown) {
    await driver.exec("ROLLBACK").catch(() => undefined);
    return err({ kind: "database", statement: n + 1, message: thrown instanceof Error ? thrown.message : String(thrown) });
  }
}

/** Whether a committed file is what the source makes. */
export type Staleness = { readonly stale: false } | { readonly stale: true; readonly line: number; readonly committed: string; readonly made: string };

/**
 * Compares a committed file with what the source makes now.
 *
 * @param committed - the text of the committed file
 * @param build - what the source makes now
 * @returns whether it is current, and where it first differs if not
 */
export function staleness(committed: string, build: TargetBuild): Staleness {
  if (committed === build.text) return { stale: false };
  const a = committed.split("\n");
  const b = build.text.split("\n");
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return { stale: true, line: i + 1, committed: a[i] ?? "", made: b[i] ?? "" };
}
