# Feature Specification: Archon

**Spec ID:** 0034-archon
**Status:** Draft
**Owner:** if
**Domain:** commons
**Part of:** 0027-commons-libraries

**Input:** A fleet of servers, devices and workstations needs the same few things: to say once what each must be, to see what each is, to change it only with an approval that fits the fleet, and to prove what happened. A first engine for this, Stolos, grew into one product of about 126,000 lines that every fleet had to take whole. Fleets differ too much for that: a single person's home lab, a business and a regulated organization want different tools and different security. This specification retires that engine into libraries of commons and makes each fleet an assembly of them. The new library `commons/archon` is the Kanon library (0033-kanon) that states what a machine must be, projects it to the tools that carry it out, and assembles one command, `archon`, from plugins (`archon server ...`, `archon device ...`, `archon boot ...`). It builds no convergence engine: it renders for, runs and reads the results of Ansible, OpenTofu, Microsoft DSC, cloud-init and `commons/data`, as `commons/data` does for SQL databases. The same model also orders cloud accounts: `archon` generates infrastructure as code to converge the infrastructure-as-a-service of AWS, Azure, Cloudflare and other providers (accounts, networks, DNS, identities, storage and the machines that run in them), so one fleet and one model cover its own machines and its cloud accounts. Nothing of the old engine is kept for its own sake: backward compatibility is not a goal, and only new code that looks forward counts.

## The decision

- **FR-001**: The engine named Stolos MUST be retired: no library, package or command of commons MUST be named `stolos`, and what it did that is general MUST be done by libraries of `commons/`, while what is particular to one fleet MUST live in that fleet's own repository.
- **FR-002**: Compatibility with the engine that is retired (its formats, tags, releases, contracts, specifications and fleets) MUST NOT be a requirement of any library of commons, and a library MUST NOT carry a shim, a re-export or a migration path for it.
- **FR-003**: A fleet MUST be an assembly: its repository MUST consume libraries as dependencies by package name at exact versions, MUST hold its own data (its machines, tags, requirements and assurance profile) and MUST compose the libraries it chose in its own composition root; no fleet MUST need code of another fleet.

## The names

- **FR-004**: `commons/archon`, the package `@intellectual-frontiers/archon`, MUST be a library at conformance level L1 (0028-conformance-levels) that is Kanon (0033-kanon, with the instances, plugins and family of its FR-019 to FR-024): its Governance layer MUST state requirements and the approval policy of a fleet (FR-014), its Logical layer MUST make from them an order (the typed desired state of a subject: a machine, a device, a workstation or a cloud account) and a plan (what differs between the observed state and the order, with a hash a person can sign), and its Physical layer MUST hold the surfaces that face a caller (the command line, a tool server, forced commands over SSH) and the port that dialects implement.
- **FR-005**: A dialect MUST be a package of its own named `archon-dialect-<tool>` (`ansible`, `opentofu`, `dsc`, `cloud-init`), a plugin of the command MUST be a package of its own named `archon-<noun>` (`server`, `device`, `boot`, `tag`, `key`, `comply`, `connect`, `console`, `mcp`), and the library manifest MUST say which of the two a package is (the field `family`, 0027-commons-libraries, with the reserved names of `commons/libraries`) and MUST declare each dialect as an instance of the dialect port and each plugin as a plugin of the host (0033-kanon FR-019 to FR-024); a plugin MUST reach `archon` and every other package only through its public `exports`, and MUST NOT import another plugin.
- **FR-006**: The command a person types MUST be `archon`, one program for every machine, composed from the command branches of the plugins a fleet chose (the composition of `commons/headless`): where a verb runs (here or on a target) MUST be the reach policy of its action, and which verbs a caller sees MUST be its governance (audience, effect, tier), so that the same command runs on a PC and on a server.

## Delegation

