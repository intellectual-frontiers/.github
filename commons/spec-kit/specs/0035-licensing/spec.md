# Feature Specification: Licensing

**Spec ID:** 0035-licensing
**Status:** Draft
**Owner:** if
**Domain:** commons
**Part of:** 0027-commons-libraries

**Input:** The code of this repository is public to read, and commercial use of it needs the owner's paid license. Every library and every part of the repository is therefore under one source-available license, the PolyForm Noncommercial License 1.0.0, with Intellectual Frontiers LLC as licensor, and the owner offers a separate commercial license. The license text is the official one, copied and never retyped; the identifier is written in one place; a check fails where a library has no `LICENSE`, so that a new library cannot be published without one.

## The license

- **FR-001**: Every library of `commons/` and every other part of this repository that is Intellectual Frontiers' own MUST be licensed by Intellectual Frontiers LLC under the PolyForm Noncommercial License 1.0.0 (SPDX identifier `PolyForm-Noncommercial-1.0.0`), and no text of another license (the MIT license among them) MUST stand as the license of anything of ours; the identifier MUST be written in one place, `commons/libraries/src/license/standard.ts`, from which the generator, the packer and the checks read it.
- **FR-002**: The text of the license MUST be the official text, copied byte for byte from the file `1.0.0/PolyForm-Noncommercial-1.0.0.md` of `https://github.com/polyformproject/polyform-licenses` (tag `1.0.0`), and MUST NOT be written or reproduced from memory; it MUST be recorded as a typed `Standard` (0018-standards-first FR-006, FR-007: its issuer, name, version, location, license and the SHA-256 of what was imported) in `commons/libraries/src/license/standard.ts`, and a test MUST fail where the file's SHA-256 is not the recorded one.
- **FR-003**: A library whose manifest (`library.ts`) has a `license` MUST carry that one of the identifiers of the closed list `SPDX_IDS` in place of the default, a `license` that is on no list MUST be refused naming it, and a license is added to the list together with its official text and its standard.
- **FR-004**: Every `LICENSE` MUST begin with the line `Required Notice: Copyright Intellectual Frontiers LLC (https://github.com/intellectual-frontiers/.github)`, which the license asks of its licensor, then a blank line, then the official text unchanged.

## The files

- **FR-005**: The root MUST hold a `LICENSE`, and every library folder of `commons/` (every folder with a manifest) MUST hold a `LICENSE`, each made by `commons/libraries/src/license.ts` from the one official text and the required notice, and never written by hand.
- **FR-006**: `bun commons/libraries/src/license.ts` MUST write the files it makes (every `LICENSE` and `THIRD_PARTY_NOTICES.md`), and `--check` MUST write nothing and exit with 1, naming each file that is not what the manifests and the official text make, a library folder with no `LICENSE` among them and saying in that finding the command that writes it, so that a new library runs it once.
- **FR-007**: The check MUST be run by `verify` of `commons/libraries`, by the development loop (`bun run dev:check`, whatever the change) and by the tests of the root, so that CI fails on a missing or a wrong `LICENSE`.
- **FR-008**: The root MUST hold `LICENSING.md` (in plain words what is free, what needs a commercial license, how to ask for one by an issue titled `Commercial license`, and that the owner may offer commercial terms, managed service providers among them, with one sentence that copies a person already holds under the terms they received keep those terms), `COMMERCIAL.md` (what a commercial license covers and how it is obtained, with pricing and contact left as marked placeholders for the owner and no invented price or address), `NOTICE` (the copyright of Intellectual Frontiers LLC and that contributions are licensed to it as `CONTRIBUTING.md` says), `CONTRIBUTING.md` and `CITATION.cff`, and the check MUST find each that is missing or lacks the facts it exists for.
- **FR-009**: `CONTRIBUTING.md` MUST ask for a Developer Certificate of Origin sign-off (`git commit -s`), MUST state the contributor's agreement that Intellectual Frontiers LLC may license the contribution under the public license and under commercial licenses, and MUST require a `Refs #N` line on each commit; a trademark paragraph (in `LICENSING.md`, `NOTICE` and `CONTRIBUTING.md`) MUST say that the names Mizan, Kanon and Desired OS State and the logos are not licensed beyond saying what the software is.
- **FR-010**: `THIRD_PARTY_NOTICES.md` MUST be made by the generator from a record of what is really vendored (`commons/libraries/src/license/third-party.ts`: for each item its path, what it is, its source, its owner, its license and what was checked), MUST say `unverified: <what to check>` where a license was not checked against its source and never a guess, and the check MUST find an item whose path is no longer in the repository.
- **FR-011**: The root `README.md` MUST have a License section that names the license, says what it allows, how to get a commercial license and links the files above, and MUST say what is and nothing that was; `AGENTS.md` MUST say the license and the generator's command.

