// Spec: 0005-estate-fleet-documents FR-001
/**
 * The physical layer of Estate: the fleet store, which keeps an estate as typed documents in a store of AnyFS, with the documents, their schemas and layouts, the snapshot the logical layer judges,
 * the problems and events of the store, and a store for development.
 *
 * @module
 */
export * from "./documents.ts";
export * from "./problem.ts";
export * from "./snapshot.ts";
export * from "./fleet.ts";
export * from "./dev.ts";
export * from "./example.ts";