- **FR-007**: `archon` MUST NOT implement what an existing tool does well: it MUST render the tool's input from an order, run the tool through the `Executor` port of `commons/headless` (here or by SSH), and read the tool's result into a typed outcome; it MUST NOT hold a module library, a provider library or a state store of its own beyond what `commons/estate` and `commons/data` provide.
- **FR-008**: A dialect MUST declare as data the kinds of resource it can carry out, whether it has a check mode, whether it is idempotent and whether it can destroy; and the model MUST say, for each annotation of a requirement and each dialect, whether it is expressed, carried or unexpressed with the reason (0033-kanon FR-005), so that a requirement that needs a faithful plan and is aimed at a dialect with no check mode is a named finding, never a surprise.
- **FR-009**: The choice of a dialect for a resource MUST be policy, not code: a fleet MUST choose by the kind of resource and the kind of subject, and the library MUST give presets named for the approach (the default, `pull-approved-tips`, has a machine pull the tip its fleet approved and converge itself, so that a controller needs no copy of a tool it cannot run; `push-from-controller` is allowed only where the controller can run the tool).
- **FR-010**: A system MUST be observed by one library and changed by another: `commons/integrations` and osquery observe and MUST NOT write, and a dialect changes; no client of ours MUST both read and write the same thing.
- **FR-011**: What a dialect renders (an inventory, a playbook, a configuration of OpenTofu in JSON, a document of DSC, a cloud-init document) MUST be generated, MUST say so in the file, MUST NOT be edited by hand, and MUST be committed only where a reviewer needs to see it; it is output, and it is the one exception to the rule that everything of ours is configured in TypeScript.
- **FR-012**: A dialect MUST pin the version of its tool (and of its collections, providers or resources) and MUST carry a conformance suite that runs the real tool, including the property that applying an order twice changes nothing the second time; a dialect that cannot show that property MUST say so in the matrix of FR-008.
- **FR-013**: The dialects of the first release MUST be the ones in this list, and each MUST say what its tool is and is not used for: Ansible for the configuration of hosts that run Linux (and of Windows hosts as managed nodes over SSH, from a Linux or macOS controller, because Windows cannot be an Ansible control node), OpenTofu for resources managed through an API, which is how `archon` converges cloud accounts as infrastructure as code (AWS, Azure, Google Cloud, Cloudflare and other providers: accounts, networks, DNS, identities, storage and the machines that run in them) and also DNS and network controllers, Microsoft DSC for a Windows workstation that converges itself, cloud-init and Ubuntu autoinstall for the first boot, and `commons/data` for databases.

## The approval of a change

