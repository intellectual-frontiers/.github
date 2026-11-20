# Feature Specification: Archon logical

**Spec ID:** 0003-archon-logical
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The Logical layer of Archon makes, from the requirements of Governance, the model a program reasons with: the order of a subject (its requirements that apply, in the order they can be carried out) and the plan (what differs between what is observed and the order). It is pure: it reads values and returns values, touches no host and holds no state. A plan has a canonical form and a digest, so that a person can approve exactly one plan, and it says what approvals it needs, by the assurance of the fleet.

## Requirements

- **FR-001**: `buildOrder` MUST make the order of one subject from requirements in layers: it MUST keep the requirements whose subject selector (all subjects, a list of names or a class) matches the subject and whose kind applies to the subject's class, and MUST refuse a requirement that appears twice in one layer.
- **FR-002**: Requirements MUST have a precedence by layer, `baseline`, then `fleet`, then `host`, the higher replacing the lower of the same id, and the order MUST record each requirement a higher layer replaced.
- **FR-003**: The order MUST be sequenced so that a requirement comes after every requirement it depends on, and `buildOrder` MUST refuse a dependency on a requirement that is not in the order and a cycle of dependencies, naming the requirements in it.
- **FR-004**: `planOrder` MUST compare the order with what is observed of each resource and give, for each requirement in the order of its sequence, one entry: `none` where the observed state is the desired one, `create` where the resource is absent and must be present, `update` where it differs, and `remove` where it is present and must be absent; two states MUST be the same when their data is equal whatever the order of keys.
- **FR-005**: A plan MUST have a canonical text, a sequence of keys in a fixed order and no space that carries a meaning, and a digest that is the SHA-256 of that text, so that the same plan has the same digest on every machine and any change of any entry changes it.
- **FR-006**: `approvalsNeeded` MUST say, for a plan and an assurance, which destructive entries need a confirmation typed by a person, whether a second approver is needed (where the control asks for one for a destructive entry or for an entry of a tier above `operator`) and whether the digest of the plan must be named by the approval.
- **FR-007**: `destructiveGate` MUST let a plan through only where a confirmation names exactly each destructive entry (the typed text being the requirement id) and every approval that `approvalsNeeded` asks for is given, and otherwise MUST name what is missing; a plan with no destructive entry and no other approval needed MUST pass with no confirmation.

## Acceptance scenarios

1. **Given** requirements in the layers baseline and host for the same id, **When** the order is built, **Then** the host's is kept and the baseline's is recorded as replaced, per FR-002.
2. **Given** two requirements that depend on each other, **When** the order is built, **Then** it is refused and both are named, per FR-003.
3. **Given** an order and an observed state that is the desired one, **When** the plan is made, **Then** every entry is `none`, per FR-004.
4. **Given** the same plan with its keys written in another order, **When** the digests are taken, **Then** they are equal, per FR-005.
5. **Given** a plan that removes a package, **When** the gate is asked with no confirmation, **Then** it names the requirement as missing a confirmation, and with the requirement id typed it passes, per FR-007.
6. **Given** the profile `regulated` and a plan with a destructive entry, **When** the approvals needed are asked, **Then** a second approver and the digest are asked for, per FR-006.

## Out of scope

- Observing a subject: the library of estate and the query of osquery.
- Carrying out a plan: the dialects, through the executor of headless.

## Edge cases

- A requirement whose kind does not apply to the subject's class is not in the order, per FR-001.
- A resource that is absent and must be absent has an entry `none`, per FR-004.
- An empty order gives an empty plan with a digest, per FR-005.

## Assumptions

- The observed state of a resource is data, or nothing where the resource is absent.

## Open questions

- None.

## Key entities

- **Order** - the requirements that apply to a subject, in the order they can be carried out, with what replaced what.
- **Plan** - the entries that say what differs from what is observed.

## Success criteria

- **SC-001**: The same order and the same observed state give the same plan text and digest on every machine.
- **SC-002**: A destructive change cannot be carried out without the confirmations its assurance asks for.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
