# Feature Specification: Libraries

**Spec ID:** 0001-libraries
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** A repository of commons is many libraries, each a folder with a manifest and a package. A person who adds one, or changes one, needs the repository to know it: the manifest read as data and held against the folder, the libraries a change touches found without running them all, the workflows of GitHub Actions written as typed TypeScript and made into the files GitHub reads, the pinned Bun that runs them, the packer that builds a library for npm with its declarations and refuses one without, and the commands that hold the whole repository to Mizan: the check of its specifications, change control, versions, the register of proofs and the ontologies it publishes. This library is those tools, as a package of their own.

## The libraries of a repository

- **FR-001**: A library MUST be a folder `commons/<name>/` with a manifest `library.ts` that is an object literal read as data and never run, naming the library, its conformance level, its spec kit, its `verify` command, its version, its `exports` and where it is published; the library MUST give the decoder of that manifest and the check that the manifest and its folder agree (the name of the folder is the package's name, the version is the package's and the record's, the `exports` are the package's, a registry of `distribution` is one of the two kinds), as commons 0027-commons-libraries FR-011 to FR-018 require.
- **FR-002**: The library MUST make, from the manifests, the section "The libraries" of commons 0027-commons-libraries (one requirement for each library, numbered from FR-101 for the life of the library) and the rows of those requirements in `enforcement.tsv`, and MUST fail with `--check` where either is not what the manifests make (commons 0027-commons-libraries FR-011).
- **FR-003**: The library MUST say which libraries a change affects: from the files of a change (since a revision, or named) it MUST give the libraries whose folder, or whose dependencies (the `link:`, `file:` and `workspace:` entries of `package.json` and the packages their imports reach through `exports`), changed, as a matrix a workflow reads, and for a library the folders and files it reads, one a line (commons 0027-commons-libraries FR-019 to FR-022).

## The workflows

- **FR-004**: The library MUST model a workflow of GitHub Actions as typed values (the triggers, the jobs, the steps, the strategy, the permissions, the concurrency and the composite action), give `validateWorkflow` and `validateAction` (an action with no version, a job that needs a job that is not there, a step of no script) and render the YAML of a workflow and of an action as the same bytes for the same values, each beginning with a line that says it is generated and by what (commons 0030-generated-workflows FR-002 to FR-006).
- **FR-005**: The library MUST make, with one command, the files `.github/workflows/<name>.auto.yml` and `.github/actions/bun/action.yml` of a repository from the manifests of its libraries and the facts of their CI, MUST fail with `--check` where a file is not what the model makes, where a workflow is written by hand or where a library that is published to npm has no `tools/pack.ts` for its publish workflow to run, and MUST make the publish workflow of such a library idempotent: it checks the tag is the version, proves and packs the library, sends the tarball to the registries its manifest names unless the version is already there, and makes the tag of the version (commons 0030-generated-workflows FR-001, FR-004, FR-007 to FR-009).
- **FR-006**: The library MUST read the pins of commons (`commons/generated/pins.auto.env`) and install the pinned Bun on a runner: the release asset of the platform fetched with retries, kept only where its SHA-256 is the pinned one, unpacked by the zip reader of `formats` and put on the `PATH`, on Linux, macOS and Windows, with no shell script, no Python and no `unzip` (commons 0005-typescript-runtime FR-026).

## The package

