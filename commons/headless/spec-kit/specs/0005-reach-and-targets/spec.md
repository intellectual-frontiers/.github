# Feature Specification: Headless reach and targets

**Spec ID:** 0005-reach-and-targets
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** An action is defined once, and where it runs is a separate choice: here, or on a target. Governance gives each action a reach policy (the channels it may come through, whether it only reads, whether it is safe to repeat, whether it needs a terminal, whom it runs as, how it is confirmed), the classes of target, and one trust policy that names no secret value; the logical layer gives the target (its id, class, address, port, jump chain, and the references of its host key and credential), the invocation that runs `<program> run --json <verb>` there, and the typed outcome that comes back; an `Executor` port, shaped as the system's `proc`, has two adapters (`targets/local` and `targets/ssh`, which runs the system's OpenSSH client and holds no SSH protocol); and `surfaces/ssh-inbound` generates, from the reach policy, the `authorized_keys` forced-command lines and the `sshd` `Match` block that let in what the policy allows. The behaviour is the one stolos has by hand (MCP over ssh as a restricted account, one-shot `ssh <target> "<program> ... --json"`, a bootstrap by `ssh <host> sh -s`, a read-only probe key, no agent on a server), made one library.

## Reach

- **FR-001**: Every action MUST be able to carry a reach policy of data: its channels (`local`, `ssh`, `mcp`, `rest`; never none, none twice), whether it is read-only, whether it is idempotent, whether it needs a terminal (false unless said), whom it runs as (`caller` or `service`) and its confirmation class (`none`, `flag`, `person`); `defineReach` MUST give the safe defaults (it changes something, is not assumed idempotent, needs no terminal, runs as the caller, is not confirmed), and `reachDecision` MUST refuse a channel the policy does not list and, for a caller that may only read, an action that is not read-only. Taken from: stolos's read-only probe key and the `ops` account that may only run `archon mcp`.
- **FR-002**: Governance MUST name the classes of target (`server`, `workstation`, `device`, `network-gear`) and ONE trust policy: the host key is verified, the known hosts are the repository's and then the user's, a key that does not match is refused, the first contact with a host is an explicit verb, and a credential is a reference and never a value; each field MUST have the one value the policy allows, so that data cannot loosen it, and nothing in it names a secret. Taken from: stolos's `UserKnownHostsFile=known_hosts.auto` and `~/.ssh/known_hosts`, and its rule that no secret is in an argument, a log or a hint.
- **FR-003**: A conformance rule MUST reject an action with no reach policy (`reach/missing`, and `model/no-reach-policy` where a program is held to it with `requireReach`), and MUST reject a policy that contradicts its action: `readOnly` that is not whether the action reads (`reach/read-only-mismatch`), `idempotent` that is not the action's (`reach/idempotent-mismatch`), a need for a terminal on `ssh`, `mcp` or `rest` (`reach/tty-without-terminal`), a destructive action with no confirmation (`reach/destructive-unconfirmed`), an action for a person on any channel but `local` (`reach/human-only-remote`). Taken from: the plan of this library (governance holds what each action may do; a surface only draws it).

## Where it runs

