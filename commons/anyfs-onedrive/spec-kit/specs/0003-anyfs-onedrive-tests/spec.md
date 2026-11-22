# Feature Specification: Tests of AnyFS OneDrive

**Spec ID:** 0003-anyfs-onedrive-tests
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Every requirement of the store is proved on a Graph made in process; the shapes of the documented responses are decoded; a live run is written and skipped until a tenant is named.

## Requirements

- **FR-001**: The store MUST pass every case of the conformance suite of AnyFS on a Graph made in process, with a service that gives the hash of the contents and with one that does not.
- **FR-002**: The items, errors and listings that Graph is documented to answer with MUST be decoded by the store as they are written in the documentation (fixtures made from the documentation, labelled as such; none is a recording of a live service).
- **FR-003**: A test of the store on a live tenant MUST exist, MUST be skipped unless `ANYFS_ONEDRIVE_TEST_TOKEN` and `ANYFS_ONEDRIVE_TEST_DRIVE` are set, MUST work only in a folder of its own that it makes and removes, and its header MUST say that it has not been run where it has not.

## Acceptance scenarios

1. **Given** no variable of the live run, **When** the suite runs, **Then** the live test is skipped with its reason, per FR-003.

## Out of scope

- The live run itself (it needs a tenant and an account of the owner).

## Edge cases

- A token in the environment of a run is read once and never written to a message, per FR-003.

## Assumptions

- The fake is written from the documentation of Graph and is as faithful as that is.

## Open questions

- None.

## Key entities

- **Fake Graph** - the in-process service of the tests.

## Success criteria

- **SC-001**: A change to the store is proved without a network, and the live run is one command away.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No implementation language beyond what the requirement needs
- [x] Out of scope is stated
