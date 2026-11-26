# Feature Specification: Estate boundaries

**Spec ID:** 0010-estate-boundaries
**Status:** Draft
**Owner:** if
**Domain:** estate

**Input:** The estate holds assets, links, sightings and readings. commons 0045-boundaries (the specification of the repository that this one implements) adds who answers for them: the boundary of a stated kind, the disposition of every asset in every boundary, the interconnections that cross a boundary, the inheritance of what others provide, the projections that regimes ask for and the interlock that an active tool must pass. This specification says how the library `estate` holds that model: as an **algebra of pure, total, deterministic functions over strongly typed values**, with the laws that make it an algebra proved by property tests, so that no renderer, no connector and no product has to decide who answers for an asset. It adds no library: the boundary is a fact about assets and links and lives beside them (the layers `governance`, `logical` and `physical` of 0001-estate-layers). **Every requirement that asks for code is Deferred: this specification holds no code.**

## The types (governance)

- **FR-001**: The module `governance/boundaries.ts` MUST export the closed tables `BOUNDARY_KINDS`, `PRIVACY_REGIMES`, `DATA_CLASSES`, `IMPACTS` (`low`, `moderate`, `high`, ordered), `AGREEMENT_KINDS`, `INHERITANCE_KINDS`, `ASSET_ACTIONS` (the active actions of commons 0045-boundaries FR-090) and `FINDING_KINDS` of this specification, each as a `readonly` tuple with its union type, so that a value outside a table does not type-check. Relies on audit rows: A1, A4.
- **FR-002**: The type `Boundary<K extends BoundaryKind>` MUST be indexed by its kind, and the types of the roles of its people (`PersonRoleOf<K>`), of the roles of an asset (`AssetRoleOf<K>`) and of its agreements (`AgreementOf<K>`) MUST be mapped types of `K`, so that `Boundary<"cui-environment">` accepts `cui-asset` and refuses `cde-system`, and a function that takes `Boundary<K>` cannot be given a boundary of another kind. A function that works for every kind MUST be generic over `K`, never over a union that loses the kind. Relies on audit rows: A1.
- **FR-003**: Every identifier (`BoundaryId`, `ExternalSystemId`, `InterconnectionId`, `InheritanceId`, `ActivityId`) MUST be a branded string made only by a smart constructor that validates and normalizes it and returns a `Result`; a type that holds an identifier MUST hold the brand and no bare string; and `Permit<A extends AssetAction>` MUST be a branded type whose only constructor is `permits` (FR-030), so that it cannot be made by a cast outside the module (a lint rule of the repository refuses the cast). Relies on audit rows: A1, F2.
- **FR-004**: `Selector` MUST be an algebraic data type: the atoms `class`, `tag`, `id`, `realm`, `segment`, `owner`, `dataClass`, `location`, `roleOf` and `source`, and the combinators `and`, `or` and `not`, as a tagged union with an exhaustive `match`; there MUST be no atom that holds a free text query and no way to build a selector from a string at run time other than the decoder of the fleet document, which refuses what it does not know (0005-estate-fleet-documents). Relies on audit rows: B4.
- **FR-005**: `Disposition<K>` MUST be the tagged union `InScope<AssetRoleOf<K>>`, `Inherited`, `External`, `OutOfScope` and `Undecided` of commons 0045-boundaries FR-023, and `OutOfScope` MUST be made only by a smart constructor that takes its justification (the rule, the evidence, the principal, the instant and the expiry) and returns a `Result`. Relies on audit rows: A1.
- **FR-006**: `Categorization` MUST be the record of three `Impact`s (`confidentiality`, `integrity`, `availability`) with `join` (the greatest of each objective), `meet` and the order, and the constructor MUST refuse an information type that states no impact for an objective; `Categorization` MUST form a bounded join-semilattice with the bottom `low, low, low` (FR-011). Relies on audit rows: B1.
- **FR-007**: `Interconnection`, `ExternalSystem`, `Inheritance`, `ProcessingActivity`, `BoundaryDiff` and `Plan` MUST be immutable values (`readonly` through every field), and a function MUST return a new value and never change its argument; the documents of the fleet are written once (0006-estate-fleet-store). Relies on audit rows: A2.

## The functions (logical)

