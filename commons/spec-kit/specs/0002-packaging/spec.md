# Feature Specification: Packaging

**Spec ID:** 0002-packaging
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The packaging ontology of the software supply chain capability (0001-software-supply-chain): the package managers and system families of every computer a harness may meet, the
commands that drive each manager, the package each family calls a program, what a harness must never run, and how far each family has been tried. It is seeded from the tables of `upt`
(a universal package-management tool) and from what `archon` runs; a tool generates from it the TOML table a harness reads and the shell fragment a script carries. It exists so that
`archon-bootstrap.sh`, `archon-setup.sh` and `archon` read one set of facts, and so that a new family is a change to data and a run on a real computer, not new branches in two languages.

## The ontology

- **FR-001**: The vocabulary MUST be `commons/ontology/supply-chain/packaging/packaging.ttl` in the namespace `https://www.intellectualfrontiers.com/ontology/packaging#` (`pm:`), the data
  `managers.ttl`, `families.ttl` and `programs.ttl` beside it, with individuals in `https://www.intellectualfrontiers.com/id/packaging/` (`pmid:`). A class MUST specialize a schema.org class
  where schema.org has one; every term MUST have a label and a definition.
- **FR-002**: The data MUST hold every package manager and every operating-system row of the tables of `upt`, whatever the platform (Linux, the BSDs, macOS, Windows, Android and Haiku), so that
  a future harness is not limited to the families `archon` runs on. A test MUST fail where a manager or a row of `tests/fixtures/upt/` is missing.
- **FR-003**: The data seeded from `upt` MUST say so, with its licence (MIT or Apache-2.0) and the identifier it leaves out (`oubes`, which is not an `os-release` ID). A command MUST say where it
  comes from (`pm:origin`: `upt`, `archon`, or `upt+memory` where the non-interactive form was written from knowledge), and a command, a family or a flag run on a real computer MUST say where and
  when (`pm:verifiedOn`); one with none is unverified (0001-software-supply-chain FR-006).
- **FR-004**: A family MUST be `supported` where a harness acts on it and `catalogued` where it is only known, and MUST have an assurance: `verified`, `stand-in`, `untested` or `none`. A supported
  family that installs packages MUST have a preferred manager whose install command has a non-interactive form that comes from a harness (`archon`), a command that says whether a package
  is installed, the command a person with administrator rights runs, and a removal hint; one that installs none (a Mac) MUST say so. A `verified` family MUST say where and when.
- **FR-005**: A command that must never be run MUST be a `pm:Prohibition` with its reason, and MUST NOT appear as a usable command: `pacman -Sy` (a refresh alone leaves a rolling release
  partly upgraded) and every command of an AUR helper (it runs the build scripts of packages nobody reviewed).
- **FR-006**: A command MUST be a list of words, with `{packages}` or `{package}` where names go; it MUST NOT hold shell syntax, because a harness runs it without a shell.
- **FR-007**: Every ID that detects a family (a word of the `ID` or `ID_LIKE` of `/etc/os-release`, or a platform name) MUST detect exactly one family; the fallback `*` is the one exception.
- **FR-008**: A program MUST be named once, with a tier (`required` for what a setup needs from a computer, `comfort` for the everyday programs) and, for each family, the package that gives it
  (alternatives separated by `|` where a release renamed it). Every required program MUST have a package for every supported family that installs packages, and a package MUST NOT be
  named for a family that is not supported.

## The generated tables

