# Feature Specification: Docs

**Spec ID:** 0001-docs
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The generator of a repository's documentation site, as a library of its own that any repository installs from npm: a typed configuration (`docs.config.ts`) that names the packages, the spec kits, how specifications are cited and the lenses, the command `ifc-docs` that builds or checks the static site, and the factories of the lenses (layered models, programs, guides, releases) that a configuration passes. What the site is, and what it shows, is the documentation capability of commons (commons 0011-documentation); this specification is what makes the generator a package that other repositories, including a private one whose site is never published, depend on by name.

## Requirements

- **FR-001**: Docs MUST be a library of commons: the folder `commons/docs/` with a spec kit of its own, a manifest `library.ts`, an `about.ts` and a package named `@intellectual-frontiers/docs`, its sources in `src/`, proved by `bun run verify` in its folder.
- **FR-002**: The package MUST export, by package name, the entry of the generator (`.`: the types of the configuration, `DocsConfig`, `About`, `Lens`, `Page`, `Block` and the functions that build and check a site) and the factories of the lenses a configuration passes: `./lens/layered`, `./lens/program`, `./lens/guides` and `./lens/releases`, so that a repository's `docs.config.ts` imports them and nothing else of this library.
- **FR-003**: The package MUST have the command `ifc-docs` (`bin`): `ifc-docs build [--out DIR] [--config FILE]` writes the site, `ifc-docs check` builds it into a temporary folder and exits 1 where there is a finding, and both find the first `docs.config.ts` from the folder they run in up to the root of the repository.
- **FR-004**: The package MUST be built, inspected and packed by `tools/pack.ts` through the packer of commons: compiled modules and their declarations beside the sources (which Bun reads), the files of the theme beside the modules that read them, the command as a launcher of the compiled module, a `LICENSE`, and `dependencies` that are all real packages of npm (`typescript` at `7.1.0-beta`, `shiki`, `beautiful-mermaid` and the libraries of commons that are published) and none that is a link.
- **FR-005**: The packed package, installed into an empty project beside a small repository (a spec kit in the form of Mizan or of Spec Kit and a `docs.config.ts` that imports the package by its name), MUST build that repository's site with `ifc-docs build` and with `ifc-docs check`, with no finding, with every page a static file whose links are relative and that asks nothing of another host.
- **FR-006**: A configuration MUST give the address and the branch of the repository (`repository`, `branch`), and the generator MUST make every link to a source file from those and from nothing else, so that a repository that is private, or hosted anywhere, has a site whose links go where its configuration says and whose pages name no other host.
- **FR-007**: The pages MUST be one model that more than one presentation writes: `web` (the static site), `markdown` (the Markdown twin of each page and `llms.txt`), `data` (the JSON the lenses add) and `book` (FR-008). Each presentation makes its files in memory as a list, so that the same list is written by `ifc-docs build` into the output folder, or compared with the folder by `ifc-docs build --check`, which writes nothing and exits 1 where a file is missing or differs. A configuration names the presentations it writes (`presentations`; `web`, `markdown` and `data` by default, which is the site as it has always been) and the command line overrides them with `--presentation NAME[,NAME]`; a name that is not one, `book` with no volume configured, and `--presentation` or `--check` with `check` are refused. The folder is emptied before a write only where `web` is written, so that a book is written into a folder that holds other things.
- **FR-008**: The `book` presentation MUST write each volume that the configuration's `books` names as one AsciiDoc file, `<volume>/generated/<volume>.adoc`, which a book of `erga` (kind `book`) includes as a generated chapter source, and `books.json`, which lists the volumes, their parts and their page counts. A volume has parts, and a part selects pages by section, group and path prefix (`exclude` leaves some out; `perGroup` makes a part of each group); a page is in the first part that selects it, is a chapter of its part, and is a section of its parent's chapter where its parent is in the part. The file MUST begin with the line that says it is generated and how to write it again, hold no date and no revision (the same pages give the same bytes), and use only what AsciidoctorJ reads as it is: parts and chapters with anchors that no volume has twice, source blocks, admonitions, tables, lists, cross references to pages of the volume and, for a page that is not in it, a link to the site where `books.site` names one and its text where it does not. Text that AsciiDoc would read as markup is passed through, and a diagram is shown as its source. A part that selects no page is a finding.

## Out of scope

- Publishing the site (GitHub Pages, a private artifact store): the consumer's; this library writes a folder.
- What the site of commons shows: commons 0011-documentation.

## Edge cases

- A repository with no spec kit: a site with its API reference and its overview, and no Specifications section, per FR-005.
- A configuration whose `repository` is not a GitHub address: links to files are made from it as given, per FR-006.
- `ifc-docs build` run in a folder with no `docs.config.ts` up to the root: a message that says what to write, and the exit status 2, per FR-003.

## Assumptions

- The consumer has Bun, or Node 26 (which reads TypeScript for the configuration), and installs the package from a registry.

## Open questions

- **OQ-1**: Whether the command should also serve the site for a reader (`ifc-docs serve`), or leave that to `repoctl docs serve`.

## Key entities

- **Configuration** - what a repository says about its packages, specifications, citations and lenses.
- **Lens** - a function that turns what a library says about itself into pages.

## Success criteria

- **SC-001**: A repository that has never seen commons installs `@intellectual-frontiers/docs` and builds a checked static site from a configuration of a dozen lines.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
