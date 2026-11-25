# Feature Specification: Workload, the pattern of operated work

**Spec ID:** 0040-workload-pattern
**Status:** Active
**Owner:** if
**Domain:** commons
**Part of:** 0033-kanon

**Input:** Work that is operated, not software that runs: a restore drill, a converge of a fleet toward its declared state, a game day, a periodic evidence collection. A pattern says how a library of such work is built so that every kind of it shares one core of safety (effects, derived autonomy, gates, evidence, the registry of verbs, the choice of a harness, the record of a run as planning events) and differs only in its execution semantics. This specification names the pattern **Workload**, a pattern of Kanon (0033-kanon): a governance core, forms as modules of the logical layer, runners behind ports in the physical layer (a native runner for each form and integration runners that emit artifacts), and projections as dialects. The library `@intellectual-frontiers/workload` is its first implementation, and a member of the patterns metapackage with the other pattern libraries.

## Requirements

- **FR-001**: A workload MUST be a unit of operated work and not running software: typed data of a form, whose every effect is a deterministic verb of the pinned packages and whose autonomy is derived from its effects and never declared; the term MUST mean this in every specification, ontology and page of commons.
- **FR-002**: The pattern MUST be built to Kanon with this structure: a governance core that says what every workload is and imports nothing from a form; each form a module of the logical layer, an instance of one unit so that no form imports another; a native runner of each form behind a port in the physical layer and the integration runners as instances of a unit of it (0010-workload-runners); and the projections for each harness and for a person as dialects, each an instance of a unit of the physical layer. A library that follows the pattern MUST say so in the table of its manifest, and the shared checker of Kanon MUST find no import its table does not allow.
- **FR-003**: Two axes MUST be orthogonal. The **form** says what kind of work it is and how it executes; the **dialect** says how a harness or a person receives it and MUST NOT name a form; the **trigger** says what starts it (manual, a schedule, an event or an alert) and is a field of a workload, never a form, so that a drill or a game day is a workload with a schedule trigger and an expected outcome. The **runner** says how a plan is carried out, natively by the TypeScript of the library or by an integration runner that emits an artifact for a foreign system; it is chosen by a policy, is never named by a workload and changes no node, no effect and no autonomy (0010-workload-runners).
- **FR-004**: A form MUST be declared by a contract that is tiny and closed: its id, the closed sum of its kinds of node, `validate`, `plan` (the dry run), `fold` (the run events to a state) and a native runner behind a port, and nothing else; the core MUST hold what is shared and the form only what is its own.
- **FR-005**: A form MUST be built where a second concrete user needs it (the rule of two); a form with one user MUST be a workload of a form that exists. The forms with code today are `runbook` (a procedure) and `reconcile` (a loop toward a desired state); `graph` (a graph of jobs with freshness, for an integration runner) and `campaign` (a collection over a period with sampling) MUST be reserved slots with no code until their criteria are met.
- **FR-006**: The core MUST state once what every form shares: the effects and the classes of store, the autonomy derived from an effect by one table, the gates (a gate only moves control toward a person), the evidence, the control references of the catalogs, what a workload needs as requirements of the workbench (composed lazily), the registry of verbs by id, the dialects and the policy that chooses one, the envelope of run events as planning events, the split between the deterministic (a verb) and the probabilistic (a judge, which has no effect), and the closed catalogs of problems.
- **FR-007**: The library of the pattern MUST be a library of commons with the role `pattern`, and so a member of the patterns metapackage at an exact version, computed from its manifest and never written by hand.

## Acceptance scenarios

1. **Given** the manifest of the library, **When** its table is decoded and the shared checker runs on the real tree, **Then** the core, the forms and the dialects are units as FR-002 says and no import breaks them, per FR-002.
2. **Given** the terms of the library and the registry of dialects, **When** they are read, **Then** a workload is a unit of operated work, a dialect is none of the forms and a trigger is none, per FR-001 and FR-003.
3. **Given** the two forms with code and the registry, **When** their contracts are read, **Then** they have the same keys and the other two forms are reserved with their criteria, per FR-004 and FR-005.
4. **Given** the exports of the core, **When** they are listed, **Then** they hold what FR-006 says is shared and no form, per FR-006.
5. **Given** the libraries of commons, **When** the members of the patterns metapackage are computed, **Then** the library of the pattern is one, per FR-007.

## Out of scope

- How a consumer binds the verbs of its own systems: the consumer's host does, and this pattern holds no binding of any system.
- The release of the library and of the metapackage: the owner's act (0036-distribution).

## Edge cases

- A workload that needs a kind of node no form has is a reason to build a form only where a second concrete user needs the same kind, per FR-005.
- A dialect for a harness whose format could not be verified is the conservative one, per 0004-workload-projections FR-007 of the library.

## Assumptions

- The specifications of the library `workload` (0001 to 0009 of its spec kit) state each requirement of the pattern in full; this one states the pattern and cites them.

## Open questions

- None.

## Key entities

- **Workload** - a unit of operated work, not running software.
- **Form** - what kind of work and how it executes: a module of the logical layer with a native runner behind a port.
- **Trigger** - what starts a workload: a field of it.
- **Dialect** - how a harness or a person receives a workload: a projection.
- **Core** - what every form shares, in the governance layer.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| Kanon (commons 0033-kanon, read in this repository) | Three layers; a unit imports only the units of a layer above its own and, of its own layer, only the units its row lists; a class of units has instances that import no sibling; an extension reaches a library through its public entries | FR-001 to FR-006 of 0033-kanon, and FR-012 of `kanon 0001-kanon-checker` (`commons/kanon/spec-kit`) |
| The libraries by concern and the roles of a library (`commons/spec-kit/specs/0032-libraries-by-concern`, `commons/libraries/src/readme.ts` and `metapackages.ts`, read in this repository) | A library has one role (`foundation`, `pattern`, `program` or `standard`); the metapackage of a role depends on each consumer-facing library of that role at one exact version, and the set is computed from the manifests, never written by hand | The files themselves |

## Success criteria

- **SC-001**: Every requirement of 0040-workload-pattern is proved by a test of the library, with synthetic names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
