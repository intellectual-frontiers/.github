# Feature Specification: GRC approval

**Spec ID:** 0020-grc-approval
**Status:** Active
**Owner:** if
**Domain:** grc

**Input:** That an agent never approves must hold because an agent cannot, and not because a variable or a terminal says it is not one. An approval is a signature: a person signs, with a key that is theirs, a statement of the action, the subject and the hash of the plan they approve, with a nonce and a short window; a verifier checks the signature against a registry of the keys of persons that a repository keeps in a chain of signed versions, and counts the distinct persons. The key is a hardware token where the act matters, so that a touch is the approval; an agent that shares the person's machine can ask for a signature and receive none. This specification is the typed model and the pure verification; the controller that asks for approvals, the signing step and the key custody are specified by the products that use it (erga 294-opsfolio-approvals), and no product name appears here.

## Requirements

- **FR-001**: A statement MUST be a value of `ApprovalStatement`: schema `1`, an action, a subject, a plan hash, a request id, a nonce, a start and an end of its window, a risk (`routine` or `regulated`) and, optionally, a binding. `decodeStatement` MUST refuse an action that is not lower case words with dots and hyphens, an empty subject or request, a plan hash that is not 64 hexadecimal digits, a nonce shorter than 32 hexadecimal digits (128 bits), and a window that does not end after it starts, each with the code `E-APPROVAL-STATEMENT`.
- **FR-002**: What a key signs MUST be the pre-authentication encoding of DSSE of the payload type `application/vnd.ifc.approval+json` and the canonical JSON of the statement, in the namespace `ifc-approval`, which MUST be in the closed table of the namespaces of `0017-grc-sshsig-namespace`; a signature made in another namespace MUST be refused naming both.
- **FR-003**: A request MUST be a value of `ApprovalRequest`: the action, the subject, the plan hash, the request id and the risk the controller expects, how many distinct persons must approve (at least one), the roles any of which a person must hold, optionally the binding the statement must carry, and optionally the person who proposed the act and whether that person is not counted.
- **FR-004**: `verifyApproval(input, verifier)` MUST judge each approval given, in the order given, and give either `Verified` or `Insufficient`; each approval MUST have at most one rejection, the first failure of a fixed order (statement, mismatch, lifetime, start, end, replay, signature, key, validity of the key, role, signature check, custody, presence, verification, counter, proposer), with a code from the closed table `E-APPROVAL-*` and a sentence that says what to do.
- **FR-005**: An approval whose action, subject, plan hash, request id, risk or binding is not the request's MUST be refused with `E-APPROVAL-MISMATCH` and the sentence MUST say which of them it is.
- **FR-006**: A statement MUST be refused where its window is longer than the policy's `maxLifetimeMs` (`E-APPROVAL-LIFETIME`), where it starts later than the instant of the act plus the policy's `maxSkewMs` (`E-APPROVAL-NOT-YET`), and where the instant is at or after its end (`E-APPROVAL-EXPIRED`); the instant of the act MUST be an argument and verification MUST read no clock.
- **FR-007**: A nonce that is in the set of used nonces, or that an earlier approval of the same call used, MUST be refused with `E-APPROVAL-REPLAY`; verification MUST NOT change the set: it MUST give the nonces to consume, and the caller MUST consume them where it records the act, so that an approval is used once.
- **FR-008**: An approval whose signing key is not in the registry MUST be refused with `E-APPROVAL-UNKNOWN-KEY`, and so MUST one whose public key is not the registry's under that id; a key that is not yet valid (`E-APPROVAL-KEY-NOT-YET`), ended (`E-APPROVAL-KEY-EXPIRED`) or revoked at any time (`E-APPROVAL-KEY-REVOKED`) MUST approve nothing; a revoked key MUST never verify again whatever the instant.
- **FR-009**: A person whose key holds none of the roles of the request MUST be refused with `E-APPROVAL-ROLE`, and the sentence MUST say the roles that may approve.
- **FR-010**: A policy MUST say, for each risk, the custodies that are enough (`hardware`, `managed`, `file`); the default policy MUST allow a routine act by `hardware` or `managed` custody and a regulated act by `hardware` only, MUST require that a regulated act's token reported that it verified the person, and MUST allow a `file` custody only where a policy lists it, and then the approver MUST be marked `weak`; a custody refused MUST be `E-APPROVAL-CUSTODY`; a token that did not report that a person was present MUST be `E-APPROVAL-PRESENCE`; a regulated act without the verified flag MUST be `E-APPROVAL-VERIFICATION`.
- **FR-011**: The approvers that count MUST be those of distinct persons: a second approval by a person already counted, with another key, MUST be rejected as `E-APPROVAL-DUPLICATE`; the number of persons MUST be at least the request's threshold, and where it is not the result MUST be `Insufficient` with the code of the first rejection where nothing counted and `E-APPROVAL-INSUFFICIENT` otherwise; a person who proposed an act that the request says its proposer may not approve MUST be rejected as `E-APPROVAL-PROPOSER`; a rejected approval MUST NOT void the others.
- **FR-012**: `Verified` MUST give the approvers (person, key id, custody, whether weak, whether the token verified the person, nonce, end of window, counter), the nonces to consume, the last counter of each token, the rejections that did not stop the result, and a digest of the request with the keys that approved it.
- **FR-013**: `grc/signers/sshsig` MUST verify, without a program, a signature of an `ssh-ed25519` key and of an `sk-ssh-ed25519@openssh.com` key (an Ed25519 key in a FIDO2 token), and for a token MUST check the signature over the SHA-256 of the application, the flags, the counter and the SHA-256 of the signed data, as PROTOCOL.u2f of OpenSSH describes, and MUST give the key type, the flags (bit 0 a person was present, bit 2 the person was verified) and the counter; it MUST refuse any other key type (`ecdsa-sk` and the rest), a signature with bytes after its last field, and a signature whose kind is not its key's.
- **FR-014**: UNVERIFIED: the verification of a token is proved against the format as the specification reads it, with a software key that stands in for a token, and not against a device; a signature of a real token MUST be verified with the verifier of OpenSSH before any claim of it is made, and `ecdsa-sk` and WebAuthn assertions are not verified and MUST be refused with that said.
- **FR-015**: A registry of the keys of persons MUST be a value of `PersonKeys`: schema `1`, a version from 1, the instant it was issued, optionally the digest of the version before, and keys each with an id, a public key line, a person, roles, a custody (`hardware`, `managed` or `file`), the instant it is valid from and optionally until, revoked at, and the key it replaces; `decodeRegistry` MUST refuse two keys of one id, a key with no person or no role, a custody of `hardware` on a key that is not a token key, a validity that does not end after it starts, a key that replaces itself or one that is not in the registry, each with `E-APPROVAL-REGISTRY`.
- **FR-016**: `registryOfChain(root, chain, verifier)` MUST give the registry a chain ends in only where the first version is number 1, names no predecessor, lists the root key (by fingerprint) with the role `registry-admin` and is signed by it, and each later version has the next number, names the digest of the version before in `previous`, is issued no earlier than it, only adds (FR-018) and is signed by a registry administrator of the version before who is valid when it is issued; otherwise it MUST give `E-APPROVAL-REGISTRY-CHAIN` and say which rule.
- **FR-017**: A key that replaces another MAY be valid at the same time as the one it replaces, until the older key ends or is revoked; the registry MUST NOT decide which of the two a person uses.
- **FR-018**: A version MUST NOT remove a key, change the public key, person, roles, custody or start of a key, change or undo a revocation, or lengthen a validity; it MAY add keys, add a revocation and shorten a validity.
- **FR-019**: The registry and the approvals MUST be pure: no clock, no random number, no file, no program and no network; the signature check and the fingerprint of a key MUST be a port the physical layer gives, so that the logical layer imports no program.
- **FR-020**: `approvalSigner` MUST be `sshsigSignerFor("ifc-approval")`, which signs with `ssh-keygen -Y sign` and names the program where it is not installed; signing with a key of an agent, or of a token, is that program's (`-U`, or a key file of a token key).
- **FR-021**: `bindingOf(parts)` MUST be the hexadecimal SHA-256 of the parts, each with its length of four bytes in front, so that two different lists of parts never give one binding; a statement MAY carry a binding, and where the request has one the statement's MUST be equal (FR-005).
- **FR-022**: Nothing in the logical layer of approvals MUST read a private key, a key file or an agent: the library holds no private key material, and a function that signs MUST be the physical layer's and MUST take a key by name or file for a program to use.
- **FR-023**: For any set of approvals and any order of them, the persons that count MUST be the same where no two approvals share a nonce or a person, and a refused approval MUST NOT change whether the others make a result; before the end of its window and after its start an approval MUST give the same verdict for any instant, and at and after the end MUST be `E-APPROVAL-EXPIRED`.
- **FR-024**: Verification MUST be deterministic: the same input MUST give the same result and the same order of rejections on Bun and Node.
- **FR-025**: The levels of approval MUST be `presence`, `key` and `hardware`, in that order, and `policyOfLevel(level, lifetime?)` MUST give no policy for `presence` (nothing is signed there), for `key` a policy in which every custody is enough for every risk and a regulated act need not have the person verified by a token, and for `hardware` a policy in which a routine act is approved by any custody and a regulated act by a hardware key that verified the person; the lifetime MUST be the given one or the default's. The default policy of FR-010 stays the policy of a fleet that names none of the levels.
- **FR-026**: `levelOfCustody(custody)` MUST be `hardware` for a hardware custody and `key` for any other, and `levelOfApprovers(approvers)` MUST be the lowest level among the approvers of a verified approval and `presence` where there are none, so that a caller can say, of an act, the level it was in fact approved at.
- **FR-027**: `firstRegistry(key, issuedAt)` MUST give version 1 of a registry holding that one key with the roles `approver` and `registry-admin`, valid from `issuedAt`, so that the first key a platform makes for a person can be the root of the chain that FR-016 verifies, without a person typing a fingerprint; a caller that pins a root this way MUST say, wherever it shows the assurance of the fleet, that the first trust was that of first use and not a comparison.
- **FR-028**: `nextRegistry(previous, change, issuedAt)` MUST give the next version of a registry (the version after it, naming its digest) with the keys of `change.add` added with the roles and the `replaces` given and the keys of `change.revoke` marked revoked from `issuedAt`; it MUST refuse to revoke a key that is not in the registry and to add one that is, and the version it gives MUST satisfy FR-018, so that a key is replaced by adding its successor and revoking it in one version, and nothing else of the registry changes.
- **FR-029**: `signRegistry(registry, key)` of `grc/signers/sshsig` MUST sign a version of the registry as the envelope of DSSE of its canonical JSON, with the payload type of the registry and in the namespace `ifc-approval`, with `ssh-keygen -Y sign`, so that `registryOfChain` verifies it where a registry administrator of the version before signed; it reads no private key itself.

