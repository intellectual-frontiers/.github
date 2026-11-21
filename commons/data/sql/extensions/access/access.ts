// Spec: 0009-sql-features FR-008, FR-009, FR-010, FR-019, FR-020
/**
 * Access (commons data 0009-sql-features FR-008 to FR-010): what governance says of who may see what becomes what the engine enforces. A column that carries `security.scope` makes its table's
 * rows visible only where the column equals the setting of the scope; a concept that carries `security.access` grants its read roles `SELECT` and its write roles `INSERT`, `UPDATE` and
 * `DELETE`, and, where the table is scoped, gives each of them a policy for what they may do. A dialect without the feature gets nothing, and the annotation stays in the governance tables.
 *
 * @remarks
 * The policy reads `current_setting('<prefix>.<scope>', true)` and compares it with the column as text, which is PostgreSQL's way; no other dialect has `row-security` yet.
 *
 * @module
 */
import { createHash } from "node:crypto";
import { err, ok } from "@intellectual-frontiers/core";
import { vocabularies, words } from "@intellectual-frontiers/data/governance";
import { carriedOf, featureId, type LogicalId, type Table } from "@intellectual-frontiers/data/sql/logical";
import {
  type BindContext,
  type PhysicalError,
  qualified,
  type Statement,
  type StatementSource,
} from "@intellectual-frontiers/data/sql/physical";

/** What a project says of access; what is not said is the default. */
export interface AccessSettings {
  /** What to do where the dialect lacks the feature: `carry` writes nothing and leaves the annotation to the governance tables (the default), `error` returns an error value. */
  readonly unsupported?: "carry" | "error";
  /** The prefix of the settings a policy reads; `app` by default. */
  readonly settingPrefix?: string;
  /** Set where the tables are wrapped by views (0014-sql-protected-access): the rights are then the views' to grant, so none is granted here, and a table with a scope has one policy that names no role, forced on its owner. */
  readonly viewsSchema?: string;
  /**
   * Seals the scope (0009-sql-features FR-019, PostgreSQL): a policy trusts the setting of a scope only where it carries the mark that only a holder of `key` can make, so that a session of the
   * application, or a statement injected into it, cannot set the scope to another tenant's. The key is kept in a table that no role but the deployer's can read; the issuer of the scope
   * (the service that has authenticated the caller) makes the mark with `sealedScope`. Row security is forced on the tables' owners and a guard refuses to disable it, or drop a policy or a table of it unless the session holds the secret whose hash is `unlock`.
   */
  readonly seal?: { readonly key: string; readonly unlock?: string };
  /**
   * How far a scope reaches (0009-sql-features FR-020, PostgreSQL). `exact`, the default, shows a row where its scope column equals the setting. `set` reads the setting as a list of values, separated by commas
   * (`acme,acme-eu`), and shows a row where its column is one of them: a reseller reaches the tenants beneath it, a support role the few it is asked to help, and the issuer of the scope (which has
   * authenticated the caller and knows the hierarchy) decides which. With `wildcard`, the value `*` reaches every row, for a platform operator. A reach is only as trustworthy as the scope: seal it.
   */
  readonly reach?: "exact" | "set";
  /** With `reach: "set"`, whether the value `*` reaches every row; off by default. */
  readonly wildcard?: boolean;
}

const sealed = (key: string, msg: string): string => {
  const inner = createHash("sha256").update(key, "utf8").update(msg, "utf8").digest();
  return createHash("sha256").update(key, "utf8").update(inner).digest("hex");
};

/** The value to give a sealed scope setting: the value and its mark, made by the issuer that holds the key. */
export const sealedScope = (key: string, name: string, value: string): string => `${value}.${sealed(key, `${name}=${value}`)}`;

/** What a scope of a set reaches: the tenants, or every one (`*`). A value with a comma in it cannot be listed, since the comma is what separates them. */
export function grantOf(values: readonly string[] | "*"): string {
  if (values === "*") return "*";
  if (values.length === 0) throw new Error("a scope that reaches nothing is no scope: leave it unset");
  for (const v of values) if (v === "" || v.includes(",") || v === "*") throw new Error(`a scope value cannot be empty, hold a comma or be *: ${JSON.stringify(v)}`);
  return [...values].join(",");
}

