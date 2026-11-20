# Feature Specification: TypeScript practice

**Spec ID:** 0005-typescript-practice
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** How the TypeScript of commons is written, checked and run, the same for every library: TypeScript 7 only, Bun the default runtime and Node 26 the backup, a strict compiler configuration shared by every library, no vendor's API and no registry import in the code, documentation in the code, exact pins, and Bun as the one tool beside the compiler. What each library does is its own specification; this one is what they share. The code is new: it carries no name, shape or alias for an older caller's sake.

## The language and the runtimes

- **FR-001**: Every program, library, tool and test of commons MUST be TypeScript 7 or later, MUST run on Bun, the default runtime, and on Node 26, the backup and the least Node that commons supports, and each package MUST say `"type": "module"` and `"engines": { "node": ">=26" }`; the sources MUST be erasable TypeScript only, so that Node 26 runs the `.ts` files of this repository as they are, by stripping their types, and a library installed from npm runs from its compiled modules.
- **FR-004**: No code of commons MUST name a member of a vendor's global (`Bun.*` and the others the lint rule `no-vendor-api` lists), import from `jsr:`, `npm:`, `@std/` or a URL, or depend on a package at run time that is not a library of commons or a package a library declares. With `types: ["node"]`, a reference to a vendor's global is also a compile error.
- **FR-015**: Every file of a library's `src/`, and every file of its `suite/`, MUST begin with a TSDoc block that says `@module`, and every declaration a file of `src/` exports MUST carry TSDoc, so that a harness that requires documentation (Stolos) can take the code as it is.

## The tools and their settings

- **FR-016**: The development dependencies of the root and of each library MUST be pinned to exact versions, with Bun's text lockfile `bun.lock` beside the root's `package.json`, installed with `bun install --frozen-lockfile`; a package of commons MUST be a `link:` dependency in this repository.
- **FR-017**: TypeScript 7 (`tsc`) MUST be the type-checking authority: `tsc -p tsconfig.json` MUST pass on every library, and `tsc -p tests/tsconfig.json` and `tsc -p commons/tools/tsconfig.json` on the tests of the root and on the tools, each configuration extending `commons/tsconfig.base.json`, which MUST set `strict`, `module: nodenext`, `noEmit`, `allowImportingTsExtensions`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `isolatedModules`, `types: ["node"]`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `noUnusedLocals` and `noUnusedParameters`.
- **FR-018**: CI MUST run the `verify` and the tests of every library a push or a pull request affects on Bun, the pinned version and the default runtime, and on Node 26, the backup, on Linux and, for a library that has code of its own for them, on macOS and Windows; a test that cannot apply to one platform (file modes, symbolic links, POSIX signals on Windows) MUST say so in its code and still run the rest.
- **FR-026**: Bun MUST be the one tool binary beside TypeScript 7: it installs the development dependencies, formats, lints and runs the tests. It MUST be pinned in commons' pins (`BUN_VERSION`, with its SHA-256 on every platform, commons 0002-packaging FR-014) and CI MUST use that version. No other formatter, linter, test framework or package manager (npm, Prettier, ESLint, dprint, Vitest) MUST be a dependency of any package of commons; Node 26 is a runtime the code is tested on, not a tool it needs.
- **FR-027**: `bun fmt --check` MUST pass on the tools and the tests of the root, with the settings of the root `bunfig.toml`'s `[fmt]` section.
- **FR-028**: `bun lint --type-aware --max-warnings 0` MUST pass on the tools and the tests of the root, with the settings of the root `bunfig.toml`'s `[lint]` section, which MUST make errors of at least: `no-explicit-any`, `no-non-null-assertion`, `explicit-module-boundary-types`, `switch-exhaustiveness-check`, `no-floating-promises`, `no-misused-promises`, `consistent-type-imports`, `only-throw-error`, `no-unnecessary-type-assertion`, `ban-ts-comment` (a `@ts-expect-error` allowed only with its reason) and `eqeqeq`, and the rules of the plugin of the library `lint`. Until a released Bun has `bun lint`, CI MUST run it with one exact canary version, named in the workflow, and move to the release that has it.

## The boundaries of a library

- **FR-076**: A library's own modules MUST import one another by the library's package name through the `exports` of its `package.json`, one entry for each public surface (a package names itself); a file that `exports` does not name MUST NOT be importable by that name, on Node, on Bun and for the compiler, so that `exports` is the boundary of the library's public surface.
- **FR-077**: The layers check of Mizan (`@intellectual-frontiers/mizan/layers`, 0015-trace FR-010) reads relative imports only, so an import by package name is never a finding; a library that imports its own layers by package name MUST check their order itself, by resolving each specifier through the `exports` of its package.

## Out of scope

- What a library does: its own specification, in its own `spec-kit/`.
- How a library reaches another repository: 0036-distribution.
- Foreign functions (Stolos's PAM binding): they stay in the harness behind its own interface.

## Edge cases

- A dependency written `^7.0.2`: the test of FR-016 names it.
- A file whose lines are not as `bun fmt` writes them: the format check fails, per FR-027.
- `const x: any`, `value!.field` or a `switch` that misses a member of a union with no `default`: the linter fails, per FR-028.
- A vendor global's member named in a TSDoc comment: comments are not code and are allowed, per FR-004.
- A file that starts with no TSDoc block, or an export with none: the test of FR-015 names the file and line.
- A library whose `tsconfig.json` does not extend `commons/tsconfig.base.json`: the test of FR-017 names it.
- `import "@intellectual-frontiers/data/engine/internal"` where `exports` names `./engine` only: refused on Node, Bun and by the compiler, per FR-076.
- A file of rung 1 that imports a file of rung 5 by package name: no finding of `layers/above`, the library's own check finds it, per FR-077.

## Assumptions

- Node 26 and Bun 1.4 each implement `node:fs`, `node:child_process`, `node:http`, `node:test` and `node:assert/strict` well enough for the suites; where one does not, the suite shows it and the gap is written here before it is worked around.
- Node 26 strips the types of a `.ts` file that is not under `node_modules`, so the sources of this repository run on it as they are.

## Open questions

- **OQ-1**: Whether `bun check` (Bun's own TypeScript 7 checker) can replace `tsc` in CI once both are shown to report the same errors here; until then `tsc` 7 is the authority (FR-017).

## Key entities

- **Base configuration** - `commons/tsconfig.base.json`, the strict compiler options every package of commons extends.
- **Proof** - a test named for the requirements it proves.

## Success criteria

- **SC-001**: `bun run repoctl check` runs `tsc` 7 on the tests of the root and on the tools, and each library's `bun run verify` runs it on the library, with no error.
- **SC-002**: Every requirement of this specification is proven by a test named for it, or by the CI job that runs it.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
