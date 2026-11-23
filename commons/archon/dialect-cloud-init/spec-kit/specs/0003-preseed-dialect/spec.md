# Feature Specification: Preseed dialect

**Spec ID:** 0003-preseed-dialect
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The dialect of Archon for the install of a Debian machine from nothing: the preseed that Debian's installer reads over the network, made from the same facts as the Ubuntu autoinstall, so that a requirement states an install once and each installer gets its own words.

## Requirements

- **FR-001**: The dialect MUST declare as data the same kinds as the autoinstall dialect (`user`, `ssh-authorized-key`, `system-setting` and `package`), reach subjects of the class `machine`, have no plan, prove nothing by a run of the tool and say that it destroys (it erases a disk), and MUST take the facts of an install from the order and the options exactly as the autoinstall dialect does (0002-cloud-init-dialect FR-002, FR-007).
- **FR-002**: The render MUST be one file, `preseed/preseed.cfg`, saying that it is generated, the same text and digest for the same order and options, that sets the host name, the administrator (with no root sign-in), the locale, the keyboard layout, the time zone, the mirror (through the proxy where one is given), the disk and the packages, including the packages the first boot needs (`curl`, `git`, `openssh-client` and `ansible-core`).
- **FR-003**: The render MUST hold no secret: the hash of the administrator's password MUST be the placeholder `@archon:password-hash@`, which the boot server replaces when it serves the file; the administrator's keys MUST be written to the new system and password sign-in for ssh MUST be turned off.
- **FR-004**: The install MUST write to the new system, in a late command, the files the first boot of an Ubuntu install writes (the host, the fleet, the signers, the boot events' address, the converge script, its service and its timer) and enable the timer, and MUST tell the boot server that it is done.
- **FR-005**: The disk MUST be the largest one, or the one at the path given, with the layout `lvm` or `direct`; the render MUST refuse the layout `zfs`, which Debian's installer does not have, and MUST refuse what the autoinstall dialect refuses (a kind it does not carry).

## Acceptance scenarios

1. **Given** an order of an administrator, a key, a time zone, a locale and a keyboard layout, **When** it is rendered, **Then** the preseed has the identity, the placeholder in place of the hash and key-only sign-in, per FR-002 and FR-003.
2. **Given** the late command, **When** its files are decoded, **Then** they are the files of the first boot, per FR-004.
3. **Given** the layout `zfs`, **When** it is rendered, **Then** it is refused, per FR-005.

## Out of scope

- The netboot server that serves the file and the boot profile that points the installer at it (commons netboot 0005-netboot-profiles).
- Running the installer: it needs a machine that boots from the network, which the owner verifies on hardware.
- The blank-disk guard: Debian's installer has neither `curl` nor `lsblk`, so it cannot run in it, and the boot command asks for `--confirm-destroy yes` when it arms an asset for this installer.

## Edge cases

- A requirement of a kind that is not carried is refused, per FR-005.

## Assumptions

- The questions the preseed answers are those of Debian 13's installer; a question the installer adds is asked at the console and the install waits, which is visible, never silent.

## Open questions

- None.

## Key entities

- **Install facts**, **Preseed**, **First boot**.

## Success criteria

- **SC-001**: The tests of the library pass.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
