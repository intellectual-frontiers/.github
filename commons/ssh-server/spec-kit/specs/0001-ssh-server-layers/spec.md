# Feature Specification: SSH Server layers

**Spec ID:** 0001-ssh-server-layers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The SSH server of enrollment, a server and never a client, built to Kanon (commons 0033-kanon): Governance says what it is, Logical is the pure model, Physical is what touches the world and the only layer that imports the one external dependency, `ssh2`.

## Requirements

- **FR-001**: The library MUST be Kanon: its manifest `library.ts` MUST declare the table of its units in the field `kanon`, with the units `src/governance/`, `src/logical/` and `src/physical/`, and the shared checker of `@intellectual-frontiers/kanon` MUST find no import that the table does not allow.
- **FR-002**: `bun run verify` in the folder of the library MUST run the TypeScript 7 compiler, the checks of the specification kit, the check of the level L1, the layers check of Kanon, the trace check and the tests, and MUST fail on any finding that is not held by a baseline that only shrinks.
- **FR-003**: The package `ssh2` MUST be the one deliberate external dependency of the library: it MUST be declared in `dependencies` of `package.json` at an exact version (no range), the table of the manifest MUST allow it in the row of `src/physical/` and in no other, and `src/governance/` and `src/logical/` MUST import nothing but `@intellectual-frontiers/core` and the layers beneath them. The rule of headless (headless 0005-reach-and-targets FR-005) that `targets/ssh` MUST NOT use `ssh2` is about outbound ssh and stays: outbound ssh is the system OpenSSH client, and this library is the server.
- **FR-004**: The library MUST be a server and MUST NOT export a client: no export of `package.json` gives an SSH client, and any `ssh2` client code MUST be in `suite/` as a test helper.
- **FR-005**: The library MUST run on Bun and on Node 26 and MUST hold nothing POSIX-only in the server: paths by `node:path`, no shell, no signal, no `child_process`.
- **FR-006**: The behaviours not yet proven MUST be named as UNVERIFIED here and nowhere asserted as working: the Windows `ssh.exe` client against the server; an OpenSSH 10 client against the server; the optional native `cpu-features` addon of `ssh2` on Windows (the server does not need it: it is optional, and its build may fail without harm); the PowerShell script on Windows (it parses and passes PSScriptAnalyzer on Linux and has not run on Windows); the pins of Windows on ARM (none is listed). Proven for real: the server against the OpenSSH 9.6 client on Bun 1.4.4 and Node 26.13.1, and the script for sh with the OpenSSH 10.0 client of a Debian 13 container.

## Acceptance scenarios

1. **Given** the real tree, **When** the layers check runs, **Then** nothing is found (FR-001).
2. **Given** the package, **When** its `verify` script is read, **Then** it runs every check (FR-002).
3. **Given** an import of `ssh2` in `src/logical/`, **When** the layers check runs, **Then** it is a finding (FR-003).

## Out of scope

- Booting a machine (PXE, TFTP, boot servers): it is not a concern of commons.
- The controller that calls this library: it is in the private erga repository.

## Edge cases

- A requirement of this specification that a test cannot reach on this machine: it says so in its note (FR-001).
- A reserved requirement: it is held by name and enforces nothing until it is built (FR-001).

## Assumptions

- The system OpenSSH client is the client of the tests, and Debian 13 is the container of the script test.

## Open questions

- None.

## Key entities

- **SSH Server** - the library.

## Success criteria

- **SC-001**: Every requirement of this specification with the mechanism `check` is proved by `bun run verify`.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
