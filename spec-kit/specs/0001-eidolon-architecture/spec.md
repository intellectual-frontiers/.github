# Feature Specification: The Eidolon

**Spec ID:** 0001-eidolon-architecture
**Status:** Draft

**Input:** The architecture for Intellectual Frontiers' Eidolon — repository
topology, namespace conventions, the confidentiality model, the facts and
reference model, and governance representation.

## Repository topology

- **FR-001**: The Eidolon MUST consist of exactly three repositories with distinct
  roles: a public root (`.github`), which is the public Eidolon; a private extension
  (`eidolon`), which is the private Eidolon and the monorepo where the company's works
  are made and maintained; and a web property (`www.intellectualfrontiers.com`), which
  is one channel presenting those works and holds no work of its own. Works and their
  presentations are kept apart, per 0021-works-and-presentations; the web property is
  one channel among several (print, audio, video, events, courses). A work MAY live in
  a repository of its own outside these three, in which case the vault holds its facts
  and a reference to that repository, never a copy of it.
- **FR-002**: The public root MUST contain only Public-tier facts, specs, and
  ontology. Nothing of any other confidentiality classification may be asserted
  there, regardless of how it is labeled.
- **FR-003**: The private extension MUST hold every non-public spec and ontology
  individual for Intellectual Frontiers LLC. It MUST `owl:imports` the public root's
  ontology and MUST NOT redefine or remove anything the public root declares.
- **FR-004**: A legal entity formed to hold third-party capital (a fund) MUST receive
  its own, separate Eidolon — its own public and private roots — rather than being
  represented inside Intellectual Frontiers LLC's Eidolon. It MAY inherit from
  Intellectual Frontiers' public root the way a venture inherits a unit's spec.
- **FR-005**: Persistence for both the public and private Eidolon MUST be plain Git,
  hosted on GitHub. Live, network-mounted content sources are out of scope for the
  current architecture.

## Namespaces

- **FR-006**: The company's human-facing acronym MUST remain "IF" in all prose,
  branding, and documentation.
- **FR-007**: The machine-facing RDF/OWL namespace prefixes MUST be `ifcore:` for the
  core company ontology, `ifweb:` for web content shapes, and `ifpriv:` for the
  private extension ontology. No ontology file may use a bare `if:` prefix.

## The vault

- **FR-008**: Clone access to the `eidolon` repository MUST be limited to a small,
  explicitly named circle: the founder and a close team bound by legal
  confidentiality agreements.
- **FR-009**: Every party outside that circle — employees not in the circle, NDA'd
  external counterparties, and the public — MUST access anything in `eidolon` only
  through an authenticated, mediated interface (the website, or another proxy such
  as a synced file share), never through direct repository access.
- **FR-010**: Within the vault circle, trust MUST be flat: no sub-tiering of
  confidentiality is enforced between vault members by the ontology or by repository
  permissions. Differentiation between Public, Internal, Confidential, and
  Highly-Restricted audiences is enforced only at the proxy layer, for viewers
  outside the vault.

## Confidentiality classification

- **FR-011**: Every fact asserted anywhere in the Eidolon MUST declare the
  audience(s) permitted to see it. An audience is one of: public, anyone
  affiliated with the company, a specific named agreement, or a specific named role
  or group.
- **FR-012**: A fact with no declared audience MUST default to the most restrictive
  available audience.
- **FR-013**: A fact listing more than one audience is visible to a viewer who
  satisfies any one of them, not all of them.
- **FR-014**: Audiences MUST NOT be modeled as a single linear tier. A viewer's
  clearance for one audience does not imply clearance for another, even one that
  reads as "lower."
- **FR-015**: A reference record (see Facts, below) is itself a fact and MUST carry
  its own audience declaration — the existence of a reference is not automatically
  as visible as its surrounding context.

## The sensitivity test

- **FR-016**: A fact MUST be classified as sensitive — ineligible to be stored as a
  literal anywhere in the Eidolon, public or private — when any of the following
  hold: (a) it is a third party's confidential information held under Intellectual
  Frontiers' own confidentiality obligation to them; (b) it is personally
  identifying information about any real individual; (c) its broader internal
  visibility creates legal or security risk independent of how trusted the audience
  is; (d) it is a personal financial term of an individual inside the company.
- **FR-017**: A new category of sensitive fact MUST be classified by applying
  FR-016 at the time it arises. No pre-approval or central registry of categories is
  required before a new category can be classified.
