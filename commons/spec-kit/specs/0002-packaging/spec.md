# Feature Specification: Packaging

**Spec ID:** 0002-packaging
**Status:** Draft
**Owner:** if
**Domain:** commons
**Part of:** 0001-software-supply-chain

**Input:** The packaging ontology of the software supply chain capability (0001-software-supply-chain): the package managers and system families of every computer a harness may meet, the
commands that drive each manager, the package each family calls a program, what a harness must never run, and how far each family has been tried. It is seeded from the tables of `upt`
(a universal package-management tool) and from what the retired Stolos engine ran (its tables are the origin `archon`; the name `archon` is now the commons library of 0034-archon); a tool generates from it the TOML table a harness reads, the shell fragment a script carries and the TypeScript module a harness's setup reads. It exists so that
the harnesses (`archon`, `toolchain`) and `erga` read one set of facts, and so that a new family is a change to data and a run on a real computer, not new branches in two languages.

## The ontology

- **FR-001**: The vocabulary MUST be `commons/ontology/supply-chain/packaging/packaging.ts` in the namespace `https://www.intellectualfrontiers.com/ontology/packaging#` (`pm:`), the data
  `managers.ts`, `families.ts`, `programs.ts`, `pins.ts`, `rules.ts` and `record.ts` beside it, with individuals in `https://www.intellectualfrontiers.com/id/packaging/` (`pmid:`), each a TypeScript module of 0012-ontology FR-008 (amended 2026-11-16: the files were Turtle). A class MUST specialize a schema.org class
  where schema.org has one; every term MUST have a label and a definition.
- **FR-002**: The data MUST hold every package manager and every operating-system row of the tables of `upt`, whatever the platform (Linux, the BSDs, macOS, Windows, Android and Haiku), so that
  a future harness is not limited to the families the retired engine ran on. A test MUST fail where a manager or a row of `tests/fixtures/upt/` is missing.
- **FR-003**: The data seeded from `upt` MUST say so, with its licence (MIT or Apache-2.0) and the identifier it leaves out (`oubes`, which is not an `os-release` ID). A command MUST say where it
  comes from (`pm:origin`: `upt`, `archon` (the commands the retired Stolos engine ran, before `commons/archon` of 0034-archon replaced it), `memory` (written from knowledge) or `upt+memory` where the non-interactive form was written from knowledge), and a command, a family or a flag run on a real computer MUST say where and
  when (`pm:verifiedOn`); one with none is unverified (0001-software-supply-chain FR-006).
- **FR-004**: A family MUST be `supported` where a harness acts on it and `catalogued` where it is only known, and MUST have an assurance: `verified`, `stand-in`, `untested` or `none`. A supported
  family that installs packages MUST have a preferred manager whose install command has a non-interactive form that comes from a harness (origin `archon`), a command that says whether a package
  is installed, the command a person with administrator rights runs, and a removal hint; one that installs none (a Mac) MUST say so. A `verified` family MUST say where and when.
- **FR-005**: A command that must never be run MUST be a `pm:Prohibition` with its reason, and MUST NOT appear as a usable command: `pacman -Sy` (a refresh alone leaves a rolling release
  partly upgraded) and every command of an AUR helper (it runs the build scripts of packages nobody reviewed).
- **FR-006**: A command MUST be a list of words, with `{packages}` or `{package}` where names go; it MUST NOT hold shell syntax, because a harness runs it without a shell.
- **FR-007**: Every ID that detects a family (a word of the `ID` or `ID_LIKE` of `/etc/os-release`, or a platform name) MUST detect exactly one family; the fallback `*` is the one exception.
- **FR-008**: A program MUST be named once, with a tier (`required` for what a setup needs from a computer, `comfort` for the everyday programs) and, for each family, the package that gives it
  (alternatives separated by `|` where a release renamed it). Every required program MUST have a package for every supported family that installs packages, and a package MUST NOT be
  named for a family that is not supported.

## The generated tables

