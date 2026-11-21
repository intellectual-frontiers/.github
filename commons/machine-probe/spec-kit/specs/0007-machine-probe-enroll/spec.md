# Feature Specification: Enrolling a machine for observation

**Spec ID:** 0007-machine-probe-enroll
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** How a machine comes to be observed by the probe: the person compares the machine's host key, a key restricted to the probe is made and installed over the person's own ssh, and the probe is then asked with that key alone; and how the policy pack judges what it saw. A program gives the files it keeps (the reach, the observation, the known hosts); this gives the data and does the ssh.

## Requirements

- **FR-001**: An address MUST be read as `user@host` or `user@host:port` (a port from 1 to 65535), and anything else MUST be refused with the reason.
- **FR-002**: Enrolling MUST first show the fingerprints of the host keys the machine presents and do nothing else (it MUST write no file and install nothing) until the person gives the fingerprint they compared; a fingerprint that is not one of the machine's MUST pin nothing and install nothing and say so.
- **FR-003**: With the right fingerprint, enrolling MUST pin that host key and only it in the known-hosts file (once, however many times it is repeated), make a key for the probe in the folder of keys (readable by its owner alone, made once), and install the probe and exactly one line that restricts the key to it in the person's own account over the person's own ssh (once, however many times it is repeated), and MUST give the reach, the file of the private key and the line; the probe MUST then answer to the restricted key through `probeExecutor`.
- **FR-004**: The observation of a machine MUST be judged by the policy pack and the risks accepted for it: an accepted risk is `accepted` and never a pass, and a machine that was never observed is `waiting` in the policy that says so and MUST NOT be failing.

## Acceptance scenarios

1. **Given** a machine and no fingerprint, **When** it is enrolled, **Then** its fingerprints are shown and nothing is written or installed, per FR-002.
2. **Given** the right fingerprint, **When** it is enrolled twice, **Then** one host key is pinned and one restricted line is installed, per FR-003.

## Out of scope

- Where a program keeps the reach and the observation: the program's.
- The probe's script and its key line: 0002-machine-probe-contract.

## Edge cases

- A machine that presents several host keys: the one compared is pinned, per FR-002.

## Assumptions

- The person's own ssh reaches the machine as the account.

## Open questions

- None.

## Key entities

- **Enrollment**, **Reach**, **Judgement**.

## Success criteria

- **SC-001**: A machine is enrolled and observed with a key that can do nothing else.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
