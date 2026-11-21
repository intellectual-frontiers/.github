# Feature Specification: Machine probe policies

**Spec ID:** 0004-machine-probe-policies
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The policy pack that judges an observation of a machine that is observed and not managed (Stolos 067-adopt): disk encryption, the firewall, automatic updates, updates waiting, a supported operating system, keys rather than passwords for ssh, anti-malware, few administrators, osquery, and how recent the observation is. Each policy names the NIST SP 800-53 Rev 5 controls it gives evidence for and how to make it pass on the machine's system.

## Requirements

- **FR-001**: The pack MUST hold the ten policies `observed`, `disk-encryption`, `firewall`, `auto-updates`, `updates-waiting`, `supported-os`, `ssh-keys-only`, `antivirus`, `few-admins` and `osquery`, in that order, each with a title and at least one control, so that no result is without a control (no compliance without traceability).
- **FR-002**: `evaluate` MUST give the result of every policy that applies to the observation, in order, with its verdict, its detail, its controls and how to make it pass on the system observed, and MUST give nothing for a policy that does not apply (no antivirus fact, no ssh setting, no updates count).
- **FR-003**: A setting `on` MUST pass and `off` MUST fail, `manual` automatic updates MUST warn, a setting the probe could not tell MUST be `unknown`, an observation older than seven days MUST fail, more than twenty updates waiting or more than three administrators or ssh passwords or no osquery MUST warn, and a system the maker no longer supports MUST fail while one the table does not know MUST be `unknown`.
- **FR-004**: The results MUST be usable by an estate as policy outcomes: each has the policy's id, its finding and its controls.

## Acceptance scenarios

1. **Given** the observation of a real Ubuntu machine with the disk, firewall and updates off, **When** it is evaluated, **Then** those policies fail and each names its controls, per FR-002 and FR-003.
2. **Given** an observation with no ssh setting, **When** it is evaluated, **Then** there is no result for `ssh-keys-only`, per FR-002.
3. **Given** the results of an estate's machine, **When** its invariants are checked, **Then** no result lacks a control, per FR-001 and FR-004.

## Out of scope

- The policies of a controller PC (its signing keys, backups and recovery key): the fleet's host program adds them.
- Accepting a risk and showing the status: the estate library (estate 0003-estate-logical FR-005, FR-006).

## Edge cases

- A rolling distribution is supported, per FR-003.

## Assumptions

- The supported releases are a starter table kept in code, reviewed with each release.

## Open questions

- None.

## Key entities

- **Policy** - what an observation must show, with its controls and its fix.

## Success criteria

- **SC-001**: Every verdict an auditor reads names the controls it is evidence for.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
