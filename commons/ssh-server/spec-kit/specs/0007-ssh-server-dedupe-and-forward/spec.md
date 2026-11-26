# Feature Specification: SSH server dedupe and forward

**Spec ID:** 0007-ssh-server-dedupe-and-forward
**Status:** Draft
**Owner:** if
**Domain:** ssh-server

**Input:** The enrollment server was written before the probe, the ledger of evidence, the pins of tools and the stores of AnyFS were what they are, and it holds its own copy of each: its facts, its hash chain, its catalog of pins, its identity resolution and its state file. And it refuses every forward, so a device cannot send its signals to the controller's loopback by a forward of its own. This specification removes the copies in favour of what commons already has, and adds the one forward that a device with an enrolled key may open. It is governed by commons 0041-telemetry-and-reach (audit rows A13, B4, D4, E2 to E7). **The first group is a refactor with no wire change; what changes is said in FR-011.** **The forward (FR-008 to FR-010) is built; the requirements of the first group (FR-001 to FR-007) that ask for code are Deferred until after the owner's acceptance run of the command line.**

## The dedupe

- **FR-001**: The audit log MUST be a chain of `grc` ledger entries (`appendEntry`, `verifyLedger`, `GENESIS` of `grc/logical`), the `AuditEvent` being the evidence of an entry (its digest is the canonical text of the event) and its kind the `type`; `chainNext`, `verifyChain`, `canonical` and the `GENESIS` of `governance/session.ts` MUST be removed once the ledger chain passes the tests of the chain of 0003-server-policy FR-014 (a change, a removal and a reordering are found; the chain continues across a restart). A log written before MUST be read once, verified by the old rule, and continued from its last hash as the `previous` of the first new entry. Relies on audit rows: E2.
- **FR-002**: The audit MUST NOT be limited by removing its first events: it MUST be kept whole in appended segments of an AnyFS store, and where it grows past a policy it MAY be sealed (a signed head, evidence-capture `sealJournal`) and moved, never trimmed, so that a verification from the start or from a sealed head is always possible; the cap `AUDIT_KEEP` MUST be removed. Relies on audit rows: E3.
- **FR-003**: The state of the controller (sessions, assets, tokens by hash, pairings, nonces, removals) MUST be documents of an AnyFS store with `cas`; the port `EnrollStore` MUST stay as it is (it is small on purpose, 0003-server-policy FR-010), `memoryStore` MUST stay for tests, and `fileStore` MUST be removed only when the AnyFS implementation passes the same suite and keeps a secret's file at mode 600 (UNVERIFIED: the mode of the local store's files). Relies on audit rows: E3, H4.
- **FR-004**: `Facts` MUST be derived from the observation of the probe by `factsOf(observed)` (machine-probe 0009-machine-probe-signals FR-002); `decodeFacts` MUST remain the strict decoder of what a device sends and MUST NOT change; the collecting scripts of the server (`script-sh.ts`, `script-ps.ts`) MAY be replaced by the probe's scripts that print the same JSON line `{"type":"facts","facts":{...}}`, which changes the text of the scripts and so their `scriptSha256` in the audit, and does not change the conversation. Relies on audit rows: D3, D4.
- **FR-005**: `resolveIdentity` MUST be the function of estate 0009-estate-sightings (`resolveIdentity` over `IdentityKey`), called with `weakAdopts` true so that a MAC alone adopts as it does today; `Resolution` (`new`, `adopt`, `conflict`) MUST keep its shape. Relies on audit rows: B4.
- **FR-006**: `OSQUERY_PINS`, `Pin` and `defaultPlan` MUST be derived from the pins of the packaging ontology (`PinnedDownload`, `Checksum`) so that there is one catalog, and the `InstallPackageStep` of a plan MUST stay as it is (it is the wire the bootstrap script runs). Relies on audit rows: E6.
- **FR-007**: `planOf(order)` MUST make an `InstallPlan` from the requirements of `desired-os-state` of the kinds `package`, `ssh-authorized-key` and `file`, and MUST refuse, naming it, a requirement that a plan cannot say (a kind with no step, an argument that is not a word of `ARGV_WORD`); the plan type MUST NOT gain a step for it. Relies on audit rows: E5.

