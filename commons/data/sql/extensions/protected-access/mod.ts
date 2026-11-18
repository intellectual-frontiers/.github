// Spec: 0014-sql-protected-access FR-001
/**
 * The protection layer (commons data 0014-sql-protected-access): the tables in a schema of their own, a view of each in a schema that applications use, and where the engine can enforce it, the
 * rights, the policies and a guard that keep it so. `protection` gives everything a project passes on: the options of `bind`, of `plan` and of `execute`; `protectionExtension` contributes the
 * source and the transform through the engine; `capabilities` says what a dialect can do and what it can only do by convention.
 *
 * @example
 * ```ts
 * const p = protection({ tablesSchema: "data", viewsSchema: "api" });
 * bind(schema, { dialect, ...p.bind });
 * plan(from, schema, { dialect, ...p.desired }, { transforms: p.transforms });
 * execute(plan, driver, dialect, { empty, before: p.session(dialect) });
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import { contribute, defineExtension, type Extension, extensionId, type IdError } from "@intellectual-frontiers/data/engine";
import { type StepTransform, transformPoint } from "@intellectual-frontiers/data/sql/lifecycle";
import { type Dialect, type StatementSource, statementsPoint } from "@intellectual-frontiers/data/sql/physical";
import { enforcement, lacks, migrationSession } from "./guard.ts";
import { type Protection, type ProtectionSettings, settingsOf } from "./settings.ts";
import { protectionSource } from "./source.ts";
import { protectionTransform } from "./transform.ts";

export { enforcement, lacks, migrationSession } from "./guard.ts";
export { defaultSettings, type Enforcement, type Protection, type ProtectionSettings, settingsOf } from "./settings.ts";
export { protectionSource } from "./source.ts";
export { protectionTransform } from "./transform.ts";
export { viewName, viewRef, viewStatements, type ViewTable } from "./view.ts";

/** What a dialect can do for the layer. */
export interface Capabilities {
  /** Whether the layer is enforced (rights, policies, the guard) or a convention. */
  readonly enforced: boolean;
  /** Whether a row can be written through a view. */
  readonly writableViews: boolean;
  /** What a person should know, in words. */
  readonly notes: readonly string[];
}

/**
 * What a dialect can do for the layer, for the settings.
 *
 * @param dialect - the dialect
 * @param given - what a project says of protection
 * @returns the capabilities
 */
export function capabilities(dialect: Dialect, given: ProtectionSettings = {}): Capabilities {
  const settings = settingsOf(given);
  const { enforced } = enforcement(dialect, {
    ...settings,
    enforcement: settings.enforcement === "enforced" ? "auto" : settings.enforcement,
  });
  const writable = dialect.features.includes("updatable-views") || dialect.features.includes("instead-of-triggers");
  const notes: string[] = [];
  if (!enforced)
    notes.push(
      `${dialect.name} ${lacks(dialect).length > 0 ? `has no ${lacks(dialect).join(", ")}, so` : "is set to convention, so"} the schemas and the views are a convention: nothing refuses a direct change`,
    );
  if (!writable) notes.push(`${dialect.name} has read-only views: a row is written to the table`);
  return { enforced, writableViews: writable, notes };
}

/** Everything a project passes on for a set of settings. */
export interface ProtectionKit {
  readonly settings: Protection;
  /** What `bind` is given. */
  readonly bind: { readonly schema: string; readonly sources: readonly StatementSource[] };
  /** What `plan` is given as the desired state. */
  readonly desired: { readonly schema: string; readonly sources: readonly StatementSource[] };
  /** The transforms `plan` is given. */
  readonly transforms: readonly StepTransform[];
  /** The statements `execute` runs at the start of each transaction. */
  session(dialect: Dialect): readonly string[];
}

/**
 * The protection layer for a set of settings.
 *
 * @param given - what a project says of protection
 * @returns what a project passes on
 */
export function protection(given: ProtectionSettings = {}): ProtectionKit {
  const settings = settingsOf(given);
  const source = protectionSource(settings);
  return {
    settings,
    bind: { schema: settings.tablesSchema, sources: [source] },
    desired: { schema: settings.tablesSchema, sources: [source] },
    transforms: [protectionTransform(settings)],
    session: (dialect) => migrationSession(dialect, settings),
  };
}

/**
 * The layer as an extension of the engine, `sql.protected-access`, which contributes its source and its transform.
 *
 * @param given - what a project says of protection
 * @param version - the extension's version
 * @returns the extension, or why its identifier is not one
 */
export function protectionExtension(given: ProtectionSettings = {}, version = "1.0.0"): Result<Extension, IdError> {
  const id = extensionId("sql.protected-access");
  if (id.kind === "err") return err(id.error);
  const kit = protection(given);
  return ok(
    defineExtension({
      id: id.value,
      version,
      contributes: [
        contribute(statementsPoint, kit.bind.sources[0] as StatementSource),
        contribute(transformPoint, kit.transforms[0] as StepTransform),
      ],
    }),
  );
}
