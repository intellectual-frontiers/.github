// Spec: 0002-winget-dialect FR-001, FR-002, FR-003
/**
 * The dialect of tools for WinGet: what it guarantees, how it writes an exact version and what its check answers, as data, and the call that makes the dialect from the commands of the packaging ontology.
 * It runs the installers its manifests name, and builds nothing itself. Everything else (the command lines, the plan file, the program, the observation) is in `@intellectual-frontiers/package-managers`.
 *
 * @example
 * ```ts
 * import { winget, TOOL_DIALECT } from "./dialect.ts";
 * TOOL_DIALECT.guarantees.pin; // "exact"
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
export const DIALECT_ID = "winget";

function must<T>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: string }): T {
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

/** The manager as the kit needs it: WinGet, whose manifests carry the SHA-256 of each installer, which it checks before it runs one. */
export const SPEC: ManagerSpec = {
  id: DIALECT_ID,
  manager: must(parseManagerId("manager-winget")),
  summary: "WinGet, whose manifests carry the SHA-256 of each installer, which it checks before it runs one.",
  guarantees: { pin: "exact", integrity: "hash", scopes: ["user", "system"], platforms: ["windows-x64"], binds: "package", sourceBuild: false },
  versioning: { kind: "flags", packageFlags: ["--id"], exactFlags: ["--exact"], versionFlag: "--version" },
  missingExit: undefined,
};

/** The dialect as Toolchain reads it. */
export const TOOL_DIALECT: ToolDialect = toolDialectOf(SPEC);

/** The dialect, made from the commands of the packaging ontology (the reader of `supply-chain/commands`, as a function); `elevate` is the program that raises the rights, where the manager needs them. */
export function winget(commands: CommandSource, options: DialectOptions = {}): Dialect {
  return managerDialect(SPEC, commands, options);
}

/** What Archon is given of what is installed: see the kit. */
export function observeRequirements(commands: CommandSource, requirements: readonly Requirement[], o: { readonly run?: Run } = {}): Promise<ReadonlyMap<RequirementId, JsonValue>> {
  return observe(SPEC, commands, requirements, o);
}
