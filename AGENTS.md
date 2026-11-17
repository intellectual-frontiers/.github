# `.github` — agent entry point

This repository is small on purpose: the organization's public profile (`profile/`), the machine setup (`bin/`: the two one-command installers of agora, `agora-install.sh` and `agora-install.ps1`, which sign GitHub CLI in, copy `erga` and run the installer in it), `commons/` and the tests
(`tests/`). `commons/` holds what any company or harness of Intellectual Frontiers may use, with its own ontology, specifications and generated tables (see `commons/about.ts`, and the site at <https://intellectual-frontiers.github.io/.github/>); a capability goes there when more than one harness should read the same facts. Its specifications are in `commons/spec-kit/`, not in a company's repository. The installers' specification is `274-agora` (FR-096) in `erga`, the company's private monorepo, like every other specification of erga. Everything else (erga itself, its specifications, ontology and content) is in the private `erga` repository; do not add any of it here.

- Work spec first: change the specification (`274-agora` in `erga` for the installers, `commons/spec-kit/` for commons), then the code, then the tests. Every requirement has a test or says why it has none.
- Bun is the default TypeScript 7 runtime and Node 26 the backup (commons 0005-typescript-runtime). Every program and every test is TypeScript, and a test is `<kebab-case>.test.ts` on IFC TypeScript (`commons/ts/runtime/test.ts`, `proves`), found by `bun test` and `node --test` with no configuration.
  A test runs the real programs: real `git`, real `sh`, the real tools, never a stand-in for Git or GitHub CLI (a remote is a real temporary repository); what needs an account, a browser or administrator rights is left untested, and the header of the test says so.
  Before you push, in `commons/ts` run `bun run check` (TypeScript 7 on IFC TypeScript, on commons' tools and ontology, and on this repository's tests), `bun fmt --check . ../tools ../../tests` and the linter as `.github/workflows/tests.yml` runs it; at the root run
  `bun test ./tests/` and `node --test "tests/*.test.ts"`, `bun commons/tools/generate-packaging.ts --check` and `bun commons/tools/mizan-check.ts`. `.github/workflows/tests.yml` runs all of them on every push and pull request. A test fails if a new top-level entry appears in the repository.
- A file under `commons/generated/` is generated (`bun commons/tools/generate-packaging.ts`): change the ontology under `commons/ontology/`, never the file, and run the tool before you push; a
  test fails where it is stale. Commons specs are worked spec first, like every other (`commons/spec-kit/`).
- Commons' tools (`commons/tools/`) are strongly typed TypeScript on Bun and Node 26: options parsed once at the boundary, discriminated unions with an exhaustive `switch` (`default: return absurd(x)`), errors as values (`Result`), no `any`, no non-null `!`,
  and the one cast is `brand` in `core.ts`; the typing test checks it. The ontology is TypeScript (`commons/ontology/`, commons 0012-ontology, typed by the kernel's `commons/ts/kernel/rdf.ts`; Turtle is generated, never a source), decoded once (`ontology.ts`) from its typed
  values into typed records, and findings are a union with one sentence each. The tools import nothing outside `commons/tools/` but the ontology, the kernel's TOML reader and two built-ins of `node:`, and erga runs the specification checker as `bun commons/tools/mizan-check.ts`.
- `commons/ts/data/` holds IFC SQL Aide and the libraries that accept it, Arca and Data Vault (commons 0009-sql-aide), built on IFC TypeScript's kernel (`commons/ts/`,
  commons 0005-typescript-runtime) and held to its rules. Work spec first there too, and in `commons/ts/data` run `bun run verify` (the TypeScript 7 compiler, the
  documentation maps, every test under Bun) and `bun run test:node` before you push; `(cd commons/ts && bun fmt --check)` covers its files. Its package has no `dependencies`;
  a library built with SQL Aide imports `sql-aide/mod.ts` alone; everything is configured in TypeScript, never in YAML, XML or JSON; every exported declaration carries a
  TSDoc comment, which is also what the SQL documentation says (`bun run docs` writes the maps again); and what a model emits is committed under `suite/**/golden/`, so that a
  change shows as a diff of SQL.
- Commons is consumed as a Git dependency, never as a release (commons 0005-typescript-runtime FR-029, FR-070): the root `package.json` is the package
  `@intellectual-frontiers/commons`, which another repository adds at a commit (`bun add github:intellectual-frontiers/.github#<commit>`, its `bun.lock` then holds the
  commit) and imports from its `.ts` sources (`@intellectual-frontiers/commons/ts/kernel`, `.../ts/runtime`, `.../docs`, the commands `ifc` and `ifc-docs`); Bun runs them
  as they are, Node 26 with `--import @intellectual-frontiers/commons/ts/node`. Make no GitHub release, tarball or build for it. `commons/ts/package.json` and
  `commons/docs/package.json` bear the same name for their own development; keep the root's `exports` and `dependencies` in step with them (the tests check it), and
  run `bun run smoke` in `commons/ts` and in `commons/docs` (the committed `HEAD` installed by `git+file:`, then used on Bun and Node 26) when the package changes.
- Documentation is the code's (commons 0011-documentation): `commons/docs/` is the generator of the site published on GitHub Pages, part of that package
  (`./docs`, `ifc-docs`) so that other repositories build their sites with it; it reads
  only the TypeScript and the spec kit a repository's `docs.config.ts` names (commons' is `commons/docs.config.ts`, with its lenses in `commons/docs/lens/`). Commons keeps no README. A module's documentation is its TSDoc: the module comment says what it is, `@remarks` the longer account, `@limits` what it
  does not do; an area's typed facts (folders and what each may import, commands, rules, phases, examples) are its `about.ts`. When you change code, change its
  documentation in the same commit, in the module it is about. In `commons/docs` run `bun run verify` (the compiler, the tests, `check` on commons) before you push,
  and `bun run smoke` when the package changes; `bun main.ts build --out ../../_site` builds the
  site, which is never committed. The root `README.md` stays a short overview of Mizan's tenets and a pointer to the site, kept by hand; `MIZAN.html` is the one self-contained strategy and implementation document of Mizan (embedded CSS, no external resource), kept by hand in step with `commons/spec-kit/`.
- Never put a secret, a token or a person's data in this repository: it is public.

Every commit's author and committer is Shahid Shah <shahid@shah.org> unless a person expressly authorizes an agent to be the author of that commit in its message; an agent's part is a
`Co-Authored-By` trailer.
