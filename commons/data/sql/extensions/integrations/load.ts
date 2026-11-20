// Spec: 0022-sql-integrations FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008
/**
 * A load (commons data 0022-sql-integrations): the rows landed in a typed temporary table, checked, counted and loaded in one transaction, and recorded in a ledger. Where anything is wrong the target
 * is as it was, and the reason is a value.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { words } from "@intellectual-frontiers/data/governance";
import { type Driver, hashOf } from "@intellectual-frontiers/data/sql/lifecycle";
import { type Literal, parseCsv } from "@intellectual-frontiers/data/sql/physical";
import { type ContractColumn, type Loader, sourceLabel } from "./integration.ts";
import { type IntegrationSettings, settingsOf } from "./settings.ts";

/** What a load did. */
export interface LoadReport {
  readonly name: string;
  readonly outcome: "loaded" | "unchanged";
  readonly landed: number;
  readonly inserted: number;
  readonly updated: number;
  readonly deleted: number;
  /** The hash of the landed rows. */
  readonly hash: string;
}

/** Why a load changed nothing. */
export type LoadError =
  | { readonly kind: "adapter"; readonly adapter: string; readonly message: string }
  | { readonly kind: "source"; readonly message: string }
  | { readonly kind: "unsupported"; readonly why: string }
  | { readonly kind: "duplicate-keys"; readonly count: number }
  | { readonly kind: "null-required"; readonly column: string; readonly count: number }
  | { readonly kind: "empty-snapshot" }
  | { readonly kind: "delete-share"; readonly share: number; readonly max: number }
  | { readonly kind: "database"; readonly message: string };

type Cell = string | number | boolean | null;

const plain = (v: unknown): Cell =>
  v === undefined || v === null
    ? null
    : typeof v === "string" || typeof v === "number" || typeof v === "boolean"
      ? v
      : typeof v === "bigint"
        ? Number.isSafeInteger(Number(v))
          ? Number(v)
          : v.toString()
        : v instanceof Date
          ? v.toISOString()
          : JSON.stringify(v);

/** The rows of the source as cells in the order of the contract, or the reason there are none; a source of an attached table has no rows here. */
async function rowsOf(l: Loader, delimiter: string): Promise<Result<readonly (readonly Cell[])[] | undefined, LoadError>> {
  const s = l.spec.source;
  const byWords = (given: readonly Readonly<Record<string, unknown>>[]): Result<readonly (readonly Cell[])[], LoadError> => {
    const index = new Map(l.columns.map((c, i) => [c.words, i]));
    const out: Cell[][] = [];
    for (const row of given) {
      const cells: Cell[] = l.columns.map(() => null);
      for (const [k, v] of Object.entries(row)) {
        const i = index.get(words(k).join(".")) ?? index.get(k);
        if (i === undefined) return err({ kind: "source", message: `a row gives the column ${k}, which the contract does not` });
        cells[i] = plain(v);
      }
      out.push(cells);
    }
    return ok(out);
  };
  switch (s.kind) {
    case "rows":
      return byWords(s.rows);
    case "csv": {
      const records = parseCsv(s.text, s.delimiter ?? delimiter);
      const header = records[0] ?? [];
      const at = header.map((h) => l.columns.findIndex((c) => c.words === words(h.trim()).join(".")));
      const stray = header.filter((_, i) => at[i] === -1);
      if (stray.length > 0) return err({ kind: "source", message: `the header gives columns the contract does not: ${stray.join(", ")}` });
      return ok(
        records.slice(1).map((r) => {
          const cells: Cell[] = l.columns.map(() => null);
          r.forEach((f, i) => {
            cells[at[i] as number] = f === "" ? null : f;
          });
          return cells;
        }),
      );
    }
    case "attached":
      return l.dialect.attach === undefined ? err({ kind: "unsupported", why: `${l.dialect.name} cannot attach a database` }) : ok(undefined);
    case "adapter": {
      let read: Awaited<ReturnType<typeof s.adapter.read>>;
      try {
        read = await s.adapter.read();
      } catch (thrown) {
        read = err(thrown instanceof Error ? thrown.message : String(thrown));
      }
      if (read.kind === "err") return err({ kind: "adapter", adapter: s.adapter.name, message: read.error });
      return byWords(read.value);
    }
  }
}

