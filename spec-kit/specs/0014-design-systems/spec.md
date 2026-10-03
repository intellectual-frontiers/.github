# Feature Specification: Design systems

**Spec ID:** 0014-design-systems
**Status:** Draft

**Input:** Bring the design system developed in a prior, now-superseded
attempt at this repository (`.github-q326`'s `design-system/`, its own
spec `0007-design-system`) into this repository, and generalize the
single, singular directory that attempt assumed into infrastructure for
however many named design systems Intellectual Frontiers ends up
maintaining. Then generalize "design system" beyond web presentation, so
that every public house rule about how Intellectual Frontiers looks,
reads, and sounds (web pages, printed books and papers, figures, the
written voice, the spoken voice, and kinds not yet named) is held, changed,
and checked the same way, in the same directory.

## What a design system is, here

- **FR-001**: A design system is a named, self-contained, versionable set of
  public house rules for one kind of output (FR-018), together with the
  machine-readable form of those rules, the assets they govern, and an
  assurance harness that proves the rules hold (FR-015). Its kind decides what
  those parts look like: for a web design system they are CSS design tokens,
  cascade-layered stylesheets, fonts, logos, a few web components and a
  markup contract; for a written-voice design system they are style rules,
  the patterns a mechanical sweep looks for, and passages that pass and fail.
  Output here is a presentation of a work, in the sense of
  0021-works-and-presentations FR-004, or the channel it reaches people
  through (FR-011 there). A design system is not itself a channel, a work, a
  presentation, a content document, or the tool that produces a presentation
  from it (FR-025); it supplies the rules a presentation is held to and the
  assets it is built from, nothing about a work's content or where it comes
  from.
- **FR-002**: More than one design system MAY exist at once, of the same kind
  or of different kinds. Nothing in this spec or in the ontology assumes
  exactly one per kind: a future unit, acquisition, or public-facing product
  may warrant a distinct system without retiring an existing one.

## Directory convention

- **FR-003**: Every design system MUST live at
  `design-systems/<slug>/` in this repository, where `<slug>` is a short,
  URL-safe, kebab-case name. No design system MAY live anywhere else in
  this repository, and `design-systems/` MUST hold nothing but design
  systems and the top-level `README.md` required by FR-013. The directory
  is flat: a design system's kind is recorded in the ontology (FR-010,
  FR-018), never in its path.
- **FR-004**: A design system's directory is not a content root. Per
  0004-addressing FR-004, a repository's only content root is `content/`;
  nothing under `design-systems/<slug>/` is a content document, and
  0002-content-format's HTML5-content-document rules do not apply to it
  merely because an HTML reference file (e.g. a markup-contract document)
  lives inside it.
- **FR-005**: A design system directory MUST be fully self-contained: a
  consumer vendors (copies) the whole directory and needs nothing else
  from this repository to use it, beyond what its own README documents as
  external (e.g. an opt-in script it references by name but does not
  bundle). What it inherits from a design system it derives from is
  carried as a vendored copy, per FR-021.
- **FR-006**: Every design system directory MUST contain a top-level
  `README.md` (what it is for and how to use it), a `rules.md` (FR-022), its
  rules' machine-readable form where its kind profile names one, the assets
  its rules govern, and an `assurance/` harness (FR-015). Anything further
  follows its kind profile. It MUST document its actual layout in its own
  `README.md` regardless.

## Kinds

- **FR-018**: Every design system MUST have exactly one kind, drawn from the
  ontology's design system kind scheme (FR-010). A kind MUST be in that
  scheme only if this spec has a kind profile for it (FR-019), and a design
  system MUST NOT be registered under a kind with no profile. Adding a kind
  is adding a profile here and a concept to the scheme; it changes no other
  requirement and moves no directory.
- **FR-019**: A kind profile MUST state, for its kind: what the rules govern;
  what the rules' machine-readable form is, if any; what its assurance
  harness runs on and what it must cover beyond FR-023; and what a consumer
  of it is.

## Derivation

