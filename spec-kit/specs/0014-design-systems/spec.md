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
  systems, of its own kind or another (a spoken-voice design system from a
  written-voice one). Derivation MUST be recorded in the ontology (FR-010)
  and MUST NOT form a cycle. Nothing derives from a brand design system: a
  brand themes a design system (FR-038), which is a different relation.
- **FR-021**: A derived design system inherits every rule of what it derives
  from. It MUST hold a vendored copy of whatever inherited value its own
  files use (a color, a typeface, a banned word), and its harness MUST check
  that copy agrees with the source design system. It MAY add rules and
  narrow inherited ones. It MUST NOT contradict an inherited rule except by
  a requirement of its own that cites the inherited one (`<slug> FR-NNN`)
  and states the override.

## Tokens and theming

- **FR-036**: Design tokens MUST be organized in three tiers: *primitive*
  tokens, a brand's own named values (a color, a typeface); *semantic*
  tokens, a design system's named purposes (body text, the action color),
  each referring to a primitive or theme role; and *component* tokens,
  referring to semantic ones. Every `tokens.json` MUST use the Design
  Tokens Community Group format (`$value`, `$type`, and `{group.token}` for
  a token that refers to another).
- **FR-037**: Every brand MUST supply these theme roles, each in
  `tokens.json` under `role`, as a `--brand-<role>` custom property in
  `brand.css`, and in `brand.tex` (for print) as an `xcolor` color
  `brand-<role>` or, for a font role, a command `\brandfontsans` or
  `\brandfontserif`: the colors `text`, `surface`, `primary`, `secondary`,
  `tertiary`, `success`, `warning`, `danger`, `info`, `accent` (editorial
  emphasis: a heading, a numeral, a rule) and `link`, and the font
  families `font-sans` and `font-serif`. Under `logo` in `tokens.json`, it
  MUST list its lockup files for light and for dark backgrounds, each with
  its pixel size, its icon-only mark, its favicon, and a 1200×630 share
  card (`share-card`) for link previews; `brand.tex` MUST name
  its widest lockup for light and for dark backgrounds and its widest icon
  (`\brandlockuplight`, `\brandlockupdark`, `\brandicon`), as paths inside
  the brand's directory. A brand MAY supply
  further roles that a design system it themes requires (FR-038).
- **FR-038**: A web or print design system MUST take every brand value it
  uses (a color a theme role supplies, a font family, a logo, the favicon)
  from the theme by reference, and never as a literal or a copy: a web
  design system as `var(--brand-<role>)` and, for files, from the brand's
  `tokens.json`, its cascade layer order beginning with `theme`; a print
  design system from `brand.tex`, loaded before its own definitions. Its spec MUST name every role it
  requires beyond FR-037 and the font families it ships. Pairing a design
  system with a brand is a *theme*: it MAY change only the values FR-037
  and those named roles supply, and the font families only among those the
  design system ships; it MUST NOT change layout, spacing, components,
  motion or accessibility behaviour. A web, print or merchandise design
  system MUST NOT be used without a theme.
- **FR-044**: A web, print, merchandise or figure design system MUST NOT hold a color literal.
  A color it needs that no role supplies (a neutral, a tint, a rule, a
  translucent overlay) MUST be a mix of theme roles, or of a role and
  `transparent`: `color-mix()` on the web, `xcolor`'s `<role>!<n>!<role>`
  in print. A picture it places (a hero, cover artwork) MUST be a piece of
  the theme's imagery pool (FR-043), chosen by its consumer, and a link
  preview MUST use the theme's share card. Its harness MUST fail on a color
  literal in its stylesheets or style files.
- **FR-039**: A web, print, merchandise or figure design system's harness MUST run
  under any brand vendored beside it, chosen when it runs, and MUST fail
  when that brand lacks a role the system requires, names a font family the
  system does not ship, or (on the web) makes a text pairing fall below
  WCAG 2.2 AA. A brand that lacks an optional part the system requires (an
  imagery pool, a decoration kit) cannot theme that system: the harness
  MUST report it as such and MUST NOT count it as a pass. This repository's
  CI MUST run every such design system here under every brand here, through
  `agora check design-systems` (0042-agora FR-022), which runs each harness
  under every brand while each harness still runs on its own (FR-015). A brand outside this repository is proven against
  a design system by running that system's harness under it where both are
  vendored.
