# Feature Specification: Lab machine

**Spec ID:** 0002-lab-machine
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A disposable machine for tests of what runs on a machine: described by data, made as a container with systemd as its first process and a real sshd, reached with a key made for the run and thrown away with it, and honest about what a container is not. Real virtual machines are not used where there is no hardware acceleration: what a container cannot stand in for is named, so that a green run is never read as proof of it, and is left to a real machine.

## Requirements

- **FR-001**: Lab MUST state, for every area of what a machine is (systemd units, packages, users and keys, files, time zone, sshd and a restricted key, host name, firewall, kernel settings, mounts and disks, boot, hardware facts and a power cycle), whether a container stands in for it faithfully or not and why, and MUST list the areas it does not stand in for.
- **FR-002**: `readMachineSpec` MUST give a machine description from data only where the name is lower case words, the image is one of the two releases of Ubuntu the fleet runs, there is at least one user that is not `root` and is named once, the packages are names of the archive and the time zone is of the form area/location, and MUST give every reason it is refused otherwise.
- **FR-003**: `containerfile` MUST give for the same description the same text, with systemd as the first process, sshd as a service and not as a socket, the users with their home folders (and passwordless sudo where asked), the packages once each in order, the time zone where given, and no key and no secret.
- **FR-004**: `startMachine` MUST give a machine whose systemd runs, whose sshd answers on its own port on the machine's own address to a user with the key made for the run and to no other key, whose host key is pinned in a file of known hosts, and which runs a program as root through an executor; and `stop` MUST remove the container and the keys, and twice is safe; a start that fails MUST remove what it made.
- **FR-005**: `runtimeUsable` MUST say why containers cannot be run here (no runtime, no ssh client, no daemon), so that a test that needs one is skipped with that reason and never passes.

## Acceptance scenarios

1. **Given** the areas of a machine, **When** the firewall is looked up, **Then** a container is not faithful for it and the reason is given, per FR-001.
2. **Given** a user named `root` and a time zone `somewhere`, **When** the description is read, **Then** both reasons are given, per FR-002.
3. **Given** the same description twice, **When** the Containerfile is made, **Then** the texts are equal and hold no key, per FR-003.
4. **Given** a runtime, **When** a machine is started, **Then** its sshd answers to its key and refuses another, and after `stop` the container is gone, per FR-004.
5. **Given** no runtime, **When** its usability is asked, **Then** the reason is given, per FR-005.

## Out of scope

- Virtual machines: with no hardware acceleration they are too slow to be a test; the first boot, the disk, the firewall and the power cycle are tried on a real machine.
- What runs on the machine: the probe and the policies are the library `machine-probe`'s.

## Edge cases

- A machine that does not come up in a minute is an error that says what systemd answered, per FR-004.

## Assumptions

- The runtime is Docker or Podman, and where there is no bridge network the machines share the host's network, each with its own sshd port.

## Open questions

- None.

## Key entities

- **Machine description** - the name, the release, the users, the packages and the time zone of a disposable machine.

## Success criteria

- **SC-001**: A test can start a machine, break something on it, and remove it, and nothing is left on the host.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
