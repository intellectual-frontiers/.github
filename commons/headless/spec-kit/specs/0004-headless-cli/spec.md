# Feature Specification: Headless command line

**Spec ID:** 0004-headless-cli
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** Layer 3 of Headless, the command-line surface: the calm renderer (marks from the one table of icons of the terminal's ui, colour from its one theme, emoji and colour chosen by its capabilities, a spinner and a progress bar on a terminal and plain lines elsewhere), the prompts, the run log and the memory of hints in the program's folder of state, the signals, the help, completions and man page generated from the tree, the run entry `run(program, argv, io)`, and the launcher helpers. It imports the terminal, the system and Core, and the layers below; it does not import the telemetry. Erga's agora (274-agora), arcactl and the fleet programs share this surface. The decisions it takes are in "Decisions" below.

## What a person sees

- **FR-001**: Every mark MUST come from the one table of icons of the terminal's ui (`ICONS` and `lineMarkOf` of `@intellectual-frontiers/terminal/ui`) and from nowhere else: ✅ for what ended well, ❌ for a failure, ⚠️ for a warning, ⏳ for what is pending, ⚡ for what is the person's to do, 👉 for a hint, ⏭️ for what was skipped and ⏹️ for what was stopped, each with its ASCII tag where the capabilities show no emoji (`[ok]`, `[x]`, `[!]`, `[todo]`, `[you]`, `->`, `[skip]`, `[stop]`); a tone MUST map to exactly one icon, and no file of the surface MUST hold an emoji of its own.
- **FR-002**: Colour MUST be written only where the capabilities allow it: a terminal for the stream written to without `NO_COLOR`, `TERM=dumb` or `CI`, or `FORCE_COLOR`, and not with `--no-color`; emoji MUST be used only as 0008-exit-style-consent FR-002 says (an explicit decision of the run, plain unless the stream is a terminal that shows emoji and nothing asks for plain), and the program's own `<PREFIX>_PLAIN` MUST turn them off and `<PREFIX>_EMOJI` on; a line MUST be cut to the terminal's width, never inside a character or an escape sequence. A run in `json` verbosity MUST have no colour.
- **FR-003**: In `calm` a phase MUST be a line when it ends only where it has something to see (its mark, its name, what it did, and how long where that was a second or more): a green step line MUST be shown only with `--verbose`, as must its items; in `verbose` every item MUST be shown, dimmed, as it happens, and the log's path before the verdict; in `quiet` only the verdict MUST be written for narration; a phase's mark MUST be honest: ✅ only where it recorded no failure, no warning, no step for the person and nothing pending.
- **FR-004**: The result of a command (the text of a report, or the one JSON or SARIF document) MUST go to the output stream, and what narrates the run (the phases, the closing block, the questions) MUST go to the error stream, so that a report can be piped and a document is never mixed with prose; `--quiet` governs the narration and never the report. A report with text whose block would be only an unremarkable verdict MUST write no block. Taken from: arcactl (`run(argv, io) -> {code, out, err}`), erga 274-agora FR-020 (failures on standard error).
- **FR-005**: WHILE a phase is in progress on a terminal, the line of the phase MUST be redrawn in place (a spinner, a progress bar of `n/total`, what it is doing now and, from one second, the time elapsed), erased before any line that stays is written; anywhere else (a pipe, a timer, a service) there MUST be only the final lines, with no control character in them. The spinner and the bar MUST be pure functions of a number, with ASCII frames where there is no emoji.

## What a run asks and remembers

- **FR-006**: `ask` and `confirm` MUST write the question to the error stream and read one line; WHERE there is no terminal on both ends, or the run was told never to ask (`--non-interactive`), they MUST ask no one and answer `undefined`, so that the caller falls back on the governance's decision and never waits for input that will not come; `confirm` MUST be `true` only for `y` or `yes`, and an end of input MUST be `undefined`.
- **FR-007**: A run MUST write a log in the program's folder of state, `log/<time>-<process>.log`, of every item and every problem whatever the verbosity, each with its time, and a problem MUST carry the number of its line; before a run opens its log, the logs of the folder last changed more than 30 days ago MUST be removed (`*.log` only, best effort); the newest log MUST be found by its time; and WHERE `<PREFIX>_LOG` names a file, the run MUST write there (a nested run writes to its parent's log).
- **FR-008**: The memory of when each hint was shown MUST be `hints.json` in the folder of state, written only when a hint is shown, and read as nothing where it is missing or not what it should be; WHERE there is no folder of state, every hint MUST be shown, once for each id. In `verbose` every hint MUST be shown whenever it is raised, and in `quiet` none.
- **FR-009**: WHEN SIGINT comes the run MUST end with 130, and with 143 on SIGTERM; it MUST abort the signal given to the command, so that a command that can stop early does, run its cleanup once, end with the stop mark and the word Stopped instead of a failure, and remove its listeners; the signals MUST come through a port.
## What is generated and how it runs

