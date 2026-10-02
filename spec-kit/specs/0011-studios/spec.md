# Feature Specification: Intellectual Frontiers Studios

**Spec ID:** 0011-studios
**Status:** Draft

**Input:** The behavioral rules Studios' venture-building practice follows:
what has to be named before work starts, what a lifecycle gate requires,
what counts as a design partner and as evidence, the independence test a
venture must pass before it's called done, and how shared services and
portfolio categories are governed. What specific ventures, software, and
shared services currently exist is ontology and register data, not
restated here.

## Taking up an opportunity

- **FR-001**: Studios MUST name the source, owner, confidentiality,
  mandate, and possible conflicts of an opportunity before committing
  further work to it.
- **FR-002**: Studios MUST state an opportunity's Native Alpha thesis in
  plain language, per 0003-intellectual-frontiers FR-005, before
  validating it.

## The venture lifecycle

- **FR-003**: Every lifecycle stage a venture passes through MUST end in
  an explicit decision, recorded per 0008-decision-records — not silence
  or default continuation.
- **FR-004**: Studios MUST write an experiment's continue and stop
  conditions before seeing its result.
- **FR-005**: Studios MUST NOT operate a venture as a custom consulting
  shop. It MUST observe the real workflow and find the narrow repeated
  problem before deciding what can become a product or a scalable
  service.

## Evidence discipline

- **FR-006**: Studios MUST NOT treat a contact as a design partner unless
  every design-partner requirement in the ontology is satisfied. A
  friendly contact missing one is not yet a design partner.
- **FR-007**: Studios MUST NOT treat a piece of evidence as proof of
  anything beyond what the ontology states it shows.
- **FR-008**: Studios MUST apply the independence test as a single binary
  judgment — could a qualified replacement continue the venture tomorrow
  on company-controlled records, rights, systems, and relationships —
  before calling a venture independent. Studios MUST NOT decompose it
  into a scored checklist.

## Shared services

- **FR-009**: A repeated, undifferentiated capability needed across the
  portfolio MUST run as a named shared service rather than be rebuilt
  separately inside each company.
- **FR-010**: The handoff between two shared services in sequence MUST be
  a defined gate, with specs, signals, scorecards, and evidence carried
  over rather than rebuilt at the handoff.
