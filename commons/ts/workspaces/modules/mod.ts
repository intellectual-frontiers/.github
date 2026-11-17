/**
 * The module convention of `ifws` (commons 0025-ifws FR-004 to FR-011): the name of a module and the nearest names to a typo, the order of the three sources and what a later source hides, the modules a
 * workspace registers, the answer of an external module to `--ifws-manifest` with its JSON Schema, and the typed contract of a module and a command with its four exit statuses. All pure.
 *
 * @module
 */
export {
  CONTRACT_VERSION,
  decodeExternalManifest,
  type ExternalCommand,
  type ExternalManifest,
  externalManifestSchema,
  MANIFEST_FLAG,
  MANIFEST_TIMEOUT_MS,
} from "./external.ts";
export { describeNameError, MAX_MODULE_NAME, type ModuleName, moduleName, type NameError, nearestNames } from "./name.ts";
export {
  type Candidates,
  decodeRegistered,
  findModule,
  type Found,
  hiddenFindings,
  programMatches,
  type RegisteredModule,
  type Resolved,
  resolveAll,
} from "./registry.ts";
export {
  type BaseContext,
  type Command,
  type CommandDefinition,
  type Context,
  defineCommand,
  type Dispatch,
  dispatch,
  EXIT_STATUSES,
  type EvidenceFacts,
  type Executed,
  type ExitStatus,
  exitCodeOf,
  type Failure,
  GLOBAL_OPTIONS,
  type Globals,
  globalsOf,
  type IfwsModule,
  type Interact,
  MODULE_SOURCES,
  type ModuleSource,
  type Outcome,
  type Platform,
  precedenceOf,
  type Report,
} from "./types.ts";
