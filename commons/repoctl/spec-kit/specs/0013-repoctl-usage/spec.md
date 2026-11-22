# Feature Specification: What a consumer uses of the package

**Spec ID:** 0013-repoctl-usage
**Status:** Active
**Owner:** if
**Domain:** repoctl

**Input:** The package `@intellectual-frontiers/commons` holds every library of commons, and a repository that installs it uses some of them. What a consumer imports, what those libraries reach through their own imports and what it never touches is a question of its files, and a person who guesses answers it badly (commons 0036-distribution FR-034). `repoctl usage` reads it from the consumer's own sources and from the sources of the installed package.

## What is read

- **FR-001**: `repoctl usage` MUST read the specifiers of the form `@intellectual-frontiers/commons/<library>[/<subpath>]` in the code files of the repository it is run on (`.ts`, `.tsx`, `.mts`, `.js`, `.mjs`, `.cjs`, `.json5`, leaving out `node_modules`, `.git` and `build`), and MUST give for each library the subpaths imported and the number of files that import it; a specifier that names no library of the package (a bare `@intellectual-frontiers/commons`) MUST be left out.
- **FR-002**: It MUST read the libraries of the installed package from its sources (`<package>/<library>/src/**/*.ts` and what else a library carries beside them), the package being `node_modules/@intellectual-frontiers/commons` of the repository or the folder `--package` names, and MUST derive from them the imports of each library of another library of the package, the files of each and its size in bytes; a repository where the package is not installed MUST end with an environment problem that says where it looked and how to name the folder.

## What is answered

- **FR-003**: The answer MUST be pure data of the two inputs (the imports of the consumer and the graph of the package) and MUST list: the libraries the repository imports directly with their subpaths; the libraries it reaches only through the imports of those (each with the library through which it is reached first); the libraries it never touches; and, for the package and for each of the three groups, the number of libraries and the bytes.
- **FR-004**: The answer MUST be the same for the same inputs, in the order of the names of the libraries, and MUST be given as a table and, with `--json`, as one JSON document; a library the repository imports that the package does not hold MUST be a finding (`E-USAGE-UNKNOWN`) and MUST NOT be counted.
- **FR-005**: `repoctl usage` MUST be a verb of the public tier that only reads: it changes no file, and it ends with 0 where it answered.

## Out of scope

- What a consumer uses of a library below its subpath (a function, a type), the size of what an installed package adds of its dependencies, and any consumer repository other than the one it is run on.

## Edge cases

- A library the repository imports by a subpath the library does not export: counted as imported, the subpath is listed as written.
- A library reached by two paths: the library through which it is first reached, in the order of the names, is the one named.
- A file that is not text: it counts its bytes and imports nothing.

## Assumptions

- The sources of the package, `src/` of each library, hold the imports of the library, which is how the package is made (commons 0036-distribution FR-030).

## Open questions

- None.

## Key entities

- **Consumer import**: a library of the package and a subpath, and the file that imports it.
- **Graph**: each library of the package with the libraries its sources import, its files and its bytes.

## Success criteria

- Run on erga with the package installed, it reproduces the analysis made by hand: the libraries imported directly, those reached through them and those never touched, with their bytes.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
