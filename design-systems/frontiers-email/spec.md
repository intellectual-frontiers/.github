# Feature Specification: Frontiers Email design system

**Spec ID:** frontiers-email
**Status:** Draft
**Governed by:** 0014-design-systems

**Input:** How Intellectual Frontiers' email looks and reads: newsletters, announcements, invitations and
notifications, built from a short Markdown source into HTML that mail clients render and a plain-text
alternative, themed by a brand in a light and a dark tone.

## Identity and scope

- **FR-001**: `frontiers-email` MUST live at `design-systems/frontiers-email/` and be registered in
  `ifcore.ttl` as an `ifcore:DesignSystem` of the email kind, classified by every email type it sends
  (0014-design-systems FR-051). It MUST NOT assume which list, sender or service sends a message.
- **FR-002**: It MUST hold `email.json` (its types, width, tone roles and limits), `mail.py` (the builder
  and checker), a `README.md`, this spec and an `assurance/` harness.
- **FR-003**: Its source and data MUST hold no color (0014-design-systems FR-044): a tone names brand
  theme roles or mixes of two, and `mail.py` resolves them from the brand when it builds a message,
  because mail clients do not read custom properties.

## Messages

- **FR-004**: A message MUST be one of these types: a newsletter, an announcement, an invitation (each
  sent to subscribers, so each carries an unsubscribe link) or a notification (about something its
  reader did or asked for).
- **FR-005**: A message's source MUST be Markdown with front matter naming its type, subject, preheader
  and the sender's postal address; `#` a heading, `##` a subheading, `-` a point, `---` a divider and
  `[text](https://...){button}` the call to action.
- **FR-006**: A message MUST open with a heading that states its point (frontiers-written-voice FR-004),
  have a subject of 1 to 60 characters and a preheader of 40 to 130, carry at most one call to action,
  and keep to 400 words; a longer piece is linked, never sent whole.
- **FR-007**: Every link MUST be https. The brand's lockup MUST be served from the URL the builder is
  given, at 160px (never below the brand's 100px minimum), with alternative text, width and height.
- **FR-008**: A message sent to subscribers MUST carry an unsubscribe link (left as `{{unsubscribe_url}}`
  for the sending service to fill), and every message MUST carry the sender's postal address in its
  footer.

## Rendering

- **FR-009**: A message MUST render in a light tone (the brand's surface behind its text color) and,
  where a client honors `prefers-color-scheme`, a dark tone (the text color behind the surface), with the
  lockup for each; in both, text, muted text and links MUST meet 4.5:1 against the background and the
  button's label against the button.
- **FR-010**: The built HTML MUST be a 600px-wide, table-laid message whose every text carries its font
  and color inline, with no custom property, external stylesheet or script, under 100,000 bytes (some
  clients clip a longer message); its sans is the brand's, falling back to the system sans, since mail
  clients load no web font. A plain-text alternative MUST be written beside it, carrying every link.
- **FR-011**: A message's subject, preheader and text MUST sweep clean under `frontiers-written-voice`
  when it is beside this design system.

## Assurance

- **FR-012**: `assurance/run.py` MUST, under every brand here, check each tone's contrast, that every
  message in `assurance/fixtures/pass/` passes `mail.py check` and builds as FR-007, FR-009 and FR-010
  say, and that every message in `assurance/fixtures/fail/` is refused for the reason
  `assurance/fixtures/expected.json` names; and check `email.json` holds no color and the ontology
  registers this design system.

## Out of scope

- Sending, lists, consent records and the unsubscribe service: the sending service's.
- Email to one person written by hand: the written voice alone governs it.

## Edge cases

- A client that ignores the dark stylesheet: it shows the light tone, which meets contrast on its own,
  per FR-009.
- A client that blocks images: the lockup's alternative text names the brand, per FR-007.

## Assumptions

- The brand's logo files are published at an https URL the builder is given.

## Open questions

None.

## Key entities

- **Message** — one email's Markdown source, built to HTML and plain text.
- **Tone** — light, or dark where the client honors it.

## Success criteria

- **SC-001**: `python3 assurance/run.py` exits zero with every brand here beside this design system.
- **SC-002**: A sender writes a message in Markdown and sends it with no HTML of their own.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No consumer is named or assumed
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information
