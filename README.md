<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="profile/logos/if-logo-dark-672x189-2026-Sept.png">
    <img alt="Intellectual Frontiers" src="profile/logos/if-logo-672x189-2026-Sept.png" width="336">
  </picture>
</p>

# Intellectual Frontiers — `.github`

This small public repository holds two things:

- **The organization's landing page**, [`profile/README.md`](profile/README.md), which GitHub shows at <https://github.com/intellectual-frontiers>.
- **The machine setup scripts**, in [`bin/`](bin/): `archon-bootstrap.sh` turns a fresh Debian computer (under WSL or a virtual machine) into a working
  place for the Intellectual Frontiers AI Workforce® Harness (it is the one script that may use administrator rights, and it can make an account for `archon`), and `archon-setup.sh` sets up one Linux account without
  administrator rights: it signs you in to GitHub and copies the private `archon` repository. They are public so that
  a brand-new computer can fetch them before it can sign in to anything. What they do is specified in `archon`'s `0136-machine-bootstrap` and tested in
  [`tests/`](tests/).

The harness itself, its specifications, its ontology and everything it builds live in the private `archon` repository. The setup instructions are in that repository's README,
which the people who may run the script can read.

## Tests

`python3 -m unittest discover -s tests` runs them with the standard library alone (`shellcheck` is used where it is installed); nothing here needs `uv`, `archon` or the network. A GitHub Actions workflow runs them on every push.
