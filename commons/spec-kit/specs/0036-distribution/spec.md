# Feature Specification: Distribution

**Spec ID:** 0036-distribution
**Status:** Draft
**Owner:** if
**Domain:** commons
**Part of:** 0027-commons-libraries

**Input:** A repository of Intellectual Frontiers other than `.github` (`erga` and the repositories of the companies) uses the code of commons, and it uses it only as an installed, published package. Public libraries are installed from npm, private packages (those of private repositories) from the GitHub package registry. No Git dependency on this repository, no path into a checkout of commons, no vendored copy and no fetch of raw source stands in its place. Five metapackages install commons as a set at one coherent release, and a check any repository can run finds what breaks the rule. This specification is the one place that says how commons reaches another repository.

## The rule

- **FR-001**: When a repository other than `intellectual-frontiers/.github` needs code of commons, it MUST get that code only by installing a published package: a public library from npm, a private package (one that belongs to a private repository) from the GitHub package registry (`https://npm.pkg.github.com`), with a scoped registry line and a token that may read packages in its `.npmrc`. Commons MUST NOT be consumed in any other way.
- **FR-002**: A repository that consumes commons MUST NOT have a dependency on this repository by Git (`github:intellectual-frontiers/.github`, `git+https://github.com/intellectual-frontiers/.github`, a `git:` or `ssh:` URL of it, with or without a commit), a `file:` or `link:` dependency into a path that holds a checkout of commons, a relative import that crosses into a copy of commons, a vendored copy of a library (a folder of its own that is not under `node_modules` and carries a package named `@intellectual-frontiers/<name>` that is not the repository's own package) or a fetch of the raw source of a file of this repository. The check of FR-010 finds each of them.
- **FR-003**: The root `package.json` of this repository MUST stay private (`"private": true`): it is the workspace of the development loop and is never installed by another repository. `AGENTS.md` MUST state the rule of FR-001 and the distribution of FR-004 in place of any other way of consuming commons.

## Where each package is published

- **FR-004**: A library of commons MUST be published as the table says, and the registry it names is the only place a consumer takes it from.

  | Package | `distribution` in its manifest | npm | GitHub package registry | Installed by |
  | --- | --- | --- | --- | --- |
  | A public library (every library of commons) | `["github", "npm"]` | yes | yes, the same tarball | `bun add @intellectual-frontiers/<name>@<version>` from npm, or from the GitHub registry where a mirror is wanted |
  | A private package (a package of a private repository) | `["github"]` | no | yes | a scoped `.npmrc` line and a token that reads packages |
  | A metapackage (FR-005) | `["github", "npm"]` | yes | yes | the same as a public library |

  The manifest MUST declare `distribution: ["github"]` for a private package and MUST NOT list `npm` for it, and the release MUST send it to the GitHub package registry alone. None of the libraries of commons is private: each declares `["github", "npm"]`. A published version MUST NOT be sent again with other files: a changed library is released at a new version.
- **FR-005**: Commons MUST publish five metapackages, each a library of commons with no code of its own whose manifest (`library.ts`) names `bundle`, the set it is, equal to its folder's name: `@intellectual-frontiers/commons` (folder `commons/commons`), `@intellectual-frontiers/foundation`, `@intellectual-frontiers/patterns`, `@intellectual-frontiers/programs` and `@intellectual-frontiers/standards`. A metapackage is at conformance level `L0` and has no spec kit of its own; the name `@intellectual-frontiers/commons` is also borne by the private root package, which is not published under it.
- **FR-006**: A library MUST be a member of a metapackage when its distribution names npm, it is not a metapackage and it is not held back, and the set of a role MUST be the libraries of that role in `ROLE_OF` of `commons/libraries/src/readme.ts`, the one place that gives the role of a library: `foundation` is `foundation`, `pattern` is `patterns`, `program` is `programs` and `standard` is `standards`; `commons` MUST hold every member of the four. A library with no role MUST be a problem and never a member of no set. A library that declares npm and is not ready to be installed MUST be in `HELD_BACK` of `commons/libraries/src/metapackages.ts` with the reason, and MUST leave that list when its owner releases it; the Archon library and its dialects, the package-managers kit and Toolchain are held back. The membership at the time of writing:

  | Metapackage | Members |
  | --- | --- |
  | `foundation` | `core`, `crypto`, `formats`, `githost`, `lint`, `net`, `rdf`, `system`, `telemetry`, `terminal`, `test` |
  | `patterns` | `headless`, `kanon` |
  | `programs` | `data` (the package `arcactl`, FR-009), `ergonex`, `grc`, `integrations`, `integrations-github`, `libraries`, `repoctl` |
  | `standards` | `integrations-fhir`, `integrations-x12`, `mizan`, `ontology`, `quality` |
  | `commons` | every member of the four sets |
- **FR-007**: The dependencies of a metapackage MUST be exactly its members, each package at exactly the version its manifest has in this repository (no range, no tag), and MUST be written by the generator `bun commons/libraries/src/pack-metapackage.ts` to `dependencies.auto.json` in the folder of the metapackage, never by hand; `--check` MUST write nothing and exit 1 where a file is not what the manifests make, and the generator MUST be among the generators of `repoctl sync` and of the release. One version of a metapackage therefore names one coherent set of library versions, the versions of the release it is published in.
- **FR-008**: The packer of a metapackage (`tools/pack.ts`) MUST stage a package that has `index.js` and `index.d.ts` with an empty module as its only entry, the exact dependencies of FR-007, a README (what the set holds, its install from npm and from the GitHub package registry, and the `overrides` that keep one copy of a library), the `LICENSE` made by the license generator and the SPDX identifier of the repository, MUST inspect it with the inspection of every library's package and pack it with `bun pm pack`. The release MUST list a metapackage in the release record after every member it depends on, and MUST raise its version, by at least a patch, whenever the version of any member changes or the membership changes, so that a new member version is never published without a metapackage that names it.
- **FR-009**: A manifest MAY declare `publishes`, the package it publishes where that is not `@intellectual-frontiers/<name>` (the `data` library publishes `@intellectual-frontiers/arcactl`). Where it does, the release record MUST carry that package name in each entry, the check that a version is on npm, the publication to the GitHub package registry, the comparison of the files with those npm holds, the status of `repoctl` and the dependency a metapackage has on the library MUST use it, and the tag of the release MUST stay `<name>-v<version>`.

## The hygiene check

- **FR-010**: The program `repoctl` MUST have the verb `hygiene`, which any repository can run and which reads the repository it runs in: the `package.json` files outside `node_modules`, the lockfile (`bun.lock` or `package-lock.json`), the installed tree under `node_modules`, the folders and the sources of the repository. It MUST find, each with a code that `repoctl explain <code>` explains and the path it was found at:
  - `E-HYGIENE-GIT`: a dependency by Git on this repository (FR-002);
  - `E-HYGIENE-PATH`: a `file:` or `link:` dependency into a path that has a segment named `commons` with something after it;
  - `E-HYGIENE-IMPORT`: a relative import whose path has a segment named `commons` with something after it;
  - `E-HYGIENE-VENDORED`: a folder, outside `node_modules`, that is not the root package and not a workspace the root declares, whose `package.json` is named `@intellectual-frontiers/<name>`;
  - `E-HYGIENE-DUPLICATE`: two installed copies of one `@intellectual-frontiers` package (two versions in the lockfile, or two folders of it in `node_modules`), naming the versions and where they are;
  - `E-HYGIENE-RANGE` (a warning): a dependency on an `@intellectual-frontiers` package that is not an exact version (a range, a tag or `latest`).
- **FR-011**: The core of the check MUST be a pure function of the facts it is given (the manifests, the lockfile, the installed tree, the imports), returning the findings as values, and the reading of files MUST be at the edge, through the ports of `repoctl`, so that the same facts give the same findings. It MUST read `bun.lock` and `package-lock.json` (npm lockfile versions 2 and 3), and a lockfile that cannot be read MUST fail with a finding of the environment (`E-ENVIRONMENT`) and a repository with none MUST warn with it, never a silent pass.
- **FR-012**: `repoctl hygiene` MUST end in the statuses of every verb of `repoctl` (0 where there is no failure, 1 where there is one; a warning alone MUST NOT fail), and `--json` MUST give one document: the findings with their code, level, path, message and fix, and the counts. The verb MUST be of the public tier, a read that changes nothing, and MUST be run in CI of a consuming repository.
- **FR-013**: In the repository of commons itself (where `commons/libraries/library.ts` is present) the packages under `commons/` are the repository's own: the verb MUST NOT report the `link:` dependencies of the libraries into `../` or the folders under `commons/` as `E-HYGIENE-PATH`, `E-HYGIENE-IMPORT` or `E-HYGIENE-VENDORED`, and MUST say that it is the repository of commons; the findings of Git, duplicates and ranges MUST be made there as everywhere.

## The pins

- **FR-014**: A consumer MUST pin an `@intellectual-frontiers` package at an exact version, and SHOULD pin a metapackage and take the libraries it brings, so that one release is one set; it MUST NOT hold two versions of one library in its tree, and it MAY keep one copy with `overrides` (npm, Bun) to the version of the metapackage. An upgrade is a new version of the metapackage, installed, followed by `repoctl hygiene`.
- **FR-015**: The libraries of one release MUST be those of the release record `commons/generated/release.auto.json`, published in dependency order, and a version of a library that another published package depends on MUST be on the registry before that package is.

## Planned

- **FR-016**: `ergonex init` SHOULD write the scoped GitHub-registry line of FR-001 to the `.npmrc` of a repository that has a private package, taking the token from `ERGONEX_GITHUB_TOKEN` and never from `GITHUB_TOKEN`. Planned: it needs the manifest of the workspace to say which of its packages are private, which Ergonex's own specifications (`ergonex 0001-ergonex`, `ergonex 0004-onboarding`) decide first.
- **FR-017**: `commons/docs` (the site generator and the `ifc-docs` command) MUST be published as a library, so that a consumer takes it from a registry too: it is `@intellectual-frontiers/docs`, a library in the sense of 0027-commons-libraries.

## The documents

- **FR-018**: The root `README.md` MUST have a section that says how other repositories use commons (the rule, the metapackages, the hygiene check, one install from npm and the scoped `.npmrc` of the GitHub package registry), and its generated table of the libraries MUST list the metapackages apart from the libraries. The documentation site MUST have the guide `commons/docs/guides/consuming-commons.md` for an engineer who installs commons, with one entry in `commons/docs.config.ts`.

## Acceptance scenarios

1. **Given** the manifests of this repository, **When** the generator runs, **Then** each metapackage's `dependencies.auto.json` holds exactly the members of its set at their versions, `commons` holds the members of the four others, and `--check` exits 0 and writes nothing, per FR-006 and FR-007.
2. **Given** a manifest that declares a library with no role, **When** the generator runs, **Then** it names the library and writes nothing, per FR-006.
3. **Given** a library held back, **When** the sets are made, **Then** it is in none of them, per FR-006.
4. **Given** a metapackage, **When** it is packed, **Then** the tarball holds `index.js`, `index.d.ts`, the README and the `LICENSE`, its `package.json` has the exact dependencies and passes the inspection, per FR-008.
5. **Given** a library of a set that the plan raises, **When** the plan is made, **Then** the metapackages that hold it are raised by at least a patch and come after it in the record, per FR-008.
6. **Given** the manifest of `data` that says `publishes: "@intellectual-frontiers/arcactl"`, **When** the plan, the record and the publication are made, **Then** each uses `@intellectual-frontiers/arcactl` for the registries and `data-v<version>` for the tag, per FR-009.
7. **Given** a repository whose `package.json` depends on `github:intellectual-frontiers/.github#abc`, **When** `repoctl hygiene` runs, **Then** it exits 1 with `E-HYGIENE-GIT` and the path, per FR-010.
8. **Given** a `link:../commons/core` dependency, a vendored folder `vendor/core` named `@intellectual-frontiers/core`, a relative import `../commons/core/src/mod.ts` and a lockfile with two versions of `@intellectual-frontiers/core`, **When** `repoctl hygiene` runs, **Then** it reports `E-HYGIENE-PATH`, `E-HYGIENE-VENDORED`, `E-HYGIENE-IMPORT` and `E-HYGIENE-DUPLICATE`, each at its path, per FR-010.
9. **Given** a dependency `^0.1.5` on an `@intellectual-frontiers` package and nothing else wrong, **When** `repoctl hygiene` runs, **Then** it reports `E-HYGIENE-RANGE` as a warning and exits 0, per FR-010 and FR-012.
10. **Given** `bun.lock` and `package-lock.json` of the same two copies, **When** the check reads each, **Then** it finds the same duplicate, per FR-011.
11. **Given** a repository in order, **When** `repoctl hygiene --json` runs, **Then** it prints one JSON document with no finding, per FR-012.
12. **Given** this repository, **When** `repoctl hygiene` runs in it, **Then** the packages under `commons/` and their `link:` dependencies are not findings, per FR-013.
13. **Given** the real repository, **When** the tests run, **Then** `AGENTS.md` and the README state the rule and the guide exists with its entry, per FR-003 and FR-018.

## Out of scope

- Publishing: the release (0027-commons-libraries FR-015 to FR-018, libraries 0001-libraries FR-013 to FR-015) and its confirmation by the owner.
- The credentials of a registry: a token is the host's and is never written in a repository (0031-install-locations).
- The libraries of other repositories: each repository publishes its own.

## Edge cases

- A repository that holds a folder `commons` of its own (not ours): a path or an import that goes through it is a finding where something follows the segment, and the message says what was found; the check reads a path and does not know the names of the libraries, per FR-010.
- A lockfile with one version of a package under two paths (hoisting): one copy, no finding; two versions: `E-HYGIENE-DUPLICATE`, per FR-010.
- A repository with no lockfile: the finding of the environment, and the other findings are still made, per FR-011.
- A metapackage whose set is empty: refused by the packer, per FR-008.

## Assumptions

- npm and Bun both read `overrides` of a `package.json`.
- The GitHub package registry serves the scope `@intellectual-frontiers` to a token that may read packages of the organization.

## Open questions

- None.

## Key entities

- **Metapackage** - a published package with no code whose dependencies are a set of libraries at exact versions.
- **Set** - `commons`, `foundation`, `patterns`, `programs` or `standards`.
- **Finding of hygiene** - a code, a level, a path, a message and a fix.

## Success criteria

- **SC-001**: A repository that installs `@intellectual-frontiers/commons` at one version and passes `repoctl hygiene` holds one copy of each library, all from a registry.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), or marked Planned
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