- **FR-009**: `commons/tools/generate-packaging.ts` MUST read the ontology and write `commons/generated/packaging.auto.toml`, `commons/generated/packaging.auto.sh` and `commons/generated/packaging.auto.ts`
  (the same facts as typed TypeScript data, which a harness's setup imports: the families with their commands as lists of words, the programs, the platforms, the pins and the
  fields of the record), and the Turtle of 0012-ontology FR-011, MUST write the same bytes from the same ontology, and with `--check` MUST write nothing and fail (exit 1) where a file is not what the ontology makes (0001-software-supply-chain FR-002). It MUST
  be TypeScript that Bun (the default) or Node 26 runs (`bun commons/tools/generate-packaging.ts`), importing nothing outside `commons/tools/` but the ontology's modules, whose typed values it reads (it parses no Turtle), and the tables it writes MUST be those it wrote from the Turtle the ontology was taken from, but for the source hash (0012-ontology FR-012) and the name of the source in their first line (amended 2026-11-16: the tool read the Turtle itself, with a reader of its own; amended 2026-11-15: the tool was Python, run by `uv` with `rdflib`).
- **FR-010**: Before it writes anything the tool MUST check FR-001, FR-004 to FR-008 and name every rule broken, and MUST write nothing (exit 2) where one is; an ontology module that does not load stops it before it writes anything, with the runtime's own message naming the file and the line (amended 2026-11-16: it read Turtle, and named the file of a syntax error itself).
- **FR-011**: The TOML MUST begin with a line saying it is generated, `schema = 1` and `source_sha256` of the ontology (0012-ontology FR-012); hold every family, every manager with its commands (as lists of
  words, with the origin and verification of each), every prohibition and every program; and be valid TOML.
- **FR-012**: The shell fragment MUST be POSIX `sh`, free of the warnings of `shellcheck`, between `# >>> packaging.auto >>>` and `# <<< packaging.auto <<<`, and give, by family:
  `pm_family_of` (the family the words of an `os-release` name), `pm_family_of_uname`, `pm_label`, `pm_status`, `pm_assurance`, `pm_manager`, `pm_installs_packages`, `pm_removal_hint`,
  `pm_note`, `pm_install_words`, `pm_refresh_words`, `pm_query_installed_words`, `pm_query_candidate_words`, `pm_environment`, `pm_admin_install`, `pm_package` and `pm_programs`.
- **FR-013**: A program that reads the TOML MUST ignore a table whose `schema` is newer than it understands and say so, MUST run a command as a list of words (never through a shell), and
  MUST run only executables its own allowlist names, so that a changed table cannot make it run something it does not know.

- **FR-014**: The ontology MUST name the platforms a harness runs on (each with its name, operating system, processor and the ending of its pin variables; the operating system one of `linux`, `macos` and `windows`, the processor `x86_64` or `aarch64`, and the name `<os>-<x64|arm64>`, Windows among them because a harness may set up natively there) and the downloads a script pins before any harness exists (each with a key, one version and a SHA-256 of 64 lower-case hexadecimal digits per platform), and the tool MUST write them to `commons/generated/pins.auto.env` (one `KEY=value` line each), and the platforms and pins into the TOML and the TypeScript module, so that a version or a checksum is written once. It MUST refuse, naming it, a pin with no version, a checksum that is not 64 digits, a platform or pin key used twice and a checksum for a platform or pin that does not exist.
- **FR-015**: A harness that keeps a copy of the pins MUST take it from `pins.auto.env` and not from a person's hand, and MUST NOT fetch pins at run time: a pin is trusted because a maintainer committed it, so it is the one thing in the table that is not refreshed by an update.

- **FR-016**: The ontology MUST name the fields of the record a setup keeps of how an account was set up (`~/.config/erga/install.toml`): each with a name, a type (`text`, `boolean` or `date`), an order and a definition, and the values it may hold where it may hold only some; the tool MUST write them, in order, to `commons/generated/install-record.auto.toml`, and the setup that writes the record MUST write exactly those fields in that order, so that what writes the record and what reads it cannot drift.

## The download of a pin