- **FR-007**: The library MUST give the packer of a library: from the manifest and the sources it builds the compiled modules and their declarations with the TypeScript 7 compiler, writes the `package.json` that is published (each entry with `types`, the source for Bun and the compiled file for the rest), inspects the package and packs it into `dist/<scope>-<name>-<version>.tgz`, and MUST fail where an export has no `types` condition or no `.d.ts` in the tarball, where a declaration imports a module that is neither in the tarball nor among the package's dependencies, or where a declaration names a `node:` module and the package has no peer of `@types/node` (commons 0032-lifting-libraries FR-005 and FR-013).
- **FR-008**: The library MUST give the commands that hold a whole repository to Mizan, each reading every manifest, ontology and specification they need: `check` (a spec kit held to a conformance level, and with `--all` the `verify` of every library), `changes` (the change requests of a range and the rules of change control), `versions` (the records of the works and their versions, the tag and the ledger), `newer` (the standards that are newer than their pins), `oscal-register` (the register of requirements and proofs as OSCAL, current or not) and the generators of the ontologies of commons (their Turtle, OWL, RDF/XML, SHACL, JSON Schema, SSSOM, SKOS, SQL and HTML) (commons 0003-mizan, commons 0018-standards-first, commons 0020-ifccm, commons 0026-works-versioning, commons 0028-conformance-levels and 0012-ontology).
- **FR-009**: The library MUST keep the importers of standards, each a module that fetches or reads a standard at a pinned address and writes the typed module and the provenance of what it read, with `--check` for whether what is committed is what the standard gives (commons 0019-mizan-integrations).
- **FR-010**: The library MUST be published to npm as compiled modules with their declarations, one entry for the package and one for each tool above, and each of its commands MUST run as `bun commons/libraries/src/<command>.ts` in this repository.

## The development loop, the plan of CI and the release

