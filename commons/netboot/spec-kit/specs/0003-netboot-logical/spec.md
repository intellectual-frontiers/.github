# Feature Specification: Netboot: the logical layer

**Spec ID:** 0003-netboot-logical
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** What a netboot decides without touching the world: the GRUB menus, the arming of a host for one install, the blank-disk guard's decision, the packets of TFTP and the classification of a request.

## Requirements

- **FR-001**: The GRUB menus MUST boot the local disk for a host that is not armed and for a machine that is not known (offering the armed hosts, with the local disk first and the default), and MUST install only an armed host, naming the installer image, the install's URL with the host's token and the MAC that GRUB reports.
- **FR-002**: An arming MUST carry a token that the install's URLs carry; a token MUST be compared whole (a short token is no token); a host MUST stay armed until the installer says it is done, which MUST disarm it and remember the MAC it installed from; the progress kept MUST be the last 200 lines.
- **FR-003**: The guard MUST go on where every disk is blank, where a person confirmed that the disks may be erased, and where the host installed from this MAC before; it MUST stop, saying why and what lets it go on, for any other machine with data on its disks, and MUST stop where there is no disk, whatever was confirmed.
- **FR-004**: The TFTP packets MUST be those of RFC 1350 with the options `blksize`, `tsize` and `timeout` (RFC 2347 to 2349): a request MUST be parsed with its options, the options agreed MUST be within bounds (a block size from 8, at most the server's maximum), a path that climbs out of the served tree or holds a NUL or a backslash MUST be refused, and block numbers MUST be taken modulo 65536.
- **FR-005**: A request path MUST be classified as a boot file, the menu of the network GRUB, the menu of one MAC, a boot file of one host, the installer image, or one of the install's files under `/install/<host>/<token>/<mac>/` (`user-data`, `meta-data`, `vendor-data`, `guard.sh`, `facts`, `event`, `done`) with a token of at least 16 hexadecimal digits; anything else, and a name that is only dots, MUST be unknown.

## Acceptance scenarios

1. **Given** a host that is not armed, **When** its menu is asked, **Then** it boots its own disk, per FR-001.
2. **Given** a machine with a partition and no confirmation, **When** the guard decides, **Then** it stops, per FR-003.

## Out of scope

- The servers: the physical layer.

## Edge cases

- A path with `..` in it: unknown, per FR-005.

## Assumptions

- The guard's script is served by the server (0004-netboot-physical FR-005); this layer holds its text and its decision, per FR-003.

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
