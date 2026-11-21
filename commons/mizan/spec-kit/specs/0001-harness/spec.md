# Feature Specification: The harness of Mizan

**Spec ID:** 0001-harness
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** Mizan holds a folder of specifications to rules, against a baseline that only shrinks. The rules, the harness that runs them, the levels of conformance, the integrations of standards, the change-control and release rules, and the trace of requirements to code and tests are code, and this library is where that code is, so that a repository that is not this one can run the same checks by installing one package.

## The harness

- **FR-001**: The library `mizan` MUST hold the rules of Mizan as plugins of one harness, the levels of conformance that say which rules a level runs, the standards and term rules, the integrations of standards (importers and exporters), the change-control rules and the release rules as plugins of the same harness, the trace of requirements to code and tests with the layers of a ladder, in the modules named by the table of 0032-libraries-by-concern FR-002.
- **FR-002**: A rule of a specification MUST be a `RulePlugin` that reads the specifications of a folder and gives its findings as data, and the harness MUST hold the findings of every plugin against one baseline that only shrinks, a finding in the gate phase failing whatever the baseline holds.
- **FR-003**: The change-control rules (IFCCM, commons 0020-ifccm) and the release rules (IFR, commons 0026-works-versioning) MUST be plugins of the same harness and subpaths of this library (`changes` and `versions`), so that the harness composes them by default and no library above it is needed to run them.
- **FR-004**: The trace MUST tie every source file to a requirement, every requirement to a proof and every ontology term to its specification, and the layers MUST judge every relative import of a ladder's files, both as pure functions over the contents of files that a host module (`host/trace`) reads and holds against a baseline.
- **FR-005**: The integrations MUST read a standard's published manifest into the terms of an ontology and write an ontology as Turtle, RDF/XML, OWL, SHACL, JSON Schema, DCAT, HTML and SSSOM mappings, the same bytes for the same input.
- **FR-006**: The rule `mizan/standard-newer` MUST be one of the rules of Mizan and its findings data held by the baseline; the library MUST reach no network: the opt-in report that fetches the latest source of each standard is the command `newer.ts` of this repository, which gives the rule its findings.
- **FR-007**: The library MUST import only `node:process` and `node:url`, `core`, `crypto`, `formats`, `githost`, `ontology`, `rdf` and `system` by package name (and, in the module of the questions in SQL only, `lang-sql/aide/{catalog,guard,relational,text}`, 0002-mizan-query FR-005), and its own modules by relative path, so that the harness runs wherever those do.
- **FR-008**: The library MUST be published to npm as compiled modules with their declarations, one entry for the package (`.`) and one for each of its modules, and its declarations MUST name no type that the package or its dependencies do not hold.

## Acceptance scenarios

1. **Given** a folder of specifications and a baseline, **When** the harness runs, **Then** it prints every new finding and every stale line and passes only where there is none, per FR-002.
2. **Given** a repository that declares a regulated domain and no production day, **When** the harness runs with its declaration, **Then** the change-control rule says so in the gate phase, per FR-003.
3. **Given** a source file that cites no requirement, **When** the trace runs, **Then** it is a finding, per FR-004.
4. **Given** an ontology, **When** the exporters run twice, **Then** the bytes are the same, per FR-005.

## Out of scope

- The commands that need the whole repository (`check`, `versions`, `changes`, `libraries`, the generators of the ontologies and of the register): they are the library `libraries`, which this library does not depend on.

## Edge cases

- A harness given no plugins runs Mizan's own, per FR-002.
- A folder with no specification has none for a plugin to be anchored to: the plugin is asked once, of nothing, per FR-003.

## Assumptions

- The specifications that Mizan defines (commons 0003-mizan, commons 0004-rules, commons 0015-trace, commons 0018-standards-first, commons 0019-mizan-integrations, commons 0020-ifccm, commons 0026-works-versioning, commons 0028-conformance-levels, commons 0029-subject-profiles) stay in the spec kit of commons: they are the standard, and this library is the code that holds a folder to it.

## Open questions

- None.

## Key entities

- **Harness** - the function that holds a folder of specifications to rules against a baseline.
- **Plugin** - a rule or a family of rules the harness runs.

## Success criteria

- **SC-001**: A repository that is not this one holds its specifications to Mizan with one installed package.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
