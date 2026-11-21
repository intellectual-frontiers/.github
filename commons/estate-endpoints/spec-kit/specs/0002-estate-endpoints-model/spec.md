# Feature Specification: Estate Endpoints: what a reader gives

**Spec ID:** 0002-estate-endpoints-model
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The shape of what a reader of the descriptions of endpoints gives: assets and links of the estate, each asset with where it came from, as the importers of infrastructure as code give them.

## Requirements

- **FR-001**: A reader MUST give assets and links in the shapes of the importers of infrastructure as code (commons estate-iac 0002-estate-iac-model), each asset of a kind of the estate's catalog (commons estate 0007-estate-kinds) with its `provenance` as `format:file#where`, and accepted by the estate as a discovered asset; and MUST say in `problems` what it could not read, so that nothing is dropped without a word. The formats are `openapi`, `graphql`, `android`, `ios`, `dns-zone`, `certificate` and `listening-ports`.
- **FR-002**: An address MUST be read as a scheme, a host, a port and a path only where it is absolute and of a scheme the estate has (`http`, `https`, `ws`, `wss`, `grpc`, `tcp`, `tls`, `ssh`); a relative address, an address with no host or another scheme MUST give nothing.

## Acceptance scenarios

1. **Given** `https://api.example.test:8443/v1/`, **When** it is read, **Then** the host is `api.example.test`, the port 8443 and the path `/v1`, per FR-002.
2. **Given** `/v1`, **When** it is read, **Then** nothing is given, per FR-002.

## Out of scope

- The readers themselves (0003-estate-endpoints-readers).

## Edge cases

- A URL with no port keeps none: the usual port of its scheme is the estate's to say, per FR-002.

## Assumptions

- None.

## Open questions

- None.

## Key entities

- **Found**, **Provenance**.

## Success criteria

- **SC-001**: The tests of the library pass.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