- **FR-017**: A checksum (`pm:Checksum`, a pin on a platform) MUST say what a download of it needs, so that the pin is the one source of where a program comes from: `pm:downloadUrl` (the `https` address of the publisher's artifact for that pin and platform, in which `{version}` stands for the pin's version, so that a version is written once), `pm:archiveFormat` (`zip`, `tar` or `file`: a zip archive, a tar archive plain or compressed, or the one file itself) and `pm:binPath` (the folder of the programs inside the unpacked artifact, relative to its root; empty for the root). A platform whose address is not known MUST NOT be given one: it MUST carry `pm:unpinnedReason`, the sentence that says why, and none of the three, so that a script and a harness see it is not downloadable and no address is invented. Exactly one of the two forms MUST be present.
- **FR-018**: The tool MUST refuse, naming the pin and the platform, an address that is not `https` (after `{version}` is replaced), an address with a user name or a password, an address that is not an address, an archive format that is none of the three, a `binPath` that is absolute, holds `\` or has a `..` word, a checksum with some but not all of the three, a checksum with both an address and an unpinned reason and with neither, and more than one checksum for the same pin and platform (FR-010).
- **FR-019**: The generated files MUST carry what FR-017 says, written from the pins and nowhere else: `pins.auto.env` MUST add to each pinned platform of a pin the lines `KEY_URL_SUFFIX` (the address, `{version}` replaced), `KEY_FORMAT_SUFFIX` and `KEY_BINPATH_SUFFIX`, and the TOML and the TypeScript module MUST hold, for each pin, each platform as `{ state: "pinned", sha256, downloadUrl, archiveFormat, binPath }` or `{ state: "unpinned", sha256, reason }` (a closed union; the module's `pins` entry has `platforms` and no separate `sha256` map). A program of this repository that downloads a pin (the Bun installer of CI, the OpenTelemetry Collector step of the conformance job) MUST read the address, the format and the folder from `pins.auto.env` and MUST NOT write them again, so that a change of pin is made in `pins.ts` and in no other file.
- **FR-020**: The ontology MUST export, for a reader that holds no pin of its own (`commons/toolchain`), the downloads as typed values: `downloadOf(pin, platform)` of `@intellectual-frontiers/ontology/supply-chain/downloads`, which MUST give for a pin id (`mise`, `python`, `uv`, `rustup-init`, `gh`, `jq`, `bun`, `otelcol-contrib`) and a platform name (`linux-x64`, `linux-arm64`, `macos-x64`, `macos-arm64`, `windows-x64`) a `Result` of `{ version, downloadUrl, sha256, archiveFormat, binPath }`, or the reason the platform is unpinned, or that the pin or platform is unknown; each a value of a closed union and each id a branded smart-constructed value.
- **FR-021**: The package managers MUST include `manager-mise` (`mise`, a tool manager: the kind `tool`, which is no family's manager), with the commands install, query version and list installed as words, each of origin `memory` and unverified (FR-003), so that nothing acts on them until they are run on a real computer.
- **FR-022**: Each of the managers `apt`, `pacman`, `dnf`, `brew` and `winget` (those of the Linux, macOS and Windows families a harness meets first) MUST have a command for the operation query version, which says the version of one installed package for an SBOM; where one was not yet in the table it MUST be added with origin `memory` and no verification (FR-003). The query version of `brew` (`brew list --versions {package}`) and of `winget` (`winget list --exact --id {package}`) are of that kind.
- **FR-023**: The name `archon` MUST be used in the ontology, its generated files and this specification only for `commons/archon` (0034-archon) and for the origin `archon` of FR-003; a sentence MUST NOT call it a harness the ontology's data was taken from.

## Out of scope

- Acting on a family: what a harness does with the table (`commons/archon`, 0034-archon, and `erga`'s machine bootstrap specification).
- Downloading, unpacking and installing a pin: `commons/toolchain` reads the addresses and hashes of the pins through the ontology's exports and holds no version or hash of its own; the pin only says where the publisher's artifact is.
- The `download` entries of `erga`'s catalog: reviewed by a person later, not generated here.
- A command for a manager nobody has run: it is recorded unverified and used by no one.
- Package versions and the repositories' contents.

## Acceptance scenarios

1. **Given** a pin whose checksum names `http://` as its address, **When** the tool runs, **Then** it exits 2 and names the pin and the platform and says the address is not https, and writes nothing, per FR-018.
2. **Given** an address `https://user:secret@example.com/x`, **When** the tool runs, **Then** it exits 2 and says the address holds a user name or a password, per FR-018.
3. **Given** a `binPath` of `../x` or `/usr/bin`, or an archive format `rar`, **When** the tool runs, **Then** it exits 2 naming each, per FR-018.
4. **Given** a checksum with an address and no format, **When** the tool runs, **Then** it exits 2 and says the three go together, per FR-017 and FR-018.
5. **Given** a platform with no known address and an unpinned reason, **When** the tool runs, **Then** it writes the platform as unpinned with its reason in the TOML and the module and no `KEY_URL_` line in `pins.auto.env`, per FR-017 and FR-019.
6. **Given** the committed pins, **When** `pins.auto.env` is read, **Then** the Bun address of each of its five platforms is there, and the Bun installer takes its address from it, per FR-019.
7. **Given** the ontology's exports, **When** `downloadOf` is asked for Bun on `linux-x64`, **Then** it gives the version, the address with the version in it, the SHA-256, `zip` and `bun-linux-x64`, and for a platform that is unpinned it gives the reason, per FR-020.
8. **Given** the table of managers, **When** it is read, **Then** `mise` is there with three commands of origin `memory` and no verification, and apt, brew and winget each have a query-version command, per FR-021 and FR-022.