## The forward

- **FR-008**: `ServerPolicy` MUST gain `forwards`, a list of `ForwardRule { account, port }` (the host is `127.0.0.1` and is not a field), empty by default (every forward refused, as today, 0003-server-policy FR-004); only the account `s-device` MAY have a rule; the policy decoder MUST refuse a rule for another account, a port outside 1024 to 65535 and a second rule for one account in this version. Relies on audit rows: A13, E4.
- **FR-009**: The server MUST accept a `direct-tcpip` channel only where an authenticated `s-device` session of an enrolled, non-revoked key asks for `127.0.0.1` and exactly the port of its rule, and MUST refuse, with an audit event of kind `refused`, any other destination, `streamlocal`, a remote forward (`tcpip-forward`, the reserved `tether`), a forward before the key is proven, and a second concurrent forward of one device (`maxForwardsPerDevice` is 1). Relies on audit rows: A13, E8.
- **FR-010**: Each forward MUST be audited when it opens and when it closes (kind `forward`, the account, the fingerprint of the key, the destination, the bytes each way as numbers and the digests of what was carried, never the bytes), and the limits of 0003-server-policy FR-008 (idle time, total time, bytes) MUST apply to it. Relies on audit rows: E4.
- **FR-011**: What changes on the wire or on disk, and nothing else: the stored audit (FR-001, FR-002), the text of a bootstrap script where it is replaced (FR-004), a new audit kind `forward` and a new field `forwards` of the policy. The commands, the replies, the plan and the facts MUST be as they are. Relies on audit rows: E2, E3, D4, A13.
- **FR-012**: Where the identity of the sender of a forwarded batch cannot be told by the receiver (every forwarded connection arrives from loopback), the identity MUST be the key that signed the envelope (telemetry 0003-telemetry-reach FR-010 and FR-011); the server MAY, in a later version, serve the handler of the receiver itself for the channel so that the session's identity is known (OQ-1). Relies on audit rows: A11, A13.

## Acceptance scenarios

1. **Given** an audit log of the old chain, **When** the server starts with the ledger chain, **Then** the old log verifies by the old rule and the new entries continue from its last hash, per FR-001.
2. **Given** 12,000 events, **When** the log is verified from its start, **Then** it verifies, per FR-002.
3. **Given** a device's `Facts` and an `Observed` of the same machine, **When** `factsOf` is applied, **Then** it equals what `decodeFacts` gives for the device's JSON, per FR-004.
4. **Given** a policy with no `forwards`, **When** a device asks for a forward, **Then** it is refused and audited, per FR-008 and FR-009.
5. **Given** a rule for port 4318, **When** `s-device` with an enrolled key asks for `127.0.0.1:4318`, **Then** it is accepted, and `127.0.0.1:22` and `10.0.0.1:4318` are refused, per FR-009.
6. **Given** a revoked key, **When** it asks for a forward, **Then** it is refused, per FR-009.

## Out of scope

- The `query`, `jobs`, `evidence`, `fetch`, `health` and `presence` conversations and the `tether`: they stay reserved (0006-reserved).
- Certificates for the device (0006-reserved FR-010).

## Edge cases

- A forward that is open when the key is revoked: it is closed at the next check of the session, and audited, per FR-009.

## Assumptions

- The receiver is bound to the same loopback as the server.

## Open questions

- **OQ-1**: Should the server serve the receiver in process for the channel, so that the identity is the session's (FR-012)?

## UNVERIFIED

- None for the forward: `ssh2` accepting `direct-tcpip` to a loopback socket and piping it is run by the tests against the OpenSSH client.

## Key entities

- **ForwardRule** - the one loopback port an account may reach.

## Success criteria

- **SC-001**: Every requirement above is proved by a test of this library with synthetic names and no network, or is a row `none` with the note Deferred until the code exists; no row is enforced before it is built.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement names the row of the reuse audit of commons 0041-telemetry-and-reach it relies on
