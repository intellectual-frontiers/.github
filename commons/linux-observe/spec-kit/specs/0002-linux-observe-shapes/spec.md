# Feature Specification: Linux observation: the shapes

**Spec ID:** 0002-linux-observe-shapes
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** What a command printed, read in the shape that an Desired OS State requirement declares its resource in, as pure functions.

## Requirements

- **FR-001**: A user MUST be read as its name and, only where the requirement declares them, its uid, comment, shell, home and the groups it names that the user is in (in the order the requirement names them); a group as its name; a service as its name, whether it is running and whether it starts at boot, and a service MUST always be there to ask about; nothing MUST be there where the line of the passwd or group database is.
- **FR-002**: A file and a directory MUST be read from their `stat` as their path and, as far as the requirement declares them, the owner, the group and the mode (written as long as the requirement writes it), and a file also its content; a file that is a directory, and a directory that is a file, MUST NOT be there.
- **FR-003**: An authorized key MUST be the requirement itself where the key file holds its line and nothing where it does not (the key file being the requirement's path or the account's `.ssh/authorized_keys`); a package MUST be there where its status says installed, with its version where the requirement names one; a setting of the system MUST be read from where it is held (the time zone from where `/etc/localtime` points, the keyboard layout from `XKBLAYOUT` and the locale from `LANG`) and be nothing where it is not held.

## Acceptance scenarios

1. **Given** a user in the passwd database, **When** it is read, **Then** only the fields the requirement declares are in the shape, per FR-001.

## Out of scope

- Running the programs: 0003-linux-observe-observe.

## Edge cases

- A requirement that says less is satisfied by more, because a field it does not declare is not read, per FR-001.

## Assumptions

- The machine is Ubuntu or Debian with systemd, as the programs read assume.

## Open questions

- None.

## Key entities

- **Shape**, **Observation**.

## Success criteria

- **SC-001**: A machine made as an order declares is observed equal to the order.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
