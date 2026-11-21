# Feature Specification: AnyFS SQL: layers

**Spec ID:** 0001-sql-layers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The SQL stores are a plugin of the family of AnyFS in two layers, and a statement is never made by joining a value into text.

## Requirements

- **FR-001**: The library MUST be registered as a plugin of the family `anyfs` that extends `@intellectual-frontiers/anyfs`, with the entries `.`, `./governance`, `./physical`, `./sqlite`, `./libsql`, `./pg`, `./pglite` and `./duckdb`, held from release until the fleet store runs on it, and its layers MUST be governance (the dialects, the names of the tables, the port, the layout) and physical (the statements, the migrations, the store and the adapters), each with the imports its manifest declares.
- **FR-002**: The governance layer MUST do no input or output (a source MUST NOT import from `node:`, from the system or net libraries of commons, or use `Bun`, `Deno`, `fetch` or `process`), and the physical layer MUST write a name only by the language of SQL, a parameter only by its placeholder, and MUST NOT make the text of a statement from a value: no source may join a template literal that holds a variable into a statement outside the builder of `sql.ts`.

## Acceptance scenarios

1. **Given** the manifest of the library, **When** it is read, **Then** it is a plugin of `anyfs` with the exports of its package, per FR-001.
2. **Given** every source of the governance layer, **When** it is read, **Then** none reaches a file, a network or a process, per FR-002.
3. **Given** every source of the physical layer, **When** it is read, **Then** no statement is made by putting a value into text outside the builder, per FR-002.

## Out of scope

- Releasing the library to npm (it is held).

## Edge cases

- The adapters take a driver by its shape and import none (FR-001).

## Assumptions

- The stores are held to the laws of AnyFS (anyfs 0003-anyfs-logical FR-003); a value is only ever a parameter.

## Open questions

- None.

## Key entities

- **Port**, **Dialect**, **Layout**, **Revision**.

## Success criteria

- **SC-001**: Every behaviour is tested on the real engines in memory or in temporary folders, with no network and no real time.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
