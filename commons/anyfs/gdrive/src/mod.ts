// Spec: 0001-anyfs-gdrive-layers FR-001
/**
 * AnyFS Google Drive: a store of AnyFS over a folder of Google Drive. `openDriveStore` makes it from a place (`gdrive://FOLDER-ID`) and a source of bearer tokens; the transport is the one port to the network, so a test
 * or a recording stands in for the service. The store has no compare-and-write, because Drive keeps no condition on a write, and says so in its type.
 *
 * @example
 * ```ts
 * import { openDriveStore, staticToken } from "@intellectual-frontiers/anyfs-gdrive";
 * ```
 *
 * @module
 */
export { CAPABILITIES, openDriveStore, staticToken, type DriveOptions, type DrivePlace, type DriveStore, type TokenSource } from "./store.ts";
export { failureOf, FAILURE_KINDS, kindOf, problemOf, type Failure, type FailureKind } from "./errors.ts";
export { byAge, FOLDER_TYPE, parseFile, parsePage, quoted, type DriveFile, type Page } from "./files.ts";
export { fetchTransport, type HttpMethod, type HttpRequest, type HttpResponse, type SendOptions, type Transport } from "./transport.ts";
