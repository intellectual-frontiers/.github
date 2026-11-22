# Feature Specification: Workstations and the agent workspace

**Spec ID:** 0008-estate-workstations
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The owner asks that the estate know the agent workspaces coordinator (ergonex 0006-agents) as an important workstation type, so that a machine on which coding harnesses work can be originated, adopted, observed and checked like any other asset. Today `workstation` is a word and not a kind of the catalog: the links `runs-on` may end at one, the tests use one (`defiant`, a persistent machine, adopted, observed and checked, with no attributes), and nothing else is said of it. Everything here is a **proposal** for the owner, grounded in the code of `commons/estate`, `commons/machine-probe` and the tenant commands of erga that were read for it; each place where the code does not support what was asked is marked, and nothing changes in code until the owner decides. The ticket is intellectual-frontiers/.github#25.

## The kind

- **FR-001**: The catalog (0007-estate-kinds FR-001) MUST gain the kind `workstation` with these attributes, none of them required, so that an asset of the kind `workstation` that states none (the existing `defiant`) is still accepted: `role` (`agent-workspace`, `developer` or `other`), `disposability` (`disposable` or `persistent`), `isolation` (`container`, `vm` or `physical`), `os-family` (`arch`, `debian`, `rhel`, `macos`, `windows` or `other`), `distro` (`omarchy`, `ubuntu`, `debian`, `rocky`, `macos`, `windows` or `other`), `harnesses` (a list of strings: `claude-code`, `codex`, `herdr`, `other`), `coordinator` (the version of the coordinator that is installed, a string), `persona` (`human` or `agent`) and `agents-policy` (the digest of the typed `agents` policy of ergonex 0006-agents FR-005, `sha256:` and 64 hexadecimal digits).
- **FR-002**: The values of `os-family` and `distro` MUST be set from the observation, never from what a person writes: `omarchy` is a `distro`, a flag that says the machine is an Omarchy machine, and its `os-family` is `arch` (the probe reads `ID` and `ID_LIKE` of `/etc/os-release` and says `omarchy (arch)`; `ID=omarchy`, `ID_LIKE=arch` was read in a running Omarchy 4.5.0). Whether the flag is a value of `distro` or a boolean attribute of its own is OQ-1.
- **FR-003**: The kind `application` MUST gain the value `agent-harness` for its attribute `tier`, and a new attribute `harness` (`claude-code`, `codex`, `herdr` or `other`) that is allowed only where the tier is `agent-harness`, a cross-attribute rule like the one `checkAttributes` already has for the name of a service; the link `runs-on` (0007-estate-kinds FR-003) already joins an application to a workstation and MUST be the way a harness is tied to the machine it runs on.
- **FR-004**: A session of a harness MUST NOT be an asset of any kind: it is an evidence record, named by the persona, the harness and the session (ergonex 0006-agents FR-006), so that the estate holds what stays and the evidence holds what happened.
- **FR-005**: The catalog MUST only grow (0007-estate-kinds FR-001): the names above are the names the kind keeps, and a name is added to a list of values, never renamed or removed; for that reason each value is listed here for the owner to read before it is code.

## How a workstation comes to exist