- **FR-004**: An `Executor` MUST be `exec(argv, opts) -> Output` with the same `RunOptions` and `Output` shape as the system's `proc` (the system's own `proc.output` MUST be assignable to it), and `targets/local` MUST be that function of the system and nothing more, so that a command defined once runs here or on a target with only the executor changed. Taken from: the system library's `proc` (commons 0001-system FR-010) and the decision that one definition runs in any place.
- **FR-005**: `targets/ssh` MUST run the system's OpenSSH client through `proc` and nothing else: no SSH protocol code and no library of one (`ssh2` and the like MUST NOT be imported); the remote command MUST be quoted word by word into ONE argument, because `ssh` joins what follows the host into a string for the remote shell (a word is left as it is where it needs no quoting, otherwise in single quotes with each single quote written `'\''`, and a word with a NUL is refused); the options every call needs MUST be set in that one place: `-T`, `BatchMode=yes`, `ConnectTimeout` (10 seconds), `ServerAliveInterval` (15 seconds), no password and no keyboard-interactive prompt, a shared connection (`ControlMaster`, `ControlPath`, `ControlPersist`) where a folder is given, the key by reference (`IdentitiesOnly`, `-i`), the port and the jump chain, and `--` before the destination; a script MUST run as `sh -s -- <args>` with the script on the standard input. A call that cannot be made MUST be an exit of 255 with the reason, as a connection that did not happen. Taken from: stolos's `ssh` calls (`BatchMode=yes`, `ConnectTimeout=10`, `ServerAliveInterval=15`, `-T`, `ssh <host> sh -s`).
- **FR-006**: A host key MUST be checked and never accepted for the person: `StrictHostKeyChecking=yes` with the repository's known hosts and then the user's in `UserKnownHostsFile`, and `accept-new` and `no` MUST NOT be written anywhere; the first contact with a host MUST be a function of its own that fetches what the host shows and gives the fingerprints, and writes the host to the known hosts only where the fingerprint the person checked by another way is one the host showed. Taken from: stolos's known hosts from Git first (`known_hosts.auto`) and then the user's file, and its rule that a changed host key is a failure (E047-HOST-KEY).
- **FR-007**: `<program> <verb> --on <targets>` MUST dispatch the same verb through the executor of each target as `<program> run --json <verb> ...`, for the verbs whose reach policy allows `ssh`; the targets MUST be named by `--on` as ids joined by commas, `class:<class>` or `all`, and an unknown id or class MUST be refused naming it; the run over several MUST be bounded by a cap on how many run at once and a time for each, and a host that hangs or throws MUST NOT take the others with it. The entry `<program> run [--ssh] [--read-only] --json <verb> ...` MUST run the verb with `--json`, and with `--ssh` MUST take the command from `SSH_ORIGINAL_COMMAND` (all a forced command gets of it) and refuse anything that is not `<program> run --json ...`, refuse a verb with no reach policy or one that does not allow `ssh`, refuse a verb that changes something where `--read-only`, and never go on to another target. Taken from: stolos's one-shot `ssh <target> "archon ... --json"`.

## What comes back, and what is let in

- **FR-008**: `surfaces/ssh-inbound` MUST NOT be a model of its own: it MUST generate, from the reach policy of the actions, the lines of `authorized_keys` that force a key to one command (`restrict,command="<program> mcp"` where an action is reached through `mcp`, `restrict,command="<program> run --ssh"` where one is reached through `ssh`, each with `--read-only` for a key that may only read and `from="..."` where addresses are given; and, for a program that is not ours and only reads, such as a fleet's probe script, `restrict,command="<program>"` through the mode `program`), no line for a mode no action is reached through, and the `Match` block of `sshd_config` (public keys only, no terminal, no forwarding, no agent); a text that is not one public key line (a private key in particular), a program name that could break out of the quotes and an account that is not a name MUST be refused. Taken from: stolos's `restrict,command="archon mcp"` for the `ops` account (model/load.ts).
- **FR-009**: What a run on a target comes to MUST be the typed outcome and the one JSON envelope of a local run: an exit of 255 and a time out are the environment's (status 3, `E000-REMOTE-UNREACHABLE`, `E000-REMOTE-TIMEOUT`), a host key that does not match is the environment's too with its own code (`E000-REMOTE-HOSTKEY`), the program not being there (126, 127) is the environment's (`E000-REMOTE-NO-PROGRAM`), a refusal of the forced command (status 2 and no report) is a usage problem (`E000-REMOTE-REFUSED`), a stdout that is not the envelope is `E000-REMOTE-MALFORMED`, and each code MUST be explained by a catalogue the program can merge into its own; the runs over several targets MUST be ONE report (the table of the hosts as its text, each host's data under its id, every problem once and marked with its target) with the status 0 where every host ran with 0, 3 where none could be reached, 2 where all refused, and 1 otherwise, a partial failure, with the table of each host. Taken from: erga 274-agora FR-021 (statuses 0, 1, 2, 3) and the nested hand-off of 0003-headless-output FR-010.
- **FR-010**: The layout MUST be `targets/<name>` for executors and `surfaces/ssh-inbound` for the generator, each a row of the layers table that allows only the terminal, the system and Core (the generator Core alone), so that no unit can import an SSH library or the telemetry; and a ban on hand-built `ssh` arguments in consumers MUST be a function of the library: given the text of a program's sources it MUST find an `ssh` argument vector that sets the options only the executor sets. Taken from: the plan of this library and 0001-headless-layers FR-004 and FR-006.

## Acceptance scenarios

1. **Given** an action with no reach policy, **When** the conformance rule runs, **Then** `reach/missing` is found, per FR-003.
2. **Given** a destructive action whose policy has no confirmation, **When** its policy is checked, **Then** `reach/destructive-unconfirmed` is found, per FR-003.
3. **Given** a caller that may only read and an action that changes something, **When** the reach is decided, **Then** it is refused, per FR-001.
4. **Given** the argument vector `["ops", "run", "--json", "say", "it's; rm -rf /"]`, **When** it is quoted for the remote shell and a real shell reads it back, **Then** it is the same five words, per FR-005.
5. **Given** any target and configuration, **When** the ssh arguments are made, **Then** they hold `StrictHostKeyChecking=yes` and never `accept-new` or `no`, per FR-006.
6. **Given** a host that showed a fingerprint and a person who gives another, **When** the host is accepted, **Then** nothing is written, per FR-006.
7. **Given** two targets, one that runs and one that is unreachable, **When** `status --on all` runs, **Then** the report has a row for each, one problem for the unreachable one, and status 1, per FR-007 and FR-009.
8. **Given** `SSH_ORIGINAL_COMMAND` set to another command, **When** `run --ssh` is run, **Then** it is refused with status 2, per FR-007.
9. **Given** a read-only key and an action that changes something, **When** `run --ssh --read-only` is run, **Then** it is refused, per FR-007.
10. **Given** actions reached through `ssh` and `mcp` and a read-only key, **When** the inbound plan is made, **Then** a restricted forced-command line is made for each mode with `--read-only`, and none for a mode only a changing action is reached through, per FR-008.
11. **Given** an exit of 255 with a host-key message, a time out and a refusal, **When** each is mapped, **Then** they are status 3, 3 and 2 with their codes, per FR-009.
12. **Given** a source with `["ssh", "-o", "BatchMode=yes", ...]`, **When** the ban runs, **Then** it is found, per FR-010.

## Out of scope

- Non-shell devices (HTTP APIs): later adapters on the same Target port, with no change to the executor's shape.
- The tool server and the REST interface themselves (the channels `mcp` and `rest` are named here; their surfaces are not built).
- Writing `authorized_keys` or `sshd_config` on a machine: the generator writes text, a person or a program installs it.

## Edge cases

- A target address that begins with a dash (an option in disguise): not a target, per FR-005.
- A word of the remote command that is empty: quoted as `''`, per FR-005.
- A jump chain naming a target that is not known: the call is not made, per FR-005.
- A fan-out over no target: no row, status 0 is not claimed (a selector must name one), per FR-007.

## Assumptions

- The system has an OpenSSH client; where it has not, the call is an exit of 255 and the environment's problem.

## Open questions

- None.

## Key entities

- **Reach policy** - what an action may be reached through and as whom.
- **Target** - a machine, by id, class, address and references, never a secret.
- **Executor** - the port that runs a program here or elsewhere.
- **Inbound plan** - the forced-command lines and the `Match` block generated from reach.

## Success criteria

- **SC-001**: One definition of an action runs here and on any target, and what is let in on a target is generated from the same policy that bounds it.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
