# Feature Specification: Business continuity policy

**Spec ID:** 0039-business-continuity-policy
**Status:** Draft

**Input:** How the systems in each compliance boundary, and the Eidolon
itself, survive the loss of a system, a provider, or a person: recovery
objectives, backups, restore tests, and exercises. It is a policy under
0030-policies, owned by the decision authority in effect.

## Objectives

- **FR-001**: Each system in the system inventory
  (0033-systems-and-data-policy FR-001) MUST state its recovery time
  objective and its recovery point objective. The first is how long it
  may be unavailable. The second is how much recent data its loss may
  cost.
- **FR-002**: Each system's capacity and availability MUST be monitored,
  so that its owner role is warned before the system stops meeting its
  recovery time objective.

## Backups

- **FR-003**: Each system holding data that cannot be regenerated from
  version control MUST be backed up often enough to meet its recovery
  point objective. Each backup MUST be encrypted, and MUST be kept in an
  account or location separate from the system, so that losing the
  system's own account does not also lose the backup.
- **FR-004**: The Eidolon's repositories MUST each have a current copy
  held outside their host, refreshed at least weekly. A copy of the vault
  MUST be held somewhere at least as restricted as the vault
  (0001-eidolon-architecture FR-008).
- **FR-005**: Each system whose recovery time objective is shorter than a
  week MUST have its restore tested at least once a year, against that
  objective. Each test MUST be recorded as evidence
  (0028-compliance-controls FR-018).

## Exercises

- **FR-006**: The recovery of the company's most critical system MUST be
  walked through at least once a year, as if it had been lost, and the
  walk-through recorded as evidence. This may be combined with the
  incident exercise (0035-incident-response-policy FR-010).

## Carried out by

- Crown jewel domains can be administered by at least two people:
  0023-domain-security FR-026.
- Crown jewel domains are registered two years ahead:
  0023-domain-security FR-025.
- Published addresses outlive the systems behind them:
  0024-persistent-addresses FR-002.
- Facts live in plain Git, which every clone holds in full:
  0001-eidolon-architecture FR-005.

## Out of scope

- Who decides when the decision authority is unreachable. That is
  0001-eidolon-architecture OQ-1.

## Edge cases

- A system whose provider closes its account without warning: its backup
  sits in a separate account, so the system can be restored elsewhere,
  per FR-003.
- A site generated entirely from version control: nothing in it needs a
  backup beyond its repository, per FR-003 and FR-004.
- A restore test that takes longer than the recovery time objective: the
  test is recorded, and the gap is treated as a risk, per FR-005 and
  0036-risk-management-policy FR-001.
- The Git host being unavailable for a week: the outside copies of the
  repositories carry the work on, per FR-004.

## Assumptions

- Every system the company relies on can be backed up, or rebuilt from
  version control.

## Open questions

- **OQ-1**: Where the outside copies of the Eidolon repositories are held
  is not yet stated.
- **OQ-2**: Each system's recovery objectives are not yet stated; they
  wait on the system inventory (0028-compliance-controls OQ-3).

## Key entities

- **Recovery objectives**: how long a system may be down, and how much
  recent data its loss may cost.
- **A backup**: an encrypted copy of a system's data, held apart from the
  system.
- **A restore test**: evidence that a backup can bring a system back
  within its objective.

## Success criteria

- **SC-001**: Every system in the inventory has recovery objectives.
- **SC-002**: No system with a short recovery time objective goes a year
  without a restore test.
- **SC-003**: Losing the Git host loses no repository.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No production mechanics (specific tools, file formats, hosting details) —
      those belong to an implementation plan, not this spec
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