- **FR-020**: A design system MAY derive from one or more other design
  systems, of its own kind or another (a web design system from a foundation
  one; a spoken-voice design system from a written-voice one). Derivation
  MUST be recorded in the ontology (FR-010) and MUST NOT form a cycle.
- **FR-021**: A derived design system inherits every rule of what it derives
  from. It MUST hold a vendored copy of whatever inherited value its own
  files use (a color, a typeface, a banned word), and its harness MUST check
  that copy agrees with the source design system. It MAY add rules and
  narrow inherited ones. It MUST NOT contradict an inherited rule except by
  a rule of its own that names the inherited rule by its identifier
  (FR-022) and states the override.

## Rules

- **FR-022**: A design system's house rules MUST be stated in its
  `rules.md`, each under an identifier `R-NNN` that is cited from outside
  the system as `<slug> R-NNN`. An identifier MUST NOT be renumbered or
  reused; a rule that no longer applies is marked retired, with the rule
  that replaces it if any, and keeps its identifier. Prose elsewhere in the
  system (a markup contract, a guide, a worked example) explains or
  illustrates rules; it MUST NOT state a rule `rules.md` does not.
- **FR-023**: Every rule MUST name its enforcement mechanism, as the
  ontology's enforcement mechanism scheme defines them (check, gate,
  review, or none, per 0020-spec-format FR-012). A `check` rule MUST name
  the harness test or machine-readable entry that enforces it; a `review`
  rule MUST say who reviews what. A rule enforced by nothing MUST say
  `none`.
- **FR-024**: A change that adds, retires, or changes the meaning of a rule
  MUST be committed with a message stating what changed and why, as
  0001-eidolon-architecture FR-035 asks of spec changes, and MUST be
  recorded as a `Decision` wherever 0008-decision-records FR-001 makes it a
  significant decision. A lesson that a work teaches, once adopted, is
  adopted into a rule with an identifier.

## What a design system holds, and what it does not

- **FR-025**: A design system MUST hold only what is public and about the
  house as a whole: its rules, their machine-readable form, the assets they
  govern under licenses that permit publication, fixtures, and its harness.
  It MUST NOT hold the tool that produces output from it (a renderer, a
  typesetting converter, a site server), a fact about one work, person, or
  deployment (which artwork a book uses, an author's bio, which mounts a
  site exposes), or a view generated from the ontology (a glossary, per
  0016-press-production FR-050). Those belong to the consumer.

## Tracking which design systems exist

- **FR-010**: Each design system MUST be represented in `ifcore.ttl` as an
  `ifcore:DesignSystem` individual, carrying at minimum a label, a status
  (`ifcore:ActiveDesignSystem`, `ifcore:DraftDesignSystem`, or
  `ifcore:RetiredDesignSystem`), its kind (`dcterms:type`, a concept in
  `ifcore:DesignSystemKindScheme`), each design system it derives from
  (`prov:wasDerivedFrom`), and a comment naming its directory and origin.
  This is the one register of which design systems exist; nothing elsewhere
  (a separate index file, a wiki page, a status column) duplicates it.
- **FR-011**: A design system's own directory and `README.md` MUST NOT be
  the asserted source of truth for whether it is active, draft, or
  retired — that status lives in the ontology per FR-010, and the
  directory's own documentation describes how to use it, not its current
  standing.
- **FR-012**: Which design system(s) an Intellectual Frontiers channel
  (a web property, per 0021-works-and-presentations FR-011), production
  pipeline, or tool actually vendors is a fact about that consumer, not about
  the design system, and is stated by the consumer.
- **FR-026**: A consumer that vendors a design system MUST record, beside
  its vendored copies, each design system's slug and the source commit it
  was copied from, including every design system its vendored ones derive
  from. It MUST NOT edit a vendored copy in place.

## Documentation

