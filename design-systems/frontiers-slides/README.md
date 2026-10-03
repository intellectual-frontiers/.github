# Frontiers Slides

How Intellectual Frontiers presents on a screen: a 1920×1080 canvas, eight layouts, a dark tone, content limits and
speaker notes, themed by a brand, with figures from [`frontiers-figures`](../frontiers-figures/) and text checked
against the house voice. Its rules are [`spec.md`](spec.md); governed by
[`0014-design-systems`](../../spec-kit/specs/0014-design-systems/spec.md).

| Path | What it is |
| --- | --- |
| `deck.py` | `python3 deck.py build DECK.md` writes the slides as HTML (`--inline` for one self-contained file, `--brand SLUG` for another brand); `python3 deck.py check DECK.md` reports every rule a deck breaks. Standard library only. |
| `css/slides.css` | The canvas, layouts, tones and type, colored only by the brand's theme roles. |
| `js/deck.js` | The viewer: one slide at a time, scaled to the window; arrow keys, Home and End; N for speaker notes; P for every slide in order. |
| `limits.json` | The words, points and slides a deck keeps to. |
| `fonts/` | Inter and Source Serif 4, SIL OFL 1.1 (`fonts/LICENSES.md`). |
| `assurance/` | `node assurance/run.mjs` renders the fixture deck in Chromium and checks size, overflow, type and contrast; `python3 assurance/run.py` checks the builder and checker. |

## Writing a deck

```markdown
---
title: We stop a pilot when the evidence says stop
short: Stopping rules
author: A. Speaker
date: 2026-10-03
---
[title]
# We stop a pilot when the evidence says stop
## A talk on writing the failure test first
---
[figure dark]
# Three signals end a pilot
![Three signals, any one of which ends a pilot](figures/stop-signals.svg)
Source: Our 2025 pilot reviews.
Notes:
Read the three from the top.
```

A slide names its layout (`title`, `section`, `statement`, `content`, `figure`, `two-column`, `quote`, `end`) and
optionally `dark`. `#` is the headline, `-` a point, `>` a quoted line and `^` who said it, `![alt](file)` a
figure, `|||` the break between two columns, and everything after `Notes:` the speaker notes. See
`assurance/fixtures/pass/deck.md` for every layout. Vendor this directory beside the brand, `frontiers-figures` and
the house voice, and build with `deck.py`.
