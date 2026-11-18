# Feature Specification: Commons libraries

**Spec ID:** 0027-commons-libraries
**Status:** Draft
**Owner:** if
**Domain:** commons
**Part of:** 0003-mizan

**Input:** Each top-level folder of commons that is a library (`commons/data` first) is independent: it keeps its own specifications in a spec kit of its own, numbered from 0001, its own package, its own documentation and its own checks, and it imports what it uses of commons by package name. A library declares itself with a manifest, `commons/<name>/library.ts` (its name, its conformance level, its spec kit, its verify command, its version and its exports); this repository knows a library as exactly one requirement, made from that manifest, whose proof is the library's own `verify`; every requirement under that one belongs to the library and is never numbered, listed or proved here. A library can therefore grow, be checked and be published on its own, while this repository still says that it exists, where it is and how to prove it, and registering one is adding a folder with a manifest.

## What a library is

- **FR-001**: A library of commons MUST be a top-level folder `commons/<name>/` that holds a spec kit of its own at `commons/<name>/spec-kit/` in the form 0003-mizan gives every harness (`registry.tsv`, `enforcement.tsv`, `mizan.baseline.txt` and `specs/NNNN-slug/spec.md`), a `package.json` whose name is `@intellectual-frontiers/<name>`, an `about.ts`, a manifest `library.ts` (FR-012) and a `verify` script, so that it is checked, tested and documented with nothing of commons but the packages it imports.
- **FR-002**: A library's specifications MUST be numbered from 0001 in its own registry, and its requirements MUST belong to it: this repository's registry (`commons/spec-kit/registry.tsv`) MUST NOT list a specification of a library, and a library's `enforcement.tsv` MUST have one row for each of its own requirements and none for a requirement of this repository.
- **FR-003**: A citation in a library's files (a `// Spec:` line, a `proves(` call, the `spec` of an ontology term) MUST be read against that library's spec kit alone, so that a slug both have (their numbers are independent) means the library's.
- **FR-004**: A library MUST import the packages of commons it uses (the kernel first) by package name, as 0005-typescript-runtime says, and MUST NOT import by a relative path a file outside its own folder.
- **FR-005**: A library's `verify` script MUST run from the library's folder with no argument, and MUST fail if any of its parts fails: the TypeScript compiler on the library, the specification checker on its spec kit (`bun ../tools/mizan-check.ts --root spec-kit`), the Mizan rules on it at the level its manifest declares (`bun ../ts/mizan/check.ts --root spec-kit`, with `--level` where the level is below L3, 0028-conformance-levels FR-013) and the library's tests.
- **FR-006**: A library's `verify` script MUST also run `tools/check.ts`, the trace of its sources and tests to its own specifications (0015-trace) and the check of its layers, whose findings are held by a baseline of its own (`trace.baseline.txt`).

## What this repository knows

- **FR-007**: This repository MUST know each library by its manifest (FR-012) as exactly one requirement of this specification, in the section "The libraries", named by the library's folder, whose enforcement is the library's own `verify` (a `check` row that runs `cd commons/<name> && bun run verify`); no requirement of a library MUST be a requirement of this repository (amended 2026-11-18: the requirement is made from the manifest, FR-011, and no longer written by hand).
- **FR-008**: A test of this repository MUST find every folder `commons/*` that has a manifest or a spec kit and fail where a spec kit has no manifest, where the section "The libraries" or its rows are not what the manifests make (FR-011), where a manifest and its folder disagree (FR-013), where a library lacks a part FR-001 names, where its `verify` lacks a part FR-005 names, where a file of the library imports by a relative path outside its folder (FR-004), or where the specification checker finds anything in its spec kit (amended 2026-11-18).
- **FR-009**: The documentation of commons (`commons/docs.config.ts`) MUST name each library's spec kit among its spec kits, so that the specifications of a library are published with those of commons and none is published twice.
- **FR-010**: Each library MUST have a workflow (`.github/workflows/<name>.yml`) that runs its `verify` on every push and pull request that changes its folder or what it imports, on the runtimes 0005-typescript-runtime names.

## The manifest

