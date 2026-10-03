# Feature Specification: Frontiers Slides design system

**Spec ID:** frontiers-slides
**Status:** Draft
**Governed by:** 0014-design-systems

**Input:** How Intellectual Frontiers presents on a screen (a talk, a lecture, a workshop, a briefing): the
slide canvas, its layouts, type and tones, the limits a slide keeps to, speaker notes, and the builder that
turns a deck written in Markdown into themed slides.

## Identity and scope

- **FR-001**: `frontiers-slides` MUST live at `design-systems/frontiers-slides/` and be registered in
  `ifcore.ttl` as an `ifcore:DesignSystem` of the slides kind, classified by every deck type it serves
  (talk, lecture, workshop, briefing), naming `frontiers-figures` by `ifcore:drawsFiguresWith`
  (0014-design-systems FR-048, FR-049). It MUST NOT assume which work, speaker or venue a deck is for.
- **FR-002**: It MUST hold `css/slides.css`, `js/deck.js` (the viewer), `deck.py` (the builder and
  checker), `limits.json`, `fonts/` (the faces it sets, with their licence), a `README.md`, this spec
  and an `assurance/` harness.

## Canvas, color and layouts

- **FR-003**: A slide MUST be a 1920×1080 canvas with a safe area of 128px at the sides and 104px at
  the top and bottom, and nothing on it MAY run outside the slide or under its footer.
- **FR-004**: Every color MUST be a brand theme role or a mix of two (0014-design-systems FR-037,
  FR-044); the stylesheet holds no color, and a deck's text MUST NOT carry one.
- **FR-005**: A slide MUST take one of these layouts, and a deck MUST open with a title slide:
  - **title**: the deck's claim, its subtitle, who and when, and the brand's lockup;
  - **section**: a part's number and its claim, on the dark tone unless set otherwise;
  - **statement**: one claim, large, and nothing else;
  - **content** (the default): a headline over at most five points or a short paragraph;
  - **figure**: a headline over one figure filling the rest of the slide, with its source;
  - **two-column**: a headline over two equal columns;
  - **quote**: someone's words in the brand's serif, always with who said them;
  - **end**: what to do next, and the brand's lockup.
- **FR-006**: Every slide but a quote MUST have a headline, and the headline MUST state the slide's
  claim as a sentence (frontiers-written-voice FR-009), in no more words than `limits.json` allows for
  its layout.

## Figures, tones and type

- **FR-007**: A figure MUST be drawn with `frontiers-figures` (0014-design-systems FR-048); `deck.py`
  themes it with the deck's brand and inlines it, so it is set in the deck's own type. A raster image (a
  screenshot, a photograph) is a work's own asset and MAY be placed as it is.
- **FR-008**: A slide MAY take the dark tone, the brand's text color as its background; on it every
  role is remapped so text meets WCAG 2.2 AA (4.5:1) and a figure takes `frontiers-figures`' on-dark
  variant. Text MUST meet 4.5:1 against its slide in either tone, and no text MAY be set below 24px.
  The headline is 64px, body text 40px, the title and section claim 112px.
- **FR-009**: A figure or image MUST carry alternative text, and a deck MUST make sense with its
  speaker notes read aloud by someone who cannot see the slides.

## Building and viewing

- **FR-010**: A deck's source MUST be Markdown with front matter (its title, a short title for the
  footer, author and date) and slides separated by `---`, each naming its layout and tone; `deck.py
  build` MUST turn it into HTML linking the brand's `brand.css`, this stylesheet and the viewer, or into
  one self-contained file with `--inline`. The viewer MUST show one slide at a time scaled to the
  window, move with the keyboard, keep the slide in the URL's hash, show the speaker notes beside the
  slide on request, and print one slide a page.

## Content

- **FR-011**: A slide MUST keep to the limits `limits.json` sets: at most five points of at most 14
  words, at most 45 words of body text (70 on two columns, 50 on a quote, 20 under a figure, none on a
  statement or section), and a deck of at most 60 slides. A point that needs more words belongs in the
  speaker notes.
- **FR-012**: A content, figure or two-column slide MUST have speaker notes saying what the slide does
  not.
- **FR-013**: A slide's text MUST sweep clean under `frontiers-written-voice` and its speaker notes
  under `frontiers-spoken-voice`, when they are beside this design system (the seesaw limit applies to
  the deck, never to one slide).

## Assurance

- **FR-014**: `assurance/run.mjs` MUST, in Chromium under every brand here, render the fixture deck
  built by `deck.py` and check that every slide is 1920×1080, that the deck uses every layout and both
  tones, that nothing runs outside its slide or under its footer, that no text is below 24px, that all
  text meets 4.5:1 against its slide, that a figure on a dark slide is on-dark, that the stylesheet
  holds no color, and that the viewer works as FR-010 says.
- **FR-015**: `assurance/run.py` MUST check that `deck.py build` writes the committed fixture deck
  exactly, that the fixture deck passes `deck.py check`, that every deck in
  `assurance/fixtures/fail/` is refused for the reason `assurance/fixtures/expected.json` names, and
  that the ontology registers this design system as FR-001 says.

## Out of scope

- A deck's content, and where it is presented: the work's own record.
- Video recording of a talk, and its thumbnail and title card: a media design system's.
- Office formats (.pptx, .key): a consumer MAY export a built deck's PDF; this design system does not
  write them.

## Edge cases

- A point too long for its limit: it moves into the speaker notes, per FR-011.
- A screenshot on a figure slide: it is placed as it is, with alternative text, per FR-007 and FR-009.
- A brand whose sans this design system does not ship: the deck falls back to the system sans, and the
  harness under that brand still checks size and contrast, per FR-014.

## Assumptions

- A deck is presented from a current browser, or printed to PDF from one.

## Open questions

None.

## Key entities

- **Deck** — a talk's slides, built from one Markdown source.
- **Layout** — one of the eight slide shapes FR-005 lists.
- **Tone** — light (the brand's surface) or dark (the brand's text color).

## Success criteria

- **SC-001**: `node assurance/run.mjs` under every brand here and `python3 assurance/run.py` exit zero.
- **SC-002**: A speaker writes a deck in Markdown and presents it, with figures and notes, with no
  styling of their own.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No consumer is named or assumed
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information
