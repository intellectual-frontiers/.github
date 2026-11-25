# Feature Specification: AnyFS Mirror: layers

**Spec ID:** 0001-mirror-layers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The mirrored store is a plugin of the family of AnyFS in three layers, and it reaches every backend only through the store type, so that a backend added to AnyFS later can be a primary or a secondary with no change to the library.

## Requirements

- **FR-001**: The library MUST be registered as a plugin of the family `anyfs` that extends `@intellectual-frontiers/anyfs`, with the entries `.`, `./governance`, `./logical` and `./physical`, and its layers MUST be governance (what a mirror does when a secondary fails and what it reports), logical (the pure functions of operations and listings) and physical (the store that mirrors), each importing only what its unit in the manifest names.
- **FR-002**: The governance and logical layers MUST do no input or output (a source MUST NOT import from `node:`, from the system or net libraries of commons, or use `Bun`, `Deno`, `fetch` or `process`), and no source of the library MUST import a backend (a store of Git, SQL, a host, memory or a folder), so that the library knows stores only by the type of a store.

## Acceptance scenarios

1. **Given** the manifest of the library, **When** it is read, **Then** it is a plugin of `anyfs` with the exports of its package and three layers, per FR-001.
2. **Given** every source of the governance and logical layers, **When** it is read, **Then** none reaches a file, a network or a process, per FR-002.
3. **Given** every source of the library, **When** its imports are read, **Then** none names a backend, per FR-002.

## Out of scope

- Releasing the library to npm (its distribution is the GitHub package registry).

## Edge cases

- A test of the library may import backends: only the sources of `src/` are held to FR-002.

## Assumptions

- The stores are held to the laws of AnyFS (anyfs 0003-anyfs-logical FR-003).

## Open questions

- None.

## Key entities

- **Mirror**, **Primary**, **Secondary**.

## Success criteria

- **SC-001**: Every behaviour is tested with a real Git repository and a real SQLite file in temporary folders, with no network and no real time.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
