# Reuse audit: zero trust

**For:** 0047-zero-trust. **Read:** this repository at the commit that carries this file, on 2026-11-26, by reading the manifests of the libraries and the specifications beside them. Nothing was run. Each row says what exists, what is missing, and whether the specification reuses, extends or writes new code.

Paths are under `commons/`. "Spec" names a specification of the library, as `0043-asset-properties FR-006`.

## A. Where zero trust sits

| # | Need | Existing library and symbols | Gap | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| A1 | A place for the terms, the records and the checks that adds no layer | `ontology` (a namespace per subject, 0005-boundary-terms), `grc` (catalogs, signers, evidence), `estate` (properties, readings, boundaries), `dossier` (lenses) | The terms, the catalog, the record, the rules and the lens | extend | FR-001: five small additions to four libraries; no new layer and no new library apart from the catalog package (A3) |
| A2 | The roles of the architecture as data | `integrations` (the host of a Kanon family and its connector contract, 0044-asset-connections) | A closed table of roles and of sources of input | extend | FR-002: the table is in the ontology (`dataSources`) and a connector names its source |
| A3 | A catalog of a model in our own words, citable by urn | `catalog-nist-sp800`, `catalog-soc2`, `catalog-nist-csf-2` (catalog packages of `grc` as OSCAL data), `grc` `standard.ts` | A catalog package of the models, with `unread` entries | new, in the family | FR-021: the form exists; only the data is new, and unread data is marked and never approved |
| A4 | The boundary a protect surface is | 0045-boundaries (kind `trust`, selectors, interconnections), `estate` 0010-estate-boundaries | A policy on a boundary | extend | FR-030: no new kind; one policy per boundary of the kind `trust` |
| A5 | A source of input named by a connector | 0044-asset-connections (connector contract, the realm) | The field that names the source | extend | FR-005 |

## B. Properties, signed records and policies

| # | Need | Existing library and symbols | Gap | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| B1 | What is true and how fresh the proof is | 0043-asset-properties (properties, readings, freshness, the claim table, as-of reads) | A set of properties for each pillar and a coverage and freshness per pillar | extend | FR-011, FR-020, FR-025: no score, the readings shown |
| B2 | A signed, content-addressed record kept in a chain | `grc` (`signers/dsse`, `signers/sshsig`, evidence stores), `evidence-capture` 0002-evidence-capture-journal (hash-chained journal) | The type `AccessDecision` | extend | FR-010, FR-015: the record is evidence and uses the signers and the journal that exist |
| B3 | A policy as code, evaluated purely | `gate` (a policy gate: policies written as code over the subjects of a change), the claim table of 0043 (urns of a catalog package) | An evaluation over a request and signals; the crosswalk from controls to pillars | extend | FR-013, FR-023: no second policy language; the crosswalk is data with a source for each row |
| B4 | Rules over the estate that return findings | `estate-query` (SQL over the estate as relations), `findings` (findings that keep where they came from), 0045-boundaries (`no-disposition`, `out-of-scope-contradicted`) | The eight rules of implicit trust | extend | FR-040: each a typed rule that says which reading it lacks |

## C. Enforcement, telemetry, people and drills

| # | Need | Existing library and symbols | Gap | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| C1 | The decisions a program already takes and refuses | `ssh-server` (the hash-chained audit, refusals, plan hashes), `headless` (confirmation, audience, plans and plan hashes, person-only acts) | Recording each refusal as an access decision with its reason | extend | FR-012, FR-041, FR-071: the facts exist as audit events; the typed record and the ledger are new |
| C2 | A log record for a decision | `telemetry` (OTLP logs, the mapper of signals) | Attribute names for an access decision | extend | FR-015: ours until a convention is read (OQ-3) |
| C3 | An agent that cannot approve | `headless` (audience tiers, person-only acts), the rule that agents never approve, arm, confirm, tag or sign | A subject kind `agent` with the person and the plan | extend | FR-016 |
| C4 | Revoking a device, a key or an enrollment | `ssh-server` (enrollment revoke), `desired-os-state` (observation of a refusal by reading) | A timed drill with evidence at each enforcement point | new | FR-042: the revocation exists; the timing and the record are new |
| C5 | A report from the evidence | 0046-dossiers (lenses, plates, disclosure, the evidence manifest, as-of) | The lens pack `zero-trust` | extend | FR-050 |
| C6 | Readers of other people's products | 0044-asset-connections (read-only connectors, credentials by name, budgets, a conformance suite, ingest through pinned workloads) | Readers of identity, device and access-log sources | extend | FR-060: candidates below, none verified |

## D. Candidate sources of FR-060

The sources below are candidates only: their formats, licences and terms of use have not been read, and none is a dependency. Each would be read through its published, read-only interface, with the credential kept by name.

| Source of input | Candidates (not verified) |
| --- | --- |
| Identity management and conditional access | The policy interfaces of the large identity providers (the Microsoft Graph conditional access policies; the Okta policies interface) |
| Device compliance | The compliance interfaces of the large device management services (Microsoft Intune through Graph; Jamf) |
| Network access (application inventory and access logs) | The audit and configuration interfaces of network access products (Cloudflare Access, Tailscale, Teleport) |
| Activity logs of clouds | CloudTrail, the Azure Activity Log and Cloud Audit Logs |
| Standards of content | The Open Cybersecurity Schema Framework, which `grc` already serializes (`serializers/ocsf`) |

## E. What is deduplicated

- No second policy language: `gate` (B3).
- No second signed-record type: the decision uses the signers and the journal of B2.
- No new kind of boundary: a protect surface is the kind `trust` (A4).
