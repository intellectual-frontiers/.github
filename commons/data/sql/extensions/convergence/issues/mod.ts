// Spec: 0044-issues FR-002
/**
 * The known issues of sql/extensions/convergence (commons data 0044-issues): one file for each, numbered, listed here in order. Add an issue by adding its file and listing it; close it by changing its status, never by deleting it.
 *
 * @module
 */
import { issueSet } from "@intellectual-frontiers/data/governance";
import i1 from "./00001-defaults-and-check-text.ts";
import i2 from "./00002-held-not-dropped.ts";
import i3 from "./00003-undo-not-inverse.ts";
import i4 from "./00004-quarantine-overwrite.ts";

export const issues = issueSet("sql/extensions/convergence", [i1, i2, i3, i4]);