/** The statement that sets a sealed scope for the transaction (or, where `local` is false, the session) that runs it. */
export const scopeStatement = (key: string, name: string, value: string, prefix = "app", local = true): string =>
  `SELECT set_config('${`${prefix}.${name}`.replaceAll("'", "''")}', '${sealedScope(key, name, value).replaceAll("'", "''")}', ${local ? "true" : "false"});`;

const { security } = vocabularies;

/**
 * The source of row-level security and grants.
 *
 * @param settings - what a project says of access
 * @returns a statement source
 */
export function accessSource(settings: AccessSettings = {}): StatementSource {
  const prefix = settings.settingPrefix ?? "app";
  const onUnsupported = settings.unsupported ?? "carry";
  return (context: BindContext) => {
    const { schema, dialect, written, naming } = context;
    const q = (n: string): string => dialect.quote(n);
    const errors: PhysicalError[] = [];
    const out: Statement[] = [];
    const usage = new Set<string>();
    const target = (t: Table): string =>
      settings.viewsSchema === undefined
        ? written.ref(t.id)
        : qualified(dialect, dialect.features.includes("schemas") ? settings.viewsSchema : undefined, naming.names.write(t.name));
    const canPolicy = dialect.features.includes("row-security");
    const canGrant = dialect.features.includes("grants");
    const seal = canPolicy && dialect.name === "postgres" ? settings.seal : undefined;
    if (seal !== undefined && schema.tables.some((t) => t.columns.some((c) => carriedOf(c, security.scope).length > 0)))
      out.push(...sealInfrastructure(dialect.literal, seal, prefix));
    for (const t of schema.tables) {
      const table = written.table(t.id);
      if (table === undefined) continue;
      const scoped = t.columns.flatMap((c) => {
        const s = carriedOf(c, security.scope)[0];
        return s === undefined ? [] : [{ column: c, scope: s.name }];
      });
      const roles = carriedOf(t, security.access)[0];
      const refuse = (what: string): void =>
        void errors.push({ kind: "unsupported", element: t.id, why: `${dialect.name} cannot enforce ${what} of ${table}` });
      const policyName = (scope: string, op: string): string => {
        const name = naming.names.write([...t.name, ...words(scope), op]);
        if (name.length > dialect.maxName) errors.push({ kind: "length", element: t.id, name, max: dialect.maxName });
        return name;
      };
      const list = (rs: readonly string[]): string => rs.map(q).join(", ");
      if (roles !== undefined && settings.viewsSchema === undefined) {
        if (!canGrant) {
          if (onUnsupported === "error") refuse("its access (security.access)");
        } else {
          const of: LogicalId[] = [t.id];
          for (const r of [...roles.read, ...roles.write]) usage.add(r);
          if (roles.read.length > 0) out.push({ group: "policy", sql: `GRANT SELECT ON ${target(t)} TO ${list(roles.read)};`, of });
          if (roles.write.length > 0)
            out.push({ group: "policy", sql: `GRANT INSERT, UPDATE, DELETE ON ${target(t)} TO ${list(roles.write)};`, of });
        }
      }
      for (const { column, scope } of scoped) {
        if (!canPolicy) {
          if (onUnsupported === "error") refuse(`its scope ${scope} (security.scope)`);
          continue;
        }
        const col = written.column(column.id);
        if (col === undefined) continue;
        const setting = seal === undefined ? `current_setting(${dialect.literal(`${prefix}.${scope}`)}, true)` : `${SEAL}.scope(${dialect.literal(scope)})`;
        const test = settings.reach !== "set"
          ? `${q(col)}::text = ${setting}`
          : `${q(col)}::text = ANY (string_to_array(${setting}, ','))${settings.wildcard === true ? ` OR ${setting} = '*'` : ""}`;
        const of = [t.id, column.id, featureId("policy", [...t.name, ...words(scope)])];
        out.push({ group: "policy", sql: `ALTER TABLE ${written.ref(t.id)} ENABLE ROW LEVEL SECURITY;`, of });
        if (settings.viewsSchema !== undefined || seal !== undefined)
          out.push({ group: "policy", sql: `ALTER TABLE ${written.ref(t.id)} FORCE ROW LEVEL SECURITY;`, of });
        if (seal !== undefined)
          out.push({ group: "policy", sql: `INSERT INTO ${SEAL}.tables (reg) VALUES (${dialect.literal(written.ref(t.id))}::regclass) ON CONFLICT DO NOTHING;`, of });
        const policy = (op: string, kind: string, to: readonly string[], using: boolean, check: boolean): void => {
          const name = policyName(scope, op);
          out.push({ group: "policy", sql: `DROP POLICY IF EXISTS ${q(name)} ON ${written.ref(t.id)};`, of });
          out.push({
            group: "policy",
            sql: `CREATE POLICY ${q(name)} ON ${written.ref(t.id)} FOR ${kind}${to.length === 0 ? "" : ` TO ${list(to)}`}${using ? ` USING (${test})` : ""}${check ? ` WITH CHECK (${test})` : ""};`,
            of,
          });
        };
        if (roles === undefined || settings.viewsSchema !== undefined) policy("all", "ALL", [], true, true);
        else {
          if (roles.read.length > 0) policy("select", "SELECT", roles.read, true, false);
          if (roles.write.length > 0) {
            policy("insert", "INSERT", roles.write, false, true);
            policy("update", "UPDATE", roles.write, true, true);
            policy("delete", "DELETE", roles.write, true, false);
          }
        }
      }
    }
    if (settings.viewsSchema !== undefined && usage.size > 0 && canGrant && dialect.features.includes("schemas"))
      out.push({ group: "policy", sql: `GRANT USAGE ON SCHEMA ${q(settings.viewsSchema)} TO ${[...usage].map(q).join(", ")};`, of: [] });
    if (seal !== undefined && out.some((x) => x.sql.includes(`${SEAL}.tables`))) out.push(...sealGuard(dialect.literal, seal.unlock));
    return errors.length > 0 ? err(errors) : ok(out);
  };
}

