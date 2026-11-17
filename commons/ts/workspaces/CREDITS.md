# Credits

Intellectual Frontiers Workspaces (IFWS, the `ifws` command) stands on the work of others. This file names them, as `0023-if-workspaces` FR-046 requires. Nothing here is a claim that any of them endorses IFWS.

## The earlier workspace tools

The layout of IFWS (one root with the repositories placed as their remotes are named), and the ideas of `ensure` (bring the workspace to the state it should be in, and do it again without harm), `status` (one look at every repository) and `doctor` (what is wrong, what is only worth a look, and what to do) come from the earlier workspace tools of Intellectual Frontiers' founder, **Shahid Shah**. Those tools are kept private and nothing of them is in this repository but this credit. IFWS carries the behavior on in TypeScript, adds a plan that is shown before anything is done, never deletes work that is not pushed, and keeps its own evidence.

## chezmoi

[chezmoi](https://www.chezmoi.io/), by **Tom Payne and contributors** (MIT license), is the inspiration for these ideas, and only the ideas:

- a **source state** and a **target state** (here the typed manifest and the plan made from it);
- **templates over data** (here typed TypeScript functions that generate the `*.auto.*` files, not a template language);
- the commands `apply`, `diff`, `status` and `verify`;
- a **state record**, so that a hand edit or a drift can be seen (`state.auto.json`).

No chezmoi code, template, data file or program is used, called or required by IFWS (`0024-ifws-host` FR-021), and IFWS is not a dotfiles manager: it manages the workspace and never edits a person's home folder or global Git configuration.

## Git

[Git](https://git-scm.com/) is run for every repository operation, and its convention that `git foo` runs the program `git-foo` on the `PATH` is the model of the `ifws` controller, which runs `ifws-<name>` modules found among its built-in modules, the modules a workspace registers and executables named `ifws-*` on the `PATH`.

## Standards and vocabularies

Where a standard exists IFWS takes it before inventing a term (`0018-standards-first`). The ones used here:

- **NIST SP 800-53 Rev. 5** (configuration management, CM family) and the **NIST OSCAL** models, for the controls the workspace's evidence speaks to; the **FedRAMP** baselines are the first domain.
- **PROV-O** (W3C), for plans and activities, and **DCAT** (W3C), for catalogs.
- **SARIF** (OASIS), the form in which the findings of IFWS are rendered.
- **OpenTelemetry**, the form in which the records of a run are written, through the evidence record of the quality system (`0021-ifqs`).
- **Git's own signature formats** (OpenPGP and SSH), for the signed commits that a harness with a declared regulated domain requires.
- **SPDX** 2.3 and **CycloneDX** 1.6, with OSCAL `inventory-item`, the forms in which the tool catalog and the inventory of installed tools are written for an assessor.
- **RFC 2119** and **EARS**, for the requirements of the specifications.
