# Add a library

A library is a folder of `commons/` that declares itself; registering one is adding the folder ([commons 0027-commons-libraries](../../spec-kit/specs/0027-commons-libraries/spec.md)).

1. Make `commons/<name>/` with a `package.json` (its name is `@intellectual-frontiers/<name>`, its `exports` point at the sources), a `tsconfig.json` and `src/`, with tests in `suite/`.
2. Write the manifest `library.ts`: the name, the conformance level, the spec kit, the `verify` command, the version, the distribution and the exports. If the library is built in layers, add its `kanon` table.
3. Write `about.ts`: what the library is, its folders and what each may import, its commands and its rules.
4. Start its spec kit: `spec-kit/registry.tsv`, `spec-kit/enforcement.tsv` and the first specification, `0001-<name>`, with numbered requirements.
5. Write the tests that prove each requirement, each naming it with `proves([...])`, and make `bun run verify` pass in the folder.
6. Run `bun commons/libraries/src/libraries.ts`: it writes the one requirement that commons keeps for the library and its row of the register, from the manifest.

This site picks the library up by itself: it has a page, an API reference for every export and its specifications as soon as it has a manifest, a `package.json` and an `about.ts`, and the build fails where an export has no description.

The library is then proved by what its changes reach, not by everything: its own suite when a change stays inside it, its importers' seam tests when a public symbol changes, and a tarball when its `exports` change. Put each test where it belongs and read the plan with `bun run repoctl prove --why` ([proof by blast radius](proof-by-blast-radius.md)).