- **FR-010**: The help of every level, the completions for bash, zsh, fish and PowerShell, and the man page MUST be generated from the tree alone: each command and each option of the tree, and those of its effect (`--dry-run`, `--yes`), MUST be in them, and none MUST name a word the parser does not accept; a verb's help MUST say what its action may change, whether it is safe to repeat and who it is for; the man page MUST list the exit statuses of the one table and MUST hold no date; and help MUST never run a command. Taken from: erga 274-agora FR-007 (generated help; help never runs a verb) and the help of the terminal's command trees (the command-tree requirement of the terminal library).
- **FR-011**: `run(program, argv, io)` MUST give `{ code, out, err }` and touch no process global: the environment, what each stream is, the clock, a line of input, the files of the state, the signals, a timer and an observer MUST be given in `io`, so that a run is deterministic; it MUST answer `--version`, `help`, `explain`, `completions` and `man` itself, say `did you mean` for an unknown word as the terminal does (and exit 2), run the program's default command where no word is given, and otherwise run the command it resolves. Taken from: arcactl (`run(argv, io)`), erga 274-agora FR-006 to FR-009 (declared verbs, did-you-mean, default verb).
- **FR-012**: A failure before a command runs (an unknown word, an option that does not fit, `--json` with `--sarif`, `--quiet` with `--verbose`, `--dry-run` with `--check`, a refusal of the governance, a confirmation not given) MUST be one sentence on the error stream and the status 2, in every verbosity; a command that throws MUST end the run as one failure with the message, its raw text and the status 1, never as a crash.
- **FR-013**: A launcher MUST be able to say why the program could not start with a typed failure (`usage`, `unavailable`, `software`, `osfile`, `config`), each with its status of the range 64 to 78 of the one table, written as one line `program: reason` and one `fix:` line where there is a fix, and nothing else; `launch` MUST make the program's check of its start first where it has one (and a check that throws MUST be `software`), and then run the program with the process's own world. Taken from: erga 274-agora FR-020 (typed startup failures, one line each) and the exit statuses of FR-009 of 0002-headless-governance.
- **FR-014**: The folder of state MUST be the system's (`dirsOf`): `$XDG_STATE_HOME/<program>`, else `~/.local/state/<program>`, and `%LOCALAPPDATA%\<program>\state` on Windows; WHERE no home folder can be found there MUST be no folder and no log, never a guess.
- **FR-015**: A run MUST be observable through a port of `Io` (an observer given the run as a function and the events of the run: each phase and each problem), and the adapter `@intellectual-frontiers/headless/otel` MUST report it in OpenTelemetry: a `headless.run` span with the program, its version, the command, the status with its name and the counts, a `headless.phase` event for each phase, a `headless.problem` log record for each problem, the span an error where the status is not 0; WHERE no observer is given nothing MUST change. Taken from: erga 274-agora FR-026 (every command is one trace) and commons 0006-signals.

## How it looks: one icon table, one theme (the owner's requirement for every command line)

