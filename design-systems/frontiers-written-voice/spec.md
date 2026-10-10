# Feature Specification: Frontiers Written Voice design system

**Spec ID:** frontiers-written-voice
**Status:** Draft
**Governed by:** 0014-design-systems

**Input:** How Intellectual Frontiers writes, in any written work (a book, a paper, a page, an email, a
deck's text): its voice, usage, punctuation and presentation form, with a named style authority, and the
patterns a mechanical sweep looks for.

## Identity and scope

- **FR-001**: `frontiers-written-voice` MUST live at `design-systems/frontiers-written-voice/` and be
  registered in `ifcore.ttl` as an `ifcore:DesignSystem` of the written-voice kind (0014-design-systems
  FR-010, FR-033). Its rules MUST be stated as the house's voice, never as any one person's, and it MUST
  NOT hold the material they were drawn from: writing samples, instructions written for or about a named
  person, or audit prompts (0014-design-systems FR-025). That material, and how a named author's name is
  written, stay with the consumer.
- **FR-002**: It MUST hold `patterns.json` (the patterns its sweep looks for), `terms.json` (the shared
  terms it requires), `sweep.py` (the sweep), a `README.md`, this spec and an `assurance/` harness. The
  lists in `patterns.json` and `terms.json` are part of these rules; where this spec and a list disagree,
  this spec wins and the list is fixed.
- **FR-003**: The Chicago Manual of Style MUST be the style authority for any question of usage,
  punctuation, capitalization, citation or reference form these rules do not settle. A work MAY state its
  own exception (a technical style guide it must match, a co-author's contract).

## Voice

- **FR-004**: A piece MUST start with the point: no warm-up, no description of what it will cover, no
  case for why the reader should care before saying what matters, no summary of the argument before
  making it, and no repeat of the conclusion after making it.
- **FR-005**: It MUST use the first person in the active voice: "I" for the author's beliefs,
  experience, judgment and decisions; "we" only where the work needs other people to carry it out.
- **FR-006**: It MUST use plain, specific language: active verbs, concrete examples, named
  situations, evidence and consequences, and a clear assertion followed by its evidence, example or
  practical implication. It MUST prefer the plain word over the word written in a report ("use", not
  "utilize"; "show", not "demonstrate"; "enough", not "sufficient"), MUST say each thing literally
  (FR-021), and MUST NOT talk down to the reader or make a hard question look easy.
- **FR-007**: It MUST NOT hedge unless the uncertainty is real and important, and then MUST say exactly
  what is unknown, why, and what evidence would settle it. It MUST NOT sound more certain than the facts,
  or more timid than the evidence.
- **FR-008**: It MUST NOT use the consultant, marketing, academic or machine-drafted words and phrases,
  the generic hedges, or the stock introductions and closings that `patterns.json` lists (`fail_words`,
  `hedges`, `throat_clearing`). A word in `warn_words` MAY be used only in its literal sense
  ("ecosystem" for a real network of parties that cannot be named more precisely).
- **FR-009**: It MUST NOT announce that a point is coming ("here's the part that matters", "this
  section explores"), describe what the writing is doing instead of saying it ("in this article we
  examine", "this report provides a detailed analysis of", "the purpose of this page is"), look back at
  what it said ("as discussed above", "in conclusion"), or end a paragraph on a cute wrap-up aside; it
  says the point, and the reader meets the idea, never a description of the writing. The test is
  editorial: a sentence that describes what the author or the document is doing, rather than giving the
  reader something in plain words, is rewritten or removed. This holds for every part of a piece: its
  title, subtitle, description or summary, headings, lede, transitions and body. A heading MUST state
  the claim, plainly, as a sentence a reader could repeat ("We stop when the evidence says stop", never
  "Reasons we may consider stopping"), never announce a topic or an activity ("Exploring the evolving
  role of AI", "A closer look at", "Key considerations", "Overview", "Conclusion"), and carry no wordplay,
  simile, paradox, slogan or echo of the work's title. `patterns.json` lists the announcements, the
  throat-clearing and the headline openings and labels the sweep refuses (FR-017); the sweep finds the
  mechanical cases, and a person reads the rest.
- **FR-010**: It MUST NOT use witty, literary, lyrical or ornate prose, metaphors, similes, wordplay
  or humor, and MUST NOT make a line memorable by its phrasing. A reader may be a non-native speaker or
  read a machine translation, and wit and humor depend on a culture and a language the reader may not
  share. Interest comes from the evidence, the example and the consequence, said plainly.
- **FR-011**: A contrarian claim MUST be earned by evidence and MUST lead somewhere practical: what the
  usual view gets wrong, what the evidence says instead, and what to do differently. A piece MUST prefer
  a useful conclusion (a decision, an experiment, the smallest useful test, a next action) over a
  balanced but empty summary.

## Usage, punctuation and rhythm

- **FR-012**: A piece MUST NOT use an em dash; it uses a comma, a colon, parentheses or a new sentence.
  It MUST use curly quotes, the serial comma, and an en dash only in a numeric range (2013–2025). It
  MUST NOT use the "not only X but also Y" formula, and MAY use the "It is not X. It is Y." seesaw at
  most once, where the contrast earns it.
- **FR-013**: Sentences SHOULD be short without being choppy, with natural variation in length; a
  three-part list or parallel construction put in for rhythm rather than meaning MUST be broken up.
  Every paragraph MUST do a job (make a claim, give evidence or an example, draw an implication, state a
  decision, tell the reader what to do); a paragraph that only sounds polished is cut.
- **FR-014**: A procedure, runbook or how-to, and only those, MUST follow ASD-STE100 (Simplified
  Technical English, Issue 9): one instruction per sentence, numbered steps for a sequence, instructions
  of no more than 20 words and descriptive sentences of no more than 25, active voice in the present
  tense, one word for each action and each technical noun, warnings before the step they apply to, and
  every step naming who does it.

## Presentation form

- **FR-015**: Content MUST take the form that fits it: prose for an argument; a list (bulleted when
  order does not matter, numbered when it does, items parallel, a period only after a full sentence) for
  enumerable items; a table for content parallel across two or more dimensions; a figure where a
  picture lands faster than a paragraph. A list, table or figure MUST be introduced and interpreted in
  the prose around it. A figure or table is referred to by number ("Figure 1.1"); a chapter of the same
  work is referred to by its title in quotation marks, never by its number.

## Shared terms

- **FR-016**: A term the ontology defines MUST be written as the ontology names it. `terms.json` lists
  the house's shared terms, each by its IRI in `ontology/ifcore.ttl`, the label to use (its
  `rdfs:label`, `skos:prefLabel` or `skos:altLabel`) and the variants that MUST NOT be used. A term's
  definition is always the ontology's and never part of this design system. A consumer MAY add its own
  shared terms in a file of the same shape.

## Machine-readable form and audit

- **FR-017**: `sweep.py` MUST find, in a passage of prose or a file of AsciiDoc, Markdown or HTML read as
  its prose: an em dash, every pattern `patterns.json` lists, an avoided variant of a shared term, the
  "not only X but also Y" formula, more seesaws than allowed, and more "Not X." fragments than reads
  naturally; in a file's headings, its title included, a heading that announces a topic or an activity
  or is a bare label (a FAIL) and one that only names a topic (a WARN) (FR-009); and, in procedure mode,
  an instruction or sentence over its length and a passive instruction. It MUST exit non-zero on a FAIL, and report a WARN without failing. A finished piece MUST
  sweep clean and MUST also pass an adversarial human read against every rule here, since no sweep can
  judge an argument.
- **FR-018**: A design system that derives from this one (a spoken voice, 0014-design-systems FR-020,
  FR-034) MUST add its own patterns in a file of the same shape, swept together with these by
  `sweep.py --patterns`, and MUST NOT remove any of these.
- **FR-020**: A URL is never swept; its link text is. `sweep.py` MUST leave out of every pattern in FR-017
  each `http://` or `https://` URL (up to whitespace or a bracket, without the sentence's own closing
  punctuation) and each `mailto:` address, in any text it is given, so that a variant, a banned word or
  an em dash inside an address is never reported. It MUST still sweep the link text written after a URL
  in an AsciiDoc macro (`https://example.org/a-b[Native Alpha]`) and the text around it.

- **FR-021**: It MUST be understood by a reader who is not a native speaker of English, without cultural
  knowledge. It MUST NOT use an idiom, a figure of speech, a proverb, a sports, war, theater, cooking or
  travel image, a cultural reference or slang. It SHOULD prefer one precise verb to a phrasal verb with a
  non-literal sense ("start", not "kick off"; "examine", not "dig into"; "find", not "turn up"). A
  sentence SHOULD carry one idea. A heading, caption or sidebar title states what the section contains,
  in plain words, and a name given to a failure or a method describes it ("a prompt that only looks
  thorough", never "prompt theater"). The `idioms` list in `patterns.json` holds the common idioms the
  sweep reports as warnings; it is not complete, and a human read against this rule is still required.

## Assurance

- **FR-019**: `assurance/run.py` MUST check that `patterns.json` holds only keys `sweep.py` reads, with
  no pattern listed twice; that every shared term in `terms.json` is in `ontology/ifcore.ttl` under the
  label it gives; that every passage in `assurance/fixtures/pass/` sweeps clean; that every passage in
  `assurance/fixtures/fail/` is refused for the reason `assurance/fixtures/expected.json` names; and
  that the ontology registers this design system.

## Out of scope

- The material the rules were drawn from, and anything written for or about a named author: the
  consumer's own record (FR-001).
- An editorial audit's full process and scoring: the consumer's, built on these rules.
- How a pipeline marks up a list, table or figure (AsciiDoc, LaTeX): the print or web design system's.
- How the voice changes for the ear: a spoken-voice design system derived from this one.

## Edge cases

- A banned word used in its literal sense, quoted or named as an example (this spec quoting "delve"):
  the sweep cannot tell, so a passage that discusses the rules is not swept, or its finding is waived by
  the human read, per FR-017.
- A printed sources box that must give a page's address (`https://www.intellectualfrontiers.com/native-alpha`)
  whose slug spells a shared term's avoided variant: the address is not prose and is not swept; its link
  text is, per FR-020.
- A work that must match an outside style guide: it states the exception, per FR-003.
- A procedure inside an essay: the procedure is swept in procedure mode and the essay in prose mode, per FR-014 and FR-017.

## Assumptions

- A consumer runs `sweep.py` with Python 3.9 or later; it needs nothing outside the standard library.

## Open questions

None.

## Key entities

- **Pattern** — a word, phrase, sentence opening or construction the sweep refuses or questions.
- **Shared term** — a term the ontology defines, written as the ontology names it.
- **Procedure mode** — the ASD-STE100 rules a procedure, runbook or how-to is written and swept to.

## Success criteria

- **SC-001**: `python3 assurance/run.py` exits zero.
- **SC-002**: A consumer's checker that sweeps its works with `sweep.py` and these files needs no copy
  of any pattern of its own.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No consumer is named or assumed
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information
