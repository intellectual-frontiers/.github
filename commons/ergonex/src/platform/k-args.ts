// Spec: 0002-workspace-model FR-005
/**
 * The kernel's `args`, by the package name of commons (commons 0027-commons-libraries FR-004): what this library uses of it, each name as the runtime's namespace gives it.
 *
 * @module
 */
import { args } from "@intellectual-frontiers/commons/ts/kernel";
/** `args.editDistance`. */
export const editDistance = args.editDistance;
/** `args.flag`. */
export const flag = args.flag;
/** `args.formatUsageError`. */
export const formatUsageError = args.formatUsageError;
/** `args.helpOf`. */
export const helpOf = args.helpOf;
/** `args.parseArgs`. */
export const parseArgs = args.parseArgs;
/** `args.value`. */
export const value = args.value;
/** `args.Args`. */
export type Args<S extends args.Spec> = args.Args<S>;
/** `args.Operand`. */
export type Operand = args.Operand;
/** `args.Parser`. */
export type Parser<T> = args.Parser<T>;
/** `args.Spec`. */
export type Spec = args.Spec;
/** `args.SpecCheck`. */
export type SpecCheck<S> = args.SpecCheck<S>;
