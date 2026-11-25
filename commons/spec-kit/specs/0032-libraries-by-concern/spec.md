# Feature Specification: Libraries by concern

**Spec ID:** 0032-libraries-by-concern
**Status:** Draft
**Owner:** if
**Domain:** commons
**Part of:** 0027-commons-libraries

**Input:** The TypeScript of commons is organized by concern, not by language or by technical layer: a person who wants YAML, or OpenTelemetry without an SDK, or the one-function test harness, takes that library alone. Each library is a top-level folder `commons/<name>/` that is an npm package, registered by a manifest, in a layer, and depends only on the layers below it. This specification is the map of the libraries, the form of a library, and the rule that each library specifies and proves its own requirements.

## The libraries

- **FR-001**: The code of commons MUST be organized by concern: each part of it is a library, a top-level folder `commons/<name>/` that is a package named `@intellectual-frontiers/<name>` in this repository (and in `per-library` mode on a registry, and in `single` mode inside the one package, under that name, 0036-distribution FR-021) and is registered by a manifest (0027-commons-libraries FR-012), and no folder of commons MUST be named for a language or a runtime (`ts`, `js`, `node`, `bun`).
- **FR-002**: The libraries MUST be those of the table below, in layers: a library of a layer MUST depend only on libraries of the layers below it (FR-003). `docs`, `data`, `repoctl`, `headless`, `kanon` and the libraries of the integrations and of Archon are libraries of their own, each with its own specifications; the table lists those that the others are built on.

  | Layer | Library | Concern |
  |---|---|---|
  | 0 | core | errors as values, exhaustive matching, branded types, decoders, text helpers, type-level tests, graphs of work, exact optional objects |
  | 1 | formats | JSON5, YAML, TOML, XML, CSV, base64, hexadecimal, CBOR, DER, archives, PNG, TypeScript literals, globs, versions and ranges, media types, HTTP headers |
  | 1 | crypto | digests, MD5, crypt, AWS Signature Version 4, UUIDs, CMS, COSE, DSSE, WebAuthn |
  | 1 | rdf | RDF as typed values: terms, schemas, vocabularies, writers |
  | 1 | terminal | the command-line parser, command trees, escape sequences, width, the palette |
  | 1 | system | the host: files, paths, folders, locks, watching, programs, Git, binaries, scheduled jobs, the terminal state, standard streams |
  | 1 | net | downloads, the HTTP server, typed HTTP clients, TCP, TLS, DNS, ACME |
  | 2 | telemetry | OpenTelemetry signals, OTLP, rendering, the process and network spans, the console |
  | 2 | grc | governance, risk and compliance primitives: assessment, evidence, OSCAL, OCSF, attestation, signing |
  | 3 | test | test registration, assertions and the record of a test |
  | 4 | quality | the quality system: reports, evidence, freshness, nonconformance, CAPA |
  | 2 | ontology | the ontologies several libraries read: Mizan, IFCCM, IFQS, IFR, the audit of packaging and the software supply chain |
  | 2 | kanon | the table of layers and the import check, and the types-only layered model |
  | 3 | mizan | the rules Mizan adds to the format of a specification, conformance levels, change control, release records, trace and layers |
  | 3 | githost | the Git hosts: capabilities, Git, GitHub, GitLab, remotes |
  | 4 | libraries | the registry of libraries, the workflows, pins, the packer, the release, the importers of standards |
  | 3 | lint | the lint plugin and its rules |



- **FR-003**: The dependencies of a library MUST be acyclic and MUST run only to libraries of a lower layer; each MUST be declared in the library's `package.json` (as `link:../<name>` in this repository and as the exact version in the published package), and a library MUST import another library by its package name only and MUST NOT import by a relative path a file outside its own folder. The dependencies of a library's tests (`devDependencies`) are not held to the layers.
- **FR-004**: Whether code is pure or touches the host MUST be a property of a file's place inside a library (a subpath of its package, such as `@intellectual-frontiers/<name>/host`), and MUST NOT be a library of its own: no library is named for a technical layer.

## The form of a library

- **FR-005**: A library MUST be published (in `per-library` mode as a package of its own by `tools/pack.ts`, in `single` mode inside the one package by `commons/commons/tools/pack.ts`) as compiled ECMAScript modules with their type declarations, built by the TypeScript 7 compiler from its sources (`tools/pack.ts`), and the `exports` of the published package MUST name, for each entry, the `types` file, the source for the `bun` condition and the compiled file for `default`, so that the package runs on Node 26 and on Bun with no build step; the package MUST carry its license (PolyForm Noncommercial 1.0.0, 0035-licensing) and its `engines` of Node 26 or later.
- **FR-006**: Node 26 MUST be the least Node a library supports, and its sources MUST be erasable TypeScript only (`erasableSyntaxOnly`), so that a library linked into another package of this repository runs from its `.ts` sources on Node 26 with no hook (Node strips the types of a file that is not under `node_modules`) and a library installed from a registry runs from its compiled files.
- **FR-007**: A library's tests MUST be in its own folder (`suite/`) and run by its `verify`; a test that spans libraries (the boundaries of the whole, the versions, the ontologies, the generated files) MUST stay in the tests of this repository.
- **FR-008**: The ontology that a library defines or generates from MUST be a file of that library, except the ontologies that several libraries read (Mizan, IFCCM, IFQS, IFR, the audit of packaging and the software supply chain), which are the library `ontology`.
- **FR-009**: A new library MUST start at level L1 (0028-conformance-levels), MUST be versioned as a work (0026-works-versioning FR-008: `release.ts`), and MUST be published by the release workflow (0030-generated-workflows FR-009) in the one package of `single` mode, which tags the version `commons-v<version>` (0036-distribution FR-027), or, in `per-library` mode, as a package to the GitHub package registry and to npm, tagging `<name>-v<version>` once the publish was accepted, whether the package got there by that workflow or by a person's first publish of a package that has no trusted publisher yet, and MUST NOT fail on a version that is already there.

