# Feature Specification: AnyFS Git hosts layers

**Spec ID:** 0001-anyfs-githost-layers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The Git host backend of AnyFS is a plugin of the family of AnyFS: it extends the host library, reaches the network only through the transport of the net library of commons, talks to GitHub and GitLab with no outside client of theirs, ships held from the registries until its first consumer runs on it, and is packed like every library of commons.

## Requirements

- **FR-001**: The library MUST be a plugin of the family of AnyFS: its manifest `library.ts` MUST name the host `anyfs` and the role `plugin`, declare `extends: "@intellectual-frontiers/anyfs"` and the table of its units in the field `kanon`, and the shared checker of Kanon MUST find nothing in its tree; its governance layer MUST import only the core and the governance of AnyFS and no module that does input or output.
- **FR-002**: `bun run verify` in the folder of the library MUST run the TypeScript 7 compiler, the checks of the specification kit, the check of the level L1, the layers check of Kanon, the trace check, the tests and the packer.
- **FR-003**: No source of the library MUST reach the network but through the transport of the net library (`@intellectual-frontiers/net/http-client`), MUST call `fetch`, `XMLHttpRequest` or a module of the runtime that opens a connection, or import a client of a host that is not of commons (an Octokit, a Gitbeaker, a Git library), and no manifest of the library MUST name one.
- **FR-004**: The library MUST be held from the registries (`held` in its manifest, with the reason) until its first consumer runs on it, and its distribution MUST be the GitHub package registry alone until it is released.
- **FR-005**: `bun tools/pack.ts` MUST pack the library as the package `@intellectual-frontiers/anyfs-githost` with declarations for every export, and `verify` MUST run it with `--check`.

## Acceptance scenarios

1. **Given** the real tree of the library, **When** the layers check runs, **Then** every file is in a unit and no import is outside its row, per FR-001.
2. **Given** the sources of the library, **When** the check of the network reads them, **Then** none calls `fetch` or imports a client of a host, per FR-003.

## Out of scope

- Git's own protocol (a clone, a fetch, a push): the Git stores of AnyFS do it; this library speaks the REST APIs of the hosts. Large file storage, and a host that is neither GitHub nor GitLab: other libraries.

## Edge cases

- A source that calls `fetch` beside the transport: a finding of the test, per FR-003.
- A `verify` that leaves out a check: a finding of the test, per FR-002.

## Assumptions

- The runtime has `fetch` (Bun and Node 26), which the transport of the net library uses.

## Open questions

- None.

## Key entities

- **The transport** - the function from a request to an answer that the library reaches a host by.
- **The store** - the store of AnyFS over a branch of a repository on a host.

## Success criteria

- **SC-001**: The tests of the library pass on Bun and on Node 26.

## Review & acceptance checklist

- [x] Every requirement is testable and has a test.
