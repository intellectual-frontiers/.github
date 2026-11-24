# Feature Specification: AnyFS Bridge: two-way sync and mirror

**Spec ID:** 0004-bridge-twoway
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A two-way sync against a base that records what the sides agreed on, and a mirror whose replica is in sync, behind or diverged and is never merged.

## Requirements

- **FR-001**: A base MUST be the SHA-256 of each path as the two sides last agreed, kept as pairs in the order of the paths and refused where a path or a digest is not one; a sync MUST be given a base or say `seed`, which MUST agree on what is equal, copy what is on one side only, leave what differs to the policy and delete nothing.
- **FR-002**: A path that only one side changed since the base MUST go to the other side, a path both sides changed to the same bytes MUST be agreed, a path both have as the base says MUST be left, and a sync made again after its apply MUST plan nothing.
- **FR-003**: A path both sides changed differently MUST be settled by the policy: `newer-wins` MUST make the newer the winner where both sides say when they changed it and are not the same time and otherwise MUST leave a conflict; `keep-both` MUST make the newer (or side `a` at a tie) the winner and keep the loser's bytes beside it under a name made of the path, the loser's side and eight digits of its digest, at the winner's side, where they reach the other side at the next sync; `fail` MUST leave every such path as a conflict that keeps what the base said.
- **FR-004**: A delete made on one side MUST reach the other within the delete policy and as a skip where deletes are forbidden, and MUST be refused with the number wanted where it is more than the allowance; a path changed on one side and deleted on the other MUST keep the change; and a path whose change did not succeed MUST go back to what the base said.
- **FR-005**: A path of a replica MUST be `same` where the primary and the replica hold the same bytes, `diverged` where the replica is not what the ledger says it was brought to, and `behind` otherwise; a replica MUST be `in-sync` where no path is behind or diverged, `behind` with the number of paths where some are behind, and `diverged` with the paths where any is.
- **FR-006**: A convergence MUST copy and delete the paths that are behind and MUST NOT touch, merge or overwrite a path that is diverged; MUST delete only within the delete policy; and MUST give the ledger with the bytes each path was brought to, keeping the old entry of a diverged path and of an action that failed.
- **FR-007**: A replica MUST become the primary only as an explicit act that is refused while it is behind unless the caller accepts to lose that many changes and while it is diverged unless the caller accepts the divergence, and that gives the roles swapped with the number of changes that are lost.
- **FR-008**: After a promotion the old primary MUST be a replica of the new one with a ledger of the paths where the two agree, so that whatever it holds that the new primary does not is seen as diverged until a person decides.

## Acceptance scenarios

1. **Given** two sides with no base, **When** they are seeded, **Then** what is equal is agreed and what is on one side only is copied, per FR-001.
2. **Given** a base, a change at `a` and another path changed at `b`, **When** they are synced, **Then** each goes to the other side and a second sync plans nothing, per FR-002.
3. **Given** a path both sides changed, **When** the policy is `keep-both`, **Then** the newer wins and the other is kept beside it, per FR-003.
4. **Given** a path deleted at one side and changed at the other, **When** they are synced, **Then** the change is kept, per FR-004.
5. **Given** a replica edited by someone else, **When** it is converged, **Then** that path is left as it is and named as diverged, per FR-005 and FR-006.
6. **Given** a replica that is behind, **When** it is promoted without accepting the loss, **Then** it is refused with the number of changes, per FR-007.

## Out of scope

- Merging the contents of two versions of a file; a continuous watcher that runs the convergence.
- Keeping the base or the ledger: they are values, and the caller keeps them (for example in a collection).

## Edge cases

- A conflict copy is made at the winner's side at once and reaches the other side at the next sync (FR-003).
- An empty base said out loud is the same as a seed (FR-001).
- A side that does not say when a file changed leaves a `newer-wins` conflict as `no-time` (FR-003).

## Assumptions

- The sides are stores that can be read, listed and written, and their SHA-256 comes from their revisions or from their bytes (0003-bridge-transfer FR-002).

## Open questions

- None.

## Key entities

- **Base**, **Seed**, **BiPlan**, **BiAction**, **Ledger**, **ReplicaState**, **Promotion**.

## Success criteria

- **SC-001**: Every behaviour is tested over stores in memory and, where it touches a file system, stores in a folder, with no network and no real time.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
