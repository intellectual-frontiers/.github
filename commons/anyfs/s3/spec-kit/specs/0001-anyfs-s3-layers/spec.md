# Feature Specification: AnyFS S3 layers

**Spec ID:** 0001-anyfs-s3-layers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The S3 backend of AnyFS is a plugin of the family of AnyFS: it extends the host library, reaches the network only through its transport, signs requests with the library of commons and no outside package, ships held from the registries until its first consumer runs on it, and is proved by its own `verify`.

## Requirements

- **FR-001**: The library MUST be a plugin of the family of AnyFS: its manifest `library.ts` MUST name the host `anyfs` and the role `plugin`, declare `extends: "@intellectual-frontiers/anyfs"` and the table of its units in the field `kanon`, and the shared checker of `@intellectual-frontiers/kanon` MUST find nothing in its tree.
- **FR-002**: `bun run verify` in the folder of the library MUST run the TypeScript 7 compiler, the checks of the specification kit, the check of the level L1, the layers check of Kanon, the trace check, the tests and the packer.
- **FR-003**: No source of the library MUST reach the network but `src/transport.ts`, MUST import a package that signs or sends requests for it (an AWS SDK, `aws4`, a MinIO client), and no manifest of it MUST name one: a request is signed by Signature Version 4 of `@intellectual-frontiers/crypto` and sent through a `Transport`.
- **FR-004**: The library MUST be held from the registries (`held` in its manifest, with the reason) until its first consumer runs on it, and its distribution MUST be the GitHub package registry alone until it is released.
- **FR-005**: `bun tools/pack.ts` MUST pack the library as the package `@intellectual-frontiers/anyfs-s3` with declarations for every export, and `verify` MUST run it with `--check`.

## Acceptance scenarios

1. **Given** the real tree of the library, **When** the layers check runs, **Then** every file is in a unit and no import is outside its row, per FR-001.
2. **Given** the sources of the library, **When** the check of the network reads them, **Then** only the transport reaches it, per FR-003.

## Out of scope

- Multipart upload, ranges, streams, the metadata of an object beyond its digest, and the other clouds: their own specifications.

## Edge cases

- A source that calls `fetch` outside the transport: a finding of the test, per FR-003.
- A `verify` that leaves out a check: a finding of the test, per FR-002.

## Assumptions

- The runtime has `fetch` (Bun and Node 26).

## Open questions

- None.

## Key entities

- **The transport** - the function from a request to an answer that the store reaches a service by.
- **The store** - the store of AnyFS over a bucket and a prefix.

## Success criteria

- **SC-001**: The tests of the library pass on Bun and on Node 26.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
