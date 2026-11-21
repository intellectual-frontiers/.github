// Spec: 0001-anyfs-layers FR-001
/**
 * AnyFS: one typed interface to every place bytes live. This module re-exports the first two layers, the identities and the store with its laws, attenuation, mounts and layers; the stores that reach a place are
 * entries of their own (`./memory`, `./local`), so that a program that only needs the types does not load a file system.
 *
 * @module
 */
export * from "./governance/mod.ts";
export * from "./logical/mod.ts";