## Edge cases

- A command in `upt`'s table that is a prohibition (`pacman -Sy`): it is not recorded as a usable command, per FR-005.
- A family whose non-interactive form was written from knowledge: it stays `catalogued`, and no harness runs it until it is run on a real computer, per FR-003 and FR-004.
- A computer whose `ID` is unknown but whose `ID_LIKE` names a family (Omarchy, `ID_LIKE=arch`): the first word that detects a family decides it, per FR-007.
- A required program with no package for a supported family: the tool names it and writes nothing, per FR-008 and FR-010.
- The ontology and a generated file disagree: `--check` fails and says to run the tool, per FR-009.
- An ontology module with a syntax error: the tool stops, and the runtime names the file and the line, per FR-010.
- A computer whose family the table knows but no script acts on (Fedora, `ID=fedora`): the setup stops before changing anything and names the family and its package manager, per FR-004.

## Assumptions

- Bun (the version `pins.auto.env` pins) or Node 26 is on the computer that regenerates; the tables are committed, so a computer that only reads them needs nothing (amended 2026-11-15: it was `uv`).
- `upt`'s README stays under its MIT or Apache-2.0 licence.

## Open questions

- **OQ-1**: Whether the non-interactive forms written from knowledge are right for each manager: each is checked on a real computer before its family is supported.
- **OQ-2**: The package URL type of the managers `upt` lists that have none (nix, guix, flatpak, snap, winget, scoop, chocolatey, xbps, portage, opkg, FreeBSD's `pkg`), if the specification adds them.

## Key entities

- **Checksum** - a pin on a platform, with the address, format and folder of its download (`pm:Checksum`).
- **Package manager** - a program that installs software (`pm:PackageManager`).
- **System family** - the computers that share a manager and package names (`pm:SystemFamily`).
- **Command** - one operation of a manager as a list of words (`pm:Command`).
- **Prohibition** - a command never to run, with the reason (`pm:Prohibition`).
- **Program** and **package name** - what is installed and what a family calls it.

## Success criteria

- **SC-001**: `bun commons/tools/generate-packaging.ts --check` succeeds on the committed files.
- **SC-002**: Every manager and operating-system row of `upt` is in the table.
- **SC-003**: Adding a family is a change to the ontology and a run of the tool.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Confidential: no sensitive fact written as a literal
