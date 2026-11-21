// Spec: 0001-anyfs-layers FR-003
/**
 * Layer 3 of AnyFS: the stores that reach a place. This module re-exports the store in memory and the store in a folder, and makes the tracer of the traced layer from telemetry; a program that wants one store imports its entry.
 *
 * @module
 */
export * from "@intellectual-frontiers/anyfs/memory";
export * from "@intellectual-frontiers/anyfs/local";
export * from "./telemetry.ts";
