# Feature Specification: Workload projections

**Spec ID:** 0004-workload-projections
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** What is made from a workload for each reader, whatever its form: the index of skills and one skill file each for a harness, a checklist for a person, an implementation statement for an auditor, the rules a harness is given from the effects, and the scenario of the specification. Each form gives a view of its workload (its nodes with the autonomy derived for each, the verbs, the controls, the evidence) and the projections are made from views, so that a dialect is written once for every form. Each is made from the code and is the same bytes each time.

## Requirements

- **FR-001**: The library MUST project `SKILLS.md`, an index of the workloads with the name, the form, the use and the link of each, and one `SKILL.md` for each workload in the folder `<name>/` of the skill, whose frontmatter has `name` and `description` and (as Claude Code documents) `allowed-tools` and `disable-model-invocation`, written between `---` lines on its first line and kept under 500 lines.
- **FR-002**: A `SKILL.md` MUST say its name, when to use it, its form and its trigger, its inputs, the verbs it calls, the autonomy derived for each node, the controls it answers to, the evidence it yields and its links, and MUST give an agent only the instruction to call the verbs by id and never a command built from a node's text.
- **FR-003**: The library MUST project a checklist for a person, each node with its kind, its derived autonomy, who acts, what stops for a person (an `ask` or a gate), and the evidence to keep, in the order of the nodes.
- **FR-004**: The library MUST project an implementation statement for each control the nodes cite, in the shape of the statement of a system security plan, in Markdown: the control by its URN, the nodes that answer it, the evidence they yield, and a link to each run that recorded them by the id of its work order; the library MUST NOT write OSCAL JSON until the field names of OSCAL are read from its model reference.
- **FR-005**: The library MUST project the rules of a harness from the effects: for the Claude Code dialect the `permissions` of its settings with a rule `Bash(<command> *)` in `allow` for each verb whose nodes are all `agent-autonomous` or `agent-acts-human-reviews`, in `ask` for `agent-proposes` and in `deny` for `human-only`; for the Codex dialect, a block of `AGENTS.md` that says the same in words and links `SKILLS.md`; and the human dialect MUST be the checklist.
- **FR-006**: A projection MUST be the same bytes for the same workloads, MUST hold no credential value and no secret, MUST write no shell line from a node's text, and a format of a harness MUST be checked against that harness's current documentation before a release.
- **FR-007**: Where a format of a harness could not be verified, the projection MUST be the conservative one and the spec MUST say so: the Codex dialect writes `AGENTS.md` text and no skill file, and no OSCAL JSON is written.
- **FR-008**: The library MUST make the projections for every dialect registered (0007-workload-harness) from the one source, a workload, whatever its form, and switching the dialect MUST change only the projection (the skill files, the allow, ask and deny rules and the entry of a tool server) and never the nodes, the effects or the derived autonomy.
- **FR-009**: A workload MUST read as a Mizan scenario: the library MUST project its Given as the requirements of the workbench it needs, its When as its nodes in order and its Then as the nodes that assert, and the projection MUST cite the requirements the nodes cite.
- **FR-010**: Every projection MUST be made from the view of a workload, which each form gives of its own (its nodes with the autonomy derived for each, the verbs, the controls, the evidence), and not from a form, so that a dialect is written once and projects a workload of every form, an index lists the form of each workload, and a form added later is one view.

## Acceptance scenarios

