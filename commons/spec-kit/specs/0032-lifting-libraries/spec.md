# Feature Specification: Lifting libraries

**Spec ID:** 0032-lifting-libraries
**Status:** Draft
**Owner:** if
**Domain:** commons
**Part of:** 0027-commons-libraries

**Input:** The TypeScript of commons lives in one folder, `commons/ts`, grouped by the language and, inside it, by technical layer (`kernel` for the pure code, `runtime` for the host). A person who wants YAML, or OpenTelemetry without an SDK, or the one-function test harness, must take all of it, and a folder named for a language says nothing of what is in it. This specification lifts the code into libraries by concern, each a top-level folder `commons/<name>`, each an npm package `@intellectual-frontiers/<name>` that others install and reuse, with the dependencies between them stated, acyclic and checked.

## The libraries

- **FR-001**: The code of commons MUST be organized by concern: each part of it is a library, a top-level folder `commons/<name>/` that is an npm package named `@intellectual-frontiers/<name>` and is registered by a manifest (0027-commons-libraries FR-012), and no folder of commons MUST be named for a language or a runtime (`ts`, `js`, `node`, `bun`) once the lift is complete.
- **FR-002**: The libraries and what each takes from the folders of `commons/ts` MUST be those of the table below, in layers: a library of a layer MUST depend only on libraries of the layers below it (FR-003). A module is named `kernel/<m>` or `runtime/<m>` for the file `<m>.ts` of that folder of `commons/ts`; `mizan/`, `quality/`, `githost/`, `lint/` and `tools/` are those folders. Where an assignment proves wrong while a library is lifted, the table is changed in the same commit as the move.

  | Layer | Library | Takes |
  |---|---|---|
  | 0 | core | kernel/absurd, kernel/brand, kernel/result, kernel/types, kernel/decode, kernel/objects, kernel/text, kernel/graph |
  | 1 | formats | kernel/json5, kernel/yaml, kernel/toml, kernel/xml, kernel/csv, kernel/base64, kernel/cbor, kernel/der, kernel/archive, kernel/png, kernel/ts-literal, kernel/glob, kernel/semver, kernel/media-types, kernel/http |
  | 1 | crypto | kernel/sha256, kernel/md5, kernel/crypt, kernel/sigv4, kernel/uuid, kernel/cms, kernel/cose, kernel/dsse, kernel/webauthn, runtime/sign |
  | 1 | rdf | kernel/rdf, kernel/rdf-term, kernel/rdf-schema, kernel/rdf-vocabularies, kernel/rdf-write |
  | 1 | terminal | kernel/args, kernel/commands, kernel/vt, kernel/width, kernel/palette, runtime/tty, runtime/stdio |
  | 1 | system | runtime/fs, runtime/path, runtime/dirs, runtime/lock, runtime/watch, runtime/discover, runtime/errors, runtime/proc, runtime/git, runtime/compile, runtime/schedule, kernel/schedule |
  | 1 | net | runtime/net, runtime/tcp, runtime/dns, runtime/http-client, runtime/serve, runtime/acme |
  | 2 | telemetry | kernel/otel, kernel/otlp, kernel/signals, kernel/render, runtime/otel, runtime/console, runtime/trace |
  | 2 | grc | kernel/grc, kernel/assess, kernel/evidence, kernel/oscal, kernel/ocsf, kernel/ocsf-types.auto, kernel/attest, runtime/grc |
  | 2 | test | runtime/test, runtime/test-run |
  | 3 | quality | quality/, kernel/test-record, kernel/test-report |
  | 3 | mizan | mizan/integrations, mizan/rules, mizan/levels, mizan/check, mizan/harness, mizan/standards, mizan/spec-files, mizan/spec-terms, mizan/newer, mizan/imports, mizan/mod, mizan/generate-ontology, mizan/publish-ontology, mizan/oscal-register, kernel/trace, kernel/layers |
  | 3 | ifccm | mizan/changes, mizan/changes.ts |
  | 3 | ifr | mizan/versions, mizan/versions.ts |
  | 3 | githost | githost/capabilities, githost/git, githost/github, githost/gitlab, githost/http, githost/mod, githost/remote, githost/types |
  | 3 | libraries | mizan/libraries, mizan/affected, githost/workflows, tools/generate-workflows, tools/pins, tools/install-bun, tools/pack-library |
  | 3 | lint | lint/ |

  The libraries `docs`, `data` and `ergonex` already exist and are not moved; `kernel/documentation` goes to `docs`. The folder `commons/ts/data` is another work's and is not part of this lift.

