# Frontiers Print

How Intellectual Frontiers sets a book interior, a book cover and a journal article, in LaTeX,
themed by a brand. Its rules are [`spec.md`](spec.md); it is governed by
[`0014-design-systems`](../../spec-kit/specs/0014-design-systems/spec.md). It is set in a brand's
colors, typefaces and logo by loading that brand's `brand.tex` first, so the same design works for
[`frontiers-brand`](../frontiers-brand/README.md) or any other brand that supplies the theme roles.

| Path | What it is |
| --- | --- |
| `latex/preamble.tex` | The book interior and cover: `\input` it inside `\documentclass{book}` (XeLaTeX). |
| `latex/ifarticle.cls` | The journal article class (LuaLaTeX). |
| `latex/layouts.json`, `latex/typefaces.json` | The article layouts and typeface sets: the only place their numbers live. |
| `latex/layout.py` | Resolves a layout and typeface set into the `iflayout.def` the class reads: `python3 latex/layout.py emit two-column`. In this repository: `agora layout list`, `agora layout show LAYOUT [--def]` and `agora layout build LAYOUT -o iflayout.def`, which take a layout's alias too. |
| `fonts/` | The open-license fonts it sets, with `LICENSES.md`. |
| `docs/` | Typography, the article layouts, and the journal design reference. |
| `assurance/` | `run.py` compiles the fixtures under every brand beside this design system and checks page size, fonts, theme colors, logos, literals, that each PDF's text layer maps every glyph to its Unicode character, and that no glyph a font lacks is dropped. |

## Using it

1. Vendor this directory and a brand beside it. Don't edit either.
2. In the document your pipeline assembles, define `\iffontdir` (this directory's `fonts/`) and
   `\branddir` (the brand's directory), both absolute, then:
   - a book: `\documentclass[10pt,twoside,openright]{book}` and `\input{<this directory>/latex/preamble}`;
   - an article: write `iflayout.def` with `latex/layout.py emit <layout>`, put `ifarticle.cls` beside
     it, and `\documentclass{ifarticle}`.
3. Place logos with `\includegraphics{\branddir/\brandlockuplight}` (or `\brandlockupdark`,
   `\brandicon`), never a path of your own.
4. Licensed typefaces for articles are never part of this design system: install them yourself and
   name their directory in `IF_FONTS_LICENSED`.

Run the harness with `python3 assurance/run.py` (every brand beside it) or `--brand <slug>`; `--keep
<dir>` keeps the PDFs. It needs TeX Live with XeLaTeX, LuaLaTeX and latexmk, and poppler-utils.
