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
- **FR-009**: A configuration MAY give `evidence`: a folder of test results (`results`: CTRF, one `<library>.ctrf.json` for each library, with the requirements each test proves in `extra.requirements`, and `meta.json` with the commit and when), a snapshot of the GitHub issues of the repository (`github`: the JSON of the API, pull requests left out) and the issues of the libraries kept as typed code (`issues`: a library and its issues, with a `scope` where a library keeps more than one set). The generator MUST read them as files, import no library that makes them and reach no network; a folder that is not there MUST be no run recorded, a file that is not JSON or not CTRF a finding, a test's path a path from the repository's root made with the library's folder, and a ticket tied to a library by a label `lib:<name>` or a path `commons/<name>/` and to requirements by the ids in its words.
- **FR-010**: Where `evidence` is configured, the site MUST have a Quality section: a dashboard with a row for each library (tests, passed, failed, skipped, requirements proved, open issues, open tickets) that says which commit and when the results are of, and a banner where a test failed; a page for each library (its failing tests with why, its skipped or planned, its slowest, the requirements no passing test proves, its open issues and tickets); the register of the issues and tickets; and a page for each issue kept as typed code (its facts, the requirements it cites as links where a specification of the kits has them and as code where none does, its evidence, its related issues). With no run recorded the pages MUST say so and nothing MUST be shown as passed; with no `evidence` there MUST be no section.
- **FR-011**: The evidence MUST also be beside the code: each requirement of a specification with a badge (`passing` where every test that names it passed, `failing`, `partly run`, `no test run`), its tests with their results and the open issues and tickets that name it; each library's page with its tests, requirements proved and open issues; each area's and module's page with the requirements its code is written to and what the tests of them say; and the numbers as `quality.json`. A test that names a requirement that its specification does not have MUST be a finding. A failing test MUST NOT be a finding of `check`: it is what the site is to show.
- **FR-012**: The package MUST have a tool, `tools/evidence.ts` (`bun tools/evidence.ts --library NAME [--out DIR]`), that runs a library's suite with `ifc test run`, as a program and not as an import, and keeps its CTRF report as `<DIR>/<library>.ctrf.json` with a `meta.json` where there is none, whether the tests pass or fail; it MUST refuse, with exit status 2, a library with no suite.
- **FR-013**: The package MUST have a tool, `tools/ci-runs.ts`, that asks the GitHub API (through `gh`) for the last runs of each workflow of the repository on `main` and, for the latest failed ones, which jobs failed and at which step, and writes them as `runs.json`; where the API cannot be reached it MUST write a file that says so and exit 0.
- **FR-014**: The package MUST have a tool, `tools/status-site.ts`, that writes one self-contained page from the evidence alone (the end of the build's log, the commit and when, the tests library by library, why a library has no report, the workflows' latest runs), for a build that failed; it MUST use no part of the generator and exit 0 whatever is missing.
- **FR-015**: A configuration MAY give `problems` (what could not be read while it was made) and the generator MUST make each a finding, and a lens that throws, in its reading, its pages or its files, MUST be a finding and not stop the site: one library or one lens MUST NOT keep the site from being made.
- **FR-016**: The site MUST show how quality moved, from a history of the evidence: the package MUST have a tool, `tools/history.ts`, that adds one run (for each library the counts of its tests, how long they took, and the identity and name of each test that failed, and the libraries that left no report) to the files `history/runs/<time>-<run>.json`, adds a run once, keeps the newest and refuses evidence with no time; the generator MUST read those files beside the results and show, on each library's page, trends of its tests, pass rate and time as lines drawn in the page, the tests that began to fail in the latest run with the range of commits since the run before, the tests that were fixed, those that failed in more than one separate stretch and pass in the latest (flapping), and its failures grouped by cause; and, on the dashboard, a pass-rate trend and the count of flapping tests for each library.

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
