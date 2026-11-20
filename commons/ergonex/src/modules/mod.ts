// Spec: 0001-ergonex FR-004
/**
 * The module convention of `ergonex` (commons 0001-ergonex FR-004 to FR-011): the name of a module and the nearest names to a typo, the order of the three sources and what a later source hides, the modules a
 * workspace registers, the answer of an external module to `--ergonex-manifest` with its JSON Schema, and the typed values a command shares and the four statuses of its evidence record. All pure.
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
  type Context,
  EXIT_STATUSES,
  type EvidenceFacts,
  type ExitStatus,
  exitCodeOf,
  type Failure,
  type Globals,
  globalsOf,
  type ErgonexModule,
  type Interact,
  MODULE_SOURCES,
  type ModuleSource,
  type Outcome,
  type Platform,
  precedenceOf,
  type Report,
} from "./types.ts";
