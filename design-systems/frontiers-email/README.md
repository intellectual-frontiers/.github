# Frontiers Email

How the house's email looks and reads: newsletters, announcements, invitations and notifications, built from Markdown
into HTML mail clients render (600px, tables, styles inline, a dark tone) and a plain-text alternative, themed by a
brand. Its rules are [`spec.md`](spec.md); governed by [`0014-design-systems`](../../spec-kit/specs/0014-design-systems/spec.md).

| Path | What it is |
| --- | --- |
| `mail.py` | `python3 mail.py build MESSAGE.md -o OUT.html --assets https://.../brand` writes the HTML and `OUT.txt`; `python3 mail.py check MESSAGE.md` reports every rule a message breaks. Standard library only. In this repository: `agora email build PATH --assets https://.../brand` and `agora check email --scope PATH`. |
| `email.json` | The message types, width, the roles each tone uses, and the limits. |
| `assurance/` | `python3 assurance/run.py`: messages built and checked under every brand, and messages that must fail. |

`--assets` is the public https URL the brand directory's files are served from (its `logos/`). See
`assurance/fixtures/pass/newsletter.md` for a message. The unsubscribe link is left as `{{unsubscribe_url}}` for the
sending service to fill.
