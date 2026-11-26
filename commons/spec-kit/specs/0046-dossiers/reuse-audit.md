# Reuse audit: dossiers

**For:** 0046-dossiers. **Read:** this repository at the commit that carries this file, on 2026-11-26, by reading the manifests and summaries of the libraries and the code where a name is given. Nothing was run. Each decision says what is reused, what is added and what is removed.

Paths are under `commons/`. "Spec" names a specification of the library, as `0002-report-site FR-006`.

## A. Sources: the evidence a dossier is made of

| # | Need | Existing library and symbols | Gap | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| A1 | A run of tests as evidence, with a ledger, grades and freshness | `quality` (`pure/ledger`, `pure/record`, `pure/freshness`, `pure/ladder`, `host/ledger-branch`) | None for reading; the library's own renderers (`trust/view`, `trust/html`, `pure/render`) make a page | reuse the records as a kind of source; the library's page renderers stay where they are | `quality` is a published package of its own; the dossier reads its records and writes plates, and the page renderers are one rendition among many |
| A2 | Findings with a lifecycle and the controls they are evidence against | `findings` (logical: the lifecycle fold, the SP 800-53 mapping) | None | reuse as a kind of source | The findings lens projects what the fold says and never recomputes it |
| A3 | How each objective and requirement stands from its evidence | `assessment` (logical) | None | reuse as a kind of source | The posture lens shows the standing the library gives |
| A4 | A signed ledger, SSH signatures, DSSE, OSCAL, CycloneDX, SARIF, in-toto | `grc` (`signers/sshsig`, `signers/dsse`, `serializers/oscal`, `serializers/cyclonedx`, `serializers/sarif`, `serializers/intoto`) | A namespace for the seal; a pure verify | reuse; the seal uses the SSH signer with a namespace of its own | The seal is one more signature of `grc`, and the machine twin is its OSCAL |
| A5 | Evidence captured unattended, kept on a branch with a hash-chained journal | `evidence-capture` (0002-evidence-capture-journal) | None | reuse the branch as the place sources are read as of an instant | The as-of of FR-006 is a read of the branch at a commit |
| A6 | Readings of a property and the claim table; projections of it | 0043-asset-properties (the reading, the freshness, the projections of the claim table) | Not built yet | reuse by its types when they land; until then the posture lens takes the reading as a source kind it defines | One table gives every view, as 0043 says |
| A7 | Boundaries, dispositions, interconnections, as of an instant | 0045-boundaries, estate 0010-estate-boundaries | Not built yet | the per-boundary lenses wait for the estate API; the model carries a boundary as a selector from the start | Built after its implementation lands, not stubbed |
| A8 | Planning items and plans of action | `planning` (records, events, plans of action with milestones) | None | reuse as a kind of source for the POA&M lens | The POA&M is a view of what planning holds |

## B. Text: AsciiDoc and the rules that protect it

| # | Need | Existing library and symbols | Gap | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| B1 | A writer of AsciiDoc with the rules of escaping, anchors and fences | `docs` `src/emit/asciidoc.ts` (`textAdoc`, `lead`, the code and fence rules, `pageAnchor`, `partAnchor`) | The rules are not an export of the package | share: `docs` exports the escaping primitives at `./adoc`; the dossier imports them and writes its own small block model on top | One copy of the rules that keep text from being read as markup (FR-053) |
| B2 | The block model | `docs` `Block`, `Inline`, `Page` | It holds web blocks (tabs, cards, trends, tree) and a page's links to other pages | add a print-shaped model in the dossier; do not reuse the page model | A dossier's inlines need a cite; the web blocks have no meaning in a book |
| B3 | A site of HTML for a posture | `posture-report` (`logical/site.ts`, 104 lines, plain HTML and a stylesheet, escaping, a page for each requirement) | It writes HTML directly; it is held and has never been released | remove the library; its HTML becomes the dossier's HTML rendition and its requirement pages the posture lens; its tests' cases are kept as the lens's tests | One path from evidence to text to HTML, not two (FR-081) |
| B4 | A book from AsciiDoc: PDF, ePub and the web edition | `docs` `book.ts`; the works pipeline (`agora work build`, `agora rendition publish`, `agora rendition catalog`); erga `kinds/book` (`ebook.ts`, `print.ts`) | The pipeline is for a work with an author and a version | reuse the pinned tools and the renditions' publishing; a dossier's renditions are workloads that return files and hashes | The tools are pinned once and the catalog lists the renditions |
| B5 | Pinned downloads with a SHA-256 and a licence | `desired-os-state-pinned-downloads`; the licence rule of 0044 FR-058 | None | reuse | FR-080 and FR-084 |

## C. Structure and process

| # | Need | Existing library and symbols | Gap | Decision | Why |
| --- | --- | --- | --- | --- | --- |
| C1 | Layers of governance, logical and physical, with a checker | `kanon`; the manifests of `integrations` (host) and its plugins | None | reuse; the host `dossier` and plugins `dossier-<noun>` | FR-023 |
| C2 | Properties over generated values | `fast-check` as the other libraries use it | None | reuse | FR-004 |
| C3 | Canonical JSON and hashes | `crypto`; `estate` and `telemetry` each hold a canonical form (the dedupe list of 0041 names the duplicates) | A shared canonical JSON is not finished | the dossier uses the one of `core` or `crypto` that the dedupe work settles and adds none | A twelfth copy is the problem to avoid |
| C4 | A workload that runs a tool and keeps a receipt | `workload` (runners, receipts) | None | reuse for the renditions | FR-080 |
| C5 | A test of the same bytes on Bun and Node | the libraries' `test:node` and `bun test` pairs | None | reuse; the golden dossiers are files under `suite/` | FR-003 |

## D. What is new

The model of sources, selections, lenses, plates, the dossier, the manifest and the seal; the print-shaped block model and its cite; the redaction by construction; the diff by meaning; the as-of build; the inputs hash. Everything the library reads is an existing library's record.

## E. Removed and shared

- `posture-report` is removed (B3); the README table and the generated registers lose its row, and the two specifications that name it (0043, 0045) name the posture lens instead.
- `docs` gains one subpath export (B1).
