# Reducing drift: the controls

Each kind of drift from [Why: the drift problem](mizan-why.md) has a control that a program can run. Where no control can read the thing (meaning), a person reviews it and the reason is recorded.

| Drift | Control | Where it lives | Status |
| --- | --- | --- | --- |
| A: spec ↔ ontology | A specification names only terms the ontology defines; every term cites its specification | `0015-trace` FR-008, `0003-mizan` FR-020 | **Built** (`0003` FR-020: a specification names only terms the ontology defines) |
| A: spec ↔ spec | A gapless register; edge cases cite real requirements; citations of other repositories name them | `0003-mizan`, `mizan-check` | **Built** |
| A, B: requirement ↔ proof | One row per requirement in the proof register; `proves([...])` in tests; an Active spec's unproved requirement fails | `enforcement.tsv`, `0015-trace` | **Built** |
| B: code ↔ requirement | Every source file has a `// Spec:` line | `0015-trace` FR-005, FR-007 | **Built** |
| B: code ↔ ontology | Code lists are imported as unions; generated files are checked for staleness | Generators with `--check` | **Built** (per harness) |
| B: layers | An import that climbs the ladder is refused | `0015-trace` FR-009, FR-010 | **Built** |
| Requirement quality | EARS patterns; Gherkin scenarios that cite requirements | `mizan-check` plugins | **Built, warn-only** |
| C: us ↔ the world | Standards pinned with a hash; a newer upstream version is a finding | `Standard` record; integrations | **Built** (`newer.ts` is opt-in: it alone needs the network) |
| D: invention | A basis on every term; `unaligned` needs justification and a Decision; the count only shrinks | `0018-standards-first` | **Built** (a basis on every term of commons' ontologies; 90 days; baseline) |
| Change | Every commit names an issue on a line of its own; closing words and unfinished issues are findings; warn, then gate | `0020-ifccm`, `commons/libraries/src/changes.ts` | **Built** |
| Proof, over time | Evidence graded E0 to E5; a stale proof opens a nonconformance; a CAPA closes on a named test and a named person | `0021-ifqs`, `commons/quality/src/` | **Tiers 0 and 1** **Tier 2 in progress** |
| Languages | No fact kept as source outside natural language and TypeScript, except a named `Exception` | `0017-two-languages` | **Specified** |
| Meaning | A person reviews; the reason is in the register | Proof register mechanism `review` | **Built** |

## The warn-first discipline

A new rule never fails what a harness already holds. It starts as a warning, with a baseline file listing today's findings. A new finding fails; a baseline line that is not found any more also fails, so the baseline can only shrink, and you cannot "fix" a check by adding a line. This is the same mechanism `stolos` already uses for its trace and layer checks.