- **FR-040**: A page MUST be rendered with exactly one web design system
  and one theme. A channel MAY use several, each for an area of it (a path
  prefix, a host), and MUST state which design system and which brand each
  area uses (FR-012).

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
  `ifcore:DesignSystem` individual, carrying at minimum its slug
  (`dcterms:identifier`), a label, a status
  (`ifcore:ActiveDesignSystem` or `ifcore:DraftDesignSystem`), its kind (`dcterms:type`, a concept in
  `ifcore:DesignSystemKindScheme`) and, for a web design system, its
  classification (FR-041), each design system it derives from
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
    and fails (non-zero) on any failing test;
  - runs on its own, by the command its README documents, without any
    other tool of this repository, and is also run by `agora check
    design-systems` (0042-agora FR-017), which calls it and never replaces
    it.
- **FR-027**: A design system's harness MUST cover, at minimum: every
  requirement of its spec whose register row is `check` (FR-022); that its machine-readable form agrees with
  its rules where both state the same thing; and, for a derived system, that
  its vendored copies agree with their source (FR-021).
- **FR-017**: A change to a design system's rules, machine-readable form,
  assets or harness is complete only when its harness passes. A harness
  file that is not specific to one design system (a runner) is copied into
  each system, not shared, so each directory remains self-contained per
  FR-005. `agora check design-systems` runs every harness, and each
  harness MUST still run on its own (FR-015).

## Kind profile: brand

- **FR-028**: A brand design system governs one identity: its palette, the
  theme roles it supplies (FR-037), its typeface families, its logo and
  lockups, its favicon and share card, and its imagery (FR-043). Its machine-readable form is
  `tokens.json` (FR-036), `brand.css`, which declares its theme roles as
  CSS custom properties prefixed `--brand-`, inside the `theme` cascade
  layer, and nothing else, and `brand.tex`, which declares them for print
  (FR-037) and nothing else. Its harness checks that the three agree, that it
  supplies every role of FR-037, the contrast of its role pairings, its
  logo files, its share card and its imagery pool. Its consumers are the design systems it themes and the
  channels that pair it with them. A brand that is not yet public MUST live,
  with the same layout and harness, in a repository that may hold
  confidential material, never in this one (0001-eidolon-architecture
  FR-002).

