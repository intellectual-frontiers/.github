# Feature Specification: Headless ssh coverage

**Spec ID:** 0007-ssh-coverage
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** An increment of the ssh target of 0005-reach-and-targets, covering the families of ssh options (a strict-pinned host with a temporary known-hosts file, batch, interactive), the first contact with a host, the files copied with `scp`, the long-lived piped session over which MCP is spoken, and the key tools (`ssh-keyscan`, `ssh-keygen -l -y -R -Y find-principals`) with the known hosts of two files. What this library forbids (accepting a host key for the person, a prompt that cannot be answered) is a verb or an explicit flag of the reach policy.

## The families and the first contact

- **FR-001**: The options of an ssh call MUST be in three families, in one place: `batch` (the default: `BatchMode=yes`, `ConnectTimeout`, `ServerAliveInterval`, `StrictHostKeyChecking=yes`, no password and no keyboard-interactive prompt, the repository's known hosts and then the user's), `pinned` (the same, with only the one file given for the host, so that a key that is not in it is refused), and `interactive` (no `BatchMode` and no refusal of a password or keyboard prompt, so the client may ask, but `StrictHostKeyChecking=yes` all the same); a terminal (`-t`) MUST be asked only in the family `interactive`; and the family `interactive`, or a terminal, MUST be allowed only where the action's reach policy says it needs a terminal (`needsTty`, false by default and never true on `ssh`, `mcp` or `rest`), by `configForReach`, which refuses otherwise. A payload that would be pushed through a prompt (a credential, a bootstrap script) MUST be given on the standard input through the executor, with no terminal.
- **FR-002**: The first contact with a host MUST be a verb, `trust-host <target> [--fingerprint SHA256:...]`, that never accepts a key by itself: without a fingerprint, or with `--dry-run`, it MUST show the fingerprints the host presents (ed25519 first) and say how to confirm, recording nothing; with a fingerprint it MUST record the host in the repository's known hosts only if the host showed that fingerprint, and record nothing, saying what the host showed, otherwise; the fingerprint MUST be an option only a person may give, the action MUST come through the local channel only and be confirmed by a person, and `StrictHostKeyChecking=accept-new` and `no` MUST NOT be written anywhere in the library.

## Files, sessions and keys

- **FR-003**: The `Executor` port MUST be able to copy files, `put(files, remoteDir)` and `get(remote, local)`, as optional methods; the ssh executor MUST copy with `scp` through the system's client, with the options of the family, the port as `-P`, `--` before the files, every word its own argument, a local path that begins with a dash or holds a colon made relative with `./`, an IPv6 address in brackets, and a remote path REFUSED (an exit of 255 with the reason) unless it is letters, digits and `_@%+=:,./-` with no `..` and no leading dash, so that no remote shell can expand or split it; the local executor MUST copy with the system's file functions and no shell.
- **FR-004**: The `Executor` port MUST be able to start a program with piped streams, `spawn(argv, opts)` giving a `Session` (the three streams, how it ended, a way to stop it, its whole output), as an optional method; the ssh executor MUST start the client with the same quoted command and options as `exec`, so that a protocol talked over the standard input and output (the MCP server over `ssh -T`) is a session on the port; `exec` MUST be documented as the call that gives its output when the program has ended and does not stream; the local executor MUST start the program with the system's `spawn`; a session that cannot be made (a word with a NUL, a credential that does not resolve) MUST be an error thrown, having no output to give it in.
- **FR-005**: A typed `hostkeys` module MUST make the argument vectors of `ssh-keyscan -T 8 [-p port] -- <address>`, `ssh-keygen -l -f -`, `-y -f <file>`, `-R <host> -f <file>` (the host as a known-hosts file names it, `[address]:port` for a port other than 22), `-Y find-principals -s <signature> -f <allowed signers>`, and the generation of a key with no passphrase (`-q -t <type> [-b 3072] -N "" -C <comment> -f <file>`); it MUST parse what `ssh-keyscan` writes into the keys a host showed (comment lines and what is not a key left out, the same key once, ed25519 first and the other types in a fixed order) and what `ssh-keygen -l` writes into the size, fingerprint, comment and type; and it MUST make the text of a known-hosts file for the keys pinned for a target. It MUST only make arguments and read text: it runs nothing and records nothing as trusted.
- **FR-006**: The known hosts MUST be two files, the repository's (made by Git) consulted first and the user's after, given to the client in one `UserKnownHostsFile` in that order, and in the family `pinned` the one file only; a path with a space MUST be refused.
- **FR-007**: The target MUST cover the ways a fleet program calls ssh: for each shape in a table of them (a credential pushed by stdin to a server with a prompt, a one-shot `<program> <verb> --json` in batch, a script as `sh -s`, a pinned host with its own known hosts and a port, a probe with a key by reference, a session for MCP, a copy of files, a scan of host keys, a fingerprint, a first contact), the library MUST give the arguments, and a test MUST build each.

## Acceptance scenarios

1. **Given** the three families, **When** the arguments are made, **Then** each holds what FR-001 says, and `interactive` with a terminal is refused unless the reach policy says it needs one.
2. **Given** a host that presents two keys, **When** `trust-host` runs with no fingerprint, **Then** both fingerprints are shown, ed25519 first, and nothing is recorded, per FR-002.
3. **Given** a fingerprint the host did not show, **When** `trust-host` runs with it, **Then** nothing is recorded and what the host showed is said, per FR-002.
4. **Given** a remote path with a space, a `$` or `..`, **When** `put` is called, **Then** it is an exit of 255 and `scp` is not run, per FR-003.
5. **Given** a stand-in client that answers its standard input, **When** a session is spawned and written to, **Then** its lines come back from the stream and it ends with 0 when the input closes, per FR-004.
6. **Given** the text of `ssh-keyscan` with a comment, a duplicate, an RSA key and an ed25519 key, **When** it is parsed, **Then** the keys are two or three in the order of FR-005.
7. **Given** a pinned host on port 2222, **When** its known-hosts text and the arguments of `ssh-keygen -R` are made, **Then** the host is `[address]:2222`, per FR-005.
8. **Given** the table of the shapes of ssh calls, **When** each is built, **Then** none holds `accept-new` and each holds what its shape needs, per FR-007.

## Out of scope

- Generating the sshd or authorized_keys side (0005-reach-and-targets FR-008) and the scripts a fleet program ships (`bootstrap.sh`, the probe scripts), which are files and not arguments.
- The MCP protocol itself: a session carries it, and what speaks it is the program's.
- Key custody (the vault, signing keys): `ssh-keygen -p` and `ssh-add` stay a fix text a program shows.

## Edge cases

- A scan that shows no key, or ends in error: no fingerprints, said as the host showing no key, per FR-002.
- A put of no file: refused, per FR-003.
- A local path `a:b`: made `./a:b` so that scp does not read a host, per FR-003.

## Assumptions

- The system's OpenSSH client and `scp` are what is run; a Windows host has them as the Windows capability gives them.

## Open questions

- None.

## Key entities

- **Family** - one of three sets of options of a call: batch, pinned, interactive.
- **Session** - a program that is talked to while it runs.
- **Pinned keys** - the known hosts of one host, for the strict family.

## Success criteria

- **SC-001**: A fleet program can reach every machine it must through this target, and nothing in it accepts a key for the person.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
