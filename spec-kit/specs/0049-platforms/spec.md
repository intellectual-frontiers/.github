# Feature Specification: Platforms: what the word means

**Spec ID:** 0049-platforms
**Status:** Draft

**Input:** What must be true of a made system before it is called a platform. In
this Eidolon, `platform` is not a marketing word. A platform is an Ergon
(0047-digital-reflections) that provides nine named capabilities, the platform
kernel, each realized by a named module, so that other parties can build and
sell on it through published interfaces without reaching into it, and so that
any module can be replaced by another that passes the same contract tests. This
spec states the kernel, the three tests that give the word substance, the kinds
of offer built on a platform, the layers and the dependency rule, the naming of
modules, and, for each capability, the rules every platform follows. A
platform's own domain (its users, its data, its rules) is stated in the
platform's own specs; this spec states only what every platform has in common.
The terms live in the ontology (`ifcore:Platform`, `ifcore:PlatformModule`,
`ifcore:PlatformCapabilityScheme` and the schemes that follow it).

## What a platform is

- **FR-001**: A platform MUST be an Ergon whose subject is typed
  `ifcore:Platform` and that provides every capability of the kernel (FR-002),
  each realized by a module of it. A made system that lacks one capability MUST
  NOT be called a platform. It is a product, a suite (FR-038), a service or a
  solution (FR-004), and its record is typed accordingly.
- **FR-002**: The kernel MUST be these nine capabilities, held as the concepts
  of `ifcore:PlatformCapabilityScheme`: the governed store; the ontology model;
  the integration seam; the programmatic interface; the assurance environment;
  the commitment ledger; the authoritative catalog; the extension contract;
  governed access. The set is closed. Adding or removing a capability is an
  amendment to this spec and a change to the scheme, never a choice made for one
  platform.
- **FR-003**: A platform's record MUST state how it meets three tests, and a
  person MUST accept the record (0047-digital-reflections FR-038) before any
  published text calls the system a platform. The tests are:
  1. **third-party test**: a party that is not the platform's builder can
     build and sell on it through published interfaces, without the builder's
     permission to reach into it (FR-006, FR-029);
  2. **replacement test**: any module can be replaced by another that passes
     the same contract tests (FR-009);
  3. **single-store test**: lineage, audit and deletion hold because the
     governed store is the only store of the governed data (FR-015).
- **FR-004**: An offer made on or through a platform MUST be exactly one of the
  concepts of `ifcore:OfferKindScheme`, carried as `dcterms:type`: a platform
  service (a capability that two or more solutions need, offered to all on the
  same terms), a solution (a complete offer for one kind of user, made of a
  manifest that bundles extensions, ontology packages, catalog content,
  configuration and branding), a product (a unit a party installs, licenses or
  buys, such as an extension or a connector), or a service (work done by people
  or agents with the platform for a customer).
- **FR-005**: A capability that two or more solutions need MUST become a
  platform service and MUST NOT be built twice. A platform service MUST be
  available to every solution on the same terms and MUST use only the
  interfaces a third party can use.
- **FR-006**: An offer MUST be related to its platform by `builtOn`, and MUST
  reach the platform only through its published interfaces. A made thing that
  only calls a system's interface, without being offered through it, is
  `integratesWith` that system, not `builtOn` it. The target of `builtOn` MUST
  be typed `ifcore:Platform`.

## Layers and dependencies

- **FR-007**: A platform MUST be organized in layers (the concepts of
  `ifcore:PlatformLayerScheme`), from the lowest: foundation (the hosts,
  runtimes and channels, reached through adapters), data (the governed store),
  platform services (the capabilities every solution calls), extensions and
  products (the units others install and sell), and solutions and services (the
  named offers). Each module MUST belong to exactly one platform, by `partOf`,
  and MUST carry exactly one layer by `ifcore:platformLayer`, or the orthogonal
  position (FR-010).
- **FR-008**: A module MUST depend (by `dependsOn`) only on a module in its own
  layer or the layer directly below, only through that module's published
  interface. It MUST NOT skip a layer, read another module's storage, or call
  another module's internals. A dependency that breaks this rule MUST fail the
  check.
- **FR-009**: Every interface a module offers MUST be published, versioned and
  covered by a contract test in the assurance environment, so that a module can
  be replaced by another that passes the same contract.