- **FR-043**: A brand MAY supply an **imagery pool**: the approved pieces
  of artwork a design system it themes, or a work set in one, may choose
  from, under `imagery/`. `imagery/catalog.json` MUST list every piece with
  its id, name, environment (from the catalog's own list), what it shows
  (description, visual anchor, route, built structures, colored elements,
  water), what it can stand for (metaphors, suggested subjects), its
  source, and its files: the master `<id>.png` with its pixel size and the
  bounds of the drawn art, and WebP files for the web, each with its size.
  Every file MUST be present at its stated size, and every master MUST be
  catalogued. Every piece MUST follow the brand's imagery rules, which its
  spec states. Which work uses which piece is that work's fact (FR-025). A
  design system that places pictures MUST name the imagery pool among the
  roles it requires (FR-038), so a brand without one cannot theme it.

## Kind profile: web presentation

- **FR-029**: A web design system governs how a web page looks and the DOM
  shape its interactive chrome expects. Its machine-readable form is its CSS
  custom properties, mirrored in `tokens.json`; it holds `css/` (with a
  `css/bundle.txt` naming the cascade order), `fonts/`, `js/`, and a markup
  contract (`chrome.md`), unless the system's own nature requires
  otherwise, and never a brand's logo, favicon, share card or imagery
  (FR-038, FR-044). Its consumers
  are channels, each pairing it with a brand (FR-038, FR-040).
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

- **FR-041**: Every web design system MUST be classified in the ontology,
  by `dcterms:type`, with concepts from three schemes, each named as the
  industry names it:
  - one or more **interaction models** it serves: under *content site*
    (read-mostly), *marketing site*, *editorial site* and *documentation*;
    under *web application* (read-write), *product application*, *back
    office*, *dashboard* and *transactional service*;
  - exactly one **expression**: *productive* (calm, dense, task-focused
    type and motion) or *expressive* (larger type, more motion and
    imagery, for marketing and editorial), as IBM's Carbon design system
    names them;
  - one or more **densities** it supports: *default*, *comfortable* or
    *compact*, as Material Design names them.
  A design system's slug MUST NOT encode these; they are facts in the
  ontology, and a system MAY serve several interaction models.

## Kind profile: print

- **FR-031**: A print design system governs how a printed or ebook book,
  paper or cover is set: page geometry, typography, layouts an author may
  choose, and the cover grammar. Its machine-readable form is its
  typesetting style files (a LaTeX preamble or class) and the data they
  read (typefaces, layouts). Its harness compiles each fixture document
  and fails on a compile error or on a check rule broken in the output.
  It is themed (FR-038): its colors, its text and sans families (among the
  families it ships) and its logos come from the brand's `brand.tex`. Its
  harness compiles each fixture under every brand beside it and checks the
  page size, that every font in the output is one it ships and is
  embedded, that the theme's colors reached the output, and that its style
  files hold no color literal.
  It holds the cover grammar (how a cover is composed, set and lettered).
  It takes cover artwork from the theme's imagery pool (FR-043) and MUST
  NOT hold artwork itself or which work uses which piece, a fact about a
  work held by the production pipeline (FR-025). Its consumers are the typesetting tools of a production
  pipeline, which are not part of it (FR-025).

- **FR-042**: Every print design system MUST be classified in the
  ontology, by `dcterms:type`, with one or more **print document types** it
  sets, named as publishing names them: *book interior*, *book cover*,
  *journal article* and *report*. A print design system's slug MUST NOT
  encode them.

## Kind profile: merchandise

- **FR-045**: A merchandise design system governs how the brand is applied
  to physical goods (branded merchandise, or promotional products): which
  decoration method may be used on which product, where the artwork goes
  on it and how large, the limits of each method (colors, minimum line,
  minimum size), and which ink or thread goes on which substrate. Its
  machine-readable form is its decoration methods and products data, and a
  decoration job (product, imprint location, method, artwork, ink,
  substrate color, width) that a consumer writes. Its harness checks fixture
  jobs that must pass and must fail, and the brand's decoration kit against
  each method's limits, under every brand here (FR-039). It is themed: its
  artwork, inks and threads come from the brand's decoration kit (FR-047),
  and it holds no artwork, logo or color of its own (FR-044). Its consumers
  are the people and tools that order goods from a decorator.
- **FR-046**: Every merchandise design system MUST be classified in the
  ontology, by `dcterms:type`, with every **decoration method** it governs
  (*screen printing*, *embroidery*, *pad printing*, *laser engraving*,
  *direct-to-garment printing*, *debossing*) and every **product category**
  (*apparel*, *headwear*, *drinkware*, *writing instruments*, *bags*), named
  as the promotional products industry names them. A slug MUST NOT encode
  them.
- **FR-047**: A brand MAY supply a **decoration kit**, under
  `$extensions["com.intellectualfrontiers.decoration"]` in `tokens.json`:
  its lockup and its icon as one-color, outlined vector artwork (SVG, every
  fill and stroke `currentColor` or `none`, with no raster, live text,
  gradient or filter), so a decorator sets the ink, each with its finest
  detail (its thinnest line or gap, as a fraction of its width); optionally
  a wordmark, the brand's name alone set in the face its lockup's wordmark
  is drawn in, as the same kind of artwork with its finest detail and
  smallest width, for goods too small for the lockup's detail; and, for each color
  role it allows on goods (at least one dark and one light), the spot-color
  and the embroidery-thread match it is reproduced with, named in a
  matching system. A vector file MUST be made from the brand's approved
  master, or for a wordmark set from its font, never redrawn or traced by
  a generative tool. Its harness checks
  the kit's files and matches.

## Kind profile: figure

- **FR-032**: A figure design system governs every figure a work or a
  channel carries, in every medium (a printed book or paper, a web page, a
  slide): its canvas, type, boxes, arrows and labelling, the figure types its
  layouts draw, its colors as figure roles, and the variants a figure may
  take. Its machine-readable form is its figure roles and the drawing kit
  that writes a figure's semantic source. It is themed (FR-038, FR-044): a
  figure's source names its colors by figure role and holds no color, font
  or stylesheet; a brand supplies them when the figure is rendered, and a
  variant may change only the values roles take or the canvas width. Its
  harness draws a figure of every type and runs its mechanical checks,
  measured in each brand's sans, over those and over fixtures that must
  fail, under every brand here (FR-039). It MUST be classified in the
  ontology, by `dcterms:type`, with every **figure type** its layouts draw,
  named as diagramming names them. Its consumers are works, channels and
  the tools that render them.
- **FR-048**: Every figure a web, print or slide presentation carries MUST be
  drawn with a figure design system and themed by the same brand as the
  presentation. A web, print, slides or course design system MUST name in the
  ontology, by `ifcore:drawsFiguresWith`, the figure design system its pages use,
  and MUST NOT define its own figure colors. A raster figure (a screenshot,
  a photograph) is a work's own asset and is exempt.

## Kind profile: slides

- **FR-049**: A slides design system governs how a talk, lecture, workshop
  or briefing is presented on a screen: its canvas, layouts, type, tones,
  footer and speaker notes, and the content limits a slide keeps to. Its
  machine-readable form is its stylesheet and the builder and checker that
  turn a deck's source into slides. It is themed (FR-038, FR-044): every
  color is a brand theme role, its figures come from a figure design
  system (FR-048), and its text is checked against the house voice. Its
  harness renders a fixture deck of every layout in a browser under every
  brand here and checks size, overflow, minimum type and contrast, and
  runs its checker over decks that must pass and must fail. It MUST be
  classified in the ontology, by `dcterms:type`, with every **deck type**
  it serves (*talk*, *lecture*, *workshop*, *briefing*). Its consumers are
  speakers, courses and the tools that build decks.

## Kind profile: media

- **FR-050**: A media design system governs the images that package a work
  for a platform: podcast and episode art, video thumbnails, title cards,
  lower thirds and social cards. Its machine-readable form is each asset
  type's size, safe area, type range and limits, and the tool that lays out
  and renders an asset from a short job. It is themed (FR-038, FR-044):
  every color is a brand theme role or a mix of two, its pictures come
  from the brand's imagery pool (FR-043) never larger than their masters,
  its logo is the brand's lockup never below its minimum, and its text is
  checked against the house voice. Its harness renders an asset of every
  type under every brand here and checks its size, contrast and limits, and
  runs its checker over jobs that must fail. It MUST be classified in the
  ontology, by `dcterms:type`, with every **media asset type** it makes,
  named as the platforms name them. Its consumers are spoken and video
  works, their publishers, and the tools that publish them.

## Kind profile: email

- **FR-051**: An email design system governs the messages the house sends
  by email: their layout, type, color, logo, footer and plain-text
  alternative, within what mail clients render (tables, inline styles, no
  custom properties, external stylesheets or scripts, hosted images). Its
  machine-readable form is its layout data and the tool that builds a
  message from a short source and checks it. It is themed (FR-038, FR-044):
  its source names colors by brand theme role and the built message
  carries them resolved, in a light and a dark tone; its text is checked
  against the house voice. Its harness builds messages under every brand
  here and checks their structure, contrast and limits, and runs its
  checker over messages that must fail. It MUST be classified in the
  ontology, by `dcterms:type`, with every **email type** it sends. Its
  consumers are the tools and people that send the house's email.

## Kind profile: course

- **FR-052**: A course design system governs how a long-form course is
  structured, paced, assessed and made accessible: its outcomes, units,
  lessons and assessments, the effort each asks of a learner, and the
  delivery targets it is compiled to. Its machine-readable form is a schema
  for a course's model, its limits, and the tool that reads a course's
  source into that model and checks it. A course's outcomes MUST each be
  taught by a lesson and assessed by an item (constructive alignment), its
  stated minutes MUST be honest for its text and video, and its lessons
  MUST meet WCAG 2.2 AA in what a source can carry (alternative text,
  captions, transcripts, headings, link text). It spans how a course looks
  and how it reads: its figures come from a figure design system (FR-048),
  its text and transcripts are checked against the house voice, and its
  delivery targets are themed by a brand (FR-038, FR-044). Its harness
  checks a fixture course that must pass and edits of it that must fail. It
  MUST be classified in the ontology, by `dcterms:type`, with every
  **course format** it supports, every **assessment item type** it
  grades, and every **delivery target** it compiles to. Its consumers are works, their courses, and the platforms
  courses are delivered on.

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
- A brand color a web design system uses: the brand supplies it as a theme
  role and the web design system references it, never copies it, per
  FR-037 and FR-038.
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
- A Studios company that wants an Intellectual Frontiers web design system
  in its own colors and logo: it supplies a brand, which themes the web
  design system unchanged, per FR-037 and FR-038; until the company is
  public its brand lives outside this repository, per FR-028.
- A brand without a role a web design system requires, or whose colors fail
  contrast in that system: the pairing fails that system's harness and is
  not a usable theme, per FR-039.
- A channel with a public site and an operator console: each area uses its
  own web design system and theme, and no page mixes them, per FR-040.
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

- **OQ-1**: No kind governs the house's own business documents (letterhead, proposals, invoices,
  contracts, memos, one-pagers) or its stationery. The business cards the house already has are to
  be loaded as the first of them. Whether this is one kind or two (documents, and stationery under
  print) is not decided.