- **FR-011**: The section "The libraries" of this specification, and the rows of its requirements in `enforcement.tsv`, MUST be generated from the manifests by `commons/ts/mizan/libraries.ts`: one requirement and one row for each library, numbered from FR-101 and keeping the number a library was given, between the markers `<!-- libraries:begin -->` and `<!-- libraries:end -->`; with `--check` it MUST write nothing and exit 1 where either file is not what the manifests make.
- **FR-012**: A library MUST declare itself with `commons/<name>/library.ts`, whose only export is `library`, an object literal of data that a program reads as data and never runs (0026-works-versioning FR-008 reads a record so): `name` (its folder), `level` (`L0`, `L1`, `L2` or `L3`; `L1` where it declares none, 0028-conformance-levels), `specKit` (the path of its spec kit from its folder, which a level above L0 MUST have), `verify` (the command that proves it, `bun run verify`), `version` and `exports` (the keys of the package's `exports`), and it MAY carry `summary`; an unknown field or a wrong type MUST be an error that names the field.
- **FR-013**: A manifest MUST agree with its folder: its `name` is the folder's, the package is named `@intellectual-frontiers/<name>`, its `version` is the package's, its `exports` are the keys of the package's `exports`, its `verify` is a script of the package, its `specKit` has a `registry.tsv`, and the `verify` script runs the Mizan check with `--level` of its level where the level is L1 or L2; a test MUST fail where any of these differs.
- **FR-014**: Registering a library MUST be adding a folder `commons/<name>/` with its manifest, its package, its spec kit and its workflow, and running the generator (FR-011): no requirement of this specification is written by hand for it.

## The libraries

The requirements below are generated (FR-011); change a manifest and run `bun commons/ts/mizan/libraries.ts`, never this section.

<!-- libraries:begin -->

- **FR-101**: `commons/data` MUST be a library at conformance level L1 (`mz:Core`): the package `@intellectual-frontiers/data` at version `0.0.0`, its spec kit at `commons/data/spec-kit`, exporting `./engine`, `./governance`, `./sql/logical`, `./sql/physical`, `./models/arca`, `./sql/dialects/postgres`, `./sql/dialects/sqlite`, `./sql/dialects/duckdb`, `./sql/lifecycle`, `./sql/extensions/documentation`, `./sql/extensions/views`, `./sql/extensions/access`, `./sql/extensions/routines`, `./sql/extensions/partitions`, `./sql/extensions/generators`, `./sql/extensions/idempotency`, `./sql/extensions/protected-access`, `./sql/extensions/safety`, `./sql/extensions/plan-report`, `./sql/extensions/rewrite`, `./sql/extensions/history` and `./sql/extensions/convergence`, proved by `cd commons/data && bun run verify`. A governance layer, a logical schema and a physical schema, and the extensions to each, produce SQL for PostgreSQL, SQLite and DuckDB; its own specifications say what it does.

<!-- libraries:end -->

## Acceptance scenarios

1. **Given** a folder `commons/example/` with a package, a spec kit, a workflow and a manifest at L1, **When** `libraries.ts` runs, **Then** the section "The libraries" gains one requirement numbered from FR-101 and `enforcement.tsv` one `check` row that runs the library's `verify`, per FR-011 and FR-014.
2. **Given** a manifest whose `version` is not its package's, **When** `libraries.ts --check` runs, **Then** it exits 1 and names the library and both versions, per FR-013.
3. **Given** a library with a spec kit and no `library.ts`, **When** the test of this repository runs, **Then** it fails and names the folder, per FR-008 and FR-012.
4. **Given** a manifest that declares L0 and no spec kit, **When** it is read, **Then** it is accepted and no `verify` of the Mizan check is asked of it, per FR-012 and FR-013.

## Out of scope

- What a library does: its own specifications say so, never this one.
- The existing folders of commons (`ts`, `docs`, `ontology`, `tools`, `generated`, `spec-kit`): their specifications stay in this repository's spec kit and they are not libraries in this sense (OQ-1).
- How a library is published or consumed from another repository: 0005-typescript-runtime (the Git dependency).

## Edge cases

- A folder `commons/<name>/spec-kit/` with no `library.ts`: found by the test, per FR-008.
- A manifest that names another folder, another version than the package's, or exports the package does not have: found, per FR-013.
- A manifest with a field it does not know, or `level: "L9"`: refused with the field named, per FR-012.
- A library at L0 with no spec kit: accepted, per FR-012.
- A manifest at L1 whose `verify` script runs the Mizan check at L3: found, per FR-013.
- The section "The libraries" edited by hand: `libraries.ts --check` names the file, per FR-011.
- A new library with a manifest and no generated requirement: found and written by the generator, per FR-014.
- A generated requirement that names `commons/nope`, which does not exist: not what the manifests make, found per FR-011.
- A specification of a library listed in this repository's `registry.tsv`: found, per FR-002.
- An `enforcement.tsv` of a library with a row for a requirement of this repository: the specification checker names it as a row for a requirement that does not exist, per FR-002.
- A library specification whose slug is also a slug here, cited by a library file: it means the library's, per FR-003.
- A library file that imports `../../ts/kernel/mod.ts`: found, per FR-004.
- A library whose `verify` leaves out the specification checker: found, per FR-005.
- A library whose `verify` does not run `tools/check.ts`: found, per FR-006.
- A library folder with no workflow: found, per FR-010.
- A library's spec kit that the documentation does not name: published without it, found, per FR-009.

## Assumptions

- `tools/check.ts` of a library is the library's own: `commons/data` reads its trace and layers with commons' kernel and runtime, and another library may keep a different check as long as its `verify` runs it under that name.
- A library imports the kernel by package name through a path link (`link:../ts` in its `devDependencies`); how and why is 0005-typescript-runtime's, which records the findings of the first library so that no one repeats them.
- The existing folders of commons migrate to this form later, after what `commons/data` teaches (OQ-1).

## Open questions

- **OQ-1**: Which of `ts`, `docs`, `ontology` and `tools` become libraries, and how their specifications move: to be settled from what `commons/data` teaches and carried out before 2026-12-31.

## Key entities

- **Library** - a top-level folder of commons with a manifest, a spec kit, a package, documentation and checks of its own.
- **Manifest** - `commons/<name>/library.ts`: the library's name, level, spec kit, verify command, version and exports, read as data.
- **Library spec kit** - `commons/<name>/spec-kit/`, numbered from 0001, whose requirements belong to the library.
- **Verify** - the one script that proves a library, which this repository's enforcement register names.

## Success criteria

- **SC-001**: A library can be checked, tested and documented from its own folder, and this repository's checks never read inside its spec kit except to run the specification checker on it.
- **SC-002**: This repository's register names every library as one requirement, and no requirement of a library appears in it.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
