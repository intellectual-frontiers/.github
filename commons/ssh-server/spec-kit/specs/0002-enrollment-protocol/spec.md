# Feature Specification: Enrollment protocol

**Spec ID:** 0002-enrollment-protocol
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A device enrolls inbound over `ssh -p 2222 s-enroll@HOST COMMAND` against our own server. The commands are a closed registry of typed definitions, the dialogue is a pure state machine, and a person approves unless a policy says otherwise. The server is a host of conversations (FR-016): enrollment is the first.

## Requirements

- **FR-001**: A command line MUST be words of the alphabet `A-Z a-z 0-9 . _ : = -` separated by single spaces, at most 256 characters and 96 to a word. There MUST be no shell syntax, no quoting and no free text: a character outside the alphabet MUST be refused before anything else is read.
- **FR-002**: The commands MUST be a registry of typed definitions: closed at runtime, pluggable at build time. A definition MUST give its name, summary, service account, conversation, authentication requirement (`none`, `proven-key`, `token` or `pairing-code`), whether it takes a token, whether it reads the standard input, the effects it may ask for, its audit kind, its own argument decoder and its run function. A name twice, or outside the alphabet, MUST be refused. A command that is not in the registry MUST NOT exist, and adding one MUST NOT change `commandOf` or `runCommand`.
- **FR-003**: The built-in commands MUST be `hello`, `status`, `bootstrap` (POSIX sh), `bootstrap-ps` (PowerShell 7), `report`, `next`, `done`, `join`, `knock`, `checkin`, `leave` and the reserved `tether`. The first nine and `leave` belong to the conversation `enroll`; `checkin` to the conversation of that name. `hello` MUST list only the commands the service account of the connection may run.
- **FR-004**: A session MUST have the state `pending`, `interrogated`, `approved`, `installing`, `enrolled`, `failed`, `refused` or `expired`, and MUST move only by the table of legal moves; `enrolled`, `failed`, `refused` and `expired` are final. A session MUST be bound to the source address that opened it: another address MUST be told `unknown session`. A session past its time MUST become `expired`.
- **FR-005**: The messages of the dialogue (`hello`, `facts`, `consent`, `plan`, `result`) MUST be one JSON line on the standard input, of at most the policy's `maxStdinBytes`, and a message that does not belong to the command or to the state MUST be refused with a reason.
- **FR-006**: The facts of a device MUST be decoded strictly: the operating system family, name, version and architecture, the kernel, the host name, the machine id, an optional serial, the CPUs, the memory, the disks, the network interfaces with their MAC addresses and addresses, the host public keys with their fingerprints, the admin users, the package manager, the state of sudo and the init system. Unknown fields MUST be dropped, every text MUST be bounded, a list MUST hold at most 64 items and a text MUST hold no control character.
- **FR-007**: An install plan MUST be an ordered list of at most 64 typed steps: `install-package` (os family, name, version, https url, SHA-256, installer `deb`, `rpm`, `msi` or `pkg`), `authorize-key` (account, public key), `ensure-account` (name, sudo) and `run` (an argument vector, `user` or `root`, the exit codes expected). An `install-package` or `run` step MAY be optional: it MUST come after every required step, and `authorize-key`, `ensure-account` and the pin of the controller are always required. A word of an argument vector MUST be of the alphabet `A-Z a-z 0-9 . _ : / @ = + , % -` and never a shell string. A plan MUST be said on the wire as tab-separated lines between `PLAN` and `END`, a required step on a line that begins `STEP` and an optional one on a line that begins `OPT`.
- **FR-008**: The device MUST consent before the install: the consent is a message of its own, the server MUST NOT move a session to `installing` without it, a refusal MUST end the session as `refused`. The device MUST finish the required steps and keep its key before it runs the first optional step, and MUST report every step it ran, saying of an optional step that it was not done and why. A session whose required steps are all done MUST become `enrolled`, whatever an optional step did, and the audit MUST name the optional steps not done. A failed required step MUST end the session as `failed`, with what the install left on the device and what a person runs there to remove it, recorded as the device said them (shown, never run, by the controller).
- **FR-009**: `join CODE` MUST take a pairing code of two words and four digits shown on the controller: single use, with a short lifetime, binding a tenant, a fleet and labels to the session it opens. A used, expired or unknown code MUST be refused. A token (`token=tok-...` after a command that takes one) MUST bind the same way.
- **FR-010**: `knock` MUST be for a device that has only an ssh client and no scripting: it MUST leave a pending session that records the client banner, the source address, the neighbour MAC and the reverse DNS where they are known and every key that the client proved, and MUST class the device from its banner (OpenSSH, Dropbear, libssh, Cisco, RouterOS, Junos, EdgeOS, UniFi, PuTTY, other).
- **FR-011**: `checkin` MUST be run on the account `s-device` by a device whose proven key is one that enrollment recorded. It MUST take its facts (optional), report which fields drifted and hand over pending typed work as an approved session, and MUST refuse a key that is not an enrolled device's.
- **FR-012**: `leave` MUST be run on the account `s-device`: it asks for the removal of the device, MUST record the request and MUST NOT remove anything: a person confirms.
- **FR-013**: `hello` MUST say who answers and the commands of the account; `status` MUST say that the door is open, or the state of a session.
- **FR-014**: Every command, refusal, decision and state change MUST be an audit event holding the time, the kind, the source address, the session, the command, the outcome and the detail. An event MUST hold no secret: a token is written as its id, a pairing code as its last four characters.
- **FR-015**: A fingerprint MUST be `SHA256:` and 43 characters of base64 without padding, the form OpenSSH prints; a key algorithm outside the known set MUST be refused.
- **FR-016**: The host MUST be an algebra of conversations: `Conversation<State, In, Out>` gives an id, the service account, the authentication it requires, its audience, its limits, its initial state and a pure `step`. The enrollment MUST be one such conversation (`enrollConversation`), and the registry of conversations MUST name which are built and which are reserved (0006-reserved).
- **FR-017**: Enrollment MUST be bound to a key made on the device. The first connection is anonymous and carries only `hello`, `status`, `bootstrap`, `bootstrap-ps`, `knock` and `join`. The script makes an ed25519 key on the device (the private key never leaves it, no passphrase) and reconnects as `s-enroll` with it, and every later command (`pair-commit`, `pair-reveal`, `report`, `next`, `done`) MUST be refused unless that key proved itself over the connection and is the key the session was paired with. The server MUST NOT make or hold a key of a device.
- **FR-018**: The pairing MUST be a commit-then-reveal handshake. The device sends `Cd = commit(Nd, device_pub, the controller host key it saw)`; the controller answers `Cc = commit(Nc, controller host key)`; then the device reveals its nonce, its key and the host key it saw, and the controller reveals `Nc` and its host key; each side MUST verify the commitment of the other, in constant time. `commit(nonce, material) = sha256(tag, nonce, material)` with a domain tag, and the short authentication string MUST be derived from `sha256(tag, controller host key as seen, device_pub, Nc, Nd)`, so that a man in the middle who holds one host key toward the device and another toward the controller makes the two strings differ. A nonce MUST NOT be used twice, a commitment or a reveal MUST NOT be replayed, and the key of the reveal MUST be the key that proved itself.
- **FR-019**: The code MUST be typed by a person: `confirmPairing(session, typed)` compares it in constant time, a right code approves the session with the plan, a wrong code spends a try, three wrong codes or the end of the time of the pairing MUST burn the session with the code `E-SSH-PAIRING-BURNED`, audited and flagged as a possible interception where the host keys differ. A burned session MUST confirm nothing. A manual `approve` MUST be refused for a session whose pairing is not confirmed.
- **FR-020**: The code MUST be configurable as 4 to 9 digits (6 by default) or 3 to 6 letters of an alphabet without look-alikes (no I, L or O), and a typed code MUST be normalised (spaces, hyphens, case).
- **FR-021**: A bare `knock` from a client that cannot run the script MUST be the tier of trust on first use: the controller makes the code, prints it in the session output, flags the pairing as such, and a person confirms it; it MUST say that on a network that is not trusted the one-liner is to be used. A device that cannot make a key (network gear) MUST NOT be given a key by the controller: the controller prints a typed command for the device that authorizes the controller's outbound key.
- **FR-022**: The key lifecycle MUST run without a person: `rekey` (on `s-device`, over the old key) announces a new key, `rekey-confirm` (over the new key, which proves possession) swaps it in and ends the old key, a controller MAY ask for the rotation by the answer `ROTATE` of `checkin`, and `revoke` ends every key of an asset from the device, and from the controller (`revokeAsset`). A new key MUST do nothing before it is confirmed.
- **FR-023**: After the pairing is confirmed the key the device proved MUST become its key for `s-device`, the plan MUST be able to pin the host key of the controller on the device (`pin-controller`), and the device MUST keep its key and the pinned key and reconnect as `s-device` with strict host key checking.

## Acceptance scenarios

1. **Given** a command with a semicolon, **When** it is read, **Then** it is refused (FR-001).
2. **Given** a device whose script saw another host key than the controller's, **When** the person types the code the device printed, **Then** the codes differ and the pairing burns after three tries (FR-018, FR-019).
3. **Given** a registry and one new definition, **When** the command is read and run, **Then** the core is unchanged (FR-002).
4. **Given** a session in `interrogated`, **When** consent is sent, **Then** it is refused (FR-008).
5. **Given** a pairing code used once, **When** it is used again, **Then** it is refused (FR-009).

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
