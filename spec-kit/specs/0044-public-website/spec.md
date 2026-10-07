# Feature Specification: The public website

**Spec ID:** 0044-public-website
**Status:** Draft

**Input:** How www.intellectualfrontiers.com is made: generated as static
files from the Eidolon, showing the company's works rather than its
structure. This spec states what the website is generated from, which
works and facts it may show, how it presents them, which addresses it
keeps, and how it is checked. What a public record holds is
0015-work-packages FR-029; what a content document is, 0002-content-format;
how addresses map to content, 0004-addressing.

## Generation

- **FR-001**: The public website MUST be a set of static files generated
  by one deterministic command run from the vault. It MUST read only the
  vault's work packages, ontology and content, and the public root's
  ontology, content and design systems, and, for the registers FR-013
  names, the snapshot it describes. Regenerating at the same commits MUST
  yield the same files.
- **FR-002**: No page MAY be authored in the web property's own repository;
  that repository, if one is kept, holds no works
  (0001-eidolon-architecture).
- **FR-003**: The generator MUST include a work only when the work is
  Public or announced (0015-work-packages FR-027), and for an announced
  work that is not Public, only its public record (0015 FR-029). It MUST
  include a content document only when its audience is Public. Nothing
  else, including a title, a slug or the existence of a work, MAY appear
  in any generated file.
- **FR-004**: The generator MUST refuse to write the website when a check
  of its own output finds a page or file showing a work that is neither
  Public nor announced, or a fact outside a public record (FR-003).

## Showing the work

- **FR-005**: The home page MUST lead with the works: what was most
  recently announced or released, and a showcase of each kind of work. A
  unit MUST NOT be the principal subject of any page except one page about
  the company (0021-works-and-presentations FR-014, FR-015).
- **FR-006**: The website MUST have, for each kind of work it shows, an
  index and a page per item: books, the Journal (0009-press), research
  papers and notes, patents, trademarks, defensive disclosures, the toolbox,
  the spoken works, ventures and companies, funds, the Network's hunts, and
  writing.
- **FR-007**: The toolbox MUST present every Public skill with its text,
  every book companion that is Public, and the interactive tools the
  previous website offered, as tools a reader can use; an interactive tool
  keeps the address the previous website published.
- **FR-008**: A book's page MUST show its front cover, its public record,
  its status (0015 FR-031), its companion and its news. Wherever the website
  shows a book's cover, on its page and on every shelf of books, it MUST show
  it as the standing 3D mockup composed from the approved front cover
  (0016-press-production FR-028), not the flat cover. Every other image on
  the website MUST come from the frontiers-brand imagery pool
  (0014-design-systems FR-044), except the home page's picture, which is the
  previous website's, read from its snapshot (FR-013); a work other than a
  book needs no image.
- **FR-009**: Writing published on a channel the company owns, and any
  work whose authoritative text lives elsewhere, MUST be shown as a
  reference that links to where it lives, never as a copy
  (0015-work-packages FR-026).
- **FR-010**: Every page's colours, type and imagery MUST come from the
  frontiers-brand design system's tokens; the generator MUST NOT state a
  colour literal of its own (0014-design-systems FR-044).

## Addresses

- **FR-011**: A patent family's page MUST answer at `/patents/<slug>`, the
  address the previous website published, and every address the previous
  website redirected to a patent page MUST keep redirecting there
  (0024-persistent-addresses FR-002).
- **FR-012**: The website MUST NOT serve the ontology: no ontology file, and
  no page at a namespace's address, which answers like any address the
  website does not serve. The ontology is read and searched in the IF
  Console (0043-if-console). An address the website does not serve MUST
  answer with one not-found page and a not-found status (0004-addressing
  FR-007).
- **FR-013**: Until a register's records are held in the public root, the
  generator MAY read that register from a snapshot of the previous
  website's data held in the vault: patents, trademarks, defensive
  disclosures, research areas, pillars, notes and papers, funds, ventures,
  companies, the Network's hunts, owned channels, the company's own
  descriptive text, the home page's picture, and the previous website's
  record pages kept as an archive. A snapshot MUST be
  refreshed only by a command, never edited by hand, and MUST hold only
  what the previous website published to the public.
- **FR-014**: The generator MUST report every address the previous
  website's sitemap lists that the generated website neither serves nor
  redirects, so nothing it published is dropped unnoticed.
- **FR-015**: Every page MUST load the analytics container the previous
  website used, and no other tracking.

## Publishing and testing

- **FR-016**: The generated website MUST be plain files that any static host
  can serve, with its routing stated in the files themselves: a redirect
  list, a header list, and the one not-found page. Every page MUST answer at
  its address without a trailing slash; the same address with a trailing
  slash, an `index` or an `.html` ending MUST redirect to it; and an address
  that matches no file and no redirect MUST answer with the not-found page
  and a not-found status.
