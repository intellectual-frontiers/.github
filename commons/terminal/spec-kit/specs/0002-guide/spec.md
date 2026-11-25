# Feature Specification: Guide

**Spec ID:** 0002-guide
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** A program that takes a person through a task one typed step at a time (a deterministic state machine emits the step, the program carries it out) must be equally good headless as JSON, as a command line, as an MCP tool and interactively. The first three are data; this specification is the fourth, and the one rendering layer of the others when they are read by a person: a typed step (`GuideStep`), a decoder that refuses what is not one, the capabilities of the terminal decided in one place, the step rendered as plain text, ANSI text or a full screen, and a driver that loops (next, render, ask, run, wait, done) and never answers for the person. It is generic: it names no product, and what a step does is the caller's.

## The step

- **FR-001**: Guide MUST give a typed `GuideStep` of five kinds, `question`, `run`, `human`, `wait` and `done`, each with an `id`, a `summary` and a `say` text, and optionally `evidence` (a list of references that back the step); a `question` MUST have a non-empty `ask` list of fields (`field`, `prompt`, `hint`, and `secret` where it is true), a `run` MUST have a `verb` (`id` and `inputs`), a `human` MUST have a `gate` (`who` is `person`) and MAY have an `ask` list, and `wait` and `done` MUST have none of the three. The decoder `decodeStep` MUST return a `Result` whose error is a `DecodeError` of Core, MUST refuse a field that is not declared for the kind (never drop it silently), an unknown kind, a missing required field and a field of the wrong type.

## The terminal

- **FR-002**: Guide MUST decide what the terminal can do in one function, `capabilitiesOf(env, stream)`, with three levels: `plain` (no colour, no cursor movement, no emoji) where the stream is not a TTY, `NO_COLOR` is set and not empty, `TERM` is `dumb`, or `CI` is set to anything but empty, `0` or `false`; `ansi` (colour and simple symbols, no cursor control beyond a carriage return and the erase of a line) where the stream is a TTY and none of that holds; and `full` (the alternate screen and cursor control) where it is `ansi` and the stream is at least 60 columns by 12 rows. The decision MUST be made from the stream's `isTTY`, never from the name of the operating system, so that a Windows 11 terminal that is a TTY gets the same levels as any other; a caller MAY force a lower level and never a higher one.

## Rendering

- **FR-003**: `renderStep(step, caps)` MUST return the lines of a step as text for each of the three levels: the kind's mark and the summary, the `say` text wrapped by display width (FR-004 of 0001-terminal) to the capabilities' columns without cutting a character or an escape sequence, the verb with its inputs for a `run`, the fields with their prompts and hints for a `question` or a `human`, the evidence, and for a `human` exactly what the person is to do; the guide MUST remove every escape sequence and control character from the text it is given before showing it, the `plain` level MUST hold no escape sequence and only Basic Latin furniture of its own, the other levels MUST hold no escape sequence other than colour, and every line MUST fit the columns.

## The driver

- **FR-004**: `runGuide` MUST loop: ask for the next step, decode it (an invalid step ends the guide with a typed error), render it, and by its kind: for a `question`, prompt each field with its prompt and hint, check the answer with the caller's validator and ask again on a refusal (to a limit), then pass the answers to the caller's `run`; for a `run`, show the verb about to run, ask the caller's `confirm` where there is one, execute through the caller's `run` and show its result; for a `wait`, poll `next` again with backoff and a visible spinner (in `plain`, a line every few seconds), until a step that is not a `wait` or a time limit; for a `done`, show the summary and end with status 0. It MUST name no host: the input, the output, the clock and the signal are the caller's.
- **FR-005**: The driver MUST NEVER confirm for the person. For a `human` step it MUST print exactly what the person must do and wait for the person to press Enter or to type the value asked for, and where the input is not interactive (not a TTY) it MUST end with the typed error `E-GUIDE-NEEDS-PERSON`, which carries the step, and never wait; the same error ends a `question` whose input ended before every field was answered. Lines of input MUST end with `\n`, `\r\n` or `\r`.
- **FR-006**: The guide MUST never ask for a token or a password: a step with a field marked `secret: true` MUST end the guide with the typed error `E-GUIDE-SECRET-FIELD`, which carries the step and the field, before anything is asked, and the driver has no way to read input without echo.
- **FR-007**: On the abort of the caller's signal, or the input `Ctrl+C` where the terminal passes it as a character, the driver MUST leave the terminal as it found it (cursor shown, alternate screen left, styles reset), stop within one step and end with the typed error `E-GUIDE-ABORTED`, whose status is 130; the terminal MUST also be restored where the loop ends in any other way, or throws.