## Moving a module

- **FR-010**: Each library MUST specify and prove its own requirements in its own spec kit (`commons/<name>/spec-kit/`), numbered from 0001, and the requirements of the specifications of commons as a whole that a library holds MUST be kept by that library: the register names the library's requirement for each (`review`, by this requirement). Where two libraries would need one another, the module is in the lower one and a library of a lower layer holds a port that a higher one installs (`proc.setProcessTracer` is the port that the telemetry installs when its module is loaded, so that `system` does not depend on `telemetry`).

- **FR-011**: A consumer of the libraries (`erga`, a fleet repository) MUST import a library by its package name from a registry (0036-distribution) and MUST NOT take a file of this repository by any other way.
- **FR-012**: A move of modules from one library to another MUST rewrite, in the same commit, every importer of them in this repository to the package name of their library, MUST add the dependency to each package that imports it, and MUST leave no re-export of the moved modules behind.

## Typing

- **FR-013**: Every package that is published and has entries in its `exports` (the one package of `single` mode, and in `per-library` mode each package a library publishes to npm) MUST publish declaration files for each of them: each entry MUST carry a `types` condition that names a `.d.ts` file in the tarball, the declarations an entry reaches MUST import only files of the tarball and packages the package declares as dependencies, and the code it publishes MUST import no package that is not on npm. The packer MUST refuse to pack a package that fails any of these, and a test MUST pack the package (in `per-library` mode every library whose distribution includes npm, run with `IFC_DISTRIBUTION=per-library`; in `single` mode the one package, `tests/release/commons-package.test.ts`, 0036-distribution FR-026), inspect the tarball (its files, its published `package.json`, each entry's `types` and its declarations), install it in an empty project and type-check a consumer of every entry against it with the TypeScript 7 compiler under `moduleResolution: nodenext`. A package that exports nothing (a command only) has no entry to declare.

## Order of the libraries

A library cannot be published before the libraries it depends on are, so the release publishes the layers from 0 up (libraries 0001-libraries FR-013 to FR-015). `core` is first: it has no dependency and most files of commons import it.

## Acceptance scenarios

1. **Given** the library `core`, **When** its package is packed and installed under a folder `node_modules` of an empty project, **Then** Node 26 and Bun both import it and use `ok`, `err` and `decode`, per FR-005 and FR-006.
2. **Given** a library whose `package.json` depends on a library of a higher layer or of its own layer, **When** the test of the map runs, **Then** it fails naming both, per FR-003.
3. **Given** a library with a relative import of a file outside its folder, **When** the test runs, **Then** it fails naming the file, per FR-003.
4. **Given** a module moved from one library to another, **When** any file of this repository still imports its old path, **Then** the compiler fails, per FR-012.
5. **Given** a version published by hand to npm, **When** the release workflow is run from the main branch and asked to publish, **Then** it publishes nothing twice, makes the tag `<name>-v<version>` and does not fail, per FR-009.

6. **Given** a library whose published package has an entry with no `types`, or a declaration that imports a package it does not depend on, **When** it is packed, **Then** the packer refuses and names the entry or the import, per FR-013.
7. **Given** the packed tarball of a library, **When** it is installed in an empty project, **Then** a consumer file that imports every entry type-checks against it, per FR-013.

## Out of scope

- The first publication of a package under npm's trusted publishing (the owner sets it on npmjs.com after a first publish with a token).
- `commons/data` keeps its own specifications.

## Edge cases

- A module that two libraries need: it is in the lower one, per FR-003; a cycle between two libraries is a sign that a module is in the wrong one, and the table is changed (FR-002).
- A library's tests that need the harness of `test`, a library of a higher layer: they are `devDependencies`, per FR-003.
- A version already on npm when the workflow runs: it is skipped, and the tag is still made, per FR-009.

## Assumptions

- The TypeScript 7 compiler emits JavaScript and declarations for these sources (its `rewriteRelativeImportExtensions` turns `.ts` specifiers into `.js`); the library `core` proves it.
- A package that is a `link:` of another is installed as a symbolic link, and Node resolves it to its real path.

## Open questions

- None.

## Key entities

- **Library** - a top-level folder of commons that is an npm package of its own, registered by a manifest.
- **Layer** - the place of a library in the order of the dependencies: a library depends only on the layers below it.

## Success criteria

- **SC-001**: A person installs `@intellectual-frontiers/<name>` for one concern and gets that concern alone.
- **SC-002**: No folder of commons is named for a language, and every dependency between libraries is declared and runs downward.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