## The packages

- **FR-012**: The packer MUST write the SPDX identifier of the library (its manifest's `license`, else the default of FR-001) as the `license` of the `package.json` it publishes, MUST put the library's `LICENSE` in the tarball, and MUST refuse a library that has none, saying the command of FR-006.

## Acceptance scenarios

1. **Given** the official text in the repository and the manifests, **When** `license.ts --check` runs, **Then** it writes nothing, names nothing and exits 0, per FR-005 and FR-006.
2. **Given** a library folder with a manifest and no `LICENSE`, **When** `--check` runs, **Then** it exits 1, names `commons/<name>/LICENSE` and says to run `bun commons/libraries/src/license.ts`, and running it writes the file, per FR-006.
3. **Given** a `LICENSE` edited by hand, **When** `--check` runs, **Then** it exits 1 and names the file, per FR-005.
4. **Given** the file of the official text with one character changed, **When** the generator runs, **Then** it writes nothing and names the SHA-256 it found and the one recorded, per FR-002.
5. **Given** a manifest with `license: "MIT"`, **When** it is read, **Then** it is refused naming the identifier, per FR-003.
6. **Given** a library, **When** it is packed, **Then** the tarball holds its `LICENSE` and its `package.json` has `license` equal to `PolyForm-Noncommercial-1.0.0`, per FR-012.
7. **Given** a root with no `COMMERCIAL.md`, or a `NOTICE` that does not name the licensor, **When** `--check` runs, **Then** it names the file, per FR-008.
8. **Given** an item of the vendored record whose file is gone, **When** `--check` runs, **Then** it names the path, per FR-010.
9. **Given** the real repository, **When** the tests of the root run, **Then** no `LICENSE` is the MIT license, the README names the license and every generated file is current, per FR-001 and FR-011.

## Out of scope

- Publishing, and what a registry shows of a license: the release (0027-commons-libraries FR-015 to FR-018).
- The text of a commercial agreement, its prices and its contact: the owner's, marked in `COMMERCIAL.md`.
- The pages of the documentation site that show the license: the site's own specification.

## Edge cases

- A new library that has run no generator: found by every check and by the packer, per FR-006 and FR-012.
- A vendored file that is dual-licensed or whose source could not be read: the record says `unverified:` and what to check, per FR-010.
- A checkout with CRLF line ends: the same file, per FR-005.
- Copies that a person already holds under the terms they received: they keep those terms, said once in `LICENSING.md`, per FR-008.

## Assumptions

- The PolyForm Project's own terms (`LICENSE.md` of its repository) allow the text to be copied unchanged, and the `Required Notice:` line goes beside it, not inside it.

## Open questions

- None.

## Key entities

- **License standard** - the official text as a typed `Standard`: issuer, name, version, location, license and SHA-256.
- **Required notice** - the one line of the licensor's copyright that every `LICENSE` begins with.
- **Vendored record** - the items of the repository that are not ours and the license of each.

## Success criteria

- **SC-001**: No `LICENSE` of this repository is written by hand, none is missing, and none is another license than the one the manifests name.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
