# Frontiers Written Voice

How Intellectual Frontiers writes: voice, usage, punctuation and presentation form, with the Chicago Manual of Style
as the style authority, and the patterns a mechanical sweep looks for. Its rules are [`spec.md`](spec.md); it is
governed by [`0014-design-systems`](../../spec-kit/specs/0014-design-systems/spec.md).

| Path | What it is |
| --- | --- |
| `patterns.json` | The banned words and phrases, hedges, stock openings and closings, announcement openings and throat-clearing (a sentence that describes what the writing does), self-descriptions of a page's apparatus (what its items say or show, as regular expressions), wrap-up asides, the headline openings and labels that announce a topic instead of stating a claim, plain-word swaps and limits the sweep checks. |
| `terms.json` | The shared terms the house writes exactly as the ontology names them, each by its IRI, with the variants to avoid. |
| `sweep.py` | The sweep: `python3 sweep.py FILE ...` over AsciiDoc, Markdown, HTML or text, prose and headings alike, `--mode procedure` for ASD-STE100 procedures, `--draft` to report without failing, `--patterns` and `--terms` to add a consumer's or a derived voice's own. Standard library only. In this repository: `agora check voice --scope PATH [--mode procedure] [--draft]`. |
| `assurance/` | `python3 assurance/run.py`: the patterns and terms hold together, and fixture passages pass or are refused for the stated reason. |

## Using it

Vendor this directory beside the tools that check your works and run `sweep.py` over each finished piece; a clean
sweep is necessary, not sufficient, since no sweep can judge an argument (spec FR-017). Import it to sweep text you
have already extracted:

```python
import sweep
patterns = sweep.load([Path("frontiers-written-voice/patterns.json")])
terms = sweep.load_terms([Path("frontiers-written-voice/terms.json")])
fails, warns = sweep.sweep(text, patterns, terms=terms)
```

A spoken voice derives from this one and adds its own patterns (spec FR-018). Writing samples, instructions written
for or about a named author, and audit prompts never belong here; they stay with the consumer (spec FR-001).

## Say it once

0044-public-website FR-079 says every label the website writes beside a work's words says something those words do
not, once. The rule came from reading every page element against its neighbours; this is what each pass found and
why the clause reads as it does.

- **Kickers, badges and meta lines.** A kicker above "Care Delivery Fund I" reading "Fund", a card in a section headed
  "Book companions" labelled "Book companion", a badge "In build" over a meta line "In build · since 2026": each told
  the reader what the words beside it had told them. A kind is a kicker only where the heading does not state it and
  the section mixes kinds; a status is a badge or a meta line, not both.
- **Ledes and taglines.** A patent page's lede repeated the number and family title of its heading and trail; a
  venture's tagline was its summary, followed by the same summary as the first paragraph. A lede adds the kind, dates
  and offer the heading leaves out, or there is none.
- **Headings, links and buttons.** "More about this patent", "What is here", "Read the original patent here", a bare
  "Visit", and two buttons to one full text. A heading names its subject and a link its target; one page makes one
  call to one action.
- **Asides and the footer.** An aside is the page's fact sheet, so a fact in it is not the tagline, a kicker or a body
  line as well ("Under the pillar X" above a "Pillar: X" row), and no two rows state one fact ("Size: Under $1M
  (Active now)" beside "Status: Active now"). The footer's line about the firm is left off the home and About pages,
  whose heads say it.
- **Alt text and captions.** A drawing's alt "US10489830B2, Sheet 1 of 14" beside a caption "Sheet 1 of 14" was heard
  twice. A linked image's alt names what the link opens; an image whose caption says it all has an empty alt.
- **Forms, empty states, tables and lists.** A hidden label with a visible placeholder is one name; "No corrections
  yet" is said once, then what will appear; a column reading "Open" in every row under a lede that says positions stay
  open is left out; a list item does not append "explains US10643208B2" to a title that ends in that number.
- **Dates.** One form, "1 January 2026", whatever the record holds; a priority date equal to the filing date is not a
  second row; a record's sentence that restates the fact sheet is not shown.
- **Descriptions and structured data.** A description that is the title again, or empty, or one sentence shared by
  twenty-five pages, tells a search result nothing; whole sentences up to about 300 characters do. Structured data
  states the organization and website once and the page's facts under one type each.
- **Machine editions.** "Working paper: " before a feed title is the entry's category; an llms.txt line that only
  names its page says nothing; the sitemap lists each page once.
- **Error pages and redirects.** A not-found page that lists five fronts under the menu that carries six repeats the
  menu; a redirect reaches a served page in one hop.
- **The Console and the log-in.** A lede that counts what the tiles count, or says the Console is this computer's
  under a label that says so, says it twice; "Enter your email address" above a field labelled Email does too.

The exceptions are in FR-079 itself: the patent FAQ blocks, the trail beside the navigation, "Cover of X", the
worksheets' blank columns, "Print this page", a skill's own genre, and numbering.
