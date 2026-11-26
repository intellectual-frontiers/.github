# Feature Specification: Asset properties and readings

**Spec ID:** 0043-asset-properties
**Status:** Draft
**Owner:** if
**Domain:** commons
**Part of:** 0041-telemetry-and-reach

**Input:** For GRC engineering every asset matters, and no kind of asset is second class: a server on a LAN, a switch, a cloud bucket, a SaaS tenant, a Kubernetes cluster, an identity provider and a code repository are all assets whose controls must be shown, with evidence, as of a date. What differs between them is only how they are read. This specification states the one table that does not differ: the **property** (a typed question about an asset that a control needs answered, such as `encrypted-at-rest`, `publicly-reachable`, `audit-logging-on`, `mfa-enforced`, `patched`, `owner-known`), the **probe** (a typed way of reading one property of one class of asset by one path, SSH with osQuery, an API, SNMP, Redfish, the Kubernetes API, an ingested report), the **reading** (the signed answer with its provenance, its authenticity and its age), the **freshness** of a reading as the primary measure of an asset's health, and the **views** (POA&M, SSP sections, a posture report) that are projections of the readings by control, so that no class of asset needs a report of its own. It also states how the tiers of an asset (the capability tiers of 0041-telemetry-and-reach, which are tiers of what the controller can read and never of how important an asset is) apply to every class of asset, the classes of assets that the catalog of the estate lacks, and how a posture is read as of a past date. It invents no record, no chain and no signature: it joins what `integrations`, `machine-probe`, `estate`, `estate-query`, `evidence-capture`, `grc`, `assessment`, `quality`, `findings` and `posture-report` already have (the reuse audit, `reuse-audit.md`, row by row). **Every requirement that asks for code is Deferred: this specification and the ones it governs hold no code.**

## The words property, reading and claim

A `claim` is the signed verdict of a person about a reading (`pass` or `fail` in `grc.attestation`), and the quality system has its own statements. The question a control needs answered is a **property** and the answer is a **reading**. A property is asked, a reading answers, an attestation judges.

## Properties

- **FR-001**: A property MUST be a typed value of the closed table `PROPERTIES` of the estate library, with an id (lower case words joined by hyphens, at most 60 characters), a title, a sentence that says exactly what true means, the type of its value (`boolean`, `enum` with its words, `number` with its unit, or `text` of a closed length), the classes of asset it applies to (FR-009), the controls it gives evidence for (FR-014), its default cadence (FR-021) and its sensitivity (`public`, `internal` or `restricted`: what a view may show of the value). The table MUST only grow: a property is added, never renamed or removed, and one that stops being asked is marked `retired` with its date. Relies on audit rows: A1, A2.
- **FR-002**: A property MUST be asked of an asset, never of a source: `encrypted-at-rest` is a question about a volume or a bucket whatever tool answers it. A property id MUST NOT contain the name of a tool, a provider, a protocol or a vendor, and a probe (FR-005) MUST be what carries them. Relies on audit rows: A1.
- **FR-003**: The first table MUST contain at least these properties, each with the classes of asset it applies to: `owner-known`, `inventory-registered`, `encrypted-at-rest`, `encrypted-in-transit`, `publicly-reachable`, `audit-logging-on`, `audit-logging-retained`, `mfa-enforced`, `privileged-access-reviewed`, `patch-current`, `backup-recent`, `backup-restore-tested`, `configuration-matches-declared`, `vulnerabilities-below-threshold`, `malware-protection-on`, `time-synchronised`, `certificate-valid`, `secret-not-in-code`, `branch-protected` and `unsupported-software-absent`; a class MAY add properties of its own. The list is a floor, not a ceiling. Relies on audit rows: A1, A7.
- **FR-004**: A property MUST say what an absent answer means, as a closed word of its own: `unknown` (nothing was read), `not-applicable` (the class or the configuration has no such thing; a probe MAY say it, and it MUST cite what it saw) or `denied` (the read was refused); an absent answer MUST NOT be a pass, and MUST NOT be a fail unless the policy says a missing answer fails after a time. Relies on audit rows: A1, A3.

## Probes

