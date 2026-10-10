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