## Acceptance scenarios

1. **Given** a statement signed by a key of the registry that holds the role, **When** it is verified at an instant in its window, **Then** the person is an approver and the nonce is to be consumed, per FR-004 and FR-012.
2. **Given** an approval for another plan hash, **When** it is verified, **Then** it is refused as a mismatch that says plan hash, per FR-005.
3. **Given** the same approval verified twice with its nonce consumed in between, **When** the second is verified, **Then** it is a replay, per FR-007.
4. **Given** a revoked key, **When** it signed before the revocation, **Then** it still approves nothing, per FR-008.
5. **Given** a file key and the default policy, **When** it approves, **Then** it is refused for its custody; **and** a token that was not touched is refused for presence, per FR-010.
6. **Given** a regulated act and a token that did not verify the person, **When** it approves, **Then** it is refused for verification, per FR-010.
7. **Given** one person with two keys, **When** both approve a request that needs two persons, **Then** one counts and the other is a duplicate, per FR-011.
8. **Given** a chain whose second version removes a key, **When** it is read, **Then** it is refused, per FR-016 and FR-018.
9. **Given** a first key, **When** a registry is started from it and signed by it, **Then** a chain with that key as the root is good, per FR-027 and FR-029.
10. **Given** a registry of one key, **When** a successor is added and the first key is revoked in the next version signed by the first key, **Then** the successor approves and the first key is refused as revoked, per FR-028.
11. **Given** a regulated act signed by a file key, **When** it is verified at the level `key` and at the level `hardware`, **Then** the first approves and the second is refused for its custody, per FR-025.

