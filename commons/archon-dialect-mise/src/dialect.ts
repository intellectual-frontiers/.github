// Spec: 0002-mise-dialect FR-001, FR-002, FR-003
/**
 * The dialect of tools for mise: what it guarantees, how it writes an exact version and what its check answers, as data, and the call that makes the dialect from the commands of the packaging ontology.
 * mise builds some tools from source (as it does for languages with a build plugin), so the dialect says it can build from source and is used only where the fleet approved source builds. Everything else (the command lines, the plan file, the program, the observation) is in `@intellectual-frontiers/package-managers`.
 *
 * @example
 * ```ts
 * import { mise, TOOL_DIALECT } from "./dialect.ts";
 * TOOL_DIALECT.guarantees.pin; // "exact"
 * ```
 *
 * @module
 */
import type { Dialect } from "@intellectual-frontiers/archon/dialect";
import type { JsonValue, Requirement, RequirementId } from "@intellectual-frontiers/archon/governance";
import { managerDialect, observeRequirements as observe, toolDialectOf, type CommandSource, type DialectOptions, type ManagerSpec, type Run } from "@intellectual-frontiers/package-managers";
import { parseManagerId } from "@intellectual-frontiers/toolchain/governance";

/** The id of the dialect. */
export const DIALECT_ID = "mise";

function must<T>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: string }): T {
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

/** The manager as the kit needs it: mise, which installs the tools of an account in the account's own folder at the versions it is told. */
export const SPEC: ManagerSpec = {
  id: DIALECT_ID,
  manager: must(parseManagerId("manager-mise")),
  summary: "Mise, which installs the tools of an account in the account's own folder at the versions it is told.",
  guarantees: { pin: "exact", integrity: "none", scopes: ["user"], platforms: ["linux-x64", "linux-arm64", "macos-x64", "macos-arm64", "windows-x64"], binds: "package", sourceBuild: true },
  versioning: { kind: "joined", joiner: "@" },
  missingExit: undefined,
};

/** The dialect as Toolchain reads it. */
export const TOOL_DIALECT = toolDialectOf(SPEC);

/** The dialect, made from the commands of the packaging ontology (the reader of `supply-chain/commands`, as a function); `elevate` is the program that raises the rights, where the manager needs them. */
export function mise(commands: CommandSource, options: DialectOptions = {}): Dialect {
  return managerDialect(SPEC, commands, options);
}

/** What Archon is given of what is installed: see the kit. */
export function observeRequirements(commands: CommandSource, requirements: readonly Requirement[], o: { readonly run?: Run } = {}): Promise<ReadonlyMap<RequirementId, JsonValue>> {
  return observe(SPEC, commands, requirements, o);
}
