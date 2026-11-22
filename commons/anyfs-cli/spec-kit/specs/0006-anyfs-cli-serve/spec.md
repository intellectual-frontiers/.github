# Feature Specification: Serving a store from the command line

**Spec ID:** 0006-anyfs-cli-serve
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** `anyfs serve LOCATION` hosts a place of a store as WebDAV through `anyfs-serve`, on the loopback, with a token on standard error, until it is stopped.

## Requirements

- **FR-001**: `serve LOCATION` MUST host the store the word names as WebDAV through `serveStore` of `anyfs-serve`, on the loopback by default, on `--port N` (a free port where left out; a port that is not a whole number from 0 to 65535 MUST be a usage error), and a directory below the root of the store MUST be served as the root of the server.
- **FR-002**: The server MUST be told the token it made, and the verb MUST write the address and the token to standard error (never to the report, so that a pipe of the report does not carry it), and a request without the token MUST be refused.
- **FR-003**: A mount that is read-only, and `--read-only`, MUST serve nothing that changes the store; an address other than the loopback (`--listen ADDRESS`) MUST need `--allow-host` for the names it may be asked for, and `--allow-host` without `--listen` MUST be a usage error.
- **FR-004**: The verb MUST wait until the context's signal (SIGINT, SIGTERM) or the world's stop ends the run, and then MUST close the server and end with the report that it stopped; `--dry-run` MUST say what it would serve and listen on nothing. The verb MUST come through the command line only, never through the tool server.

## Acceptance scenarios

1. **Given** a mount of files, **When** `anyfs serve scratch:/` runs, **Then** standard error holds the address and a token, a WebDAV `PROPFIND` with the token answers, and one without it is refused, per FR-001 and FR-002.

## Out of scope

- NFS (the next server of `anyfs-serve`), TLS, and a token that is chosen by the person (the server makes it).

## Edge cases

- A location that is not a store that can be read as files is an environment problem, not a server that starts and refuses everything, per FR-001.

## Assumptions

- The person who starts the server is the one who reads standard error.

## Open questions

- None.

## Key entities

- **Server** - a running `serveStore` with its address and token.

## Success criteria

- **SC-001**: A person can mount any store of a configuration as a WebDAV folder with one command.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No implementation language beyond what the requirement needs
- [x] Out of scope is stated