- **FR-018**: When a fact's classification under FR-016 is genuinely unclear, it
  MUST be treated as sensitive until a deliberate decision establishes otherwise.

## Facts: single source of truth

- **FR-019**: A fact MUST be stored as a literal value in exactly one place —
  wherever its single authoritative source is. Every other location MUST hold a
  reference to that source, never a duplicate value.
- **FR-020**: A fact with no external authoritative source and no sensitivity
  classification under FR-016 MAY be stored as a literal directly in its owning
  repository (`.github` if Public, `eidolon` otherwise).
- **FR-021**: A fact classified as sensitive under FR-016 MUST NOT be stored as a
  literal in any Eidolon repository. It MUST be represented as a
  `RestrictedDataReference`.

## Reference types

- **FR-022**: An `ExternalRecordReference` MUST be used for a fact whose
  authoritative source is outside Intellectual Frontiers' control (a government
  registry, a counterparty's own record). It MUST carry the location of the primary
  source, MAY carry a cached value, and if it carries a cached value MUST carry the
  date that value was last verified against the source.
- **FR-023**: A `RestrictedDataReference` MUST be used for a fact classified as
  sensitive under FR-016. It MUST carry which external system holds the real data
  and the process for requesting access to it. It MUST NOT have any field capable of
  holding the fact's actual value, and MUST NOT, under any circumstance, hold a
  credential, password, or access secret — only a description of how a properly
  authorized person obtains one.
- **FR-024**: Every `ExternalRecordReference` MUST declare a re-verification cadence
  and a verification method (automated or manual). Whether its cached value is
  currently overdue for re-verification MUST be derivable from its last-verified
  date and its cadence.
- **FR-025**: An overdue `ExternalRecordReference` MUST default to the founder's
  responsibility for re-verification unless a specific role has been delegated that
  responsibility.

## Rendering facts into static or non-live output

- **FR-026**: Any resolved value from an `ExternalRecordReference` that is captured
  into a static or non-live artifact (a document, a slide, a quoted figure, a
  generated page) MUST be stamped, visibly, with the date it was resolved as of.
- **FR-027**: A `RestrictedDataReference` MUST NOT be resolved into any static or
  non-live artifact. Such an artifact may state that the fact exists and how to
  request it; it MUST NOT contain the fact's value.

## Governance

- **FR-028**: Intellectual Frontiers LLC MUST be modeled as a single-member LLC with
  no third-party or limited-partner capital inside it. A legal entity formed to hold
  third-party capital MUST be a separate LLC, per FR-004.
- **FR-029**: Shahid Nehal Shah MUST be the default decision authority for every
  domain not explicitly delegated elsewhere. A delegation MUST be additive —
  granting a named role authority over a specific domain — and MUST NOT require a
  corresponding revocation from the default authority to take effect.
- **FR-030**: A decision MUST be checked against the authority in effect at the time
  the decision was made, not the authority in effect when the decision is later
  reviewed.
- **FR-031**: A decision resolving a Native Alpha thesis question MUST
  correspond to one of the five decision-checkpoint outcomes: continue,
  change, back someone else, build it, or stop. A significant decision
  outside that shape (legal, operational, or personnel, for instance) MAY be
  recorded without one, per 0008-decision-records FR-004. Routine
  operational activity MUST NOT require a recorded decision individual
  either way.
- **FR-032**: Decision-recording practice MUST be sized for a single-member LLC:
  lightweight, useful to the founder, without formal multi-stakeholder process
  overhead. This MUST be revisited if the company's structure changes.
- **FR-033**: A decision touching assets Intellectual Frontiers LLC wholly owns MUST
  NOT be held to a higher evidentiary standard than any other decision, because, per
  FR-028, no third-party asset currently sits inside this entity. FR-004's
  separate-Eidolon-per-fund requirement is what carries a higher standard whenever
  third-party capital becomes relevant.

## Spec maintenance

- **FR-034**: A spec MUST state only the current architecture and the intended
  future state. It MUST NOT contain change narration, dated provenance notes,
  session logs, changelogs, or resolved-question history.
- **FR-035**: Every Git commit that changes a spec or ontology file MUST carry a
  commit message stating what changed and why. Historical context belongs in commit
  messages, never in the spec itself.
