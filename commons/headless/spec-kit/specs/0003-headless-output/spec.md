# Feature Specification: Headless output

**Spec ID:** 0003-headless-output
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** Layer 2 of Headless: what a command is and what it returns, whatever surface draws it. A command is a verb of the terminal's declaration with the facts of its action and a function that returns a typed outcome and prints nothing. The outcome is told as a closing block (the order of its lines, its verdict, its one next command), as one JSON document, or as SARIF; `explain` and `translate` give the problems stable explanations; a hint is shown once in seven days; a run inside a run hands its findings to its parent; and every text is redacted before any surface sees it. It imports Core, the governance layer and the terminal's `args` and `commands`; it draws nothing, so it holds no mark, no colour and no host. The behaviour is that of stolos's calm output (105-calm-output, 052-self-describing, 019-output), generalized so that erga's agora, ergonex and arcactl use it as it is.

## The command

- **FR-001**: A command MUST be one value: a verb of the terminal's declaration (its name, summary, options and operands, declared once), the traits of its action, and a function that takes its parsed arguments and a context and returns an outcome; a program MUST be a tree of branches and commands, and `modelProblems` MUST return every defect of the tree as a typed value: what the terminal finds in its names, what the governance finds in each action's facts, an option named like one of the model's standard options (`model/reserved-option`) or whose short letter is taken by one (`model/reserved-short`), a human-only option the command does not declare (`model/human-only-unknown`), and a command named like a word the surface answers itself (`model/built-in-word`). Taken from: erga 274-agora FR-006, erga 274-agora FR-035 (a domain is one typed value; the words resolved by the command tree) and ergonex's `Report`-returning commands.
- **FR-002**: A command MUST return a typed outcome and MUST NOT print: the outcome holds the data, the text of a report, the problems found in the order found, the lines the run wants seen, the hints, the steps spelled out, the findings for SARIF, a title for the verdict, and whether the run was stopped; merging two outcomes MUST keep the first's data and text, put the problems, lines, steps and findings of the first before those of the second, and show a hint once. Taken from: ergonex (`Report{text,data,findings}`) and stolos 105-calm-output FR-005 (`RunSummary`).
- **FR-003**: A run MUST be in one of four verbosities: `calm` (the default: quiet on success, loud and actionable on a problem), `verbose` (every item as it happens), `quiet` (the verdict alone) and `json` (nothing for a person but one document); `--json` MUST win over every other choice, `--quiet` with `--verbose` MUST be refused as opposite, and a table MUST say which kind of line each verbosity shows (`calm` shows no item, no line for a phase that went well and no log line; `quiet` only the verdict; `verbose` all; `json` none). Taken from: stolos 105-calm-output FR-002 and FR-003, 019-output FR-003.
- **FR-004**: The closing block MUST be data (`closingOf`) in this order: the problems (the first failure is the verdict, so it is not listed twice; then the other failures, then the warnings), what is the person's to do, what is pending, the hints that are due, the steps the command spelled out; then the verdict; then ONE next command. A failure MUST be shown once, with its code. The verdict where nothing failed MUST say the title, then the counts of warnings, of what is for the person, of what is pending and of the optional features, in that order; the next command MUST be the failure's own, else the first step for the person, else the one the command suggested, and a failure whose fix holds no command MUST have none. Taken from: stolos 105-calm-output FR-004 (honest marks), FR-005 (one run, one summary), FR-006 (the order of the closing block), FR-007 (a failure is printed once).
- **FR-005**: A fix text MUST be split into the one command in it and the words around it, so that a `fix:`, `run:` or `next:` line holds only the command; the programs whose commands may begin a fix, and the program's own commands that may stand inside a sentence, MUST be the program's to give. Taken from: stolos 105-calm-output FR-011 (`splitFix`).

## What is told

