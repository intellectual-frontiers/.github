# Feature Specification: Linux observation: observing a machine

**Spec ID:** 0003-linux-observe-observe
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Observing a Linux machine for the requirements of an order, through any way of running a program, with no change.

## Requirements

- **FR-001**: Observation MUST run only programs that read (`getent`, `id`, `stat`, `cat`, `systemctl is-active`, `systemctl is-enabled`, `dpkg-query`, `rpm`, `pacman`, `readlink` and `uname`), MUST put the prefix that raises rights in front of each where one is given, MUST give an entry only for a resource that is there, and MUST skip a requirement whose desired state is not an object.
- **FR-002**: On a real machine, one made as an order declares MUST be observed equal to what is declared, one that differs MUST be observed as it is, and a resource that is not there MUST have no entry; the observation MUST change nothing.
- **FR-003**: A package MUST be read by the program of the family of the machine (0004-linux-observe-platform): `dpkg-query` on `debian`, `rpm -q` on `rhel` and `suse` and `pacman -Q` on `arch`; a package that is not installed MUST have no entry on every family; a setting of the system MUST be read from the file of its family (the time zone from `/etc/localtime` everywhere, the locale from `/etc/default/locale` on `debian` and `/etc/locale.conf` on the others), and the keyboard layout, which only `debian` keeps as a layout of the same name, MUST have no entry on the others.

## Acceptance scenarios

1. **Given** a machine made as declared, **When** it is observed, **Then** every observation equals its declaration, per FR-002.

## Out of scope

- Changing the machine: a dialect of Desired OS State.

## Edge cases

- A service that does not exist is observed as not running and not enabled, per FR-001 of 0002-linux-observe-shapes.

## Assumptions

- The machine is Linux with systemd; the package program is the one of its platform (0004-linux-observe-platform).

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
