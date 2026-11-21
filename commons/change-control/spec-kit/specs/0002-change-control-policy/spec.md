# Feature Specification: Change Control: the policy and the judgement

**Spec ID:** 0002-change-control-policy
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** What a fleet decides about its own changes (its signers, the paths that are controlled and the roles whose approval they need) and the judgement of a range of changes by it: a signed change is accepted, an unsigned one refused, a change to a controlled path blocked until a different signer of an approving role approves it.

## Requirements

- **FR-001**: `parsePolicy` MUST give a policy from what a fleet wrote only where there is at least one signer, each with a name (lowercase letters, digits, dots and dashes), a role and one public key line that Git can verify with (a private key, or anything else, MUST be refused), a signer is named once, and each controlled path is a path of the repository with at least one approving role that some signer has; every reason MUST be given.
- **FR-002**: `allowedSigners` MUST give the text of an `allowed_signers` file that Git verifies with: a line for each signer, its name as the principal, for signatures made for Git.
- **FR-003**: `judgeRange` MUST accept a commit that Git says is signed well (`G`) by a signer of the fleet and that changes no controlled path; MUST refuse, with the reason, a commit that is not signed, is signed by a key that is not a signer of the fleet, whose signature is bad, expired or revoked, or that could not be checked; and a range MUST be `ok` only where every commit is accepted.
- **FR-004**: A commit signed by a signer of the fleet that changes a controlled path (`*` any characters but `/`, `**` any characters) MUST be blocked, with the paths and the roles that may approve, unless a later commit of the range is signed by a signer of an approving role who is not the signer of the commit and says `Approves: <the commit, at least seven characters>` in a line of its own; the commit is then accepted and says who approved it.

## Acceptance scenarios

1. **Given** a commit signed by a signer and one that is not signed, **When** the range is judged, **Then** the first is accepted and the second refused with the reason, per FR-003.
2. **Given** a change to `fleets/f/signers.ts` signed by the daily signer, **When** it is judged, **Then** it is blocked, and accepted once the recovery signer approves it, per FR-004.

## Out of scope

- Reading Git, and what to do with a verdict (a gate in CI, a refusal to pull): the program that uses this.

## Edge cases

- A merge commit: not judged, its parents are (the physical layer leaves it out), per FR-003.
- An approval by the signer of the commit itself, or by a signer of another role: not an approval, per FR-004.
- An approval that comes before the commit it approves: not an approval (it cannot name a commit that is not made yet), per FR-004.

## Assumptions

- The signers' public keys are the fleet's own, kept in its repository and changed only through this control.

## Open questions

- None.

## Key entities

- **Signer**, **Controlled path**, **Verdict**.

## Success criteria

- **SC-001**: Nothing runs from a repository whose changes were not each signed by a signer of the fleet, and the changes that matter most need two.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
