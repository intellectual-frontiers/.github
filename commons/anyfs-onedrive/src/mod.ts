// Spec: 0001-anyfs-onedrive-layers FR-001
/**
 * AnyFS OneDrive: a store of AnyFS over a drive and a folder of Microsoft Graph. `openOneDriveStore` makes it from a place (`onedrive://me/fleet`) and a source of bearer tokens; the transport is the one port to the
 * network, so a test or a recording stands in for the service.
 *
 * @example
 * ```ts
 * import { openOneDriveStore, staticToken } from "@intellectual-frontiers/anyfs-onedrive";
 * ```
 *
 * @module
 */
export { CAPABILITIES, openOneDriveStore, staticToken, type OneDriveOptions, type OneDrivePlace, type OneDriveStore, type TokenSource } from "./store.ts";
export { failureOf, FAILURE_KINDS, kindOf, problemOf, type Failure, type FailureKind } from "./errors.ts";
export { parseItem, parsePage, type Item, type Page } from "./items.ts";
export { pathProblem, segmentProblem } from "./names.ts";
export { fetchTransport, type HttpMethod, type HttpRequest, type HttpResponse, type SendOptions, type Transport } from "./transport.ts";