- **FR-006**: An asset of the kind `workstation` MUST say where it came from as an asset does (0002-estate-governance FR-007), and the estate MUST NOT widen the rule that only a managed asset is `provisioned`, which says the system installed the machine: so a disposable machine that Lab builds from a description (a container image the library made, a machine that `archon` installed) MAY be `provisioned` and born `managed`, and a machine that someone else installed, including a published Omarchy image that was booted and then bootstrapped with `ergonex remote bootstrap`, MUST NOT: installing Ergonex on a machine is not installing its operating system. This corrects one premise of the request, that a bootstrap makes a machine `provisioned`: the code says it does not.
- **FR-007**: A workstation MUST be able to come to exist by: `provisioned` (only as FR-006 says); `self` (the machine registers itself: a new verb `ergonex agent register` writes its own host-file declaration, FR-017, which is what `self` means, the controller adopting itself); `paired` (a person and the machine exchange keys: `ergonex remote bootstrap` with a pinned host key and the harness's key; the code's wording for `paired` is "a short code paired it", so widening it to an exchange of keys is a proposal, OQ-2); or `scan` (found by the neighbor table, which makes a `device`, FR-008).
- **FR-008**: A device found by `scan` is made as the kind `device` (`device-` and its hardware address, `deviceIdOf`) and is only listed (0002-estate-governance FR-002); adopting it AS a workstation changes its kind, which `moveState` does not do (it keeps the kind), so adoption as a workstation MUST have a way to say the kind when the person adopts: a proposal for `opsfolio asset adopt`, not supported by the code read (OQ-3).

## Adoption and what Ergonex owns

- **FR-009**: `ergonex` MUST be usable as a system id (`parseSystemId` accepts `ergonex`); for an adopted workstation it owns `observe` and `verify` (the two capabilities an adopted asset offers, 0002-estate-governance FR-002), and for a managed one it owns the capabilities its commands carry out: `observe`, `verify`, `access`, `plan`, `converge` and `update`.
- **FR-010**: A managed asset MUST name an owner for every capability it offers (0002-estate-governance FR-005), and an inherited one does not offer `provision`; so a managed workstation also needs an owner for `identity`, `backup` and `retire`, which Ergonex does not carry out. This specification proposes the system id `person` for what a person does and nothing automates (no convention for it exists in the code read: OQ-4), `identity: ergonex` where the harness's key is Ergonex's (ergonex 0006-agents FR-029), `backup: person` and `retire` as FR-011 says.
- **FR-011**: `retire` MUST be owned by `ergonex` only for a workstation whose `disposability` is `disposable`; for a `persistent` one it MUST be owned by `person`, so that a persistent human workstation is never retired by a system, and the estate MUST refuse, with the reason, a persistent workstation whose `retire` is owned by a system.
- **FR-012**: A workstation moves as any asset does (0002-estate-governance FR-003: `discovered` to `adopted`, `adopted` back to `discovered`, `adopted` to `managed`, and never a managed one): `adopted` to `managed` MUST need the approval of 0003-estate-logical FR-008 (the person and the `sha256:` hash of the plan they approved), which is the hash that `ergonex plan` prints and that its evidence record names (ergonex 0002-workspace-model FR-042), and a persistent agent workspace MUST NOT be managed without it (FR-014).

## Invariants

- **FR-013**: An asset whose `role` is `agent-workspace` MUST state `agents-policy`, the digest of the typed `agents` policy that bounds what its harnesses may do; the estate MUST report a violation where it does not. This is the invariant `NoAuthorityWithoutScope` of the Operational Truth Ontology ("every authority has a scope", commons ontology 0002-oto FR-003) that an estate lists today as `not checked`: this specification proposes to check it for this kind and no other, and the mapping of a harness to an OTO authority is the owner's (OQ-5).
- **FR-014**: A persistent agent workspace (`disposability: persistent`, `role: agent-workspace`) MUST have an explicit approval record to be `managed` and to hold `harnesses`; the record is the one of FR-012, kept as the opsfolio records of approvals are (`fleets/<fleet>/records/`), and a disposable workspace MUST NOT need one.
- **FR-015**: An agent workspace MUST hold no ambient secret: its observation (FR-018) lists the **names** of the variables in the environment of the harness's account that look like secrets, and one is a violation of a policy (FR-017) and never an invariant of OTO; the value of a variable MUST NOT be observed. (Ergonex 0006-agents FR-007 reads a token from `ERGONEX_GITHUB_TOKEN` first, which is such a variable: for the persona `agent` it is amended there to be accepted and warned about.)
- **FR-016**: An agent workspace MUST be observed within its freshness window (0003-estate-logical FR-003, `operationalTruth`): the capture policy (0004-estate-capture) gives an adopted asset one day and a managed one 15 minutes by default, and a day is too long for a machine on which an agent is acting, so this specification proposes a cadence by `role` for the policy (`perRole`, beside `perAsset`, an additive field), `PT15M` for an agent workspace whether adopted or managed, and the journal's granularity `changes-and-heartbeat` for a disposable one to limit what is kept; the longest window stays seven days (`LONGEST_WINDOW_MS`).