## Out of scope

- Who asks for an approval, how the person is prompted, where the used nonces and the counters are kept and how a registry is stored: the products that use this (erga 294-opsfolio-approvals).
- WebAuthn and passkeys (FR-014).

## Edge cases

- A signature with bytes after its last field is refused, so that a signed value has one form (FR-013).
- A key of a token whose counter does not rise is refused as possibly cloned (`E-APPROVAL-COUNTER`); the counters are kept by the caller (FR-010, FR-012).
- A statement signed by a key that the registry holds under another public key is refused as an unknown key (FR-008).
- An empty set of approvals is `Insufficient` and says that nobody approved (FR-011).

## Assumptions

- A person holds a key that only they can use: a token that needs a touch, or an agent of keys that asks them each time; this specification cannot check how a key is held beyond what a token's signature says (FR-014).
- The caller keeps the used nonces and the counters and consumes the nonces where it records the act (FR-007).

## Open questions

- Whether WebAuthn and `ecdsa-sk` keys are verified, and with what (FR-014).

## Key entities

- **Statement** - what a person signs: the act by its plan hash, with a nonce and a window.
- **Approval** - a statement signed, in an envelope of DSSE.
- **Registry** - the chain of signed versions of the keys of persons, with roles and custody.
- **Approver** - a person whose approval counted, with the key, the custody and the nonce.

## Success criteria

- **SC-001**: Every requirement of 0020-grc-approval is proved by a test of the library with synthetic names, no network and no clock, or is marked UNVERIFIED.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
