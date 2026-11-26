# Feature Specification: Ansible dialect: the families of Linux

**Spec ID:** 0003-ansible-families
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The dialect converges a machine of any family that ansible-core has builtin modules for, so that a fleet of Ubuntu, Debian and Rocky machines is one order and one plan, and what a family does not carry is said with the reason and never left out silently.

## Requirements

- **FR-001**: The dialect MUST take the family of the machine (`debian`, `rhel`, `suse`, `arch` of commons linux-observe 0004-linux-observe-platform; `debian` where none is given) and MUST carry a package by `ansible.builtin.apt` on `debian` and by `ansible.builtin.dnf` on `rhel`, writing the version as the package manager of the family writes it (`name=version` and `name-version`), and `update_cache` MUST be asked of apt alone.
- **FR-002**: A service MUST be carried by `ansible.builtin.systemd`, which every version of ansible-core has (the alias `systemd_service` does not exist before ansible-core 2.15), and the locale MUST be written to `/etc/default/locale` with the package `locales` on `debian` and to `/etc/locale.conf` with no package on the other families, and the time zone MUST be the link `/etc/localtime` on every family and the file `/etc/timezone` as well on `debian`.
- **FR-003**: What the dialect does not carry for a family MUST be a reason for the requirement and never left out: a package on `suse` and `arch` (ansible-core has no builtin module for them, and no collection is pinned), and the keyboard layout on every family but `debian`; `guarantees.kinds` MUST name only the kinds carried for the family, and `kindsCarriedFor(family)` MUST say the same.
- **FR-004**: On a real machine of each of Debian 13 (ansible-core 2.19) and Rocky Linux 9 (ansible-core 2.14), with the real tool, the same order MUST be shown by a check that changes nothing, applied, applied again with no change, and a change made by hand MUST be found again.

## Acceptance scenarios

1. **Given** an order with a package and the family `rhel`, **When** it is rendered, **Then** the task is `ansible.builtin.dnf` and none is `apt`, per FR-001.
2. **Given** a package and the family `arch`, **When** it is rendered, **Then** it is refused with the reason, per FR-003.
3. **Given** a Rocky machine, **When** the order is applied twice, **Then** the second apply changes nothing, per FR-004.

## Out of scope

- The packages of `suse` and `arch` (and of Omarchy, which is Arch): a collection of ansible-core, which the owner approves and pins first.
- The tool's version per distribution: the fleet gives it (`version`); each distribution ships its own.

## Edge cases

- A family the dialect is not given: `debian`, as before, per FR-001.
- A requirement for a service name that differs by family (`ssh` and `sshd`): the fleet writes the name of the family; it is not translated here, per FR-002.

## Assumptions

- The machine has Python 3 for ansible-core, as every distribution of these families does.

## Open questions

- None.

## Key entities

- **Family**, **Carried kind**.

## Success criteria

- **SC-001**: A fleet of Ubuntu, Debian and Rocky machines converges from one order, with what a family cannot do said.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
