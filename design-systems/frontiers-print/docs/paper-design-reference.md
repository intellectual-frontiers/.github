# Design reference: how the best journals set the page

The editor-facing guide to the layouts is [`paper-layouts.md`](paper-layouts.md). This file keeps the measurement tables and the layout catalog.

The paper PDF is held to the quality of HBR, NEJM, JAMA, and Nature (0017 FR-030). This file records what those publications actually do, measured from their typeset PDFs, so the house design is built on numbers and not on memory. Re-measure from a journal's typeset PDF with the production pipeline's measuring tool.

Measured 2026-10-01 (NEJM, Nature, HBR, JAMA Network Open) and again for The Lancet, BMJ, Science, and PNAS (see the second table) from open-access, publisher-typeset PDFs: NEJM original articles (2022; PMC open data), Nature (2020, 2021), two HBR reprints (2011 "Creating Shared Value"; 2012 "Restoring American Competitiveness"), and one JAMA Network Open original investigation (2025). Page numbers measured: interior full-text pages only. Sizes are points (pt) or inches (in). Figures are the median over the pages measured; they can be off by about 0.02 in.

## What was measured

| | NEJM | Nature | HBR | JAMA Network Open |
|---|---|---|---|---|
| Trim (page) | 7.88 x 10.50 in | 8.27 x 10.98 in (A4 width) | 8.19 x 10.75 in; 8.50 x 11.00 in | 8.50 x 11.00 in |
| Body type / leading | 10 / 12 pt, serif (Quadraat) | 8.2 / 10.8 pt, serif (Harding) | 8.2 to 9 / 12 pt, serif (Guardian Egyptian; Le Monde Journal) | 8.5 / 13 pt, sans (Guardian Sans) |
| Text grid | 2 columns, 2.75 in each, gutter 0.13 in; block 5.63 in | 2 columns, 3.54 in (89 mm) each, gutter 0.15 in; block 7.24 in (183 mm) | 2 text columns, 2.5 to 2.7 in, gutter 0.14 to 0.34 in; one issue adds a 1.75 in sidebar column (3-column grid) | one main column 4.82 in plus a 2.15 in side column |
| Characters per line | about 40 | about 58 to 60 | about 38 to 44 | about 81 (main column) |
| Margins (in) | outer 0.86; inner side 1.39; top 0.78; bottom 1.08 | left 0.56; right 0.47; top 0.69; bottom 0.63 | left and right 0.58 to 0.60; top 1.11; bottom 0.6 to 0.9 | left 0.74; top 0.62; bottom 0.9 |
| Wide figure or table | spans both columns | 183 mm (7.2 in) double column; 120 or 136 mm 1.5 columns | spans the full text width (7.3 in measured) | 6.75 in double column, 3.25 in single (per JAMA's author guidance) |

## Second set: The Lancet, BMJ, Science, PNAS

Measured the same way from publisher-typeset PDFs (Lancet: Elsevier, 2021; BMJ: InDesign, 2021; Science and PNAS: Arbortext, 2021 to 2022).

| | The Lancet | BMJ | Science | PNAS |
|---|---|---|---|---|
| Trim | 8.27 x 11.10 in | 8.27 x 11.02 in | 8.25 x 10.50 in | 8.12 x 10.87 in |
| Body type / leading | 9 / 11 pt | 8.7 / 11.3 pt | Reports: 8 / 10.5 pt; Research Articles: 8.7 / 10.5 pt | 9 / 10 pt |
| Text grid | 2 columns, 2.97 in, gutter 0.17 in, plus an outer band | 2 columns, 2.83 in, gutter 0.16 in, plus a left band | Reports: 2 columns, 3.53 in; Research Articles: 3 columns, 2.28 in | 2 columns, 3.40 in, gutter 0.18 in; first page adds a 1.8 in right column |
| Characters per line | about 46 | about 44 | 62 to 67 (2 columns); 38 (3 columns) | about 52 to 54 |
| Margins (in) | outer 0.51; the other side 1.65, which is 1.14 of band; alternates by page; top 1.0; bottom 0.63 | 0.47 right; 1.97 left, which is 1.5 of band, on every page; top 1.0; bottom 0.49 | 0.51 both sides; top 0.67; bottom 0.56 | 0.54 to 0.60 both sides; top 0.77; bottom 0.76 |

What the Lancet and BMJ band holds: the running head and page number (BMJ: "RESEARCH 4"; Lancet: "Health Policy 2112"), short marginal notes ("See Online for appendix", "For the Independent Panel website see ..."), and, on pages with a table or figure, the exhibit itself, which spans the band and both columns (about 7.3 in). Neither puts a boxed callout or pull quote in the band on the pages measured. PNAS keeps a 1.8 in right column on the first page only, for short author and significance notes at 7 pt.

**Answer to "does a two-column page with a sidebar exist in a popular journal?"** Yes: The Lancet and BMJ both set it on every article page, HBR sets it on some pages. In the journals, the band is narrow (1.1 to 1.5 in) and carries short notes and the running head, with wide exhibits spanning it; the house `two-column-sidebar` widens it to 1.6 in so that a callout fits, which is closer to HBR's 1.75 in.

## What the publishers specify themselves

- **Nature** (Guide to preparing final artwork, nature.com/documents/nature-final-artwork.pdf): figures 89 mm (one column), 120 or 136 mm (1.5 columns), or 183 mm (two columns); full page depth 247 mm; text in a sans-serif (Helvetica or Arial); panel labels 8 pt bold; other text at most 7 pt and at least 5 pt; lines about 0.5 pt.
- **NEJM** (Technical guidelines for figures): editable vector art, at least 300 ppi for raster; NEJM redraws every accepted figure to its house style. No column widths are published.
- **JAMA**: figures and tables up to 3.25 in (one column) or 6.75 in (two columns); figure text in Arial or Helvetica, at least 8 pt (from JAMA author guidance as summarised by third parties; the JAMA site itself could not be fetched from this environment).
- **HBR** (Guidelines for authors): editorial standards only. No typographic or layout specification is published.
- **Chicago Manual of Style**: not a published-page design standard. Its formatting advice (12 pt, double spacing, 1 to 1.5 in margins) is for the author's manuscript, not for the set page. Manuscript rules of that kind (1 in margins, double spacing) are the source of an oversized, "children's book" look when applied to a finished page. NEJM and AMA say the same of their own manuscripts (at least 1 in margins), which the journals do not use on the set page.

## What this means for the house design

1. **Body type is small and the page is dense.** Every reference sets body text between 8.2 and 10 pt, with 0.55 to 0.9 in outer margins. A page with 1.1 to 1.3 in margins and 10.5 to 11 pt type is outside all of them.
2. **Line length stays near 40 to 65 characters** in two columns (Science's two-column Reports reach about 65). The one wide column in the set (JAMA's) is 4.8 in and about 81 characters at 8.5 pt, and it is paired with a side column for notes and sidebars, not run across the page.
3. **A wide figure or table spans the full text width** (about 7.1 to 7.3 in), not the text column.
4. **Nature's grid is the closest match for a two-column paper (Science and PNAS agree: 3.4 to 3.5 in columns, margins 0.5 to 0.6 in):** 3.54 in columns, 0.15 in gutter, 0.5 to 0.55 in margins, 8.2 / 10.8 pt. The house two-column design (9.5 / 12.4 pt, 3.36 in columns, 0.28 in gutter, 0.75 in margins) is within the range of the set, a little more open.
5. **For a paper whose figures and tables do not fit a column**, the house single-column layout follows JAMA and HBR: a main text column of about 4.85 in (about 77 characters at 9.5 pt) with a marginal column of 2.0 in beside it, and wide figures and tables spanning the full 7.1 in.

## The layouts an author can choose

The author chooses a layout with `:layout:` in the paper header. The list is open: a new layout is a new entry in `latex/layouts.json` and a section here, with no change to the papers. Every layout shares the same type, headings, boxes, colour, and reference style; layouts differ only in the page grid. Structural names are canonical; a journal name is an alias for the layout modeled on that journal, and it does not mean the page matches that journal (the typefaces differ). `latex/layout.py list` shows them; `PAPER_LAYOUT=<name> make paper PAPER=<slug>` builds a paper in another layout to try it, without replacing its own PDF.

In a layout with a sidebar, pull quotes, practical-test boxes, notes, and key callouts sit in the sidebar beside the text they follow; Key points and the status statement stay in the full-width band under the abstract (JAMA and Nature put their key points near the title; no reference moves them to the margin). In any other layout the same callouts stay inline. The author marks nothing for this.

The text below is generated by `latex/layout.py doc`; edit `layouts.json`, not this section.

<!-- layouts:begin (generated by latex/layout.py sync; edit layouts.json, not this block) -->
### `two-column`
The house default. Two 3.36 in columns, 9.5/12.4 pt, 0.75 in margins. Wide figures and tables span both columns.

- **Aliases:** none
- **Modeled on:** Between Nature and NEJM; a little more open than either.
- **Best for:** Papers light on figures and tables, or whose figures and tables fit inside a column.

### `two-column-dense`
The densest two-column page. Two 3.55 in columns with a 0.17 in gutter, 8.6/11.2 pt, 0.6 in margins.

- **Aliases:** `nature`
- **Modeled on:** Nature: 89 mm columns, 8.2/10.8 pt, margins about 0.55 in.
- **Best for:** Long papers that must stay short in pages; text-led work with compact figures.

### `two-column-wide-margin`
Two 3.15 in columns at 10/12.4 pt with a wide inside margin (1.2 in) and a 0.85 in outside margin. The most open two-column page.

- **Aliases:** `nejm`
- **Modeled on:** NEJM: 10/12 pt on narrow columns with a wide inner margin.
- **Best for:** Short, text-led papers; a reader who will annotate or bind the page.

### `single-sidebar`
A 4.85 in main column (about 77 characters at 9.5 pt) with a 2.0 in sidebar. Pull quotes, practical tests, and notes sit in the sidebar. Wide figures and tables span the full 7.1 in.

- **Aliases:** `jama`
- **Modeled on:** JAMA Network Open: a wide main column beside a narrow side column.
- **Best for:** Papers heavy in tables and figures, and papers with many callouts.

### `single-sidebar-compact`
A 5.2 in main column (about 83 characters at 9.5 pt) with a 1.6 in sidebar. Wide figures and tables span 7.05 in.

- **Aliases:** none
- **Modeled on:** JAMA Network Open, with a narrower side column.
- **Best for:** Callout-heavy papers that need a longer line and a slimmer sidebar.

### `single-narrow-margin`
One column across the page, 7.0 in wide, 9/12.6 pt, 0.75 in margins. The densest single-column page. Callouts stay inline.

- **Aliases:** none
- **Modeled on:** None of the four reference publications sets one wide column across the page; this layout follows no reference.
- **Best for:** Table- and figure-heavy work with short paragraphs, where a wide page serves the exhibits. Not for long prose.
- **Caution:** About 105 characters per line at 9 pt, above the 90 characters a reader follows comfortably. Use it only when the content is mostly exhibits and short paragraphs.

### `two-column-sidebar` (planned, not built)
Two 2.65 in text columns with a 0.17 in gutter beside a 1.6 in sidebar band, 9/11.6 pt, 0.6 in outer margins. The sidebar holds short notes, pull quotes, and callouts; wide figures and tables span the band and both columns.

- **Aliases:** `hbr`, `lancet`, `bmj`
- **Modeled on:** The Lancet (about 1.1 in outer band, alternating sides), BMJ (about 1.5 in left band, every page), and HBR (1.75 in sidebar column). Measured 2026-10-01.
- **Best for:** Dense papers with many short callouts that must stay two-column.
- **Status:** Planned. LaTeX places margin material beside a two-column text block unreliably; this layout needs a different technique and is not built. Selecting it fails the build and names the alternatives.

### `two-column-science`
Two 3.57 in columns with a 0.17 in gutter, 8.2/10.6 pt, 0.6 in margins.

- **Aliases:** `science`
- **Modeled on:** Science (Reports): 3.53 in columns, 8/10.5 pt, 0.51 in margins.
- **Best for:** Short, compact papers with small figures.

### `two-column-pnas`
Two 3.4 in columns with a 0.18 in gutter, 9/11 pt, 0.76 in margins.

- **Aliases:** `pnas`
- **Modeled on:** PNAS: 3.40 in columns, 9/10 pt (leading opened to 11 pt here), 0.54 to 0.60 in margins.
- **Best for:** General research papers; a balanced, moderately dense page.

### `two-column-cell`
Two 3.32 in columns with a 0.17 in gutter, 8.5/10.9 pt, 0.8 in margins.

- **Aliases:** `cell`
- **Modeled on:** Cell: 3.32 in columns, 8.5/10.9 pt, margins 0.74 to 0.83 in.
- **Best for:** Research papers with many figure panels; a dense page with firm margins.

### `two-column-large`
Two 3.3 in columns with a 0.22 in gutter, 10/12 pt, 0.85 in margins. The largest two-column type.

- **Aliases:** `circulation`, `aha`
- **Modeled on:** AHA's Circulation: 10/12 pt on 3.26 in columns, 0.68 in margins (NAR: 10/11 pt on 3.43 in).
- **Best for:** Papers read on screen or by readers who want larger type.

### `single-sidebar-left`
A 5.64 in main column (about 83 characters at 9/12.2 pt) with a 1.84 in sidebar on the left. Callouts sit in the left sidebar; wide figures and tables span the full 7.5 in.

- **Aliases:** `elife`, `scirep`
- **Modeled on:** eLife: 5.64 in column, 9/12.2 pt, a 1.84 in left sidebar. Scientific Reports is similar (5.5 in column, 1.6 in left band, 9/10 pt).
- **Best for:** Long-form papers where the reader scans the sidebar first; callout-heavy papers.

### `single-sidebar-left-wide`
A 5.22 in main column (about 76 characters at 10/13.2 pt) with a 2.0 in sidebar on the left. Wide figures and tables span 7.5 in.

- **Aliases:** `plos`, `plosone`
- **Modeled on:** PLOS ONE: 5.22 in column, 10/13 pt, a 2.28 in left sidebar.
- **Best for:** Long-form papers with generous callouts; the most open sidebar page.

### `three-column` (planned, not built)
Three 2.28 in text columns, 8.7/10.5 pt, 0.51 in margins. The densest page set.

- **Aliases:** none
- **Modeled on:** Science Research Articles (measured: 3 columns of 2.28 in with a 0.2 in gutter).
- **Best for:** Long, text-dense papers where page count matters most.
- **Status:** Planned. LaTeX has no native three-column mode that handles floats; this needs multicol and a custom float solution. Selecting it fails the build.

<!-- layouts:end -->

## Open points

- Exact HBR, NEJM, and JAMA print specifications are not published; this file is built from their set pages. If the publications supply design specifications under any licence, replace the measurements with them.
- Typefaces: the references use licensed families (Quadraat, Harding, Guardian). The house uses Source Serif 4 and Source Sans 3 (open licence); nothing here changes that.
