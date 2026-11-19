// Spec: 0002-workspace-model FR-005
/**
 * The runtime's `discover`, by the package name of commons (commons 0027-commons-libraries FR-004): what this library uses of it, each name as the runtime's namespace gives it.
 *
 * @module
 */
import { discover } from "@intellectual-frontiers/commons/ts/runtime";
/** `discover.discoverPrograms`. */
export const discoverPrograms = discover.discoverPrograms;
