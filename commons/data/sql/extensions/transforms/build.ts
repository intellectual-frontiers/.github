// Spec: 0023-sql-transforms FR-004, FR-006, FR-007
/**
 * A build (commons data 0023-sql-transforms): each model made in one transaction with its tests, rolled back where a test of severity error finds a row, so that what was published is still there;
 * the models that read it are not built; each built model is a row of the ledger.
 *
 * @module
 */
import type { Driver } from "@intellectual-frontiers/data/sql/lifecycle";
import type { Model, Project } from "./model.ts";

/** The result of a test that found rows that are wrong. */
export interface Finding {
  readonly model: string;
  readonly test: string;
  readonly kind: string;
  readonly severity: "error" | "warn";
  readonly failing: number;
  readonly sample: readonly Readonly<Record<string, unknown>>[];
}

/** What a build did with one model. */
export interface ModelReport {
  readonly name: string;
  readonly outcome: "built" | "ephemeral" | "failed" | "blocked";
  readonly rows?: number;
  readonly hash: string;
  readonly findings: readonly Finding[];
  readonly error?: string;
  /** The model that stopped it, for one that is blocked. */
  readonly blockedBy?: string;
}

/** What a build did. */
export interface BuildReport {
  /** Whether every model was built (or ephemeral). */
  readonly ok: boolean;
  readonly models: readonly ModelReport[];
}

const plain = (r: Readonly<Record<string, unknown>>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v instanceof Date ? v.toISOString() : v]));

/**
 * Builds a project.
 *
 * @param driver - the database
 * @param project - the project
 * @param only - the models to build; every model that reads them is built too; all where it is not said
 * @returns what the build did
 */
export async function build(driver: Driver, project: Project, only?: readonly string[]): Promise<BuildReport> {
  const { dialect } = project;
  const q = (n: string): string => dialect.quote(n);
  const cascade = dialect.cascade === true ? " CASCADE" : "";
  const dotted = (s: string): string => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).join(".");
  const selected = new Set<string>();
  if (only === undefined) for (const m of project.models) selected.add(m.name);
  else {
    const wanted = new Set(only.map(dotted));
    for (const m of project.models) if (wanted.has(dotted(m.name)) || m.reads.some((r) => [...selected].some((s) => dotted(s) === r))) selected.add(m.name);
  }
  const reports: ModelReport[] = [];
  const bad = new Set<string>();
  const led = project.ledger;
  await driver.exec(
    `CREATE TABLE IF NOT EXISTS ${led.ref} (${q("name")} TEXT NOT NULL, ${q("seq")} INTEGER NOT NULL, ${q("definition_hash")} TEXT NOT NULL, ${q("materialization")} TEXT NOT NULL, ${q("row_count")} INTEGER NOT NULL, ${q("warnings")} INTEGER NOT NULL, PRIMARY KEY (${q("name")}, ${q("seq")}));`,
  );
  const count = async (sql: string): Promise<number> => Number((await driver.query(sql))[0]?.["n"] ?? 0);
  const make = async (m: Model): Promise<void> => {
    switch (m.materialization) {
      case "view":
        await driver.exec(`DROP VIEW IF EXISTS ${m.ref}${cascade};`);
        await driver.exec(`CREATE VIEW ${m.ref} AS\n${m.sql};`);
        return;
      case "table":
        await driver.exec(`DROP TABLE IF EXISTS ${m.ref}${cascade};`);
        await driver.exec(`CREATE TABLE ${m.ref} AS\n${m.sql};`);
        return;
      case "incremental": {
        const probe = dialect.probes?.table(m.table, m.schema);
        if (probe === undefined) throw new Error(`${dialect.name} cannot say whether a table exists`);
        if ((await driver.query(probe)).length === 0) {
          await driver.exec(`CREATE TABLE ${m.ref} AS\n${m.sql};`);
          return;
        }
        const same = m.key.map((k) => `x.${q(k)} = s.${q(k)}`).join(" AND ");
        await driver.exec(`INSERT INTO ${m.ref}\nSELECT * FROM (${m.sql}) AS s WHERE NOT EXISTS (SELECT 1 FROM ${m.ref} AS x WHERE ${same});`);
        return;
      }
      case "ephemeral":
        return;
    }
  };
  for (const m of project.models) {
    if (!selected.has(m.name)) continue;
    const blocker = m.reads.map((r) => project.models.find((x) => dotted(x.name) === r)).find((x) => x !== undefined && bad.has(x.name));
    if (blocker !== undefined) {
      bad.add(m.name);
      reports.push({ name: m.name, outcome: "blocked", hash: m.hash, findings: [], blockedBy: blocker.name });
      continue;
    }
    if (m.materialization === "ephemeral") {
      reports.push({ name: m.name, outcome: "ephemeral", hash: m.hash, findings: [] });
      continue;
    }
    await driver.exec("BEGIN");
    let committed = false;
    try {
      await make(m);
      const findings: Finding[] = [];
      for (const t of m.tests) {
        const failing = await count(`SELECT COUNT(*) AS n FROM (${t.failing}) AS f;`);
        if (failing === 0) continue;
        const sample = (await driver.query(`SELECT * FROM (${t.failing}) AS f LIMIT ${project.settings.sample};`)).map(plain);
        findings.push({ model: m.name, test: t.name, kind: t.kind, severity: t.severity, failing, sample });
      }
      if (findings.some((f) => f.severity === "error")) {
        await driver.exec("ROLLBACK");
        bad.add(m.name);
        reports.push({ name: m.name, outcome: "failed", hash: m.hash, findings });
        continue;
      }
      const rows = await count(`SELECT COUNT(*) AS n FROM ${m.ref};`);
      const seq = await count(`SELECT COALESCE(MAX(${q("seq")}), 0) + 1 AS n FROM ${led.ref} WHERE ${q("name")} = ${dialect.literal(m.name)};`);
      await driver.exec(`INSERT INTO ${led.ref} VALUES (${[dialect.literal(m.name), seq, dialect.literal(m.hash), dialect.literal(m.materialization), rows, findings.length].join(", ")});`);
      await driver.exec("COMMIT");
      committed = true;
      reports.push({ name: m.name, outcome: "built", rows, hash: m.hash, findings });
    } catch (thrown) {
      bad.add(m.name);
      reports.push({ name: m.name, outcome: "failed", hash: m.hash, findings: [], error: thrown instanceof Error ? thrown.message : String(thrown) });
    } finally {
      if (!committed) await driver.exec("ROLLBACK").catch(() => undefined);
    }
  }
  return { ok: reports.every((r) => r.outcome === "built" || r.outcome === "ephemeral"), models: reports };
}
