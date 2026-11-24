# Feature Specification: AnyFS Bridge: layers

**Spec ID:** 0001-bridge-layers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The bridge is a plugin of the family of AnyFS in two layers, and it does no input or output of its own: every change it makes is an operation of a store.

## Requirements

- **FR-001**: The library MUST be registered as a plugin of the family `anyfs` that extends `@intellectual-frontiers/anyfs`, with the entries `.`, `./governance`, `./logical` and `./conformance`, held from release until the fleet store runs on it, and its layers MUST be governance (the vocabulary) and logical (the transfers), with the conformance suite in the logical layer; each layer MUST import only what the manifest says.
- **FR-002**: No source of the library MUST reach a file, a network, a process or the environment: a source MUST NOT import from `node:`, from the system or net libraries of commons, or use `Bun`, `Deno`, `fetch` or `process`; everything the library changes MUST be an operation of a store it is given.

## Acceptance scenarios

1. **Given** the manifest of the library, **When** it is read, **Then** it is a plugin of `anyfs` with the exports of its package, per FR-001.
2. **Given** every source of the library, **When** it is read, **Then** none reaches a file, a network or a process, per FR-002.

## Out of scope

- Releasing the library to npm (it is held).
- A command line: the `anyfs` program that exposes these transfers is its own library.

## Edge cases

- The conformance entry imports the conformance of AnyFS, which is the one place the logical layer reaches a test helper (FR-001).

## Assumptions

- The stores are given by the caller and are held to the laws of AnyFS (anyfs 0003-anyfs-logical FR-003).

## Open questions

- None.

## Key entities

- **Plugin**, **Layer**, **Unit**.

## Success criteria

- **SC-001**: Every behaviour is tested over stores in memory and, where it touches a file system, stores in a folder, with no network and no real time.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
