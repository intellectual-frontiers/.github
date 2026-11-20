# Feature Specification: Machine probe observation

**Spec ID:** 0003-machine-probe-observation
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The facts a probe gives, read into a typed observation (the operating system, the hardware, the security settings, the software and the ports that listen), the keyed records of it that an estate compares with what is declared, and asking a probe through the ssh client or another way of running a command, with an error that says why where it cannot be answered.

## Requirements

- **FR-001**: `parseProbe` MUST read `@section` lines and `key=value` lines into a record of sections, MUST accept lines ending in a carriage return, and MUST skip blank lines and lines before any section.
- **FR-002**: `toObserved` MUST give a typed observation from the sections, with `unknown` for a security setting the probe did not give, numbers as numbers, the administrators sorted and the ports in order, and MUST refuse a probe that gave no time, because an observation with no time is not evidence.
- **FR-003**: `observedState` MUST give keyed records of the system, the security settings, the software and the ports, and MUST NOT hold the time of the observation, the version of the probe or a counter that changes on its own, so that two observations of a machine that did not change are equal.
- **FR-004**: `observe` MUST give the observation of a machine sent `facts`, `unreachable` where the command did not run or the ssh client could not reach it (status 255), `refused` where the probe ended with another status, and `unreadable` where what it printed is not facts; and `query` MUST refuse a query that is not one SELECT before sending anything, and give the rows of osquery as text.

## Acceptance scenarios

1. **Given** the output of a real probe on Ubuntu, **When** it is read, **Then** the family is ubuntu, the version 24.04 and the packages are counted, per FR-001 and FR-002.
2. **Given** a probe output with no time, **When** it is read, **Then** it is refused, per FR-002.
3. **Given** two observations that differ only in time, **When** their keyed records are compared, **Then** they are equal, per FR-003.
4. **Given** a command that ends with 255, **When** the machine is observed, **Then** the error is `unreachable` and never an observation, per FR-004.

## Out of scope

- Judging an observation: the policy pack (0004-machine-probe-policies).
- Keeping an observation: the fleet's repository does.

## Edge cases

- A value that contains `=` keeps everything after the first `=`, per FR-001.

## Assumptions

- Every value of osquery is text, as osquery prints it.

## Open questions

- None.

## Key entities

- **Observation** - what the probe found on a machine, with the time and the version of the probe.

## Success criteria

- **SC-001**: A machine that cannot be asked is never reported as agreeing with what is declared.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
