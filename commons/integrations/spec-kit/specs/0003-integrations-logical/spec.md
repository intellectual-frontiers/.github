# Feature Specification: Integrations logical ports

**Spec ID:** 0003-integrations-logical
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The ports of Integrations are typed interfaces, each a record of functions, that the pure cores are written against and the physical layer implements: the credential port (a reference in, a secret that cannot be printed out), the read port (it can only read), the clock and the trace. No core reads the time, a file or a network.

## Ports

- **FR-001**: A port MUST be a typed record of functions (`CredentialPort`, `ReadPort`, `Clock`, `Trace`); a core MUST take what it needs as a port and MUST NOT reach the clock, a file or a network itself.
- **FR-002**: A `Secret` MUST say `[secret]` however it is turned into text (`toString`, `toJSON`, a template, `JSON.stringify`) and give its value only to `reveal`; the credential port MUST hand out a `Secret`, and the read port MUST have no way to write.
- **FR-003**: A trace event MUST carry only identities, counts and codes, never a payload; findings and failures MUST carry paths, kinds and statuses, never values.

## Acceptance scenarios

1. **Given** a secret with the value `abc123xyz`, **When** it is turned into JSON, **Then** the text is `"[secret]"`, per FR-002.

## Out of scope

- The physical implementations of the ports: 0004-integrations-physical.

## Edge cases

- A `Secret` that is spread into an object: its functions are not data, `JSON.stringify` still says `[secret]`, per FR-002.

## Assumptions

- A runtime cannot stop a program that calls `reveal` and prints it; the port makes the accident impossible, not the malice.

## Open questions

- None.

## Key entities

- **Port** - a record of functions.
- **Secret** - an opaque value.

## Success criteria

- **SC-001**: A credential never appears in a log, a JSON document or an error by accident.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
