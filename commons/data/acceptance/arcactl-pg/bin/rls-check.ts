#!/usr/bin/env bun
// Spec: 0001-arcactl-pg-kit FR-005
/**
 * Runs the row-security scenarios of the UAT kit against YOUR database (commons data 0001-arcactl-pg-kit FR-005): `bun acceptance/arcactl-pg/bin/rls-check.ts [--only S01,S03] [--explain]`. It connects as the superuser of the UAT database (the
 * connection `arcactl` would use: `ARCA_DATABASE_URL`, or libpq's environment) to read the tenants, and as each role of the scenarios (their password is `UAT_PASSWORD`); the seal's key is `ARCA_SEAL_KEY`. Each scenario runs
 * in a transaction that is rolled back. `--explain` prints each scenario's statements and what must come of them, so that a person can run one by hand.
 *
 * @module
 */
import { connect, type Connection } from "../../../sql/cli/connection.ts";
import { resolveTarget, urlOfTarget } from "../../../sql/cli/resolve.ts";
import { subtree } from "../../../sql/cli/scope.ts";
import { report, runScenarios, type Session } from "../scenarios/run.ts";
import { scenarios } from "../scenarios/scenarios.ts";

const env = process.env;
const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1]?.split(",") : undefined;

if (args.includes("--explain")) {
  for (const s of scenarios.filter((x) => only === undefined || only.includes(x.id))) {
    console.log(`${s.id}  ${s.title}\n  who:    ${s.role}\n  run:    ${s.sql}\n  expect: ${s.expect.kind === "error" ? `an error${s.expect.match === "" ? "" : ` (${s.expect.match})`}` : `${s.expect.of} = ${s.expect.values.length === 0 ? "(no rows)" : s.expect.values.join(", ")}`}\n  why:    ${s.why}\n`);
  }
  process.exit(0);
}

const key = env["ARCA_SEAL_KEY"];
const password = env["UAT_PASSWORD"];
if (key === undefined || key === "" || password === undefined || password === "") {
  console.error("rls-check needs ARCA_SEAL_KEY (the seal's key) and UAT_PASSWORD (the password of the uat_* roles): source uat/bin/env first");
  process.exit(2);
}

/** A connection as a role: the URL of the superuser with the role's name and password, or the target libpq's variables and files give (a service wins over the variables, so PGUSER would not do), or the variables alone. */
async function asRole(role: string): Promise<Connection> {
  const url = env["ARCA_DATABASE_URL"];
  if (url !== undefined && url !== "") {
    const u = new URL(url);
    u.username = role;
    u.password = password ?? "";
    return connect({ url: u.toString() });
  }
  const target = resolveTarget(env);
  if (target !== undefined) return connect({ url: urlOfTarget({ ...target, user: role, password }) });
  const before = { user: env["PGUSER"], password: env["PGPASSWORD"] };
  env["PGUSER"] = role;
  env["PGPASSWORD"] = password;
  try {
    return await connect({});
  } finally {
    if (before.user === undefined) delete env["PGUSER"];
    else env["PGUSER"] = before.user;
    if (before.password === undefined) delete env["PGPASSWORD"];
    else env["PGPASSWORD"] = before.password;
  }
}

let admin: Connection;
try {
  admin = await connect(env["ARCA_DATABASE_URL"] === undefined || env["ARCA_DATABASE_URL"] === "" ? {} : { url: env["ARCA_DATABASE_URL"] });
} catch (thrown) {
  console.error(`could not connect as the superuser of the UAT database: ${thrown instanceof Error ? thrown.message.replace(/:[^:@/]*@/, ":***@") : String(thrown)}`);
  process.exit(2);
}
const beneath = new Map<string, readonly string[]>();
for (const root of ["northwind"]) beneath.set(root, await subtree(admin, "data", root));

const open = async (role: string): Promise<Session> => {
  const owned = role === "crm_owner" || role === "superuser";
  const c = owned ? await connect(env["ARCA_DATABASE_URL"] === undefined || env["ARCA_DATABASE_URL"] === "" ? {} : { url: env["ARCA_DATABASE_URL"] }) : await asRole(role);
  if (role === "crm_owner") await c.driver.exec("SET ROLE crm_owner");
  return { exec: (sql) => c.driver.exec(sql), query: (sql) => c.driver.query(sql), close: () => c.close() };
};

try {
  const results = await runScenarios(open, { key, subtree: async (t) => beneath.get(t) ?? [] }, only);
  const r = report(results);
  console.log(r.text);
  process.exit(r.ok ? 0 : 1);
} finally {
  await admin.close();
}