1. **Given** the starter workload, **When** its skill is projected, **Then** the file starts with `---`, has `name` and `description`, and is under 500 lines, per FR-001.
2. **Given** the starter workload, **When** its skill is read, **Then** every node has its derived autonomy and every verb its id, per FR-002.
3. **Given** the starter workload, **When** its checklist is made, **Then** a gate and a judge are marked as a person's and as a proposal, per FR-003.
4. **Given** a run of the starter workload, **When** its implementation statement is made, **Then** each cited control has its URN, its nodes and the id of the run, per FR-004.
5. **Given** the starter workload, **When** the rules are made, **Then** a destroy is in `deny`, a mutate in `ask` and a read in `allow`, per FR-005.
6. **Given** the same workload twice, **When** they are projected, **Then** the bytes are the same and no line is built from a node's text, per FR-006.
7. **Given** the Codex dialect, **When** it is rendered, **Then** it holds `AGENTS.md` text and no skill file, per FR-007.
8. **Given** the starter workload and every registered dialect, **When** they are projected, **Then** each dialect gives files and each says the same autonomy for each node, per FR-008.
9. **Given** the starter workload, **When** it is projected as a scenario, **Then** the Given names its requirements, the When its nodes and the Then its checks, per FR-009.
10. **Given** a runbook and a reconcile, **When** they are projected by every dialect, **Then** each says the same autonomy for each node and the index names both forms, per FR-010.

## Out of scope

- Writing the files into a repository or a harness's folder: the tool `tools/pages.ts` makes them for the documentation, and a person puts a skill where a harness reads it.

## Edge cases

- A workload with no control to cite gives an empty statement list, not a statement of nothing, per FR-004.
- A verb used by nodes of different levels takes the strictest level of them, per FR-005.

## Assumptions

- The command a harness runs to call a verb is the one program of the library, `workload verb <id>` (0006-workload-split): a rule names that command and the id, never a shell string of the node.

## Open questions

- None.

## Key entities

- **Skill** - a folder with `SKILL.md` a harness loads.
- **Dialect** - how one kind of operator receives a workload: Claude Code, Codex, a person.
- **Statement** - what an auditor reads of how a control is met.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| Claude Code skills (`https://code.claude.com/docs/en/skills`, read 2026-11-25) | A skill is a directory `<name>/SKILL.md` (project: `.claude/skills/<name>/SKILL.md`); the file opens with YAML frontmatter between `---` lines on its first line; every field is optional and `description` is recommended; `name`, `description`, `disable-model-invocation` and `allowed-tools` are fields; unknown fields are ignored; a `SKILL.md` stays under 500 lines | Sections File layout, Frontmatter format and Field list. The last 21 thousand characters of the page were not read |
| Claude Code settings (`https://code.claude.com/docs/en/settings`, read 2026-11-25) | `permissions` holds `allow`, `ask` and `deny` rules in settings files; a rule names a tool and what it may do, as `Bash(npm run test *)`; the rule syntax page was not read, so the library writes only `Bash(<command> *)` and `Bash(<command>)` | Sections Edit a settings file and Lists merge |
| Codex `AGENTS.md` (`https://learn.chatgpt.com/docs/agent-configuration/agents-md`, read 2026-11-25) | Codex reads `AGENTS.override.md` or `AGENTS.md` in each directory from the project root down, concatenates them, and stops adding files at `project_doc_max_bytes` (32 KiB by default); the page describes no skills format and no per-command rule file | The page. Its links to skills pages were not followed, so no Codex skill format is claimed and none is written |
| NIST OSCAL, implementation layer concept page (`https://pages.nist.gov/OSCAL/learn/concepts/layer/implementation/`, read 2026-11-25) | The implementation layer holds a system security plan model and a component definition model; the statement of how a control is implemented is the content of an SSP | Only the two model names were found; the SSP reference page was not found at the address tried, so the projection is Markdown in the shape of a statement and writes no OSCAL JSON, and no OSCAL field name is claimed |
| W3C PROV-O (`https://www.w3.org/TR/prov-o/`, read 2026-11-25; namespace `http://www.w3.org/ns/prov#`) | A run is an activity (`prov:Activity`), associated with an agent (`prov:wasAssociatedWith`), an agent acts on behalf of another (`prov:actedOnBehalfOf`), an activity used and generated entities (`prov:used`, `prov:wasGeneratedBy`) | Section 4.1, the cross-reference entries. The statement links to the run id and says which of these it is in words; it writes no RDF |

## Success criteria

- **SC-001**: Every requirement of 0004-workload-projections is proved by a test of the library, with synthetic names and no network.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