- **FR-010**: The integration seam, the programmatic interface and the
  assurance environment are orthogonal: they MAY touch every layer, only through
  the layers' published interfaces. No module MAY depend at runtime on the
  assurance environment.

## Naming

- **FR-011**: A module MUST be named with the platform's name followed by two
  plain words that say what the module is (for example `<Platform> Data Store`).
  A name MUST NOT be a metaphor, a pun, a coined word or a code. Clarity wins
  over brevity in every name, because the work is done by AI that reads the
  names.
- **FR-012**: A module MUST carry a three-letter code (`ifcore:moduleCode`): the
  first letter of the platform's name, then the first letter of each of the two
  words, in capitals. A code MUST be unique within its platform. A code is
  confirmed only when a person confirms it. A module MUST state which it is by
  `ifcore:codeStatus`, `confirmed` or `proposed`.
- **FR-013**: An artifact that belongs to a module (a container image, a
  package, an interface path, a database namespace, an ontology prefix, a
  command) MUST be named with the platform's name and the module's full
  descriptive name in lowercase words joined by hyphens, never with its code.
  A module MUST state that name as `ifcore:artifactName`. The code is a short
  human name for conversation and tables.
- **FR-014**: A solution, a product or a service MAY carry its own brand name,
  and the name of a product that already exists keeps its name. It MUST say,
  where its users could be misled about who runs it, that it is built on the
  platform. A product that is the working implementation of a module MUST be
  related to the module by `carriesOut`; the module keeps its plain name (FR-011)
  and the product keeps its brand.

## The governed store and the ontology model

- **FR-015**: A platform MUST keep all its governed data in one store, and a
  module other than the store MUST NOT keep a store of its own for that data. A
  module that needs a derived store MUST make it a derived zone of the governed
  store. Every read and write MUST pass through the store's governed
  interfaces, and each MUST be attributed and audited.
- **FR-016**: The governed store MUST hold three zones. The **received** zone
  keeps every source artifact exactly as it arrived, append-only, with its
  source, its time of arrival and a content digest. The **modelled** zone keeps
  data as instances of ontology concepts, each linked to the received artifact
  it came from. The **derived** zone keeps what is computed from the other two
  and MUST be rebuildable from them at any time; it MUST NOT be the only place a
  fact lives. A fact is never lost by modelling, because the received artifact
  stays.
- **FR-017**: The data model of a platform MUST be its ontology. Storage
  structures, validation rules and interfaces MUST be generated from it. An
  extension, a domain package or a customer MUST be able to add concepts,
  properties, value sets and constraints as an ontology package without
  changing the core. A change that alters the stored meaning of a concept MUST
  create a new version of the concept, and existing data MUST stay readable
  under the version it was written under. Each concept MUST declare its
  sensitivity class and its validation rules, and a write that fails validation
  MUST be recorded as a finding, not discarded.
- **FR-053**: A platform's governed store MUST be held at the lowest rung of the
  data ladder of 0044-public-website FR-049 that holds its data. A platform
  whose governed data is transactional, high in volume or too large for one
  host's memory MUST start at the fourth rung, and the `Decision` of
  0044-public-website FR-050 MUST name that volume. Because storage structures
  are generated from the ontology (FR-017), each rung a platform uses MUST be a
  target of that generation, and moving between rungs MUST NOT change a
  concept's meaning or the interfaces of FR-045 to FR-048.

## The integration seam

