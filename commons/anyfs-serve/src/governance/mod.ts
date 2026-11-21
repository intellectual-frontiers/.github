// Spec: 0002-anyfs-serve-governance FR-001
/**
 * The Governance layer of AnyFS Serve: what the server is, as data and types: the methods it answers, the statuses it gives and the code of the POSIX view each comes from, the content types, and the options a
 * program gives it (where it listens, who may ask, how much it holds, what it does with the files a desktop makes on its own).
 *
 * @module
 */
export * from "./methods.ts";
export * from "./status.ts";
export * from "./options.ts";
export * from "./mime.ts";
