# Reuse audit: asset properties and readings

**For:** 0043-asset-properties. **Read:** this repository at the commit that carries this file, on 2026-11-26, by reading the manifests of the libraries and the specifications beside them, and the code where a name is given. Nothing was run. Each row says what commons has (the library and the names), what is missing (the gap), and a decision: **reuse** (use it as it is), **extend** (the library that has it gains a requirement) or **new** (nothing exists). A requirement of 0043 cites the row it relies on.

Paths are under `commons/`. A name in backticks is an export or a term of the specification named. "Spec" names a specification of the library, as `0005-integrations-observe FR-006`.

## A. Properties, readings, judgement and views

| # | Need | Existing library and symbols | Gap | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| A1 | A typed question a control needs answered, judged against an expectation | `integrations` 0005-integrations-observe FR-006: a posture policy is data (`id`, `title`, `fact`, an `Expectation`, a `Severity`, the status a miss has, the control urns, a fix); `evaluatePolicy` is total and gives a GRC `Status` (`pending` where the fact was not observed) | A fact is named inside one connector's governance; there is no table of facts across classes, so `encrypted-at-rest` of a bucket and of a volume are two unrelated names | extend (the estate gains the table of properties; a policy's `fact` names one) | The judgement exists and is right; the shared name does not |
| A2 | A way of reading a fact by a path | `machine-probe`: the three read-only requests (`facts`, `version`, one `osquery` SELECT) and the policy pack that judges an observation with the SP 800-53 controls it gives evidence for; `integrations` connectors (`probe`, `observe`); `integrations-snmp`, `-redfish`, `-otel` | No typed object that says which property a read gives for which class by which path | new (the probe, a small typed value over the existing readers) | A binding between a property and a reader; no reader changes |
| A3 | The shape of what a read returns | `integrations` 0005 FR-001: an observation is `{at, provider, account, assets, posture, gaps, entities?, records?}` with typed gaps (`denied`, `unavailable`, `partial`) and scalar posture values; `estate` `StoredObservation` | A reading with its probe, authenticity, evidence digest and signature | extend (the reading wraps a posture value) | Posture values are scalar by design; the reading adds provenance, not a new value shape |
| A4 | Freshness | `integrations` 0005 FR-007 (every connector has `observation-fresh`); `quality` `pure/freshness.ts`: `freshnessOf`, `DEFAULT_CADENCES`, verdicts by time and by change (quality 0001-quality-evidence FR-030, FR-047) | A cadence per property and per class; coverage as a measure | extend (cadence is a field of the property; coverage a function over `freshnessOf`) | One freshness function and one set of verdicts |
| A5 | Signed payloads | `grc` `signers/dsse` (`dsseSigner`), `signers/sshsig` (`sshsigSigner`, the namespace of the evidence), `physical/signer`; `grc` attestation (`subject`, `check`, `claim`, `statement`, `attester`, `role`, `evidence`) and grc 0018-grc-acceptance-attestation | The signer of a connection; a reading's payload type | reuse (new payload type, no new signer) | A reading is signed as everything else is; `claim` is a person's verdict and is kept as such |
| A6 | Grades of evidence | `quality` `pure/names.ts` (`Grade`, `gradeRank`), `pure/ladder.ts` (`gradeOfEvidence`, `judgeRequirement`, `reviewDebt`), 0001-quality-evidence FR-026, FR-045 | A rule for an ingested reading and for a probe the controller ran | extend (two rules in the ladder) | The ladder already caps a person at `E2` and lifts by a signed commit |
| A7 | Controls and frameworks | `catalog-nist-sp800` (SP 800-53 Rev 5.2.0, SP 800-171 Rev 3 with 800-53A and 800-171A objectives), `catalog-soc2`, `catalog-nist-csf-2`; `generated/ifccm-mappings.auto.sssom.tsv` (SSSOM mappings of the ontology) | CMMC, FedRAMP and HIPAA have no catalog package or crosswalk | extend (a mapping from a control to another framework's control; packages later) | CMMC Level 2 is SP 800-171; a FedRAMP baseline is a profile of SP 800-53; a crosswalk package is a separate, licensed item |
| A8 | Views of posture | `grc` 0016-grc-poam (POA&M), the OSCAL writers; assessment 0002-objective-evidence (objectives and their evidence, `examine`, `interview`, `test`, validity); `dossier` (the posture lens and the static HTML rendition of commons 0046-dossiers); `mizan` register (OSCAL of requirements) | A join from control to properties to readings across classes (the claim table) | extend (the claim table is generated data; the views read it) | The views exist per source; one table feeds them all |
| A9 | History and as-of reads | `evidence-capture` 0002-0006: the canonical state of each asset on a branch of Git, a commit only where it changed, a hash-chained journal of every look, a query over it; `estate-query` (SQL over the estate, 0005 live); `planning` (an item is a fold of append-only events); `quality` ledger | A defined as-of read and the comparison of two instants | extend (the function over the existing branch and SQL; no store) | Git already keeps, signs and orders the evidence; a time-series database would be a second source of truth |
| A10 | The catalog of kinds and links | `estate` 0007-estate-kinds: `KINDS` (`cloud-resource`, `endpoint`, `application`, `workstation`, `workshop`, `mobile-app`, `service`, `domain`, `certificate`) with typed attributes, `LINK_KINDS` (`runs-on`, `exposes`, `depends-on`, `resolves-to`, `secured-by`, `client-of`), `checkAttributes`, `checkLink`; the kinds `server` and `device` accept any word | No kinds for an account, a tenant, a cluster, a repository, a pipeline, an image, a data store, a secret store, an identity, a network segment or a population; no catalog for `server` and `device` | extend (the catalog only grows) | The catalog's own rule is that a kind is added and never renamed or removed |
| A11 | The capability level of an asset | `estate` `sightings.ts`: `levelOf(facts: LevelFacts): AssetLevel`, `missingMinimums`; 0041-telemetry-and-reach FR-001 | The level depends on whether the device opens SSH outward; a login the controller opens, an API and an agent are not distinguished | extend (the tier is a total function of the set of reach paths that worked) | One total function, as before, over what the asset offers |

## B. Connectors and probes

| # | Need | Existing library and symbols | Gap | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| B1 | A connector as a typed contract with a conformance suite | `integrations` 0005 FR-003 to FR-005 (`Connector`: `describe`, `probe`, `observe`, `check`; `defineConnector`; governance enforced on what it returns), 0008-integrations-plugins FR-005 (`conformConnector`) | `permissions`, `cost`, `changeFeed`, the paths and the properties it reads | extend (0044-asset-connections FR-080) | No second contract |

## C. Classes and profiles

| # | Need | Existing library and symbols | Gap | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| C1 | What a class needs to be complete | None. `estate` assets have `capabilities` with an owner or a reason it is not offered (`defineAsset`), which says who owns observe and verify, not what a class must be read for | A profile per class: its `completeAt` tier, its properties and its expected sources | new (data in the estate) | Completeness has to be defined per class, or a SaaS tenant is "incomplete" at the tier where a host is complete |

## D. Tiers and reach

| # | Need | Existing library and symbols | Gap | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| D1 | The tier function | `estate` `levelOf`, `missingMinimums`; 0041 FR-001, FR-002, FR-011 (the three minimums) | See A11 | extend | The same total function with a wider input |

## G. Change feeds

| # | Need | Existing library and symbols | Gap | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| G2 | A change makes readings stale at once | None; `telemetry` 0003-telemetry-reach has a receiver and a durable queue that a feed's events could use | A typed feed and a targeted-read request | new (0044-asset-connections FR-062) | Cost and freshness |

## Summary of decisions

- The judgement (A1), the signature (A5), the grades (A6), the freshness function (A4), the views (A8), the as-of store (A9) and the connector contract (B1) are reused. What is new is small: the table of properties, the probe, the claim table, the class profile and the feed.
- Nothing here is a second store, a second signer, a second grade scale or a second freshness function.

## The duplications to avoid

- A second list of controls per framework: a control is reached by a mapping (A7).
- A report for each class of asset: a view is a projection of the claim table (A8).
- A time-series store: history is the evidence branch (A9).
- Three shapes of drift: 0044-asset-connections FR-070 states one.

## UNVERIFIED

- The exported names of `estate-iac` and `evidence-capture` beyond those cited were not enumerated; the requirement of 0043 FR-025 relies on the branch and journal as their specifications state them.
- The SSP and mapping models of OSCAL, and the form in which CMMC, FedRAMP and HIPAA mappings are published, were not read.
