# `.github` — agent entry point

This repository is small on purpose: the organization's public profile (`profile/`), the machine setup (`bin/`: two bootstraps that only get Deno, and the setup in TypeScript under `bin/setup/`), `commons/` and the tests
(`tests/`). `commons/` holds what any company or harness of Intellectual Frontiers may use, with its own ontology, specifications and generated tables (see `commons/about.ts`, and the site at <https://intellectual-frontiers.github.io/.github/>); a capability goes there when more than one harness should read the same facts. Its specifications are in `commons/spec-kit/`, not in a company's repository. The scripts' specification is `009-machine-bootstrap` in `erga`, the company's private monorepo, like every other specification of erga. Everything else (erga itself, its specifications, ontology and content) is in the private `erga` repository; do not add any of it here.

- Work spec first: change `009-machine-bootstrap` in `erga`, then the scripts, then the tests. Every requirement has a test or says why it has none.
- Run `deno test -A` before you push (`.github/workflows/tests.yml` runs it on every push and pull request, with `deno check`, `deno lint` and `deno fmt --check` on `bin/setup/`,
  `commons/tools/` and `tests/`, and commons' `--check`). The setup, commons' tools and every test are TypeScript; the one line of Python left is the bootstrap's last way to unzip Deno on a computer with nothing else (erga's 009-machine-bootstrap). Deno is the pinned one: `sh bin/erga-bootstrap.sh --help` puts it in `~/.local/share/erga/toolchain/deno/<version>/<platform>/`.
  The tests need nothing but Deno and the `jsr:@std` modules pinned in `deno.json`, and a test fails if a new top-level entry appears.
- A file under `commons/generated/` is generated (`deno run --allow-read --allow-write commons/tools/generate-packaging.ts`): change the ontology under `commons/ontology/`, never the file, and run the tool before you push; a
  test fails where it is stale. The tool also writes `commons/generated/packaging.auto.ts`, the typed table the setup imports, and the Deno pins between the marked lines of
  `bin/erga-bootstrap.sh` and `bin/erga-bootstrap.ps1`. Commons specs are worked spec first, like every other (`commons/spec-kit/`).
- Everything after Deno is TypeScript: no new shell or PowerShell beyond the two bootstraps (`bin/erga-bootstrap.sh`, POSIX `sh`, about a hundred lines, run from a pipe; and
  `bin/erga-bootstrap.ps1`), which fetch the pinned Deno, check its SHA-256, keep it in erga's toolchain store and run `bin/setup/main.ts` with explicit permissions. `erga-setup.sh` and
  `erga-windows.ps1` are stubs kept for the lines documented before. The setup (`bin/setup/`) is strongly typed: options parsed once at the boundary, discriminated unions with an
  exhaustive `switch` (`assertNever`), errors as values (`Result`, and a `Stop` that is the exit status), no `any`, no non-null `!`, no third-party module (the tests use `jsr:@std/assert`,
  pinned in `deno.json`). Commons' tools (`commons/tools/`) are held to the same, and the typing test checks both: the ontology is decoded once (`ontology.ts`, over the strict Turtle
  reader `turtle.ts`) into typed records, findings are a union with one sentence each, and the one cast is `brand` in `core.ts`; they import nothing outside `commons/tools/` but
  `@std/toml` (the shell portability tool), and erga runs the specification checker as `deno run --no-config --allow-read commons/tools/spec-kit-check.ts`. It uses administrator rights only for the packages (in bootstrap mode, never with `--setup`), installs Rust through `rustup` (the clone's
  `rust-toolchain.toml` names the stable channel), copies `intellectual-frontiers/erga` to `~/workspaces/github.com/intellectual-frontiers/erga` and runs only commands `erga` has.
  It writes no startup file: `ergactl agent-tools shell emit` gives the one optional line (erga's 010-shell), and the settings file it keeps must stay what `ergactl secrets` writes
  (erga's 011-secrets).
- `commons/ts/data/` holds IFC SQL Aide and the libraries that accept it, Arca and Data Vault (commons 0009-sql-aide), built on IFC TypeScript's kernel (`commons/ts/`,
  commons 0005-typescript-runtime) and held to its rules. Work spec first there too, and in `commons/ts/data` run `bun run verify` (the TypeScript 7 compiler, the
  documentation maps, every test under Bun) and `bun run test:node` before you push; `(cd commons/ts && bun fmt --check)` covers its files. Its package has no `dependencies`;
  a library built with SQL Aide imports `sql-aide/mod.ts` alone; everything is configured in TypeScript, never in YAML, XML or JSON; every exported declaration carries a
  TSDoc comment, which is also what the SQL documentation says (`bun run docs` writes the maps again); and what a model emits is committed under `suite/**/golden/`, so that a
  change shows as a diff of SQL.
- Documentation is the code's (commons 0011-documentation): `commons/docs/` is the generator of the site published on GitHub Pages, released as
  `@intellectual-frontiers/ifc-docs` (tag `ifc-docs-vX.Y.Z`, `.github/workflows/ifc-docs-release.yml`) so that other repositories build their sites with it; it reads
  only the TypeScript and the spec kit a repository's `docs.config.ts` names (commons' is `commons/docs.config.ts`, with its lenses in `commons/docs/lens/`). Commons keeps no README. A module's documentation is its TSDoc: the module comment says what it is, `@remarks` the longer account, `@limits` what it
  does not do; an area's typed facts (folders and what each may import, commands, rules, phases, examples) are its `about.ts`. When you change code, change its
  documentation in the same commit, in the module it is about. In `commons/docs` run `bun run verify` (the compiler, the tests, `check` on commons) before you push,
  and `bun run pack` then `bun run smoke dist/<tarball>` (Bun and Node 26 on a fixture repository) when the package changes; `bun main.ts build --out ../../_site` builds the
  site, which is never committed. The root `README.md` stays a short pointer to the site, kept by hand.
- Never put a secret, a token or a person's data in this repository: it is public.

Every commit's author and committer is Shahid Shah <shahid@shah.org> unless a person expressly authorizes an agent to be the author of that commit in its message; an agent's part is a
`Co-Authored-By` trailer.
