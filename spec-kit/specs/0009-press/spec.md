# Feature Specification: Intellectual Frontiers Press

**Spec ID:** 0009-press
**Status:** Draft

**Input:** The behavioral rules Press's output follows: how a claim is
labeled, how Native Alpha gets made legible without being invented, how
Press works with companies outside the parent, how publishing is read as
evidence, how a Fieldbook ships as more than pages, and who owns the
words on every surface Press is responsible for. What Press has actually
published, which channels it owns, and the current register of works are
ontology data and registers, not restated here.

## Claims and evidence

- **FR-001**: Press MUST NOT publish a claim without identifying it as one
  of four kinds: an observable fact, an opinion, a framework, or an
  illustration.
- **FR-002**: Press MUST NOT use narrative to cover weak evidence, and MUST
  NOT manufacture reader approval.
- **FR-003**: Press MUST make Native Alpha legible, credible, useful, and
  durable. Press presents Native Alpha that has already been discovered,
  by Intellectual Frontiers' discovering units or by others, per
  0003-intellectual-frontiers FR-018. Press MUST NOT invent an advantage
  that does not already exist, and MUST NOT originate a Native Alpha
  claim, evident or latent, that no discovery supports. Press's novelty
  lies in how it documents and presents an advantage, never in the
  advantage itself.
- **FR-029**: A piece presenting Native Alpha MUST name where the
  discovery came from: the unit, `Note`, or research pillar, or the
  outside party. It MUST NOT present another party's discovery as the
  firm's own, per FR-022 and FR-023.
- **FR-030**: Press MUST present a latent claim
  (0003-intellectual-frontiers FR-014) as provisional, labeled a
  framework or an opinion under FR-001 and not an observable fact, until
  it has changed an actual decision, per 0003-intellectual-frontiers
  FR-016.

## Voice

- **FR-004**: Every piece Press produces MUST hold to four voice
  principles: evidence-led, practical, skeptical, and plain.

## Working with companies outside the parent

- **FR-005**: When Press helps a Studios company build its voice, the goal
  MUST be capability transfer — the company learns to own its voice,
  source material, channels, and archive — not permanent dependence on
  Press.
- **FR-006**: When Press helps an IF Capital company, that help MUST be
  collaborative and optional. An investment MUST NOT be treated as
  granting Press editorial control or a promise of favorable coverage.

## Scope and levels

- **FR-007**: A piece written at one of Press's five levels MUST address
  what that level covers, per the levels in the ontology, rather than a
  generic account that blurs levels together.
- **FR-008**: Press MUST NOT wait for outside coverage to explain the firm
  correctly. Outside coverage may add reach, scrutiny, or independent
  validation, but MUST NOT replace the firm's own account.
- **FR-009**: Press's work MUST be evaluated by whether it improves
  understanding and helps somebody make a better decision — not by
  whether it fills a content calendar.

## Corrections and sourcing

- **FR-010**: When a published claim or number turns out to be wrong,
  Press MUST run the correction with the same prominence as the original
  claim, in place, and MUST credit whoever caught the error unless they
  ask otherwise.
- **FR-011**: A published piece MUST carry the evidence for its claims —
  named systems, dated numbers, and the constraint that made the problem
  hard — and MUST be organized by the market it addresses.
- **FR-012**: A recurring editorial thread (framing AI by which new work
  becomes possible rather than hours saved, for instance) MUST still
  satisfy FR-001 and FR-002 — using a thread deliberately does not exempt
  it from being evidence-based and honest about the advantage's limits.
- **FR-013**: Press MUST format a piece to match how its intended audience
  actually consumes material, rather than defaulting to one format for
  every audience.

## Publishing as experimentation

- **FR-014**: Press MUST treat publication as an experiment, not only as
  output: the reception a piece gets MUST be read as evidence about the
  underlying thesis, in the ascending order of strength the ontology's
  evidence ladder states.
