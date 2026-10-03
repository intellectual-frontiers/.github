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
  MUST load the brand's `brand.tex` from `\branddir` before their own definitions, and MUST hold no
  color literal (0014-design-systems FR-044). A role color is used by its theme name
  (`brand-primary`); a color named for its purpose MUST be that role or a mix of roles: in both,
  `ifink` is `text`, `ifgray` is `text` mixed with `surface` (72% in the book, 70% in the article),
  `ifrule` 15% (22%) and `iftint` 4%; in the book, `iflabel` is 50%, `ifaccent` is `accent`,
  `iflink` `link`, `ifsubtitle` `tertiary`, `ifseries` `primary`, and the admonitions `ifnote`,
  `iftip`, `ifimportant`, `ifwarning` and `ifcaution` are `info`, `success`, `warning`, `danger` and
  `danger`. A logo MUST be placed from `\brandlockuplight`, `\brandlockupdark` or `\brandicon`,
  and cover artwork from the theme's imagery pool. It requires no role beyond those every brand
  supplies, and an imagery pool for a book cover. Its harness MUST pass under every brand here.
- **FR-004**: It MUST ship, in `fonts/`, only families whose licenses allow embedding and
  redistribution, each listed in `fonts/LICENSES.md`, and never a licensed commercial face. The
  theme's `font-serif` sets the book text and MUST be one of Source Serif 4, Spectral, PT Serif,
  Gelasio or Charis SIL; the theme's `font-sans` sets the book's sans and the cover and MUST be
  Inter, shipped in Regular, Medium, SemiBold, Bold, Italic and Bold Italic. Any other family MUST
  stop the build with a message naming it.

## Book interior and cover

- **FR-005**: A book interior MUST be set on XeLaTeX at a 7 × 9.19 in trim with mirrored margins
  (inner 0.9 in, outer 0.7 in, top and bottom 0.85 in), in the theme's serif for text, the theme's
  sans for headings, running heads, captions, tables and boxes, and Source Code Pro for code.
- **FR-006**: A book cover MUST set its title, series line, author and back-cover headline in Fjalla
  One, a print heading face (frontiers-brand FR-004), its subtitle in the theme's sans at Regular or
  Medium, and the rest of its back cover in Roboto Condensed. Cover artwork and the record of which
  work uses which piece MUST NOT be held here (0014-design-systems FR-031); the production pipeline
  holds them.

## Book cover grammar

- **FR-010**: A front cover MUST carry exactly the theme's light lockup, the title, the subtitle, one
  piece of the theme's imagery pool and the author, on the `surface` role, with no texture, border,
  frame, panel or ornament. The reading order MUST be title (with the series line, on a series
  cover), artwork, subtitle, author, lockup.
- **FR-011**: The lockup MUST sit at the upper left, about 6.5% of the trim width from the left
  edge and 5.5% of its height from the top, about 1.08 in wide and never below the brand's minimum,
  left-aligned with the title, about 0.3 in above it.
- **FR-012**: The title MUST be `ifink`, left aligned, in Title Case and never all capitals, broken
  into lines exactly as composed in the work's cover data and never wrapped by the typesetter, in a
  6.2 in box at 60/66 pt by default (46/51 pt on a series cover). A title MUST break across as few
  lines as keep each line a coherent phrase, and its longest line SHOULD reach 80–90% of the box; a
  line wider than the box MUST stop the build.
- **FR-013**: The subtitle MUST be `ifsubtitle`, left aligned, 15/19 pt, one to three lines, never
  italic, centered or boxed.
- **FR-014**: The author MUST be `ifink`, right aligned at the lower right, 16/20 pt, positioned from
  the bottom margin, written exactly as it prints (Title Case, never all capitals), one line per
  author in byline order. Where it sits over the artwork it MUST carry a `surface` outline in its
  own face.
- **FR-015**: The artwork MUST be one piece of the theme's imagery pool (0014-design-systems FR-043),
  trimmed to its drawn art, in the lower middle, as large as its space allows and clear of the
  bottom trim, never with text or marks added. A piece MUST NOT appear on two works' covers unless
  the production pipeline records an approved reuse.
- **FR-016**: A volume of a serial series MUST print, between the lockup and the title, the series
  name at the left margin and `Volume N` at the right, in `ifseries` at 28.5/30 pt with no rule, and
  its title MUST be the volume's own. Its back cover MUST open with the series name, a 1.2 pt
  `ifseries` rule and `Volume N` at 16.5/18 pt, and MUST NOT name another volume by number.
- **FR-017**: The back cover's headline MUST be `ifink` at 22/25 pt in sentence case; its other text
  MUST be `ifink`, `ifgray` or `iflabel`. A back cover MUST fit one page and MUST keep a barcode
  zone clear at the lower right, 2 in × 1.2 in, its top edge 7.23 in from the top of the page.

## Journal article

- **FR-007**: A journal article MUST be set on LuaLaTeX on US Letter in a layout from
  `latex/layouts.json`, the only place a layout's numbers live, resolved by `latex/layout.py` into
  the `iflayout.def` the class reads. The default layout MUST be `two-column`.
- **FR-008**: An article's typeface set MUST come from `latex/typefaces.json`. A set marked
  `license-required` MUST be used only where its files are in the directory `IF_FONTS_LICENSED`
  names; otherwise the layout's own set is used, with a note. Every open-license set that pairs a
  serif with a sans MUST pair it with Inter, the house sans (frontiers-brand FR-004). Every set MUST
  fall back to Source Serif 4, Inter and STIX Two Math for a character its own fonts lack.

## Assurance

- **FR-009**: `assurance/run.py` MUST compile `assurance/fixtures/book.tex` and
  `assurance/fixtures/article.tex` under every brand vendored beside this design system, or one
  named with `--brand`, and fail when a build fails, a page is not the size FR-005 or FR-007 sets, a
  font in the output is not embedded or not one `fonts/` ships, a color FR-003 names is not the
  theme's role or mix of roles, the theme's lockups and icon are not placed in the book, or a style
  file holds a color literal.

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
- A style file that needs a color no theme role supplies (a rule grey, a box tint): it is mixed from
  the `text` and `surface` roles, per FR-003, never a literal.
- A work with no good match in the theme's imagery pool: a new piece is added to the brand's pool
  (frontiers-brand FR-015); the cover never adapts or retouches a piece, per FR-015.

## Assumptions

- A TeX Live with XeLaTeX, LuaLaTeX and latexmk, and poppler-utils, are installed wherever the
  harness or a pipeline runs.

## Open questions

None.

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