- **FR-018**: Every connection to a system outside the platform MUST pass
  through one module of connectors. Everything a connector extracts MUST land in
  the received zone first (FR-016) and become modelled data only through a
  declared mapping that a person can review; a mapping from unstructured input
  MUST produce a proposal with provenance and confidence. The module MUST record
  the authority for each extraction (an agreement with the source's owner, a
  person's written direction, or a contract), MUST protect the source system
  (its rate limits and maintenance windows, no more data than the purpose
  needs), MUST hold credentials least-privilege in the customer's own secret
  store and never in an image, a log or a message, MUST reach a system behind a
  firewall without opening an inbound port (an outbound-only agent, a tunnel or
  a file drop), and MUST keep a delivery status and a visible queue of failures
  for every transfer. A push to an outside system MUST be per connector, off by
  default, enabled only by the customer, and each pushed item MUST be an
  approved proposal. Each connector MUST have fixtures and a conformance suite
  in the assurance environment.

## The assurance environment

- **FR-019**: A platform MUST have an assurance environment that is separate
  from production in its accounts, tenants, keys, secrets and addresses, and
  that shows on every screen and message that it is a test environment. It MUST
  hold only realistic synthetic data, generated and repeatable from a seed, or a
  customer's data that has been anonymized or de-identified under a recorded
  agreement and a recorded method. It MUST be technically unable to receive the
  regulated production data that the platform declares (for example protected
  health information, credentials, or information a contract requires the
  company to safeguard). Every record in it MUST carry a marker that cannot be
  removed, that tells synthetic from de-identified data.
- **FR-020**: The assurance environment MUST be a sophisticated sandbox, not a
  test server. It MUST give each developer, publisher and external tester a
  sandbox tenant with service doubles for every external system; derive tests
  from the specs, the ontology and the scenario library; evaluate every AI
  function, including tests with seeded errors that measure whether the review
  design catches them, and repeat the evaluation when a model or prompt changes;
  let external reviewers and a customer's users perform acceptance tests with
  invited, time-limited and audited access; record each sign-off (person, role,
  organization, version, test, result, date); be deployable inside a customer's
  or a partner's own environment to prove a capability there; and issue an
  assurance report for each release. No release MAY go to production without
  that report, and every requirement that bears on safety MUST have evidence in
  the environment before the code that implements it reaches production.
- **FR-021**: Test management (planning, writing, running and recording tests
  and keeping their results as evidence) MUST be a tool used inside the
  assurance environment. A platform MUST use the company's test management
  product, Qualityfolio, for it, unless a Decision (`ifcore:Decision`) records a
  different tool for that platform. Test management is not the assurance
  environment: the environment also holds the data, the sandboxes, the doubles
  and the reports that the tests need.

## The commitment ledger

- **FR-022**: A platform MUST keep a commitment ledger: the record of what was
  promised. A **commitment** is a promise by a party (an organization, a person,
  a role or an agent) to another party to do a named thing by a time. A
  **loop** is a chain of commitments around one purpose, for example a request
  that is passed from one party to the next, and it is not finished until it
  closes. The ledger holds the promise and the evidence that closed it, and MUST
  NOT hold the content the evidence points to.
- **FR-023**: Every open loop MUST have one named owner at every moment.
  Ownership MUST pass only by an explicit handoff that the new owner accepts. A
  loop with no accepted owner MUST be shown as unowned and escalated at once.
- **FR-024**: A loop MUST close only on evidence of the kind its loop type
  defines (a document filed, an attendance recorded, a decision received, a
  test passed, an attestation signed), never on a party's assertion alone. A
  party that does not use the platform MUST be asked to close by the channel it
  already uses (a message, a form, a file), and the loop MUST close from what
  comes back.
- **FR-025**: A loop that has not moved for the time its type sets MUST
  escalate: first to the owner, then to the party the loop serves, then to a
  named authority. The ledger MUST measure, for each party and loop type, the
  loops opened, closed, failed and lapsed and the time to close, and MUST show
  them to the party that owns the relationship.
- **FR-026**: A loop type MUST be data: its parties, its evidence of closure,
  its stall times, its escalation and its measures. A new loop type MUST NOT
  need a change of software.

## The authoritative catalog

- **FR-027**: A platform MUST keep a catalog of the authoritative content that
  its users would otherwise define for themselves: the rules, requirements,
  programs, controls, measures or code sets that a public body, a standards body
  or a regulator publishes. Each record MUST be an ontology record with its
  citation (the source, the section or page, the version, the date retrieved),
  its effective date and end date, and its verification state (verified against
  the primary text, partly verified, not verified). A record that drives a
  decision, a payment or a finding MUST be verified by two people, and each
  verification MUST be recorded with the people and the date.
- **FR-028**: The catalog MUST detect when a source changes and bring the change
  in as a proposed new version, never as an edit of the record. A thing MUST be
  evaluated against the version in effect on its date. A source that restricts
  reuse MUST be handled as the source allows: the catalog holds the reference
  and the user's own license, not the restricted text. A user MUST be able to
  browse what applies to it, select an item, and see from its own data what the
  selection requires; the platform then configures the work from the selection.
  Content that is not public enters only as a package from its publisher through
  the extension contract (FR-029).

## The extension contract

- **FR-029**: A platform MUST be a small core and extensions. The core MUST hold
  only what every extension needs and cannot safely get from an extension:
  identity and tenancy, the governed store and the ontology, governed access, the
  platform interface, the event and workflow engine, and the extension runtime
  and registry. A function MUST enter the core only by an amendment to a core
  spec with a record of why an extension cannot provide it. The platform MUST
  offer a closed, versioned set of contribution points, and an extension MUST
  add to the platform only through them. A contribution point MUST be added by
  spec before any extension uses it.
- **FR-030**: An extension MUST carry a manifest that states its identity,
  publisher, version, the interface versions it works with, the contribution
  points it uses, the permissions it requests, the data it reads, writes and
  adds, the outside services it calls, and its safety class. It MUST run in a
  sandbox with a credential scoped to it, receive only the permissions the
  manifest requests and the customer approves, and have every read and write it
  makes audited. A first-party extension MUST use only the interfaces a
  third-party extension can use.
- **FR-031**: A registry MUST keep each released version of an extension signed,
  immutable and versioned, with a bill of materials, so that a customer can pin,
  stage, roll back and remove it. A solution MUST be data: a manifest that
  bundles extensions, ontology packages, catalog content, loop types and
  configuration, so that it can be installed, versioned and removed as one unit.

- **FR-042**: A solution, a product or an extension MUST declare in its manifest
  the platform modules it uses and its layer, and the platform MUST refuse to
  install one that uses a module its layer may not reach (FR-008).

## Programmatic interfaces

- **FR-043**: Every function that the platform offers to a person, an extension,
  another system or an agent MUST be available through a published API. No
  function MAY exist only in a screen. The platform's own clients (web, desktop,
  mobile, command line) MUST use the same API that a third party uses, so that
  the interface is proved by the platform's own use of it.