## The full screen

- **FR-008**: In `full`, the driver MUST draw a stable layout drawn with plain ANSI cursor addressing (which the emulator `vt` of this library reads, so that a test sees what a person would): a left column of every step of the caller's optional `plan` (marked `[x]` done, `[>]` current, `[ ]` pending and `[!]` failed, FR-011), a right pane with the current step and what came of it (and nothing of the steps before it, FR-014), a status line and the keys that do something, every row exactly the width of the screen and none written with a line feed, so that the screen never scrolls; it MUST redraw on a resize, and fall back to `ansi` where the terminal is under 60 columns or 12 rows, and return to `full` where it grows again.

## The package

- **FR-009**: The entry `@intellectual-frontiers/terminal/guide` (in single distribution, `@intellectual-frontiers/commons/terminal/guide`) MUST be a dependency-free module (Core, and the `palette` and `width` of this library, alone; the emulator `vt` is the test's), name no host global of a runtime (the stream, the environment, the clock and the signal are parameters, the clock's default is the web standard timer), and run unchanged on Bun and on Node 26.

## Progress, wrapping and the small screen

- **FR-010**: Wrapping by display width MUST keep a token (a run of characters with no space: an order id, a path, a digest) whole wherever it can go whole: a token that does not fit in what the indent leaves of the line but fits the width MUST go to its own line with as much indent as the width allows, never cut; only a token wider than the width itself, and a character wider than the line, are cut between graphemes (so that a UUID is never broken in the middle of its digits at 60 columns).
- **FR-011**: The count in the title of the full screen MUST be the 1-based position of the current step in the caller's `plan`, never less than it was (it does not fall when a step is asked again or when the current step is done), and `step 1 of N` where the current step is the first; where the current step is not in the plan the count stays as it was. The marks of the left column MUST be `[x]` for a step done, `[>]` for the current one, `[ ]` for one pending and `[!]` for one that failed (a verb that failed, an answer given up, a wait that timed out). A step is done when its verb ran and succeeded, when the person acknowledged or answered it and the caller's `run` succeeded, when a wait ended, and at the end; `GuideOptions.done` (a list of plan ids) MUST tick the steps done before the process began, so that a flow resumed in a new process shows its earlier steps ticked from the first frame; an id that is not in the plan is ignored and the current step is never ticked until it is done. A plan taller than the body of the screen MUST scroll so that the current step stays in view.
- **FR-012**: The status line of the full screen MUST say whose turn it is in words a person acts on: `your turn: type FIELD and press Enter` where a value is asked, `press Enter to continue` at a `human` step that asks for nothing, `your turn: confirm to run VERB` where the caller's `confirm` is asked, `working...` while the caller's `run` works (with the verb where there is one), the summary and a spinner at a `wait`, and `done` at the end; the keys line MUST name only keys that do something now.
- **FR-013**: Where the right pane is taller than the body of the screen (a 24-row terminal), the driver MUST keep the summary lines of the current step pinned at the top of the pane and the prompt and what was typed at the bottom, clip the details between them from their end, and show a line that begins `(more` where lines are hidden, so that the summary never scrolls off and the person knows there is more; the whole is in the transcript that is printed when the screen is left (FR-015).
- **FR-014**: The same step asked for again (the caller's state did not change, so `next` gave an identical step after the person pressed Enter or after a refusal) MUST NOT be shown a second time: the step block is kept once, what was asked and typed of it before is dropped and asked afresh, what came of it (a result, a failure) stays, and it is not counted as a new step. The pane of the full screen MUST show only the current step and what came of it; every earlier step is in the transcript.
- **FR-015**: Where the guide ends (done, failed or aborted) from the full screen, the driver MUST leave the alternate screen and then write ONE transcript of the whole run on the screen the person keeps (each step once, what was answered, each result and the failure once, without the frames), and every typed error it returns MUST carry `reported: true`, meaning that it has been shown, so that the caller prints nothing more about it, only its status. A failure MUST be shown once: a detail line that only says the summary again is not shown.

## Acceptance scenarios

1. **Given** a step with a field `colour` that the decoder does not know, **When** it is decoded, **Then** it is refused with the path of the field, per FR-001.
2. **Given** `NO_COLOR=1` on a TTY, `TERM=dumb`, `CI=true` or a stream that is not a TTY, **When** the capabilities are decided, **Then** the level is `plain`, per FR-002.
3. **Given** a `run` step and each of the three levels, **When** it is rendered at 40 columns, **Then** no line is wider than 40 and `plain` holds no escape sequence, per FR-003.
4. **Given** a `question` whose first answer the validator refuses, **When** the guide runs, **Then** the field is asked again with the reason, per FR-004.
5. **Given** a `human` step and input that is not a TTY, **When** the guide runs, **Then** it ends with `E-GUIDE-NEEDS-PERSON` and the step, without reading a line, per FR-005.
6. **Given** a field marked `secret: true`, **When** the guide runs, **Then** nothing is asked and it ends with `E-GUIDE-SECRET-FIELD`, per FR-006.
7. **Given** a guide in `full` and an aborted signal, **When** the driver stops, **Then** the alternate screen is left after it was entered, the cursor is shown, the person keeps a transcript on the normal screen, and the status is 130, per FR-007.
8. **Given** a plan of four steps and the second current, **When** the screen is drawn on the emulator of `vt` at 80 by 24, **Then** the left column shows one done, one current and two pending, and the screen has 24 rows, per FR-008.
9. **Given** a script that runs the guide, **When** Bun and Node 26 run it with piped input of `\r\n` lines, **Then** both write the same plain text and end with the same status, per FR-009.

10. **Given** an order id of 36 characters and a pane of 41 columns, **When** a step with it as evidence is rendered, **Then** the id is on one line, whole, per FR-010; and a token of 50 characters at 40 columns is cut, per FR-010.
11. **Given** a plan of 18 steps, `done` of the first 14 and the 15th step current, **When** the screen is drawn on `vt`, **Then** the title says `step 15 of 18`, 14 marks are `[x]`, one is `[>]`, and after the step is asked again the title says `step 15 of 18`, per FR-011; and a verb that failed shows `[!]`.
12. **Given** a question, a human step that asks nothing, a confirmation and a verb at work in the full screen, **When** each is waiting, **Then** the status line says what FR-012 says for it.
13. **Given** a 24-row screen and a step with forty lines of evidence, **When** it is drawn, **Then** the summary is the first line of the pane, the prompt is the last, and a `(more` line is between them, per FR-013.
14. **Given** a `human` step that the caller gives again after Enter, **When** the guide runs in `plain` and in `full`, **Then** its block is shown once, per FR-014.
15. **Given** a verb that fails in the full screen, **When** the guide ends, **Then** the screen is left, one transcript follows with the failure once, and the error has `reported: true`, per FR-015.

## Out of scope

- What a step does, the state machine that emits steps and the program that declares the verbs (the caller's); the reading of a secret, which the guide refuses by design; the terminal's raw mode and the wiring of the process's signals (the caller gives the driver a signal and a stream).

## Edge cases

- A wide character at the edge of a wrapped line goes to the next line, never cut (FR-003).
- A `\r` at the end of one chunk of input and a `\n` at the start of the next are one line end (FR-005).
- The terminal shrinks under 60 columns during a `wait`: the driver leaves the alternate screen and goes on in `ansi` (FR-008).
- `Ctrl+C` while a verb runs: the verb is the caller's, the guide stops after it returns and restores the terminal (FR-007).

## Assumptions

- A TTY is a terminal that understands ANSI sequences: the Node and Bun streams of Windows 10 and later, Windows Terminal and PowerShell 7 included, enable them on a TTY. Where a console does not, `TERM=dumb` or `NO_COLOR` or a forced level gives `plain`.
- The caller has the raw mode of the terminal off: a line is read as the terminal edits it, and `Ctrl+C` comes as the interrupt the caller wires to the signal.

## Alternatives considered

- **OpenTUI** (a terminal interface library with a native core) was considered and not adopted: it brings a native binary (a Zig build) into a package that is otherwise only modules that run unchanged on Bun, Node and in a browser; it is a third-party runtime dependency of a kind that our supply-chain rules (exact pins, reviewed lockfiles, no install scripts) cannot hold the same way as a module we read; its support of Windows is a risk we would carry for an interface that has to work on a person's own machine; and we would not own the code of the one layer through which every person meets the product. The guide is a small module on the owned `palette` and `width`, proved on the owned emulator `vt`, with no dependency, and is enough for a stream of typed steps.

## Open questions

- None.

## Key entities

- **GuideStep** - one typed step of a guided flow: a question, a run, a human gate, a wait or the end.
- **Capabilities** - the level (`plain`, `ansi`, `full`), colour, emoji and size of the terminal, decided once.
- **Guide driver** - the loop that shows the steps and carries them out through the caller's functions, and never answers for the person.

## Success criteria

- **SC-001**: One state machine's steps are shown the same in a pipe, a CI log, a terminal and a full screen, and no step is ever confirmed, answered or skipped by the program on a person's behalf.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
