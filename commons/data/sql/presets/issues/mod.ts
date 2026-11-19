// Spec: 0044-issues FR-002
/**
 * The known issues of sql/presets (commons data 0044-issues): one file for each, numbered, listed here in order. Add an issue by adding its file and listing it; close it by changing its status, never by deleting it.
 *
 * @module
 */
import { issueSet } from "@intellectual-frontiers/data/governance";
import i1 from "./00001-team-managed-ordering.ts";
import i2 from "./00002-convergence-is-default.ts";

export const issues = issueSet("sql/presets", [i1, i2]);
