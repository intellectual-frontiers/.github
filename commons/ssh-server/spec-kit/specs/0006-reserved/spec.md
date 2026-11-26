# Feature Specification: Reserved conversations

**Spec ID:** 0006-reserved
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The conversations that are specified and not built. Each is reserved so that its name, its account and its place in the design are held; none is enforced yet.

## Requirements

- **FR-001**: Reserved, UNBUILT: on `s-device`, the conversation `jobs` (typed pending jobs out, results in), `health` and `presence` (a device held open feeds the status of the fleet). It MUST NOT be enforced before it is built.
- **FR-002**: Reserved, UNBUILT: on `s-device`, `query`: osquery distributed queries as a conversation, the results typed into estate-query. It MUST NOT be enforced before it is built.
- **FR-003**: Reserved, UNBUILT: on `s-device`, `evidence`: files pushed by hash into a chain, and `fetch`: a hash-verified artifact mirror, friendly to an air gap. It MUST NOT be enforced before it is built.
- **FR-004**: Reserved, UNBUILT: `s-operator`: the command line over ssh with forced typed commands, the tier set by the key. It MUST NOT be enforced before it is built.
- **FR-005**: Reserved, UNBUILT: `s-agent`: MCP over stdio over ssh, the tier set by the key. It MUST reuse the ssh-inbound surface of headless and MUST NOT duplicate it. It MUST NOT be enforced before it is built.
- **FR-006**: Reserved, UNBUILT: `s-assist`: a shared support terminal that others watch, recorded. It MUST NOT be enforced before it is built.
- **FR-007**: Reserved, UNBUILT: `tether`: an approved device keeps an outbound reverse forward (-R) so that a controller manages it behind NAT through outbound-only ssh; and the policies of -L and -R forwards per service account, denied by default. Today the server refuses every forward. It MUST NOT be enforced before it is built.
- **FR-008**: Reserved, UNBUILT, NEEDS AN OWNER DECISION: a brokered short-lived credential handed to a device by NAME with a lifetime. The fleet rule is that credentials are names and never values in the repository; a value that passes through the host is a decision for the owner. It MUST NOT be enforced before it is built.
- **FR-009**: Reserved, UNBUILT: push to connected devices over held-open sessions. It MUST NOT be enforced before it is built.
- **FR-010**: Reserved, UNBUILT: the controller as an SSH certificate authority that issues short-lived OpenSSH certificates (signed with `ssh-keygen -s` through the outbound technique of headless, not with `ssh2`) and the device trusting the authority (`TrustedUserCAKeys`); the authentication requirement `cert` is reserved for it. It MUST NOT be enforced before it is built.
- **FR-011**: Reserved, UNBUILT: discovery by mDNS and DNS-SD (`_opsfolio-enroll._tcp`), and the name `opsfolio`: until then the documentation says how to make the name resolve (a DHCP domain-name search entry or a DNS record). It MUST NOT be enforced before it is built.

## Acceptance scenarios

1. None: reserved requirements have no scenario until built.

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
