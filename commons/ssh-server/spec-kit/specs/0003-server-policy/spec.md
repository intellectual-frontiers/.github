# Feature Specification: Server policy

**Spec ID:** 0003-server-policy
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** What the enrollment server accepts and how it protects itself: the service accounts, the proof of a key, the source networks, the limits, the host key, the stores and the audit chain. An `s-enroll` login never gets a shell.

## Requirements

- **FR-001**: The server MUST accept only the service accounts of a closed table (`s-enroll`, `s-device`, and the reserved `s-operator`, `s-agent`, `s-assist`) and of those only the built ones the policy lists; any other username, and a reserved account, MUST be refused. `s-enroll` MUST take an anonymous client; `s-device` MUST take only a key that an enrolled device proved.
- **FR-002**: A public key MUST be proof only where its signature was verified over the session. The offer of a key without a signature MUST be answered as a query and MUST NOT be taken as proof (the example of the ssh2 README that accepts an unsigned key is wrong and MUST NOT be followed). A refusal of a key (`auth`, `refused`) MUST be an audit event that carries the fingerprint of the key offered, so that the refusal of a key that was revoked is told from the refusal of any other.
- **FR-003**: An anonymous client MUST be let in by the method `keyboard-interactive` with no prompt (so that a client that has a key is asked for it first), or by the method `none`, or not at all, by the policy; the default is `keyboard-interactive`. The methods `password` and `hostbased` MUST be refused.
- **FR-004**: The server MUST refuse a shell, a pty, a subsystem (and so sftp), an environment variable, x11, agent forwarding, TCP forwarding and stream-local forwarding, and MUST run at most one `exec` a connection.
- **FR-005**: A source MUST be accepted only from loopback, RFC 1918, link-local and ULA addresses, and from the CIDR blocks the policy lists; a public address MUST be refused by default. IPv4-mapped IPv6 MUST be read as IPv4.
- **FR-006**: The server MUST limit by a token bucket per source over an injected clock, and a refused source MUST get a penalty that doubles with each strike up to a maximum and ends by itself.
- **FR-007**: A token MUST be single use and time limited, compared in constant time, and MUST bind a tenant, a fleet and labels; a used, expired, unknown or malformed token MUST be refused.
- **FR-008**: The server MUST limit the connections (total and per source), the time to the end of the handshake, the idle time, the total time, the size of a command and the size of the standard input, and MUST close a connection that passes a limit.
- **FR-009**: The host key MUST be generated once (ed25519), kept with mode 600 and never regenerated silently: a file that exists and is not a key MUST be an error, not a reason to make a new key.
- **FR-010**: The server MUST keep its state behind a store port (sessions, assets, removal requests, tokens, pairing codes and the audit log), with an in-memory and a JSON-file implementation; the file MUST be written atomically with mode 600, and a token or a code MUST be given once.
- **FR-011**: A person approves or refuses a session: `approve` and `refuse` take the name of the person, and an agent MUST NOT call them for itself. An approval MUST store the asset the session becomes, merged with the asset it was adopted by.
- **FR-012**: The server MUST serve 20 parallel clients to the end, each with its own session.
- **FR-013**: `createEnrollServer` MUST take a port (2222 by default, 0 for any), a host, the host key path, the policy, the enrollment policy, the store, a clock and an event callback, and MUST require the identity in the policy: the `endpoint` (host and port, no default name) and the `brand` (`Brand`: `name`, `envPrefix`, `stateDir.posix`, `stateDir.windows`, `keyComment`, `serverIdent`, `approveHint(sessionId, code)`), which the product gives and this library never names (IF Commons holds no product code); `createEnrollServer` MUST throw on a brand that `brandProblems` finds. It MUST return the address it listens on, the host key, the policy, the number of connections and `close`.
- **FR-014**: The audit log MUST be a hash chain: each event holds its number, the hash of the event before and its own SHA-256, and `verifyChain` MUST find any change, removal or reordering. The chain MUST continue across a restart of the server.
- **FR-015**: The store MUST keep only the SHA-256 of the secret of a token: the secret is shown once when it is issued and never stored, and the compare MUST be of hashes in constant time.
- **FR-016**: Each conversation MUST end with an audit event of its digests (the SHA-256 and the size of what the client sent and of what the server answered), and a transcript up to a cap only where the policy asks for one.

## Acceptance scenarios

1. **Given** the user `root`, **When** it connects, **Then** it is refused (FR-001).
2. **Given** a shell request, **When** it is made, **Then** it is refused (FR-004).
3. **Given** a public source address, **When** it connects, **Then** it is refused (FR-005).

## Out of scope

- Booting a machine (PXE, TFTP, boot servers): it is not a concern of commons.
- The controller that calls this library: it is in the private erga repository.

## Edge cases

- A requirement of this specification that a test cannot reach on this machine: it says so in its note (FR-001).
- A reserved requirement: it is held by name and enforces nothing until it is built (FR-001).

## Assumptions

- The system OpenSSH client is the client of the tests, and Debian 13 is the container of the script test.

## Open questions

- None.

## Key entities

- **SSH Server** - the library.

## Success criteria

- **SC-001**: Every requirement of this specification with the mechanism `check` is proved by `bun run verify`.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