- **FR-016**: The capabilities of a terminal MUST be decided once, by `capabilitiesOf(env, { isTTY, columns, rows })` of the terminal's ui, in the host adapter (`hostIo`), for each of the two streams (`Io.caps` for the error stream where the narration goes, `Io.outCaps` for the output stream where a report goes), and passed down as values; WHERE an `Io` has none, `run` MUST decide them from `Io.env` and `Io.terminal` with the same function; the surface MUST never read a process global to dress a line. A pipe, `CI`, `NO_COLOR`, `TERM=dumb` and `TERM=linux` MUST give no escape sequence and no emoji; `--no-color` and `<PREFIX>_PLAIN` MUST lower the level to plain, `--color` (the default) MUST add nothing a terminal does not allow; and `FORCE_COLOR` MUST turn colour on, at the depth it names, even on a pipe.
- **FR-017**: Colour MUST come from the one theme of the ui (`tint` of `accent`, `success`, `warn`, `error`, `dim`, `selection`), dressed at the colour depth of the capabilities (16, 256 or truecolor); the sources of the surface MUST hold no escape sequence of their own, and MUST NOT name a colour; a tone MUST map to exactly one theme name.
- **FR-018**: Each kind of outcome (ok, fail, warn, pending, action, skip, hint, cancelled) MUST be drawn as its icon, a space and its text in its colour; a problem MUST show its message, its code dimmed in brackets, what to say, the one command to run and, in `verbose`, the raw text and the line of the log; a hint MUST show its command; the closing block MUST end with the verdict and the one `next:` line, whose word is in the accent colour and which MUST begin with the hint icon where there are emoji; and WHERE the verdict is a failure and the run had two problems or more, a line of counts (`2 failed, 1 warning, 1 pending, 1 for you`, each in its colour) SHOULD come before the verdict (a verdict that is ok already says its counts). Nothing MUST be decided in drawing: which lines come, and in which order, is `closingOf`'s.
- **FR-019**: A report MAY be drawn as a section header (the title in the accent colour over a rule) and `key: value` rows (the keys dimmed and aligned by their width in columns, the values cut to the width of the terminal) by `sectionHeader` and `keyValues`, which a command reaches through the capabilities of the output stream that `Context.ui` carries (plain where the output is a pipe, and plain in `json`).
- **FR-020**: A list-like outcome MUST be drawn as a table by `renderTable` of the terminal's ui through `tableLines`: a dimmed header, the rows, the widest column cut with `~` where the whole is wider than the terminal; a cell MAY begin with an icon (`toneCell`), and every line of the table MUST have the same width in columns whether the cells hold emoji, colour or neither, so that a table never misaligns at 60, 80 or 100 columns.
- **FR-021**: WHILE a phase is in progress on a terminal, the line MUST be `heartbeatLine`: a spinner (braille where there are emoji, ASCII elsewhere) in the accent colour, the name, the bar and the item in progress, and from one second the time elapsed as the ui's `elapsedOf` writes it, dimmed; the line MUST be cut to the terminal's width less one; WHERE the output is not a terminal it MUST NOT be drawn.
- **FR-022**: The help of the surface (`styleHelp`) MUST dress the generated text by the capabilities: the section words (`Usage:`, `Commands:`, `Options:`, `Arguments:`, `Examples:`, `Effect:`) in the accent colour with an icon of the table before `Examples:` and `Effect:` where there are emoji, the names of the commands and options in the accent colour and their descriptions as they are; WHERE the capabilities are plain, the help MUST be the generated text byte for byte, and no dressing MUST change a column of the text.
- **FR-023**: The renderer (`style.ts`, `render.ts`, `reporter.ts`, `view.ts`) MUST import only the terminal (`ui`, `width`), Core, its own files and the types of the governance and logical layers of Headless, never a domain library or a program's code, and MUST hold no domain decision: it draws what it is given, and the layers table of the library MUST say so (the surface may import of the terminal `args`, `commands`, `ui` and `width`).
- **FR-024**: Every drawing MUST be the same at every width: at 60, 80 and 100 columns no line of a table, a key-value block, a heartbeat or a header MUST be wider than the terminal at each of the three levels (plain, ansi, full), and a text with CRLF line endings MUST be drawn as the same lines as with LF, with no carriage return in the output and the continuation of a message indented under its mark.
- **FR-025**: The machine-readable contracts MUST NOT change with the look: the JSON envelope, the SARIF document and every exit status MUST be byte for byte the same at every level and with any capabilities, and the text a command returns for a person MUST be written as it is.

## Decisions

- **Exit statuses.** The verdicts of a run are 0 ok, 1 findings, 2 usage, 3 environment; `Pending` is its own status, 4, which a run uses only where it is asked to (a check); the startup failures of a launcher are in the range of `sysexits.h` (64 usage, 69 unavailable, 70 software, 72 osfile, 78 config), so that a launcher failure cannot be taken for a verdict; the signals' 130 and 143 stay. A check that exits 3 means the environment is not ready, and pending is 4.
- **Marks.** Only the marks of the ui's one table of icons are used: a deferred change is a pending item, the run's start and end are not marks (a header is a title and the verdict is ✅), and the warning mark is ⚠️. The terminal's palette is no longer used by the surface.
- **Look.** The capabilities of the terminal are one value (`UiCaps`) decided once in the host adapter; the plain ASCII tags are the table's tags (`[ok] [x] [!]`), so a log reads as it always did.
- **Calm and reports.** A report's body is the text it returns, so a report is not verbose by default: narration stays calm, and the body is the whole. The verdict of a run is ✅ (the palette's mark), and no ✅ appears on a step line in calm output: a green step line is for `--verbose`.
- **Streams.** The result goes to the output stream, narration to the error stream (FR-004).
- **State.** Hints and run logs are in the folder `dirsOf(program).state` (FR-014): `~/.local/state/<program>` on Linux and macOS and `%LOCALAPPDATA%\<program>\state` on Windows, with a `log` folder below it.

