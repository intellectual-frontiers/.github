# Feature Specification: Design systems

**Spec ID:** 0014-design-systems
**Status:** Draft

**Input:** Bring the design system developed in a prior, now-superseded
attempt at this repository (`.github-q326`'s `design-system/`, its own
spec `0007-design-system`) into this repository, and generalize the
single, singular directory that attempt assumed into infrastructure for
however many named design systems Intellectual Frontiers ends up
maintaining. The first one brought over and registered is
`frontiers-nature`.

## What a design system is, here

- **FR-001**: A design system is a self-contained, versionable set of
  visual and front-end assets — CSS design tokens, cascade-layered
  stylesheets, self-hosted fonts, logos and images, a small set of web
  components, and a written markup contract for the page chrome it
  defines — that any Intellectual Frontiers web property MAY vendor and
  render against. It is not itself a web property, a content document, or
  a templating engine; it supplies what a web property's pages look like
  and the DOM shape its interactive chrome expects, nothing about where
  that property's content or business logic comes from.
- **FR-002**: More than one design system MAY exist at once. Nothing in
  this spec or in the ontology assumes exactly one — a future unit,
  acquisition, or public-facing product may warrant a visually distinct
  system without retiring an existing one.

## Directory convention

- **FR-003**: Every design system MUST live at
  `design-systems/<slug>/` in this repository, where `<slug>` is a short,
  URL-safe, kebab-case name. No design system MAY live anywhere else in
  this repository, and `design-systems/` MUST hold nothing but design
  systems and the top-level `README.md` required by FR-013.
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
  bundle).
- **FR-006**: A design system directory SHOULD follow the layout already
  proven by `frontiers-nature` (`css/`, `fonts/`, `images/`, `logos/`,
  `js/`, `data/`, `tokens.json`, a markup-contract document, a top-level
  `README.md`) unless the system's own nature requires otherwise; it MUST
  document its actual layout in its own `README.md` regardless.

## Engineering stance

- **FR-007**: A design system's client-side implementation MUST prefer
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
- **FR-009**: A design system's own stylesheets MUST declare tokens as CSS
  custom properties, organize rules into cascade layers, and avoid a CSS
  framework, a utility-class system, or a CSS build step — the same
  discipline `frontiers-nature` already follows (reset, tokens, base,
  chrome, components).

## Tracking which design systems exist

- **FR-010**: Each design system MUST be represented in `ifcore.ttl` as an
  `ifcore:DesignSystem` individual, carrying at minimum a label, a status
  (`ifcore:ActiveDesignSystem`, `ifcore:DraftDesignSystem`, or
  `ifcore:RetiredDesignSystem`), and a comment naming its directory and
  origin. This is the one register of which design systems exist; nothing
  elsewhere (a separate index file, a wiki page) duplicates it.
- **FR-011**: A design system's own directory and `README.md` MUST NOT be
  the asserted source of truth for whether it is active, draft, or
  retired — that status lives in the ontology per FR-010, and the
  directory's own documentation describes how to use it, not its current
  standing.
- **FR-012**: Which design system(s) an Intellectual Frontiers web
  property actually vendors is a fact about that property, not about the
  design system — out of scope here until a spec for that web property
  states it.

## Documentation

- **FR-013**: `design-systems/README.md` MUST exist and MUST explain, in
  terms that don't assume the reader has seen this spec: what a design
  system is, why more than one may exist, the engineering stance of
  FR-007–FR-009, and how to vendor and use any one of them (by pointing
  into that system's own README for its specific asset list) in an
  arbitrary web environment — not only one built the way this
  organization's own properties are.
- **FR-014**: A change to a design system's directory MUST be public (design
  systems carry no confidential material) and any consumer that has
  vendored it is expected to re-pull the changed files — the same
  must-be-revendored discipline the prior attempt's `0007-design-system`
  FR-013 already established for its one design system, generalized to
  apply to each one independently.

## Out of scope

- A templating or server-side rendering engine (the prior attempt's
  `0010-templating`, with its `app-field`, `app-each`, `app-include` and
  similar constructs) is not adopted by this spec. `frontiers-nature`
  carries forward reference documentation (`templating.md`,
  `data/registry.json`) describing the vocabulary its own markup and
  chrome were originally designed against, but adopting any templating
  approach — that one, a different one, or none — is a separate, future
  decision this spec does not make.
- Which specific web properties exist and which design system each one
  vendors is out of scope; this spec only establishes that a property's
  choice is itself a fact to be stated somewhere, per FR-012.
- A switch-driven dark theme remains unimplemented in `frontiers-nature`
  (its tokens exist behind `[data-theme="dark"]` but nothing wires a
  toggle to it) — carried forward from the prior attempt's open question,
  not resolved here.
- Non-Latin font subsets are not shipped by `frontiers-nature` — also
  carried forward, not resolved here.

## Key entities

- **A design system** — a self-contained, versioned set of visual and
  front-end assets at `design-systems/<slug>/`, registered in `ifcore.ttl`
  as an `ifcore:DesignSystem`.
- **`frontiers-nature`** — the first design system registered under this
  spec, carried over from the prior attempt's single, unnamed design
  system; named for the "natural-frontier" visual identity its own tokens
  document.
- **A consumer** — any web property, internal or external, that vendors a
  design system's directory to render its own pages; this spec does not
  assume a consumer is itself part of this repository or organization.

## Success criteria

- **SC-001**: `design-systems/` contains only named design system
  directories and the one top-level `README.md`; no design system asserts
  a content document under it per FR-004.
- **SC-002**: Every design system directory has a corresponding
  `ifcore:DesignSystem` individual with a current status; no directory
  exists unregistered and no registered individual names a directory that
  doesn't exist.
- **SC-003**: No design system's own README is relied on as the record of
  whether it is active — that check always resolves against the ontology.
- **SC-004**: `design-systems/README.md` is sufficient, on its own, for
  someone outside this organization to vendor and render a basic page
  with any one registered design system.
- **SC-005**: No design system's CSS depends on a framework, a utility
  class system, or a build step; no page rendered with one depends on a
  JavaScript framework; any use of Datastar is opt-in per page, not
  loaded globally.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact (which design systems currently exist, which
      properties vendor which) is asserted here — all of it is ontology
      data and each design system's own files
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number
      stated as settled fact
