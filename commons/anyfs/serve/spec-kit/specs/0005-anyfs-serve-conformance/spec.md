# Feature Specification: AnyFS Serve: conformance

**Spec ID:** 0005-anyfs-serve-conformance
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** What proves the server: a model of the POSIX view, hostile XML, locks, the quirks of the desktops, a real socket and the protocol suite litmus.

## Requirements

- **FR-001**: Over a store in memory and a store in a folder the server MUST pass every test of the suites `basic`, `copymove` and `http` of litmus, the protocol suite of WebDAV, and every test of `locks` and `props` that does not need a property to be stored, a second kind of lock or a longer header than litmus sends; the tests that it fails MUST be exactly the ones recorded in the suite.
- **FR-002**: A random sequence of MKCOL, PUT, DELETE, COPY and MOVE over a small set of names, answered by the handler, MUST leave the same tree as a model in memory of what each does, and the status of each MUST be the one the model gives.
- **FR-003**: A document type, a billion laughs, a deep nesting, an undeclared prefix, a document too large and one with too many parts MUST each be refused as a typed problem without expanding or reading anything beyond the limit, and a PROPFIND or LOCK with such a body MUST be `400` or `413`.
- **FR-004**: The requests a desktop makes MUST be answered as it expects: a PROPFIND of a missing resource `404`, a request for the properties of a resource that it does not have `404` in its part, `.DS_Store`, `._*`, `Thumbs.db` and `desktop.ini` by the policy for junk, an `OPTIONS` that names the methods and `DAV: 1, 2`, and a challenge for Basic where no credentials were sent.

## Acceptance scenarios

1. **Given** the case of FR-001, **When** it is run, **Then** the requirement holds, per FR-001.
2. **Given** the case of FR-002, **When** it is run, **Then** the requirement holds, per FR-002.
3. **Given** the case of FR-003, **When** it is run, **Then** the requirement holds, per FR-003.
4. **Given** the case of FR-004, **When** it is run, **Then** the requirement holds, per FR-004.

## Out of scope

- Properties stored by the server, shared locks and NFS: later specifications.

## Edge cases

- Where litmus is not installed its test is skipped and says so, per FR-001.

## Assumptions

- The library `@intellectual-frontiers/anyfs` is the host of the family and `@intellectual-frontiers/anyfs-posix` gives the view that every method is carried out on.

## Open questions

- None.

## Key entities

- **Handler** - a function from a Request to a Response that serves one store.
- **Exposure** - where the server may listen and which hosts it may be asked for.

## Success criteria

- **SC-001**: The tests of every requirement of the library pass on Bun and on Node 26.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