- **FR-015**: Press MUST NOT treat the absence of criticism or argument as
  confirmation of a claim; unopposed does not mean validated.

## Books as working AI

- **FR-016**: A Fieldbook that teaches an actionable method MUST make that
  method available to a reader's own AI, as a skill, an MCP tool, or both
  — not only as prose.
- **FR-017**: A skill or MCP tool Press ships MUST execute the method a
  Fieldbook teaches faithfully. It MUST NOT make the judgment, decision,
  or interpretation the book teaches a reader to make for themselves —
  legible and useful, never a substitute for the reader's own judgment.
- **FR-018**: "AI Workforce" and "Labor as Code" MUST be used as defined,
  consistent terms across every piece Press produces that uses them, the
  same way "Native Alpha" already is.

## Major works beyond books

- **FR-019**: A major work Press produces MAY be a book, a website, a
  piece of software, or an event — evaluated against FR-001 through
  FR-003 the same way regardless of format. Format does not change the
  evidence standard.

## The Journal

- **FR-020**: A standing periodical Press publishes MUST be represented
  as a `schema:Periodical`, distinct from a one-off work like a book —
  its own current roster of issues and articles is ontology and register
  data, not restated here.
- **FR-021**: An article the Journal publishes MUST satisfy FR-001
  through FR-004 the same as any other Press output. A standing
  publication earns no exemption from claim-kind labeling, the evidence
  standard, or the four voice principles.
- **FR-022**: An article derived from the firm's own tracked research (a
  `Note` or `ResearchPillar`, per 0006-research-and-ip) MUST be related
  to it by `prov:wasDerivedFrom`, per 0007-work-and-assets FR-016. The
  article is the publication; the Note or pillar it was drawn from
  remains the primary research record.
- **FR-023**: A concept with research behind it that originates outside
  Intellectual Frontiers — authored by the founder elsewhere, for
  instance — MUST be referenced from the Journal article rather than
  republished as if the Journal were its primary source, per
  0007-work-and-assets FR-016.

## Events and partnerships

- **FR-024**: Press MUST NOT build its own event arm. Where a concept
  earns a stage, Press MUST partner with an operator who owns the venue,
  ticketing, and logistics, and MUST hold a talk to the same editorial
  bar as print — no slide goes in front of an audience that would not
  pass FR-001 and FR-002.

## Written public-facing surfaces

- **FR-025**: Press MUST be responsible for the accuracy, voice, audit
  step, and change-disclosure of every written public-facing content on
  a web property the company operates. Code, design, and infrastructure
  remain engineering's, not Press's.
- **FR-026**: Press MUST be responsible for the same standard on a
  third-party supplier or vendor registry profile. Unlike a channel it
  owns outright, a registry profile's platform and fields belong to the
  registry — Press owns only the words entered into it.
- **FR-027**: Press MUST review every surface FR-025 and FR-026 cover
  against the current record on a quarterly cadence, and additionally
  within ten business days of any fact a surface states changing. Each
  review MUST be dated and recorded as passed or found-stale.

## Owned channels

- **FR-028**: A publication Press owns outright MUST be represented as a
  `DigitalAsset`, per 0007-work-and-assets FR-007 — not merely named in
  prose.

## Out of scope

- The full voice principles, beyond the four named in FR-004, belong to a
  future brand spec; what's stated here is the minimum Press's own rules
  need to be testable.
- The current register of books, software, and other major works — what
  Press has actually published — is ontology and register data, not
  spec-level, the same reasoning `context/registers.md`'s pattern already
  established for patents.
- Which specific publications Press owns outright, and verifying their
  ownership, is ontology population, not this spec.
- Where Press's own production detail (a method's skill or MCP source,
  how it's built and reviewed) lives relative to the vault is not decided
  here.

## Edge cases

- A piece that mixes a measured result with the author's reading of it:
  each claim carries its own kind, so the result is an observable fact
  and the reading an opinion or a framework, per FR-001.
