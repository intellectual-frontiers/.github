# Feature Specification: Dossiers

**Spec ID:** 0046-dossiers
**Status:** Draft
**Owner:** if
**Domain:** commons
**Governs:** dossier 0001-dossier-layers, dossier 0002-dossier-core
**Builds on:** 0043-asset-properties, 0045-boundaries, quality 0003, grc, findings, assessment, docs

**Input:** Every audit, assessment, acceptance run, board review and customer questionnaire asks the same thing of an organization: show what you know, as of a date, with the proof, to this reader. Today each answer is a project: someone gathers reports, writes prose, and the document is out of date the day it is sent. A **dossier** is a sealed, point-in-time file on one subject that is compiled from signed evidence through **lenses**, as deterministic AsciiDoc that a pinned toolchain turns into static HTML, ePub, PDF, slides, a dashboard or a machine twin. The same evidence, lenses and parameters give the same bytes; a reader can verify offline that the document is what its evidence says; one data set serves an assessor, an executive and a customer by what each lens may disclose. A new report is a new lens, never new code. A dossier is not project documentation: it is the record an organization keeps of what it can prove.

## The model

- **FR-001**: A dossier MUST be built from **sources**, never by running work: a source is one piece of evidence that already exists (a run of tests, a set of findings, a reading of a property, an assessment, a receipt, an estate as of a date, a boundary declaration, an attestation) with a kind, an id, the instant it was observed, the hash of its canonical content, and where it is signed, who signed it. A build MUST NOT call a tool, a network or a clock for anything the sources do not hold.
- **FR-002**: The terms MUST be these and no others for these things: a **source** (FR-001), a **selection** (FR-010), a **lens** (FR-020), a **plate** (FR-030), a **dossier** (the declaration of FR-100 and what it builds), a **manifest** (FR-060), a **seal** (FR-063), a **rendition** (FR-080) and a **recipe** (FR-090).
- **FR-003**: The same sources, the same lens versions and the same parameters MUST give the same AsciiDoc bytes. Nothing in a build MAY depend on the clock, the machine, the locale, the order of a directory or of a map, or randomness; every list MUST be written in an order the lens states, and ties MUST be broken by the id of the source.
- **FR-004**: The model MUST be an algebra of typed values and pure functions: the sources, the selection, the lenses and their composition, the plates, the AsciiDoc and the manifest are values; reading a source, writing a file and running a pinned tool are the only effects, and each is in the physical layer. The laws of FR-021, FR-022 and FR-035 MUST be proved by properties over generated values.
- **FR-005**: A build MUST fail, and write nothing, where a source is missing, its hash is not the hash its manifest states, a signature that the dossier requires does not verify, or a lens asks for a kind of source that the build was not given; a failure MUST name the source or the lens and never produce a partial dossier.
- **FR-006**: A dossier MUST be **as of** an instant: the build reads the sources observed at or before it and MUST say in its manifest which instant. Where the sources are kept on a branch of Git or in an append-only journal, a build as of an earlier instant MUST give what a build then would have given, from the sources then, without any other state.
- **FR-007**: The library MUST hold no product: no name, command, path, brand or endpoint of a product is in it. A product passes a brand and the paths of its sources as parameters. A recipe or a lens that needs a word of a product MUST take it as a parameter.
- **FR-008**: Prose in a dossier MUST come only from three places: the lens's own templates, which are code that is reviewed and versioned; the values of the sources; and **narrative slots** (FR-111), each of which a person has attested. No text MAY come from the output of a generative model without a person's attestation of that exact text.

## Selection

- **FR-010**: A selection MUST be a typed filter over sources by kind, by the boundary they are about (0045-boundaries), by framework, by the instant (FR-006) and by the tags the source carries. A selection MUST be a value that is compared, combined by union and intersection, and written into the manifest, so that two builds can be shown to have read the same sources.
- **FR-011**: A selection MUST be total and pure: for a set of sources it gives one list in one order, and the same selection over the same set always gives the same list.

