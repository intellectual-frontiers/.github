# Feature Specification: Frontiers print design system

**Spec ID:** frontiers-print
**Status:** Draft
**Governed by:** 0014-design-systems

**Input:** How Intellectual Frontiers sets a printed or ebook book interior, a book cover and a journal
article: page geometry, typefaces, layouts and the style files a production pipeline typesets with,
themed by a brand so that the same design can be set in another brand's colors, typefaces and logo.

## Identity and scope

- **FR-001**: `frontiers-print` MUST live at `design-systems/frontiers-print/`, be registered in
  `ifcore.ttl` as an `ifcore:DesignSystem` of the print kind, classified as book interior, book cover
  and journal article (0014-design-systems FR-010, FR-042), and be used by production pipelines it
  MUST NOT assume anything about beyond the inputs this spec names.
- **FR-002**: It MUST hold `latex/preamble.tex` (the book interior and cover), `latex/ifarticle.cls`
  (the journal article), `latex/layouts.json` and `latex/typefaces.json` (the article layouts and
  typeface sets), `latex/layout.py` (which resolves them into the class's macros), `fonts/` with
  `fonts/LICENSES.md`, `docs/`, a `README.md`, this spec and an `assurance/` harness
  (0014-design-systems FR-006, FR-031).

## Theme

- **FR-003**: It MUST be themed (0014-design-systems FR-038): the book preamble and the article class
  MUST load the brand's `brand.tex` from `\branddir` before their own definitions. In the book,
  `ifdeepink`, `iffrontierblue`, `ifsignalteal` and `ifoxblood`, and in the article, `ifink`,
  `ifblue`, `ifteal` and `ifoxblood`, MUST be the theme's `text`, `primary`, `secondary` and
  `tertiary`, in that order; a logo MUST be placed from `\brandlockuplight`, `\brandlockupdark` or
  `\brandicon`; and no style file MAY hold a theme color as a literal. It requires no role beyond
  those every brand supplies. Its harness MUST pass under every brand here.
- **FR-004**: It MUST ship, in `fonts/`, only families whose licenses allow embedding and
  redistribution, each listed in `fonts/LICENSES.md`, and never a licensed commercial face. The
  theme's `font-serif` sets the book text and MUST be one of Source Serif 4, Spectral, PT Serif,
  Gelasio or Charis SIL; the theme's `font-sans` sets the cover and MUST be Inter. Any other family
  MUST stop the build with a message naming it.

## Book interior and cover

- **FR-005**: A book interior MUST be set on XeLaTeX at a 7 × 9.19 in trim with mirrored margins
  (inner 0.9 in, outer 0.7 in, top and bottom 0.85 in), in the theme's serif for text, Source Sans 3
  for headings, captions and boxes, and Source Code Pro for code.
- **FR-006**: A book cover MUST set its title in Fjalla One, its subtitle and author in the theme's
  sans at the weights the cover grammar assigns (Inter Regular, Medium, SemiBold and Bold), and its
  back cover in Roboto Condensed. Cover artwork and the record of which work uses which piece MUST
  NOT be held here (0014-design-systems FR-031); the production pipeline holds them.

## Journal article

- **FR-007**: A journal article MUST be set on LuaLaTeX on US Letter in a layout from
  `latex/layouts.json`, the only place a layout's numbers live, resolved by `latex/layout.py` into
  the `iflayout.def` the class reads. The default layout MUST be `two-column`.
- **FR-008**: An article's typeface set MUST come from `latex/typefaces.json`. A set marked
  `license-required` MUST be used only where its files are in the directory `IF_FONTS_LICENSED`
  names; otherwise the layout's own set is used, with a note. Every set MUST fall back to the house
  fonts and STIX Two Math for a character its own fonts lack.

## Assurance

- **FR-009**: `assurance/run.py` MUST compile `assurance/fixtures/book.tex` and
  `assurance/fixtures/article.tex` under every brand vendored beside this design system, or one
  named with `--brand`, and fail when a build fails, a page is not the size FR-005 or FR-007 sets, a
  font in the output is not embedded or not one `fonts/` ships, a color FR-003 names is not the
  theme's, the theme's lockups and icon are not placed in the book, or a style file holds a theme
  color as a literal.

## Out of scope

- The production pipeline: converting a manuscript to LaTeX, assembling the wrapper document that
  defines `\iffontdir` and `\branddir`, building covers from artwork, and packaging for a printer.
- The cover grammar's documentation and the artwork library, which are facts about works and stay
  with the production pipeline.
- Figures, which a figure design system governs.

## Edge cases

- A brand whose serif this design system does not ship: the build stops and names it, per FR-004.
- A paper that asks for a licensed typeface set the consumer has not installed: it is set in the
  layout's own set, with a note, per FR-008.
- A brand whose colors are not legible in print: not checked here; a brand's own harness checks the
  contrast of its roles on its surface (0014-design-systems FR-037).
- A style file that needs a color no theme role supplies (a rule grey, a box tint): it is this design
  system's own, per FR-003, and may be a literal.

## Assumptions

- A TeX Live with XeLaTeX, LuaLaTeX and latexmk, and poppler-utils, are installed wherever the
  harness or a pipeline runs.

## Open questions

- **OQ-1**: Whether the book interior's accent (`ifaccent`, an orange used for chapter and section
  headings) and link color (`iflink`) become theme roles, so that a theme changes them too, is not
  decided; today they are this design system's own colors.

## Key entities

- **Book interior, book cover, journal article** — the print document types this design system sets.
- **Typeface set** — a named pair of text and sans families an article layout may use.

## Success criteria

- **SC-001**: `python3 assurance/run.py` exits zero with every brand here beside this design system.
- **SC-002**: The same fixture set under two brands differs only in the values the theme supplies.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No work, pipeline or consumer is named
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information
