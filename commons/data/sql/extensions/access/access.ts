// Spec: 0009-sql-features FR-008, FR-009, FR-010
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
import { err, ok } from "@intellectual-frontiers/commons/ts/kernel";
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
}

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
        const test = `${q(col)}::text = current_setting(${dialect.literal(`${prefix}.${scope}`)}, true)`;
        const of = [t.id, column.id, featureId("policy", [...t.name, ...words(scope)])];
        out.push({ group: "policy", sql: `ALTER TABLE ${written.ref(t.id)} ENABLE ROW LEVEL SECURITY;`, of });
        if (settings.viewsSchema !== undefined)
          out.push({ group: "policy", sql: `ALTER TABLE ${written.ref(t.id)} FORCE ROW LEVEL SECURITY;`, of });
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
    return errors.length > 0 ? err(errors) : ok(out);
  };
}

/** The tables of a schema that carry a scope or an access, which an access source acts on. */
export const governedTables = (tables: readonly Table[]): readonly Table[] =>
  tables.filter((t) => carriedOf(t, security.access).length > 0 || t.columns.some((c) => carriedOf(c, security.scope).length > 0));