## The probe, as data

- **FR-017**: The policies of machine-probe are code today (`assert` is a function, machine-probe 0004-machine-probe-policies); this specification proposes that a policy MAY have a **data form** of a policy, `ProbeRule`: an id, a title, the controls of NIST SP 800-53 Rev 5 it gives evidence for, the section and key of the observation it reads, a closed operator (`equals`, `not-equals`, `absent`, `le`, `ge`), the value, whether a miss is a `fail` or a `warn`, and the fix in words, evaluated by one small function, so that a pack for a kind is data a person can read and review as the OCID rows are; the existing pack stays as it is. The pack for an agent workspace is:

  | Rule | Reads | Miss | Controls (a proposal, to be reviewed) |
  |---|---|---|---|
  | `agent-policy-present` | `@agent` `policy-digest` is present and is the digest the estate states | fail | AC-6 |
  | `agent-token-file-private` | `@agent` `token-file-mode` is `0600` or absent | fail | IA-5 |
  | `agent-no-ambient-secrets` | `@agent` `ambient-secret-names` is empty | fail | IA-5, AC-6 |
  | `agent-not-root` | `@agent` `uid` is not `0` | fail | AC-6 |
  | `agent-coordinator-current` | `@agent` `coordinator` is at least the pin of the estate | warn | CM-2, SI-2 |
  | `agent-harness-known` | each of `@agent` `harnesses` is in the policy | warn | CM-7, CM-8 |
  | `agent-isolation-as-declared` | `@agent` `virt` agrees with the declared `isolation` | warn | CM-8 |
  | `ssh-keys-only` (existing) | `security.sshPasswordAuth` is `off` | warn | IA-2, IA-5 |

- **FR-018**: The probe MUST gain a section `@agent` with the facts of FR-017: `coordinator` (the version `ergonex --version` prints), `persona`, `harnesses` (the harnesses found, from `mise` and the `PATH`, never by running a `mise` shim, which in Omarchy 4.5.0 starts an install over the network), `policy-digest`, `token-file-mode`, `ambient-secret-names`, `uid`, and `virt` (what `systemd-detect-virt` says, or `none`); that the probe reads these is a change to its script and to `parseProbe`, which this specification does not make, and none of the facts was run on a machine for it: they are the facts that the real Omarchy 4.5.0 image could give and that were **not** probed (what was run there is in the research note of ergonex 0006-agents).
- **FR-019**: The probe's `supportedOs` MUST be told that a family which says `(arch)` is Arch (rolling), because it reads `os.family.split(" ")[0]` and `omarchy (arch)` would give `omarchy`, which it does not know, so that `supported-os` of an Omarchy machine is `unknown` today and not `pass`: a proposal for the probe, found by reading `supportedOs` and the probe's script, and not run.

## Declaring one: the fleet and Opsfolio

- **FR-020**: A tenant MUST declare a workstation as it declares any machine, a host file `fleets/<fleet>/hosts/<id>.ts` that exports `{ kind: "workstation", state, origin, owners, attributes }` (the form `opsfolio` reads: `kind`, `state`, `origin`, `owners`, `attributes`, `accepted`, `declared`), for example:

  ```ts
  export const agentbox = {
    kind: "workstation",
    state: "adopted",
    origin: "paired",
    owners: { observe: "ergonex", verify: "ergonex" },
    attributes: { role: "agent-workspace", disposability: "disposable", isolation: "vm", "os-family": "arch", distro: "omarchy", harnesses: ["claude-code", "codex", "herdr"], coordinator: "0.5.7", persona: "agent", "agents-policy": "sha256:0000000000000000000000000000000000000000000000000000000000000000" },
  };
  ```

  and the commands MUST work for it as they do for a server: `opsfolio asset enroll` (the SSH reach and the host key compared, with the restricted key of the probe), `opsfolio asset observe` (the probe, which now says `@agent`), `opsfolio asset adopt` for a discovered device (FR-008), and `opsfolio asset manage` (the approval by the hash of the change to the host file). The digest in the example is not a real policy's.
