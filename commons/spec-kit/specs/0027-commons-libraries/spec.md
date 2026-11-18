# Feature Specification: Commons libraries

**Spec ID:** 0027-commons-libraries
**Status:** Draft
**Owner:** if
**Domain:** commons
**Part of:** 0003-mizan

**Input:** Each top-level folder of commons that is a library (`commons/data` first) is independent: it keeps its own specifications in a spec kit of its own, numbered from 0001, its own package, its own documentation and its own checks, and it imports what it uses of commons by package name. This repository knows a library as exactly one requirement, whose proof is the library's own `verify`; every requirement under that one belongs to the library and is never numbered, listed or proved here. A library can therefore grow, be checked and be published on its own, while this repository still says that it exists, where it is and how to prove it.

## What a library is

- **FR-001**: A library of commons MUST be a top-level folder `commons/<name>/` that holds a spec kit of its own at `commons/<name>/spec-kit/` in the form 0003-mizan gives every harness (`registry.tsv`, `enforcement.tsv`, `mizan.baseline.txt` and `specs/NNNN-slug/spec.md`), a `package.json` whose name is `@intellectual-frontiers/<name>`, an `about.ts` and a `verify` script, so that it is checked, tested and documented with nothing of commons but the packages it imports.
- **FR-002**: A library's specifications MUST be numbered from 0001 in its own registry, and its requirements MUST belong to it: this repository's registry (`commons/spec-kit/registry.tsv`) MUST NOT list a specification of a library, and a library's `enforcement.tsv` MUST have one row for each of its own requirements and none for a requirement of this repository.
- **FR-003**: A citation in a library's files (a `// Spec:` line, a `proves(` call, the `spec` of an ontology term) MUST be read against that library's spec kit alone, so that a slug both have (their numbers are independent) means the library's.
- **FR-004**: A library MUST import the packages of commons it uses (the kernel first) by package name, as 0005-typescript-runtime says, and MUST NOT import by a relative path a file outside its own folder.
- **FR-005**: A library's `verify` script MUST run from the library's folder with no argument, and MUST fail if any of its parts fails: the TypeScript compiler on the library, the specification checker on its spec kit (`bun ../tools/mizan-check.ts --root spec-kit`), the Mizan rules on it (`bun ../ts/mizan/check.ts --root spec-kit`) and the library's tests.
- **FR-006**: A library's `verify` script MUST also run `tools/check.ts`, the trace of its sources and tests to its own specifications (0015-trace) and the check of its layers, whose findings are held by a baseline of its own (`trace.baseline.txt`).

## What this repository knows

- **FR-007**: This repository MUST know each library as exactly one requirement of this specification, in the section "The libraries", named by the library's folder, whose enforcement is the library's own `verify` (a `check` row that runs `cd commons/<name> && bun run verify`); no requirement of a library MUST be a requirement of this repository.
- **FR-008**: A test of this repository MUST find every folder `commons/*/spec-kit` and fail where one is not named by a requirement of this specification, where a requirement of this specification names a library whose folder is not there, where a library lacks a part FR-001 names, where its `verify` lacks a part FR-005 names, where a file of the library imports by a relative path outside its folder (FR-004), or where the specification checker finds anything in its spec kit.
- **FR-009**: The documentation of commons (`commons/docs.config.ts`) MUST name each library's spec kit among its spec kits, so that the specifications of a library are published with those of commons and none is published twice.
- **FR-010**: Each library MUST have a workflow (`.github/workflows/<name>.yml`) that runs its `verify` on every push and pull request that changes its folder or what it imports, on the runtimes 0005-typescript-runtime names.

## The libraries

- **FR-011**: `commons/data` MUST be a library: the package `@intellectual-frontiers/data`, in which a governance layer, a logical schema and a physical schema (and the extensions to each) produce SQL for PostgreSQL, SQLite and DuckDB. Its own specifications say what it does, and it is proved by `cd commons/data && bun run verify`.

## Out of scope

- What a library does: its own specifications say so, never this one.
- The existing folders of commons (`ts`, `docs`, `ontology`, `tools`, `generated`, `spec-kit`): their specifications stay in this repository's spec kit and they are not libraries in this sense (OQ-1).
- How a library is published or consumed from another repository: 0005-typescript-runtime (the Git dependency).

## Edge cases

- A folder `commons/<name>/spec-kit/` that no requirement of this specification names: found by the test, per FR-008.
- A requirement of this specification that names `commons/nope`, which does not exist: found, per FR-008.
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

- **Library** - a top-level folder of commons with a spec kit, a package, documentation and checks of its own.
- **Library spec kit** - `commons/<name>/spec-kit/`, numbered from 0001, whose requirements belong to the library.
- **Verify** - the one script that proves a library, which this repository's enforcement register names.

## Success criteria

- **SC-001**: A library can be checked, tested and documented from its own folder, and this repository's checks never read inside its spec kit except to run the specification checker on it.
- **SC-002**: This repository's register names every library as one requirement, and no requirement of a library appears in it.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
