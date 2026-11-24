# Feature Specification: Workstations and the agent workspace

**Spec ID:** 0008-estate-workstations
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The owner asks that the estate know the agent workspace as an important workstation type, whatever way it was set up, so that a machine on which coding harnesses work can be originated, adopted, observed and checked like any other asset. Today `workstation` is a word and not a kind of the catalog: the links `runs-on` may end at one, the tests use one (`defiant`, a persistent machine, adopted, observed and checked, with no attributes), and nothing else is said of it. It is grounded in the code of `commons/estate`, `commons/machine-probe` and the tenant commands of erga that were read for it; each place where the code did not support what was asked is marked. The ticket is intellectual-frontiers/.github#25. The owner decided the open questions on 2026-11-22 (each is marked where it was open), and this specification is implemented in `commons/estate` and, for the probe (FR-017 to FR-019), in `commons/machine-probe` (machine-probe 0008-machine-probe-agent-workspace).

## The kind

- **FR-001**: The catalog (0007-estate-kinds FR-001) MUST gain the kind `workstation` with these attributes, none of them required, so that an asset of the kind `workstation` that states none (the existing `defiant`) is still accepted: `role` (`agent-workspace`, `developer` or `other`), `disposability` (`disposable` or `persistent`), `isolation` (`container`, `vm` or `physical`), `os-family` (`arch`, `debian`, `rhel`, `macos`, `windows` or `other`), `distro` (`arch`, `ubuntu`, `debian`, `rocky`, `macos`, `windows` or `other`: the real distribution), `omarchy` (a boolean: the machine is an Omarchy machine, OQ-1), `harnesses` (a list of strings: `claude-code`, `codex`, `herdr`, `other`), and `agents-policy` (the digest of the typed `agents` policy that bounds the harnesses, as the person who sets the machine up states it, `sha256:` and 64 hexadecimal digits).
- **FR-002**: The values of `os-family`, `distro` and `omarchy` MUST be set from the observation, never from what a person writes: `omarchy` is a boolean attribute on `distro: arch` (decided 2026-11-22, OQ-1), the real distribution stays `arch` and the flag says Omarchy is on it (the probe reads `ID` and `ID_LIKE` of `/etc/os-release` and says `omarchy (arch)`; `ID=omarchy`, `ID_LIKE=arch` was read in a running Omarchy 4.5.0). An asset that says `omarchy: true` with a `distro` or an `os-family` other than `arch` MUST be refused.
- **FR-003**: The kind `application` MUST gain the value `agent-harness` for its attribute `tier`, and a new attribute `harness` (`claude-code`, `codex`, `herdr` or `other`) that is allowed only where the tier is `agent-harness`, a cross-attribute rule like the one `checkAttributes` already has for the name of a service; the link `runs-on` (0007-estate-kinds FR-003) already joins an application to a workstation and MUST be the way a harness is tied to the machine it runs on.
- **FR-004**: A session of a harness MUST NOT be an asset of any kind: it is an evidence record, named by the harness and the session, so that the estate holds what stays and the evidence holds what happened.
- **FR-005**: The catalog MUST only grow (0007-estate-kinds FR-001): the names above are the names the kind keeps, and a name is added to a list of values, never renamed or removed; for that reason each value is listed here for the owner to read before it is code.

## How a workstation comes to exist