- **OQ-2**: No kind governs motion and sound: animated titles and lower thirds, intro and outro
  stings, caption styling burned into video, a podcast's music and loudness. A media design system
  covers still images (FR-050) and a spoken-voice design system covers words (FR-034); whether
  motion and sound are one kind or two is not decided.
- **OQ-3**: Consumers pin each design system by commit (FR-026), but no design system records what
  changed between commits or whether a change breaks a consumer. Whether each keeps a change record,
  a version, or both is not decided.
- **OQ-4**: No design system is checked in a language other than English or in a right-to-left
  script; what each must support before a work is translated is not stated.
- **OQ-5**: Whether every web design system must offer a dark tone, as figure, slides and email
  design systems do, is not decided.
- **OQ-6**: No spec requires an accessibility statement for the house's public web properties.

## Key entities

- **A design system** — a self-contained, versioned set of public house
  rules for one kind of output, with their machine-readable form, assets
  and harness, at `design-systems/<slug>/`, registered in `ifcore.ttl` as
  an `ifcore:DesignSystem`.
- **A kind** — what a design system governs (brand, web
  presentation, print, merchandise, figure, written voice, spoken voice), a concept in
  `ifcore:DesignSystemKindScheme` with a profile in this spec.
- **A design system's spec** — the house rules of one design system, as
  requirements in 0020-spec-format, at `design-systems/<slug>/spec.md`.
- **Derivation** — one design system inheriting another's rules and
  carrying checked copies of the values it uses.
- **Theme** — a brand paired with a design system, supplying the theme
  roles that system takes by reference.
- **Theme role** — one value every brand supplies under a fixed name
  (`primary`, `surface`, `font-sans`, ...).
- **Interaction model, expression, density** — how a web design system is
  classified, in the industry's own terms.
- **Print document type** — what a print design system sets: book
  interior, book cover, journal article, report.
- **Figure type** — what a figure design system's layouts draw: a process
  diagram, a comparison, a cycle, layer or relationship diagram, a decision
  flowchart, a hierarchy diagram.
- **Decoration method, product category** — how a merchandise design
  system is classified, in the promotional products industry's own terms.
- **Decoration kit** — a brand's one-color vector lockup and icon, and the
  spot-color and thread match of each color role allowed on goods.
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
- **SC-009**: Every web design system here passes its harness under every
  brand here, and no web design system's stylesheets contain a brand's
  color as a literal.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact (which design systems currently exist, which
      consumers vendor which) is asserted here — all of it is ontology
      data and each design system's own files
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number
      stated as settled fact
