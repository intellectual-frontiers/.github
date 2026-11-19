// Spec: 0002-workspace-model FR-005
/**
 * The runtime's errors, by the package name of commons (commons 0027-commons-libraries FR-004): the class this library tells apart.
 *
 * @module
 */
import { errors } from "@intellectual-frontiers/commons/ts/runtime";

/** `errors.NotFound`. */
export const NotFound = errors.NotFound;
/** An instance of `errors.NotFound`. */
export type NotFound = InstanceType<typeof errors.NotFound>;
