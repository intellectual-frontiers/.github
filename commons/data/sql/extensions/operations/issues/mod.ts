// Spec: 0044-issues FR-002
/**
 * The known issues of sql/extensions/operations (commons data 0044-issues): one file for each, numbered, listed here in order. Add an issue by adding its file and listing it; close it by changing its status, never by deleting it.
 *
 * @module
 */
import { issueSet } from "@intellectual-frontiers/data/governance";
import i1 from "./00001-forged-actor.ts";
import i2 from "./00002-refused-call-spends.ts";
import i3 from "./00003-chain-not-recomputed.ts";
import i4 from "./00004-requires-or-public.ts";
import i5 from "./00005-decision-ignores-columns.ts";
import i6 from "./00006-typed-rows.ts";

export const issues = issueSet("sql/extensions/operations", [i1, i2, i3, i4, i5, i6]);
