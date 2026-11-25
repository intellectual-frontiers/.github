# Feature Specification: The probe of a workshop

**Spec ID:** 0008-machine-probe-agent-workspace
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** A machine on which coding harnesses work (a workshop in the terms of the workbench, estate 0008-estate-workstations) needs facts the probe did not give: the harnesses, whether a secret sits in the environment, whether the harness runs as root and how the machine is isolated. It also needs a policy to be data a person can read and review, and the probe's `supported-os` to know an Omarchy machine. The estate states what each rule compares with (estate 0008-estate-workstations FR-017 to FR-019).

## Requirements

- **FR-001**: The POSIX probe MUST give a section `@agent` on a machine where a harness is found, and no section elsewhere: `harnesses` (those of `claude-code`, `codex` and `herdr` found, sorted, found as a program on the `PATH` that is not a `mise` shim or as a directory of `mise` installs, and never by running a shim, which starts an install over the network), `ambient-secret-names`, `uid`, `virt` (what `systemd-detect-virt` says, `none`, or `unknown`) and `isolation` (`container`, `vm`, `physical` or `unknown`). It MUST change nothing, and `parseProbe` and `toObserved` MUST read the section as `agent` of the observation, and `observedState` MUST carry it (the names, the harnesses, the user and the isolation).
- **FR-002**: A policy MAY be data: a `ProbeRule` with an id, a title, the controls of NIST SP 800-53 Rev 5, the section and the key it reads, a closed operator (`equals`, `not-equals`, `absent`, `le`, `ge`), a value, whether a miss `fail`s or `warn`s, what a key the probe did not give is (`unknown`, `pass` or `miss`; `absent` passes) and the fix in words; `evaluateRules` MUST judge a list of them against the probe's output, in order, giving the results of the existing pack (an id, a status, its controls, a detail and a fix); `le` and `ge` MUST compare dotted numbers (`0.5.7`, `0600`) and say `unknown` where a side is not one. The ten policies of the existing pack MUST stay as they are.
- **FR-003**: The pack for a workshop, `workshopRules`, MUST be the rules `agent-no-ambient-secrets` (no name: `fail`), `agent-not-root` (`uid` is not `0`: `fail`), `agent-harness-known` (the harnesses found are those the estate declares: `warn`) and `agent-isolation-as-declared` (`isolation` is the one declared: `warn`), each with controls of SP 800-53 Rev 5, and `evaluateWorkshop` MUST add `ssh-keys-only` of the existing pack.
- **FR-004**: `supportedOs` MUST know that a family that says `(arch)` is Arch, a rolling distribution that is supported, so that `supported-os` of an Omarchy machine (`omarchy (arch)`) is `pass` and not `unknown`.
- **FR-005**: The value of a variable MUST NOT be given: the probe says the names of the variables of its environment and of the profile files of the account (`.profile`, `.bash_profile`, `.bashrc`, `.zshenv`, `/etc/environment`, `environment.d`) whose name looks like a secret (it holds `TOKEN`, `SECRET`, `PASSWORD`, `PASSWD`, `CREDENTIAL`, `APIKEY`, `API_KEY`, `PRIVATEKEY`, `PRIVATE_KEY`, `ACCESSKEY` or `ACCESS_KEY`, and does not end in `_FILE`, `_PATH` or `TOKENS`), and nothing else of the variable.

## Acceptance scenarios

1. **Given** the real output of the probe on a machine with a harness, **When** it is read, **Then** the `agent` facts are there and a machine with none has none, per FR-001.
2. **Given** a rule and an output, **When** each operator is judged, **Then** a miss is the rule's `fail` or `warn`, a key not given is what the rule says, and `0.5.10` is at least `0.5.7`, per FR-002.
3. **Given** the observation of an Omarchy machine and what an estate declares, **When** the pack for a workshop judges it, **Then** each rule gives its verdict and `supported-os` is `pass`, per FR-003 and FR-004.
4. **Given** a variable named like a secret with a value in the environment of the probe, **When** it runs, **Then** its name is given and its value is not, per FR-005.

## Out of scope

- The probe of Windows (`machine-probe.ps1`): the section is for the POSIX probe.
- Judging a harness's behavior: the probe says what is installed and how, not what a session did.

## Edge cases

- A harness that is a `mise` shim is not found: it is not installed, and running it would install it over the network, per FR-001.
- A machine with no `systemd-detect-virt` has `virt=unknown` and `isolation=unknown`, and the rule `agent-isolation-as-declared` says `unknown`, per FR-001 and FR-002.
- A variable that names a path (`..._TOKEN_FILE`) or a count (`MAX_THINKING_TOKENS`) is not a secret and are not named, per FR-005.

## Assumptions

- The harnesses an estate declares are the policy of which harnesses may be there: the rule compares the sets.
- The controls of the rules are a reviewer's to confirm, as the controls of the existing pack were.

## What ran on a real machine

- The script ran on the published Omarchy 4.5.0 virtual machine image (downloaded, its SHA-256 and kernel and initrd checked, booted by QEMU software emulation with no KVM, over SSH as `omarchy`): its output is `suite/fixtures/facts-omarchy-4.5.0.txt`, and the tests read it. It gave `family=omarchy (arch)`, `harnesses=herdr` (`/usr/bin/herdr`; `claude` and `codex` are `mise` shims and were not found, as FR-001 says), `uid=1000`, `virt=qemu`, `isolation=vm` and no secret names.
- The script ran on this container (a Docker container, root): it gave `isolation=container`, and the test runs it with a variable named like a secret and a value, and finds the name and never the value.
- The PowerShell probe has no section.

## Open questions

- None.

## Key entities

- **Probe rule** - a policy as data (`ProbeRule`).
- **Agent facts** - what the section `@agent` says (`AgentFacts`).

## Success criteria

- **SC-001**: A workshop's observation is judged by a pack a person can read, and none of its facts holds a secret's value.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
