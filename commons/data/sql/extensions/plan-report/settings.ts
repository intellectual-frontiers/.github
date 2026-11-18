// Spec: 0016-sql-plan-report FR-009
/**
 * The settings of the plan report (commons data 0016-sql-plan-report FR-009): the roles that have to approve a step that touches personal data, a restricted element, or is destructive or written by a
 * person, and whether the steward of what a step touches is routed to. Each has a default.
 *
 * @module
 */

/** What a project says of the report; what is not said is the default. */
export interface ReportSettings {
  /** The role that approves a step that touches personal data; `privacy` by default. */
  readonly personalRole?: string;
  /** The role that approves a step that touches a restricted element; `security` by default. */
  readonly restrictedRole?: string;
  /** The role that approves a destructive step or one a person wrote; `owner` by default. */
  readonly destructiveRole?: string;
  /** Whether the steward (or the owner) of what a step touches is routed to; `on` by default. */
  readonly steward?: "on" | "off";
  /** The table the report is recorded in; `governance_migration` by default. */
  readonly table?: string;
}

/** The settings with every default filled. */
export interface Report {
  readonly personalRole: string;
  readonly restrictedRole: string;
  readonly destructiveRole: string;
  readonly steward: boolean;
  readonly table: string;
}

/**
 * The settings with a project's changes.
 *
 * @param given - what a project says
 * @returns every setting
 */
export const settingsOf = (given: ReportSettings = {}): Report => ({
  personalRole: given.personalRole ?? "privacy",
  restrictedRole: given.restrictedRole ?? "security",
  destructiveRole: given.destructiveRole ?? "owner",
  steward: (given.steward ?? "on") === "on",
  table: given.table ?? "governance_migration",
});
