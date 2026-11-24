# Feature Specification: Tests of AnyFS Google Drive

**Spec ID:** 0003-anyfs-gdrive-tests
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Every requirement of the store is proved on a Drive made in process; the shapes of the documented responses are decoded; a live run is written and skipped until an account is named.

## Requirements

- **FR-001**: The store MUST pass every case of the conformance suite of AnyFS that its capabilities call for (all but those that need `cas`) on a Drive made in process, with a service that gives `sha256Checksum` and with one that does not, including the race of writers that expect no object.
- **FR-002**: The files, listings and errors that Drive is documented to answer with MUST be decoded by the store as they are written in the documentation (fixtures made from the documentation, labelled as such; none is a recording of a live service).
- **FR-003**: A test of the store on a live account MUST exist, MUST be skipped unless `ANYFS_GDRIVE_TEST_TOKEN` and `ANYFS_GDRIVE_TEST_FOLDER` are set, MUST work only in a folder of its own that it makes and removes, and its header MUST say that it has not been run where it has not.

## Acceptance scenarios

1. **Given** no variable of the live run, **When** the suite runs, **Then** the live test is skipped with its reason, per FR-003.

## Out of scope

- The live run itself (it needs an account of the owner).

## Edge cases

- A token in the environment of a run is read once and never written to a message, per FR-003.

## Assumptions

- The fake is written from the documentation of the Drive API and is as faithful as that is.

## Open questions

- None.

## Key entities

- **Fake Drive** - the in-process service of the tests.

## Success criteria

- **SC-001**: A change to the store is proved without a network, and the live run is one command away.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No implementation language beyond what the requirement needs
- [x] Out of scope is stated
