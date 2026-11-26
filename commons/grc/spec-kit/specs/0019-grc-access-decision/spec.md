# Feature Specification: GRC access decision

**Spec ID:** 0019-grc-access-decision
**Status:** Active
**Owner:** if
**Domain:** grc

**Input:** The record of one decision about one request that commons 0047-zero-trust FR-010 asks for is a document of the envelope, `grc.access-decision`: a subject (a person, a service, a device or an agent), the resource and the action, the access policy by id and hash, the outcome and the reasons, the posture signals it used, the channel, when it was decided and by which decision point, and optionally the person and the plan an agent acts for, its expiry, the enforcement point, the decision it revokes, its evidence and its signature. It is signed by the signers `grc` already has. With it come four pure computations that the evidence plane needs: the digest a signature covers, the signals that had aged, the replay of recorded decisions against a candidate policy, and the time from a revocation to each refusal.

## Requirements

- **FR-001**: `accessDecision` MUST be a kind of document `grc.access-decision` at schema `1` whose body has a subject of a kind from `SUBJECT_KINDS` (`person`, `service`, `device`, `agent`) and an id, the resource, the action, the policy by id and hash, an outcome from `OUTCOMES` (`permit`, `deny`, `step-up`, `revoke`), the reasons, the signals (each a name, a source, an instant of observation and a digest), the channel, the instant it was decided and the decision point; and MAY have `actingFor` (a person and a plan), `expiresAt`, `enforcedAt`, `revokes`, `evidence`, `signature` and `signer`. A document with another kind or schema MUST be refused.
- **FR-002**: A decision whose outcome is `permit` or `step-up` MUST have an expiry later than the instant it was decided; a decision whose outcome is `deny` or `step-up` MUST have at least one reason that is not empty; a decision whose outcome is `revoke` MUST name the decision it ends in `revokes`; and the decoder MUST refuse each that does not, naming what is missing.
- **FR-003**: A decision whose subject is an `agent` MUST have `actingFor`, naming the person and the plan, and the decoder MUST refuse one that does not; no signal of a decision MUST have been observed after the decision was made.
- **FR-004**: `decisionDigest(decision)` MUST be the SHA-256 of the canonical form of the decision without its signature and its signer, so that a decision has the same digest signed and unsigned and a change of any other field changes it.
- **FR-005**: `agedSignals(decision, maxAgeMs)` MUST be a pure function that gives the signals that were older than `maxAgeMs` when the decision was decided, in their order, and none when no signal was.
- **FR-006**: `replayAgainst(decisions, candidate)` MUST be a pure function that gives, for a candidate policy written as a function of the decision, the permits that would become denials, the denials that would become permits and the number whose outcome would not change; it MUST NOT change the decisions it is given, and an outcome other than `permit` MUST count as a refusal.
- **FR-007**: `timeToRefusal(revokedAt, refusals, points)` MUST be a pure function that gives, for each named enforcement point in order, the milliseconds from the revocation to the first refusal at that point at or after it, and `undefined` for a point that has no such refusal.

## Acceptance scenarios

1. **Given** a permit with an expiry after its decision, **When** it is decoded, **Then** it is read, and the same permit with no expiry is refused, per FR-001 and FR-002.
2. **Given** a denial with no reason, a revocation that names nothing and an agent that acts for no one, **When** each is decoded, **Then** each is refused, per FR-002 and FR-003.
3. **Given** a decision signed and the same unsigned, **When** their digests are taken, **Then** they are equal, and a changed outcome changes it, per FR-004.
4. **Given** a decision with a signal observed two days before it, **When** the aged signals are asked for with a limit of one day, **Then** that signal is given, per FR-005.
5. **Given** three recorded decisions and a candidate that denies every root action, **When** they are replayed, **Then** the permits of root actions are listed as becoming denials and the others are counted as unchanged, per FR-006.
6. **Given** a revocation at an instant and refusals at two of three points, **When** the time to refusal is asked for, **Then** the two are given in milliseconds and the third is `undefined`, per FR-007.

## Out of scope

- The evaluation of the access policy (commons 0047-zero-trust FR-013), the signing (the signers of `grc`) and the keeping of the record in a journal (commons 0047-zero-trust FR-015).

## Edge cases

- A decision with no signals is valid (FR-001), and `agedSignals` gives none (FR-005).
- A refusal before the revocation does not count as a refusal after it (FR-007).
- A candidate that returns `step-up` for a recorded permit counts that permit as a refusal (FR-006).

## Assumptions

- The decision point and the policy are named by id; their meaning is the product's.

## Open questions

- None.

## Key entities

- **Access decision** - the signed record of one decision about one request.
- **Posture signal** - a reading a decision used, by source, time and digest.

## Success criteria

- **SC-001**: Every requirement of 0019-grc-access-decision is proved by a test of the library, with synthetic names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
