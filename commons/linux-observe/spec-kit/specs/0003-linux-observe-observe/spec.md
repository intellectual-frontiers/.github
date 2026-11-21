# Feature Specification: Linux observation: observing a machine

**Spec ID:** 0003-linux-observe-observe
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Observing a Linux machine for the requirements of an order, through any way of running a program, with no change.

## Requirements

- **FR-001**: Observation MUST run only programs that read (`getent`, `id`, `stat`, `cat`, `systemctl is-active`, `systemctl is-enabled`, `dpkg-query` and `readlink`), MUST put the prefix that raises rights in front of each where one is given, MUST give an entry only for a resource that is there, and MUST skip a requirement whose desired state is not an object.
- **FR-002**: On a real machine, one made as an order declares MUST be observed equal to what is declared, one that differs MUST be observed as it is, and a resource that is not there MUST have no entry; the observation MUST change nothing.

## Acceptance scenarios

1. **Given** a machine made as declared, **When** it is observed, **Then** every observation equals its declaration, per FR-002.

## Out of scope

- Changing the machine: a dialect of Archon.

## Edge cases

- A service that does not exist is observed as not running and not enabled, per FR-001 of 0002-linux-observe-shapes.

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
