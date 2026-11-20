// Spec: 0008-sql-documentation FR-005, FR-006
/**
 * The documentation extensions (commons data 0008-sql-documentation): the comments, the documentation tables and the governance tables, three extensions that each contribute a statement source to
 * the physical schema, all on by default. `defaultDocumentation` is the three, which a project drops from or replaces in; `documentationSources` gives the same sources where the engine is not
 * used; the settings say where each is on.
 *
 * @example
 * ```ts
 * import { bind } from "@intellectual-frontiers/data/sql/physical";
 * import { documentationSources } from "@intellectual-frontiers/data/sql/extensions/documentation";
 * bind(schema, { dialect, sources: documentationSources() });
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { contribute, defineExtension, type Extension, extensionId, type IdError } from "@intellectual-frontiers/data/engine";
import { statementsPoint, type StatementSource } from "@intellectual-frontiers/data/sql/physical";
import { commentsSource } from "./comments.ts";
import { documentationTableSource } from "./documentation-table.ts";
import { governanceTablesSource } from "./governance-tables.ts";
import { defaultSettings, type DocumentationSettings, settingsOf } from "./settings.ts";

export { commentsSource } from "./comments.ts";
export { documentationTableSource } from "./documentation-table.ts";
export { governanceTablesSource } from "./governance-tables.ts";
export {
  type CommentsSetting,
  defaultSettings,
  type DocumentationSettings,
  type DocumentationTablesSetting,
  type GovernanceTablesSetting,
  settingsOf,
  type TableNames,
} from "./settings.ts";

/**
 * The three sources, in the order their statements are added: the comments, the documentation table, the governance tables.
 *
 * @param given - what a project says of the settings; the rest is the default
 * @returns the sources
 */
export function documentationSources(given: Parameters<typeof settingsOf>[0] = {}): readonly StatementSource[] {
  const settings = settingsOf(given);
  return [commentsSource(settings), documentationTableSource(settings), governanceTablesSource(settings)];
}

const extensionOf = (name: string, source: StatementSource, version: string): Result<Extension, IdError> => {
  const id = extensionId(`sql.documentation.${name}`);
  return id.kind === "err"
    ? err(id.error)
    : ok(defineExtension({ id: id.value, version, contributes: [contribute(statementsPoint, source)] }));
};

/**
 * The three extensions, `sql.documentation.comments`, `sql.documentation.tables` and `sql.documentation.governance`, which are the default documentation of a project.
 *
 * @param given - what a project says of the settings; the rest is the default
 * @param version - the extensions' version
 * @returns the extensions, or why an identifier is not one
 */
export function defaultDocumentation(
  given: Parameters<typeof settingsOf>[0] = {},
  version = "1.0.0",
): Result<readonly Extension[], IdError> {
  const settings: DocumentationSettings = settingsOf(given);
  const made = [
    extensionOf("comments", commentsSource(settings), version),
    extensionOf("tables", documentationTableSource(settings), version),
    extensionOf("governance", governanceTablesSource(settings), version),
  ];
  const out: Extension[] = [];
  for (const m of made) {
    if (m.kind === "err") return err(m.error);
    out.push(m.value);
  }
  return ok(out);
}

export { defaultSettings as defaults };
