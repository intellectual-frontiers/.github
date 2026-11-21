// Spec: 0001-arcactl-pg-kit FR-009
/**
 * The walk-through on a real PostgreSQL (commons data 0001-arcactl-pg-kit FR-009): where a PostgreSQL server is installed (`initdb`, `pg_ctl` and `psql`), the check makes a cluster of its own in a temporary folder on a free port, and runs
 * the README's steps as a newcomer would, with the real scripts, `psql` and `arcactl` over TCP with passwords: it sets the workstation up with `arcactl init`, makes the roles, the schema and the seed (and the seed again), asks `doctor`,
 * is a reader, a writer, a reseller and an operator in `psql`, runs every scenario, breaks row security and has `doctor` find it, resets, and makes it all again. Where none is installed it says so and passes; with
 * `ACCEPTANCE_REQUIRE_PG=1` it fails instead, for a machine that is meant to have one. DBeaver is a person's.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir, userInfo } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, proves } from "@intellectual-frontiers/test";

const KIT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(KIT, "..", "..");
const BIN = "acceptance/arcactl-pg/bin";

/** The folder that holds `initdb` and `pg_ctl`: on the path, or where the distributions put them. */
function pgBin(): string | undefined {
  const which = spawnSync("bash", ["-c", "command -v initdb"], { encoding: "utf8" }).stdout.trim();
  if (which !== "") return dirname(which);
  for (const root of ["/usr/lib/postgresql", "/usr/local/pgsql", "/opt/homebrew/opt/postgresql@16", "/opt/homebrew/opt/postgresql@17"]) {
    if (!existsSync(root)) continue;
    const direct = join(root, "bin");
    if (existsSync(join(direct, "initdb"))) return direct;
    for (const v of readdirSync(root).toSorted().toReversed()) if (existsSync(join(root, v, "bin", "initdb"))) return join(root, v, "bin");
  }
  return undefined;
}

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => resolve(port));
    });
    s.on("error", reject);
  });

interface Ran {
  readonly out: string;
  readonly status: number;
}

