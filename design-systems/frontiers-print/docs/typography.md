# Typography and page design

Fonts, tables, section numbering, front matter, and paragraph flow in the house design (0016-press-production FR-018).

O'Reilly's own production faces are licensed, proprietary, and not
something this pipeline can legally embed or replicate. This theme
matches O'Reilly's *layout* conventions using open-source fonts chosen
to read the same way, not to imitate O'Reilly's branding.

It uses the **Source** superfamily (Adobe, SIL OFL): Source Serif 4,
Source Sans 3, and Source Code Pro are drawn together by the same
foundry with matching metrics, and — importantly — Source Serif 4 is an
actual *text/book* face (set here at its optical size 12, the "for
reading at book sizes" cut), not a broad-coverage UI font pressed into
book duty.

- **Source Serif 4** — body text.
- **Source Sans 3** — headings, running heads, title page, captions,
  the chapter-numeral label, cover typography.
- **Source Code Pro** — code blocks and inline code.

All three are SIL Open Font License, redistributable, and committed
here as Latin-subset static instances (regular/bold/italic/bold-italic
each) built from Google's variable-font sources with `fonttools`. Every
color, including the accent on chapter and section headings and the link
color, is the theme's (spec FR-003).

A fourth face, outside the Source superfamily, is used in exactly one
place: **Martian Mono Condensed** (Evil Martians, SIL OFL) for the
"Try this with AI" console boxes (`iftryai`, see the sidebar section
above). A fixed-width font reads larger than body text at the same
point size, and simply scaling Source Code Pro down made that worse,
not better, once combined with a smaller size — so this pipeline uses
a face that's condensed *by design*, sourced from Martian Mono's
upstream variable font (`wdth,wght` axes) and pinned with `fonttools`'
`varLib.instancer` at `wdth=75` (labeled "Condensed" in the font's own
`STAT` table), the same Latin-subset-via-`fonttools` approach as the
Source faces. Only Regular and Bold are built — Martian Mono has no
italic cut upstream, and no "Try this with AI" prompt in any book uses
emphasis inside the box (bold labels — see the next section — are a
different thing: they switch font family entirely, not just weight
within Martian Mono Condensed).

### A [.tryai] box's meta text isn't set in the console font either

Content inside a `[.tryai]` sidebar (`iftryai`) isn't uniformly "a
prompt" across every book. Some have nothing but a bare quoted prompt
per box; others mix that with meta instructions addressed to the human
reader, not the AI — "Purpose:", "Give your AI:", "Check before
acting:", "Save:", "Context to provide:", "Check the output:" (bold in
some books, plain in others; label wording is content, not something
this pipeline standardizes). Setting *all* of it in Martian Mono
Condensed made the meta text read like something to type verbatim,
which it isn't.

`convert_paragraph` in `if-press-latex-converter.rb` matches a
paragraph's opening words against `TRYAI_META_LABELS` and, for a match,
switches that one paragraph (scoped to a `{...\par}` group, not the
whole box) to `\ifsans` at 9pt/12pt, ragged-right — the same face,
size, and ragged setting this theme already uses for table cells (see
"Table font size vs. body text" below), not a new style invented for
this. Everything else in the box — an AI-facing label ("Prompt:",
"Prompt to use:", "Go deeper:") and its literal follow-on text, or an
unlabeled paragraph — stays in the box's own default condensed
monospace. The label list is deliberately short: a new label a future
book introduces needs a human decision about which side of the split
it's on, not a guess baked into a longer regex.


The table converter gives every column an absolute minimum width sized
to its own longest unbreakable word (estimated from the table's font
size, in inches — not a fraction of anything, which matters: a purely
proportional scheme can still shrink a column below what its longest
word needs). Whatever width is left over after every column has its
minimum is handed out proportionally by overall content length. Columns
are ragged-right, not justified, inside `p{}` cells (LaTeX's `array`
package `>{\raggedright\arraybackslash}` prefix) — narrow columns of
justified text force justification to stretch huge gaps between words.
If the minimums alone don't fit the text width, the whole table drops
to a smaller font (7.75pt at 6+ columns, see "Table font size" below)
rather than let anything overflow.

One real gotcha this surfaced and is now accounted for: a `p{width}`
column's width is *content* width only — LaTeX adds `\tabcolsep` (6pt
default) as padding on *each side of every column* on top of that, so
naively budgeting column widths to sum to a full page width overflows
the moment a table has more than a couple of columns. `\tabcolsep` is
set to 3pt locally around every table and that overhead is subtracted
from the width budget before it's ever divided among columns.

Two more table details worth recording:

- **A table caption's page break.** `longtable` does its own internal
  pass to decide whether a table fits on the current page, and without
  a properly settled cursor position and reserved space before it
  starts, that pass can collide with text that hasn't finished flowing
  yet. `\iftablecaption` does
  `\par\needspace{5\baselineskip}\vspace{...}\noindent` before the
  caption text — `\needspace` (from the `needspace` package) forces a
  page break *before* the caption if there isn't room left for it plus
  a few table rows, so a caption never gets stranded at the bottom of a
  page while its table starts fresh somewhere else.
