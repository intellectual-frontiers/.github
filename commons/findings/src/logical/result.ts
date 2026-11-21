// Spec: 0003-findings-importers FR-001
/**
 * What an importer gives: the findings, and what could not be read.
 *
 * @module
 */
import type { RawFinding } from "@intellectual-frontiers/findings/governance";

/** What an importer gives. */
export type Imported = { readonly findings: readonly RawFinding[]; readonly problems: readonly string[] };
