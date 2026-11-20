// Spec: 0044-issues FR-002
/**
 * The known issues of data (commons data 0044-issues): one file for each, numbered, listed here in order. Add an issue by adding its file and listing it; close it by changing its status, never by deleting it.
 *
 * @module
 */
import { issueSet } from "@intellectual-frontiers/data/governance";
import i1 from "./00001-enforcement-in-application.ts";
import i2 from "./00002-ddl-guard-event-trigger.ts";
import i3 from "./00003-sealed-row-security-scope.ts";
import i4 from "./00004-trace-gate-inert.ts";
import i5 from "./00005-mutation-survivors.ts";
import i6 from "./00006-named-test-unresolved.ts";
import i7 from "./00007-issues-not-in-code.ts";
import i8 from "./00008-migration-flag-is-forgeable.ts";
import i9 from "./00009-ci-lacks-shells.ts";
import i10 from "./00010-etl-elt-integration.ts";
import i11 from "./00011-dbt-parity.ts";
import i12 from "./00012-observe-and-converge-overlap.ts";
import i13 from "./00013-book-becomes-documentation.ts";

/** The open issues of this library, as data: each says what is wrong or missing and what would close it. */
export const issues = issueSet("data", [i1, i2, i3, i4, i5, i6, i7, i8, i9, i10, i11, i12, i13]);
