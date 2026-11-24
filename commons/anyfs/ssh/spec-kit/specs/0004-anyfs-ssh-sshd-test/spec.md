# Feature Specification: AnyFS SSH test server

**Spec ID:** 0004-anyfs-ssh-sshd-test
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A real OpenSSH server for the tests of the store: made for a run on a free port of the loopback with its own keys and one account, reached by the real client through the safe executor, and taken away again with everything it made, so that the store is tested against the real thing wherever the computer has one and is skipped, with a reason, where it has not.

## Requirements

- **FR-001**: The configuration of the server MUST let in one account with one key, on the loopback and the port it is given, MUST accept no password and no keyboard-interactive answer, and the known hosts it makes MUST hold the host key of that server for that address and port and no other key.
- **FR-002**: The server MUST be named to a test by the variables `ANYFS_SSH_TEST_ADDRESS`, `_PORT`, `_USER`, `_KEY`, `_KNOWN_HOSTS`, `_ROOT` and `_CONTROL_DIR`, which are the variables a server of the tester's own is named by.
- **FR-003**: The command line MUST be `check` (say whether a server can be made here) or `run -- <command>` (run the command with the variables set and end with its exit status), and anything else MUST be a usage error with exit status 2; where no server can be made, `run` MUST say why and run the command without the variables.
- **FR-004**: The port MUST be a free port of the loopback chosen for the run, never a fixed one, and the folder of the keys, the configuration, the log and the shared connections MUST be one folder made for the run.
- **FR-005**: The server MUST let the key in through the real `ssh` client with the known hosts pinned, MUST refuse an account it does not name, and, where the process is root, MUST use the account `fleet` (made where it is not there) and otherwise the account of the process.
- **FR-006**: The server, the keys, the known hosts, the folder of the run and the folder of the account MUST be gone when the function that used the server ends, whether it returns or throws, and an error of the function MUST be raised and not swallowed.
- **FR-007**: A test that needs a server MUST use the server named by the environment, else one made for the run, and MUST be skipped with the reason where none can be had; the run of the conformance suite MUST share one connection between its calls.

## Acceptance scenarios

1. **Given** a computer with OpenSSH, **When** the conformance suite is run through `run -- bun test suite/`, **Then** it runs against the real server and no server is left, per FR-005 and FR-006.
2. **Given** a computer with no OpenSSH server, **When** the test is run, **Then** it is skipped with the sentence that says what is missing, per FR-007.

## Out of scope

- A server in a container, and Windows hosts: the tester names one by the variables of FR-002.

## Edge cases

- An sshd that cannot start (no privilege separation folder, a port taken): the answer is a skip with the last lines of its log, per FR-007.

## Assumptions

- The computer has `sshd`, `ssh-keygen` and `ssh`, and where the process is root, `useradd` and `usermod`.

## Open questions

- None.

## Key entities

- **The throwaway server** - the sshd of one run, its keys and its folders.
- **The host** - what a test is told of the server: address, port, account, key, known hosts, folder.

## Success criteria

- **SC-001**: The conformance suite passes against the throwaway server, and nothing of it is left afterwards.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
