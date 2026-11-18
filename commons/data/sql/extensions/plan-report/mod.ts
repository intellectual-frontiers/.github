// Spec: 0016-sql-plan-report FR-001
/**
 * The plan report (commons data 0016-sql-plan-report): what a plan does in the words of governance, as Markdown for a person and JSON for a program, and as rows of a table of the database.
 * `reportArtifacts` gives the files; `reportData` the data; `recordStatements` the statements that record it; the files are the physical schema's own `Artifact`.
 *
 * @module
 */
export {
  reportArtifacts,
  reportData,
  reportMarkdown,
  type Approver,
  type ElementGovernance,
  type GovernanceChange,
  type ReportData,
  type ReportInput,
  type StepReport,
} from "./report.ts";
export { recordStatements } from "./record.ts";
export { type Report, type ReportSettings, settingsOf } from "./settings.ts";
