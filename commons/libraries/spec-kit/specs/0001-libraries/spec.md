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

## Acceptance scenarios

1. **Given** a folder `commons/x/` with a manifest, **When** the section of the libraries is made, **Then** it holds one requirement for `x` and its row, and `--check` fails where either differs, per FR-001 and FR-002.
2. **Given** a change to a file of one library, **When** the affected libraries are asked for, **Then** that library and each that depends on it are in the matrix and no other, per FR-003.
3. **Given** the typed workflows of the repository, **When** the generator runs with `--check`, **Then** each file is what the model makes and a hand-written workflow is a finding, per FR-005.
4. **Given** a library that is published to npm, **When** the packer runs, **Then** every export has its declaration in the tarball and a consumer type-checks against it, per FR-007.
5. **Given** the repository, **When** `check --all` runs, **Then** the `verify` of every library runs and a failing one fails the run, per FR-008.

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