- **FR-021**: WHERE a workstation is managed by Ergonex, its `converge` is owned by `ergonex` and MUST NOT also be owned by `opsfolio` (an asset has one owner for each capability, 0002-estate-governance FR-004): `opsfolio converge` then does not converge it, and observes it as any asset; which of the two converges a workspace is the owner's (OQ-6).
- **FR-022**: Every observation of a workstation MUST name its source (the invariant `NoEvidenceWithoutAttribution` already checked, 0003-estate-logical FR-007), `opsfolio probe` or `ergonex <version>`; and an observation that Ergonex writes about itself (`ergonex agent register`) is the evidence of an asset of origin `self`.

## Acceptance scenarios

1. **Given** the existing workstation `defiant` that states no attribute, **When** the catalog has the kind, **Then** it is still accepted, per FR-001.
2. **Given** a workstation with `role: agent-workspace` and no `agents-policy`, **When** the invariants are checked, **Then** one violation names it, per FR-013.
3. **Given** a persistent workstation whose `retire` is owned by `ergonex`, **When** the asset is made, **Then** it is refused with the reason, and with `person` it is accepted, per FR-011.
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
| The facts of `@agent` | none | **not probed**: a proposal |
| How `opsfolio asset` handles the kind `workstation` | the host-file form read in erga's `opsfolio` | read in part: `adopt` as another kind is not supported (FR-008) |

## Out of scope

- Any change to estate, machine-probe or opsfolio code, and the ontology: that waits for the owner.
- Sessions as assets (FR-004), a harness's accounts or models, and the persistent human workstation's own management.

## Edge cases

- A workstation that is both a developer's and an agent's: `role` has one value; the second role is a second asset (OQ-7, FR-001).
- A disposable workspace that is turned into a persistent one: the same asset moving from `disposable` to `persistent` needs the approval of FR-014 and a changed owner of `retire` (FR-011, FR-014).
- A machine whose `ID_LIKE` says `arch` and whose `ID` is not `omarchy`: `os-family: arch`, `distro: other` (FR-002).

## Assumptions

- The kind of a machine is the person's decision, written in its host file; the estate refuses what the catalog does not allow and says why.

## Open questions

- **OQ-1**: Whether Omarchy is a value of `distro` or a boolean attribute (`omarchy: true`) as the request words it ("a distro flag").
- **OQ-2**: Whether `paired` is widened from "a short code paired it" to any exchange of keys.
- **OQ-3**: How a discovered device is adopted as another kind.
- **OQ-4**: The system id for what a person does (`person`), since every offered capability needs an owner.
- **OQ-5**: Whether a harness's `agents` policy is an OTO authority, and so whether `NoAuthorityWithoutScope` may be checked for a kind.
- **OQ-6**: Which of Ergonex and Opsfolio converges a workspace; one owner for each capability.
- **OQ-7**: Whether `role` is one value or a list.

## Key entities

- **Workstation** - a machine a person or an agent works on (`workstation`).
- **Agent workspace** - a workstation whose `role` is `agent-workspace`: a place where coding harnesses work, bounded by an `agents` policy.
- **Agent harness** - an application of tier `agent-harness` that runs on a workstation.

## Success criteria

- **SC-001**: An agent workspace can be declared, observed, judged and adopted with the commands that exist, and each rule that is not supported by the code read is named.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
