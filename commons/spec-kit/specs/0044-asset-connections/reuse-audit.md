# Reuse audit: asset connections

**For:** 0044-asset-connections. **Read:** this repository at the commit that carries this file, on 2026-11-26, by reading the manifests of the libraries and the specifications beside them, and the code where a name is given. Nothing was run. Each row says what commons has, what is missing, and a decision: **reuse**, **extend** or **new**. A requirement of 0044 cites the row it relies on. Rows A4, A5 and A9 are rows of the audit of 0043-asset-properties (freshness, signing, history).

Paths are under `commons/`.

## B. Connectors, credentials, tenancy and documents

| # | Need | Existing library and symbols | Gap | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| B1 | The connector contract and its suite | `integrations` 0005-integrations-observe (`Connector`, `defineConnector`, posture policies, a registry that pins connectors by tag), 0008-integrations-plugins (`conformConnector`) | `permissions`, `cost`, `changeFeed`, discovery of the realm's assets | extend | One contract is enough |
| B2 | Connectors that exist | `integrations-github` (an organization of a code host), `integrations-identity` (an Entra tenant, device management of Intune, a Workspace domain), `integrations-fhir`, `integrations-x12`, `integrations-snmp`, `-redfish`, `-otel` (0010-integrations-network-observers) | No connector of a cloud account, a cluster or a virtualization manager | reuse; the missing ones are ingest sources first (FR-083) | The existing connectors are already realm connections by another name |
| B3 | A credential that cannot be printed | `integrations` 0003-integrations-logical FR-001, FR-002: `CredentialPort`, `Secret` (prints `[secret]`, `reveal`), `ReadPort` with no way to write; the reference form `vault://<store>/<name>` (0010 FR-002) | None | reuse | A connection holds names only |
| B5 | Authenticated polls of devices | `integrations-snmp` (SNMPv3 `authPriv`, GET and GETNEXT only), `integrations-redfish` (HTTPS read) | Redfish has no transport that pins the controller's certificate yet | reuse | The authenticated sources of FR-034 |
| B6 | Parties, engagements and deny-by-default | `tenancy`: the parties (an operator and its clients), engagements with roles and dates, authorization of what a principal may do to which client, portfolio views, the shared-responsibility matrix | A connection as something an engagement allows | extend (FR-007) | A managed-services provider's clients are the first users |
| B7 | A document of the fleet and an append-only journal | `estate` 0005-estate-fleet-documents (documents with `kind` and `schema`, decoders), 0006-estate-fleet-store (written once); `evidence-capture` 0002-evidence-capture-journal (hash-chained); `ssh-server` hash-chained audit | A connection document and its journal | extend | The same store, decoder and chain |

## C. Ingestion

| # | Need | Existing library and symbols | Gap | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| C1 | Run a tool safely | `scanners`: a built-in TLS and header check, nuclei, nmap, trivy, grype, semgrep, checkov and ZAP's baseline scan, run only after the engagement allows the action, only a binary whose SHA-256 is pinned, with a command line of validated parts and no shell, in an empty working folder | The runners for Prowler, Syft, Kubescape, kube-bench and a provider's inventory command; a credential for the run | extend | The only safe runner of tools that exists |
| C3 | A pinned download | `desired-os-state/pinned-downloads` (the `pinned-downloads` plugin of Desired OS State); `ssh-server` `OSQUERY_PINS` (an address and a SHA-256) | A pin that carries a licence | extend (a licence field) | One pin form |
| C4 | Plugins of codecs and loaders | `integrations` 0008-integrations-plugins FR-001 to FR-004, FR-006, FR-007 (codec `parse`, `serialize`, `detect`, `conformPlugin`, the embedding gate), `integrations-standards` | Codecs for OCSF, CycloneDX, SPDX, a provider's inventory JSON and JSON lines | new codecs in plugins of the existing family | The conformance suite already refuses a codec that fails its tests |
| C5 | Conformance of a codec | `conformPlugin` | None | reuse | |
| C6 | Operated work as typed steps | `workload` 0008-form-runbook (verbs, effects, autonomy, runners bash, pwsh and GitHub Actions, receipts, dry run) | None | reuse | An ingest is a runbook |
| C7 | Licence rule for what we run | `LICENSING.md` and `THIRD_PARTY_NOTICES.md` of this repository; `docs/guides` on licences (0035-licensing) | A rule for a tool run as a separate program, and a review file | new (FR-058) | The repository forbids bundling what its licence does not allow; running a separate program is a different act and has its own rule |

## D. Identity, sources and population

| # | Need | Existing library and symbols | Gap | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| D1 | Identity resolution | `estate` `sightings.ts`: `resolveIdentity(keys, known, options)` giving `new`, `adopt`, `candidate` or `conflict`; `foldSightings`; 0009-estate-sightings FR-005 to FR-008 | Keys for the cloud, a managed device, a Kubernetes object, a repository, a DNS name and a principal | extend | The function is total and never merges by itself |
| D2 | The key union | `estate` 0009 FR-004: `machine-id`, `serial`, `mac`, `snmp-engine-id`, `host-key`, each by a smart constructor | See D1 | extend (keys only grow) | |
| D3 | The register and the discovered state | `estate` 0002-estate-governance (states `discovered`, `adopted`, `managed`), `estate-endpoints` (provenance `tool:file#address`, `relay:<relay>/<protocol>#<key>`) | An asset known only by a declaration or a file in the register at tier `0` | extend | The state exists; the rule that it is listed is stated |
| D4 | A difference between the register and the network | `estate` `discovery.ts`: `unexpectedDevices(declared, seen)`; 0009 FR-008 `unexpectedSightings` | The other pairs of sources | extend (a closed table of source differences) | One mechanism for every pair |
| D5 | Accepting a finding for a time | the owner's typed accepted-finding files (`specs/accepted-findings/<id>.ts` in erga); `gate` waivers | Applies to a source difference | reuse | An agent never writes one |
| D6 | A group of ephemeral members | None. `integrations` entities (people, accounts, devices, repositories) are not assets; `estate` has no kind for a group | The kind `population`, the member events and their fold | new | A thousand short-lived nodes cannot be a thousand enrolled assets |

