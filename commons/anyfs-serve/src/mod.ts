// Spec: 0001-anyfs-serve-layers FR-001
/**
 * AnyFS Serve: any AnyFS store served as WebDAV, class 1 and 2, on the POSIX view, so that an operating system mounts it with no kernel module and every answer says whether it was native, emulated or refused.
 * The layers: governance (methods, statuses, options), logical (XML, addresses, locks, properties and the handler from a request to a response) and physical (the server that hosts the handler).
 *
 * @module
 */
export * from "./governance/mod.ts";
export * from "./logical/mod.ts";
export * from "./physical/mod.ts";
