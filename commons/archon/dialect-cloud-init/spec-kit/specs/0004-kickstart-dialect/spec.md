# Feature Specification: Kickstart dialect

**Spec ID:** 0004-kickstart-dialect
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The dialect of Archon for the install of a machine of the Red Hat family from nothing: the Kickstart file that Anaconda reads over the network, made from the same facts as the Ubuntu autoinstall and the Debian preseed.

## Requirements

- **FR-001**: The dialect MUST declare as data the same kinds as the autoinstall dialect (`user`, `ssh-authorized-key`, `system-setting` and `package`), reach subjects of the class `machine`, have no plan, prove nothing by a run of the tool and say that it destroys (it erases a disk), and MUST take the facts of an install from the order and the options exactly as the autoinstall dialect does (0002-cloud-init-dialect FR-002, FR-007).
- **FR-002**: The render MUST be one file, `kickstart/ks.cfg`, saying that it is generated, the same text and digest for the same order and options, that sets the host name, the administrator (in the group `wheel`, with the root account locked), the locale, the keyboard layout, the time zone, the repositories (through the proxy where one is given), the disk and the packages, including the packages the first boot needs (`curl`, `git`, `openssh-clients` and `ansible-core`).
- **FR-003**: The render MUST hold no secret: the hash of the administrator's password MUST be the placeholder `@archon:password-hash@`, which the boot server replaces when it serves the file; the administrator's keys MUST be given to the installer as keys and password sign-in for ssh MUST be turned off.
- **FR-004**: The install MUST write to the new system, in a `%post` section, the files the first boot of an Ubuntu install writes (the host, the fleet, the signers, the boot events' address, the converge script, its service and its timer), enable the timer, and tell the boot server that it is done.
- **FR-005**: The disk MUST be the largest one (picked in `%pre`), or the one at the path given, with the layout `lvm` or `direct`; the render MUST refuse the layout `zfs`, which the installer does not have, and MUST refuse what the autoinstall dialect refuses (a kind it does not carry).

## Acceptance scenarios

1. **Given** an order of an administrator, a key, a time zone, a locale and a keyboard layout, **When** it is rendered, **Then** the Kickstart has the user, the key, the placeholder in place of the hash and the locked root, per FR-002 and FR-003.
2. **Given** the `%post` section, **When** its files are decoded, **Then** they are the files of the first boot, per FR-004.
3. **Given** the layout `zfs`, **When** it is rendered, **Then** it is refused, per FR-005.

## Out of scope

- Serving the file and pointing the installer at it: booting is not a concern of commons.
- Running the installer: it needs a machine that boots from the network, which the owner verifies on hardware.
- The blank-disk guard: Anaconda's environment has neither `curl` nor `lsblk`, so the boot command asks for `--confirm-destroy yes` when it arms an asset for this installer.

## Edge cases

- A requirement of a kind that is not carried is refused, per FR-005.

## Assumptions

- The directives are those of Anaconda in Rocky Linux 9; a directive the installer does not take stops the install with a message at the console, which is visible, never silent.

## Open questions

- None.

## Key entities

- **Install facts**, **Kickstart**, **First boot**.

## Success criteria

- **SC-001**: The tests of the library pass.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
