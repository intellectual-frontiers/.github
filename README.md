<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="profile/logos/if-logo-dark-672x189-2026-Sept.png">
    <img alt="Intellectual Frontiers" src="profile/logos/if-logo-672x189-2026-Sept.png" width="336">
  </picture>
</p>

# Intellectual Frontiers — `.github`

This small public repository holds three things:

- **The organization's landing page**, [`profile/README.md`](profile/README.md), which GitHub shows at <https://github.com/intellectual-frontiers>.
- **The machine setup scripts**, in [`bin/`](bin/): `erga-bootstrap.sh` turns a fresh Linux computer (under WSL or a virtual machine), or a Mac with Apple silicon,
  into a working place for `erga`, the company's repository (it is the one script that may use administrator rights, and it sets up the account that runs it), and
  `erga-setup.sh` sets up one account without administrator rights: it installs Rust through `rustup`, signs you in to GitHub, copies the private `erga` repository
  and hands over to `./erga doctor`. They are public so that a brand-new computer can fetch them before it can sign in to anything. What they do is specified in
  `erga`'s `009-machine-bootstrap` and tested in [`tests/`](tests/).

- **[`commons/`](commons/README.md)**, what any company or harness of Intellectual Frontiers may use: today the software supply chain capability, a packaging ontology of the package managers and
  system families of every computer, and the tables made from it (with the pinned downloads, such as `rustup-init` and `uv`) that the scripts and `erga` read.

Everything else, its specifications and everything it builds live in the private `erga` repository. The setup instructions are in that repository's README and
`docs/getting-started.md`, which the people who may run the scripts can read.

## Tests

`python3 -m unittest discover -s tests` runs them with the standard library alone (`shellcheck` is used where it is installed); the tests of `commons`' generator also use `uv` and are skipped without it; nothing here needs `erga` or the network. A GitHub Actions workflow runs them on every push.
