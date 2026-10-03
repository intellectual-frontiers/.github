# Feature Specification: Frontiers Media design system

**Spec ID:** frontiers-media
**Status:** Draft
**Governed by:** 0014-design-systems

**Input:** The images that package Intellectual Frontiers' work for a platform: podcast and episode art,
video thumbnails, title cards, lower thirds and social cards, laid out and rendered from a short job and
themed by a brand.

## Identity and scope

- **FR-001**: `frontiers-media` MUST live at `design-systems/frontiers-media/` and be registered in
  `ifcore.ttl` as an `ifcore:DesignSystem` of the media kind, classified by every media asset type it
  makes (0014-design-systems FR-050). It MUST NOT assume which show, work or platform an asset is for.
- **FR-002**: It MUST hold `formats.json`, `media.py` (layout, rendering and the checks), `fonts/` (the
  faces it measures and sets, with their licence), a `README.md`, this spec and an `assurance/` harness.
- **FR-003**: It MUST hold no picture, logo or color of its own (0014-design-systems FR-044): pictures
  are the brand's imagery pool, the logo is the brand's lockup, and every color a brand theme role or a
  mix of two.

## Formats

- **FR-004**: It MUST make these assets, at the size `formats.json` gives, as PNG: podcast cover art and
  episode art (1400×1400, the size podcast directories require at least; the imagery pool's masters are
  not large enough for 3000×3000 without enlarging them), a video thumbnail (1280×720), a title card
  (1920×1080), a lower third (1920×1080, transparent but for its band), and social cards (square
  1080×1080, portrait 1080×1350 and story 1080×1920).
- **FR-005**: Every element MUST sit inside the format's safe margin, and a video thumbnail MUST keep its
  bottom-right corner clear, where platforms overlay the video's length. An asset carries only the text
  its format names: a title always; a kicker above it and a byline below it where the format has them.

## Color, pictures and type

- **FR-006**: An asset MUST take a tone: light (the brand's surface behind its text color) or dark (the
  text color behind the surface); in each, its title, kicker and byline MUST meet WCAG 2.2 AA (4.5:1)
  against the background under every brand.
- **FR-007**: A picture MUST be a piece of the brand's imagery pool, placed whole and never larger than
  its master (frontiers-brand FR-015); a lockup MUST be the brand's, for the asset's tone, never narrower
  than 100px and never scaled up from a smaller file (frontiers-brand FR-008, FR-009).
- **FR-008**: A title MUST be set in the brand's sans, bold, at the largest size in its format's range at
  which it fits the format's lines, and MUST keep to its format's words; no text MAY be below 24px. A
  title that does not fit at the smallest size is refused, never shrunk further or clipped.
- **FR-009**: An asset's text MUST sweep clean under `frontiers-written-voice` when it is beside this
  design system.

## Making and checking

- **FR-010**: A job MUST be JSON naming its format, tone and text, and its imagery piece by id or
  `@first`. `media.py render` MUST lay it out and render it with `rsvg-convert` through `fonts/`, so the
  text is never set in a stand-in face.
- **FR-011**: `media.py check` MUST report every rule here a job breaks, naming the requirement, and exit
  non-zero on any.
- **FR-012**: The layouts are fixed per format: a card puts its picture above the text and its lockup at
  the top; a thumbnail puts its text on the left and its picture on the right; a title card its lockup
  top left and its text bottom left; a lower third a band with the name over the role. A new layout is
  added by amending this spec.

## Assurance

- **FR-013**: `assurance/run.py` MUST check that `formats.json` holds no color and no text size below the
  minimum; and, under every brand here, that each tone's text roles meet 4.5:1, that a job of every
  format in `assurance/fixtures/pass/` passes the checks and renders at its format's size (transparent
  where the format is) where `rsvg-convert` is installed, that every job in `assurance/fixtures/fail/` is
  refused for the reason `assurance/fixtures/expected.json` names, and that the ontology registers this
  design system.

## Out of scope

- Video editing, motion graphics and audio: a work's own production.
- Which platform an asset is published to, and when: the publisher's.
- The web page's share card: the brand's own (frontiers-brand FR-016).

## Edge cases

- A brand with no imagery pool: a format that carries a picture is made without one, and a job that names
  a piece is refused, per FR-007.
- A long show name on cover art: it wraps to the format's lines at a smaller size, or is refused, per
  FR-008.

## Assumptions

- Platforms accept PNG at these sizes; a publisher converts to JPEG where one asks for it.

## Open questions

None.

## Key entities

- **Job** — what an asset says and which format and tone it takes.
- **Format** — an asset type's size, safe margin, type range and limits.

## Success criteria

- **SC-001**: `python3 assurance/run.py` exits zero with every brand here beside this design system.
- **SC-002**: A publisher makes every asset an episode needs from one short job per asset, with no design
  work of their own.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No consumer is named or assumed
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information