- **FR-006**: An asset of the kind `workstation` MUST say where it came from as an asset does (0002-estate-governance FR-007), and the estate MUST NOT widen the rule that only a managed asset is `provisioned`, which says the system installed the machine: so a disposable machine that Lab builds from a description (a container image the library made, a machine that `archon` installed) MAY be `provisioned` and born `managed`, and a machine that someone else installed, including a published Omarchy image that was booted and then set up by any tool, MUST NOT: setting a machine up is not installing its operating system.
- **FR-007**: A workstation MUST be able to come to exist by: `provisioned` (only as FR-006 says); `self` (the machine registers itself by a declaration of its own); `paired` (a person and the machine exchange keys; the code's wording for `paired` is "a short code paired it", and it is widened to any exchange of keys, decided 2026-11-22, OQ-2); or `scan` (found by the neighbor table, which makes a `device`, FR-008).
- **FR-008**: A device found by `scan` is made as the kind `device` (`device-` and its hardware address, `deviceIdOf`) and is only listed (0002-estate-governance FR-002); adopting it AS a workstation changes its kind, which `moveState` did not do, so `moveState` MUST take the kind the asset is adopted as, only when a discovered asset is adopted and only with an approval record (the person and the `sha256:` hash of what they approved), and the attributes of the new kind (decided 2026-11-22, OQ-3). `moveState` MUST keep the attributes of an asset across a move.

## Adoption and ownership

- **FR-009**: The estate MUST name no system that sets a workstation up: for an adopted workstation the system the caller names owns `observe` and `verify` (the two capabilities an adopted asset offers, 0002-estate-governance FR-002), and for a managed one that system owns the capabilities it carries out: `observe`, `verify`, `access`, `plan`, `converge` and `update`.
- **FR-010**: A managed asset MUST name an owner for every capability it offers (0002-estate-governance FR-005), and an inherited one does not offer `provision`; so a managed workstation also needs an owner for `identity`, `backup` and `retire`, which no system carries out unless the caller says so. The system id `person` is the owner of what a person does and nothing automates (decided 2026-11-22, OQ-4), `identity: person` unless the caller names a system that owns the harness's key, `backup: person` and `retire` as FR-011 says; `workstationOwners` writes these owners for the system the caller names, a state and a disposability.
- **FR-011**: `retire` MUST be owned by a system only for a workstation whose `disposability` is `disposable`; for a `persistent` one it MUST be owned by `person`, so that a persistent human workstation is never retired by a system, and the estate MUST refuse, with the reason, a persistent workstation whose `retire` is owned by a system.
- **FR-012**: A workstation moves as any asset does (0002-estate-governance FR-003: `discovered` to `adopted`, `adopted` back to `discovered`, `adopted` to `managed`, and never a managed one): `adopted` to `managed` MUST need the approval of 0003-estate-logical FR-008 (the person and the `sha256:` hash of the plan they approved), and a persistent agent workspace MUST NOT be managed without it (FR-014).

## Invariants

- **FR-013**: An asset whose `role` is `agent-workspace` MUST state `agents-policy`, the digest of the typed `agents` policy that bounds what its harnesses may do; the estate MUST report a violation where it does not. This is the invariant `NoAuthorityWithoutScope` of the Operational Truth Ontology ("every authority has a scope", commons ontology 0002-oto FR-003) that an estate lists today as `not checked`: the estate checks it for this kind and no other: the typed `agents` policy of a harness IS an authority, and its digest its scope (decided 2026-11-22, OQ-5). A workstation that states `harnesses` and no `agents-policy` is a violation as well.
- **FR-014**: A persistent agent workspace (`disposability: persistent`, `role: agent-workspace`) MUST have an explicit approval record to be `managed` and to hold `harnesses`; the record is the one of FR-012, kept as the opsfolio records of approvals are (`fleets/<fleet>/records/`), and a disposable workspace MUST NOT need one.
- **FR-015**: An agent workspace MUST hold no ambient secret: its observation (FR-018) lists the **names** of the variables in the environment of the harness's account that look like secrets, and one is a violation of a policy (FR-017) and never an invariant of OTO; the value of a variable MUST NOT be observed, and an observation that carries one where a name belongs MUST be a violation (`NoSecretValuesObserved`).
- **FR-016**: An agent workspace MUST be observed within its freshness window (0003-estate-logical FR-003, `operationalTruth`): the capture policy (0004-estate-capture) gives an adopted asset one day and a managed one 15 minutes by default, and a day is too long for a machine on which an agent is acting, so the policy has a cadence by `role` (`perRole`, beside `perAsset`, an additive field; the cadence of an asset is its own, then that of its role, then that of its state), `PT15M` for an agent workspace whether adopted or managed, and a journal for disposable assets (`journal.disposable`) of granularity `changes-and-heartbeat`, which `journalOf` gives an asset that states `disposability: disposable`, to limit what is kept (`AGENT_WORKSPACE_CAPTURE` is the policy of this paragraph); the longest window stays seven days (`LONGEST_WINDOW_MS`). An agent workspace that was never observed, or not within its window, MUST be a violation (`AgentWorkspaceObserved`) where the estate is checked with the instant and the policy.

## The probe, as data

- **FR-017**: The policies of machine-probe are code today (`assert` is a function, machine-probe 0004-machine-probe-policies); a policy MAY have a **data form** of a policy, `ProbeRule`: an id, a title, the controls of NIST SP 800-53 Rev 5 it gives evidence for, the section and key of the observation it reads, a closed operator (`equals`, `not-equals`, `absent`, `le`, `ge`), the value, whether a miss is a `fail` or a `warn`, and the fix in words, evaluated by one small function, so that a pack for a kind is data a person can read and review as the OCID rows are; the existing pack stays as it is. The pack for an agent workspace is:

  | Rule | Reads | Miss | Controls (a proposal, to be reviewed) |
  |---|---|---|---|
  | `agent-no-ambient-secrets` | `@agent` `ambient-secret-names` is empty | fail | IA-5, AC-6 |
  | `agent-not-root` | `@agent` `uid` is not `0` | fail | AC-6 |
  | `agent-harness-known` | each of `@agent` `harnesses` is in the policy | warn | CM-7, CM-8 |
  | `agent-isolation-as-declared` | `@agent` `virt` agrees with the declared `isolation` | warn | CM-8 |
  | `ssh-keys-only` (existing) | `security.sshPasswordAuth` is `off` | warn | IA-2, IA-5 |

- **FR-018**: The probe MUST gain a section `@agent` with the facts of FR-017: `harnesses` (the harnesses found, from `mise` and the `PATH`, never by running a `mise` shim, which in Omarchy 4.5.0 starts an install over the network), `ambient-secret-names`, `uid`, and `virt` (what `systemd-detect-virt` says, or `none`); the probe's script, `parseProbe` and the pack are machine-probe's and are specified and proved there (machine-probe 0008-machine-probe-agent-workspace; that specification says what ran on a real machine and what did not), and the facts are: they are the facts that the real Omarchy 4.5.0 image could give and that were **not** probed.
- **FR-019**: The probe's `supportedOs` MUST be told that a family which says `(arch)` is Arch (rolling), because it reads `os.family.split(" ")[0]` and `omarchy (arch)` would give `omarchy`, which it does not know, so that `supported-os` of an Omarchy machine was `unknown` and is now `pass`; it is fixed in machine-probe (machine-probe 0008-machine-probe-agent-workspace FR-004).

## Declaring one: the fleet and Opsfolio

- **FR-020**: A tenant MUST declare a workstation as it declares any machine, a host file `fleets/<fleet>/hosts/<id>.ts` that exports `{ kind: "workstation", state, origin, owners, attributes }` (the form `opsfolio` reads: `kind`, `state`, `origin`, `owners`, `attributes`, `accepted`, `declared`), for example:

  ```ts
  export const agentbox = {
    kind: "workstation",
    state: "adopted",
    origin: "paired",
    owners: { observe: "opsfolio", verify: "opsfolio" },
    attributes: { role: "agent-workspace", disposability: "disposable", isolation: "vm", "os-family": "arch", distro: "arch", omarchy: true, harnesses: ["claude-code", "codex", "herdr"], "agents-policy": "sha256:0000000000000000000000000000000000000000000000000000000000000000" },
  };
  ```

  and the commands MUST work for it as they do for a server: `opsfolio asset enroll` (the SSH reach and the host key compared, with the restricted key of the probe), `opsfolio asset observe` (the probe, which now says `@agent`), `opsfolio asset adopt` for a discovered device (FR-008; wiring it is erga's, after the next release of commons), and `opsfolio asset manage` (the approval by the hash of the change to the host file). The digest in the example is not a real policy's.
- **FR-021**: An asset MUST have one owner for each capability (0002-estate-governance FR-004): where the owner of a workstation's `converge` is a system the caller names, no other system MAY also own it, and the estate MUST hold no view on which system that is or on how the workstation was set up (OQ-6).
- **FR-022**: Every observation of a workstation MUST name its source (the invariant `NoEvidenceWithoutAttribution` already checked, 0003-estate-logical FR-007), `opsfolio probe` or the name and version of the program that wrote it; and an observation that a machine writes about itself is the evidence of an asset of origin `self`.

## Acceptance scenarios

1. **Given** the existing workstation `defiant` that states no attribute, **When** the catalog has the kind, **Then** it is still accepted, per FR-001.
2. **Given** a workstation with `role: agent-workspace` and no `agents-policy`, **When** the invariants are checked, **Then** one violation names it, per FR-013.
3. **Given** a persistent workstation whose `retire` is owned by a system, **When** the asset is made, **Then** it is refused with the reason, and with `person` it is accepted, per FR-011.
4. **Given** a published Omarchy image that was booted and bootstrapped, **When** its origin is `provisioned`, **Then** it is refused, and with `paired` it is accepted, per FR-006 and FR-007.
5. **Given** a disposable and a persistent agent workspace, **When** the capture policy is read, **Then** each is due within 15 minutes, and the persistent one is `managed` only with an approval, per FR-014 and FR-016.
6. **Given** an observation of an Omarchy machine, **When** the probe's pack for an agent workspace judges it, **Then** each rule of FR-017 gives its verdict, and `supported-os` is not `unknown`, per FR-017 and FR-019.
7. **Given** an application with `tier: agent-harness`, `harness: codex` and a `runs-on` link to a workstation, **When** the estate is made, **Then** it is accepted, and with the same attribute on a tier `web` it is refused, per FR-003.

## What can be grounded and what cannot

| Matter | Grounded in | Status |
|---|---|---|
| `workstation` is used but not cataloged | `kinds.ts` (`runs-on` to `workstation`), tests with `defiant` | read |
| `provisioned` only for a managed asset the system installed | `asset.ts`, 0002-estate-governance FR-007 | read; contradicts the request in part (FR-006) |
| States, transitions, approval by plan hash | `states.ts`, `lifecycle.ts`, `moveState` | read |
| Every offered capability needs an owner | `defineAsset` (0002-estate-governance FR-005) | read; the owner `person` is new (FR-010) |
| Invariants are the OTO names | `invariants.ts` | read; `NoAuthorityWithoutScope` is `not checked` today (FR-013) |
| Capture cadence and freshness | `capture.ts` (`managed` 15 minutes, `adopted` a day, `perAsset`) | read; `perRole` is new (FR-016) |
| The probe reads `ID` and `ID_LIKE` | `machine-probe.sh` | read; `supportedOs` and `omarchy (arch)` (FR-019) found, not run |
| Policies are functions | `machine-probe/src/logical/policies.ts` | read; the data form is new (FR-017) |
| The facts of `@agent` | machine-probe 0008-machine-probe-agent-workspace | script and parser written and proved against recorded output; that specification says what ran on a real machine |
| How `opsfolio asset` handles the kind `workstation` | the host-file form read in erga's `opsfolio` | read in part: `adopt` as another kind is not supported (FR-008) |

## Out of scope

- Any change to erga's `opsfolio` commands, and the ontology.
- Sessions as assets (FR-004), a harness's accounts or models, and the persistent human workstation's own management.

## Edge cases

- A workstation that is both a developer's and an agent's: `role` has one value; the second role is a second asset (OQ-7, FR-001).
- A disposable workspace that is turned into a persistent one: the same asset moving from `disposable` to `persistent` needs the approval of FR-014 and a changed owner of `retire` (FR-011, FR-014).
- A machine whose `ID_LIKE` says `arch` and whose `ID` is not `omarchy`: `os-family: arch`, `distro: other` (FR-002).

## Assumptions

- The kind of a machine is the person's decision, written in its host file; the estate refuses what the catalog does not allow and says why.

## Open questions

All decided by the owner on 2026-11-22, each by accepting the recommendation:

- **OQ-1** (decided 2026-11-22): Omarchy is a boolean attribute (`omarchy: true`) on `distro: arch`, not a value of `distro`.
- **OQ-2** (decided 2026-11-22): `paired` is widened to any exchange of keys.
- **OQ-3** (decided 2026-11-22): a discovered device may be adopted as another kind, with an approval record (FR-008).
- **OQ-4** (decided 2026-11-22): `person` is the system id of what a person does (FR-010).
- **OQ-5** (decided 2026-11-22): the typed `agents` policy of a harness is an authority, so `NoAuthorityWithoutScope` is checked for the kind `workstation` (FR-013).
- **OQ-6** (decided 2026-11-22): one owner for each capability (FR-021); the estate names no system that converges a workstation.
- **OQ-7** (decided 2026-11-22): `role` is a single value (FR-001).

## Key entities

- **Workstation** - a machine a person or an agent works on (`workstation`).
- **Agent workspace** - a workstation whose `role` is `agent-workspace`: a place where coding harnesses work, bounded by an `agents` policy.
- **Agent harness** - an application of tier `agent-harness` that runs on a workstation.

## Success criteria

- **SC-001**: An agent workspace can be declared, observed, judged and adopted with the commands that exist, and each rule that is not supported by the code read is named.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is decided and dated
