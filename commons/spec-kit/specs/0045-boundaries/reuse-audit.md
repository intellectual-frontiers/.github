# Reuse audit: boundaries

**For:** 0045-boundaries. **Read:** this repository at the commit that carries this file, on 2026-11-26, by reading the manifests of the libraries and the specifications beside them, and the code where a name is given. Nothing was run. Each row says what commons has, what is missing, and a decision: **reuse** (as it is), **extend** (the owner library gains what is missing) or **new** (nothing exists); and why.

Paths are under `commons/`. "Spec" names a specification of the library, as `0009-estate-sightings FR-005`.

## A. The model: assets, links, kinds, documents and parties

| # | Need | Existing library and symbols | Gap | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| A1 | Assets, links and the estate as a typed value whose references are derived | `estate` `governance/estate.ts` (`Link<K>`, the estate constructor that refuses a link whose end is no asset), `governance/asset.ts`, `governance/kinds.ts` (the catalog of kinds and links, 0007-estate-kinds FR-001 to FR-005) | Nothing says who answers for an asset and under which rule: no boundary, no disposition, no selector, no crossing | extend (`estate` gains the algebra of estate 0010-estate-boundaries) | The boundary is a fact about assets and links; it belongs beside them, and a second library would have to import the first for every type |
| A2 | Documents of the fleet decoded on read, written once, with a journal | `estate` 0005-estate-fleet-documents, 0006-estate-fleet-store; `evidence-capture` 0002-evidence-capture-journal (hash-chained); 0044-asset-connections FR-005 (a journal folded to a state) | The documents of a boundary | extend | The same decoders, the same store and the same fold as a connection |
| A3 | The authority of a regime: its controls, catalogs and frameworks | `grc` (`standard.ts`, the framework and catalog packages), `catalog-nist-sp800` (SP 800-53 Rev. 5, SP 800-171 Rev. 2 and 3, and their assessment procedures), `catalog-nist-csf-2`, `catalog-soc2` (the 61 criteria) | Catalogs for the HIPAA Security Rule, PCI DSS, the GDPR articles and the CMMC rule | reuse; the missing catalogs are added to `grc` as catalog packages when a boundary of that kind is approved | A boundary names its requirements by catalog id (FR-008); nothing is hard-coded in code |
| A4 | The regimes of privacy and their role words | `0029-subject-profiles` (a subject profile names the regimes a subject falls under, with `Data boundaries` as a section of the business-to-business profile); `ontology` `standards` (SP 800-53) | A closed table of regimes with role words, bases, agreement kinds and transfer mechanisms, with a mark `unread` | new (a table of `estate`, data) | The roles differ by regime and a typed model has to say so |
| A5 | Where assets are found | 0044-asset-connections (the realm) | None | reuse | A boundary is not a realm (FR-009) |
| A6 | Names kept out of the public repository | `tests/commons-no-product.test.ts`; the fleet's `names/` folder (estate 0005); the secret scanner | A rule that a boundary document names no real party | reuse | FR-004 and FR-012 use the existing rule |

## B. Categorization, data classes, selectors and reading properties

| # | Need | Existing library and symbols | Gap | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| B1 | The properties and readings that a boundary's requirements are judged by | 0043-asset-properties (properties, readings, the claim table, freshness, as-of reads) | A projection by boundary | extend 0043 (the claim table is read for the members of a boundary) | One reading serves every boundary that holds the asset (FR-060) |
| B2 | Data classes and location | `estate` kinds attributes (0007-estate-kinds FR-002, FR-005); 0043 properties | A closed table of data classes and the location attribute | extend | FR-007; the attributes already have a place in the asset document |
| B3 | Controls a property gives evidence for | 0043 FR-014 and FR-015 (the claim table, urns of a catalog package) | None | reuse | FR-061 reads the claim table |
| B4 | A way to ask the estate for assets | `estate-query` (SQL over the estate as relations with a catalog that is data); the pentest engagement's two SQL statements (`pentest` `logical/scope.ts` `resolveScope`) | A typed, closed selector with the laws of a Boolean algebra, and relations `boundary`, `member`, `disposition`, `interconnection` in the catalog of `estate-query` | new (the selector, in `estate`) and extend (`estate-query` gains the relations) | A free text query cannot be proved total or checked for laws; the SQL form stays for questions a person asks, not for scope |

## C. Agreements, external systems and inheritance

| # | Need | Existing library and symbols | Gap | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| C1 | A party, an engagement and deny-by-default authorization | `tenancy` `governance/model.ts` (`Party`, `Principal`, `Engagement`, `Grant`, `ROLES`, `ACTIONS`), `logical/authorize.ts` | The engagement as the source of a boundary's approvers | reuse | The roles of FR-005 are held by principals of `tenancy` |
| C2 | The agreements that allow a crossing | None (a business associate agreement, a data processing agreement, an interconnection agreement are named in the controls of the catalogs only) | A closed table of agreement kinds and a reference to the document a person holds | new (a table of `estate`) | FR-043 |
| C3 | Who answers for a requirement, and what is inherited | `tenancy` `logical/responsibility.ts` (`matrix`, the table `WHO` of `client`, `operator`, `shared` and `inherited`, a provider named for an inherited requirement, a note for a shared one) | The link from an inheritance to the evidence of the provider with its dates | reuse the matrix and `WHO`; extend with the evidence and its dates | FR-050 to FR-053; `provider`, `customer` and `shared` of FR-050 are `inherited`, `client` and `shared` of the matrix, and the matrix stays the one table of responsibility |

