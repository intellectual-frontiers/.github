# Frontiers Spoken Voice

How the house voice changes when a work is heard rather than read. It derives from
[`frontiers-written-voice`](../frontiers-written-voice/): every written rule holds unless [`spec.md`](spec.md) cites
it and states the change (punctuation for performance; no humor, idiom or figure of speech). Governed by
[`0014-design-systems`](../../spec-kit/specs/0014-design-systems/spec.md).

| Path | What it is |
| --- | --- |
| `patterns.json` | Its own patterns: announcement openings, filler, and labels that say a story is made up. |
| `inherited/frontiers-written-voice/` | A copy of the written voice's `patterns.json` and `terms.json`; the harness fails if it drifts from the source. |
| `sweep.py` | `python3 sweep.py SCRIPT ...`, or `sweep.sweep(text, fixed=(identification, tagline))` from Python: the written voice's sweep with both pattern sets. Needs `frontiers-written-voice` beside it. In this repository: `agora check voice --spoken --scope SCRIPT`. |
| `assurance/` | `python3 assurance/run.py`: the copy agrees with its source, and fixture passages pass or are refused for the stated reason. |

When the written voice's patterns change, re-copy them into `inherited/frontiers-written-voice/`.
