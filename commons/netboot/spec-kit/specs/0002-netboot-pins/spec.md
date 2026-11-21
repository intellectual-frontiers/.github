# Feature Specification: Netboot: the pinned boot files

**Spec ID:** 0002-netboot-pins
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The boot files that a netboot serves (Ubuntu's shim, GRUB, kernel and initrd and the installer image) and the placeholders of what a rendered file may not hold.

## Requirements

- **FR-001**: The pins MUST name each network boot file (`bootx64.efi`, `grubx64.efi`, `linux`, `initrd`) and the installer image by a SHA-256 of 64 hexadecimal digits, with the address each is fetched from; a new point release MUST be adopted by changing this data in a reviewed commit.
- **FR-002**: The package MUST name the two placeholders that a rendered install file holds in place of what must not be kept in it: the boot server's URL for the install (`@archon:base@`) and the hash of the administrator's password (`@archon:password-hash@`); the server MUST replace them as it serves the file.

## Acceptance scenarios

1. **Given** the pins, **When** they are read, **Then** each file has a 64-digit SHA-256, per FR-001.

## Out of scope

- Fetching the files: the physical layer (0004-netboot-physical FR-002).

## Edge cases

- A new release of Ubuntu: a new pin, per FR-001.

## Assumptions

- The pins were established as their header says; the first fetch checks every file against them and refuses one that does not match.

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