- **FR-009**: `commons/tools/generate-packaging.py` MUST read the ontology and write `commons/generated/packaging.auto.toml` and `commons/generated/packaging.auto.sh`, and put the shell fragment between
  the marks `# >>> packaging.auto >>>` and `# <<< packaging.auto <<<` of `bin/archon-setup.sh` (a script piped from the internet has no file beside it, and the bootstrap loads the setup's functions), MUST write the same bytes
  from the same ontology, and with `--check` MUST write nothing and fail where either file is not what the ontology makes (0001-software-supply-chain FR-002). It MUST need only `uv`: its
  one dependency is declared in its own header.
- **FR-010**: Before it writes anything the tool MUST check FR-001, FR-004 to FR-008 and name every rule broken, and MUST write nothing where one is.
- **FR-011**: The TOML MUST begin with a line saying it is generated, `schema = 1` and `source_sha256` of the ontology files; hold every family, every manager with its commands (as lists of
  words, with the origin and verification of each), every prohibition and every program; and be valid TOML.
- **FR-012**: The shell fragment MUST be POSIX `sh`, free of the warnings of `shellcheck`, between `# >>> packaging.auto >>>` and `# <<< packaging.auto <<<`, and give, by family:
  `pm_family_of` (the family the words of an `os-release` name), `pm_family_of_uname`, `pm_label`, `pm_status`, `pm_assurance`, `pm_manager`, `pm_installs_packages`, `pm_removal_hint`,
  `pm_note`, `pm_install_words`, `pm_refresh_words`, `pm_query_installed_words`, `pm_query_candidate_words`, `pm_environment`, `pm_admin_install`, `pm_package` and `pm_programs`.
- **FR-013**: A program that reads the TOML MUST ignore a table whose `schema` is newer than it understands and say so, MUST run a command as a list of words (never through a shell), and
  MUST run only executables its own allowlist names, so that a changed table cannot make it run something it does not know.

- **FR-014**: The ontology MUST name the platforms a harness runs on (each with its name, operating system, processor and the ending of its pin variables) and the downloads a script pins before any harness exists (each with a key, one version and a SHA-256 of 64 lower-case hexadecimal digits per platform), and the tool MUST write them to `commons/generated/pins.auto.env` (one `KEY=value` line each) and between `# >>> pins.auto >>>` and `# <<< pins.auto <<<` of `bin/archon-setup.sh`, and the platforms and pins into the TOML, so that a version or a checksum is written once. It MUST refuse, naming it, a pin with no version, a checksum that is not 64 digits, a platform or pin key used twice and a checksum for a platform or pin that does not exist.
- **FR-015**: A harness that keeps a copy of the pins MUST take it from `pins.auto.env` and not from a person's hand, and MUST NOT fetch pins at run time: a pin is trusted because a maintainer committed it, so it is the one thing in the table that is not refreshed by an update.

## Out of scope

- Acting on a family: what a harness does with the table (`archon`'s machine bootstrap specification).
- A command for a manager nobody has run: it is recorded unverified and used by no one.
- Package versions and the repositories' contents.

## Edge cases

- A command in `upt`'s table that is a prohibition (`pacman -Sy`): it is not recorded as a usable command, per FR-005.
- A family whose non-interactive form was written from knowledge: it stays `catalogued`, and no harness runs it until it is run on a real computer, per FR-003 and FR-004.
- A computer whose `ID` is unknown but whose `ID_LIKE` names a family (Omarchy, `ID_LIKE=arch`): the first word that detects a family decides it, per FR-007.
- A required program with no package for a supported family: the tool names it and writes nothing, per FR-008 and FR-010.
- The ontology and a generated file, or the block in the setup script, disagree: `--check` fails and says to run the tool, per FR-009.
- A computer whose family the table knows but no script acts on (Fedora, `ID=fedora`): the setup stops before changing anything and names the family and its package manager, per FR-004.

## Assumptions

- `uv` is on the computer that regenerates; the tables are committed, so a computer that only reads them needs nothing.
- `upt`'s README stays under its MIT or Apache-2.0 licence.

## Open questions

- **OQ-1**: Whether the non-interactive forms written from knowledge are right for each manager: each is checked on a real computer before its family is supported.
- **OQ-2**: The package URL type of the managers `upt` lists that have none (nix, guix, flatpak, snap, winget, scoop, chocolatey, xbps, portage, opkg, FreeBSD's `pkg`), if the specification adds them.

## Key entities

- **Package manager** - a program that installs software (`pm:PackageManager`).
- **System family** - the computers that share a manager and package names (`pm:SystemFamily`).
- **Command** - one operation of a manager as a list of words (`pm:Command`).
- **Prohibition** - a command never to run, with the reason (`pm:Prohibition`).
- **Program** and **package name** - what is installed and what a family calls it.

## Success criteria

- **SC-001**: `uv run commons/tools/generate-packaging.py --check` succeeds on the committed files.
- **SC-002**: Every manager and operating-system row of `upt` is in the table.
- **SC-003**: Adding a family is a change to the ontology and a run of the tool.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Confidential: no sensitive fact written as a literal