- **FR-044**: The interface of a platform MUST be one contract with several
  flavors, not several interfaces. The contract is the catalog of the platform's
  operations (name, inputs, outputs, errors, side effects, the authority it
  needs) and the ontology (FR-017). Every flavor MUST be generated from the
  contract and MUST NOT be maintained by hand. A change to an operation or a
  concept MUST appear in every flavor at once, with a version, and a removed
  operation MUST stay served for the deprecation period that the contract
  states. Each flavor MUST describe itself in a machine-readable form that
  generated clients, tools and agents read.
- **FR-045**: A platform MUST offer a **resource API** over HTTP in the style
  usually called REST, described by an OpenAPI document. It MUST give each
  ontology concept a resource, each operation an endpoint, one error model, one
  way of paging and filtering, and an idempotency key on every call that changes
  something. A client library MAY be generated from the description.
- **FR-046**: A platform MUST offer a **graph API**: a GraphQL schema generated
  from the ontology, in which a client names the concepts and relationships it
  wants and gets them in one request. It MUST limit the depth and cost of a
  query, MUST apply the access rules of FR-032 to every field, and MUST NOT offer
  a way to read what the resource API would refuse.
- **FR-047**: A platform MUST offer a **virtual SQL layer**: a read-only SQL
  schema generated from the ontology, with a view for each concept, a view for
  each relationship, and the lineage columns of the governed store (the zone,
  the source and the version of the concept). It MUST be served over a SQL
  connection that standard tools can use. A query MUST run through the same
  operations as the other flavors or directly on the governed store's read path,
  and either way MUST apply the same row and column access decisions as the
  other flavors. A write MUST NOT be possible through a SQL statement; a change
  is made by calling a named operation, which a SQL function MAY expose and
  which MUST pass the validation and the audit of every other change. Where the
  governed store is itself a SQL database on the customer's own machine, the
  layer MAY be that database's own views, but the access decisions still apply.
- **FR-048**: A platform MUST offer a **Model Context Protocol server**
  generated from the same contract: each operation is a tool with a name, a
  plain-English description and an input schema, each concept is a resource, and
  each documented workflow is a prompt. A read tool is available by default. A
  tool that changes something MUST be off until a tenant enables it, and a change
  that the platform's review rules reserve for a person MUST be made as a
  proposal, not an action. An agent MUST act within the intersection of its
  permissions and the authority of the person it acts for (FR-033), and every
  call MUST be attributed to the agent and to that person. The server MUST work
  both over the network and on a local connection, so that a platform that runs
  on a customer's own machine is reachable by the customer's own agents. The
  platform MUST treat text that a tool or a resource returns as data, never as
  an instruction to itself. The platform SHOULD also serve its own specs, its
  ontology and the results of its checks as resources, so that an agent that
  builds on the platform reads the contract it must follow.