const SEAL = "ifc_seal";

/** The key, its mark and the function a policy calls: the key is in a table that no role but its owner can read, and the function that reads it runs as its owner. */
function sealInfrastructure(lit: (s: string) => string, seal: { readonly key: string }, prefix: string): Statement[] {
  const of: LogicalId[] = [];
  const s = (sql: string): Statement => ({ group: "policy", sql, of });
  const mac = `encode(sha256(convert_to((SELECT secret FROM ${SEAL}.key), 'UTF8') || sha256(convert_to((SELECT secret FROM ${SEAL}.key) || msg, 'UTF8'))), 'hex')`;
  return [
    s(`CREATE SCHEMA IF NOT EXISTS ${SEAL};`),
    s(`CREATE TABLE IF NOT EXISTS ${SEAL}.key (id boolean PRIMARY KEY DEFAULT true CHECK (id), secret text NOT NULL);`),
    s(`CREATE TABLE IF NOT EXISTS ${SEAL}.tables (reg regclass PRIMARY KEY);`),
    s(`INSERT INTO ${SEAL}.key (id, secret) VALUES (true, ${lit(seal.key)}) ON CONFLICT (id) DO UPDATE SET secret = EXCLUDED.secret;`),
    s(`REVOKE ALL ON ${SEAL}.key, ${SEAL}.tables FROM PUBLIC;`),
    s(`CREATE OR REPLACE FUNCTION ${SEAL}.mac(msg text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $m$ SELECT ${mac} $m$;`),
    s(`REVOKE ALL ON FUNCTION ${SEAL}.mac(text) FROM PUBLIC;`),
    s(
      `CREATE OR REPLACE FUNCTION ${SEAL}.scope(name text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $m$ SELECT CASE WHEN v IS NOT NULL AND length(v) > 65 AND right(v, 64) = ${SEAL}.mac(name || '=' || left(v, length(v) - 65)) THEN left(v, length(v) - 65) END FROM (SELECT current_setting(${lit(`${prefix}.`)} || name, true) AS v) s $m$;`,
    ),
    s(`GRANT USAGE ON SCHEMA ${SEAL} TO PUBLIC;`),
    s(`GRANT EXECUTE ON FUNCTION ${SEAL}.scope(text) TO PUBLIC;`),
  ];
}