- **FR-003**: The dependencies of a library MUST be acyclic and MUST run only to libraries of a lower layer; each MUST be declared in the library's `package.json` (as `link:../<name>` in this repository and as the exact version in the published package), and a library MUST import another library by its package name only and MUST NOT import by a relative path a file outside its own folder. The dependencies of a library's tests (`devDependencies`) are not held to the layers.
- **FR-004**: Whether code is pure or touches the host MUST be a property of a file's place inside a library (a subpath of its package, such as `@intellectual-frontiers/<name>/host`), and MUST NOT be a library of its own: no library is named for a technical layer.

## The form of a library

- **FR-005**: A library MUST be published as compiled ECMAScript modules with their type declarations, built by the TypeScript 7 compiler from its sources (`tools/pack.ts`), and the `exports` of the published package MUST name, for each entry, the `types` file, the source for the `bun` condition and the compiled file for `default`, so that the package runs on Node 26 with no hook and on Bun with no build step; the package MUST carry its license (MIT) and its `engines` of Node 26 or later.
- **FR-006**: Node 26 MUST be the least Node a library supports, and its sources MUST be erasable TypeScript only (`erasableSyntaxOnly`), so that a library linked into another package of this repository runs from its `.ts` sources on Node 26 with no hook (Node strips the types of a file that is not under `node_modules`) and a library installed from npm runs from its compiled files. The Node hook of `commons/ts` (0005-typescript-runtime FR-029) MUST be removed when the last consumer that installs a copy of the sources has moved to the packages.
- **FR-007**: A library's tests MUST be in its own folder (`suite/`) and run by its `verify`; a test that spans libraries (the boundaries of the whole, the versions, the ontologies, the generated files) MUST stay in the tests of this repository.
- **FR-008**: The ontology that a library defines or generates from MUST be a file of that library.
- **FR-009**: A new library MUST start at level L1 (0028-conformance-levels), MUST be versioned as a work (0026-works-versioning FR-008: `release.ts`), MUST be published to the GitHub package registry and to npm by the workflow generated for it (0030-generated-workflows FR-009), and the workflow MUST tag the version `<name>-v<version>` once it is on its registry, whether it got there by that workflow or by a person's first publish of a package that has no trusted publisher yet, and MUST NOT fail on a version that is already there.

## Moving a module

- **FR-010**: Each requirement of 0005-typescript-runtime MUST be kept by the library that holds the module it is about, and where a library is lifted the requirements of its modules MUST be cited from the library's files as before; the table below grows by the requirements of each library as it is lifted.

  | Requirement of 0005-typescript-runtime | Library |
  |---|---|
  | FR-033 (graphs of work) | core |
  | FR-064 (objects for exact optional properties) | core |
  | 0012-ontology FR-001 to FR-007 (RDF as typed values, vocabularies, schemas, code lists, checks, writers, no reader) | rdf |

- **FR-011**: The consumers of the packages, `erga` and `stolos`, MUST import a library by its package name once it is published and MUST NOT import `commons/ts/*` for what a library holds.
- **FR-012**: A move of modules MUST rewrite, in the same commit, every importer of them in this repository (relative paths and the barrel `@intellectual-frontiers/commons/ts/kernel` alike) to the package name of their library, MUST add the dependency to each package that imports it, and MUST leave no re-export of the moved modules behind.

## Typing