- **FR-049**: The assurance environment MUST hold a conformance suite that calls
  each operation through every flavor that the platform offers and compares what
  comes back, including a refusal. A flavor that returns a different result, or
  a different refusal, from another flavor for the same caller and the same
  operation MUST fail the release (FR-020).
- **FR-050**: A platform MUST offer all four flavors (FR-045 to FR-048). The
  flavors are generated from the contract, so the cost of each is small; a
  platform that cannot offer one is not yet a platform. The module that realizes
  the programmatic interface MUST state the flavors it offers
  (`ifcore:offersInterface`).
- **FR-051**: The kernel requires no domain standard. A platform whose domain has
  mandatory interface standards (a data exchange standard, a message standard, a
  transaction standard) MUST list them in its own specs as **interface
  profiles**. A profile is one more flavor of the same contract: it MUST be
  mapped to the ontology by a declared mapping (FR-018), MUST pass the
  conformance suite of FR-049 for the operations it covers, and MUST be tested
  in the assurance environment with the standard's own validator where one
  exists. A platform for which no domain standard applies MUST NOT adopt one for
  show.
- **FR-052**: Every call to the platform MUST be authenticated and attributed
  (FR-032), limited by a quota for each tenant, and audited. Every flavor MUST
  accept a credential scoped to one extension, one agent or one person, and the
  assurance environment MUST issue sandbox credentials that work nowhere else
  (FR-019). The reference documentation of each flavor MUST be generated, MUST
  carry examples that the conformance suite runs, and MUST be served by the
  platform itself.

## Governed access

- **FR-032**: A platform MUST separate its customers' data from one another,
  including from the operator's, and MUST decide who may see each fact by the
  audience or consent attached to it (`ifcore:hasAudience` in the Eidolon's own
  records). Every access MUST be audited with the party that made it and the
  party it acted for.
- **FR-033**: A person, an extension or an agent MUST act only within the
  intersection of its own permissions and the authority of the party it acts
  for. An agent MUST NOT have more authority than the person it acts for, and
  every action of an agent MUST be attributed to both. What an AI proposes is a
  candidate until a person accepts it (0047-digital-reflections FR-038).

## What a platform says about itself

- **FR-034**: A platform's goals, bets and claims about itself (that a market
  exists, that a design will hold, that a customer will pay) MUST be Noemas with
  the claim, the evidence that would falsify it, and a state that a person
  assesses (0048-noemas FR-011, FR-014). A claim MUST NOT be called proven; a
  sale or a measured result supports one.
- **FR-035**: A platform's first spec MUST be its charter: whom it serves
  (including users who do not pay), what it replaces, what it will not do, and
  what it does not claim to be. A spec of a platform is ready to build only when
  a party has agreed to pay for what it makes or has agreed to test it, no
  blocking open question remains, and a scenario exercises it.
- **FR-036**: A platform MUST declare how it can be deployed (hosted for many
  customers, hosted for one, run in the customer's own infrastructure, or run
  locally with the evidence staying where the customer keeps it). The kernel
  MUST NOT be read to require any one host or deployment.

## Suites

- **FR-038**: A **suite** is a set of two or more products that are offered
  together under one name, where each product can be used on its own and the
  products need not share a store, a ledger, a catalog or an extension contract.
  A suite shares at most a name, a purchase, a sign-in and agreed exchanges of
  data between its products (`integratesWith`). A suite is an Ergon whose
  subject is typed `ifcore:Suite`, and each member is related to it by
  `partOf`. A suite is a fair and useful thing to build and sell. It is not a
  lesser platform and it claims nothing about the kernel.
- **FR-039**: `ifcore:Suite` and `ifcore:Platform` are disjoint: one subject MUST
  NOT carry both types. A suite MUST have at least two members. A member of a
  suite MAY also be a platform, a product or a solution. A suite MUST NOT have
  modules (FR-007) and MUST NOT be named as the target of `builtOn`: nothing is
  built on a suite as a whole, only on a product in it that is itself a
  platform.
