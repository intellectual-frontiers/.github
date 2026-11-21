// Spec: 0046-arcactl FR-012
/**
 * `arcactl scope` (commons data 0046-arcactl FR-012): the statement that sets a sealed scope, made by the issuer that holds the key. A policy of a sealed table trusts a scope only with its mark (0009-sql-features FR-019), so a
 * person at `psql` or DBeaver, or a service that has authenticated a caller, cannot simply `SET` a tenant: they run what this prints. `--tenant a,b` is a list of tenants (reach `set`), `--subtree T` is a tenant and every tenant
 * beneath it, read from the tenant table (the one command of this file that connects), and `--all` is the wildcard of a platform operator. The key is read from `ARCA_SEAL_KEY` (or the file `ARCA_SEAL_KEY_FILE` names) and is never an
 * argument; what is printed holds a mark, never the key.
 *
 * @module
 */
import { grantOf, scopeStatement } from "@intellectual-frontiers/data/sql/extensions/access";
import { type Connection, connect as realConnect, type ConnectOptions } from "./connection.ts";
import type { Io, Outcome } from "./main.ts";
import { passwordOf, redact } from "./redact.ts";
import { secretOf } from "./server.ts";

const flag = (argv: readonly string[], name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

/** The usage of `arcactl scope`, shown with a refusal. */
export const SCOPE_USAGE = `usage: arcactl scope (--tenant ID[,ID...] | --subtree ID | --all) [--name tenant] [--prefix app] [--local] [--schema arca] [--json]

  --tenant a,b     the tenants the scope reaches (one is the plain scope of a tenant)
  --subtree T      the tenant T and every tenant beneath it, read from the tenant table (connects: ARCA_DATABASE_URL or libpq's environment)
  --all            every tenant: the wildcard of a platform operator (the policies must have been made with --reach set --wildcard)
  --name <n>       the scope's name, as in security.scope (default tenant)
  --prefix <p>     the prefix of the setting (default app)
  --local          for the transaction only (default: the session, which is what a tool in autocommit needs)
  --schema <s>     the schema of the tenant table, for --subtree (default arca)
  --json           machine-readable output

The key comes from ARCA_SEAL_KEY (or ARCA_SEAL_KEY_FILE), never from an argument.`;

/** The connection URL of the environment, where it has one. */
function envUrl(io: Io): string | undefined {
  const r = secretOf(io.env, "ARCA_DATABASE_URL", io.read);
  return r.kind === "ok" ? r.value : undefined;
}

/** The tenants of a subtree: the tenant and every tenant beneath it, by the `parent` relationship of the tenancy model. */
export async function subtree(connection: Connection, schema: string, root: string): Promise<readonly string[]> {
  const lit = (s: string): string => `'${s.replaceAll("'", "''")}'`;
  const tenant = `"${schema.replaceAll('"', '""')}"."tenant"`;
  const rows = await connection.driver.query(
    `WITH RECURSIVE t(tenant_id) AS (SELECT tenant_id FROM ${tenant} WHERE tenant_id = ${lit(root)} UNION ALL SELECT c.tenant_id FROM ${tenant} c JOIN t ON c.parent_tenant_id = t.tenant_id) SELECT tenant_id FROM t ORDER BY 1`,
  );
  return rows.map((r) => String(r["tenant_id"]));
}

/**
 * Runs `arcactl scope`.
 *
 * @param given - the arguments after the command
 * @param io - the environment, and how a connection is made
 */
export async function scopeCommand(given: readonly string[], io: Io): Promise<Outcome> {
  const fail = (m: string, code: 1 | 2 = 2): Outcome => ({ code, out: "", err: `${m}\n` });
  const key = secretOf(io.env, "ARCA_SEAL_KEY", io.read);
  if (key.kind === "err") return fail(key.error);
  if (key.value === undefined || key.value === "") return fail("the key of the seal is in ARCA_SEAL_KEY (or the file ARCA_SEAL_KEY_FILE names): it is never an argument");
  const tenant = flag(given, "--tenant");
  const root = flag(given, "--subtree");
  const all = given.includes("--all");
  if ([tenant !== undefined, root !== undefined, all].filter(Boolean).length !== 1) return fail(`name what the scope reaches: exactly one of --tenant, --subtree or --all\n\n${SCOPE_USAGE}`);
  const name = flag(given, "--name") ?? "tenant";
  const prefix = flag(given, "--prefix") ?? "app";
  if (!/^[a-z][a-z0-9_]*$/.test(name) || !/^[a-z][a-z0-9_]*$/.test(prefix)) return fail("--name and --prefix are lower-case names");
  const schema = flag(given, "--schema") ?? "arca";
  let values: readonly string[] | "*";
  if (all) values = "*";
  else if (tenant !== undefined) values = tenant.split(",").map((t) => t.trim()).filter((t) => t !== "");
  else {
    const url = flag(given, "--url") ?? envUrl(io);
    const secrets = [passwordOf(url), io.env["PGPASSWORD"]].filter((s): s is string => s !== undefined);
    let connection: Connection;
    try {
      const o: ConnectOptions = url === undefined ? {} : { url };
      connection = await (io.connect ?? realConnect)(o);
    } catch (thrown) {
      return fail(redact(`could not connect to read the tenants: ${thrown instanceof Error ? thrown.message : String(thrown)}`, secrets));
    }
    try {
      values = await subtree(connection, schema, root ?? "");
    } catch (thrown) {
      return fail(redact(`could not read the tenants of ${schema}: ${thrown instanceof Error ? thrown.message : String(thrown)}`, secrets), 1);
    } finally {
      await connection.close();
    }
    if (values.length === 0) return fail(`there is no tenant ${root}`, 1);
  }
  let grant: string;
  try {
    grant = grantOf(values);
  } catch (thrown) {
    return fail(thrown instanceof Error ? thrown.message : String(thrown));
  }
  const local = given.includes("--local");
  const statement = scopeStatement(key.value, name, grant, prefix, local);
  const reaches = values === "*" ? "every tenant" : `${values.length} tenant${values.length === 1 ? "" : "s"}: ${values.join(", ")}`;
  if (given.includes("--json")) return { code: 0, out: `${JSON.stringify({ name, prefix, local, reaches: values, statement }, null, 2)}\n`, err: "" };
  return { code: 0, out: `${statement}\n`, err: `scope ${prefix}.${name} reaching ${reaches}${local ? " (this transaction)" : " (this session)"}\n` };
}

