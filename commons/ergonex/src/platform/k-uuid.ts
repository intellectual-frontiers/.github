// Spec: 0002-workspace-model FR-005
/**
 * The kernel's `uuid`, by the package name of commons (commons 0027-commons-libraries FR-004): what this library uses of it, each name as the runtime's namespace gives it.
 *
 * @module
 */
import { uuid } from "@intellectual-frontiers/crypto";
/** `uuid.NAMESPACE_URL`. */
export const NAMESPACE_URL = uuid.NAMESPACE_URL;
/** `uuid.uuidUrn`. */
export const uuidUrn = uuid.uuidUrn;
/** `uuid.uuidV5Of`. */
export const uuidV5Of = uuid.uuidV5Of;
/** `uuid.Uuid`. */
export type Uuid = uuid.Uuid;
