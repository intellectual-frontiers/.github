// Spec: 0008-sql-documentation FR-005
/**
 * The settings of the documentation extensions (commons data 0008-sql-documentation FR-005): a typed value, never a file. The comments are written where the dialect has `COMMENT ON`; the
 * documentation tables where it has none (the default), everywhere, or nowhere; the governance tables everywhere unless they are off. A setting that is not given is its default.
 *
 * @module
 */

/** Whether descriptions are written as `COMMENT ON` where the dialect has it. */
export type CommentsSetting = "dialect" | "never";
/** Where descriptions are also kept in a table. */
export type DocumentationTablesSetting = "when-no-comment" | "always" | "never";
/** Whether what governance says is kept in tables. */
export type GovernanceTablesSetting = "on" | "off";

/** The names of the tables, as governance writes a name (lower camel case); the case style writes them in the database. */
export interface TableNames {
  readonly documentation: string;
  readonly governanceAnnotation: string;
  readonly governanceTrace: string;
}

/** The settings of the three extensions. */
export interface DocumentationSettings {
  readonly comments: CommentsSetting;
  readonly documentationTables: DocumentationTablesSetting;
  readonly governanceTables: GovernanceTablesSetting;
  readonly names: TableNames;
}

/** The defaults: all three on, the documentation tables where there is no `COMMENT ON`. */
export const defaultSettings: DocumentationSettings = {
  comments: "dialect",
  documentationTables: "when-no-comment",
  governanceTables: "on",
  names: { documentation: "documentation", governanceAnnotation: "governanceAnnotation", governanceTrace: "governanceTrace" },
};

/**
 * The settings with what is given over the defaults.
 *
 * @param given - what a project says; the rest is the default
 * @returns the settings
 */
export function settingsOf(
  given: Partial<Omit<DocumentationSettings, "names">> & { readonly names?: Partial<TableNames> } = {},
): DocumentationSettings {
  return {
    comments: given.comments ?? defaultSettings.comments,
    documentationTables: given.documentationTables ?? defaultSettings.documentationTables,
    governanceTables: given.governanceTables ?? defaultSettings.governanceTables,
    names: { ...defaultSettings.names, ...given.names },
  };
}
