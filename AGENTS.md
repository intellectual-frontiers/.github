# `.github` — agent entry point

This repository is small on purpose: the organization's public profile (`profile/`), the machine setup (`bin/`: two bootstraps that only get Deno, and the setup in TypeScript under `bin/setup/`), `commons/` and the tests
(`tests/`). `commons/` holds what any company or harness of Intellectual Frontiers may use, with its own ontology, specifications and generated tables (see `commons/README.md`); a capability goes there when more than one harness should read the same facts. Its specifications are in `commons/spec-kit/`, not in a company's repository. The scripts' specification is `009-machine-bootstrap` in `erga`, the company's private monorepo, like every other specification of erga. Everything else (erga itself, its specifications, ontology and content) is in the private `erga` repository; do not add any of it here.

- Work spec first: change `009-machine-bootstrap` in `erga`, then the scripts, then the tests. Every requirement has a test or says why it has none.
- Run `deno test -A` and `python3 -m unittest discover -s tests` before you push (`.github/workflows/tests.yml` runs both on every push and pull request, and `deno check`, `deno lint`
  and `deno fmt --check` on `bin/setup/` and `tests/`). Deno is the pinned one: `sh bin/erga-bootstrap.sh --help` puts it in `~/.local/share/erga/toolchain/deno/<version>/<platform>/`.
  The commons tests need only the standard library (the generator's own tests also need `uv`, and are skipped without it), and a test fails if a new top-level entry appears.
- A file under `commons/generated/` is generated (`uv run commons/tools/generate-packaging.py`): change the ontology under `commons/ontology/`, never the file, and run the tool before you push; a
  test fails where it is stale. The tool also writes `commons/generated/packaging.auto.ts`, the typed table the setup imports, and the Deno pins between the marked lines of
  `bin/erga-bootstrap.sh` and `bin/erga-bootstrap.ps1`. Commons specs are worked spec first, like every other (`commons/spec-kit/`).
- Everything after Deno is TypeScript: no new shell or PowerShell beyond the two bootstraps (`bin/erga-bootstrap.sh`, POSIX `sh`, about a hundred lines, run from a pipe; and
  `bin/erga-bootstrap.ps1`), which fetch the pinned Deno, check its SHA-256, keep it in erga's toolchain store and run `bin/setup/main.ts` with explicit permissions. `erga-setup.sh` and
  `erga-windows.ps1` are stubs kept for the lines documented before. The setup (`bin/setup/`) is strongly typed: options parsed once at the boundary, discriminated unions with an
  exhaustive `switch` (`assertNever`), errors as values (`Result`, and a `Stop` that is the exit status), no `any`, no non-null `!`, no third-party module (the tests use `jsr:@std/assert`,
  pinned in `deno.json`). It uses administrator rights only for the packages (in bootstrap mode, never with `--setup`), installs Rust through `rustup` (the clone's
  `rust-toolchain.toml` names the stable channel), copies `intellectual-frontiers/erga` to `~/workspaces/github.com/intellectual-frontiers/erga` and runs only commands `erga` has.
  It writes no startup file: `ergactl agent-tools shell emit` gives the one optional line (erga's 010-shell), and the settings file it keeps must stay what `ergactl secrets` writes
  (erga's 011-secrets).
- Never put a secret, a token or a person's data in this repository: it is public.

Every commit's author and committer is Shahid Shah <shahid@shah.org> unless a person expressly authorizes an agent to be the author of that commit in its message; an agent's part is a
`Co-Authored-By` trailer.
