// Spec: 0002-workspace-model FR-005
/**
 * The command-line parser of the library `terminal`, by its package name (commons 0027-commons-libraries FR-004, 0032-libraries-by-concern FR-003): what this library uses of it, each name once, re-exported so that
 * the declarations of this package name the library and not the path of its sources.
 *
 * @module
 */
export {
  editDistance,
  flag,
  formatUsageError,
  helpOf,
  parseArgs,
  value,
  type Args,
  type Operand,
  type Parser,
  type Spec,
  type SpecCheck,
} from "@intellectual-frontiers/terminal/args";