- **FR-014**: A fleet MUST declare an assurance profile when it is initialized, `solo` (one person: an authenticated push to the fleet's remote and a typed confirmation, a key optional), `team` (a signature of a listed signer, with a passphrase or a hardware-backed key, a recovery key and an audit mail of every change) or `regulated` (hardware-backed keys, a second approver for a change of tier or a destructive change, a signed hash of the plan and a ledger of evidence kept off the machine); each control of a profile MUST be a requirement, so that a fleet can override one control with typed data and a recorded reason, and the profile MUST never be chosen for a fleet by default without the person being told what it means.
- **FR-015**: Whatever the profile, these MUST hold: a secret MUST NOT be in a model, a specification, a commit, a log or a report; no library MUST store or see a passphrase; an agent MUST propose and a person MUST approve, and no agent MUST be able to approve; a destructive action MUST need the marker of its requirement and a confirmation typed by a person.
- **FR-016**: The profile in force for a tip MUST be the one of the last tip that was approved: a commit MUST NOT lower its own bar, and the lowering of a profile MUST be judged by the rules of the profile it leaves and MUST be recorded with its reason.
- **FR-017**: Initializing a fleet MUST ask who administers it, whether any machine is reachable from the internet, whether it holds regulated data and whether a hardware key is at hand, MUST recommend a profile and MUST say in plain words what the profile allows (for `solo`: anyone who can push to the repository can change the machines); a check of the fleet MUST report whether the controls of its profile hold (for example, the protection of the default branch on its Git host), and a weaker profile MUST be reported as a decision with its date and never as a failure.

## How it is built and released

- **FR-018**: `archon` and each package named in FR-004 and FR-005 MUST have its own specification kit in its own folder, MUST be released as `<name>-v<version>` (0026-works-versioning), and MUST be reviewed adversarially (by readers that try to break its design, not to polish it) before its first release and at the end of each phase of the plan, every finding being closed or recorded as a Decision.
- **FR-019**: The first release of `archon` MUST wait for one slice to pass in virtual machines of `lab` on Linux: a fleet of one server converging the keys of its administrator and a baseline from an approved tip, with its state read back through osquery; and the measures of the first dialect (the fidelity of its plan, its idempotence, the finding of drift, the gate of destruction and the time) MUST be written in that dialect's specification.
- **FR-020**: The repository of the retired engine MUST be archived when FR-019 holds, and deleted only after a complete backup and at the explicit request of the owner; its open tickets MUST each be moved to a checklist item of the one ticket that tracks the subject (FR-021) or closed as superseded, one by one, before it is deleted.

## How the work is tracked

- **FR-021**: The work of this specification and of every library it names MUST be tracked in ONE parent ticket for each piece of work (for the retirement of the engine, one ticket in this repository): every sub-task, whether a library, a dialect, a plugin, a phase or a review, MUST be an item of that ticket's body written as a checklist line (`- [ ]`, checked when it is done), and the detail of an item MUST be a comment on that ticket; a separate ticket for a library, a phase or a sub-task MUST NOT be opened, and where one was opened its content MUST be moved to the parent and the extra ticket MUST be deleted.

## The alignment to standards

Every row below is a candidate that was named when this specification was written; none was read again in this work, so each is marked as not verified and each row marked `unaligned` is open to a Decision of the owner (0018-standards-first FR-005).

| Term | Standard and term | Relation | Verified |
|---|---|---|---|
| Requirement; order | NIST SP 800-128, Guide for Security-Focused Configuration Management of Information Systems: the baseline configuration | `closeMatch` | no |
| Assurance profile | NIST SP 800-63B: the authenticator assurance levels (AAL1 to AAL3) | `broadMatch` (levels of authentication, where a profile is also the policy of approval) | no |
| Plan; the loop of a machine that follows its fleet | the reconciliation loop of Kubernetes controllers | `closeMatch` | no |
| Order of resources and their dependencies | OASIS TOSCA, Topology and Orchestration Specification for Cloud Applications | `broadMatch` | no |
| Desired state of a host; its verification | SCAP (XCCDF and OVAL) | `broadMatch` | no |
| Dialect | the SQL dialects of `commons/data`; no standard names the term | `unaligned` | searched, none found |
| Fleet as an assembly | none found | `unaligned` | not searched beyond this repository |

## Acceptance scenarios

1. **Given** a fleet repository, **When** its dependencies are read, **Then** each library is named by package at an exact version and the repository has its own `fleet.ts` and composition root, and none is copied from another fleet, per FR-003.
2. **Given** a plugin package that imports another plugin or a private file of `archon`, **When** the check of 0033-kanon runs, **Then** it is a finding (`layers/private` or `layers/around`), per FR-005.
3. **Given** an order with a requirement that needs a faithful plan, **When** it is aimed at a dialect with no check mode, **Then** the matrix names the annotation `unexpressed` with its reason, per FR-008.
4. **Given** an order and a dialect, **When** the order is applied twice, **Then** the second application changes nothing, per FR-012.
5. **Given** a fleet of profile `team` and a commit that changes `fleet.ts` to `solo`, **When** a machine follows the tip, **Then** it refuses the commit, because the profile in force is that of the last approved tip, per FR-016.
6. **Given** a fleet of profile `solo` and an agent that pushes a change, **When** the machine follows the tip, **Then** the change is not applied until a person has approved it, per FR-015.
7. **Given** a person who initializes a fleet and answers that one person administers it, that nothing is reachable from the internet and that nothing is regulated, **When** the initialization recommends a profile, **Then** it recommends `solo` and says that anyone who can push to the repository can change the machines, per FR-017.
8. **Given** a Windows machine and a controller that is a Windows PC, **When** the default preset is used, **Then** the machine converges itself with its dialect and the controller runs no copy of Ansible, per FR-009 and FR-013.
9. **Given** an order whose subject is a cloud account (for example an AWS account, an Azure subscription or a Cloudflare zone), **When** it is aimed at the OpenTofu dialect, **Then** `archon` renders the infrastructure as code for it, shows a plan with a hash a person can approve and applies only that plan, per FR-007, FR-013 and FR-014.
10. **Given** a new library of this work, **When** its work is planned, **Then** it is a `- [ ]` line in the body of the one parent ticket with its detail in a comment of that ticket, and no ticket of its own exists, per FR-021.

## Out of scope

- A migration of any fleet, format or specification of the retired engine (FR-002).
- A console framework: the pages a person sees are projected from governance and from the logical schema of `commons/data`.
- Bespoke probes of facts that osquery gives.
- A cloud provider's own console or API client: the dialect renders the tool's input and reads its result, and a cloud's resources are the provider's of the tool.
- The libraries that `archon` uses (`commons/headless`, `commons/data`, `commons/integrations`, `commons/grc`, `commons/kanon`), which have their own specifications and owners; this specification states only what it needs of them.

## Edge cases

- A machine that cannot run the tool of its dialect (a Windows controller and Ansible): the preset of FR-009 gives it a dialect it can run, or the requirement is unexpressed for it, never silently skipped, per FR-008 and FR-009.
- A tool that has no check mode for a resource: its plan is not faithful, and the matrix says so, per FR-008; the requirement can still be applied if its effect class allows it.
- A fleet that wants a control its profile does not have: it adds a requirement of its own with a reason, and the profile stays what it declared, per FR-014.
- A profile that is lowered by a person who holds the profile's authority: allowed, judged by the profile it leaves, and recorded with its reason, per FR-016.
- A dialect whose tool changes its licence or its input between versions: the pin holds the fleet, and the conformance suite finds the change before a release, per FR-012.

## Assumptions

- Ansible, OpenTofu, Microsoft DSC and cloud-init remain available and maintained for the versions each dialect pins; the state of each at the date of writing was read from its public announcements and not from this repository.
- The `Executor` port of `commons/headless` (local and SSH targets) is what every dialect runs through, and its check-mode semantics and the composition of command branches are provided by that library's owner.
- A fleet can reach npm to install its libraries; no token is needed for a public package.

## Open questions

- **OQ-1**: Whether the name `archon` is free of a collision in the registers of trademarks and in software registries (the name is the retired engine's own command; this repository can show only that no term of its own clashes).
- **OQ-2**: Whether Ansible's licence (GPL, to be confirmed against its text) allows the packaging of the dialect as designed (rendering and calling the program, copying none of its code), and the licences of the collections each dialect pins.
- **OQ-3**: What `winget configure` does with Microsoft DSC, and which resources need the ZIP package of DSC and not the Store's.
- **OQ-4**: Whether a community provider for a network controller (UniFi) is good enough for the OpenTofu dialect; it must be proved against a real controller.
- **OQ-7**: The providers for each cloud (AWS, Azure, Google Cloud) and for Cloudflare must be pinned and reviewed as the community provider for a network controller is (OQ-4), including their licences and what each can and cannot read back as a plan.
- **OQ-5**: Whether the boot server of the retired engine (TFTP and HTTP, about 4,700 lines) stays small enough to keep, or whether `dnsmasq` or MAAS is better; neither was evaluated.
- **OQ-6**: The standards of the alignment table need to be read and mapped, and its two `unaligned` rows need Decisions of the owner.

## Key entities

- **Requirement** - what a subject must be, with its why, its effect class, its audience and its verification.
- **Order** - the typed desired state of a subject made from requirements.
- **Plan** - what differs between the observed state and an order, with a hash that can be signed.
- **Dialect** - the package that renders an order for one tool and reads its result.
- **Assurance profile** - the named policy of approval of a fleet: `solo`, `team` or `regulated`.
- **Subject** - what an order is for: a machine, a device, a workstation or a cloud account.
- **Fleet** - a repository of one person's or one organization's data that assembles libraries.

## Success criteria

- **SC-001**: A fleet repository holds its data and a composition root of a few dozen lines, and every capability it uses comes from a published library at an exact version.
- **SC-002**: A fleet of one person and a fleet of a regulated organization both use `archon`, and what differs between them is the assurance profile and the dialects chosen, as data.
- **SC-003**: No library of commons contains a convergence engine of its own, and each tool that converges is the real tool, pinned.
- **SC-004**: One fleet's repository orders its machines and its cloud accounts with the same requirements, the same plan and the same approval.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [ ] The standards of the alignment table verified against their documents
