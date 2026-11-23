// Spec: 0002-homebrew-dialect FR-001, FR-002, FR-003
/**
 * The dialect of tools for Homebrew: what it guarantees, how it writes an exact version and what its check answers, as data, and the call that makes the dialect from the commands of the packaging ontology.
 * Homebrew builds a formula from source where it has no bottle and no option known to this dialect forbids it, so the dialect says it can build from source and is used only where the fleet approved source builds. Everything else (the command lines, the plan file, the program, the observation) is in `@intellectual-frontiers/package-managers`.
 *
 * @example
 * ```ts
 * import { homebrew, TOOL_DIALECT } from "./dialect.ts";
 * TOOL_DIALECT.guarantees.pin; // "rolling"
 * ```
 *
 * @module
 */
import type { Dialect } from "@intellectual-frontiers/archon/dialect";
import type { JsonValue, Requirement, RequirementId } from "@intellectual-frontiers/archon/governance";
import { managerDialect, observeRequirements as observe, toolDialectOf, type CommandSource, type DialectOptions, type ManagerSpec, type Run } from "@intellectual-frontiers/package-managers";
import { parseManagerId } from "@intellectual-frontiers/toolchain/governance";
import type { ToolDialect } from "@intellectual-frontiers/toolchain/logical";

/** The id of the dialect. */
export const DIALECT_ID = "homebrew";

function must<T>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: string }): T {
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

/** The manager as the kit needs it: Homebrew, which installs the current bottle of a formula in a folder of the user's own, checked by the SHA-256 of the bottle. */
export const SPEC: ManagerSpec = {
  id: DIALECT_ID,
  manager: must(parseManagerId("manager-brew")),
  summary: "Homebrew, which installs the current bottle of a formula in a folder of the user's own, checked by the SHA-256 of the bottle.",
  guarantees: { pin: "rolling", integrity: "hash", scopes: ["user"], platforms: ["macos-x64", "macos-arm64", "linux-x64", "linux-arm64"], binds: "package", sourceBuild: true },
  versioning: { kind: "none", reason: "Homebrew installs the current version of a formula; an older line is a formula of its own (jq@1), named as the package" },
  missingExit: 1,
};

/** The dialect as Toolchain reads it. */
export const TOOL_DIALECT: ToolDialect = toolDialectOf(SPEC);

/** The dialect, made from the commands of the packaging ontology (the reader of `supply-chain/commands`, as a function); `elevate` is the program that raises the rights, where the manager needs them. */
export function homebrew(commands: CommandSource, options: DialectOptions = {}): Dialect {
  return managerDialect(SPEC, commands, options);
}

/** What Archon is given of what is installed: see the kit. */
export function observeRequirements(commands: CommandSource, requirements: readonly Requirement[], o: { readonly run?: Run } = {}): Promise<ReadonlyMap<RequirementId, JsonValue>> {
  return observe(SPEC, commands, requirements, o);
}
