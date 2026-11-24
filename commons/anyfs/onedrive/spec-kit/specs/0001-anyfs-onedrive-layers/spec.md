# Feature Specification: Layers of AnyFS OneDrive

**Spec ID:** 0001-anyfs-onedrive-layers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The library is one layer that reaches the network through one port, so that the live service, a recording and a fake are the same to the code above them.

## Requirements

- **FR-001**: The table of layers in the manifest MUST hold every file of the real tree with no finding of the shared checker of Kanon, and the library MUST be a plugin of the family of `anyfs` that reaches it only through its exports.
- **FR-002**: `verify` MUST run the compiler, the specification checker, the rules on the spec kit, the checker of layers, the trace check and the tests.
- **FR-003**: No source but the transport MUST reach the network, and no source MUST import a package of Microsoft that sends or signs for it.
- **FR-004**: The manifest MUST hold the library from the registries with a typed reason that names what is missing (a run against a live tenant).

## Acceptance scenarios

1. **Given** the real tree, **When** the checker of layers runs, **Then** it finds nothing, per FR-001.

## Out of scope

- A run against a live tenant (FR-004 says it is missing).

## Edge cases

- A source that calls `fetch` outside the transport is a finding, per FR-003.

## Assumptions

- The checker of layers is the one of every library of the family.

## Open questions

- None.

## Key entities

- **Transport** - the one function from a request to an answer.

## Success criteria

- **SC-001**: The library is verified without a network and holds its own boundary.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No implementation language beyond what the requirement needs
- [x] Out of scope is stated
