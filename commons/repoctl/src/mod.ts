// Spec: 0001-repoctl-layers FR-003
/**
 * Repoctl, the operations program of a repository (commons repoctl 0001-repoctl-layers; 0010-repoctl-host FR-003): the three layers of Kanon as namespaces, the entries of the program (`repoctlProgram` for a host that describes it, `main` for the command line) and what a repository's `repoctl.config.ts` is written with: `defineConfig` and the types of the configuration.
 *
 * @example
 * ```ts
 * import { defineConfig, governance, repoctlProgram } from "@intellectual-frontiers/repoctl";
 * governance.VERBS.sync.tier; // "contributor"
 * typeof repoctlProgram; // "function"
 * defineConfig({ repo: "acme/app", commit: { identity: { name: "A B", email: "a@example.test" } } }).repo; // "acme/app"
 * ```
 *
 * @module
 */
export * as governance from "./governance/mod.ts";
export * as logical from "./logical/mod.ts";
export * as physical from "./physical/mod.ts";
export { INERT_HOST, loadConfigFile, findConfigFile, repoctlProgram } from "./physical/mod.ts";
export {
  CONFIG_FILE,
  DEFAULT_ALLOWED_PATHS,
  DEFAULT_FORBIDDEN_PATHS,
  DEFAULT_SECRET_PATTERNS,
  defineConfig,
  parseConfig,
} from "./governance/mod.ts";
export type {
  Capabilities,
  Check,
  CheckInput,
  CommitPolicy,
  Config,
  ConfigInput,
  DocsSettings,
  DoctorPolicy,
  ForbiddenPath,
  Generator,
  GeneratorInput,
  HygienePolicy,
  Identity,
  LibrariesSettings,
  SecretPattern,
  Step,
  StepContext,
  StepFunction,
  StepInput,
  StepRun,
  TrailerKind,
} from "./governance/mod.ts";
export { main, type MainDeps } from "./repoctl.ts";