- **FR-040**: The word `suite` MUST be used only for a subject typed
  `ifcore:Suite`, and the word `platform` MUST be used only for one typed
  `ifcore:Platform` (FR-003). Neither word is a synonym of the other or of
  `product`, `portfolio` or `family`. A suite that gains the whole kernel and a
  person's acceptance becomes a platform: a person creates the platform's
  record as the replacement of the suite's record (0047-digital-reflections
  FR-032), and the products that were its members become its modules or
  products built on it. A platform that loses a capability and cannot restore
  it is retyped as a suite or a product by a person in the same way. A text that
  calls a suite a platform, or the reverse, is a defect that review corrects.

## Generalizing

- **FR-041**: A requirement stated in the specs of one platform that would read
  the same in the specs of another platform, once the domain words are replaced
  by the words of this spec, MUST be lifted into this spec (or into a spec of
  its own, when it is large) and cited by the platform's spec. The platform's
  spec MUST then keep only what is particular to its domain. A requirement that
  holds only because of a domain rule (a clinical rule, a regulatory rule, a
  standard) MUST stay in the platform's spec. When it is unclear which, the
  requirement stays where it is and is listed as an open question of this spec.
  A platform's checks that duplicate a check of the public root MUST be replaced
  by the public check as soon as the platform's repository can run it.

## Checking

- **FR-037**: `agora check ontology` MUST fail a record typed `ifcore:Platform`
  that no module of it realizes the whole kernel for (FR-001, FR-002), a module
  with no layer or more than one, a module whose name, code or uniqueness breaks
  FR-011 and FR-012, a dependency that breaks FR-008 or FR-010, a `builtOn`
  or `partOf` whose target is not typed `ifcore:Platform` (FR-006, FR-007), a
  module with no artifact name or a wrong one, or with no code status (FR-012,
  FR-013), a module that realizes the programmatic interface without stating all four
  flavors (FR-050), a subject typed both platform and suite, a suite with fewer than two
  members, a suite with modules, and a `builtOn` of a suite (FR-039).
  What the check cannot test (the three tests of FR-003, the content of a
  module) is a person's review of the platform's record.

## Out of scope

- The domain of any one platform: its users, its data model, its connectors, its
  catalog content and its loop types. Each platform states them in its own
  specs, and this spec states only what the platforms share.
- Which products are platforms. That follows from each platform's record and a
  person's acceptance (FR-003); this spec does not name them.
- The internal design of any module, and the pricing of any offer.

## Edge cases

- A suite of four products, sold together, none of which is a store, a ledger or
  a catalog: it lacks the kernel, so it is not a platform, per FR-001 and
  FR-002; it is a suite, per FR-038.
- A suite whose products later share one store, one ledger and the rest of the
  kernel: a person accepts a platform record as its replacement, and the products
  become modules or built-on products, per FR-040.
- A platform whose one module has lost a capability and cannot restore it: it
  stops being a platform and a person retypes it, per FR-040.
- A product that is part of a suite and is also a platform: both are true, per
  FR-039.
- A requirement in one platform's spec that another platform would repeat: it is
  lifted here, per FR-041.
- A function is built into a screen and has no API: refused; the screen calls the
  API, per FR-043.
- A client wants a field in the graph API that the resource API refuses: the
  graph API refuses it too, per FR-046 and FR-049.
- A tool asks the SQL layer to update a row: refused; a change is a named
  operation, per FR-047.
- An agent holds a tool that changes data and its tenant has not enabled it: the
  tool is off, per FR-048.
- A platform in a field with no exchange standard: it carries no profile, per
  FR-051.
- A platform that serves a standard in a profile and the standard's validator
  rejects an output: the release fails, per FR-051 and FR-049.
- A product with a long-established brand that implements a module: the module
  keeps its plain name and the product is related to it by `carriesOut`, per
  FR-014.
- A system that has all nine capabilities but only its builder can extend it:
  it fails the third-party test and is not accepted as a platform, per FR-003.
- A new service wants its own database for governed data: refused; it makes a
  derived zone of the governed store, per FR-015.
- A module is replaced by a faster one: it passes the old module's contract
  tests first, per FR-009.
- A solution reads another module's tables directly: refused; it calls the
  published interface, per FR-008.
- A module in the platform services layer depends on a foundation adapter: the
  check fails, because it skips the data layer, per FR-008.
- A module is proposed that depends on the assurance environment at runtime:
  refused, per FR-010.
- A product that already has a name before the platform exists: it keeps its
  name and is not renamed to the module naming rule, per FR-014.
