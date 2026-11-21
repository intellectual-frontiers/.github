# Feature Specification: Netboot: the profile of each distribution

**Spec ID:** 0005-netboot-profiles
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** What each distribution needs from a network boot, as data, so that the server, the menus and the arming are the same for every distribution and a distribution is added by data.

## Requirements

- **FR-001**: A boot profile MUST name the distribution and release, the family the platform model gives it, its pinned boot files (each by a SHA-256 of 64 hexadecimal digits), the kernel and the initial ramdisk among them, the kernel's command line as a template and the install document the installer reads; a profile MUST be found by its id, and an id that no profile has MUST find none.
- **FR-002**: Every profile's kernel and ramdisk MUST be among its pinned files; the installer image is optional, because an installer that fetches its packages from a mirror has none, and a profile with no image MUST serve none.
- **FR-003**: The menu of an armed host MUST boot its profile's kernel and ramdisk with the profile's command line, in which `{install}` is the install's URL (with the host, the token and the MAC GRUB reports), `{iso}` the image's URL and `{base}` the server's URL; a character GRUB would take for the end of a command MUST be escaped in the command line.
- **FR-004**: The server MUST serve, under the install's URL and only for an armed host and its token, the install document of its profile (the autoinstall's `user-data`, a Debian `preseed.cfg`, a Kickstart `ks.cfg` or an AutoYaST `autoinst.xml`) with the profile's content type and the secrets put in as it is served, and MUST NOT serve the install document of another profile.
- **FR-005**: The profiles MUST include Ubuntu 26.04 (autoinstall), Debian 13 (preseed) and Rocky Linux 9 (Kickstart, whose boot files are in two folders of its tree, so that a pin may name the path a file is fetched from); a server MUST serve one profile at a time, because the boot files of every distribution have the same names.
- **FR-006**: A profile MUST say whether its installer can run the blank-disk guard before a disk is touched (Ubuntu's can, Debian's cannot, because its installer has neither `curl` nor `lsblk`); where it cannot, an asset MUST be armed for it only with the owner's say-so that the install may erase a disk (`archon boot arm --confirm-destroy yes`).

## Acceptance scenarios

1. **Given** the profiles, **When** each is read, **Then** its files, kernel and ramdisk agree, per FR-001 and FR-002.
2. **Given** a Debian host armed, **When** its menu is read, **Then** it boots Debian's kernel with the URL of its preseed, per FR-003.
3. **Given** a server of the Debian profile, **When** the preseed and the user-data are asked for, **Then** the first is served and the second is not, per FR-004.

## Out of scope

- The installers' own documents: the dialects render them (the preseed, Kickstart and AutoYaST dialects), and a profile only says where they are served.
- Booting the machine: real firmware is verified on hardware by the owner.

## Edge cases

- A point release of Debian replaces the files of its `current` folder in place: the pins no longer match, the server refuses to serve, and the pins are changed in a reviewed commit, per FR-001.

## Assumptions

- The pins of Debian 13.8 are the SHA-256 of the files named in the installer's `SHA256SUMS`, checked against the files themselves on 2026-11-21.

## Open questions

- None.

## Key entities

- **Profile**, **Pin**, **Install document**.

## Success criteria

- **SC-001**: The tests of the library pass with real sockets on the loopback.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