- **FR-006**: A run in `json` verbosity MUST end with ONE JSON document and nothing else for a person: the schema (`headless.envelope/1`), the program, its version, the command as typed, whether nothing failed, the status with its name, the counts of each level, the problems, the lines, the hints, the steps and the data, in that order of keys; it MUST hold no colour, no mark and no width, and a value JSON cannot say (`undefined`, a `bigint`, a `Date`, a number that is not finite) MUST be made one it can, never thrown on. Taken from: erga 274-agora (`--json` is one document), ergonex (`--json`) and stolos 019-output FR-003.
- **FR-007**: A report asked for as SARIF MUST be a SARIF 2.1.0 log of the findings it returned, or, where it returned none, of its failures and warnings (the code of a problem its rule), each with its level, its message and its file and line where it has them. Taken from: ergonex (`--sarif`).
- **FR-008**: A problem shown with a code MUST be explainable by that code: a catalogue (the program's own data) maps a code to a title, what happened, the likely cause, the fix and, where it has one, a guide; `explainText` MUST give one explanation for a code written in either case, the list of every code where no code is given, and for a code that is not there say so and name the nearest. WHEN a raw error of another tool matches a pattern of the program, `translate` MUST give its code and fix, the first pattern that matches winning, and a raw error that matches none MUST be shown as it is. A catalogue MUST be checked: every key a stable code, no field blank, every pattern naming a code the catalogue explains. Taken from: stolos 052-self-describing FR-004 and FR-005, 105-calm-output FR-009 and stolos 052-self-describing FR-013.
- **FR-009**: A hint (an optional feature that is merely off) MUST be due when it was never shown or was shown seven days ago or more, each hint at most once in a run, and the memory of when each was shown MUST be the one given with the due hints set to the time now, and the same where none is due. Taken from: stolos 105-calm-output FR-008.
- **FR-010**: A run nested in another MUST NOT draw a header, a phase or a closing block: it MUST hand what it found to its parent as a summary (the counts, every problem in order, the lines), read back by a decoder and never trusted, and the parent MUST merge it so that every problem appears once. The names of the variables that say a run is nested and where the summary goes MUST come from the program's prefix. Taken from: stolos 105-calm-output FR-005 (`STOLOS_NESTED`, `STOLOS_SUMMARY`).
- **FR-011**: Before anything is drawn, logged or returned, every text of an outcome (every message, fix, raw error, line, step, hint and finding, the report's text, and every string of its data however deep) and of what a command tells while it runs MUST pass through the program's redactor; redacting an outcome twice MUST be redacting it once. Taken from: arcactl 0046-arcactl FR-009 and stolos's secrets reminder (105-calm-output FR-017).
- **FR-012**: Every command MUST take the options of the model by its effect, and no program MAY redeclare them: `--json`, `--quiet` (`-q`), `--verbose` (`-v`), `--color` and `--no-color`, `--non-interactive`; `--sarif` for a report; `--dry-run` where the action can preview; `--check` where it can check; `--yes` (`-y`) where it destroys. Taken from: ergonex (`--json`, `--sarif`, `--no-color`), arcactl (`--non-interactive`) and stolos 105-calm-output FR-002 (`--verbose`, `--quiet`).

## Acceptance scenarios

1. **Given** a tree with a duplicate word, an option named `json` and a destructive action with no preview, **When** `modelProblems` runs, **Then** each is found, per FR-001.
2. **Given** two outcomes with a hint of the same id, **When** they are merged, **Then** the hint is shown once, per FR-002.
3. **Given** `--json --quiet`, **When** the verbosity is chosen, **Then** it is `json`; given `--quiet --verbose`, **Then** it is refused, per FR-003.
4. **Given** an outcome with two failures, a warning, a step for the person and a pending item, **When** its closing block is made, **Then** the lines are in the order of FR-004, the first failure is the verdict, and there is one next command, per FR-004.
5. **Given** the fix `mytool sync (pull first)`, **When** it is split, **Then** the command is `mytool sync` and the instruction is `Pull first`, per FR-005.
6. **Given** an outcome with a `bigint` in its data, **When** its envelope is written, **Then** it is one parseable document with no other output, per FR-006.
7. **Given** a raw `Could not resolve host`, **When** it is translated by a catalogue that has the pattern, **Then** its code and fix are given, per FR-008.
8. **Given** a hint shown six days ago, **When** the due hints are taken, **Then** it is not due; seven days ago, it is, per FR-009.
9. **Given** a child that wrote its summary, **When** the parent merges it, **Then** each problem is in the parent's block once, per FR-010.
10. **Given** a secret token in a message, a fix and the data, **When** the outcome is redacted, **Then** it is in none of them, per FR-011.

## Out of scope

- Marks, colours, widths, the spinner, prompts and the files of the run log: the surface (0004-headless-cli).
- The catalogue of a program's explanations, its guides, the commands of its fixes, and the secrets panel: the program's own data and code, given to these mechanisms.

## Edge cases

- A failure whose fix is only a sentence: the sentence is shown, and there is no next command, per FR-004.
- An outcome with no problem, no hint and no step: the verdict alone, per FR-004.
- A hint of the same id raised twice in a run: shown once, per FR-009.
- A summary file that is not what a summary is: refused with why, never trusted, per FR-010.

## Assumptions

- A command's data can be told as JSON once `toJson` has made it so.

## Open questions

- None.

## Key entities

- **Command** - a verb, the traits of its action, and what it does.
- **Outcome** - what a command returns: data, text, problems, lines, hints, steps, findings.
- **Closing block** - the lines, the verdict and the one next command of a run, as data.
- **Envelope** - the one JSON document of a run.

## Success criteria

- **SC-001**: Every program that uses this layer ends a run with the same block, the same document and the same explanations.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
