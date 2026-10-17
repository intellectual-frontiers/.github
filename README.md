<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="profile/logos/if-logo-dark-672x189-2026-Sept.png">
    <img alt="Intellectual Frontiers" src="profile/logos/if-logo-672x189-2026-Sept.png" width="336">
  </picture>
</p>

# Intellectual Frontiers — `.github`

This small public repository holds three things:

- **The organization's landing page**, [`profile/README.md`](profile/README.md), which GitHub shows at <https://github.com/intellectual-frontiers>.
- **The machine setup scripts**, in [`bin/`](bin/): `archon-bootstrap.sh` turns a fresh Linux computer (under WSL or a virtual machine) into a working
  place for the Intellectual Frontiers AI Workforce® Harness (it is the one script that may use administrator rights, and it sets up the account that runs it), and `archon-setup.sh` sets up one account without
  administrator rights: it signs you in to GitHub and copies the private `archon` repository. They are public so that
  a brand-new computer can fetch them before it can sign in to anything. What they do is specified in `archon`'s `0136-machine-bootstrap` and tested in
  [`tests/`](tests/).

- **[`commons/`](commons/README.md)**, what any company or harness of Intellectual Frontiers may use: today the software supply chain capability, a packaging ontology of the package managers and
  system families of every computer, and the tables made from it that the scripts and `archon` read.

The harness itself, its specifications, its ontology and everything it builds live in the private `archon` repository. The setup instructions are in that repository's README,
which the people who may run the script can read.

## Tests

`python3 -m unittest discover -s tests` runs them with the standard library alone (`shellcheck` is used where it is installed); the tests of `commons`' generator also use `uv` and are skipped without it; nothing here needs `archon` or the network. A GitHub Actions workflow runs them on every push.