- **FR-011**: A shared service MUST NOT be classified at the AI Workforce
  tier (0009-press's definition) unless it genuinely runs without humans
  doing most of the production work and without developers remaining in
  the daily production loop — regardless of how it is branded or
  trademarked.
- **FR-012**: A failed claim inside a shared service MUST be recorded as
  a completed result, not hidden or silently retried without a record.
- **FR-013**: A shared service not yet running MUST be described as being
  at that stage wherever it's mentioned, not presented as an operating
  service.

## Portfolio categories

- **FR-014**: A company in the portfolio classified as a venture MUST have
  its own entity, its own operator, a licensed rights position, and a
  written closure condition before its first hire.
- **FR-015**: A piece of software in the portfolio MUST record its license
  and current status rather than imply one. It MUST NOT be required to
  have an entity or an operator the way a venture must.
- **FR-016**: When internally built software turns out to be worth more
  outside the firm, it MUST be spun out rather than kept as an internal
  tool indefinitely.

## Each company's own Eidolon

- **FR-017**: A company Studios incubates MUST receive its own Eidolon —
  a public root and, where it holds anything Confidential, a private
  vault — the same separation 0001-eidolon-architecture FR-004 already
  requires for a fund, so an AI reasoning about that company's own work
  has a grounded representation of it to manage work against, not only
  prose about it.
- **FR-018**: Until a company's own Eidolon exists, Studios MUST
  represent it as individuals within Intellectual Frontiers' own
  Eidolon. That representation MUST transfer to the company's own
  Eidolon once it exists, per 0001-eidolon-architecture FR-019's
  single-source-of-truth rule — not be duplicated and left to drift in
  both places.
- **FR-019**: A company represented under FR-018 MUST live under a
  directory scoped to that company alone (`ventures/<company>/`),
  mirroring the Eidolon's own spec-kit and ontology layout, not
  scattered as loose individuals with no dedicated home. This directory
  MUST live in the private vault by default — not the public root —
  unless a specific fact or document within it is deliberately
  classified Public. A company's own raw research, strategy, or
  planning material held there is not a content document under
  0002-content-format; it MAY be authored in whatever format is
  practical until and unless it is deliberately published as one. A
  `content/` directory nested under `ventures/<company>/` is distinct
  from a repository's own content root (0004-addressing FR-004) — the
  same word names two different things, and nothing under the nested
  one is subject to 0002-content-format's rules, 0002 FR-016's
  HTML5-only authoring rule included, merely for sharing the name.
- **FR-020**: Within a company's `ventures/<company>/` directory, raw
  material supplied from outside — a founder's prompt, an external
  document, anything given rather than produced here — MUST be kept
  under `content/intake/`, distinct from the material actually prepared
  for use by the company and its staff. `docs/`, where used, is
  reserved for explaining how to operate the Eidolon repositories
  themselves, never for the company's own working material.
- **FR-021**: A company's `ventures/<company>/` directory MUST be
  removed from Intellectual Frontiers' own Eidolon once its content has
  transferred to its own Eidolon per FR-018 — not kept as a stale
  duplicate indefinitely. A company already operating as its own
  independent institution MUST NOT have a `ventures/<company>/`
  directory here at all; its material belongs entirely in its own
  Eidolon.

## Studios as a last-mile capability

- **FR-022**: Before Studios charters a venture, 0003-intellectual-frontiers
  FR-011's search-before-build rule MUST be applied, and even once it is,
  Studios MUST have at least one experiment's evidence on record before
  forming the venture as its own entity. Entity formation follows
  evidence; it does not substitute for it.
- **FR-023**: When a better-positioned operator is found during or after a
  Studios experiment, Studios MUST hand off — invest, partner, license,
  merge, or spin out — rather than retain ownership of the implementation
  to preserve its own authorship.
- **FR-024**: The ease of building something MUST NOT be treated as
  evidence that building it was worth the time spent.

## IPLG

- **FR-025**: A tool or piece of content Studios builds to make its work
  directly usable MUST be evaluated against the Native Alpha test
  (0003-intellectual-frontiers FR-005, FR-006) the same as anything else.

## Boundary

- **FR-026**: Studios activity MUST NOT be cited, by Studios or by anyone
  else, as justification for a Capital investment decision by itself —
  the unit-boundary rule in 0003-intellectual-frontiers FR-003 applies
  here by name.

## Out of scope

- The specific tools or vendors a shared service uses are operational
  detail, not spec-level.
- Compensation, cap table, or equity terms for a venture belong to
  Capital and to legal formation work, not to this spec.
- The historical roster of past ventures is provenance, not operating
  doctrine — this spec governs current practice, not history.
- Which specific ventures, software, and shared services currently exist
  is ontology and register population, not this spec.
- How a company's own Eidolon is actually provisioned — repository
  creation, access setup, migration tooling — is an implementation plan,
  not this spec. FR-017 and FR-018 establish that it must exist and that
  representation transfers to it; they do not establish how.

## Open questions

- **OQ-1**: No individual Studios lead is named, distinct from the
  founder — tracked company-wide per 0003-intellectual-frontiers OQ-1,
  not repeated here.
- **OQ-2**: No rule states whether, or how, a company continues to use a
  Studios shared service after it has been called independent, or how
  that would be governed or billed once it does.

## Key entities

- **The venture lifecycle** — the ordered stages an opportunity moves
  through on the way to being proven or stopped.
- **A design partner** — defined by a fixed set of requirements, not by
  friendliness or interest alone.
- **The independence test** — a single binary judgment, never a scored
  checklist.
- **A shared service** — a named, repeated capability run once across the
  portfolio rather than rebuilt per company.
- **A portfolio category** — venture, software, shared service, or
  operating company, each with its own obligations.
- **IPLG** — the framework for turning Studios' work into something a
  visitor can use directly, shared with 0006-research-and-ip.
- **A company's own Eidolon** — the public root (and private vault, where
  needed) a Studios-incubated company gets once it exists, so an AI can
  reason about and help manage its work directly, the same separation
  0001-eidolon-architecture FR-004 requires for a fund.
- **A company's `ventures/` directory** — the transitional home, scoped
  to one company and private by default, where it lives inside
  Intellectual Frontiers' own Eidolon before its own Eidolon exists; not
  a content document, and not present at all once the company is its
  own independent institution. Raw material supplied from outside lives
  under its `content/intake/`, distinct from `docs/` (operating the
  Eidolon repositories themselves) and from the material actually
  prepared for the company's own use.

## Success criteria

- **SC-001**: Every venture that reaches a lifecycle gate has a recorded
  decision — none show silent or default continuation.
- **SC-002**: No venture is described as having a design partner without
  every requirement satisfied.
- **SC-003**: No evidence type is cited as proving something beyond what
  it's stated to show.
- **SC-004**: A venture called independent passes the single binary
  independence test; none are called independent on a partial basis.
- **SC-005**: No shared service is classified at the AI Workforce tier
  while humans still perform most of its production work.
- **SC-006**: Every portfolio entry is classified as a venture, software,
  a shared service, or an operating company, with that category's
  obligations satisfied.
- **SC-007**: No venture is chartered as its own entity without a
  preceding experiment's evidence on record.
- **SC-008**: When a better-positioned operator is identified, the
  resulting decision is a hand-off, not continued ownership defended on
  the grounds that Studios built it first.
- **SC-009**: Every company Studios incubates either has its own Eidolon
  or is represented as individuals within Intellectual Frontiers' own
  Eidolon — never left unrepresented in either, and never duplicated in
  both once its own Eidolon exists.
- **SC-010**: No company's `ventures/` directory lives in the public root
  without a deliberate Public classification; no such directory survives
  here once that company is its own independent institution.
- **SC-011**: No raw material supplied from outside sits in a company's
  `docs/`; no company's own working material sits in its
  `content/intake/` once it has actually been prepared for use.
- **SC-012**: No document under a company's `ventures/<company>/content/`
  is mistaken for, or held to the rules of, a document under a
  repository's own content root — the two are never conflated on the
  strength of sharing a directory name.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact (which ventures, software, or shared services
      currently exist) is asserted here — all of it is ontology or
      register data
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
