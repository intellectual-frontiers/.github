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

- **FR-008**: In `full`, the driver MUST draw a stable layout drawn with plain ANSI cursor addressing (which the emulator `vt` of this library reads, so that a test sees what a person would): a left column of every step of the caller's optional `plan` (done, current and pending), a right pane with the current step and what came of it, a status line and the keys that do something, every row exactly the width of the screen and none written with a line feed, so that the screen never scrolls; it MUST redraw on a resize, and fall back to `ansi` where the terminal is under 60 columns or 12 rows, and return to `full` where it grows again.

## The package

- **FR-009**: The entry `@intellectual-frontiers/terminal/guide` (in single distribution, `@intellectual-frontiers/commons/terminal/guide`) MUST be a dependency-free module (Core, and the `palette` and `width` of this library, alone; the emulator `vt` is the test's), name no host global of a runtime (the stream, the environment, the clock and the signal are parameters, the clock's default is the web standard timer), and run unchanged on Bun and on Node 26.

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