- A latent Native Alpha claim that has not yet changed a decision: it is
  presented as provisional and labeled a framework or an opinion, never
  an observable fact, per FR-030, and names its source, per FR-029.
- An article that draws on both a tracked `Note` and a concept that
  originated outside the firm: it is related to the `Note` by
  `prov:wasDerivedFrom`, per FR-022, and references the outside concept
  rather than republishing it, per FR-023.
- A piece that draws no criticism and no argument: the silence is not
  read as confirmation, per FR-015; its reception is placed on the
  evidence ladder like any other, per FR-014.
- A fact on a vendor registry profile changes between quarterly reviews:
  the profile's words are Press's, per FR-026, and are reviewed within
  ten business days of the change, per FR-027.
- A Fieldbook method whose last step is a judgment the reader must make:
  the companion skill or MCP tool runs the method up to that judgment and
  leaves the judgment to the reader, per FR-017.

## Assumptions

- Each claim in a piece can be assigned exactly one of the four claim
  kinds FR-001 names.
- The ontology holds the Press levels, the claim kinds, and the evidence
  ladder that FR-001, FR-007, and FR-014 point to.
- A reader's own AI can load a skill or call an MCP tool, so FR-016's
  companion is usable by the reader it is meant for.
- Every surface FR-025 and FR-026 cover can be listed, so the review
  FR-027 requires can find each one.

## Open questions

- **OQ-1**: No individual Press lead is named, distinct from the founder —
  tracked company-wide per 0003-intellectual-frontiers OQ-1, not repeated
  here.
- **OQ-2**: No process is stated for whether Press retains any oversight
  of a company's claims-standard compliance after capability transfer is
  complete and the company owns its own voice.
- **OQ-3**: No rule states whether FR-005 or FR-006 governs Press's help
  to a company that is both a Studios company and an IF Capital company.

## Key entities

- **A claim kind** — observable fact, opinion, framework, or illustration;
  every claim Press publishes carries one.
- **The evidence ladder** — the ascending-strength reception signals a
  publication's reception is read against.
- **A Press level** — one of five scopes a piece can be written at: the
  firm, a business unit, a Studios company, an IF Capital company, or IF
  Network.
- **AI Workforce** and **Labor as Code** — defined terms naming the
  pattern a Fieldbook teaches a reader to build, and what a reader's own
  work can become once named and made durable.
- **The Journal** — a standing periodical, distinct from a one-off book;
  an article it publishes is related to the research it was drawn from
  by `prov:wasDerivedFrom`, never presented as the primary record.

## Success criteria

- **SC-001**: Every published claim is labeled by kind — none appear
  unlabeled.
- **SC-002**: A Studios company Press has worked with can produce its own
  material without Press's involvement at some point.
- **SC-003**: No IF Capital company's coverage is contingent on its
  investment relationship.
- **SC-004**: A correction carries the same prominence as the original
  claim and appears in place, not buried or omitted.
- **SC-005**: A piece's reception is recorded and read back against the
  thesis it was meant to test, not published and never revisited.
- **SC-006**: A Fieldbook that teaches an actionable method has a
  companion skill or MCP tool, not only prose describing it.
- **SC-007**: "AI Workforce" and "Labor as Code" carry the same meaning
  everywhere they appear; no piece redefines them locally.
- **SC-008**: No owned channel's accuracy is reviewed less often than
  quarterly, and no stale fact survives ten business days unreviewed.
- **SC-009**: No Journal article derived from the firm's own tracked
  research omits `prov:wasDerivedFrom`; no article republishes an
  externally-originated concept as if the Journal were its primary
  source.
- **SC-010**: Every piece presenting Native Alpha names the source of its
  discovery, and no latent claim is labeled an observable fact.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact (which books exist, which channels are owned, the
      current register) is asserted here — all of it is ontology or
      register data
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