proves(["0001-arcactl-pg-kit FR-009"], "the README's steps run as written on a real PostgreSQL: workstation set up, roles, schema, seed twice, doctor, each person in psql, every scenario, a fault found, reset and again", async () => {
  const bin = pgBin();
  const have = bin !== undefined && spawnSync("bash", ["-c", "command -v psql"]).status === 0;
  if (!have) {
    const say = "no PostgreSQL server (initdb, pg_ctl) and psql installed: the walk-through on a real server is not run";
    if (process.env["ACCEPTANCE_REQUIRE_PG"] === "1") assert(false, say);
    console.log(`acceptance: ${say}`);
    return;
  }
  const root = mkdtempSync(join(tmpdir(), "arcactl-pg-"));
  const asRoot = userInfo().uid === 0;
  // a server does not run as root: the cluster is the `postgres` user's where this is root
  const as = (cmd: string): { readonly file: string; readonly args: string[] } => (asRoot ? { file: "runuser", args: ["-u", "postgres", "--", "bash", "-c", cmd] } : { file: "bash", args: ["-c", cmd] });
  const port = await freePort();
  const data = join(root, "data");
  const sockets = join(root, "sock");
  const home = join(root, "home");
  spawnSync("mkdir", ["-p", sockets, home]);
  writeFileSync(join(root, "pw"), "pgadmin-for-the-check\n");
  if (asRoot) spawnSync("chown", ["-R", "postgres", root]);
  chmodSync(root, 0o755);
  const env = { ...process.env, PATH: `${bin}:${process.env["PATH"] ?? ""}`, HOME: home, SHELL: "/bin/bash", PGSERVICE: "uat", UAT_ENV_FILE: join(root, "env.uat") } as Record<string, string>;
  for (const k of ["PGHOST", "PGPORT", "PGUSER", "PGDATABASE", "PGPASSWORD", "PGOPTIONS", "ARCA_DATABASE_URL"]) delete env[k];
  const sh = (cmd: string, input?: string): Ran => {
    const [c, ...a] = ["bash", "-c", cmd];
    const r = spawnSync(c as string, a, { cwd: DATA, env, input, encoding: "utf8", timeout: 240_000 });
    return { out: `${r.stdout}${r.stderr}`, status: r.status ?? 1 };
  };
  const must = (what: string, r: Ran, ...wants: (string | RegExp)[]): string => {
    // `doctor` exits 1 where it warns (the ledger, here), which is not a failure of the step
    assert(r.status === 0 || (what.includes("doctor") && r.status === 1 && /\b0 failed\b/.test(r.out)), `${what} failed (${r.status}):\n${r.out.slice(-1500)}`);
    for (const w of wants) assert(typeof w === "string" ? r.out.includes(w) : w.test(r.out), `${what}: expected ${String(w)} in:\n${r.out.slice(-1500)}`);
    return r.out;
  };
  try {
    const start = as(`export PATH='${bin}':$PATH; initdb -D '${data}' -U postgres --pwfile='${join(root, "pw")}' --auth-local=trust --auth-host=scram-sha-256 >/dev/null && pg_ctl -D '${data}' -o "-p ${port} -c listen_addresses=127.0.0.1 -c unix_socket_directories='${sockets}'" -w -l '${join(root, "log")}' start >/dev/null`);
    const started = spawnSync(start.file, start.args, { encoding: "utf8", timeout: 120_000 });
    assert(started.status === 0, `the cluster did not start: ${started.stdout}${started.stderr}`);
    const pg = `env -u PGSERVICE PGPASSWORD=pgadmin-for-the-check psql -h 127.0.0.1 -p ${port} -U postgres -d postgres`;
    must("create the database", sh(`${pg} -c 'CREATE DATABASE arca_uat'`), "CREATE DATABASE");
    // step 2: the workstation
    const init = `bun sql/cli/arcactl.ts init --interactive --password-stdin --instance uat --host 127.0.0.1 --port ${port} --database arca_uat --user postgres`;
    must("init --dry-run", sh(`${init} --dry-run`, "pgadmin-for-the-check\n"), `127.0.0.1:${port}:arca_uat:postgres:***`);
    assert(!existsSync(join(home, ".pgpass")), "a dry run writes nothing");
    must("init", sh(`${init} --yes`, "pgadmin-for-the-check\n"), "done      " + join(home, ".pgpass"));
    must("workstation doctor", sh("bun sql/cli/arcactl.ts doctor --scope workstation --interactive"), "6 passed, 0 warned, 0 failed");
    must("the service reaches the database", sh("psql -Atc 'select current_database()'"), "arca_uat");
    // steps 3 to 8
    must("roles", sh(`${BIN}/roles`), "roles: done");
    must("schema", sh(`${BIN}/schema`), "schema: done");
    const doctor = ". acceptance/arcactl-pg/bin/env; arcactl doctor --module acceptance/arcactl-pg/models/crm.ts --schema data --seal";
    must("doctor", sh(doctor), "8 passed, 1 warned, 0 failed", /PASS {2}ARCA-D007[^\n]*\n[^\n]*4 scoped tables/);
    must("seed", sh(`${BIN}/seed`), "seed: done");
    must("seed again", sh(`${BIN}/seed`), "seed: done");
    must("counts", sh(`psql -Atc "SELECT tenant_id || '=' || count(*) FROM data.customer_account GROUP BY tenant_id ORDER BY 1"`), "acme=2\nglobex=2\ninitech=2\nnorthwind=2");
    // step 9: each person in psql
    const as1 = (role: string, scope: string, sql: string): string => must(`${role} ${scope}`, sh(`printf '%s\\n' "${sql}" | ${BIN}/psql-as ${role} ${scope}`));
    assert(/acme-a1[^\n]*\n[^\n]*acme-a2/.test(as1("uat_reader", "--tenant acme", "SELECT account_id FROM api.customer_account ORDER BY 1;")), "a tenant sees its own rows");
    assert(/\n\s+0\n/.test(as1("uat_reader", "", "SELECT count(*) FROM api.customer_account;")), "with no scope, none");
    const forged = as1("uat_reader", "", "SET app.tenant = 'acme'; SELECT count(*) FROM api.customer_account;");
    assert(/\n\s+0\n/.test(forged), "a scope the session wrote itself reaches nothing");
    const writer = sh(`printf '%s\\n' "INSERT INTO api.customer_account VALUES ('globex-a9', 'globex', 'Sneaky', 'active', now());" | ${BIN}/psql-as uat_writer --tenant acme`);
    assert(writer.out.includes("violates row-level security policy"), `a writer cannot write into another tenant:\n${writer.out}`);
    const reseller = as1("uat_reader", "--subtree northwind --schema data", "SELECT DISTINCT tenant_id FROM api.customer_account ORDER BY 1;");
    assert(/acme\n\s+initech\n\s+northwind/.test(reseller) && !reseller.includes("globex"), `a reseller reaches the tenants beneath it:\n${reseller}`);
    const operator = as1("uat_operator", "--all", "SELECT DISTINCT tenant_id FROM api.customer_account ORDER BY 1;");
    assert(/acme\n\s+globex\n\s+initech\n\s+northwind/.test(operator), `an operator reaches every tenant:\n${operator}`);
    // step 12: every scenario
    must("rls-check", sh(`${BIN}/rls-check`), "24 passed, 1 known gap, 0 failed", "GAP   S25");
    // step 13: a fault, found, and repaired
    const refused = sh("psql -c 'ALTER TABLE data.contact DISABLE ROW LEVEL SECURITY'");
    assert(refused.out.includes("is changed only by a migration"), "row security cannot be switched off by accident");
    const fault = (verb: string): string =>
      `. acceptance/arcactl-pg/bin/env; psql -q <<SQL\nSELECT set_config('ifc.ddl_unlock', '$ARCA_UNLOCK_SECRET', false) AS u, set_config('lifecycle.migrating', 'on', false) AS m \\\\gset\nALTER TABLE data.contact ${verb} ROW LEVEL SECURITY;\nSQL`;
    must("plant the fault", sh(fault("NO FORCE")));
    const broken = sh(doctor);
    assert(broken.status === 1 && /FAIL {2}ARCA-D007[^\n]*\n[^\n]*row security is not forced on contact/.test(broken.out), `doctor finds the fault:\n${broken.out}`);
    must("repair", sh(fault("FORCE")));
    must("doctor after the repair", sh(doctor), /PASS {2}ARCA-D007/);
    // step 16 and again
    must("reset", sh(`printf 'yes\\n' | ${BIN}/reset`), "reset: done");
    must("nothing left", sh(`psql -Atc "SELECT (SELECT count(*) FROM pg_namespace WHERE nspname IN ('data','api','ifc_seal')) || ',' || (SELECT count(*) FROM pg_roles WHERE rolname LIKE 'uat\\_%' OR rolname LIKE 'crm\\_%')"`), "0,0");
    must("roles again", sh(`${BIN}/roles`), "roles: done");
    must("schema again", sh(`${BIN}/schema`), "schema: done");
    must("seed again", sh(`${BIN}/seed`), "seed: done");
    must("rls-check again", sh(`${BIN}/rls-check`), "24 passed, 1 known gap, 0 failed");
    must("undo the workstation", sh(`bun sql/cli/arcactl.ts init --interactive --yes --undo`), /done/);
  } finally {
    const stop = as(`export PATH='${bin}':$PATH; pg_ctl -D '${data}' -m immediate stop >/dev/null 2>&1; true`);
    spawnSync(stop.file, stop.args, { timeout: 60_000 });
    rmSync(root, { recursive: true, force: true });
  }
}, { timeout: 600_000 });