- **FR-017**: A command MUST serve the generated website on the person's own
  computer applying exactly FR-016's routing, so what a person tests locally
  is what every publishing destination serves. A destination MUST be
  configured to route as FR-016 states, or it is not used.
- **FR-018**: The website MUST be published to a destination only through
  that destination's publishing command. Each destination MUST be described
  in the ontology before it is used: the vendor service that hosts it, its
  publishing strategy, the file holding its configuration, and the file
  holding its deployment record (0037-vendor-management-policy for the
  vendor).
- **FR-019**: A publish MUST make a preview, reachable only at the
  destination's own preview address, unless the person states that it is to
  be promoted to the destination's production, naming who decides and why.
  Pointing a domain the company holds at a destination is the decision
  authority's recorded Decision (0022-domain-names), and no publishing
  command does it.
- **FR-020**: A publish MUST first run the website's own check (FR-004) and
  refuse to upload when it fails, and MUST upload exactly the files that
  were checked.
- **FR-021**: Each publish MUST append to the destination's deployment
  record: when, the source commit, preview or production, the destination's
  version identifier, the preview address, a checksum over every uploaded
  file's content, and for a promotion who decided and why. A deployment
  record MUST NOT hold a credential, a token or a signed address.
- **FR-022**: The credentials a publish needs MUST be read from the
  environment when it runs and MUST NOT be written to any file, record or
  output.
- **FR-023**: Code that runs at a destination MUST be only what the
  destination requires in order to serve the files; it MUST NOT decide what
  is served, which FR-016's files and routing alone decide.

## Out of scope

- Which destination hosts the website, and the domain cutover to it,
  which are the decision authority's Decisions (FR-018, FR-019).
- The rules a crawler is given (robots and AI crawler rules), which are
  the decision authority's; the generator carries the previous website's
  rules unchanged.

## Edge cases

- A book at Review that is announced: its page shows its public record
  and "forthcoming", never its manuscript or a download, per FR-003,
  FR-008 and 0015 FR-031.
- A work at Review held from announcement: it appears nowhere on the
  website, per FR-003.
- A patent family the previous website reached under an older slug: the
  older address redirects to `/patents/<slug>`, per FR-011.
- A register moved from the snapshot into the public root: the generator
  reads it from the public root and the snapshot entry is removed, per
  FR-013.
- An essay published on the founder's own website: the website shows it
  as a reference to that address, per FR-009.
- A request for a namespace address such as `/ontology/core`: it answers
  with the not-found page, and the ontology is read in the IF Console, per
  FR-012.
- A publish whose check fails: nothing is uploaded, per FR-020.
- A publish with no promotion stated: only a preview is made, and the
  domain keeps serving what it served, per FR-019.
- A destination whose host requires a script even to serve plain files:
  the script only hands each request to the files, per FR-023.

## Assumptions

- The previous website published only what the company had decided to
  make public, so its snapshot may be treated as Public (FR-013).
- A static host can serve a redirect list, a header list and a not-found
  page with a not-found status, so FR-011, FR-012 and FR-016 need no
  running server.

## Open questions

- **OQ-1**: When each register held in the snapshot moves into the public
  root's ontology and content, and under which content kind, is not
  stated (0013-web-content-kinds OQ-1, OQ-2).
- **OQ-2**: Whether addresses the previous website published other than
  patent pages keep answering, beyond what 0024-persistent-addresses
  FR-001 counts as published, is not stated.

## Key entities

- **The public website** — www.intellectualfrontiers.com, generated as
  static files from the Eidolon.
- **A showcase** — the index of one kind of work, presenting each item
  with its image, record and status.
- **The toolbox** — the Public skills and book companions, presented as
  tools a reader can use.
- **A snapshot** — the previous website's published data, held in the
  vault until each register moves into the public root.
- **A publishing destination** — a host the website's files are published
  to through one command, described in the ontology by its vendor service,
  strategy, configuration file and deployment record.
- **A deployment record** — the destination's file of every publish made
  to it.

## Success criteria

- **SC-001**: No generated file names a work that is neither Public nor
  announced, or shows a fact outside an announced work's public record.
- **SC-002**: No unit is the principal subject of any page but the one
  page about the company.
- **SC-003**: Every patent address the previous website published answers
  with the family's page or a permanent redirect to it.
- **SC-004**: Every address the previous website's sitemap lists is
  served, redirected, or named in the generator's report.
- **SC-005**: No generated file is an ontology file, and every namespace
  address answers not found.
- **SC-006**: Every publish is in its destination's deployment record, and
  every production publish names who decided and why.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No production mechanics (specific tools, hosting products) — those
      belong to an implementation plan
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact
