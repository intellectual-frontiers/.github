# Feature Specification: Documentation

**Spec ID:** 0011-documentation
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** One documentation site for commons, published on GitHub Pages and read by developers, DevOps and other engineers, made entirely from what the code and the specifications already say: the module documentation and TSDoc of IFC TypeScript and the libraries built on it, their typed values (the models of SQL Aide, the layouts of File Aide, an `About` value for each area) and the spec kit. Nothing is written for the site alone, and commons keeps no README: a module's documentation is its TypeScript, kept with the code in the same commit. The generator knows what each library is for and shows it: a schema written with SQL Aide is shown as a schema, with its entity-relationship diagram, its tables, the SQL of each dialect and its data governance, and a layout written with File Aide as a layout. It reads the code through the TypeScript 7.1 programmatic API and writes static HTML with no framework.

## The generator

- **FR-001**: The generator MUST be kept in `commons/docs/`, a Bun package whose `package.json` has no `dependencies` and whose `devDependencies` are pinned exactly: `typescript` at `7.1.0-beta` (the first release with a programmatic API since 7.0), `mermaid`, whose `dist/mermaid.min.js` the site serves, and `@types/node`. The lockfile, `bun.lock`, holds the integrity of each. Nothing outside `commons/docs/` MUST import a file of it.
- **FR-002**: The generator MAY import IFC TypeScript's kernel and runtime, the public entry points of the data libraries (`sql-aide/mod.ts`, `file-aide/mod.ts`) and the modules it documents, and nothing else but `typescript/async` (the asynchronous client of the programmatic API, whose channel to the compiler runs under Bun; the synchronous one reads Node's own stream internals). It MUST be held to IFC TypeScript's rules (0005-typescript-runtime): only erasable syntax, no `any`, no non-null `!`, an expected failure as the kernel's `Result`, a tagged union matched by a `switch` that ends in `absurd`, `@module` on every file and TSDoc on every export, checked by the TypeScript compiler of the package.
- **FR-003**: `bun commons/docs/main.ts [--out DIR] [--check]` MUST write the site into DIR (`_site` at the root of the checkout by default, which Git ignores), and with `--check` MUST build it into a temporary folder, report every finding of FR-018 as `where: message` on standard error, write nothing in the checkout and exit 1 where there is one. The same sources MUST give the same bytes.

## The sources