const count = async (driver: Driver, sql: string): Promise<number> => Number((await driver.query(sql))[0]?.["n"] ?? 0);

/**
 * Loads an integration.
 *
 * @param driver - the database
 * @param l - the integration, resolved
 * @param given - what a project says of integrations
 * @returns what the load did, or why it changed nothing
 */
export async function load(driver: Driver, l: Loader, given: IntegrationSettings = {}): Promise<Result<LoadReport, readonly LoadError[]>> {
  const settings = settingsOf(given);
  const d = l.dialect;
  const q = (n: string): string => d.quote(n);
  const lit = (v: Cell): string => d.literal(v as Literal);
  const rows = await rowsOf(l, settings.delimiter);
  if (rows.kind === "err") return err([rows.error]);
  const landing = q(l.naming.names.write([...words(l.spec.name), settings.landing]));
  const cols = l.columns.map((c) => q(c.name)).join(", ");
  const ledger = l.qualify(settings.ledger);
  const eq = (a: string, b: string): string => l.key.map((k) => `${a}.${q(k.name)} = ${b}.${q(k.name)}`).join(" AND ");
  const fail = (e: LoadError): Result<LoadReport, readonly LoadError[]> => err([e]);
  try {
    await driver.exec(`CREATE TEMPORARY TABLE ${landing} (${l.columns.map((c) => `${q(c.name)} ${c.type}`).join(", ")});`);
    const s = l.spec.source;
    if (rows.value !== undefined) {
      const csv = s.kind === "csv";
      for (let i = 0; i < rows.value.length; i += 200) {
        const values = rows.value
          .slice(i, i + 200)
          .map((r) => `(${r.map((v, j) => (csv && v !== null ? `CAST(${lit(v)} AS ${(l.columns[j] as ContractColumn).type})` : lit(v))).join(", ")})`);
        await driver.exec(`INSERT INTO ${landing} (${cols}) VALUES ${values.join(", ")};`);
      }
    } else if (s.kind === "attached" && d.attach !== undefined) {
      const alias = s.alias ?? `${l.spec.name}_source`;
      await driver.exec(d.attach.attach(s.file, alias));
      try {
        await driver.exec(`INSERT INTO ${landing} (${cols}) SELECT ${cols} FROM ${q(alias)}.${q(s.relation)};`);
      } finally {
        await driver.exec(d.attach.detach(alias));
      }
    }
    await driver.exec(
      `CREATE TABLE IF NOT EXISTS ${ledger} (${q("name")} TEXT NOT NULL, ${q("seq")} INTEGER NOT NULL, ${q("source")} TEXT NOT NULL, ${q("source_hash")} TEXT NOT NULL, ${q("strategy")} TEXT NOT NULL, ${q("landed")} INTEGER NOT NULL, ${q("inserted")} INTEGER NOT NULL, ${q("updated")} INTEGER NOT NULL, ${q("deleted")} INTEGER NOT NULL, PRIMARY KEY (${q("name")}, ${q("seq")}));`,
    );
    await driver.exec("BEGIN");
    let done = false;
    try {
      // what is wrong with the rows, found while the target is untouched
      const problems: LoadError[] = [];
      if (l.strategy !== "append" && l.key.length > 0) {
        const dup = await count(driver, `SELECT COUNT(*) AS n FROM (SELECT 1 FROM ${landing} GROUP BY ${l.key.map((k) => q(k.name)).join(", ")} HAVING COUNT(*) > 1) d;`);
        if (dup > 0) problems.push({ kind: "duplicate-keys", count: dup });
      }
      for (const c of l.columns.filter((x) => x.required)) {
        const n = await count(driver, `SELECT COUNT(*) AS n FROM ${landing} WHERE ${q(c.name)} IS NULL;`);
        if (n > 0) problems.push({ kind: "null-required", column: c.name, count: n });
      }
      if (problems.length > 0) return err(problems);
      const landed = await count(driver, `SELECT COUNT(*) AS n FROM ${landing};`);
      const ordered = await driver.query(`SELECT ${cols} FROM ${landing} ORDER BY ${l.columns.map((_, i) => i + 1).join(", ")};`);
      const hash = hashOf(ordered.map((r) => l.columns.map((c) => plain(r[c.name]))));
      const last = (await driver.query(`SELECT ${q("source_hash")} AS h FROM ${ledger} WHERE ${q("name")} = ${lit(l.spec.name)} ORDER BY ${q("seq")} DESC LIMIT 1;`))[0]?.["h"];
      const skip = settings.skipUnchanged === "all" || (settings.skipUnchanged === "append" && l.strategy === "append");
      if (skip && last === hash) return ok({ name: l.spec.name, outcome: "unchanged", landed, inserted: 0, updated: 0, deleted: 0, hash });
      const before = await count(driver, `SELECT COUNT(*) AS n FROM ${l.ref};`);
      const keyed = l.strategy === "upsert" || l.strategy === "snapshot";
      const matched = keyed ? await count(driver, `SELECT COUNT(*) AS n FROM ${landing} l WHERE EXISTS (SELECT 1 FROM ${l.ref} x WHERE ${eq("x", "l")});`) : 0;
      const gone = l.strategy === "snapshot" ? await count(driver, `SELECT COUNT(*) AS n FROM ${l.ref} x WHERE NOT EXISTS (SELECT 1 FROM ${landing} l WHERE ${eq("x", "l")});`) : 0;
      if (l.strategy === "snapshot") {
        if (landed === 0) return fail({ kind: "empty-snapshot" });
        if (before > 0 && gone / before > settings.maxDeleteShare) return fail({ kind: "delete-share", share: gone / before, max: settings.maxDeleteShare });
      }
      const nonKey = l.columns.filter((c) => !l.key.includes(c));
      const insert = `INSERT INTO ${l.ref} (${cols}) SELECT ${cols} FROM ${landing}`;
      const upsert = `${insert} WHERE TRUE ON CONFLICT (${l.key.map((k) => q(k.name)).join(", ")}) DO ${nonKey.length === 0 ? "NOTHING" : `UPDATE SET ${nonKey.map((c) => `${q(c.name)} = excluded.${q(c.name)}`).join(", ")}`};`;
      if (l.strategy === "replace") await driver.exec(`DELETE FROM ${l.ref};`);
      await driver.exec(keyed ? upsert : `${insert};`);
      if (l.strategy === "snapshot") await driver.exec(`DELETE FROM ${l.ref} AS x WHERE NOT EXISTS (SELECT 1 FROM ${landing} l WHERE ${eq("x", "l")});`);
      const report: LoadReport = {
        name: l.spec.name,
        outcome: "loaded",
        landed,
        inserted: keyed ? landed - matched : landed,
        updated: matched,
        deleted: l.strategy === "replace" ? before : gone,
        hash,
      };
      const seq = (await count(driver, `SELECT COALESCE(MAX(${q("seq")}), 0) + 1 AS n FROM ${ledger} WHERE ${q("name")} = ${lit(l.spec.name)};`)) as number;
      await driver.exec(
        `INSERT INTO ${ledger} VALUES (${[lit(l.spec.name), seq, lit(sourceLabel(l.spec.source)), lit(hash), lit(l.strategy), landed, report.inserted, report.updated, report.deleted].join(", ")});`,
      );
      await driver.exec("COMMIT");
      done = true;
      return ok(report);
    } finally {
      if (!done) await driver.exec("ROLLBACK").catch(() => undefined);
    }
  } catch (thrown) {
    return fail({ kind: "database", message: thrown instanceof Error ? thrown.message : String(thrown) });
  } finally {
    await driver.exec(`DROP TABLE IF EXISTS ${landing};`).catch(() => undefined);
  }
}
