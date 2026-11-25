# Feature Specification: Linux observation: the platform of a machine

**Spec ID:** 0004-linux-observe-platform
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The kind of Linux a machine is (its family, distribution, release and architecture) read with no change, and the platform a model declares, so that a dialect carries and an observation reads each resource by the program of the family, and a machine that is not what its model says is said and not converged as though it were.

## Requirements

- **FR-001**: The library MUST name the families of Linux it tells apart by how packages are managed (`debian`, `rhel`, `suse`, `arch`) and the architectures (`x86_64`, `aarch64`); whether a machine is a server, a workstation or a workshop is the kind of its asset and is not said here, and MUST give the family of a distribution from the `ID` of its `os-release` and, where that is not known, from its `ID_LIKE`; a distribution of no known family MUST be named and never guessed.
- **FR-002**: The platform MUST be read from the text of `os-release` (values in single or double quotes) and from the output of `uname -m` (`amd64` and `arm64` read as `x86_64` and `aarch64`), giving the family, the `ID` (the distribution), the `VERSION_ID` (the release, empty on a rolling release) and the architecture where it is known.
- **FR-003**: A platform a model declares MUST be parsed with every reason it is refused, and a distribution declared in a family it is not of MUST be refused; `platformDrift` MUST say, one sentence each, where the machine differs from the declaration (family, distribution, release where one is declared, architecture).
- **FR-004**: `observePlatform` MUST read the platform through the way of running programs it is given, by `cat` of `/etc/os-release` (or `/usr/lib/os-release`) and `uname -m` and by no program that changes anything, and MUST give the reason where the machine has no `os-release`.

## Acceptance scenarios

1. **Given** the `os-release` of Ubuntu, Debian, Rocky, Fedora, openSUSE and Arch, **When** each is read, **Then** the family is `debian`, `debian`, `rhel`, `rhel`, `suse` and `arch`, per FR-001 and FR-002.
2. **Given** a distribution that derives from Arch and says so in `ID_LIKE`, **When** it is read, **Then** its family is `arch`, per FR-001.
3. **Given** a model that declares Rocky as `debian`, **When** it is parsed, **Then** it is refused, per FR-003.

## Out of scope

- What each family's dialect does with a package, and what the boot of each distribution is: other specifications.

## Edge cases

- An `os-release` with no `ID`, or one of a family that is not known: the reason is given, per FR-002.
- A rolling release with no `VERSION_ID`: the release is empty and a declaration of an empty release is not compared, per FR-003.

## Assumptions

- The machine has `/etc/os-release` or `/usr/lib/os-release`, as every systemd distribution does.

## Open questions

- None.

## Key entities

- **Family**, **Platform**.

## Success criteria

- **SC-001**: Every machine that Archon converges has a platform that is read or declared, and a dialect never carries a package by a program of a family the machine is not.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
