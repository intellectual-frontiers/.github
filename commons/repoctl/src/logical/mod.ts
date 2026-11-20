// Spec: 0001-repoctl-layers FR-002
/**
 * The Logical layer of Repoctl (commons repoctl 0003-repoctl-sync, 0004-repoctl-status-release, 0005-repoctl-library-commit-doctor): what each verb reasons with, as pure functions of values and of the ports of the world: the order of
 * the generators, `sync`, `merge`, `check`, the version constants, the status, the publication, the scaffold of a library, the commit and the diagnosis of a checkout. It imports Governance, Core and the governance and logical layers of
 * Headless, and reads no file, runs no program and reaches no network except through its ports.
 *
 * @example
 * ```ts
 * import { orderGenerators } from "@intellectual-frontiers/repoctl/logical";
 * orderGenerators([]).kind; // "ok"
 * ```
 *
 * @module
 */
export * from "./check.ts";
export * from "./commit.ts";
export * from "./constants.ts";
export * from "./declared.ts";
export * from "./doctor.ts";
export * from "./findings.ts";
export * from "./glob.ts";
export * from "./merge.ts";
export * from "./order.ts";
export * from "./pool.ts";
export * from "./ports.ts";
export * from "./prove.ts";
export * from "./publish.ts";
export * from "./docs.ts";
export * from "./scaffold.ts";
export * from "./select.ts";
export * from "./semver.ts";
export * from "./status.ts";
export * from "./surface.ts";
export * from "./step.ts";
export * from "./sync.ts";
export * from "./hygiene.ts";
export * from "./hygiene-facts.ts";
