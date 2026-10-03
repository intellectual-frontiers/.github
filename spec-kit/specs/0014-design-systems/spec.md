# Feature Specification: Design systems

**Spec ID:** 0014-design-systems
**Status:** Draft

**Input:** Every public house rule about how Intellectual Frontiers looks,
reads, and sounds (web pages, printed books and papers, figures, the written
voice, the spoken voice, and kinds not yet named) held, changed, and checked
the same way, in one directory of named design systems, of which there may be
any number of each kind.

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
  URL-safe, kebab-case name of the form `<identity>-<kind code>`: the
  identity it expresses, then the code of its kind (FR-018), as in
  `frontiers-nature-web`. No design system MAY live anywhere else in
  this repository, and `design-systems/` MUST hold nothing but design
  systems and the top-level `README.md` required by FR-013. The directory
  is flat: a design system's kind is recorded in the ontology (FR-010,
  FR-018), and its slug's suffix is derived from that record, never a
  second statement of it.
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
  `README.md` (what it is for and how to use it), a `spec.md` (FR-022), its
  rules' machine-readable form where its kind profile names one, the assets
  its rules govern, and an `assurance/` harness (FR-015). Anything further
  follows its kind profile. It MUST document its actual layout in its own
  `README.md` regardless.

## Kinds

- **FR-018**: Every design system MUST have exactly one kind, drawn from the
  ontology's design system kind scheme (FR-010). A kind MUST be in that
  scheme only if this spec has a kind profile for it (FR-019), and a design
  system MUST NOT be registered under a kind with no profile. Each kind
  concept MUST carry a short code (`skos:notation`), unique in the scheme,
  that ends the slug of every design system of that kind (FR-003). A design
  system's kind MUST NOT change: output of another kind is a new design
  system. Adding a kind
  is adding a profile here and a concept to the scheme; it changes no other
  requirement and moves no directory.
- **FR-019**: A kind profile MUST state, for its kind: what the rules govern;
  what the rules' machine-readable form is, if any; what its assurance
  harness runs on and what it must cover beyond FR-027; and what a consumer
  of it is.

## Derivation

- **FR-020**: A design system MAY derive from one or more other design
  systems, of its own kind or another (a web design system from a brand
  one; a spoken-voice design system from a written-voice one). Derivation
  MUST be recorded in the ontology (FR-010) and MUST NOT form a cycle.
- **FR-021**: A derived design system inherits every rule of what it derives
  from. It MUST hold a vendored copy of whatever inherited value its own
  files use (a color, a typeface, a banned word), and its harness MUST check
  that copy agrees with the source design system. It MAY add rules and
  narrow inherited ones. It MUST NOT contradict an inherited rule except by
  a requirement of its own that cites the inherited one (`<slug> FR-NNN`)
  and states the override.

## Rules

- **FR-022**: A design system's house rules MUST be stated as the
  requirements of a spec at `design-systems/<slug>/spec.md`, whose Spec ID
  is the slug and which is governed by this spec. That spec MUST follow
  0020-spec-format in full: its requirement identifiers, cited from outside
  as `<slug> FR-NNN`, are never renumbered or reused; its status is Draft or
  Adopted and moves only as 0020-spec-format FR-009 and FR-010 allow; and
  each requirement has a row in the enforcement register. Prose elsewhere in
  the system (a markup contract, a guide, a worked example) explains or
  illustrates rules; it MUST NOT state a rule the spec does not. A long list
  a rule depends on (banned words, a palette) MAY be held in the system's
  machine-readable form and cited by the requirement, not restated in it.
- **FR-023**: A change to a design system's spec is a spec amendment
  (0001-eidolon-architecture FR-034, FR-035), whether it adds, retires, or
  changes the meaning of a house rule. A lesson a work teaches becomes a
  house rule only by being written into that spec as a requirement.

## What a design system holds, and what it does not

- **FR-025**: A design system MUST hold only what is public and about the
  house as a whole: its rules, their machine-readable form, the assets they
  govern under licenses that permit publication, fixtures, and its harness.
  It MUST NOT hold the tool that produces output from it (a renderer, a
  typesetting converter, a site server), a fact about one work, person, or
  deployment (which artwork a book uses, an author's bio, which mounts a
  site exposes), or a view generated from the ontology. Those belong to the
  consumer.

## Tracking which design systems exist

- **FR-010**: Each design system MUST be represented in `ifcore.ttl` as an
  `ifcore:DesignSystem` individual, carrying at minimum a label, a status
  (`ifcore:ActiveDesignSystem` or `ifcore:DraftDesignSystem`), its kind (`dcterms:type`, a concept in
  `ifcore:DesignSystemKindScheme`), each design system it derives from
  (`prov:wasDerivedFrom`), and a comment naming its directory.
  This is the one register of which design systems exist; nothing elsewhere
  (a separate index file, a wiki page, a status column) duplicates it.
- **FR-011**: A design system's own directory and `README.md` MUST NOT be
  the asserted source of truth for whether it is active or draft — that
  status lives in the ontology per FR-010, and the
  directory's own documentation describes how to use it, not its current
  standing.
- **FR-035**: A design system that is no longer used MUST be removed by
  deleting its directory and its `ifcore:DesignSystem` individual in the
  same change, and every design system that derives from it MUST first stop
  doing so. Nothing in this repository records a removed design system;
  Git does. A consumer holding a vendored copy keeps it until it next
  re-vendors (FR-014).
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
  exist, how slugs are formed, how derivation works, where each system's
  rules are stated, and how to vendor and
  use any one of them (by pointing into that system's own README) in an
  arbitrary environment — not only one built the way this organization's
  own properties are. It MUST NOT carry design system status (FR-010).
- **FR-014**: A change to a design system's directory MUST be public (design
  systems carry no confidential material, per FR-025) and any consumer that
  has vendored it is expected to re-pull the changed files, each design
  system independently.