- Two modules would have the same code: the later module is renamed before it is
  accepted, per FR-012.
- A customer will not allow its data into the assurance environment unless it is
  de-identified: the environment holds it only after a recorded agreement and
  method, marked as de-identified, per FR-019.
- A platform whose evidence must stay in the customer's own infrastructure: the
  kernel still holds, because the deployment is the customer's choice, per
  FR-036.
- A platform uses a different test management tool: allowed only by a Decision,
  per FR-021.
- A party that does not use the platform owes something in a loop: the ledger
  asks it by its own channel and closes the loop from the reply, per FR-024.
- A source of authoritative content is changed by its publisher: the change is a
  proposed new version, and what happened before stays evaluated by the version
  then in effect, per FR-028.
- An AI proposes that a product is a platform: it is a candidate until a person
  accepts the record, per FR-003 and FR-033.
- A platform moves from an embedded database file to a database server: concept
  versions stay readable, the virtual SQL layer is unchanged, and no interface
  changes, per FR-017, FR-047 and FR-053.
- A platform that ingests transactional data in volume: it starts at the fourth
  rung with a `Decision` that names the volume, per FR-053.

## Assumptions

- A strict dependency rule costs some convenience and buys the ability to
  replace and test parts.
- One store for governed data makes audience, audit, deletion and export
  enforceable once.
- A platform's builder can describe each module in two plain words; a module
  that cannot be described that way probably does two jobs.
- The nine capabilities are what the platforms built so far have in common. A
  platform that needs a ninth for every platform is a reason to amend this spec.

## Open questions

- **OQ-1**: Whether the commitment ledger is a shared module that more than one
  platform runs, or a design each platform builds its own copy of. The kernel
  requires the capability; it does not decide whether the code is shared.
- **OQ-2**: Whether the offer kinds (FR-004) need a fifth kind for a dataset or
  a catalog that is sold on its own.
- **OQ-3**: Whether a platform that has the kernel only in specification, with
  no module built yet, is shown differently from one that runs. The kernel
  asks for a named, designed module; it does not yet ask for a built one.
- **OQ-4**: Whether a fifth flavor for streaming and events (webhooks and change
  feeds) is required by the kernel or is a profile of the resource API.
- **OQ-5**: Whether participation (0050-participation) becomes a tenth capability of the kernel.
  The working rule is that it does when a second platform realizes it and a person accepts it.

## Key entities

- **A platform** (`ifcore:Platform`) - an Ergon with the whole kernel.
- **A platform module** (`ifcore:PlatformModule`) - a named, coded component of
  one platform, in one layer or orthogonal.
- **The kernel** (`ifcore:PlatformCapabilityScheme`) - the nine capabilities.
- **An interface flavor** (`ifcore:InterfaceFlavorScheme`) - one way to call the platform: the resource API, the graph API, the virtual SQL layer, or the Model Context Protocol server.
- **A layer** (`ifcore:PlatformLayerScheme`) - foundation, data, platform
  services, extensions and products, solutions and services; and orthogonal.
- **An offer kind** (`ifcore:OfferKindScheme`) - platform service, solution,
  product, service.
- **A commitment** - a promise by a party to another party to do a thing by a
  time.
- **A loop** - a chain of commitments around one purpose, owned at every moment,
  closed on evidence.
- **The three zones** - received, modelled, derived.
- **A published interface** - the only way one module reaches another.
- **A suite** (`ifcore:Suite`) - two or more products offered together under one
  name, each usable alone, with no kernel claimed.

## Success criteria

- **SC-001**: A platform record with a missing capability fails the check in a
  test.
- **SC-002**: A dependency that skips a layer, points upward, or reaches the
  assurance environment fails the check in a test.
- **SC-003**: A module name or code that breaks the rule, or repeats, fails the
  check in a test.
- **SC-004**: The worked example conforms with no finding.
- **SC-005**: A `builtOn` or `partOf` that names a thing not typed
  `ifcore:Platform` fails the check in a test.
- **SC-006**: A subject typed both platform and suite, a suite with one member,
  and a suite with modules each fail the check in a test.
- **SC-007**: A programmatic interface module that omits a flavor fails the check
  in a test.
- **SC-008**: A platform's storage structures are generated for every rung it
  uses, and a concept reads the same through every interface on each.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Plain, literal English for a reader who is not a native speaker
