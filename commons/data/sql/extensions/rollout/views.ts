// Spec: 0020-sql-parallel-versions FR-003, FR-004, FR-005, FR-006
/**
 * The views of each live version (commons data 0020-sql-parallel-versions FR-003 to FR-006): a schema of its own for each version, with a view of each of the version's tables under the
 * version's names, over the tables the expanded schema makes. A column the version knows by another name is selected under the version's; a column of another version is not shown.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { vocabularies, words } from "@intellectual-frontiers/data/governance";
import { carriedOf, featureId, type LogicalId, type LogicalSchema } from "@intellectual-frontiers/data/sql/logical";
import { type BindContext, type Dialect, type Naming, type PhysicalError, qualified, type Statement, type StatementSource } from "@intellectual-frontiers/data/sql/physical";
import { matchColumn, matchTable } from "./expand.ts";

const { security } = vocabularies;

/** A live version: its label and the logical schema it was made from. */
export interface LiveVersion {
  readonly label: string;
  readonly schema: LogicalSchema;
}

/** What a project says of the overlap; what is not said is the default. */
export interface RolloutSettings {
  /** The name of a version's schema, with `{label}` where the label goes; `api_{label}` by default. */
  readonly pattern?: string;
  /** The label of the version whose views the protection layer makes, which are not made here. */
  readonly primary?: string;
  /** Whether the roles governance names are granted on a version's views; `on` by default. */
  readonly grants?: "on" | "off";
}

/** The settings with every default filled. */
export interface Rollout {
  readonly pattern: string;
  readonly primary: string | undefined;
  readonly grants: boolean;
}

/** The settings with a project's changes. */
export const settingsOf = (given: RolloutSettings = {}): Rollout => ({ pattern: given.pattern ?? "api_{label}", primary: given.primary, grants: (given.grants ?? "on") === "on" });

/** The name of a version's schema. */
export const schemaOf = (label: string, settings: Rollout): string => settings.pattern.replaceAll("{label}", label);

function name(dialect: Dialect, naming: Naming, label: string, tableWords: readonly string[], settings: Rollout): { readonly view: string; readonly bare: string } {
  const bare = naming.names.write(tableWords);
  return dialect.features.includes("schemas")
    ? { view: qualified(dialect, schemaOf(label, settings), bare), bare }
    : { view: dialect.quote(`${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${bare}`), bare };
}

/**
 * The source of the views of the live versions.
 *
 * @param versions - the live versions, oldest first
 * @param given - what a project says
 * @returns a statement source
 */
export function versionViews(versions: readonly LiveVersion[], given: RolloutSettings = {}): StatementSource {
  const settings = settingsOf(given);
  return (context: BindContext) => {
    const { dialect, naming, schema, written } = context;
    const q = dialect.quote;
    const errors: PhysicalError[] = [];
    const out: Statement[] = [];
    for (const v of versions) {
      if (v.label === settings.primary) continue;
      if (dialect.features.includes("schemas")) out.push({ group: "setup", sql: `CREATE SCHEMA IF NOT EXISTS ${q(schemaOf(v.label, settings))};`, of: [] });
      for (const t of v.schema.tables) {
        const phys = matchTable({ ...schema, tables: schema.tables }, t) ?? schema.tables.find((x) => matchTable({ ...v.schema, tables: [t] }, x) !== undefined);
        if (phys === undefined) {
          errors.push({ kind: "unsupported", element: featureId("view", t.name), why: `version ${v.label} has a table ${naming.names.write(t.name)} that the tables do not hold` });
          continue;
        }
        const select: string[] = [];
        const of: LogicalId[] = [phys.id, featureId("view", [...words(v.label), ...t.name])];
        for (const c of t.columns) {
          const p = matchColumn(phys, c);
          const vn = naming.names.write(c.name);
          if (p === undefined) {
            errors.push({ kind: "unsupported", element: c.id, why: `version ${v.label} has a column ${naming.names.write(t.name)}.${vn} that the tables do not hold` });
            continue;
          }
          const pn = written.column(p.id) ?? "";
          select.push(pn === vn ? q(pn) : `${q(pn)} AS ${q(vn)}`);
          of.push(p.id);
        }
        // a view in a schema of its own would otherwise read its own name, where the engine looks first in the view's schema
        const base = (ref: string): string => (dialect.features.includes("schemas") && !ref.includes(".") ? `${q(dialect.name === "postgres" ? "public" : "main")}.${ref}` : ref);
        const n = name(dialect, naming, v.label, t.name, settings);
        const add = (sql: string): void => void out.push({ group: "view", sql, of });
        add(`DROP VIEW IF EXISTS ${n.view};`);
        add(`CREATE VIEW ${n.view}${dialect.features.includes("updatable-views") ? " WITH (security_barrier = true)" : ""} AS\nSELECT ${select.join(", ")}\n  FROM ${base(written.ref(phys.id))};`);
        const roles = settings.grants && dialect.features.includes("grants") ? carriedOf(t, security.access)[0] : undefined;
        if (roles !== undefined) {
          if (roles.read.length > 0) add(`GRANT SELECT ON ${n.view} TO ${roles.read.map(q).join(", ")};`);
          if (roles.write.length > 0) add(`GRANT INSERT, UPDATE, DELETE ON ${n.view} TO ${roles.write.map(q).join(", ")};`);
        }
      }
    }
    return errors.length > 0 ? err(errors) : ok(out);
  };
}

/**
 * The statements that retire a version: its schema is dropped, or its views where the dialect has no schemas.
 *
 * @param version - the version
 * @param dialect - the dialect
 * @param naming - the case styles
 * @param given - what a project says
 * @returns the statements, safe to run twice
 */
export function retireStatements(version: LiveVersion, dialect: Dialect, naming: Naming, given: RolloutSettings = {}): readonly string[] {
  const settings = settingsOf(given);
  if (dialect.features.includes("schemas")) return [`DROP SCHEMA IF EXISTS ${dialect.quote(schemaOf(version.label, settings))} CASCADE;`];
  return version.schema.tables.map((t) => `DROP VIEW IF EXISTS ${name(dialect, naming, version.label, t.name, settings).view};`);
}
