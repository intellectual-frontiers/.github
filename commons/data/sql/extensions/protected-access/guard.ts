// Spec: 0014-sql-protected-access FR-005, FR-006, FR-007
/**
 * What makes the layer enforced where the engine can (commons data 0014-sql-protected-access FR-005 to FR-007): the rights taken from everyone on the tables, the right to use the schema of
 * the views given to the roles that governance names, and a guard that refuses to alter or drop a table or a column of the schema of the tables unless the session has said a migration is running.
 *
 * @module
 */
import { vocabularies } from "@intellectual-frontiers/data/governance";
import { carriedOf, type LogicalSchema } from "@intellectual-frontiers/data/sql/logical";
import { type Dialect, featureId, type PhysicalError, qualified, type Statement } from "./deps.ts";
import type { Protection } from "./settings.ts";

const { security } = vocabularies;

/** What a dialect lacks that enforcement needs, or nothing where it can enforce. */
export const lacks = (dialect: Dialect): readonly string[] =>
  (["grants", "row-security", "routines", "schemas"] as const).filter((f) => !dialect.features.includes(f));

/**
 * Whether the layer is enforced on a dialect, or why it cannot be.
 *
 * @param dialect - the dialect
 * @param settings - the settings
 * @returns whether it is enforced, and the error where it was asked for and cannot be
 */
export function enforcement(
  dialect: Dialect,
  settings: Protection,
): { readonly enforced: boolean; readonly errors: readonly PhysicalError[] } {
  const missing = lacks(dialect);
  if (settings.enforcement === "enforced" && missing.length > 0)
    return {
      enforced: false,
      errors: [
        {
          kind: "unsupported",
          element: featureId("policy", ["protection"]),
          why: `${dialect.name} cannot enforce protected access: it has no ${missing.join(", ")}; use convention`,
        },
      ],
    };
  return { enforced: settings.enforcement !== "convention" && missing.length === 0, errors: [] };
}

/** The statements of the rights, in the group of policies. */
export function rights(dialect: Dialect, settings: Protection, schema: LogicalSchema): readonly Statement[] {
  const q = (n: string): string => dialect.quote(n);
  const roles = new Set<string>();
  for (const t of schema.tables) {
    const a = carriedOf(t, security.access)[0];
    for (const r of [...(a?.read ?? []), ...(a?.write ?? [])]) roles.add(r);
  }
  const of = [featureId("policy", ["protection", "rights"])];
  return [
    { group: "policy", sql: `REVOKE ALL ON SCHEMA ${q(settings.tablesSchema)} FROM PUBLIC;`, of },
    { group: "policy", sql: `REVOKE ALL ON ALL TABLES IN SCHEMA ${q(settings.tablesSchema)} FROM PUBLIC;`, of },
    ...(roles.size === 0
      ? []
      : [{ group: "policy" as const, sql: `GRANT USAGE ON SCHEMA ${q(settings.viewsSchema)} TO ${[...roles].map(q).join(", ")};`, of }]),
  ];
}

const TAG = "$ifc_guard$";

/** The statements of the guard: a function and the event triggers that call it. */
export function guard(dialect: Dialect, settings: Protection): readonly Statement[] {
  const q = (n: string): string => dialect.quote(n);
  const fn = qualified(dialect, settings.tablesSchema, "ddl_guard");
  const flag = dialect.literal(settings.migratingSetting);
  const schema = dialect.literal(settings.tablesSchema);
  const body = `DECLARE r record;
BEGIN
    IF coalesce(current_setting(${flag}, true), '') = 'on' THEN RETURN; END IF;
    IF TG_EVENT = 'sql_drop' THEN
        FOR r IN SELECT object_type, schema_name, object_identity FROM pg_event_trigger_dropped_objects() LOOP
            IF (r.schema_name = ${schema} OR r.object_identity LIKE ${dialect.literal(`${settings.tablesSchema}.%`)}) AND r.object_type IN ('table', 'table column') THEN
                RAISE EXCEPTION 'the % % is changed only by a migration', r.object_type, r.object_identity USING HINT = 'run it through the lifecycle';
            END IF;
        END LOOP;
    ELSE
        FOR r IN SELECT object_type, schema_name, object_identity FROM pg_event_trigger_ddl_commands() LOOP
            IF r.schema_name = ${schema} AND r.object_type = 'table' THEN
                RAISE EXCEPTION 'the % % is changed only by a migration', r.object_type, r.object_identity USING HINT = 'run it through the lifecycle';
            END IF;
        END LOOP;
    END IF;
END`;
  const of = [featureId("policy", ["protection", "guard"])];
  return [
    { group: "policy", sql: `CREATE OR REPLACE FUNCTION ${fn}() RETURNS event_trigger LANGUAGE plpgsql AS ${TAG}\n${body}\n${TAG};`, of },
    { group: "policy", sql: `DROP EVENT TRIGGER IF EXISTS ${q("ddl_guard_end")};`, of },
    {
      group: "policy",
      sql: `CREATE EVENT TRIGGER ${q("ddl_guard_end")} ON ddl_command_end WHEN TAG IN ('ALTER TABLE') EXECUTE FUNCTION ${fn}();`,
      of,
    },
    { group: "policy", sql: `DROP EVENT TRIGGER IF EXISTS ${q("ddl_guard_drop")};`, of },
    {
      group: "policy",
      sql: `CREATE EVENT TRIGGER ${q("ddl_guard_drop")} ON sql_drop WHEN TAG IN ('DROP TABLE', 'ALTER TABLE') EXECUTE FUNCTION ${fn}();`,
      of,
    },
  ];
}

/**
 * The statements that tell the guard a migration is running, to be run at the start of each transaction of a plan's run.
 *
 * @param dialect - the dialect
 * @param settings - the settings
 * @returns the statements; none where the layer has no guard
 */
export function migrationSession(dialect: Dialect, settings: Protection): readonly string[] {
  const { enforced } = enforcement(dialect, {
    ...settings,
    enforcement: settings.enforcement === "enforced" ? "auto" : settings.enforcement,
  });
  return enforced && settings.guard ? [`SELECT set_config(${dialect.literal(settings.migratingSetting)}, 'on', true);`] : [];
}
