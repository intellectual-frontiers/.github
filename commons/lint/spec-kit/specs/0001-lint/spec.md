# Feature Specification: Lint

**Spec ID:** 0001-lint
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** A harness holds its code to the rules of Intellectual Frontiers with `bun lint`, which loads an ESLint plugin from a path or a package: the rules every harness wants (no vendor API outside a list of files with their reasons, no registry or URL import, a relative import that stays in its package, a module block in every file, `absurd` in every switch over a union, no write to the terminal outside a list), the typed way to define a rule of its own, and the way to prove a rule against the real linter. The same plugin is used by commons and by the repositories that depend on it.

## The plugin

- **FR-001**: The library MUST give a lint plugin in the ESLint plugin format, named `ifc`, which `bun lint --plugin` loads from its source (TypeScript, with no build) or from the compiled module of the published package, with the rules `no-vendor-api`, `no-registry-import`, `import-boundary`, `module-doc`, `switch-absurd` and `terminal-writers`, each with a description, no schema and a `create` function.
- **FR-002**: The library MUST give `defineRule`, the typed way to define a rule: it decodes the rule's options once, with the decoders of `core`, and IF the options do not decode, THEN it MUST report that at the first line of each file, naming the rule and what is wrong, and MUST NOT run the rule; so that a harness keeps its own lists and adds its own rules, as a plugin of its own that `bun lint --plugin` loads.

## The rules

- **FR-003**: `no-vendor-api` MUST refuse a member of a vendor's global (`Deno.*` and `Bun.*` by default, or the names its option `globals` gives), in code and in types, outside the files its option `allow` lists, each with a reason that is not blank.
- **FR-004**: `no-registry-import` MUST refuse a module specifier that names a registry or a URL (`npm:`, `jsr:`, `https:` and `http:` by default, or the prefixes its option `prefixes` gives), in an `import`, an `export ... from`, a dynamic `import()` and an `import()` type; a bare name, a `node:` module and a relative path MUST pass.
- **FR-005**: `import-boundary` MUST refuse a relative import that leaves the package it is in, the packages being the folders its option `roots` names (a pattern such as `packages/*` names each of its folders); an import inside the package, and a file that is in no package, MUST pass.
- **FR-006**: `module-doc` MUST refuse a file that does not begin with a JSDoc block (`/** ... */`) that says `@module`; a shebang line MAY come first.
- **FR-007**: `switch-absurd` MUST refuse a `switch` over a union, on its discriminant (`x.kind` by default, or the names its option `discriminants` gives), that does not end in a `default` that calls `absurd` (or the functions its option `functions` names); its option `every` MUST hold every `switch` to it.
- **FR-008**: `terminal-writers` MUST refuse a write to the terminal (`process.stdout`, `process.stderr`, `console` and a vendor's streams, or the writers its option `writers` names) outside the files its option `allow` lists, each with a reason that is not blank.

## Testing a rule

- **FR-009**: The library MUST give `lintFiles`, which writes files to a new folder, runs the real linter over them with the plugin loaded by `--plugin` and only one rule turned on by `--rule`, and gives the problems of the linter's JSON report, decoded; the linter MUST be the Bun named by `IFC_LINT_BUN`, or else the pinned canary (`bun x --no-install bun@<version>`), and where it is not installed `linter()` MUST say so, so that a test is skipped with that reason and not failed.

## The package

- **FR-010**: The library MUST be published to npm as compiled modules with their declarations, one entry for the plugin (`.`), one for the typed way to define a rule (`./rule`) and one for the way to test a rule (`./test-rule`), and `bun lint --plugin` MUST load the installed package's plugin and run its rules.

## Acceptance scenarios

1. **Given** the plugin loaded by `bun lint --plugin`, **When** a file uses a vendor global outside the allowed files, **Then** the linter reports it at its line, per FR-003.
2. **Given** a rule whose options do not decode, **When** the linter runs, **Then** it reports the options and runs no rule, per FR-002.
3. **Given** a harness with its own plugin made with `defineRule`, **When** `bun lint` loads it, **Then** its rule runs, per FR-002.
4. **Given** the package installed in an empty project, **When** `bun lint --plugin` loads it, **Then** the rules run, per FR-010.

## Out of scope

- The settings of `bunfig.toml`'s `[lint]` section and the version of the canary: the harness's, with the pins of commons (commons 0005-typescript-practice FR-026 to FR-028).

## Edge cases

- A file in no package for `import-boundary`: passes, per FR-005.
- A blank reason in an `allow` list: the options do not decode, per FR-002.
- The pinned canary not installed: the tests that need it are skipped with the reason, per FR-009.

## Assumptions

- Bun's `lint` runs JavaScript plugins in ESLint's format.

## Open questions

- None.

## Key entities

- **Plugin** - the ESLint plugin `ifc` and its rules.
- **Rule** - a check of code with options that it takes from its setting.
- **Allow list** - the files a rule does not apply to, each with its reason.

## Success criteria

- **SC-001**: A harness adopts the rules of Intellectual Frontiers with one line of `bunfig.toml`.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