## Lenses

- **FR-020**: A lens MUST be a typed value `{ id, version, title, inputs, ceiling, params, plate }`: the kinds of source it reads (`inputs`), the highest disclosure class its plates can carry (`ceiling`, FR-033), the parameters it takes as a decoded schema, and a pure function from the selected sources and the parameters to a plate or to a refusal that names what is missing. A lens MUST NOT read anything but its inputs.
- **FR-021**: Lenses MUST compose: `union` (the plates of both, in the order of the dossier), `restrict` (a lens narrowed by a selection), `redact` (a lens whose ceiling is lowered, FR-033) and `rollup` (many plates of one lens as one with counts). Composition MUST be associative, `union` MUST be commutative where the dossier does not order the plates, and `restrict` with a selection that no source meets MUST give no plate and no error.
- **FR-022**: A lens MUST be deterministic and total over its declared inputs (FR-003), MUST give a plate whose citations (FR-050) are among the ids of the sources it was given, and MUST give an empty plate with a statement of what is absent where its inputs are empty; it MUST NOT give a plate that reads as if the evidence were there.
- **FR-023**: Lenses MUST be an extension family of the library, in the way of `integrations`: the host `dossier` holds the contract, the algebra and the writers; a **plugin** library `dossier-<noun>` holds the lenses of one purpose (a framework, a kind of report) and depends on the host and on the libraries whose sources it reads, and the host MUST NOT depend on a plugin. A product or a firm MAY publish its own plugin without changing the host.
- **FR-024**: A lens that says **what is wrong or missing** (the negative-space lens) MUST be a lens like any other: it MUST show, for each requirement or property in its selection, whether there is no evidence, the evidence is older than its freshness, the evidence is weak, or an assessor's finding is open, and it MUST NOT hide a gap that another lens shows as met.

## Plates