## Assurance

- **FR-015**: Every design system MUST carry an assurance harness at
  `design-systems/<slug>/assurance/`, which:
  - is at once the test runner, the report and the documentation of what the
    design system guarantees, so that what is described cannot drift from
    what is tested;
  - contains its own fixtures, outputs written to the system's rules (pages,
    passages, documents) that serve as both test subjects and reference
    examples; where the harness sweeps content for prohibited patterns (a
    written-voice sweep, a figure check), fixtures that must fail as well
    as fixtures that must pass;
  - needs nothing to run beyond what its kind profile names;
  - never reports a test it did not run as passed, and says how to run it;
  - is runnable headlessly, so it can gate a change in a terminal or CI,
    and fails (non-zero) on any failing test.
- **FR-027**: A design system's harness MUST cover, at minimum: every
  requirement of its spec whose register row is `check` (FR-022); that its machine-readable form agrees with
  its rules where both state the same thing; and, for a derived system, that
  its vendored copies agree with their source (FR-021).
- **FR-017**: A change to a design system's rules, machine-readable form,
  assets or harness is complete only when its harness passes. A harness
  file that is not specific to one design system (a runner) is copied into
  each system, not shared, so each directory remains self-contained per
  FR-005.

## Kind profile: brand

- **FR-028**: A brand design system governs the identity every other
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
  It holds the cover grammar (how a cover is composed, set and lettered)
  and MUST NOT hold cover artwork, its library, or which work uses which
  piece: those are facts about works, held by the production pipeline
  (FR-025). Its consumers are the typesetting tools of a production
  pipeline, which are not part of it (FR-025).

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
  ontology defines it. Its rules MUST be stated as the house's voice, not as
  any one person's, and it MUST NOT hold the source material its rules were
  drawn from (writing samples, instructions written for or about a named
  person, audit prompts): that material stays with the consumer (FR-025).
  Its consumers are works, their audits, and the tools that check them.

## Kind profile: spoken voice

- **FR-034**: A spoken-voice design system governs how the house voice
  changes when a work is heard rather than read. It MUST derive from a
  written-voice design system (FR-020) rather than define a second voice.
  Its machine-readable form and harness are as for written voice (FR-033),
  run over scripted spoken text. Its consumers are spoken works, their
  audits, and the tools that check them.

## Out of scope

- A templating or server-side rendering engine. A web design system MAY
  document an optional template vocabulary its markup contract is written
  against; implementing one is each consumer's own decision.
- Which specific web properties, works and tools exist and which design
  systems each one vendors is out of scope; this spec only establishes that
  a consumer's choice is itself a fact it states, per FR-012 and FR-026.
- The production pipelines that typeset, render, record or publish output
  from a design system are out of scope (FR-025); 0016-press-production and
  0017-spoken-and-research-works govern them.
- What any one design system holds beyond this spec's requirements: its own
  spec states it.

## Edge cases

- A file two design systems would both use, such as the assurance runner:
  it is copied into each system rather than shared, and nothing but
  design systems and the top-level `README.md` sits in `design-systems/`,
  per FR-003, FR-005 and FR-017.
- A value two design systems both use, such as a brand color: one system
  owns it and the other derives from it and carries a checked copy, per
  FR-020 and FR-021; neither states it independently.
- A derived system that needs to depart from an inherited rule: it states an
  override requirement citing the inherited one, per FR-021.
- A house rule that is replaced: its requirement number stays retired and
  the replacement takes the next unused one, per FR-022 and
  0020-spec-format FR-008.
- A rule stated only in a guide or markup contract and not in the system's
  spec: it is not a rule until the spec states it, per FR-022.
- A design system created for a new kind of output from an existing one,
  such as a print counterpart of a web system: it is a new design system
  with its own slug, per FR-003 and FR-018.
- A design system no longer used: its directory and ontology individual are
  removed together once nothing derives from it, per FR-035.
- A written-voice rule drawn from a named person's writing: it is stated as
  the house's rule, and the writing stays with the consumer, per FR-033.
- Cover art for a work not yet published: it is never in a design system,
  per FR-031 and FR-025.
- A kind of output with no profile yet, such as motion or slides: no design
  system can be registered under it until a profile and a kind concept are
  added, per FR-018 and FR-019.
- An author bio, or a record of which artwork a book uses: it stays
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

None.

## Key entities

- **A design system** — a self-contained, versioned set of public house
  rules for one kind of output, with their machine-readable form, assets
  and harness, at `design-systems/<slug>/`, registered in `ifcore.ttl` as
  an `ifcore:DesignSystem`.
- **A kind** — what a design system governs (brand, web
  presentation, print, figure, written voice, spoken voice), a concept in
  `ifcore:DesignSystemKindScheme` with a profile in this spec.
- **A design system's spec** — the house rules of one design system, as
  requirements in 0020-spec-format, at `design-systems/<slug>/spec.md`.
- **Derivation** — one design system inheriting another's rules and
  carrying checked copies of the values it uses.
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
- **SC-007**: Every design system directory has a `spec.md` that passes the
  spec check, and every one of its requirements has a row in the
  enforcement register; every design system's slug ends with its kind's
  code.
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
