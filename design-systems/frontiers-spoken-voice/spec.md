# Feature Specification: Frontiers Spoken Voice design system

**Spec ID:** frontiers-spoken-voice
**Status:** Draft
**Governed by:** 0014-design-systems

**Input:** How the house voice changes when a work is heard rather than read (an episode, a talk, a
course video, a voice-over): writing for the ear, humor, punctuation for performance, transitions and
repetition, derived from `frontiers-written-voice`.

## Identity and scope

- **FR-001**: `frontiers-spoken-voice` MUST live at `design-systems/frontiers-spoken-voice/`, be
  registered in `ifcore.ttl` as an `ifcore:DesignSystem` of the spoken-voice kind (0014-design-systems
  FR-034), and record that it derives from `frontiers-written-voice` (`prov:wasDerivedFrom`,
  0014-design-systems FR-020). It is not a second house voice: every rule of `frontiers-written-voice`
  holds for spoken work except where a requirement here cites one and states the change.
- **FR-002**: It MUST hold `patterns.json` (its own patterns), `inherited/frontiers-written-voice/` (a copy
  of that design system's `patterns.json` and `terms.json`, 0014-design-systems FR-021), `sweep.py`, a
  `README.md`, this spec and an `assurance/` harness. Its patterns MUST add to the written voice's and
  MUST NOT remove or loosen any.

## Writing for the ear

- **FR-003**: A script MUST start with the point; a pre-recorded intro, station identification or title
  card is never permission to warm up again. It MUST NOT repeat the intro or greet the audience.
- **FR-004**: A script MUST be understood on one hearing: one main clause at a time where a written
  sentence would make the listener hold several; an important noun repeated where a pronoun would make
  the listener reconstruct a distant antecedent; an acronym expanded the first time it is spoken unless
  the show records that its audience knows it; a number given in a form that can be heard and kept, and
  left out when the argument does not need it.
- **FR-005**: A script MUST NOT announce what is coming or label what was just said ("in this episode",
  "let me start with", "the last tool is", "this deserves its own minute"), MUST NOT use filler ("great
  question", "let's unpack that") or fake banter, spontaneity or radio-host enthusiasm, and MUST NOT read
  vendor copy as editorial judgment. The openings, phrases and labels `patterns.json` lists are refused.
- **FR-006**: A transition MUST tell the listener why the next idea follows ("That changes the buyer's
  question"), never only that it is next ("Now let's move on to buyers"). A central claim MAY be
  repeated only where the repetition does a new job: reorienting after a break, joining new evidence, or
  making the consequence clearer.
- **FR-007**: A story told as from practice MUST be told as a hypothetical ("picture a deal that dies
  late", "say a hospital buys a platform") and MUST NOT be labelled as made up ("this is an illustrative
  case"), and MUST NOT name a real organization or person.

## Humor, punctuation and delivery

- **FR-008**: This overrides `frontiers-written-voice` FR-010 for spoken work: a script MAY use more humor
  than the written voice, dry and specific (a deadpan detail, a wry observation, an absurd setup that
  resolves into a hard fact), provided each joke carries a point, is never at a named person's or a
  patient's expense, and never hides uncertainty, softens a claim or stands in for evidence. Puns,
  slogans, laugh lines and ornate imagery stay refused. Punctuation in a script MAY help the speaker
  breathe and find the cadence, but MUST NOT carry logic a listener cannot hear (a semicolon,
  parentheses, an em dash); short paragraph blocks are performance aids, not one sentence per paragraph.
- **FR-009**: `sweep.py` MUST sweep a script's spoken text with the written voice's patterns and shared
  terms (its copy) and its own, leaving out the passages a show's format dictates (its identification,
  its tagline). A script is not finished until it sweeps clean and has been read aloud at delivery pace,
  with every sentence a speaker would not say across a table rewritten.

## Assurance

- **FR-010**: `assurance/run.py` MUST check that its copy of the written voice's patterns and terms is
  identical to the source, that its own patterns drop or loosen none of them, that every passage in
  `assurance/fixtures/pass/` sweeps clean, that every passage in `assurance/fixtures/fail/` is refused for
  the reason `assurance/fixtures/expected.json` names, and that the ontology records this design system
  and its derivation.

## Out of scope

- A show's own formats, fixed wording, sources and editorial independence rules: the consumer's.
- Audio production, recording and transcription.

## Edge cases

- A banned word inside a guest's quoted words: the host's scripted text is swept, never a guest's, per FR-009.
- A show's tagline that would break a pattern: it is passed to the sweep as fixed text, per FR-009.

## Assumptions

- A consumer vendors `frontiers-written-voice` beside this design system; `sweep.py` imports its engine.

## Open questions

None.

## Key entities

- **Script** — the text a speaker reads, swept as spoken text.
- **Fixed text** — a passage a show's format dictates, left out of the sweep.

## Success criteria

- **SC-001**: `python3 assurance/run.py` exits zero.
- **SC-002**: A consumer's script checker needs no copy of any pattern of its own.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No consumer is named or assumed
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information
