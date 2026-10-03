# Frontiers Media

The images that package a work for a platform: podcast and episode art, video thumbnails, title cards, lower thirds
and social cards, themed by a brand with its imagery pool and lockup. Its rules are [`spec.md`](spec.md); governed by
[`0014-design-systems`](../../spec-kit/specs/0014-design-systems/spec.md).

| Path | What it is |
| --- | --- |
| `formats.json` | Every asset type: size, safe margin, title range and limits, what it carries, and the two tones' roles. |
| `media.py` | `python3 media.py render JOB.json -o OUT.png` lays out and renders an asset; `python3 media.py check JOB.json` reports every rule it breaks. Needs Pillow and rsvg-convert. |
| `fonts/` | Inter Regular and Bold, SIL OFL 1.1, to measure and set the text. |
| `assurance/` | `python3 assurance/run.py`: every format rendered and checked under every brand, and jobs that must fail. |

A job:

```json
{"format": "video-thumbnail", "tone": "dark", "kicker": "Episode 12",
 "title": "Write the failure test first", "imagery": "@first"}
```

Formats: `podcast-cover`, `episode-art`, `video-thumbnail`, `title-card`, `lower-third`, `social-square`,
`social-portrait`, `social-story`. Vendor this directory beside the brand and the house voice.
