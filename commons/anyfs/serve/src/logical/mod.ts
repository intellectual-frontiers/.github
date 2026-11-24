// Spec: 0003-anyfs-serve-logical FR-001
/**
 * The Logical layer of AnyFS Serve: the strict XML, the addresses, the table of locks, the `If` header, the properties, the answers and the handler from a request to a response.
 *
 * @module
 */
export * from "./xml.ts";
export * from "./href.ts";
export * from "./auth.ts";
export * from "./lock.ts";
export * from "./ifheader.ts";
export * from "./props.ts";
export * from "./respond.ts";
export * from "./handler.ts";
export * from "./xdr.ts";
export * from "./rpc.ts";
export * from "./nfs3.ts";
