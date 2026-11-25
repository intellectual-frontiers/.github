// Spec: 0004-workload-projections FR-008
/**
 * The dialects the library renders today, each from its own folder: Claude Code, Codex and a person. Adding a harness is one entry registered in the core and one renderer registered here, with no change to any workload.
 *
 * @example
 * ```ts
 * import { DIALECT_IMPLS } from "./dialects.ts";
 * DIALECT_IMPLS.map((d) => d.info.id); // ["claude-code", "codex", "human"]
 * ```
 *
 * @module
 */
import type { DialectImpl } from "@intellectual-frontiers/workload/logical";
import { dialect as claudeCode } from "@intellectual-frontiers/workload/dialects/claude-code";
import { dialect as codex } from "@intellectual-frontiers/workload/dialects/codex";
import { dialect as human } from "@intellectual-frontiers/workload/dialects/human";

/** The dialects the library renders today. */
export const DIALECT_IMPLS: readonly DialectImpl[] = [claudeCode, codex, human];
