# Feature Specification: AnyFS Query: layers

**Spec ID:** 0001-query-layers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The query language is a plugin of the family of AnyFS in two layers, and it does no input or output of its own: everything it reads is an operation of a store it was handed, and it never asks a store to change.

## Requirements

- **FR-001**: The manifest MUST declare the library as a plugin of the family of `anyfs` that extends `@intellectual-frontiers/anyfs`, with the exports `.`, `./governance` and `./logical` that the package has, and two layers: governance, which imports only core and the governance of AnyFS, and logical, which imports governance, core, AnyFS and the SQL language library `@intellectual-frontiers/lang-sql`.
- **FR-002**: No source of the library MUST reach a file, a network, a process or the clock, and none MUST ask a store for an operation that changes it (`write`, `delete`, `batch`, `rename` or `append`): the time is a value of the context a query is run with, and a store is reached only through `list`, `stat`, `history` and `read`.

## Acceptance scenarios

1. **Given** the manifest, **When** its exports are compared with the package's, **Then** they are the same, per FR-001.
2. **Given** the sources of both layers, **When** they are read, **Then** none imports `node:` or the system or network libraries, none reads the clock and none names a changing operation, per FR-002.

## Out of scope

- The stores themselves and the means of naming a place: a context gives them (0004-query-safety).

## Edge cases

- The logical layer imports the language library by package name and no other library of the family but AnyFS (FR-001); the tests of the library import stores of other plugins, and no source does.

## Assumptions

- The context gives the clock, so a run needs no ambient time (FR-002).

## Open questions

- None.

## Key entities

- **Plugin**, **Layer**, **Unit**.

## Success criteria

- **SC-001**: Every behaviour is tested over stores in memory and, where a file system is touched, in a folder, with no network and no real time.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