- **FR-011**: The library MUST give a development loop, one command (`bun run dev:check` at the root), that finds the libraries the working tree changes since a revision (origin/main by default, the files not yet committed included) or that are named, and the libraries whose own sources import them, from the same planner as `affected` with the narrower reach of a library's own code (its folder and the packages its `about.ts` and `src/` import); that links the libraries of the repository under `commons/node_modules` so that a library imports another by its package name and reads the checkout's source, installs the packages that the root shares once and those a library has of its own; that type-checks each affected library with TypeScript 7, several at a time, and runs the tests of each in a `bun test` process of its own, several at a time; and that prints a short summary in the marks and colours of the terminal library (what it looked at, one line for each stage, what failed under it) and exits 1 where a stage failed. It MUST prove less than `verify` and say so, and never be the release.
- **FR-012**: The library MUST give the plan of CI, `plan.ts`: from the same planner (the reach of `verify`: what a library's `verify` reads and what depends on it) and the record of CI of each library, the cells of a matrix on Linux, one for each library affected, and the cells of a matrix on the systems besides Linux, one for each affected library whose record names one, as the outputs of a step a workflow reads; and the one workflow `ci` of this repository MUST be made from it (commons 0030-generated-workflows FR-006, FR-007), so that a push or a pull request runs `verify` and the tests on Node 26 for the libraries it affects, on Windows and macOS only for the libraries that have code of their own for them, and nothing else. The packing that `verify` ends with MUST be checked in a push only for the libraries that changed their `exports` since the base (a new library included) or where the packer changed, and in every cell of a run of everything; the release packs every library.
- **FR-013**: The library MUST give the one command of the release, `releasing.ts` (`bun run release` at the root), whose `plan` writes nothing and says what a release does and whose `apply` does it, with the rules of commons 0026-works-versioning FR-041: from the tags of each library and its files since its last tag (its folder and the paths its record adds) a library MUST be raised by the greatest `Impact:` of its commits since the tag (a patch where none states one), a library that imports a library that is raised MUST be raised by at least a patch, a version that has no tag MUST be released as it is, a version tagged and unchanged MUST be left alone, a version below its last tag and a cycle of imports MUST be errors, and the steps MUST be in the order of the imports. A library with no record of its own is released by its manifest and its package.
- **FR-014**: `apply` MUST write the new version into the record, the manifest and the package of each library it raises, make the generated files once (the section of the libraries, the packaging tables, the ontologies, the workflows and the register), run the tests that pack every library, install it and type-check a consumer (`tests/release/`) unless it is told not to, and write the record `commons/generated/release.auto.json` (the libraries to publish and tag, in order, with no day and no person), and it MUST NOT publish, tag or commit; `matrix` MUST read the record and give the workflow what is not tagged yet.
- **FR-015**: The library MUST make, with the generator of its workflows, the one release workflow `release.auto.yml` (commons 0030-generated-workflows FR-009): run by hand from main, it plans from the record, proves and packs each library in a matrix, and, only where asked to publish, sends the tarballs in the order of the record to npm (trusted publishing with provenance, or the secret `INFRO_NPMJS_TOKEN` where the repository has it) and to the GitHub package registry, skipping a version a registry has, and makes the tags with the runner's token.

## Families and reserved names

- **FR-016**: The decoder of the manifest MUST read the optional field `family` (a `host`, a library name, and a `role` of `host`, `dialect` or `plugin`), and the check of the manifests MUST find, as one sentence each: a library whose name a reservation holds and whose family is not the host the reservation names (the reservations are data of the library, an exact name or a prefix with the host that may hold it, and hold `archon`, `archon-*`, `signing`, `gitops` and `estate`, with no folder); a host that is not named as its family; a dialect or plugin whose host is not a library that declares role `host` and a `kanon` table; a name the host's family rule does not read as its role; a member the host's table does not declare, and a member the host's table declares that no library declares; a member whose `kanon` table does not extend the host; and a library whose name the family rule of a host reads as a member and that declares no family.

## Acceptance scenarios

1. **Given** a folder `commons/x/` with a manifest, **When** the section of the libraries is made, **Then** it holds one requirement for `x` and its row, and `--check` fails where either differs, per FR-001 and FR-002.
2. **Given** a change to a file of one library, **When** the affected libraries are asked for, **Then** that library and each that depends on it are in the matrix and no other, per FR-003.
3. **Given** the typed workflows of the repository, **When** the generator runs with `--check`, **Then** each file is what the model makes and a hand-written workflow is a finding, per FR-005.
4. **Given** a library that is published to npm, **When** the packer runs, **Then** every export has its declaration in the tarball and a consumer type-checks against it, per FR-007.
5. **Given** a change to a file of one library, **When** `bun run dev:check` runs, **Then** that library and the libraries whose own sources import it are type-checked and tested, and nothing else, per FR-011.
6. **Given** a push, **When** the workflow `ci` runs, **Then** its plan names the libraries the push affects, a library that is not affected has no job, and the systems besides Linux are asked for only by a library whose record names them, per FR-012.
7. **Given** libraries tagged and unchanged, a library whose files changed since its tag and one that imports it, **When** `releasing.ts plan` runs, **Then** the first two are raised and the importer by a patch, and the unchanged are left alone, per FR-013.
8. **Given** a release made by `apply`, **When** the release workflow is run from main and asked to publish, **Then** the libraries are published in the order of the record, skipping what a registry has, and tagged, per FR-014 and FR-015.
9. **Given** the repository, **When** `check --all` runs, **Then** the `verify` of every library runs and a failing one fails the run, per FR-008.

10. **Given** a library named `archon-dialect-x` that declares no family, **When** the manifests are checked, **Then** a sentence names the library and the host it may be held for, per FR-016.
11. **Given** a host whose table declares a dialect and a library of that dialect's name that declares its family, **When** the manifests are checked, **Then** there is no finding, and for a dialect nobody registered or a registered one nobody declared there is one, per FR-016.

## Out of scope

- The harness, its rules and its levels: `mizan`; the ontologies: `ontology`; the Git hosts: `githost`; the test evidence: `quality` and `test`.

## Edge cases

- A manifest that is not a literal, has two exports or an unknown field: refused naming the field, per FR-001.
- A library with a dependency that is not a library of the repository: not in the matrix, per FR-003.
- A workflow file written by hand under `.github/workflows/`: a finding, never deleted, per FR-005.
- A runner with no network for the pinned Bun: the installer fails with the pinned address and the SHA-256 it wanted, per FR-006.

## Assumptions

- Every library of the repository is a folder of `commons/` with a `package.json` of the same name.

## Open questions

- None.

## Key entities

- **Manifest** - the data `library.ts` holds about a library.
- **Matrix** - the libraries a change affects, as a workflow reads them.
- **Model** - the typed values a workflow is written in.
- **Packer** - the program that builds, inspects and packs a library.

## Success criteria

- **SC-001**: A person adds a library by adding a folder and running one command, and the workflows, the requirements and the package of it follow.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