- **FR-013**: `design-systems/README.md` MUST exist and MUST explain, in
  terms that don't assume the reader has seen this spec: what a design
  system is, the kinds there are and why more than one design system may
  exist, how derivation and rule identifiers work, and how to vendor and
  use any one of them (by pointing into that system's own README) in an
  arbitrary environment — not only one built the way this organization's
  own properties are. It MUST NOT carry design system status (FR-010).
- **FR-014**: A change to a design system's directory MUST be public (design
  systems carry no confidential material, per FR-025) and any consumer that
  has vendored it is expected to re-pull the changed files — the same
  must-be-revendored discipline the prior attempt's `0007-design-system`
  FR-013 already established for its one design system, generalized to
  apply to each one independently.

## Assurance

- **FR-015**: Every design system MUST carry an assurance harness at
  `design-systems/<slug>/assurance/`, which:
  - is at once the test runner, the report and the documentation of what the
    design system guarantees, so that what is described cannot drift from
    what is tested;
  - contains its own fixtures, outputs written to the system's rules (pages,
    passages, documents) that serve as both test subjects and reference
    examples, including fixtures that must fail where a rule is a
    prohibition;
  - needs nothing to run beyond what its kind profile names;
  - never reports a test it did not run as passed, and says how to run it;
  - is runnable headlessly, so it can gate a change in a terminal or CI,
    and fails (non-zero) on any failing test.
- **FR-027**: A design system's harness MUST cover, at minimum: every `check`
  rule in its `rules.md` (FR-023); that its machine-readable form agrees with
  its rules where both state the same thing; and, for a derived system, that
  its vendored copies agree with their source (FR-021).
- **FR-017**: A change to a design system's rules, machine-readable form,
  assets or harness is complete only when its harness passes. A harness
  file that is not specific to one design system (a runner) is copied into
  each system, not shared, so each directory remains self-contained per
  FR-005.

## Kind profile: foundation

- **FR-028**: A foundation design system governs the identity every other
  kind draws on: the palette, the typeface families, the logo and its
  lockups, and the imagery identity. Its machine-readable form is a token
  file (`tokens.json`) naming each value once. Its harness checks its token
  file against its rules and contrast of its documented color pairings. Its
  consumers are other design systems, which derive from it (FR-020).

## Kind profile: web presentation

- **FR-029**: A web design system governs how a web page looks and the DOM
  shape its interactive chrome expects. Its machine-readable form is its CSS
  custom properties, mirrored in `tokens.json`; it holds `css/` (with a
  `css/bundle.txt` naming the cascade order), `fonts/`, `images/`, `logos/`,
  `js/`, and a markup contract (`chrome.md`), unless the system's own
  nature requires otherwise. Its consumers are web properties.
- **FR-007**: A web design system's client-side implementation MUST prefer
  plain HTML, modern CSS and light vanilla JavaScript with native web
  components over any front-end framework. A framework or non-trivial
  dependency is admitted only for something small the system's own README
  states Intellectual Frontiers does not maintain the expertise to write,
  or something large and industry-standard — and either way is recorded
  there with its reason, never silently vendored.
- **FR-008**: Where a page needs client-server interactivity beyond what
  static HTML, CSS and a light web component can express — live updates
  driven from server-held state, form submission without a full
  navigation, and similar — Datastar MAY be used, opt-in per page, rather
  than reaching for a general-purpose front-end framework. This is the
  one interactivity dependency this spec names; it does not pre-authorize
  any other.
- **FR-009**: A web design system's stylesheets MUST declare tokens as CSS
  custom properties, organize rules into cascade layers, and avoid a CSS framework,
  a utility-class system, or a CSS build step.
- **FR-030**: A web design system's harness MUST run in any modern browser
  from `assurance/index.html` with no build step, install or dependency;
  MUST work from `file://` for every test that can run there, reporting
  each test that needs `fetch` or iframe inspection as skipped with how to
  run it over http; and MUST be runnable headlessly in a browser.
- **FR-016**: A web design system's harness MUST cover, beyond FR-027: that
  every token it documents is defined and that `tokens.json` agrees with the
  stylesheet; WCAG 2.2 AA contrast of its text pairings; the stylesheet
  stance of FR-009 (cascade layers, no `@import`, no remote URL, no
  framework); the markup contract on its fixtures; and its responsive
  behaviour. A system with interactive components MUST also cover each
  component's keyboard and ARIA behaviour.

