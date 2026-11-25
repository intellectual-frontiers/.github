# Plan: 0004-runbooks-projections

**Spec:** 0004-runbooks-projections. **Written:** 2026-11-25.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| Claude Code skills (`https://code.claude.com/docs/en/skills`, read 2026-11-25) | A skill is a directory `<name>/SKILL.md` (project: `.claude/skills/<name>/SKILL.md`); the file opens with YAML frontmatter between `---` lines on its first line; every field is optional and `description` is recommended; `name`, `description`, `disable-model-invocation` and `allowed-tools` are fields; unknown fields are ignored; a `SKILL.md` stays under 500 lines | Sections File layout, Frontmatter format and Field list. The last 21 thousand characters of the page were not read |
| Claude Code settings (`https://code.claude.com/docs/en/settings`, read 2026-11-25) | `permissions` holds `allow`, `ask` and `deny` rules in settings files; a rule names a tool and what it may do, as `Bash(npm run test *)`; the rule syntax page was not read, so the library writes only `Bash(<command> *)` and `Bash(<command>)` | Sections Edit a settings file and Lists merge |
| Codex `AGENTS.md` (`https://learn.chatgpt.com/docs/agent-configuration/agents-md`, read 2026-11-25) | Codex reads `AGENTS.override.md` or `AGENTS.md` in each directory from the project root down, concatenates them, and stops adding files at `project_doc_max_bytes` (32 KiB by default); the page describes no skills format and no per-command rule file | The page. Its links to skills pages were not followed, so no Codex skill format is claimed and none is written |
| NIST OSCAL, implementation layer concept page (`https://pages.nist.gov/OSCAL/learn/concepts/layer/implementation/`, read 2026-11-25) | The implementation layer holds a system security plan model and a component definition model; the statement of how a control is implemented is the content of an SSP | Only the two model names were found; the SSP reference page was not found at the address tried, so the projection is Markdown in the shape of a statement and writes no OSCAL JSON, and no OSCAL field name is claimed |
| W3C PROV-O (`https://www.w3.org/TR/prov-o/`, read 2026-11-25; namespace `http://www.w3.org/ns/prov#`) | A run is an activity (`prov:Activity`), associated with an agent (`prov:wasAssociatedWith`), an agent acts on behalf of another (`prov:actedOnBehalfOf`), an activity used and generated entities (`prov:used`, `prov:wasGeneratedBy`) | Section 4.1, the cross-reference entries. The statement links to the run id and says which of these it is in words; it writes no RDF |

## What is built and what is reused

Reused: the shape of the dialects of the workbench (a `Dialect`, `RenderedFile`, the same bytes each time) and of its `tools/pages.ts`. New: the five projections and the page generator.
