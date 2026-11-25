# Feature Specification: Workload layers

**Spec ID:** 0001-workload-layers
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** Workload: units of operated work (not running software) as typed data of a form, with effects, autonomy derived from them, static checks and projections for each harness and for auditors. A runbook is one form of workload. The library is built to Kanon (commons 0033-kanon): Governance is the core that says what a workload is and imports nothing from a form, Logical holds the pure functions every form shares and, as instances, each form as a module of its own, and Physical is what touches the world (the native runner of each form behind a port, the emitters of the integration runners, the dialects, the command). It is modelled on the workbench (commons workbench 0001-workbench-layers) and reuses its governance types by package name.

## Requirements

- **FR-001**: The library MUST be Kanon: its manifest `library.ts` MUST declare the table of its units in the field `kanon`, with the units `src/governance/` (the core), `src/logical/` (the shared logic), `src/logical/forms/` (an instance for each form), `src/physical/dialects/` (an instance for each dialect) and `src/physical/`, and the shared checker of `@intellectual-frontiers/kanon` MUST find no import that the table does not allow.
- **FR-002**: `bun run verify` in the folder of the library MUST run the TypeScript 7 compiler, the checks of the specification kit, the check of the level L1, the layers check of Kanon, the trace check, the tests and the check of the package, and MUST fail on any finding that is not held by a baseline that only shrinks.
- **FR-003**: The library MUST import the workbench, planning, grc and anyfs only by package name and only their governance entries (and the evaluation, the composition and the matrix of the logical entry of the workbench), never by a relative path out of its folder, and MUST add no kind of item to planning and no control vocabulary to grc.
- **FR-004**: The governance entry MUST export the core (the terms, the ids, the effects and the table of autonomy, the registry of verbs by id, what every workload and node has, the contract of a form, the catalog of the core, the dialects and the policy, the envelope of run events) and no form; the logical entry MUST export what every form shares; each form MUST be an entry of its own (`forms/runbook`, `forms/reconcile`) and each dialect an entry of its own, so that a program loads a workload by `import` and never by reading a file.
- **FR-005**: The manifest MUST declare `distribution` as `github` and `npm`, and the folder MUST have `tools/pack.ts`, which packs the library without publishing it.
- **FR-006**: The program of the library MUST be `workload`, with the verbs `check`, `plan`, `project`, `forms`, `runners`, `needs`, `emit`, `explain` and `verb`; `verb <id>` MUST check the id against the registry and refuse an id that is not registered with its code, and for a registered id MUST say that a host registers the binding that runs it (a verb is bound by the host that has the pinned package) and exit non-zero until it does; and every refusal MUST print the code and the fix.
- **FR-007**: The ids of a workload, a node, a verb, a store and a dialect MUST be branded and made only by a smart constructor that returns a `Result`: a workload, node, store or dialect id is lower case words joined by hyphens, a verb id is lower case words joined by hyphens, a dot and lower case words, and a store reference is `synthetic-<kind>-NN` or a name of that shape; a citation is a spec id and a requirement id.

## Acceptance scenarios

1. **Given** the real tree of the library, **When** the layers check runs, **Then** every file is in a unit and no import is outside its row, per FR-001.
2. **Given** the package of the library, **When** its `verify` script is read, **Then** it runs every check, per FR-002.
3. **Given** the sources of the library, **When** their imports are read, **Then** every import of another library names its package and a governance entry or the allowed logical entry, per FR-003.
4. **Given** the entries of the package, **When** they are imported by a program, **Then** the registry of verbs and the forms are values it can use, and no form is exported by the governance entry, per FR-004.
5. **Given** the manifest, **When** it is read, **Then** it names `github` and `npm` and the folder holds `tools/pack.ts`, per FR-005.
6. **Given** an unknown verb id and a registered one with no binding on the command line, **When** `workload verb` is run, **Then** each prints its code or its reason and exits non-zero, per FR-006.
7. **Given** a step id with a capital letter, **When** it is made, **Then** it is refused, per FR-007.

## Out of scope

- Everything the library does: its other specifications.

## Edge cases

- A file in no unit of the table: it is a finding of the layers check, per FR-001.
- A `verify` that leaves out a check: it is a finding of the test, per FR-002.
- An import of `@intellectual-frontiers/planning` from outside its governance entry: it is a finding of the layers check, per FR-003.

## Assumptions

- The shared checker of Kanon and the manifest check of the libraries are on the branch that holds this library.
- Nothing is published by this library's change: it adds the wiring of its distribution only (the release is a separate act of the owner).

## Open questions

- None.

## Key entities

- **Workload** - a unit of operated work, not running software: typed data of a form (0003-workload-forms).
- **Form** - what kind of work and how it executes; a module of the logical layer with a native runner behind a port of the physical layer.
- **Dialect** - how a harness or a person receives a workload: a projection, never a form.

## Standards considered

None beyond the ones this library's other specifications name: this specification is about the layout of the library. The layers are Kanon (commons 0033-kanon), read in this repository.

## Success criteria

- **SC-001**: Every requirement of 0001-workload-layers is proved by a test of the library, with synthetic names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