## D. Links and flows

| # | Need | Existing library and symbols | Gap | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| D1 | The links between assets and the flows a source saw | `estate` links (`runs-on`, `exposes`, `depends-on`, `resolves-to`, `secured-by`, `client-of` and `contains`, 0043 FR-031); sightings and NetFlow records heard by a relay (0009-estate-sightings, 0041-telemetry-and-reach); `estate-iac` (links in infrastructure as code) | A flow with a data class and a managed interface | extend (a flow is a link with an observed source, an optional data class and an optional interface) | FR-041, FR-045 and FR-046 |

## E. Findings, change and time

| # | Need | Existing library and symbols | Gap | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| E1 | A finding that keeps its evidence and is opened and closed by evidence only | `findings` (SARIF, ZAP, Burp and Nessus into findings that keep where they came from); the accepted-finding file of the fleet (0044 FR-033); `estate` problems (`governance/estate.ts`) | The kinds of finding of this specification | extend (the closed table of findings gains the kinds named) | One finding model |
| E2 | Coverage and freshness | 0043 FR-019 to FR-021 | A boundary's own coverage | extend | FR-027 and FR-062 |
| E3 | A change that is significant | None (`change-control` signs and gates a change of a repository; the policy gate `gate` judges subjects of a change) | A rule table of significance and a finding that stays open until an assessment is recorded | new (a table of `estate`), using `gate` for the policy over a change of a boundary | FR-063 and FR-064; `change-control` already signs the commit that holds an approval |
| E4 | State as of an instant and the difference between two instants | 0043 FR-025 to FR-027 (`posture` as of an instant, a comparison); the evidence branch of `quality` | A boundary as of an instant | extend | FR-065 and FR-066 |

## F. Approval, roles and the interlock

| # | Need | Existing library and symbols | Gap | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| F1 | A person approves by the hash of a plan; an agent proposes | 0044-asset-connections FR-006 (the approval of a connection by the hash of its plan, `E-CONNECT-NOT-PERSON`); `ssh-server` (approve by a person, never an agent) | A plan of a change of a boundary and the second person | extend | FR-067 and FR-068 use the same rule and the same refusal form |
| F2 | An active action refused before it is done | `pentest` `governance/engagement.ts` (`standing`: signed commit, window, clock) and `logical/authorize.ts` (`authorize(basis, asset, technique)`); `scanners` (runs only after the engagement allows the action); `desired-os-state` appliers; `ssh-server` enrollment installs | One permit made by one pure function that every active library takes as a typed parameter | extend `pentest` `authorize` into `permits` in `estate` (the pentest engagement's scope becomes a reference to a boundary of the kind `engagement-scope`; its window, its techniques and its signature stay); the libraries that act take `Permit<Action>` | One interlock, not four; the SQL scope of the engagement is replaced by the boundary, with no copy of it kept |

## G. Views

| # | Need | Existing library and symbols | Gap | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| G1 | A typed diagram drawn by a renderer | The renderers of `docs` (a flowchart, state, sequence, class or entity-relationship diagram is drawn; `check.ts` refuses a diagram it cannot draw) | A typed diagram value of a data-flow | extend (`estate` gives the value, `docs` draws it) | FR-048 |
| G2 | The documents regimes ask for | `dossier` (sealed point-in-time files compiled from signed evidence through lenses, commons 0046-dossiers); `grc` serializers (`oscal`, markdown, the others); `assessment` (assessment objectives and evidence) | The projections of FR-071 to FR-077 | extend (each view is a function in `estate`; `dossier` and `grc` render them) | One claim table, many views |
| G3 | The OSCAL system security plan | `grc` `serializers/oscal/mod.ts` writes a `system-security-plan` whose `authorization-boundary` description is the free-text `system.boundary` of the assessment input; the schema of OSCAL 1.1.2 has `system-characteristics` (with `authorization-boundary`, `network-architecture`, `data-flow`), `system-implementation` (with `components`, `inventory-items`, `leveraged-authorizations`, `users`) | The typed source of those parts | extend (`grc` takes a typed boundary view in place of `system.boundary`; the string is removed) | FR-071 |

## Duplicates this specification removes or avoids

- The SQL scope of a pentest engagement (`resolveScope`) and the typed selector of a boundary are two ways to say the same thing: the first is replaced by the second (F2).
- The free text `system.boundary` of `grc`'s assessment input and the typed boundary: the first is replaced (G3).
- The matrix of responsibility of `tenancy` and the responsibility of an inheritance: one table (C3).
- The scope of a connection (0044-asset-connections) and a boundary: the first is a realm and the second a boundary, by the rename of 0044 (A5).
