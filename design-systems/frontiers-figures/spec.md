# Feature Specification: Frontiers Figures design system

**Spec ID:** frontiers-figures
**Status:** Draft
**Governed by:** 0014-design-systems

**Input:** How every figure Intellectual Frontiers publishes is drawn, in any medium (a book, a
paper, a web page, a slide): its canvas, type, boxes, arrows and layouts, its colors as figure
roles, and the light variations a figure may take, themed by any brand.

## Identity and scope

- **FR-001**: `frontiers-figures` MUST live at `design-systems/frontiers-figures/` and be registered in
  `ifcore.ttl` as an `ifcore:DesignSystem` of the figure kind, classified by every figure type its
  layouts draw (0014-design-systems FR-010, FR-032). It MUST NOT assume which medium, work or
  renderer a figure goes to.
- **FR-002**: It MUST hold `roles.json`, `svgkit.py` (the drawing primitives), `layouts.py` (the
  figure types), `figcheck.py` (these rules, as a check), `theme.py` (the stylesheet a theme gives a
  figure), `fonts/` (the families it measures and a renderer sets, with `fonts/LICENSES.md`), a
  `README.md`, this spec and an `assurance/` harness. It MUST NOT hold any work's figures.

## Source

- **FR-003**: A figure's source MUST be SVG that names every color by a figure-role class (`f-<role>`
  for a fill, `s-<role>` for a stroke, `c-<role>` for a gradient stop) and its type by size, weight,
  style and tracking only. It MUST NOT hold a color, a font name or a stylesheet (0014-design-systems
  FR-044): the theme adds them when the figure is rendered.

## Theme and variants

- **FR-004**: The figure roles MUST be those `roles.json` lists: ink, body, strong, muted, line, rule,
  surface, neutral-tint, primary, primary-tint, emphasis, emphasis-tint, emphasis-deep, secondary,
  tertiary, info and info-tint. In each variant every role MUST be a brand theme role or a mix of two
  (0014-design-systems FR-037, FR-044), and every foreground role MUST reach 4.5:1 and every graphic
  role 3:1 against every background role, under every brand here.
- **FR-005**: It MUST offer these variants, and a figure MUST take exactly one:
  - **default**: on the brand's surface;
  - **on-dark**: on the brand's text color, for a dark page or slide;
  - **grayscale**: every role a mix of text and surface, for one-color print;
  - **compact**: a 720px canvas instead of the standard 1040px, for a narrow slot (a sidebar, one
    column of two, half a slide), so its type still prints at the minimum.
  A color variant changes only the values roles take; the compact variant changes only the canvas
  width. Neither MAY change a figure's type sizes, components or layout rules.
- **FR-006**: `theme.py` MUST give a figure the stylesheet for one brand and one color variant: a rule
  for every figure-role class and the brand's `font-sans` for every label, which MUST be a family
  this design system ships in `fonts/` (Inter), and MUST set every type size at that family's optical
  size (FR-007). A consumer MUST render or place a figure only with
  that stylesheet in it.

## Type, boxes and layout

- **FR-007**: A figure MUST be on the standard (1040px) or compact (720px) canvas, its height following
  its content and no more than 1400px. Its title MUST be 34px bold `ink` at the top left, with an
  optional 20px italic `muted` subtitle; body text 21px, emphasized box text and takeaways 22px bold,
  small labels 20px. No label MAY be smaller than 20px, and no label MAY be tracked tighter than
  −0.02em. These sizes are optical: they are stated for a face whose x-height is 0.486 em, and a
  figure's source holds them as they are; measured, and set by the theme, in the brand's sans, each is
  scaled so the x-height matches (Inter at 0.89×), so a label reads the same size in any brand.
- **FR-008**: Text in a box MUST be wrapped to the box's width as measured in the theme's sans, with at
  least 18px of padding where the kit sizes the box, and MUST fit inside it with at least 4px each
  side. No label MAY run off the canvas or under a filled shape drawn after it. A label that does not fit MUST be re-wrapped, set smaller
  (to no less than 20px) or tracked tighter (to no less than −0.02em), never clipped.
- **FR-009**: Boxes MUST be rounded rectangles (radius 4px) with a 1.5px outline; arrows MUST end in
  the kit's rightward marker oriented `auto-start-reverse`; no label MAY carry an em dash or a
  straight quote.
- **FR-010**: Its figure types MUST be those its layouts draw: a process diagram, a comparison, a
  cycle diagram, a layer diagram, a relationship diagram, a decision flowchart and a hierarchy
  diagram. A figure of another type MAY be drawn on the kit's primitives and MUST still meet every
  rule here.

## Assurance

- **FR-011**: `assurance/run.py` MUST, under every brand beside this design system, draw a figure of
  every type on both canvases and check it passes `figcheck.py` measured in the brand's `font-sans`;
  check every fixture in `assurance/fixtures/fail/` fails with the problem
  `assurance/fixtures/expected.json` names; check every variant's contrast per FR-004 and that a
  themed figure parses; and, where `rsvg-convert` is installed, that a themed figure renders with
  the brand's sans embedded and no other family.

## Out of scope

- Any work's figures, their captions and where they sit in a work: the work's own record.
- Charts drawn from data (bar charts, timelines) beyond what the kit's primitives draw: drawn on the
  primitives, under every rule here.
- Raster figures (a screenshot, a photograph): a work's own asset, not drawn here.

## Edge cases

- A brand whose `font-sans` this design system does not ship: the kit refuses to measure in it, per
  FR-006.
- A label that fits in Source Sans 3 but not in the theme's sans: it is re-wrapped, set smaller or
  tracked tighter within FR-008's limits; past them the figure is redrawn.
- A figure placed on a dark page: the on-dark variant is used, never a recolored copy, per FR-005.

## Assumptions

- A consumer's SVG renderer supports class selectors in an SVG `<style>` (browsers; librsvg 2.52 and
  later), and finds `fonts/` through its font configuration.

## Open questions

None.

## Key entities

- **Figure role** — what a class colors (ink, primary, emphasis, ...), resolved by a theme.
- **Variant** — a named light variation: default, on-dark, grayscale or compact.
- **Figure type** — a layout's shape, in the ontology's figure type scheme.

## Success criteria

- **SC-001**: `python3 assurance/run.py` exits zero with every brand here beside this design system.
- **SC-002**: The same figure source renders correctly in a book, a paper and a web page under any
  brand and variant, with no edit to the figure.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No consumer is named or assumed
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information
