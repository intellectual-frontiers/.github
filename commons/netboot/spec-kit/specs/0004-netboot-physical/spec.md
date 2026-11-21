# Feature Specification: Netboot: the physical layer

**Spec ID:** 0004-netboot-physical
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** What a netboot does in the world: the state in a file, the pinned fetch, a TFTP server, an HTTP server and the boot server that answers both from the same handler.

## Requirements

- **FR-001**: The state MUST be kept in a file that is replaced whole (a reader never sees half of it), readable by its owner alone, changed one change at a time (no change lost), and a file that is not state MUST read as the empty state.
- **FR-002**: Each boot file and the installer image MUST be fetched once, checked against its pinned SHA-256 and kept; a file that does not match MUST NOT be kept and nothing MUST be served from it; a fetch that fails MUST be said.
- **FR-003**: The TFTP server MUST be read-only: it MUST give a file with the options asked for, refuse a missing file, a path out of the tree, a write and a mode that is not octet, and MUST roll block numbers over past 65535, each transfer on its own socket.
- **FR-004**: The HTTP server MUST write header names in canonical case (GRUB's client compares `Content-Length: ` case-sensitively), keep the connection for HEAD and then GET, stream a file, and give a byte range and refuse an unsatisfiable one.
- **FR-005**: The boot server MUST serve the same files and menus over TFTP and HTTP; MUST refuse every install file unless the host is armed and the token is its own; MUST put the base URL and the password hash into the install data as it serves it, and refuse to serve it where there is no hash; and MUST NOT keep a secret in its state.
- **FR-006**: The boot server MUST answer the guard's facts with the guard's decision and note it as progress, note the installer's events, and, on `done`, disarm the host and remember its MAC, so that the next network boot of that host boots its disk, and a reinstall over its own disk goes on only from the same MAC.

## Acceptance scenarios

1. **Given** an armed host, **When** the installer posts its facts and then done, **Then** the host is disarmed, per FR-006.

## Out of scope

- The firmware: PXE and Secure Boot are proved on real hardware, not here.

## Edge cases

- A client that does not follow TFTP: it gets an error packet, per FR-003.

## Assumptions

- Loopback sockets stand in for the network; what they cannot show (broadcast, DHCP, real firmware) is for a real machine, per FR-003.

## Open questions

- None.

## Key entities

- **Pin**, **Arming**, **Guard**.

## Success criteria

- **SC-001**: The tests of the library pass with real sockets on the loopback.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
