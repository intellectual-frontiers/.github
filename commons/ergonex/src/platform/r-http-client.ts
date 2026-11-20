// Spec: 0002-workspace-model FR-005
/**
 * The runtime's `http-client`, by the package name of commons (commons 0027-commons-libraries FR-004): what this library uses of it, each name as the runtime's namespace gives it.
 *
 * @module
 */
import { http } from "@intellectual-frontiers/net";
/** `http.liveTransport`. */
export const liveTransport = http.liveTransport;
/** `http.recordedTransport`. */
export const recordedTransport = http.recordedTransport;
/** `http.Transport`. */
export type Transport = http.Transport;