/** The guard of a sealed scope: row security stays on and forced, no policy of a sealed table and no sealed table is dropped. */
function sealGuard(lit: (s: string) => string, unlock: string | undefined): Statement[] {
  const of: LogicalId[] = [];
  const s = (sql: string): Statement => ({ group: "policy", sql, of });
  const open = unlock === undefined ? "FALSE" : `encode(sha256(convert_to(coalesce(current_setting('ifc.ddl_unlock', true), ''), 'UTF8')), 'hex') = ${lit(unlock)}`;
  const gone = `EXISTS (SELECT 1 FROM ${SEAL}.tables t JOIN pg_class c ON c.oid = t.reg JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = (o.address_names)[1] AND c.relname = (o.address_names)[2])`;
  return [
    s(
      `CREATE OR REPLACE FUNCTION ${SEAL}.guard_drop() RETURNS event_trigger LANGUAGE plpgsql AS $g$
DECLARE o record;
BEGIN
  IF ${open} THEN RETURN; END IF;
  FOR o IN SELECT object_type, object_identity, address_names, objid FROM pg_event_trigger_dropped_objects() LOOP
    IF o.object_type = 'policy' AND ${gone} THEN RAISE EXCEPTION 'a policy of a sealed table cannot be dropped: %', o.object_identity USING ERRCODE = 'insufficient_privilege'; END IF;
    IF o.object_type = 'table' AND EXISTS (SELECT 1 FROM ${SEAL}.tables t WHERE t.reg::oid = o.objid) THEN RAISE EXCEPTION 'a sealed table cannot be dropped: %', o.object_identity USING ERRCODE = 'insufficient_privilege'; END IF;
  END LOOP;
END
$g$;`,
    ),
    s(
      `CREATE OR REPLACE FUNCTION ${SEAL}.guard_end() RETURNS event_trigger LANGUAGE plpgsql AS $g$
DECLARE o record;
BEGIN
  IF ${open} THEN RETURN; END IF;
  FOR o IN SELECT objid, command_tag FROM pg_event_trigger_ddl_commands() LOOP
    IF o.command_tag IN ('ALTER TABLE', 'ALTER POLICY') AND EXISTS (SELECT 1 FROM pg_class c JOIN ${SEAL}.tables t ON t.reg = c.oid WHERE c.oid = o.objid AND NOT (c.relrowsecurity AND c.relforcerowsecurity)) THEN
      RAISE EXCEPTION 'row security of a sealed table cannot be weakened' USING ERRCODE = 'insufficient_privilege';
    END IF;
  END LOOP;
END
$g$;`,
    ),
    s(`DROP EVENT TRIGGER IF EXISTS ${SEAL}_guard_drop;`),
    s(`CREATE EVENT TRIGGER ${SEAL}_guard_drop ON sql_drop WHEN TAG IN ('DROP POLICY', 'DROP TABLE', 'DROP SCHEMA') EXECUTE FUNCTION ${SEAL}.guard_drop();`),
    s(`DROP EVENT TRIGGER IF EXISTS ${SEAL}_guard_end;`),
    s(`CREATE EVENT TRIGGER ${SEAL}_guard_end ON ddl_command_end WHEN TAG IN ('ALTER TABLE', 'ALTER POLICY') EXECUTE FUNCTION ${SEAL}.guard_end();`),
  ];
}

/** The tables of a schema that carry a scope or an access, which an access source acts on. */
export const governedTables = (tables: readonly Table[]): readonly Table[] =>
  tables.filter((t) => carriedOf(t, security.access).length > 0 || t.columns.some((c) => carriedOf(c, security.scope).length > 0));
