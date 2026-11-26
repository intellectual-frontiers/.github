# Feature Specification: Desired OS State governance

**Spec ID:** 0002-desired-os-state-governance
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The Governance layer of Desired OS State says, in the words of its domain and once, what a subject must be and how a change to a fleet is approved. A requirement names what must hold, why, for which subjects, of which kind of resource, how much a change to it matters and how it is verified. An assurance profile (`solo`, `team` or `regulated`) says how strictly a fleet approves changes, as a table of controls, and a floor that no profile lowers is stated beside it. Everything here is pure data and pure functions: no file, no process, no clock.

## Requirements

- **FR-001**: The library MUST make a requirement id, a resource kind id, a subject name and a secret reference only by functions that validate them (a requirement id is lower case words joined by dots or hyphens, at most 100 characters; a subject name is a host name; a secret reference is `secret:<store>/<name>`), and a text that is none of them MUST be refused with the rule it broke.
- **FR-002**: The library MUST give the catalogue of resource kinds as data, each with its id, a sentence, the classes of subject it applies to (`machine`, `device`, `workstation`, `cloud-account`) and whether it can destroy, and the catalogue MUST include kinds for the packages, users, files, services, firewall rules and SSH keys of a machine, the tools a computer needs at a pinned version, the DNS records of a zone and the resources of a cloud account.
- **FR-003**: `defineRequirement` MUST return a requirement or every reason it is not one: it MUST refuse a requirement with no reason (`why`), a kind that is not in the catalogue, a subject class the kind does not apply to, a desired state that is not data, a destructive requirement that does not say how it can be rolled back, and a requirement that asks for a resource to be absent unless its change class is `destructive`.
- **FR-004**: `findSecretLike` MUST find, in a desired state, every text that looks like a secret (a private key block, an access key of a cloud, a token of a code host, or any text under a key named for a password, a passphrase, a secret, a token or a private key that is not a secret reference), by the path where it was found, and `defineRequirement` MUST refuse a desired state in which it finds one.
- **FR-005**: The library MUST give the controls of each assurance profile as data: how a change is approved (an authenticated push, a signed commit, or a signed commit with a second approver), how a key is held, what a machine accepts as a tip, how recovery works, what is audited, how remote access is exposed, whether a second approver is needed for a change of tier or a destructive change, whether the hash of the plan is required, and how strictly tools are pinned (any current version, a release line, or one exact version with the hash of its artifact); and the profiles MUST be ordered from the least to the most strict, each control value having a rank.
- **FR-006**: A fleet MUST be able to override one control of its profile with a value, a reason and a date, and the library MUST refuse an override with no reason, a control it does not have, and a value that is not one of the control's values, and MUST keep every override in the resolved assurance so that a report can say it.
- **FR-007**: The library MUST state, as data, the floor that holds whatever the profile and whatever the overrides: no secret in a model, a specification, a commit, a log or a report; no library stores or sees a passphrase; an agent proposes and a person approves; a destructive action needs the marker of its requirement and a confirmation typed by a person.
- **FR-008**: `judgeAssuranceChange` MUST decide whether a tip that proposes an assurance is accepted, by the assurance in force and not by the one proposed: it MUST name each control of the assurance in force that the evidence of the approval does not meet and refuse the change where there is one, it MUST accept a change that the evidence meets, and it MUST record, for an accepted change that lowers a control, which controls it lowers, so that a commit cannot lower its own bar.
- **FR-009**: Each control of a profile MUST be either mapped onto workload's autonomy and approver rules where the semantics are identical, or kept in Desired OS State and documented as encoding more: `planHash` `required` is workload's approval by hash and is mapped (workload approves only by hash, so `optional` is stricter in workload and never lower); the `destructive` change class and `ensure` absent are mapped to the autonomy `human-only` of the approval; `secondApprover` (workload has one approver) and the typed confirmation of the floor are kept in `stateGate`; `approval`, `keyCustody`, `tipAccept`, `recovery`, `audit`, `exposure` and `toolIntegrity` say how a fleet is run and not how a plan is approved, and are kept as data.

## Acceptance scenarios

1. **Given** the text `web-01.example.test`, **When** it is made a subject name, **Then** it is one, and `Web 01` is refused with the rule, per FR-001.
2. **Given** a requirement for a package with no `why`, **When** it is defined, **Then** it is refused with that reason, per FR-003.
3. **Given** a desired state with a private key block under `content`, **When** the requirement is defined, **Then** it is refused and the path `content` is named, per FR-004.
4. **Given** the profile `solo` and the profile `regulated`, **When** their controls are read, **Then** every control of `solo` has a rank lower than or equal to that of `regulated`, per FR-005.
5. **Given** an override of `keyCustody` with no reason, **When** the assurance is resolved, **Then** it is refused, per FR-006.
6. **Given** the profile in force `team` and a proposed `solo` with evidence of an authenticated push only, **When** the change is judged, **Then** it is refused and the controls that are not met are named, per FR-008.
7. **Given** the profile in force `team` and a proposed `solo` with evidence of a signed commit by a listed signer with a hardware key, **When** the change is judged, **Then** it is accepted and the lowered controls are recorded, per FR-008.

## Out of scope

- Keys, signatures and the verification of a tip: the library of signing.
- The resolution of a subject selector by tags: the library of tags (the selector here names subjects, all subjects or a class).

## Edge cases

- A requirement for a kind that does not apply to the subject class it names: refused, per FR-003.
- An override that raises a control: accepted with its reason, per FR-006.
- A change that lowers nothing: accepted when the evidence meets the profile in force, with an empty record of lowered controls, per FR-008.

## Assumptions

- A secret-looking text is a reason to refuse and never a proof that no secret is present: the check is a guard, and the rule is that the model holds only references, per FR-004.

## Open questions

- None.

## Key entities

- **Requirement** - what a subject must be, with its why, its change class and its verification.
- **Assurance** - a profile and its overrides, resolved to controls.
- **Floor** - what holds whatever the profile.

## Success criteria

- **SC-001**: A requirement that holds a secret, has no reason or asks for a kind its subject cannot have is never made.
- **SC-002**: A commit cannot lower the assurance of the fleet that follows it.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