## E. Drift

| # | Need | Existing library and symbols | Gap | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| E1 | Requirements and their drift | `desired-os-state`: `defineRequirement`, kinds as data (including `cloud-resource` and `dns-record` with the subject class `cloud-account`), `driftOf(order, rows, platform)` giving a `Plan`, `driftSummaryOf`, `reconcileOf`, 0007-desired-os-state-observe-osquery | An observation adapter for cloud kinds; an authority per attribute | extend | One algebra for hosts and clouds |
| E2 | Approval by the hash of a plan | `workload` autonomy and approver rules; `desired-os-state` `planHash` `required` (0002 FR-009) | None | reuse | A connection is approved the same way |
| E3 | Code against cloud | `estate-iac`: importers (OpenTofu and Terraform, CloudFormation, Kubernetes, Compose, Pulumi), 0004-estate-iac-drift (`driftBetween(code, cloud, options)`, `Drift`: `not-in-cloud`, `not-in-code`, `region-differs`) | `Observed` has provider, type, identifier and region only; the result is a second shape | extend (state it in the value of E1) | Three shapes of drift are one value |
| E4 | Cloud resources as requirements | `desired-os-state/opentofu`: renders an order of cloud-resource requirements to a JSON configuration with pinned providers and no credential, state kept outside the repository | A module for the read-only role | extend (FR-043) | The dialect exists and the rules are the right ones |
| E5 | The shape of a difference | `desired-os-state` `Plan`, `DriftSummary`; `estate-iac` `Drift`; erga 286 FR-052 `DriftItem` | Three names | extend (one) | |

## F. Credentials and plans

| # | Need | Existing library and symbols | Gap | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| F1 | Credentials by name, signing keys, a key store | `integrations` `CredentialPort` (B3); `grc` signers; the workbench contract's credential names | A key per connection and its revocation | extend | |
| F2 | Federated, short-lived credentials | None | Role assumption by profile, workload identity federation | new, in the connector, not in commons | The exchange is per provider; unverified (see below) |
| F3 | A generated, approved module that connects an account | `desired-os-state/opentofu` (E4); workload approval by hash (E2) | The module for the read-only role and its permission list as data | new (a plan type over the dialect) | The controller holds no right to create a principal |

## G. Events, feeds, budgets and the LAN

| # | Need | Existing library and symbols | Gap | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| G1 | Signals into the estate | `telemetry`: OTLP codecs, `SignalRecord`, the receiver, the durable queue, redaction (0001, 0003); `estate` observations; `integrations-otel` | Codecs and mappings for cloud audit, identity audit and flow logs | extend (codecs in plugins) | One mapper for every path |
| G2 | A change feed | See the audit of 0043, row G2 | | new | |
| G3 | A budget and a back-off | `telemetry` `otlpExporter` retries on 429 and 5xx with `Retry-After` (0001 FR-014); `anyfs` `retrying` layer | A budget per connection and its degrade rule | new (small, typed) | The retry exists; the budget does not |
| G4 | LAN passive sources | `ssh-server`, `telemetry` 0003; erga 286 (the relay of a product, a command that runs it: syslog over TCP); `linux-services` 0003-linux-services-otel (the site relay profile) | UDP syslog, NetFlow, DHCP, ARP and LLDP at the relay | reuse, with what 0041 lists as not built | |

## H. Kinds and surfaces

| # | Need | Existing library and symbols | Gap | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| H1 | Kinds of asset and of link | `estate` 0007-estate-kinds (see the audit of 0043, A10) | The kinds of 0043 FR-029 | extend | |
| H3 | One document every surface prints | `terminal` renderer, `headless` (one command definition); erga constitution XIV | `connection-status` | extend (a typed document) | Surfaces decide nothing |

## Summary of decisions

- The connector contract, its conformance suite, the credential port, the runner of tools, the pinned download, the codec plugins, the identity function, the drift algebra and the OpenTofu dialect are reused. New: the connection (a document and a journal over existing stores), the population, the source differences as a table, the connect module, the budget, the change feed, the licence rule and the federation in the connectors.
- No second contract, runner, identity function, drift value, store or signer is made.

## The duplications to avoid

- A fourth chain: a connection's journal uses the chain of `evidence-capture`.
- A second runner of tools: `scanners` is the runner.
- Three shapes of drift (E5).
- A graph database for identity: the keys and links are relations of the estate store.

## UNVERIFIED

- Which providers allow each credential kind and a read of the permissions an identity holds (F2, FR-042, FR-051).
- The exported names of `scanners`, `tenancy` and `evidence-capture` were not enumerated; the requirements rely on their specifications.
