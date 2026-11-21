// Spec: 0071-uat-kit FR-001, FR-002, FR-003, FR-004, FR-005
/**
 * The UAT kit (commons data 0071-uat-kit): the schema that `arcactl sql` writes for the kit's module with row security, the protected layer and the seal, the roles, the tenants and the seed, and every row-security
 * scenario, on a real PostgreSQL in process (PGlite), through the same code that `arcactl` runs. So the kit cannot go stale while it is only run by hand on someone's machine.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, proves } from "@intellectual-frontiers/test";
import { projectCommand } from "../sql/cli/project.ts";
import { scenarios } from "../uat/scenarios/scenarios.ts";
import { report, runScenarios, type Session } from "../uat/scenarios/run.ts";
import { openEngine } from "./engines-fixture.ts";
import { scopeStatement } from "@intellectual-frontiers/data/sql/extensions/access";

const KIT = join(dirname(fileURLToPath(import.meta.url)), "..", "uat");
const KEY = "uat-seal-key-0123456789abcdef";
const UNLOCK = "uat-unlock-secret";
const PASSWORD = "uat-password";

/** The statements the kit's README has `arcactl sql` write for the example application. */
export const SQL_FLAGS = ["--module", "uat/models/crm.ts", "--schema", "data", "--protect", "crm_owner", "--seal", "--reach", "set", "--wildcard"] as const;

const file = (p: string): string => readFileSync(join(KIT, p), "utf8");

proves(["0071-uat-kit FR-001", "0071-uat-kit FR-002", "0071-uat-kit FR-003", "0071-uat-kit FR-004", "0071-uat-kit FR-005"], "the kit's schema, roles, tenants and seed load on PostgreSQL, and every row-security scenario does what it says, the one gap as a gap", async () => {
  const made = await projectCommand("sql", [...SQL_FLAGS], { cwd: join(KIT, ".."), env: { ARCA_SEAL_KEY: KEY, ARCA_UNLOCK_SECRET: UNLOCK } });
  assert(made.code === 0, made.err);
  const e = await openEngine("postgres");
  try {
    await e.run(file("sql/roles.sql").replace(":'uat_password'", `'${PASSWORD}'`));
    await e.run(made.out);
    await e.run(file("seed/tenants.sql"));
    const issuerSubtree = async (t: string): Promise<readonly string[]> => (await e.rows(`WITH RECURSIVE t(id) AS (SELECT tenant_id FROM "data"."tenant" WHERE tenant_id = '${t}' UNION ALL SELECT c.tenant_id FROM "data"."tenant" c JOIN t ON c.parent_tenant_id = t.id) SELECT id FROM t ORDER BY 1`)).map((r) => String(r["id"]));
    for (const tenant of ["northwind", "acme", "initech", "globex"]) {
      await e.run("SET ROLE uat_writer");
      await e.run(scopeStatement(KEY, "tenant", tenant, "app", false));
      await e.run(file(`seed/${tenant}.sql`));
      await e.run("RESET ROLE; RESET app.tenant");
    }
    const open = async (role: string): Promise<Session> => {
      await e.run("RESET ROLE; RESET app.tenant");
      if (role !== "superuser") await e.run(`SET ROLE ${role}`);
      return { exec: (sql) => e.run(sql), query: (sql) => e.rows(sql), close: () => e.run("RESET ROLE; RESET app.tenant") };
    };
    // the issuer reads the hierarchy as the platform, before any role is taken
    const beneath = new Map<string, readonly string[]>([["northwind", await issuerSubtree("northwind")]]);
    assert(JSON.stringify(beneath.get("northwind")) === JSON.stringify(["acme", "initech", "northwind"]), "the subtree of the reseller");
    const results = await runScenarios(open, { key: KEY, subtree: async (t) => beneath.get(t) ?? [] });
    const r = report(results);
    assert(r.ok, r.text);
    assert(results.length === scenarios.length && results.filter((x) => x.status === "gap").length === 1, "every scenario ran, and one is a known gap");
    // the reset takes it all out, and the schema can be made again (the kit can be run twice)
    await e.run("RESET ROLE; RESET app.tenant");
    await e.run(file("sql/reset.sql").replace(":'unlock'", `'${UNLOCK}'`));
    const left = await e.rows(`SELECT (SELECT count(*) FROM pg_namespace WHERE nspname IN ('data', 'api', 'ifc_seal')) AS schemas, (SELECT count(*) FROM pg_roles WHERE rolname LIKE 'uat\\_%' OR rolname LIKE 'crm\\_%') AS roles`);
    assert(Number(left[0]?.["schemas"]) === 0 && Number(left[0]?.["roles"]) === 0, `the reset left ${JSON.stringify(left)}`);
    await e.run(file("sql/roles.sql").replace(":'uat_password'", `'${PASSWORD}'`));
    await e.run(made.out);
    assert(Number((await e.rows(`SELECT count(*) AS n FROM pg_policies WHERE schemaname = 'data'`))[0]?.["n"]) === 4, "the policies are made again");
  } finally {
    await e.close();
  }
}, { timeout: 120_000 });