- **FR-005**: A probe MUST be a typed value `{ property, class, path, source, reads, scope }`: the property, the class of asset, the path (the closed table of FR-006), the connector or the program that reads (a connector id and its pinned version, or the typed argv of a read), what it reads (a named field, row set or API operation, as data), and the scope or permission the read needs (FR-050 of 0044-asset-connections). A probe MUST be data plus one pure total function from what was read to a typed value (`Result`); it MUST NOT run anything, and what it reads is run by the connector, the executor or the ingest workload. Relies on audit rows: A1, A2, B1.
- **FR-006**: The paths of a probe MUST be one closed table: `login-probe` (a typed command over a login, tier 2), `login-osquery` (an osQuery SELECT over a login, tier 3), `agent` (an exporter of ours on the asset, tier 4, optional), `protocol-poll` (SNMP, Redfish and the like, read from the controller or a relay), `api` (the read API of a cloud account, a SaaS tenant, a code host, an identity provider, a cluster), `event` (a derived reading from an event stream, 0044-asset-connections), `ingested` (the output of a tool or a report read by a typed codec) and `attested` (a person's signed statement, FR-011). The table MUST only grow. Relies on audit rows: A2, B1.
- **FR-007**: Every property of a class MUST have at least one probe on at least one path that its class can reach, or be listed as a gap of that class (`E-PROP-NO-PROBE` as a finding, not an error), so that a control that needs a property no probe can read is visible as unreachable and not as quietly satisfied. A property MAY have several probes on several paths for the same class (a virtual machine of a cloud has `patch-current` by `login-osquery` and by `api`); the readings of all of them MUST be kept, none overwritten, and the reading that satisfies a control is the one the policy of FR-016 names. Relies on audit rows: A1, A2.
- **FR-008**: A probe MUST be read-only: it MUST have no way to write, to start or stop a service, to change a setting or to run a command not in its typed set, and a read that the asset or the account refuses MUST be a `denied` gap (FR-004) and never an error that stops the other reads. A probe that needs a program on the asset MUST say so as `needs-agent` and MUST be optional (FR-006, the tier 4 rule of 0041-telemetry-and-reach); a property that only such a probe can read MUST be listed as a gap at tiers below 4. Relies on audit rows: A2, A3.
- **FR-009**: The classes of asset MUST be the kinds of the estate catalog (estate 0007-estate-kinds, with the kinds of FR-029), and each class MUST declare, as data, its **profile**: the tier at which the class is fully observable (`completeAt`: a SaaS tenant and a cloud account at tier 1, a Linux server at tier 2, a switch at tier 1), the properties it has, and the sources it is expected to be seen by (0044-asset-connections FR-032). An asset is **complete** when its tier is at least the `completeAt` of its class and every property of its class has a fresh reading or a typed gap. A tier is not a rank of importance and a higher tier is not better for a class that is complete at a lower one. Relies on audit rows: A10, C1.

## Readings

- **FR-010**: A reading MUST be a typed value `{ asset, property, value, absent?, at, probe, source, path, authenticity, evidence, signature }`: the asset id, the property, the typed value or the word of FR-004, the instant the source said the value held (`at`) and the instant the controller received it (`seen`), the probe by its id, the connector or program and its pinned version, the path, the authenticity (FR-012), the digest of the evidence it rests on (the raw read, redacted, kept by hash as the evidence chain of `evidence-capture` keeps it) and the signature (FR-011). A reading MUST be a document written once and never changed, as an observation is (estate 0006-estate-fleet-store FR-004). Relies on audit rows: A3, A9.
- **FR-011**: A reading MUST be signed as `grc` signs everything else, by an envelope (DSSE) or an SSH signature, by the key that the controller holds for the source (a connection, FR-040 of 0044; a person; a device key at tier 4): a reading from an ingested report is signed by the controller that ingested it and names the producer of the report; a person's statement (`attested`) is a `grc.attestation` whose `claim`, `statement` and `evidence` are exactly those of grc 0018-grc-acceptance-attestation and is a person's act that an agent MUST NOT make. A reading with no valid signature MUST NOT satisfy a control. Relies on audit rows: A5.
- **FR-012**: The authenticity of a reading MUST be one of the closed, ordered words `attested-by-person`, `attested-by-device`, `observed-by-controller`, `relay-attested`, `read-from-provider-api` and `ingested`, with `unauthenticated` below all of them, and a policy MUST be able to say the least authenticity that a property may be satisfied with for a class (default: `observed-by-controller` or above for a control of a high impact, `ingested` for a control of low impact), so that a report some tool wrote about an asset never satisfies by itself a control that asks for the controller's own observation. A reading with `unauthenticated` MUST NOT clear a finding, bring an asset online or satisfy a control (0041-telemetry-and-reach FR-044 states the same for telemetry). Relies on audit rows: A5, A6.
- **FR-013**: A reading MUST carry its grade by the ladder of `quality` (quality 0001-quality-evidence FR-026): a reading by a probe the controller ran and a signature that verifies is `E3`, an ingested reading is `E2` until a probe of the controller repeats it, a person's attestation is `E2`, and the branch lifts a grade where the commit that keeps it is signed (quality 0001-quality-evidence FR-045). The grades MUST NOT be a second scale. Relies on audit rows: A6.

## Controls, judgement and views

- **FR-014**: The controls a property gives evidence for MUST be urns of a catalog package of `grc` (SP 800-53 Rev 5.2.0 and SP 800-171 Rev 3 in `catalog-nist-sp800`, the SOC 2 criteria of `catalog-soc2`, the CSF 2.0 of `catalog-nist-csf-2`), and a control of another framework (CMMC, FedRAMP, HIPAA) MUST be reached by a mapping from a control of those (SSSOM, the form of `ifccm-mappings`) and MUST NOT be written as a second list of properties: CMMC Level 2 is SP 800-171 requirements, a FedRAMP baseline is a profile of SP 800-53 controls, and a HIPAA Security Rule specification is mapped to SP 800-53 controls by a crosswalk that a package carries with where it came from and its licence. A framework with no catalog package MUST be a gap that a view names, never a silent omission. Relies on audit rows: A7.
- **FR-015**: One table, the **claim table**, MUST give, for each control, the properties it needs and, for each class, how many assets are in scope; and it MUST be the one place where a framework's control is joined to evidence: a view MUST be a projection of readings through that table, and a class of asset MUST NOT have a table of its own. The table is data, generated from the properties (FR-014), and a control with no property MUST be listed as `no-property` and be a finding of the view. Relies on audit rows: A7, A8.
- **FR-016**: A property MUST be judged by a posture policy of `integrations` (integrations 0005-integrations-observe FR-006): an `Expectation` over the reading with a severity and the status a miss has, the policy MUST name the least authenticity (FR-012) and the freshness (FR-021) it needs, and `evaluatePolicy` MUST stay total and give a GRC `Status` with `pending` where the reading is absent, stale or too weakly authenticated. The judgement MUST NOT be made by a surface. Relies on audit rows: A1, A4.
- **FR-017**: The views MUST be generated, never written by hand and never kept as evidence: the plan of action and milestones (grc 0016-grc-poam) from the failed and pending properties with the owner, the milestone and the date; the sections of a system security plan (the implementation statement of a control, with the properties and the readings that show it) as OSCAL; the assessment of objectives (assessment 0002-objective-evidence) with each reading as an `examine` or `test` record; and the read-only posture site of `posture-report`. A view MUST say, for each control, the number of assets in scope, the number with a fresh passing reading, the number failing, and the number pending, by class. Relies on audit rows: A8.
- **FR-018**: A view MUST show a reading's value only as far as the sensitivity of the property allows and the audience of the view (`engineer`, `compliance`, `all`), and MUST NOT show a secret, a token or a personal datum; a restricted property MUST be shown as its judgement and the digest of its evidence. Relies on audit rows: A8, A3.

## Freshness

- **FR-019**: The primary measure of the health of an asset MUST be the freshness of its readings, not whether it answers: `coverage(asset) = fresh required readings / required readings`, over the properties the profile of its class requires (FR-009), and the same measure over a control, a class, a connection and the estate. Whether an asset answers (`presence`, 0041) MUST remain a measure of its reach and MUST be shown beside the coverage, never in its place. A cloud bucket never goes offline, and a switch that answers may still be unread for ten days. Relies on audit rows: A4, A9.
- **FR-020**: Freshness MUST be a total pure function `freshnessOf(reading, cadence, now)` of `fresh`, `stale` and `missing`, reusing the function and the verdicts of `quality` (by time and by change, quality 0001-quality-evidence FR-030); the instant used MUST be the controller's receive time (`seen`) and never the source's clock; and a reading that the source says holds only at a time long past MUST be stale by that time. Relies on audit rows: A4.
- **FR-021**: A cadence MUST be typed data of the property with a default (an hour for a property of an event, a day for a configuration, seven days for a review) and a policy MAY set a tighter one for a class or a connection but never a looser one than the property's maximum; a cadence MUST be the one the poll of 0044-asset-connections is scheduled by, so that freshness and polling are one number. A reading that is stale MUST open a finding of kind `reading-stale` (a severity from its control) that resolves on a fresh reading and never on a person's word. Relies on audit rows: A4, A8.
- **FR-022**: A change that a feed reports (0044-asset-connections FR-062) MUST make the readings of the properties it touches `stale` at once and request one targeted read, so that a configuration change is seen before its cadence says so. Relies on audit rows: A4, G2.

## Tiers

- **FR-023**: The capability tier of an asset MUST be the one closed, ordered type of 0041-telemetry-and-reach (`0` none, `1` protocol, `2` login, `3` login and osQuery, `4` agent), computed by a total pure function from the set of **reach paths** the asset has (`api`, `protocol`, `login`, `osquery`, `agent`, each with when it last worked), and an asset that has several MUST have the tier of the highest one that worked within its cadence; the paths are kept apart, so that a reading by a path that no longer works is not used and a fall in tier is a finding that names what was lost (0041-telemetry-and-reach FR-002). Relies on audit rows: A11, D1.
- **FR-024**: A non-host asset MUST have a tier by the same rule: a cloud account, a SaaS tenant, an identity provider, a code host organization and a cluster whose connection reads by `api` are tier `1`; a switch or a baseboard controller read by `protocol` is tier `1`; a cloud virtual machine read by the provider API and by a login is tier `2`; an asset known only from declarations or files (infrastructure as code, a report, an inventory export) and not read by any path is tier `0` and its readings are only `ingested` (FR-012). An asset's tier MUST NOT be declared, and no tier MUST be a precondition of an asset being in the register: the register holds every asset any source names (0044-asset-connections FR-030). Relies on audit rows: A11, D1.

## As of a date

- **FR-025**: The posture of an asset or of the estate as of an instant MUST be answered from the readings and the canonical states that were kept, by reading the evidence branch at the commit that was current then (`evidence-capture`: the canonical state of each asset on a branch of Git, a commit only where it changed, a hash-chained journal of every look) and running the same SQL over it (`estate-query`), with the same judgement; no second store and no time-series database MUST be made. The answer MUST name the commit, the instant and the freshness each reading had at the instant, so that an auditor can ask what was true on a day and get what the controller knew then, and not what it knows now. Relies on audit rows: A9.
- **FR-026**: The state of an asset MUST be a fold of its readings and its events (appeared, disappeared, tier changed, property changed, finding opened or resolved), as the state of a planning item is a fold of its events (`planning`); a reading and an event MUST be written once, and a correction MUST be a new one that names what it corrects. Relies on audit rows: A9.
- **FR-027**: A comparison between two instants (`posture diff A B`) MUST give the properties whose judgement changed, the assets that appeared or disappeared, the findings opened and resolved, and the controls whose coverage moved, from the two states of FR-025 and nothing else. Relies on audit rows: A9, A8.

## Where each piece lives

- **FR-028**: The table of properties, the tier function, the profile of a class and the freshness function MUST live in `estate` (governance and logical layers); the probe of a class by a connector MUST live in that connector's library (`integrations-<vendor>`, `machine-probe`); the judgement MUST live in `integrations` (posture policies); the signature in `grc`; the views in `grc`, `assessment` and `posture-report`; the as-of reading in `evidence-capture` and `estate-query`; and the product (the commands, the surfaces and the brand) in the product. No library MUST import a library that is above it in the Kanon order of its group (kanon 0033-kanon), and commons MUST hold no product code (0027-commons-libraries FR-028).

## Classes of asset

- **FR-029**: The catalog of kinds of the estate (estate 0007-estate-kinds) MUST carry, besides `cloud-resource`, `endpoint`, `application`, `workstation`, `workshop`, `mobile-app`, `service`, `domain` and `certificate`, the kinds `cloud-account` (provider, partition, identifier, and whether it is an account, a subscription, a project or an organization unit), `saas-tenant` (provider, tenant identifier, plan, geography, primary domain), `cluster` (distribution, version, the host of its API), `repository` (host, owner, name, visibility, default branch), `pipeline` (system, repository, trigger kinds), `image` (registry, name, digest), `data-store` (engine, whether it is managed by a provider or by the organization, data classification), `secret-store` (provider, kind), `identity` (a non-human identity: a service principal, an access key or a bot, with its provider, its kind and whether its owner is known; a human account is an entity and never an asset), `network-segment` (kind: virtual network, subnet, VLAN or security group; provider; address range as a CIDR text) and `population` (0044-asset-connections FR-036: kind, provider, the identifier of the group). Each MUST have typed attributes checked as the existing kinds are, the catalog MUST only grow, and the names of fixtures MUST be `synthetic-<kind>-NN`. Relies on audit rows: A10.
- **FR-030**: The kinds `server` and `device` MUST have attribute catalogs: `server` (operating system family, role, whether virtual, the platform that hosts it where it is known) and `device` (class: switch, router, access point, printer, baseboard controller, appliance or camera; vendor; model; serial), so that a machine and a device are checked as every other kind is. Relies on audit rows: A10.
- **FR-031**: The links of the estate MUST gain `contains` (a cloud account, a cluster or a network segment to what it holds), `member-of` (an asset to the population it belongs to), `built-from` (an image to the repository that builds it) and `acts-as` (an identity to the application, service or pipeline that uses it), each with the kinds it may start and end at, checked as the existing links are (estate 0007-estate-kinds FR-003). Relies on audit rows: A10.
- **FR-032**: A coverage list MUST say where each class the owner needs is held, as data, and a class with no kind and no `cloud-resource` type in the list MUST be a finding (`class-uncovered`): compute is `server` or a `cloud-resource` of type compute; storage a `cloud-resource` of type storage; network a `device` or a `network-segment`; identity an `identity`; a data store a `data-store`; a SaaS tenant a `saas-tenant`; a device a `device`; an endpoint an `endpoint`; a container an `image`, a `cluster` or a `population`; a function a `cloud-resource` of type function; a secret store a `secret-store`; a pipeline a `pipeline`; a repository a `repository`; a certificate a `certificate`; and a domain or its DNS a `domain`. Relies on audit rows: A10.

## Acceptance scenarios

1. **Given** a storage bucket of a cloud account and a Linux server, **When** `encrypted-at-rest` is asked of both, **Then** each has a reading by its own probe (an API read, a `login-osquery` read) under one property, one control mapping and one judgement, per FR-001, FR-005 and FR-016.
2. **Given** a property for which no probe exists for the class of an asset, **When** the view is built, **Then** it lists the property as unreachable for the class and does not show it as satisfied, per FR-007.
3. **Given** a reading `ingested` from a report and a control that asks for `observed-by-controller`, **When** the control is judged, **Then** it is `pending`, per FR-012.
4. **Given** a switch that answers every minute and a bucket that is never offline, **When** coverage is computed, **Then** a switch whose readings are older than their cadence has low coverage while it answers, per FR-019.
5. **Given** an audit on a past date, **When** `posture --as-of DATE` runs, **Then** it reads the evidence branch at that commit and says what the controller knew then, per FR-025.
6. **Given** a cloud virtual machine read by its provider API and by a login, **When** the login stops working, **Then** the tier falls from `2` to `1` by a finding that names the lost path, per FR-023.
7. **Given** a framework with no catalog package, **When** a view is built for it, **Then** the framework is named as a gap, per FR-014.

## Out of scope

- The connections that bring assets in, the connector contract, ingestion, the identity graph and the credentials: 0044-asset-connections.
- Any code: every requirement is Deferred until the owner's command-line acceptance run of 0041 has passed.
- The writing of a framework's catalog (CMMC, FedRAMP, HIPAA): a package of `grc` that a later specification governs; this specification only says how a control is reached.

## Edge cases

- A property that applies to one class only in some configurations (`backup-restore-tested` for a stateless function): the probe says `not-applicable` with what it saw, and a person MAY accept it by an attestation (FR-004).
- Two probes of one property disagree (an API says a volume is encrypted, the asset says its filesystem is not): both readings are kept and the judgement is `fail` where the policy says the weaker evidence wins for a safety property, and a finding of kind `readings-disagree` is opened (FR-007).
- A reading whose source clock is wrong by days: its `seen` time is used for freshness and the skew is a finding (FR-020).
- A reading of a restricted property in a view for `all`: the value is not shown, only its judgement and the digest (FR-018).
- An asset whose class has no profile yet: it is in the register with tier `0` or by its reach, its properties are none, and a finding says its class has no profile (FR-009).

## Assumptions

- The controller reads; the asset never pushes a reading as an authority. A reading an asset sends (tier 4) is `attested-by-device` and is weighed by the policy (FR-012).
- A control is judged by a person's policy and the controller's own readings; a framework's text is never copied into commons (a catalog package carries its source and licence).

## Open questions

- **OQ-1**: Should `sensitivity` of a property be per class (a `restricted` value for a human identity, a `public` one for a certificate)? Default: per property, with a class MAY raise it.
- **OQ-2**: Should a probe's value type be limited to scalars, as `posture` is today (integrations 0005 FR-001), or may it carry a small typed record? Default: scalars and a closed `enum`; a record is a second property.
- **OQ-3**: Is `E2` the right grade for an ingested reading until the controller repeats it? Default: yes, and a policy MAY say a given producer's report is `E3` where the tool is pinned and the run was the controller's (0044 FR-056).

## UNVERIFIED

- The text of the HIPAA Security Rule crosswalk to SP 800-53 and the profiles of CMMC and FedRAMP were not read in this change; their licences and forms (OSCAL profiles published by the issuing bodies, a crosswalk from the department that publishes it) are unknown to this specification, so none is named as a source (commons 0018-standards-first).
- The cadences and thresholds are proposals, not measured values.
- Whether the evidence branch's Git history gives an as-of read in time that an auditor will accept on an estate of tens of thousands of assets is not measured (FR-025); a later measure decides whether a snapshot index is needed.

## Key entities

- **Property**: a typed question about an asset that a control needs answered.
- **Probe**: the typed way to read one property of one class by one path.
- **Reading**: the signed, authenticated, dated answer to a property, with the digest of its evidence.
- **Claim table**: the generated join of control, property, class and scope.
- **Profile**: what a class needs (its tier, its properties, its expected sources).
- **Reach path**: a way the controller can read an asset (`api`, `protocol`, `login`, `osquery`, `agent`).
- **Tier**: the highest reach path that worked, `0` to `4`.
- **Coverage**: the share of required readings that are fresh.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| OSCAL (NIST, version 1.x): catalog, profile, mapping, SSP, assessment results, POA&M | The documents that a view is written as; a control is a catalog urn | `grc` and `catalog-nist-sp800` already implement the catalog, profile and assessment results writers; the SSP and mapping models were not re-read here |
| NIST SP 800-53 Rev 5, SP 800-171 Rev 3, SP 800-53A, SP 800-171A | The controls and the assessment objectives a property gives evidence for | `catalog-nist-sp800` (the source and licence it carries) |
| AICPA SOC 2 Trust Services Criteria | The criteria a property maps to, in our own words | `catalog-soc2` |
| NIST CSF 2.0 | The functions and categories a property maps to | `catalog-nist-csf-2` |
| SSSOM (Simple Standard for Sharing Ontological Mappings) | The mapping from a control of one framework to another | `commons/generated/ifccm-mappings.auto.sssom.tsv` is the form already in use |
| DSSE and SSHSIG | The signature of a reading | commons grc 0014-grc-sshsig and crypto 0001-crypto, implemented |
| ISO/IEC 25010 | Not used here | none |

## Success criteria

- **SC-001**: Every requirement of this specification that asks for code has a row of the enforcement register with the mechanism `none` and the note Deferred; each row that gets code has a test with synthetic names (`synthetic-<kind>-NN`) and no network.
- **SC-002**: Every requirement says which row of the reuse audit it relies on, and no requirement states a history.
- **SC-003**: A control of any framework in the claim table can be traced to properties, probes, readings and their evidence digests for any class of asset, without a class-specific rule.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement says which row of the reuse audit it relies on, or is about the rule itself
