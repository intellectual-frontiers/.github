# Feature Specification: Machine probe contract

**Spec ID:** 0002-machine-probe-contract
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** What a probe on a machine answers and how it is reached: three read-only requests, the line of `authorized_keys` that restricts a key to the probe (made by the inbound surface of Headless), asking it through an executor of Headless (the ssh target, a container or this machine), and the two scripts (POSIX shell and PowerShell). It is the contract of an adopted machine as Stolos defined it (067-adopt): observed over ssh with a key that may run one read-only script and nothing else, and never changed.

## Requirements

- **FR-001**: `parseRequest` MUST accept only `facts`, `version` and `osquery <base64>` of one statement that only reads, judged by the guard of the SQL language library (`@intellectual-frontiers/lang-sql/aide/guard`) by its tree in the SQLite dialect, MUST refuse any other text, a query that is not base64, one that writes or is not a single read and one with a second statement, each with its reason, and `encodeRequest` MUST give back the text `parseRequest` reads.
- **FR-002**: `probeKeyLine` MUST give, through the inbound surface of Headless, the line of `authorized_keys` that forces the probe program for the key and sets `restrict` (no terminal, no forwarding, no other service), with the addresses the key may come from where they are given, and MUST refuse a text that is not one public key line (a private key in particular).
- **FR-003**: `sendVia` MUST send a request as the command of an executor of Headless, so that the ssh target's rules apply (a batch call with no terminal, the key given alone, the host key checked against the repository's known hosts and never accepted for the person), the request MUST be the last argument, and a request that is not one of the three MUST NOT be sent.
- **FR-004**: The POSIX script MUST answer `facts` and `version`, MUST refuse every other request with status 2 and nothing on its standard output (a second command after `facts` included), MUST answer an osquery request with status 3 where osquery is not installed, and MUST read only; the PowerShell script MUST name the same three requests and the same refusals.
- **FR-005**: A key restricted by `probeKeyLine` MUST, on a real sshd (a disposable machine of the library `lab`), run only the probe and open no shell, MUST refuse a request that is not one of the three with status 2 and nothing printed, MUST forward no port, and MUST be refused by a machine whose host key is not the one pinned; the observation of that machine MUST be told as aligned with what is declared of it until something of the machine changes and then as drifted, and a machine that cannot be reached MUST be `unreachable` and never observed.

## Acceptance scenarios

1. **Given** a request that is `id`, **When** it is parsed, **Then** it is refused with the three requests named, per FR-001.
2. **Given** a public key, **When** the key line is made, **Then** it forces the probe and restricts the key, and a private key is refused, per FR-002.
3. **Given** an ssh target, **When** a request is sent through it, **Then** the call is a batch call that checks the host key against the repository's file and has the request last, and `id` is not sent, per FR-003.
4. **Given** the POSIX script, **When** it is run with `facts; id`, **Then** it ends with 2 and prints nothing, per FR-004.
5. **Given** a machine with the restricted key installed, **When** an administrator adds an account to the administrators and the machine is observed again, **Then** the estate tells it drifted, naming the path, and a stopped machine is unreachable, per FR-005.

## Out of scope

- Installing the probe and the key on a machine: a person does it with their own account, and the fleet's host program asks first.
- Running the PowerShell script: it is held for a real Windows machine.

## Edge cases

- A trailing semicolon or space on a query is accepted and dropped, per FR-001.
- A key line may be limited to addresses, per FR-002.

## Assumptions

- The probe asks nothing of the machine that needs root, so a read the account may not do (BitLocker without administrator rights) is reported as `unknown`.

## Open questions

- None.

## Key entities

- **Request** - one of `facts`, `version` and one osquery SELECT.
- **Key line** - the line of `authorized_keys` that restricts a key to the probe.

## Success criteria

- **SC-001**: A key that opens only the probe cannot open a shell, run another command or forward a port.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
