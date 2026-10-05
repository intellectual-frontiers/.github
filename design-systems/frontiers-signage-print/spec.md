# Feature Specification: Frontiers Signage Print design system

**Spec ID:** frontiers-signage-print
**Status:** Draft
**Governed by:** 0014-design-systems

**Input:** How Intellectual Frontiers prints signs: posters, a roll-up banner and event badges, laid out
from a short job as vector PDF at their trim size plus bleed, themed by a brand.

## Identity and scope

- **FR-001**: `frontiers-signage-print` MUST live at `design-systems/frontiers-signage-print/` and be
  registered in `ifcore.ttl` as an `ifcore:DesignSystem` of the print kind, classified by every print
  document type it makes (poster, roll-up banner, event badge) and naming `frontiers-figures` by
  `ifcore:drawsFiguresWith` (0014-design-systems FR-031, FR-048). It is a print design system apart from
  `frontiers-print` because a sign is laid out as a picture at a physical size, not typeset as pages.
- **FR-002**: It MUST hold `formats.json`, `signage.py` (layout, rendering and the checks), `fonts/`
  (with their licence), a `README.md`, this spec and an `assurance/` harness.
- **FR-003**: It MUST hold no picture, logo or color of its own (0014-design-systems FR-044).

## Formats

- **FR-004**: It MUST make an 18×24-inch poster, an A2 poster, an 850×2000 mm roll-up banner and a 4×3-inch
  event badge, each one page of vector PDF at its trim size plus a bleed of at least 3 mm, the
  background filling the bleed.
- **FR-005**: Every element MUST sit inside its format's safe margin, and nothing but a picture MAY sit in
  the bottom 100 mm of a roll-up banner, which its stand hides. A sign carries a title, a kicker where its
  format has one, and its details (a date, a place; on a badge, the wearer's role and organization).

## Color, pictures and type

- **FR-006**: A sign MUST take a light or a dark tone; in each, its title, kicker and details MUST meet
  4.5:1 against the background under every brand.
- **FR-007**: The lockup MUST be the brand's, for the tone, and a picture a piece of the brand's imagery
  pool placed whole; neither MAY print below 150 pixels per inch, so each is placed no larger than that
  allows. A sign larger than its pieces can fill at that resolution carries them smaller, never enlarged;
  larger art needs larger masters in the imagery pool. An event badge carries no picture.
- **FR-008**: A title MUST be set in the brand's sans, bold, at the largest size in its format's range at
  which it fits the format's lines, and MUST keep to its format's words and details; no text MAY be
  below 9pt. A title or detail that does not fit is refused, never clipped.
- **FR-009**: A sign's text MUST sweep clean under `frontiers-written-voice` when it is beside this
  design system.

## Making and checking

- **FR-010**: `signage.py render` MUST render a job to PDF, drawing the sign's layout with reportlab and embedding
  only the brand's sans from `fonts/`. The PDF is RGB; a printer that needs CMYK or PDF/X converts it.
- **FR-011**: `signage.py check` MUST report every rule here a job breaks, naming the requirement.
- **FR-012**: A figure on a sign MUST be drawn with `frontiers-figures` and themed by the sign's brand
  (0014-design-systems FR-048).

## Assurance

- **FR-013**: `assurance/run.py` MUST check that `formats.json` holds no color and every bleed is at least
  3 mm; and, under every brand here, that each tone meets contrast, that a job of every format in
  `assurance/fixtures/pass/` passes the checks and renders to a one-page PDF of its trim plus bleed with
  only the sans embedded (where the `reportlab` and `pypdf` packages are installed), and that every job in
  `assurance/fixtures/fail/` is refused for the reason `assurance/fixtures/expected.json` names.

## Out of scope

- Color management for a press: the printer's.
- Booth design, stands and hardware.

## Edge cases

- A banner whose picture would print below 150 pixels per inch at full width: it is placed smaller, per
  FR-007.
- A long name on a badge: it wraps to two lines at a smaller size, or is refused, per FR-008.

## Assumptions

- A printer accepts RGB PDF with bleed and converts it as its press needs.

## Open questions

None.

## Key entities

- **Sign** — one printed piece made from a job.
- **Bleed** — the background printed past the trim so a cut never shows paper.

## Success criteria

- **SC-001**: `python3 assurance/run.py` exits zero with every brand here beside this design system.
- **SC-002**: An organizer makes an event's posters, banner and badges from short jobs with no design work.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No consumer is named or assumed
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information