- **FR-010**: The pure functions of `logical/boundaries.ts` MUST be total (a result for every input of the type, or a `Result` that names the reason) and deterministic (the same input gives the same output, whatever the order of the assets, the selectors or the object keys): `select`, `membersOf`, `dispositionOf`, `coverageOf`, `overlapOf`, `classify` (a proposal only), `crossings`, `findingsOf`, `inheritedRequirements`, `responsibilityMatrix`, `categorizationOf`, `boundaryAsOf`, `diff`, `apply`, `invert`, `suggestBoundary` and `permits`; and none MUST read a clock, a file, a network or a random source (the instant is a parameter). Relies on audit rows: A1.
- **FR-011**: The **laws** MUST be proved by property tests with generated inputs (the property-testing library the repository's other suites use, with a fixed seed recorded in the failure) and each law MUST be one test named for it:
  - selectors: `and` and `or` are commutative, associative and idempotent; `and([])` is every asset and `or([])` none; absorption; `not(not(s))` is `s`; De Morgan's laws; `select(and([a, b]))` is the intersection of `select(a)` and `select(b)`, `select(or([a, b]))` the union and `select(not(a))` the complement in the estate;
  - membership: `membersOf` is independent of the order of the selectors and of the assets; the members are a subset of `select(include)` plus the overrides that add; no member is in `select(exclude)` unless an override added it; an override beats a selector;
  - disposition: `dispositionOf` is total and single-valued; the disposition of an asset a boundary does not mention is `Undecided`; coverage is the share of decided assets and is `1` exactly when none is `Undecided`;
  - nesting: for a part and its whole, the members of the part are a subset of the members of the whole when no finding `part-outside-whole` is raised, and a cycle of parts is refused;
  - categorization: `join` is commutative, associative and idempotent with the bottom as identity; the categorization of a boundary is the join over its information types; adding an asset never lowers an objective;
  - crossings: the crossing from `a` to `b` is the crossing from `b` to `a`; no link between two members is a crossing; a link between a member and a non-member is exactly one;
  - findings: the findings of a boundary are monotone in its approvals (adding an approved interconnection never adds a finding) and in the links seen (removing a link never adds a finding);
  - diff: `apply(diff(a, b), a)` is `b`; `diff(a, a)` is empty; `diff(a, c)` is the composition of `diff(a, b)` and `diff(b, c)`; `invert(diff(a, b))` is `diff(b, a)`;
  - as of: `boundaryAsOf` at an instant is the fold of the journal up to it, and folding the whole journal in two parts gives the same state as folding it in one;
  - closure: `suggestBoundary`'s closure contains its seeds, is idempotent and is monotone in the links;
  - interlock: `permits` never gives a `Permit` for a target with an exclusion in an approved boundary, whatever the order of the boundaries; a permit for an action is not one for another; and an unapproved boundary never permits.
  Relies on audit rows: A1, B4, F2.
- **FR-012**: `classify` MUST return proposals `{ asset, role, rule, evidence }` and never a `Disposition`; the only function that makes a disposition from a proposal MUST be `decide(plan, approval)` and it MUST refuse an approval that is not a person's (commons 0045-boundaries FR-067), so that no code path turns a rule into a decision on its own. Relies on audit rows: F1.
- **FR-013**: The tables of rules of the kinds (the classification rules, the properties a role requires, the rule table of the CMMC external service providers, the significance table, the allowed actions, the adequacy decisions) MUST be **data**, each with its source and the date it was read, in `governance/` and not in code of `logical/`, so that a change of a rule is a change of data that a person reviews. Relies on audit rows: A3, E3.
- **FR-014**: `findingsOf(boundary, estate, readings, at)` MUST return the closed table of findings of commons 0045-boundaries (`no-disposition`, `out-of-scope-contradicted`, `part-outside-whole`, `constraint-broken`, `unapproved-crossing`, `interconnection-unused`, `interconnection-review-overdue`, `crossing-without-managed-interface`, `flow-outside-agreement`, `transfer-without-mechanism`, `internal-connection-unapproved`, `inheritance-too-weak`, `inheritance-evidence-expired`, `esp-not-covered`, `reassessment-due`, `scope-creep`, `roles-not-separate`, `property-missing`, `override-orphaned`), each with the evidence that raised it, in a stable order. Relies on audit rows: E1.

## The documents and the views (physical)

- **FR-020**: `physical/boundary-documents.ts` MUST read and write the documents of commons 0045-boundaries FR-100 as the other fleet documents are read and written: decoded on read with every refusal naming the document, the field and the reason (0005-estate-fleet-documents), written once, hash-chained for the journal (0006-estate-fleet-store, `evidence-capture`), and refusing a document that names a real party outside the fleet's private names. Relies on audit rows: A2, A6.
- **FR-021**: The views of commons 0045-boundaries FR-071 to FR-077 MUST be pure functions in `logical/boundary-views.ts` returning typed documents (a record whose fields are the sections), each carrying the boundary version, the instant and the evidence it used, and the serializers (`grc` for OSCAL, `dossier` for the page, `docs` for a diagram) MUST only encode them. A field a view cannot fill MUST be the value `Unknown` with the property and the role, and never a default. Relies on audit rows: G1, G2, G3.
- **FR-022**: `estate-query` MUST gain the relations `boundary`, `member` (boundary, asset, role), `disposition` (boundary, asset, disposition), `interconnection`, `inheritance` and `finding` in its catalog (data), so that a person can ask the estate the questions of an assessor in SQL and the answer is read-only and derived from the same functions. Relies on audit rows: B4.

## The interlock

- **FR-030**: `permits(action, target, boundaries, at)` MUST be a pure, total function that returns `Result<Permit<A>, Refusal>` with `Refusal` one of the four codes of commons 0045-boundaries FR-092, and the libraries that act (`scanners`, `pentest`, the appliers of `desired-os-state`, the installers of `ssh-server`) MUST take a `Permit<A>` as a parameter of the function that acts, so that a call with no permit, a permit of another action or a permit for another target does not type-check or is refused by a check that compares the permit's target with the call's. Relies on audit rows: F2.
- **FR-031**: `pentest`'s engagement MUST name a boundary of the kind `engagement-scope` in place of its two SQL statements, `resolveScope` MUST be removed, and `authorize` MUST take its scope from `membersOf` and the permit from `permits`, keeping its window, its techniques and the signature of the commit that holds it (`pentest/src/governance/engagement.ts`, `logical/authorize.ts`); no copy of the old scope form MUST remain. Relies on audit rows: F2.
- **FR-032**: A refusal and a permit MUST be written as events of the audit chain of the caller before the action's first effect (commons 0045-boundaries FR-092, FR-094); `permits` MUST NOT write, and the caller MUST, so that the function stays pure. Relies on audit rows: F2, E1.
- **FR-033**: The estate MUST hold one closed table `ACT_ROLES_OF` of the kinds of boundary and the roles of each whose scope carries the authority to apply to, install on and enroll an asset (`authorization`, `cui-environment`, `ephi-environment`, `cardholder-data-environment`, `soc2-system` and `organizational`, each without the roles that name a system run by another party), a function `actsByRole(kind, role)` over it, and `permits` MUST permit `apply`, `install` and `enroll-active` for an asset in scope in an approved boundary in such a role and for no asset in a boundary of the kinds `privacy`, `network-zone` and `trust`; the table is the single place that says it, and a property test MUST prove every kind and role against it (commons 0045-boundaries FR-091). Relies on audit rows: F2.

## Tests

- **FR-040**: Each law of FR-011 MUST have one test of `estate/suite/boundary-laws.test.ts` that generates assets, links, selectors and boundaries with the generators of `estate/suite/support/` (a generator for each closed table, so that every kind and every role is generated), with names `synthetic-<kind>-NN` and no network. Relies on audit rows: A1.
- **FR-041**: Each finding of FR-014 MUST have a test that builds the smallest estate in which it is raised and one in which it is not, and a test that its evidence names the right assets; and each view MUST have a golden test of its document for a fixture fleet that includes one boundary of each kind. Relies on audit rows: E1, G2.
- **FR-042**: The document of an `authorization` boundary written as OSCAL MUST be validated against the schema of OSCAL 1.1.2 in a test (the schema is fetched at the pin of the toolchain, not at run time), and an `unread` regime's boundary MUST be refused approval in a test (commons 0045-boundaries FR-003). Relies on audit rows: G3.

## Edge cases

- A selector over an estate of one asset or of none: `select` returns the empty set or the one asset; no function throws, per FR-010.
- Two boundaries of one kind with the same id: refused on read, per FR-020.
- A boundary whose include and exclude select the same asset: the exclusion wins unless an override adds it, as FR-011 states.
- An override on an asset that has been retired from the estate: the override is a finding of kind `override-orphaned` of the document, and the member list does not contain the asset, per FR-014.
- `boundaryAsOf` for an instant before the boundary's first event: the empty boundary with every asset `Undecided`, per FR-011.

## Assumptions

- The estate of a fleet is complete enough to select from: an asset the estate does not hold has no disposition, and is a finding of the sources (commons 0044-asset-connections) before it is one of a boundary.
- The tables of rules (FR-013) are read from the regimes' sources and dated; a counsel's reading governs where it differs.

## Open questions

- **OQ-1**: Is the property-testing library of the repository a dependency of `estate`'s suite or of a shared support package? Default: of `estate`'s suite, as the other libraries that use it do.
- **OQ-2**: Do `scanners` and `pentest` depend on `estate` for `Permit`, or does `Permit` live in a small shared package both import? Default: on `estate`, which both already read through `estate-query`.

## Key entities

- `Boundary<K>`, `Selector`, `Disposition<K>`, `Categorization`, `Interconnection`, `ExternalSystem`, `Inheritance`, `ProcessingActivity`, `BoundaryDiff`, `Plan` and `Permit<A>` of commons 0045-boundaries, as types of this library.

## Standards considered

The standards of commons 0045-boundaries; this specification adds none.

## Success criteria

- **SC-001**: Every requirement that asks for code has a row of the enforcement register with the mechanism `none` and the note Deferred; each row that gets code has a test of `estate/suite/` with synthetic names.
- **SC-002**: Every law of FR-011 is one named property test, and a law that fails prints the seed and the shrunk counter-example.
- **SC-003**: No function of this library reads a clock, a file, the network or a random source (a test scans the module imports and the lint rule of the repository refuses the rest).

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement says which row of the reuse audit (commons 0045-boundaries) it relies on, or is about the rule itself
