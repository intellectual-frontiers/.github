# Feature Specification: GRC acceptance attestation

**Spec ID:** 0018-grc-acceptance-attestation
**Status:** Draft
**Owner:** if
**Domain:** grc

**Input:** A person's word on a step of an acceptance test (commons 0042-tests-as-workloads FR-011) is a `grc.attestation`: a subject, a check, a claim, a statement, an attester, a role and the digests of the evidence, signed by a signer the policy allows, made by `attest` and read by the `manual` runner, which stays `pending` until a role that may attest has answered. Two things are missing: the claim has two words (`pass`, `fail`) where a person may also skip a step with a reason, and nothing verifies an attestation after it is made (its signature, its role, its custody). This specification adds the third word and the verification. The payload type of an attestation (`application/vnd.grc.attestation+json`) already tells it from other evidence in the signature, so no namespace is added. It is governed by commons 0042-tests-as-workloads (audit rows D1, D2). **Every requirement that asks for code is Deferred.**

## Requirements

- **FR-001**: The claim of an attestation MUST be one of `pass`, `fail` and `skip`; `attest` MUST accept `skip` and the `manual` runner MUST give a `skip` claim the status of a check that a person decided not to answer, with the statement as its reason, and MUST NOT give it `pass`. Relies on audit rows: D1.
- **FR-002**: `verifyAttestation(attestation, signers, keys, policy)` MUST be a pure function over the attestation and the keys it is given (no program, no file, no network, no clock) that gives the attestation where its signature verifies over the canonical text of the attestation without its signature and its signer, by the signer named, with one of the keys; where its role is one `mayAttest` lets; and where the signer's custody is at least the policy's (`signerAllowed`); and otherwise gives the reason, one of `signature`, `role` and `custody`, naming it. Relies on audit rows: D1, D2.
- **FR-003**: Where the policy's custody is `none` the attestation carries no signature and `verifyAttestation` MUST say that it is unsigned and MUST NOT give it as verified; a caller that needs a person's word as evidence MUST use a policy whose custody is above `none`. Relies on audit rows: D1.
- **FR-004**: The subject of an attestation of a step MUST be `case:<case id>@<cycle>` and its check `step:<step id>`, the statement MUST NOT be empty, and its evidence MUST be the SHA-256 of each file the step yielded; the constructor `acceptanceAttestation(input)` MUST make the `AttestInput` of these and refuse an input whose case id, cycle or step id is not a word of its kind or whose statement is empty. Relies on audit rows: D1.
- **FR-005**: The roles that may attest a person's step MUST be a field of the policy that names only roles, and a check of the policy against the workbench contract MUST find a role that the contract holds as an agent or as either (commons 0042 FR-012), as a finding that names it. Relies on audit rows: D1.
- **FR-006**: Signing MUST remain by `ssh-keygen -Y sign` or by the DSSE signer, and only Ed25519 keys MUST be verified (0014-grc-sshsig FR-004); a key of another type MUST be refused as unverified and named. Relies on audit rows: D2.

## Acceptance scenarios

1. **Given** an attestation with the claim `skip` and a statement, **When** the `manual` runner reads it, **Then** the status is the decided one for a skip, not `pass`, per FR-001.
2. **Given** a signed attestation and its key, **When** it is verified, **Then** it is given back, per FR-002.
3. **Given** the same attestation with its statement changed, **When** it is verified, **Then** the reason is `signature`, per FR-002.
4. **Given** an attestation by a role that may not attest, **When** it is verified, **Then** the reason is `role`, per FR-002.
5. **Given** a policy of custody `none`, **When** an attestation is verified, **Then** it is unsigned and not verified, per FR-003.
6. **Given** a step id with a space, **When** `acceptanceAttestation` is called, **Then** it is refused, per FR-004.
7. **Given** a policy that lets a role held as `either` attest, **When** it is checked against the contract, **Then** a finding names the role, per FR-005.

## Out of scope

- The step, the run and the record: workload 0017-workload-test-cases and quality 0003-quality-case-runs.
- A namespace for acceptance (the payload type separates it), and a key of a hardware token that is not Ed25519.

## Edge cases

- An attestation made twice for one step: the newest of an allowed role counts, per FR-002.

## Assumptions

- None.

## Open questions

- None of its own; see commons 0042-tests-as-workloads OQ-6.

## Key entities

- **Attestation** - the signed word of a role on a check of a subject.
- **Claim** - `pass`, `fail` or `skip`.

## Success criteria

- **SC-001**: Every requirement above is proved by a test of this library with synthetic names and no network, or is a row `none` with the note Deferred until the code exists; no row is enforced before it is built.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement names the row of the reuse audit of commons 0042-tests-as-workloads it relies on
