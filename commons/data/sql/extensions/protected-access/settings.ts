// Spec: 0014-sql-protected-access FR-001
/**
 * The settings of the protection layer (commons data 0014-sql-protected-access FR-001): what a project says of the schema of its tables and of its views, how far the layer is enforced, whether
 * it guards the tables against a change outside a migration, whether it hides what governance says is to be hidden, and which roles see it as it is. Every one has a default.
 *
 * @module
 */

/** How far the layer is enforced: `auto` enforces where the dialect can and is a convention where it cannot. */
export type Enforcement = "auto" | "enforced" | "convention";

/** What a project says of protection; what is not said is the default. */
export interface ProtectionSettings {
  /** The schema the tables are in; `data` by default. */
  readonly tablesSchema?: string;
  /** The schema the views are in; `api` by default. */
  readonly viewsSchema?: string;
  /** `auto` (the default), `enforced` or `convention`. */
  readonly enforcement?: Enforcement;
  /** Whether a table is guarded against a change outside a migration; `on` by default. */
  readonly guard?: "on" | "off";
  /** Whether what governance says is to be hidden (`security.mask`) is hidden in the views; `on` by default. */
  readonly masks?: "on" | "off";
  /** The roles that see a masked value as it is; none by default. */
  readonly unmaskedRoles?: readonly string[];
  /** The setting a migration sets to tell the guard it is one; `lifecycle.migrating` by default. */
  readonly migratingSetting?: string;
  /** A secret that seals the flag: the guard then holds only its hash and a migration sets the secret, so that a session that does not know it cannot say it is a migration; without one, `on` says so and any session can. */
  readonly migratingSecret?: string;
  /** The role that owns the schemas, the tables and the views, so that a view runs with its rights and row-level security applies to it; none by default, which leaves ownership to whoever runs the plan. */
  readonly owner?: string;
}

/** The settings with every default filled. */
export interface Protection {
  readonly tablesSchema: string;
  readonly viewsSchema: string;
  readonly enforcement: Enforcement;
  readonly guard: boolean;
  readonly masks: boolean;
  readonly unmaskedRoles: readonly string[];
  readonly migratingSetting: string;
  readonly migratingSecret: string | undefined;
  readonly owner: string | undefined;
}

/** The defaults. */
export const defaultSettings: Protection = {
  tablesSchema: "data",
  viewsSchema: "api",
  enforcement: "auto",
  guard: true,
  masks: true,
  unmaskedRoles: [],
  migratingSetting: "lifecycle.migrating",
  migratingSecret: undefined,
  owner: undefined,
};

/**
 * The settings with a project's changes.
 *
 * @param given - what a project says
 * @returns every setting
 */
export function settingsOf(given: ProtectionSettings = {}): Protection {
  return {
    tablesSchema: given.tablesSchema ?? defaultSettings.tablesSchema,
    viewsSchema: given.viewsSchema ?? defaultSettings.viewsSchema,
    enforcement: given.enforcement ?? defaultSettings.enforcement,
    guard: (given.guard ?? "on") === "on",
    masks: (given.masks ?? "on") === "on",
    unmaskedRoles: given.unmaskedRoles ?? defaultSettings.unmaskedRoles,
    migratingSetting: given.migratingSetting ?? defaultSettings.migratingSetting,
    migratingSecret: given.migratingSecret,
    owner: given.owner,
  };
}