- **FR-004**: Every page MUST be made from two sources alone: the TypeScript of commons (module documentation, TSDoc, `About` values, example files and the values of models and layouts) and the spec kit (`commons/spec-kit/`). The site MUST NOT be made from a Markdown file written for it, and commons MUST NOT keep a `README.md`; the root `README.md` of the repository (a short pointer to the site, kept by hand) and `profile/README.md` (the organization's page on GitHub) are not commons' and are not sources.
- **FR-005**: An area is a part of commons with an entry point: IFC TypeScript's kernel, runtime and lint plugin, SQL Aide, File Aide, Arca, Data Vault, osquery ATC and IFRFS. Each package (`commons/ts`, `commons/ts/data`) MUST have an `about.ts` at its root that exports `about`, a value of the kernel's `About` type (`kernel/documentation.ts`): its title, a summary, the specification it implements, its folders with what each may import, its commands, its rules with what enforces each, and its areas, each with its entry points, its specification, its phases and its examples. No entry point MUST export `about.ts`, and commons as a whole MUST have `commons/about.ts`, with its summary and its folders.
- **FR-006**: The documentation of a module MUST be TSDoc: the module's comment (which says `@module`) begins with what the module is, and MAY go on with `@remarks` (the longer account), `@example`, `@see` and `@limits`, this repository's own block tag, which says plainly what the module does not do or does only in part. An export's comment MAY carry `@param`, `@returns`, `@example`, `@see` and `@deprecated`. Prose in TSDoc and in specifications is the Markdown of FR-016.
- **FR-007**: A limit, a guarantee or an account of how a part works MUST be written in the module of the code it is about, not in another file. A change to code MUST change its documentation in the same commit.
- **FR-008**: A fact with a shape (a table of folders, of commands, of rules, of phases, of what a dialect's catalog compares) MUST be a typed value, in `about.ts` or in the module that uses it, not a table written in prose, so that a test can hold it to the code.

## The pages

- **FR-009**: The site MUST have four sections. Overview: a home page from `commons/about.ts` with a card for each capability (its specification's title, `**Input:**` and `**Part of:**`), and a page for each area from its entry point's module comment and its `about`, with the limits of the area's modules gathered from their `@limits`. Specifications: FR-015. API: FR-010 to FR-012. Models: FR-013 and FR-014.
- **FR-010**: The API of an area MUST be read through the TypeScript 7.1 programmatic API (`typescript/async`) from the area's entry points: every export, an alias followed to what it names, a namespace walked into, with its kind (function, constant, type, interface, class or namespace), its signature as the checker prints it, and its TSDoc. The area MUST have a page for each source file its exports come from, in the order the entry point exports them, with an anchor for each export.
- **FR-011**: A citation in documentation MUST become a link to the specification's page: `commons NNNN-slug`, a bare `NNNN-slug` of the spec kit, `FR-nnn` after either, and a bare `FR-nnn` in an area, which names a requirement of the area's specification. A specification of another repository (`erga 009-machine-bootstrap`) MUST be shown as text and never linked: this repository is public and the others may not be.
- **FR-012**: `{@link name}` MUST become a link to the export of that name in the same area, or to the export of an area that is named (`{@link sql-aide!table}`), and an unknown name is a finding.
- **FR-013**: A lens MUST be a typed value that recognises the exports of one library by the TypeScript type of each and makes pages for them from their values, which it imports. The SQL Aide lens MUST recognise tables, views, routines, indexes, integrations and transforms and, for each module that exports them, MUST give the model's entity-relationship diagram (SQL Aide's `mermaidErd`) and data dictionary (`dataDictionary`), and a page for each table and view with its description, owner, columns (domain, nullability, key or reference, description, and the class and category of personal data each is marked with), indexes, the views and routines that use it, a diagram of the table and the tables it touches, and its SQL for PostgreSQL, SQLite and DuckDB, rendered by SQL Aide itself. A Governance page MUST gather, across every model, the columns that hold personal data by category, the tables by owner and those with none, and what SQL Aide's typical lint rules find.
- **FR-014**: The File Aide lens MUST recognise entries and layouts and give, for each layout, a tree of its entries and, for each entry, its path pattern with the type and the witnesses of each segment, its codec, its owner and its description.
- **FR-015**: The spec kit MUST give a page for each specification in force, with its title, status, owner, domain and part, an anchor for each requirement and each success criterion, beside each requirement its row of `enforcement.tsv` (mechanism and who), each edge case linked to the requirements it cites, and for each requirement the pages that cite it; a page of the register; and a matrix of every requirement with its mechanism and who enforces it.

## The output

- **FR-016**: The generator MUST turn the Markdown of TSDoc and of specifications into its own page model, a tagged union of blocks and inlines, and MUST read only this subset: paragraphs, headings, lists, emphasis, code, fenced code with its language, links, and tables. Anything else is shown as its text.
- **FR-017**: Every page MUST be a static HTML file whose links are relative, so that the site works under any path (it is published at `https://intellectual-frontiers.github.io/.github/`). A page MUST NOT request anything from another host: its stylesheet, its one script, the search index and Mermaid are files of the site. The text people read MUST be on white (`#ffffff`); the navigation is on a neutral grey; the site is light only; it MUST be read on a screen 360 pixels wide with nothing scrolling sideways but code and wide tables; code is highlighted when the site is built; a search over titles, headings, exports, tables, columns and requirements is opened with `/`.
- **FR-018**: `--check` MUST find: an export of an area with no TSDoc; a package with no `about.ts`, or whose `about` names a folder that does not exist, a command that is not a script of its `package.json`, or a rule enforced by a test or lint rule that does not exist; a citation of a specification or requirement that is not in the spec kit; a `{@link}` to an unknown name; a table or view of a model with no description; a module of a lens that cannot be imported; and a link or anchor of the site that leads nowhere.
- **FR-019**: The generator's tests MUST cover the Markdown subset, the highlighter, every case of the page model as HTML, the API reader on a fixture module, and each lens on a fixture, and MUST compare the fixtures' HTML with HTML committed under `commons/docs/suite/golden/`, written again with `IFCDOCS_UPDATE_GOLDEN=1`.
- **FR-020**: A workflow, `.github/workflows/docs.yml`, MUST run the generator's tests and `--check` on every pull request and push that touches commons or the workflow, and on a push to `main` MUST build the site and publish it to GitHub Pages with GitHub's own actions (`actions/upload-pages-artifact`, `actions/deploy-pages`). The site MUST NOT be committed.

## Out of scope

- The ontology (`commons/ontology/`): it moves to TypeScript, and is then shown by a lens of its own.
- A link from a type in a signature to its page, versions of the API for each release, D2 diagrams, Rust and Zod output, and languages other than TypeScript.

## Edge cases

- An export whose TSDoc was removed: `--check` names it, per FR-018 and FR-010.
- A module of a model that throws when imported: `--check` names the module and the site is not published, per FR-018 and FR-013.
- A documentation comment that cites a requirement of `erga 009-machine-bootstrap`: the page shows the text, with no link, per FR-011.
- A comment that cites a requirement number its specification does not have: `--check` names it, per FR-018 and FR-011.
- A package's `about` whose command was renamed in `package.json`: `--check` names it, per FR-018 and FR-005.
- A table of a model with no description: `--check` names it, per FR-018 and FR-013.
- A signature thousands of characters long (a model's computed row type): it is shown whole and folded, per FR-010 and FR-017.
- The site published under `/.github/`: every link is relative, so it works there and at a custom domain alike, per FR-017.
- A README added to commons: the tests of the layout fail, per FR-004.

## Assumptions

- The TypeScript 7.1 programmatic API, in beta, keeps the shape it has in `7.1.0-beta`; the generator is pinned to that version and moves to the stable 7.1 when it is released.
- GitHub Pages serves a repository named `.github` under `/.github/`; where it does not, the site is published at a custom domain with no change to it.
- A model module only defines values when it is imported, which is how SQL Aide's models are written.

## Open questions

- **OQ-1**: Whether the root `README.md` should also be made from `commons/about.ts` once the site is the only documentation people read.
- **OQ-2**: Whether the documentation of each release of IFC TypeScript should be kept beside the latest, under the release's tag.

## Key entities

- **Area** - a part of commons with an entry point, named by its package's `about`, and its pages.
- **About** - the typed facts of a package: summary, specification, folders, commands, rules, and its areas with their phases and examples.
- **Page model** - the tagged union of blocks and inlines every page is made of before it is HTML.
- **Lens** - what the generator knows of one library: which exports are its, and the pages their values make.
- **Finding** - a place and a sentence saying what `--check` found there.

## Success criteria

- **SC-001**: `cd commons/docs && bun run verify` (the compiler, the tests, then `--check` on commons) passes.
- **SC-002**: The published site has a page for every export of every area, for every table of Arca's party model with its diagram and its SQL for the three dialects, for the IFRFS layout, and for every specification in force.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
