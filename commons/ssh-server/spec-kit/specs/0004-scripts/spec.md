# Feature Specification: Bootstrap scripts

**Spec ID:** 0004-scripts
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The scripts the server prints: a POSIX sh script and a PowerShell 7 script that say what they will do, report facts, ask the person for consent and run a typed plan without a shell, verifying every download.

## Requirements

- **FR-001**: `renderBootstrapSh(session, pins, endpoint, { brand, hostKey?, pairing? })` MUST give a POSIX sh script: `set -eu`, no `eval`, no evaluation of what the server sends, and only an allow-list of probes (os-release, uname, hostname, machine id, nproc and meminfo, lsblk or df, /sys/class/net with ip or ifconfig, the host keys under /etc/ssh, id and sudo -n, the package manager). The script MUST run its work in one function called on the last line, so that a truncated download runs nothing. Every name a script prints or creates on a machine (the environment prefix, the state folder, the key comment, the hint to approve) MUST come from the `brand` the product passes, and the library MUST hold none of its own.
- **FR-002**: `renderBootstrapPs(session, pins, endpoint, { brand, hostKey?, pairing? })` MUST give a PowerShell 7 script: `#Requires -Version 7.0`, strict mode, `$ErrorActionPreference = 'Stop'`, CIM, the OpenSSH host keys, `Get-NetAdapter` and the presence of winget.
- **FR-003**: Each script MUST print what it will do, send the facts with `ssh -p PORT s-enroll@HOST report SESSION` as one JSON line on the standard input, wait until a person approves, ask the person for explicit consent (the terminal, or `<PREFIX>_CONSENT=yes` (the prefix is the product's, given as the brand) of a person who wrote an unattended install) BEFORE the install, fetch the plan with `next SESSION`, execute only its typed steps and send the result with `done SESSION`.
- **FR-004**: A script MUST be deterministic (the same input gives the same bytes), MUST hold no secret and MUST be hashed: the server MUST audit the SHA-256 of every script it prints and keep it in the session.
- **FR-005**: The scripts MUST be drift-checked against committed samples (`suite/samples/`).
- **FR-006**: The scripts MUST be clean under shellcheck (0.9.0) and PSScriptAnalyzer (1.25.0) where they are installed.
- **FR-007**: The script MUST execute the steps of a plan without a shell (an argument vector, never a shell string), MUST check every field against the safe alphabet again, and MUST verify the SHA-256 of every download before it uses the file, and stop on a mismatch.
- **FR-008**: The catalog of pins MUST be osquery 5.24.1 from its official release (github.com/osquery/osquery), with the URL, version and SHA-256 of each artifact computed by downloading it: `.deb` for amd64 and arm64, `.rpm` for x86_64 and aarch64, `.msi` for Windows and `.pkg` for macOS. A platform without a verified pin MUST be left out of the catalog.
- **FR-009**: The script for sh MUST run against a real Debian 13 container, against a server on the host, and the facts it reports MUST be asserted. The test MUST skip cleanly where no container engine runs.
- **FR-010**: The controller MUST give a one-liner per shell that embeds the host key of the controller as a known_hosts line and checks it strictly (`StrictHostKeyChecking=yes`), so that there is no trust on first use: for sh by a temporary file and by `KnownHostsCommand` (OpenSSH 8.5 and later), for PowerShell by a temporary file; the script MUST embed the same key. The one-liner MUST NOT offer a key of the person (`PubkeyAuthentication=no`). Reserved: SSHFP with `VerifyHostKeyDNS`.

## Acceptance scenarios

1. **Given** a session, **When** the script is rendered twice, **Then** the bytes are equal (FR-004).
2. **Given** a plan whose hash is wrong, **When** the script runs it, **Then** it stops (FR-007).

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
