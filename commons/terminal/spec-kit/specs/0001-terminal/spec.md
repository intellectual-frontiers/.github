# Feature Specification: Terminal

**Spec ID:** 0001-terminal
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The command line and the console as pure code, in a package of its own that depends on nothing but Core: a command line parsed against options declared once as data, command trees resolved and helped from their declaration, the console's one palette, display width and the cutting of a text by columns, and a small terminal emulator that lets a test take a snapshot of what a person would see. The requirements are those that earlier specifications of commons stated (commons 0001-terminal FR-001 and FR-002) and `commons 0006-signals` (commons 0006-signals FR-022, FR-023 and FR-025) made of the kernel's pure terminal code, moved here with the modules (commons 0032-libraries-by-concern FR-010). What touches the host (the terminal's size, the standard streams, the console that renders OpenTelemetry signals) stays with the libraries that own it.

## The command line

- **FR-001**: Terminal MUST parse an argument vector against options declared once as data (flags, negatable flags, single values, repeatable values, each decoded by a parser or a decoder of Core, with defaults or required), inferring the parsed value's type from the declaration and refusing at compile time a short letter declared twice, a dashed key and the key `help`; take `--name VALUE`, `--name=VALUE`, `-x VALUE` and bundled short flags, end options at `--`, and treat help as a result of its own that wins over every error; refuse, by a typed error that says one sentence with a suggestion for a near name, an undeclared option, a missing, unexpected or attached value, an invalid value, an option given twice, a required option missing and an undeclared argument; and write help text from the same declaration.
- **FR-002**: Terminal MUST give a command tree declared once as data (`commands`): a command of groups and verbs, each with a name (lower case, `[a-z][a-z0-9-]*`), a summary, and for a verb its options (FR-001's declaration) and arguments, to any depth; MUST resolve an argument vector to the verb it names and the arguments left for it, or to the group or verb whose help is asked for (`--help`, `-h`, or a group named with no verb), or to a typed error that says which word was not known at which level, the words that are known there and the nearest of them by FR-001's `suggest`; and MUST render a command's, a group's and a verb's help from that declaration alone, so that help never runs a verb.

## The console

- **FR-003**: The palette MUST be one: colour roles as a union type, and the marks ✅ (done), ❌ (failed), ⏭️ (skipped), ⏹️ (cancelled), 👉 (hint), ⚠️ (warning), ⏳ (pending) and ⚡ (action), each with an ASCII fallback (`[ok]`, `[x]`, `[skip]`, `[stop]`, `->`, `[!]`, `[todo]`, `[you]`) used where the terminal has no emoji; colour MUST be used only where the terminal's capabilities allow it, always reset after, and never for a plain or an empty text.
- **FR-004**: Terminal MUST measure a text by display width (a wide character or emoji counts two columns, a combining mark and an escape sequence none) and cut a text to a number of columns, never inside a grapheme (found with `Intl.Segmenter`) or an escape sequence, and MUST reset the style that is open at the cut.
- **FR-005**: Terminal MUST give a small terminal emulator (carriage return, line feed, backspace, cursor up and down, erase in line and in display, colour sequences kept apart from the text, a screen that grows or one of a given height that scrolls) so that a test can take a snapshot of what a person would see after every frame.

## The package

- **FR-006**: Terminal MUST depend on Core alone, MUST name no host global, and MUST be published as compiled modules with their declarations as `@intellectual-frontiers/terminal` (commons 0032-libraries-by-concern FR-005), with an entry for the package and an entry for each of `args`, `commands`, `guide` (0002-ui), `palette`, `vt` and `width`, so that it runs on Bun, on Node 26 and in a browser.

## Acceptance scenarios

1. **Given** options declared once, **When** a command line with `--jsn` is parsed where `--json` is declared, **Then** it is refused with `did you mean --json?`, per FR-001.
2. **Given** a command tree with the group `work`, **When** `tool wrk build` is resolved, **Then** an error names `wrk` at the top level with `work` as the suggestion, per FR-002.
3. **Given** a terminal with no emoji, **When** a mark is written, **Then** its ASCII fallback is, per FR-003.
4. **Given** a line holding `✅ 测试` and a width of 6, **When** it is cut, **Then** it is cut after `测`, per FR-004.
5. **Given** a live region redrawn with cursor movements, **When** the emulator is fed the bytes, **Then** it shows the text a person would see, per FR-005.
6. **Given** the packed package installed under `node_modules`, **When** Node 26 and Bun import each entry, **Then** both give the same parse, per FR-006.

## Out of scope

- The terminal's size and its standard streams, and the console that renders OpenTelemetry signals (the libraries `system` and `telemetry`), and what each command does (the program that declares it).

## Edge cases

- `--verbose --verbose`: refused as repeated, never silently taken once, per FR-001.
- `tool work build --help`: the verb's help, and its handler never called, per FR-002.
- A text of wide characters at a width of one column: cut to nothing rather than inside a character, per FR-004.

## Assumptions

- ECMAScript 2024 and the web standards (`Intl.Segmenter`) are all that the code needs.

## Open questions

- None.

## Key entities

- **Options declaration** - the data from which the parser, its type and its help are all made.
- **Command tree** - groups and verbs declared once, resolved from an argument vector.
- **Palette** - the colour roles and marks of the console, each mark with its ASCII fallback.

## Success criteria

- **SC-001**: A program declares its command line once and gets its parser, its types, its help and its errors from that.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
