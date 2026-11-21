# Feature Specification: Machine probe contract

**Spec ID:** 0002-machine-probe-contract
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** What a probe on a machine answers and how it is reached: three read-only requests, the line of `authorized_keys` that restricts a key to the probe, the command line of the ssh client that asks it, and the two scripts (POSIX shell and PowerShell). It is the contract of an adopted machine as Stolos defined it (067-adopt): observed over ssh with a key that may run one read-only script and nothing else, and never changed.

## Requirements

- **FR-001**: `parseRequest` MUST accept only `facts`, `version` and `osquery <base64>` of one SELECT (or a WITH that ends in one), MUST refuse any other text, a query that is not base64, one that is not a SELECT and one with a second statement, each with its reason, and `encodeRequest` MUST give back the text `parseRequest` reads.
- **FR-002**: `keyLine` MUST give the line of `authorized_keys` that forces the probe program for the key and sets `restrict` (no terminal, no forwarding, no other service), and MUST refuse a public key that is not one line of a key type and its base64 and a comment that could add an option or a second line.
- **FR-003**: `sshArgv` MUST give the argument vector of the ssh client for one request that uses only the key given (no agent), verifies the host key against the file of known hosts given and never accepts it for the person, asks for no terminal, forwards nothing, never asks for a password, and has the request as its last single argument; it MUST refuse an account, a host or a port that is not well formed.
- **FR-004**: The POSIX script MUST answer `facts` and `version`, MUST refuse every other request with status 2 and nothing on its standard output (a second command after `facts` included), MUST answer an osquery request with status 3 where osquery is not installed, and MUST read only; the PowerShell script MUST name the same three requests and the same refusals.

## Acceptance scenarios

1. **Given** a request that is `id`, **When** it is parsed, **Then** it is refused with the three requests named, per FR-001.
2. **Given** a public key and a comment, **When** the key line is made, **Then** it forces the probe and restricts the key, and a comment with a space is refused, per FR-002.
3. **Given** a target, **When** the command line is made, **Then** it checks the host key against the file given and has the request last, per FR-003.
4. **Given** the POSIX script, **When** it is run with `facts; id`, **Then** it ends with 2 and prints nothing, per FR-004.

## Out of scope

- Installing the probe and the key on a machine: a person does it with their own account, and the fleet's host program asks first.
- Running the PowerShell script: it is held for a real Windows machine.

## Edge cases

- A trailing semicolon or space on a query is accepted and dropped, per FR-001.
- A host that is an IPv6 address is accepted, per FR-003.

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