- **FR-036**: If data violating the confidentiality model (FR-016, FR-021, FR-023)
  is discovered to have been committed to any Eidolon repository, rewriting that
  repository's Git history to remove it from all reachable history is REQUIRED, not
  discretionary. Any credential or secret that may have been exposed by the
  improper commit MUST also be rotated — a history rewrite alone does not undo
  exposure to anyone who already held a copy before the rewrite.
- **FR-037**: A new capability or concept MUST be established in a spec before it is
  represented in the ontology, and in the ontology before it is implemented anywhere
  else — code, content, or process. Work MUST NOT proceed out of this order.

## Edge cases

- A fact that is both a third party's confidential information and
  personally identifying: it is sensitive under either clause, so it is
  stored only as a `RestrictedDataReference`, per FR-016 and FR-021.
- An ontology class or property declaration with no audience: it is
  vocabulary rather than a fact, so it needs no audience declaration,
  per FR-011.
- A fact listing two audiences, of which a viewer satisfies only one: the
  viewer may see it, per FR-013.
- A fact whose sensitivity under FR-016 is genuinely unclear: it is
  treated as sensitive until a deliberate decision says otherwise, per
  FR-018.
- A figure from an `ExternalRecordReference` quoted in a slide: the slide
  shows the date it was resolved as of, and a restricted value may not
  appear at all, per FR-026 and FR-027.
- A decision reviewed after its domain has been delegated to a new role:
  it is judged against the authority in effect when it was made, per
  FR-030.

## Assumptions

- Repository permissions can limit clone access to named individuals, so
  the vault circle can be enforced where the repositories are hosted.
- Every viewer outside the vault reaches vault content only through a
  proxy able to apply an audience check.
- Each external source an `ExternalRecordReference` names stays reachable
  for re-verification on the reference's cadence.
- The company's legal structure stays as FR-028 models it; FR-032 and
  FR-033 would need revisiting if it changed.

## Open questions

- **OQ-1**: No emergency or successor decision authority is defined for when the
  founder is unreachable.
- **OQ-2**: No rule says whether a fact whose audience is not Public, but
  which is not sensitive under FR-016, requires a history rewrite once it
  has been committed to the public root, as FR-036 requires for sensitive
  data.

## Key entities

- **A fact** — anything asserted in the Eidolon that carries factual
  content: a label naming a real thing, a definition, a value, a job, a
  question. An ontology class or property declaration is vocabulary, not a
  fact, and does not require an audience declaration under FR-011 — only an
  individual asserting factual content does, explicitly, every time, never
  left implicit from the repository it happens to live in.
- **The Eidolon** — the three-repository system that models and serves everything
  Intellectual Frontiers knows about itself: the public Eidolon (`.github`), the
  private Eidolon where works are made (`eidolon`), and one presentation channel for
  them (`www.intellectualfrontiers.com`).
- **A digital reflection** — a maintained record of one subject, either an
  Eidolon (what exists) or an Ergon (what is created), per
  0047-digital-reflections. The Eidolon above is the system that holds them.
- **The vault** — the `eidolon` repository and the small, named, legally-bound
  circle with direct clone access to it.
- **An audience** — a named permission to see a fact: public, company
  affiliation, a specific agreement, or a specific role or group.
- **A `Reference`** — a fact that points at a value held elsewhere rather than
  storing the value itself; carries its own audience declaration.
- **An `ExternalRecordReference`** — a `Reference` to a fact Intellectual Frontiers
  does not author or control, optionally caching a dated snapshot of it.
- **A `RestrictedDataReference`** — a `Reference` to a sensitive fact Intellectual
  Frontiers does author, deliberately excluded from every Eidolon repository, with
  no field able to hold the value itself.
- **The decision checkpoint** — the five possible outcomes of a recorded decision:
  continue, change, back someone else, build it, stop.

## Success criteria

- **SC-001**: Every individual asserting factual content, in either
  repository, declares at least one audience.
- **SC-002**: No sensitive fact appears as a literal in any Eidolon
  repository, and no `RestrictedDataReference` holds a value or a
  credential.
- **SC-003**: Every `ExternalRecordReference` carries a re-verification
  cadence and method, so whether it is overdue can be computed.
- **SC-004**: No static or non-live artifact carries a resolved external
  value without its resolved-as-of date, or any restricted value.
- **SC-005**: No spec contains dated provenance or change narration.
- **SC-006**: No one outside the vault circle holds clone access to the
  vault.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No production mechanics (specific tools, file formats, hosting details) —
      those belong to an implementation plan, not this spec
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated as
      settled fact