- **Table header rows.** AsciiDoc tables need an explicit
  `options="header"` on the block; without it every row, including the
  first, lands in `node.rows.body` and the LaTeX converter's header
  treatment (bold, accent-colored, a heavier rule underneath) never
  fires for *any* table.

## Table font size vs. body text

Table cells are set smaller than body text, in the sans face rather
than the serif body face (tabular data reads better in a sans face;
the serif body face is for continuous prose), and ranged-left/ragged,
never fully justified — standard practice, and also how O'Reilly and
most well-set trade books handle tables. Body text here is 10.5pt
Source Serif 4; table cells are 9pt Source Sans 3 (7.75pt for 6+ column
tables, where fitting content matters more than matching the standard
size exactly), ragged-right. The header row adds bold and this theme's
accent color, matching every other heading in the book, plus a visibly
heavier rule underneath it than the standard-weight rule body rows get.

## Section numbering

Chapters are numbered (`1`, `2`, ...) and get the "CHAPTER N" label —
a real, confirmed O'Reilly convention. Sections and subsections
underneath a chapter are not numbered, distinguished by typography
(size, weight, color) alone, the same way this theme styles them.
`latex/preamble.tex` sets `\setcounter{secnumdepth}{0}` (only chapters,
depth 0, generate a number) with no `\thesection.`/`\thesubsection.`
labels in their `\titleformat` calls. `tocdepth` stays at 2, so the
table of contents still lists every section and subsection — just
without numbers, indented to show the hierarchy instead.

## Front matter and paragraph flow

- **The copyright page renders before the table of contents.**
  `convert_document` splits a document's top-level blocks into the
  preamble (the copyright/legal block — whatever comes before the first
  real section) and everything else, emitting the preamble first, then
  `\tableofcontents`, then the rest — real books put the copyright page
  before the contents, not after. `convert_preamble` forces its own
  page break and sets the block in `\small` with no running header.
- **A dedicated preface section separates front-matter blocks.** A
  manuscript's own `[preface]` sections (`= <heading text>`) mark real
  boundaries within the front matter — each producing, via the LaTeX
  converter's `\chapter*{}` handling for prefaces, a real page break and
  its own heading, rather than letting unrelated front-matter content
  run together into one undifferentiated block.
- **Front matter never forces an unwanted recto start.** Book class's
  `openright` option makes `\frontmatter`, `\tableofcontents`, and every
  `\chapter`/`\chapter*` (a `[preface]` section included) call
  `\cleardoublepage` internally before they start — forcing a recto
  (odd) page, inserting a blank verso page to get there if needed.
  That's right for `\mainmatter` (a real chapter should open recto), but
  wrong for the copyright page (belongs on the verso right behind the
  cover) and everything else before the first real chapter. A plain
  `\clearpage` swap covers the entire front-matter stretch, restored to
  the real `\cleardoublepage` in `mainmatter_prefix`, exactly once,
  right before `\mainmatter`.
- **An explicit page break inside front matter.** AsciiDoc's `<<<`
  block macro (`convert_page_break`) gives a book's own Praise/half-
  title/title-page/copyright sequence, where a manuscript has one, each
  its own page — a plain `\clearpage` for an ordinary break, and a
  `[.blank]`-tagged `<<<` for a page that should render fully blank. Two
  bare `\clearpage` in a row is a no-op in TeX (the second has nothing
  pending to ship out, so it silently collapses to one page transition
  instead of two) — `[.blank]` instead emits
  `\clearpage\thispagestyle{empty}\mbox{}\clearpage\thispagestyle{empty}`,
  the same `\mbox{}` trick the front cover uses, so the blank page
  actually ships out as its own page.

### Paragraph indentation matches O'Reilly Learning, not classic book indenting

O'Reilly Learning (and most contemporary technical-book setting) doesn't
indent the first line of a paragraph at all: paragraphs are flush left
throughout, separated by a small, consistent vertical gap instead.
`preamble.tex` sets:

```latex
\setlength{\parindent}{0pt}
\setlength{\parskip}{0.45\baselineskip plus 2pt minus 1pt}
```

### Headings and lists get one gap, not two stacked together

`\titlespacing`'s "after" glue and `enumitem`'s list `topsep` are both
extra glue added **on top of** the `\parskip` TeX already inserts for
the paragraph-to-paragraph break there — not a replacement for it. Both
are zeroed on every heading level and on `enumitem`'s `topsep`, letting
the ordinary `\parskip` be the only thing producing that gap, the same
as it does between two plain paragraphs.

Vertical alignment matters here too: book class's default `\flushbottom`
stretches a page's own glue to reach the bottom margin exactly, which
can dump a page's entire leftover slack into a single stretchable gap
purely because of where the page happened to break. `\raggedbottom`
lets a page end wherever its content naturally does instead.

### Chapter opener: position, alignment, and internal spacing

`\titleformat{\chapter}` sets the "CHAPTER N" label and chapter title
right-aligned (`\raggedleft`, both the numbered and unnumbered/preface
variants), sitting high on the page, tight to each other (2pt
separation) as one unit, with more air before the body's first section
begins — a chapter opener as a distinct visual unit, not text that
happens to start partway down a page.