- **FR-030**: A plate MUST be `{ lens, slug, title, blocks, cites, ceiling }`: a titled tree of blocks of the AsciiDoc model (FR-050), the ids of the sources it rests on, and the highest class of any value it shows.
- **FR-031**: A plate's slug MUST be stable: the words of its title and of the parameters that tell two plates of one lens apart, never a counter, a hash of the whole text or the time, so that a link to a plate survives a rebuild that changes the evidence behind it.
- **FR-032**: A plate MUST show, for each statement of fact it makes about a thing, the freshness of the evidence behind it (the instant it was observed and how old it is as of the dossier's instant), and MUST say **as of** at its head.

## Disclosure

- **FR-033**: The classes of disclosure MUST be four, in this order: `public`, `internal`, `cui`, `restricted`. A value that a source holds MUST carry its class as a type `Disclosed<C, T>`; a function that writes a value into a plate MUST take a value whose class is at most the plate's ceiling, so that a build that would put a value of a higher class into a plate of a lower ceiling does not compile where the classes are known and is refused with the lens and the source named where they are decoded.
- **FR-034**: A dossier MUST name the audience's class, and the build MUST include only plates whose ceiling is at most it; a value above the class MUST be replaced by a stated redaction (that something of the class was withheld, how many), never left out without a trace, and MUST NOT appear in any output, in the manifest's contents, in a slug, in an anchor or in a diff.
- **FR-035**: Redaction MUST be monotone: raising the audience's class never removes anything a lower class shows, and lowering it never adds anything; the dossier of a lower class MUST be a function of the dossier of a higher class (the plates withheld are replaced, and nothing else changes), and this MUST be proved as a property.
- **FR-036**: A secret (a key, a token, a password, a credential's value) MUST NOT be a value of any source or any plate in any class; a credential MUST appear as its name only.

## The AsciiDoc model

- **FR-050**: The text of a dossier MUST be AsciiDoc written from a small model of blocks and inlines: sections with anchors, paragraphs, lists, tables with a header, admonitions, source blocks, definition lists, and the inlines text, code, emphasis, strong, **cite** (a reference to the evidence) and cross-reference. It MUST use no include, no macro that needs an extension, and no attribute that is not on a fixed list, so that the pinned toolchain makes every rendition of it as it is.
- **FR-051**: A **cite** MUST write an anchor of the evidence section of the dossier (an entry with the id, the kind, the instant, the hash of its content and its signer), so that every fact in a rendition can be followed to its source; a cite of a source the dossier does not hold MUST be refused.
- **FR-052**: The writer MUST escape every value it is given so that it reads as text and never as markup, a heading, a list, an attribute, an include or a macro; it MUST write line endings as `\n`, no trailing space, and one final newline, so that the bytes do not depend on the platform.
- **FR-053**: The writer of AsciiDoc of the documentation library (docs 0001-docs FR-008) holds the rules of escaping and of anchors that this library MUST share and MUST NOT copy; the model of this library MUST be the print-shaped subset that those rules serve, and the blocks of the web page of the documentation library (tabs, cards, trends) MUST NOT be in it.

## The manifest, the seal and what is checked offline

- **FR-060**: A build MUST write a **manifest** (the evidence bill of materials) with the dossier's id, its as-of instant, the audience's class, the parameters, each lens's id and version, each source's id, kind, instant, content hash and signer (a key's fingerprint) where signed, the hash of the inputs as a whole (FR-101), and the hash of each rendition; the manifest MUST be canonical JSON, written in the same order every time, and MUST hold no value above the audience's class.
- **FR-061**: The **verify** of a dossier MUST work offline from the dossier alone: it recomputes the hash of each rendition from its bytes, checks them against the manifest, checks each signature it can with the keys given (and says which it cannot), rebuilds the AsciiDoc from the sources the dossier carries where it carries them and says whether it is the same bytes, and gives one verdict with the reasons; it MUST NOT reach a network or a clock.
- **FR-062**: A dossier MAY carry its sources (the evidence of its manifest, at its class) so that a rebuild by a stranger gives the same bytes; where it does not, verify MUST say that the rebuild is not possible and which sources are missing.
- **FR-063**: A **seal** MUST be a signature of the manifest's hash by a named authority (a person, in a role the boundary or the engagement names), with the date of the signing, made with the signer of `grc` (SSH signatures, with a namespace of its own); it MUST be made only by a person, MUST name what it covers, and MUST be refused where the manifest it covers has changed. An agent MUST NOT make or publish a seal.
- **FR-064**: A dossier MUST be **diffed** with another by meaning: sources added, removed or changed (by id and hash), plates added, removed or changed, and, for the plates of requirements and properties, the standing that changed and why (the source behind it); the diff MUST be a value, written as a plate (the **since** lens), never as a diff of text.

## Renditions

- **FR-080**: A rendition MUST be produced from the AsciiDoc by a pinned tool, never by a tool found on the machine: either a program run as a workload (FR-085) or a library pinned at an exact version in the product's manifest and lock and run in process (Asciidoctor.js for HTML); the result MUST be hashed into the manifest, and the library holds no renderer (`Renderer`, dossier 0002-dossier-core FR-013).
- **FR-081**: The renditions MUST include, in order of delivery: static HTML (one file with its stylesheet inside, no script, no address of anywhere, the same bytes for the same AsciiDoc and the same instant), ePub, PDF, slides, a **machine twin** (JSON of the plates and, where the dossier's kind has one, OSCAL: an SSP, assessment results or a POA&M, through `grc`), and a **dashboard** (static HTML with its data embedded, no server).
- **FR-082**: A rendition MUST be byte-identical for the same AsciiDoc, the same tool and the same arguments: the build MUST fix the date the tool sees (`SOURCE_DATE_EPOCH` and the document date attribute) to the dossier's as-of instant, MUST strip what a tool writes of the machine, and the tests MUST rebuild each rendition twice and compare the bytes.
- **FR-083**: HTML MUST be readable without a script, MUST have a language, a title, headings, tables with column headers and a contrast that a reader of low vision can use in light and dark, and MUST show each citation as a link to its evidence entry.
- **FR-084**: A rendition tool's licence MUST be one the library's licence rule accepts (0044-asset-connections FR-058 is the rule); a tool whose licence was not read at its pin MUST NOT run.
- **FR-085**: The workload of a rendition tool that is a program (ePub, PDF, slides) MUST be data: `{ program, version, sha256, args, env, network, licence }`, where `args` holds `{in}` and `{out}` and nothing else that varies, `env` holds `SOURCE_DATE_EPOCH` (the as-of instant in seconds), `TZ=UTC` and `LC_ALL=C.UTF-8`, `network` is `none`, and the program is a pinned download (`desired-os-state-pinned-downloads`) whose SHA-256 is verified before it runs; a rendition is not offered until its workload is pinned (FR-084).
- **FR-086**: The licence of each candidate rendition tool MUST be read at its pin and recorded before it runs: Asciidoctor.js 3.0.4 (HTML; MIT, read from its manifest), asciidoctor-epub3 (ePub; MIT, to be read at the pin), asciidoctor-pdf (PDF; MIT, to be read at the pin), the reveal.js converter (slides; MIT, to be read at the pin), and any tool with a licence that is not on the rule's list (0044-asset-connections FR-058) MUST NOT run; where a tool embeds a font or an icon, the licence of that asset MUST be read too.

## Recipes

- **FR-090**: A recipe MUST be a set of lenses with the parameters that make them one kind of dossier, shipped by a plugin (FR-023) and named by what it is for. A dossier of a fleet names a recipe, a boundary, an audience and an as-of policy; it MUST NOT hold lens code.
- **FR-091**: The first plugin MUST give these lenses and recipes: **acceptance** (the cases of an acceptance run with each step's result, each receipt, each person's attestation and the evidence frames, so that the dossier of an acceptance run is the record of it); **findings** (the findings of the tools, their lifecycle and a POA&M of the open ones with milestones); **posture** (how each requirement stands for one boundary, as 0043 states it); and **negative space** (FR-024).
- **FR-092**: Plugins for the frameworks MUST follow: CMMC (an assessment package by practice and objective), SOC 2 (an evidence binder by criterion and period, with the subservice organizations), FedRAMP (the SSP, the SAR and the POA&M), HIPAA (the risk analysis and its scope), and a pentest report (the engagement, its scope and its findings); each reuses the sources and lenses of FR-091 and adds only what its framework asks to be shown.
- **FR-093**: Further recipes MUST be reachable without a change to the host: the answers to a list of requests from an auditor (the PBC list) and to a security questionnaire, each answer a lens over the evidence with its citation and freshness; a release dossier (what shipped, its software bill of materials, its tests, its approvals); a board brief; a trust page; and an after-action report.
- **FR-094**: The library MUST NOT have a recipe, a lens or a test that names a regime's text it has not read at its source (0045-boundaries): a plate that quotes a regime MUST carry the regime's own words only where its licence allows, and otherwise a statement in the library's own words with the citation.

## Keeping a dossier current

- **FR-100**: A product's declaration of a dossier MUST state the selection of every input (boundary declarations, the declarations of the fleet and of its assets, the evidence, the findings, the receipts) and the lens set, so that the dossier knows what it is made of.
- **FR-101**: The **inputs hash** MUST be a hash of the canonical form of the manifest's inputs (the selection, each source's id and content hash, the lens ids and versions, the parameters and the audience's class); a build MUST compare it with the hash of the last build and MUST write nothing, and say so, where it is the same.
- **FR-102**: A dossier MUST be buildable on demand as of an instant (FR-006), for an audit, and the result MUST be the same as the dossier that a rebuild on the day would have given, from the sources of the day.
- **FR-103**: A product MUST be able to keep a dossier current by rebuilding it when an input changes; what triggers a build (a push, a change of the controller's state, a schedule) is the product's, and MUST be one declared list per dossier. The library MUST give the product the function that says whether a build is due (FR-101) and MUST NOT hold a trigger.

## People and agents

- **FR-110**: An agent MAY plan, build and verify a dossier (the build is deterministic and reads only what its sources hold), and MAY propose a lens, a narrative slot or a recipe; an agent MUST NOT seal, publish, attest or approve; a proposal MUST be kept for a person.
- **FR-111**: A **narrative slot** MUST be a place in a lens that holds a sentence that a machine cannot know (why a risk was accepted, what a person saw): its text MUST be an attestation (who, when, how long it is valid, the hash of the exact text), a lapsed attestation MUST show as lapsed, and a lens MUST say that the slot is empty where it is.
- **FR-112**: A dossier that goes to someone outside the organization MUST be sealed by a person with the authority its boundary names (0045-boundaries) before it is published, and the act MUST be one that is typed, planned and approved by the hash of what it covers.

## Safety

- **FR-120**: A dossier MUST NOT be able to run a tool, or reach anything, that its sources did not already make; a lens MUST NOT have an effect.
- **FR-121**: Every file that a build writes MUST be under the folder given; a path that leaves it MUST be refused; a file MUST be written whole or not at all.
- **FR-122**: The tests of the library MUST use made-up fleets and sources (`synthetic-<kind>-NN`), and MUST build secret-shaped values at run time, never in a file.

## Acceptance scenarios

1. **Given** the same sources and lenses, **When** a dossier is built twice on two platforms, **Then** the AsciiDoc and each rendition are the same bytes, per FR-003 and FR-082.
2. **Given** a value of class `cui` in a source and an audience of class `public`, **When** the dossier is built, **Then** the value is in no output, the plate says that something was withheld, and the dossier of class `cui` differs only by the plates withheld, per FR-034 and FR-035.
3. **Given** a dossier with its manifest, **When** it is verified offline after a rendition's byte changes, **Then** the verdict names the rendition, per FR-061.
4. **Given** two dossiers of a fleet a month apart, **When** they are diffed, **Then** the diff names the requirements whose standing changed and the source that changed it, per FR-064.
5. **Given** a requirement with no evidence, **When** the negative-space lens is built, **Then** it is shown as having none, per FR-024.
6. **Given** a build with the inputs of the last build, **When** it is asked to build, **Then** it writes nothing and says why, per FR-101.

## Out of scope

- The triggers of a product (FR-103), the commands that render a dossier for a person, the place a dossier is published and the key of a seal: the product.
- Typesetting beyond the pinned tools' own output; a house style of a publisher.
- Reading the texts of the regimes the lenses cite (0045-boundaries holds the reading).
- Generative drafting: a model may propose (FR-110) and is never in the build.

## Edge cases

- A source that is signed by a key that is not in the keys given is a source whose signer is unverified: it is shown as such (FR-061), never as signed.
- An empty fleet gives a dossier whose plates say that nothing is there (FR-022).
- A source of an instant after the dossier's is not read (FR-006).
- Two sources with one id and different hashes refuse the build (FR-005).

## Assumptions

- The pinned toolchains for the renditions are available as pinned downloads or images (0042 and `desired-os-state-pinned-downloads`); until a rendition's tool is pinned and its licence read (FR-084), the rendition is not offered.

## Open questions

- None.

## Key entities

- **Source**, **Selection**, **Lens**, **Plate**, **Dossier**, **Manifest**, **Seal**, **Rendition**, **Recipe**, **Narrative slot**, **Disclosure class**.

## Success criteria

- **SC-001**: An audit is a build and a seal, not a project: the dossier for the date is a command away, it is the same bytes for a stranger who has the evidence, and no reader sees more than their class allows.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT / SHOULD / MAY), not aspirational
- [x] No company fact and no product name is asserted here
- [x] Every open item is marked, not silently decided
- [x] Every requirement that reuses a library says so in the reuse audit, by its row