- **FR-013**: Every package that a library publishes to npm and that has entries in its `exports` MUST publish declaration files for each of them: each entry MUST carry a `types` condition that names a `.d.ts` file in the tarball, the declarations an entry reaches MUST import only files of the tarball and packages the package declares as dependencies, and the code it publishes MUST import no package that is not on npm. The packer MUST refuse to pack a package that fails any of these, and a test MUST pack every library whose distribution includes npm, inspect the tarball (its files, its published `package.json`, each entry's `types` and its declarations), install it in an empty project and type-check a consumer of every entry against it with the TypeScript 7 compiler under `moduleResolution: nodenext`. A package that exports nothing (a command only) has no entry to declare.

## Order of the lift

The libraries are lifted from the layer 0 up, because a library cannot be published before the libraries it depends on are. `core` is first: it has no dependency, it is imported by most files of commons (`result` alone by about ninety), and so it proves in one library the build, the `exports`, the tests, the generated workflows, the publication, the tag and the rewrite of every importer, in this repository and in the consumers. `lint` and `githost`, which were first considered because nothing else imports them, depend on `core`, `formats`, `system` and `net`, and follow them.

## Acceptance scenarios

1. **Given** the library `core`, **When** its package is packed and installed under a folder `node_modules` of an empty project, **Then** Node 26 with no hook and Bun both import it and use `ok`, `err` and `decode`, per FR-005 and FR-006.
2. **Given** a library whose `package.json` depends on a library of a higher layer or of its own layer, **When** the lift's test runs, **Then** it fails naming both, per FR-003.
3. **Given** a library with a relative import of a file outside its folder, **When** the test runs, **Then** it fails naming the file, per FR-003.
4. **Given** a module moved from `commons/ts` to a library, **When** any file of this repository still imports its old path, **Then** the compiler and the test fail, per FR-012.
5. **Given** a version published by hand to npm, **When** the publish workflow is run from the main branch, **Then** it publishes nothing twice, makes the tag `<name>-v<version>` and does not fail, per FR-009.

6. **Given** a library whose published package has an entry with no `types`, or a declaration that imports a package it does not depend on, **When** it is packed, **Then** the packer refuses and names the entry or the import, per FR-013.
7. **Given** the packed tarball of a library, **When** it is installed in an empty project, **Then** a consumer file that imports every entry type-checks against it, per FR-013.

## Out of scope

- `commons/ts/data` and `commons/data`: another work's; `commons/data` keeps its functionality and changes only the specifiers it imports by.
- The Node hook's removal before the last consumer has moved, and backward compatibility of the old entry points of `commons/ts`: there is none.
- The first publication of a package under npm's trusted publishing (the owner sets it on npmjs.com after a first publish with a token).

## Edge cases

- A module that two libraries need: it is in the lower one, per FR-003; a cycle between two libraries is a sign that a module is in the wrong one, and the table is changed (FR-002).
- A library's tests that need the harness of `test`, a library of a higher layer: they are `devDependencies`, per FR-003.
- A version already on npm when the workflow runs: the job that publishes skips, and the tag is still made, per FR-009.
- A consumer that pins a commit of this repository from before a move: it keeps working until it moves its pin; no re-export is kept for it, per FR-012.

## Assumptions

- The TypeScript 7 compiler emits JavaScript and declarations for these sources (its `rewriteRelativeImportExtensions` turns `.ts` specifiers into `.js`); the library `core` proves it.
- A package that is a `link:` of another is installed as a symbolic link, and Node resolves it to its real path.

## Open questions

- None.

## Key entities

- **Library** - a top-level folder of commons that is an npm package of its own, registered by a manifest.
- **Layer** - the place of a library in the order of the dependencies: a library depends only on the layers below it.
- **Lift** - the move of modules from `commons/ts` into the library that holds their concern, with every importer rewritten.

## Success criteria

- **SC-001**: A person installs `@intellectual-frontiers/<name>` for one concern and gets that concern alone.
- **SC-002**: No folder of commons is named for a language, and every dependency between libraries is declared and runs downward.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
