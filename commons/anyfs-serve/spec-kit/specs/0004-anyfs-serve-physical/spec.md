# Feature Specification: AnyFS Serve: physical

**Spec ID:** 0004-anyfs-serve-physical
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The server that hosts the handler on node:http through the server of commons, on the loopback, with a token.

## Requirements

- **FR-001**: `serveStore` MUST host the handler of a store on the loopback address `127.0.0.1` with a port that the program gives or the system chooses, MUST give the address it listens on and a way to stop it, and MUST give an error value, never throw, where it cannot listen.
- **FR-002**: Where the program gives no way to know who asks, the server MUST make a token of 32 random bytes, accept it as a bearer token and as the password of Basic with any user name, and tell the program the token once so that it can show it to the person who started the server; the server MUST NOT write the token to a log or to an event.
- **FR-003**: An address other than the loopback MUST be listened on only where the program gives an exposure that names the hosts that may be asked for, and the handler MUST refuse a request whose `Host` is not one of them; an event MUST hold the method, the path, the status, the kind of fidelity and the time, and no credential and no body.

## Acceptance scenarios

1. **Given** the case of FR-001, **When** it is run, **Then** the requirement holds, per FR-001.
2. **Given** the case of FR-002, **When** it is run, **Then** the requirement holds, per FR-002.
3. **Given** the case of FR-003, **When** it is run, **Then** the requirement holds, per FR-003.

## Out of scope

- Properties stored by the server, shared locks and NFS: later specifications.

## Edge cases

- A port that is already taken is an error value that names it, per FR-001.

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