## Kind profile: print

- **FR-031**: A print design system governs how a printed or ebook book,
  paper or cover is set: page geometry, typography, layouts an author may
  choose, and the cover grammar. Its machine-readable form is its
  typesetting style files (a LaTeX preamble or class) and the data they
  read (typefaces, layouts). Its harness compiles each fixture document
  and fails on a compile error or on a check rule broken in the output.
  Its consumers are the typesetting tools of a production pipeline, which
  are not part of it (FR-025).

## Kind profile: figure

- **FR-032**: A figure design system governs the figures a work carries,
  in print or on the web: palette use, line weights, labelling, and the
  layouts a figure may take. Its machine-readable form is its figure palette
  and layout data. Its harness runs its mechanical figure checks over
  fixture figures that must pass and must fail. Its consumers are works and
  the tools that check them.

## Kind profile: written voice

- **FR-033**: A written-voice design system governs how the house writes:
  voice, usage, punctuation, and the form a piece of content is presented
  in, with a named style authority for anything its rules do not settle.
  Its machine-readable form is the patterns a mechanical sweep looks for
  (banned words and phrases, forbidden punctuation). Its harness runs that
  sweep over fixture passages that must pass and must fail. A shared term's
  definition is never part of it: a rule MAY require using a term as the
  ontology defines it, and the glossary stays a generated view (FR-025).
  Its consumers are works, their audits, and the tools that check them.

## Kind profile: spoken voice

- **FR-034**: A spoken-voice design system governs how the house voice
  changes when a work is heard rather than read. It MUST derive from a
  written-voice design system (FR-020) rather than define a second voice.
  Its machine-readable form and harness are as for written voice (FR-033),
  run over scripted spoken text. Its consumers are spoken works, their
  audits, and the tools that check them.

## Out of scope

- A templating or server-side rendering engine (the prior attempt's
  `0010-templating`, with its `app-field`, `app-each`, `app-include` and
  similar constructs) is not adopted by this spec. `frontiers-nature`
  carries forward reference documentation (`templating.md`,
  `data/registry.json`) describing the vocabulary its own markup and
  chrome were originally designed against, but adopting any templating
  approach — that one, a different one, or none — is a separate, future
  decision this spec does not make.
- Which specific web properties, works and tools exist and which design
  systems each one vendors is out of scope; this spec only establishes that
  a consumer's choice is itself a fact it states, per FR-012 and FR-026.
- The production pipelines that typeset, render, record or publish output
  from a design system are out of scope (FR-025); 0016-press-production and
  0017-spoken-and-research-works govern them.
- A switch-driven dark theme remains unimplemented in `frontiers-nature`
  (its tokens exist behind `[data-theme="dark"]` but nothing wires a
  toggle to it) — carried forward from the prior attempt's open question,
  not resolved here.
- Non-Latin font subsets are not shipped by `frontiers-nature` — also
  carried forward, not resolved here.

## Edge cases

- A file two design systems would both use, such as the assurance runner:
  it is copied into each system rather than shared, and nothing but
  design systems and the top-level `README.md` sits in `design-systems/`,
  per FR-003, FR-005 and FR-017.
- A value two design systems both use, such as a brand color: one system
  owns it and the other derives from it and carries a checked copy, per
  FR-020 and FR-021; neither states it independently.
- A derived system that needs to depart from an inherited rule: it states an
  override rule naming the inherited rule's identifier, per FR-021.
- A rule that is replaced: it is marked retired and keeps its identifier,
  and the replacement takes a new one, per FR-022.
- A rule stated only in a guide or markup contract and not in `rules.md`:
  it is not a rule until `rules.md` states it, per FR-022.
- A kind of output with no profile yet, such as motion or slides: no design
  system can be registered under it until a profile and a kind concept are
  added, per FR-018 and FR-019.
- A glossary, author bio, or record of which artwork a book uses: it stays
  with the consumer, per FR-025.
- An HTML reference file inside a design system, such as its markup
  contract: it is not a content document and 0002-content-format's rules
  do not apply to it, per FR-004.
