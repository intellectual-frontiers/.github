# Frontiers Signage Print

Posters, a roll-up banner and event badges, as vector PDF at trim size plus bleed, themed by a brand. Its rules are
[`spec.md`](spec.md); governed by [`0014-design-systems`](../../spec-kit/specs/0014-design-systems/spec.md).

| Path | What it is |
| --- | --- |
| `formats.json` | Each sign: trim, bleed and safe margin in points, type range and limits, and the tones' roles. |
| `signage.py` | `python3 signage.py render JOB.json -o OUT.pdf`; `python3 signage.py check JOB.json`. Needs Pillow and rsvg-convert. In this repository: `agora sign build JOB.json` and `agora check signage --scope JOB.json`. |
| `fonts/` | Inter Regular and Bold, SIL OFL 1.1. |
| `assurance/` | `python3 assurance/run.py`: every format rendered and checked under every brand, and jobs that must fail. |

A job:

```json
{"format": "poster-18x24", "tone": "dark", "kicker": "Workshop", "title": "Write the failure test before the kickoff",
 "details": ["Thursday, 10:00 to 12:00", "Main room"], "imagery": "@first"}
```

Formats: `poster-18x24`, `poster-a2`, `rollup-banner`, `event-badge`. Pictures and the lockup never print below 150
pixels per inch, so a large sign carries them smaller than its width; larger art needs larger imagery masters.
