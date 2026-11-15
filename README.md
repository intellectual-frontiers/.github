<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="profile/logos/if-logo-dark-672x189-2026-Sept.png">
    <img alt="Intellectual Frontiers" src="profile/logos/if-logo-672x189-2026-Sept.png" width="336">
  </picture>
</p>

# Intellectual Frontiers — `.github`

This small public repository holds three things:

- **The organization's landing page**, [`profile/README.md`](profile/README.md), which GitHub shows at <https://github.com/intellectual-frontiers>.
- **The machine setup**, in [`bin/`](bin/): two small bootstraps that only get Deno, `erga-bootstrap.sh` (Linux, under WSL or in a virtual machine, and a Mac with Apple silicon) and
  `erga-bootstrap.ps1` (Windows), and the setup they hand over to, which is TypeScript ([`bin/setup/`](bin/setup/), run by the pinned Deno). On Linux and a Mac it turns a fresh
  computer into a working place for `erga`, the company's repository: the packages it needs (the one step with administrator rights), the GitHub sign-in, Rust through `rustup`
  (for Thyra and ArcaDrive), the copy of the private `erga` repository made ready with its `bin/setup.sh`, and `./ergactl doctor` last; `--setup` sets up one account alone, without
  administrator rights. On Windows it installs WSL 2 and Debian, makes the Linux user and runs the same bootstrap inside (erga does not run natively on Windows yet). They are public so
  that a brand-new computer can fetch them before it can sign in to anything; `erga-setup.sh` and `erga-windows.ps1` remain only so that the lines documented before keep working.
  What they do is specified in `erga`'s `009-machine-bootstrap` and tested in [`tests/`](tests/).

- **[`commons/`](commons/README.md)**, what any company or harness of Intellectual Frontiers may use: today the software supply chain capability, a packaging ontology of the package managers and
  system families of every computer, and the tables made from it (with the pinned downloads, such as Deno, `rustup-init` and `uv`) that the setup and `erga` read.

Everything else, its specifications and everything it builds live in the private `erga` repository. The setup instructions are in the "Get started" section of that repository's README, which
the people who may run the scripts can read.

## Tests

`deno test -A` runs the setup's tests (temporary home folders, stand-ins for the programs on the `PATH` and local stand-ins for the network; nothing needs root, `erga`, `ergactl` or
the network but Deno's test library from jsr.io), and the tests of `commons` (its generator, run on copies of the ontology that break each rule, and its checkers), which are TypeScript too. A GitHub Actions workflow runs them on Linux and on Arch Linux, and the Windows side on Windows, getting Deno through the bootstraps
themselves.