- A design system's README describing it as deprecated while the
  ontology marks it active: the ontology governs, per FR-010 and FR-011.
- A page that needs live, server-driven updates: it may opt into
  Datastar on that page alone, per FR-008; any other framework is
  admitted only with its reason recorded in the system's README, per
  FR-007.
- A web harness test that needs `fetch` or iframe inspection, opened from
  `file://`: it is reported as skipped, never as passed, with how to run
  it over http, per FR-015 and FR-030.
- A consumer holding an older vendored copy after a change: it is
  expected to re-pull the changed files, per FR-014, and its record of
  source commits shows how old its copy is, per FR-026.

## Assumptions

- A consumer can copy a design system's directory whole and use its files
  without network access to this repository.
- The browsers a web design system's consumers target support CSS custom
  properties, cascade layers and native web components without a polyfill
  or build step.
- A headless browser, a TeX distribution, or a Python interpreter is
  available wherever a harness of the kind that needs it is run outside an
  interactive session.

## Open questions

- **OQ-1**: Whether a retired design system's directory stays in
  `design-systems/` or is removed once its ontology status is retired is
  not stated.
- **OQ-2**: Whether a written-voice design system's source material (the
  writing samples and instructions its rules were drawn from) is public
  along with its rules, or stays with the consumer, is not decided.
- **OQ-3**: Whether a print design system holds a cover artwork library,
  given that art for an unpublished work is not yet public, or holds only
  the cover grammar, is not decided.
- **OQ-4**: Whether the brand values now held by `frontiers-nature` move to
  a foundation design system it derives from, and when, is not decided.

## Key entities

- **A design system** — a self-contained, versioned set of public house
  rules for one kind of output, with their machine-readable form, assets
  and harness, at `design-systems/<slug>/`, registered in `ifcore.ttl` as
  an `ifcore:DesignSystem`.
- **A kind** — what a design system governs (foundation, web
  presentation, print, figure, written voice, spoken voice), a concept in
  `ifcore:DesignSystemKindScheme` with a profile in this spec.
- **A rule** — one house rule in a design system's `rules.md`, with a
  permanent identifier and an enforcement mechanism.
- **Derivation** — one design system inheriting another's rules and
  carrying checked copies of the values it uses.
- **`frontiers-nature`** — the first design system registered under this
  spec, carried over from the prior attempt's single, unnamed design
  system; named for the "natural-frontier" visual identity its own tokens
  document.
- **A consumer** — any channel (a web property), production pipeline or
  tool, internal or external, that vendors a design system's directory to
  make presentations; this spec does not
  assume a consumer is itself part of this repository or organization.

## Success criteria

- **SC-001**: `design-systems/` contains only named design system
  directories and the one top-level `README.md`; no design system asserts
  a content document under it per FR-004.
- **SC-002**: Every design system directory has a corresponding
  `ifcore:DesignSystem` individual with a current status and a kind that
  has a profile here; no directory exists unregistered and no registered
  individual names a directory that doesn't exist.
- **SC-003**: No design system's own README, nor `design-systems/README.md`,
  is relied on as the record of whether it is active — that check always
  resolves against the ontology.
- **SC-004**: `design-systems/README.md` is sufficient, on its own, for
  someone outside this organization to vendor and use any one registered
  design system.
- **SC-005**: No web design system's CSS depends on a framework, a utility
  class system, or a build step; no page rendered with one depends on a
  JavaScript framework; any use of Datastar is opt-in per page, not
  loaded globally.
- **SC-006**: Every design system directory contains an `assurance/`
  harness that never reports a test it did not run as passing, and that
  exits zero on a clean checkout and non-zero when a rule its harness
  covers is broken.
- **SC-007**: Every rule in every `rules.md` has an identifier that has
  never been used for another rule, and an enforcement mechanism; every
  `check` rule names the test that enforces it.
- **SC-008**: No value inherited through derivation differs between a
  derived design system and its source.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact (which design systems currently exist, which
      consumers vendor which) is asserted here — all of it is ontology
      data and each design system's own files
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number
      stated as settled fact