## Acceptance scenarios

1. **Given** a tone of each kind, **When** it is marked with and without emoji, **Then** it is the palette's mark or its fallback, per FR-001.
2. **Given** `NO_COLOR`, `FORCE_COLOR`, a pipe and `--no-color`, **When** a look is chosen, **Then** colour is where FR-002 says, and a wide line is cut at a grapheme, per FR-002.
3. **Given** a program whose phase warns, **When** it runs in `calm`, `verbose` and `quiet`, **Then** each shows what FR-003 says, and the warned phase has the warning mark, per FR-003.
4. **Given** a report command run with `--json`, **When** it ends, **Then** the output stream holds one document and the error stream nothing, per FR-004.
5. **Given** a terminal and a phase with a progress bar, **When** it runs, **Then** one line is redrawn in place and erased before a line that stays; on a pipe it is not, per FR-005.
6. **Given** no terminal, **When** `confirm` is called, **Then** it answers `undefined`, per FR-006.
7. **Given** a log of 31 days and one of 29, **When** a run opens its log, **Then** the first is removed and the second kept, per FR-007.
8. **Given** a hint shown today, **When** the next run ends within seven days, **Then** it is not shown, per FR-008.
9. **Given** SIGINT during a run, **When** it ends, **Then** its status is 130 and its verdict says Stopped, per FR-009.
10. **Given** a tree, **When** its help, completions and man page are made, **Then** each of its commands and options is in them, per FR-010.
11. **Given** `run(program, ["wrk"], io)`, **When** `work` is a command, **Then** the result is status 2 and `did you mean work?`, per FR-011 and FR-012.
12. **Given** a launcher whose check finds a missing file, **When** it launches, **Then** one line and the status 72, per FR-013.
13. **Given** a launcher with `$XDG_STATE_HOME` set and one with no home, **When** the folder of state is taken, **Then** it is below the variable, and none, per FR-014.
14. **Given** a telemetry with a memory processor, **When** a run is observed, **Then** a `headless.run` span with its attributes, its phase events and its problem logs is recorded, per FR-015.
15. **Given** a failure with a code, a hint and a next command, **When** it is drawn at plain, ansi and full, **Then** the lines are the icon, the text, the dimmed code and the `next:` line, per FR-018.
16. **Given** a table of hosts, **When** it is drawn at 60, 80 and 100 columns at each level, **Then** no line is wider than the terminal and the columns are aligned, per FR-020.
17. **Given** `NO_COLOR`, `CI`, a pipe, `TERM=dumb` or `TERM=linux`, **When** anything is drawn, **Then** it holds no escape sequence and no emoji, per FR-016.
18. **Given** the same run at every level, **When** it is run with `--json`, **Then** the document is the same bytes, per FR-025.
19. **Given** the renderer's files, **When** their imports are read, **Then** only the terminal, Core and the types of the layers are named, per FR-023.

## Out of scope

- A tool server and a REST interface: they are surfaces of their own, beside this one.
- What stays in a program: the explanations of its codes, its guides, its status line, its paths, its secrets panel, its host lock; Headless gives the mechanisms and the program its data.

## Edge cases

- A terminal narrower than 40 columns: the look takes 80, as the system's `lookOf` does, per FR-002.
- A log that cannot be written: the run goes on and loses the line, per FR-007.
- A hint file that is not JSON: read as nothing, per FR-008.
- A command that throws a string: the failure's message is the string, per FR-012.

## Assumptions

- Standard input, output and error are the streams the program writes to; the host binds them in `host.ts` and nowhere else.

## Open questions

- None.

## Key entities

- **Io** - the world a run is given: environment, streams, clock, input, state, signals, timer, observer.
- **Reporter** - what draws a run as it goes.
- **Surface** - one way of reaching the program; this one is the command line.

## Success criteria

- **SC-001**: Two programs with different commands end a run with the same marks, the same block and the same statuses.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
