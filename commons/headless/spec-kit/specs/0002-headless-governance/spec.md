# Feature Specification: Headless governance

**Spec ID:** 0002-headless-governance
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** Layer 1 of Headless: what a headless action is, before any surface draws it. Its identity, who it is for, what it may do to the world (read, change, destroy), whether repeating it is safe, whether it can preview itself, which of its options only a person may give; the one decision a surface takes from those facts (proceed, preview, ask, refuse); the problems a run finds, with their levels and stable codes; the one table of exit statuses; and the redaction of secrets. It imports Core alone and names no surface, no terminal and no host. Every program of Intellectual Frontiers (erga's agora, arcactl and the fleet programs) takes these from this layer.

## The action

- **FR-001**: Every action MUST declare its facts as data: an id (lower-case words joined by spaces), a summary, its kind (`report` or `action`), its effect (`read`, `mutate` or `destructive`), whether it is idempotent, its audience (`human`, `machine` or `both`), whether it supports `--dry-run` and `--check`, and the options only a person may give; `defineAction` MUST give the defaults of its kind (a report reads, is idempotent and has no preview; an action mutates and is not assumed idempotent), and `actionProblems` MUST return every contradiction among the facts as a typed value.
- **FR-002**: A report MUST only read: an action declared a report with an effect other than `read` MUST be a contradiction (`action/report-changes`), and an action that only reads MUST be declared a report (`action/action-reads`).
- **FR-003**: An action whose effect is `destructive` MUST be able to preview itself with `--dry-run` (`action/destructive-no-preview`) and MUST NOT be called idempotent (`action/idempotent-destructive`); an action with `check` MUST change something to check for (`action/check-on-read`). Taken from: erga 274-agora FR-082 (`ensure ... --dry-run`) and erga 274-agora FR-053 (a second publish changes no file), generalized.
- **FR-004**: WHEN a destructive action is run for real, the decision MUST be: the person is asked where the surface can ask; the flag of the invocation (`--yes`) stands for the answer where the surface lets a flag stand for it; and the run is refused (`confirmation-needed`, or `confirmation-not-accepted` where the surface does not take a flag) where there is neither. WHEN the invocation asks for a preview (`--dry-run` or `--check`), the decision MUST be `preview`, never asking and never changing. An action that only reads or can be undone MUST proceed without a question.
- **FR-005**: IF a surface is for a machine (a tool server, a REST interface) and the action is for a person, or an option only a person may give was given, THEN the decision MUST be a refusal (`human-only-action`, `human-only-option`) before anything runs, so that a program cannot give the answers only a person may give.
- **FR-006**: An action MUST say whether repeating it with the same input is safe, and its help MUST say so; a run of an idempotent action MUST be one that finds nothing more to change the second time. Taken from: erga 274-agora FR-053 and erga 274-agora FR-061.
- **FR-007**: A run's mode MUST be one of `apply`, `dry-run` and `check`; the flags `--dry-run` and `--check` given together MUST be refused as asking for different things, and only `apply` MAY change anything (`mayChange`).

## What a run finds

- **FR-008**: A problem MUST have one of four levels: `fail`, `warn`, `pending` (something not set up yet that waits on time or on someone else) and `action` (a step that is the person's to take); `pending` and `action` MUST NOT be failures, and MUST NOT be counted as warnings. A problem MAY carry a message, the phase it happened in, one fix, the raw text of a system error, its line in the log, and a stable code: `E` for a problem and `P` for what is pending, then upper-case words joined by dashes (`E105-DISK`, `P000-WAITING`); a program MAY give the code a problem carries where its raiser gave none, one for each level, and Headless MUST give one where the program gives none.
- **FR-009**: Every program MUST end with a status of one table: 0 `ok`, 1 `findings`, 2 `usage`, 3 `environment`, 4 `pending`; the statuses of the range of `sysexits.h` for a program that could not start (64 `startup-usage`, 69 `startup-unavailable`, 70 `startup-software`, 72 `startup-osfile`, 78 `startup-config`); and the statuses of signals (130 for SIGINT, 143 for SIGTERM). Every status MUST have one name, every name one status and one meaning, and a status outside the table MUST have no name.
- **FR-010**: The status of a run MUST be `findings` where anything failed, else `pending` only where the run is asked to treat what is pending as its own status (a check), else `ok`; a warning and a step for the person MUST never change the status.

## Secrets

- **FR-011**: A redactor MUST replace, with `***`, the password of every URL, a `password=` assignment, the tokens of a known shape, the value of a key the program declares secret (`KEY=value`; a sentence that only names a variable is prose and MUST NOT be replaced: 0008-exit-style-consent FR-003), and every secret value it was given of four characters or more, longest first, wherever it stands in the text; text with none of these MUST be unchanged, and redacting twice MUST be redacting once. Taken from: arcactl 0046-arcactl FR-009 (`redact`) and commons 0006-signals FR-006 (a secret attribute is never written).

## Acceptance scenarios

1. **Given** an action declared a report with the effect `mutate`, **When** its facts are checked, **Then** `action/report-changes` is found, per FR-002.
2. **Given** a destructive action with no preview, **When** its facts are checked, **Then** `action/destructive-no-preview` is found, per FR-003.
3. **Given** a destructive action run with no terminal and no `--yes`, **When** the decision is taken, **Then** it is `confirmation-needed`, per FR-004.
4. **Given** the same action run with `--yes` on the command line, **When** the decision is taken, **Then** it proceeds; on a machine surface it is `confirmation-not-accepted`, per FR-004.
5. **Given** a machine surface and an option only a person may give, **When** the decision is taken, **Then** it is `human-only-option`, per FR-005.
6. **Given** a run with one warning and two pending items, **When** its status is taken, **Then** it is 0, and 4 where a check asks for it, per FR-010.
7. **Given** a message with a URL holding a password and a given token, **When** it is redacted, **Then** neither is in it, per FR-011.

## Out of scope

- What an action does, how it is drawn, and where its confirmation is asked (the surface).
- The meaning of a program's own codes: the catalogue is the program's (0003-headless-output).

## Edge cases

- `--dry-run --check` together: refused, never one of them silently taken, per FR-007.
- A secret of three characters: not replaced everywhere, for it would mask ordinary words; the password of a URL is, whatever its length, per FR-011.
- A code with a lower-case letter, or one that begins with another letter: not a stable code, per FR-008.

## Assumptions

- An action's facts are known where it is declared; nothing here reads the host.

## Open questions

- None.

## Key entities

- **Action** - the facts of a command: its kind, effect, audience, idempotency, preview and human-only options.
- **Decision** - proceed, preview, ask or refuse, from an action, a surface and an invocation.
- **Problem** - a finding of a run, with a level, a stable code and one fix.
- **Exit table** - the one list of statuses every headless program uses.

## Success criteria

- **SC-001**: The same action is decided the same way by every surface, and a status means the same in every program.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
