# Feature Specification: Headless credential prompt

**Spec ID:** 0011-credential-prompt
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The floor of the assurance profiles of issue #11 is that the tooling never stores or sees a passphrase beyond one command: a person types it, and the tools that need it (`ssh`, a signer) get it for that command and no longer. Headless needs a port for that, in the style of `SSH_ASKPASS`: one prompt for each credential for each command, kept only in memory for that command, a hard time limit, a refusal with a typed reason where there is no person to ask, a terminal adapter with a Windows variant behind the same port, and a helper contract so that `ssh` itself asks through the library. No value is ever logged or echoed, and the redaction of a run covers every value it handed out.

## The port and the session

- **FR-001**: A credential MUST be asked for with a `CredentialRequest` (a kind of `passphrase`, `password`, `pin` or `confirm`, an id made only by `parseCredentialId`, and the words shown to the person), and answered with a `Secret`: an object whose text, JSON and inspected forms are `[redacted]` and whose value only `reveal()` gives. The port (`CredentialPort`, a record of functions) MUST be the only way a prompt is drawn, so that a terminal, a helper, a window and a test each give their own.
- **FR-002**: A command MUST ask through one `Credentials` session (`credentialSession`) that asks the port at most once for each credential id: a second ask for the same id MUST give the answer (or the refusal) of the first without asking again, asks for one id at the same time MUST share the one prompt, and prompts for different ids MUST go one at a time. The answers MUST be held in memory only until `close`, which MUST drop every answer and every value and refuse a later ask as `closed`.
- **FR-003**: Where no person can be asked (`interactive` false: no terminal on both ends, or `--non-interactive`) the session MUST refuse as `non-interactive` and MUST NOT call the port; where there is no port it MUST refuse as `unavailable`. Every refusal MUST be a value of a closed union (`non-interactive`, `timeout`, `cancelled`, `unavailable`, `empty`, `too-short`, `closed`) with one sentence (`refusalMessage`) and one stable code (`refusalCode`) that hold no value.
- **FR-004**: A prompt MUST have a hard time limit: the time asked for held to between one second and `MAX_TIMEOUT_MS` (ten minutes), `DEFAULT_TIMEOUT_MS` where none is asked, after which the session MUST refuse as `timeout` and abort the signal the port was given, even where the port does not return; a stopped run (an aborted signal) MUST end the prompt in hand as `cancelled`. An empty answer MUST be `empty`, and an answer to a secret shorter than the redactor replaces (`MIN_SECRET`) MUST be `too-short`.

## What never happens to a value

- **FR-005**: A command MUST be given its session as `Context.credentials`, the session MUST be closed when the command ends whatever way it ends, and the redaction of the run MUST cover every value the session handed out as well as the program's own secrets, so that no outcome, problem, progress line, JSON document or log line of the run carries one.
- **FR-006**: The run log MUST record that a prompt was made and how it ended (asked, given, refused with the reason) and MUST NOT record a value; nothing in this library MUST write a value to a stream, a file or a message, and the adapter MUST NOT echo it.

## The terminal and the helper

- **FR-007**: The terminal adapter (`terminalCredentials` over a `TtyPort`) MUST draw the prompt on the terminal, read the answer with no echo for a secret, and give it as a `Secret`; an input ended by the person (Ctrl-C, Ctrl-D, the end of the stream) and an aborted signal MUST be `cancelled`, and a terminal that cannot be had MUST be `unavailable` with the reason. The reader of the bytes (`readerStep`) MUST be pure: a character adds, backspace takes one away, enter ends the line, Ctrl-C and Ctrl-D end the input. What differs between systems MUST be a row of data (`ttyDevicesOf`: `/dev/tty` and `stty` on Linux and macOS, `CONIN$` and the console's input mode on Windows), not a branch of the adapter.
- **FR-008**: The helper contract of an `SSH_ASKPASS` program MUST be `runAskpass`: the prompt of `ssh` is its one argument, `SSH_ASKPASS_PROMPT` of `confirm` makes the request a `confirm` and of `none` a message that needs no answer; it MUST ask once through a session of the library, write the answer as one line on its standard output and end with status 0, end with status 1 and write only the reason (never a value) on its standard error where there is no answer, and end with status 2 where its arguments are not a request; the kind (`passphrase`, `password`, `pin`) and the id (the key, or the user and host) MUST come from the words of the prompt.
- **FR-009**: `launcherOf(os, runtime, entry)` MUST give the file `ssh` runs as its askpass program: a script with mode 0700 on Linux and macOS, a `.cmd` file on Windows (where `ssh` starts a program and does not run a script), MUST refuse a path that cannot be quoted in it, and `askpassEnv` MUST give `SSH_ASKPASS` and `SSH_ASKPASS_REQUIRE=force`, so that the one prompt of a command is the library's even where `ssh` has a terminal of its own. Nothing is cached between processes: each run of the helper is one command.

## Acceptance scenarios

1. **Given** a command that asks twice for one credential, **When** it runs with a port that counts, **Then** the port was asked once, per FR-002.
2. **Given** a run with no terminal, **When** a command asks, **Then** it is `non-interactive` and the port is not called, per FR-003.
3. **Given** a port that never answers, **When** the limit passes, **Then** the ask is `timeout` and the port's signal is aborted, per FR-004.
4. **Given** a command that writes the passphrase into its own message, **When** the run ends, **Then** neither the output, the JSON nor the log holds it, per FR-005 and FR-006.
5. **Given** `ssh`'s prompt `Enter passphrase for key '/k':`, **When** the helper runs against a port that answers, **Then** its standard output is the answer and one line, per FR-008.
6. **Given** Windows, **When** the launcher is made, **Then** it is a `.cmd` file that runs the runtime on the entry with the arguments, per FR-009.

## Out of scope

- Reading the controlling terminal when the standard input is not a terminal (`/dev/tty`, `CONIN$`): it needs a read of a file with no position, which the system's `FsFile` does not have; Planned. Until then the system terminal is the standard input where it is a terminal, and the helper is run by `ssh` with the standard input inherited.
- Where a key is kept and how a token or an agent is used: the program's (`signing`, `secrets`).

## Edge cases

- A `confirm` is asked once like a secret and is not handed to the redactor, per FR-002 and FR-005.
- Two commands (two processes) each ask: nothing is shared between them, per FR-009.
- A port that throws: the ask is `unavailable`, with the name of the error and never its message, per FR-003.

## Assumptions

- A passphrase of an SSH key is five characters or more, so the redactor's minimum does not refuse a real one.

## Open questions

- None.

## Key entities

- **Secret** - a value that is never written.
- **Credentials** - the session of one command.
- **Askpass helper** - the program `ssh` runs to ask, over the same port.

## Success criteria

- **SC-001**: A command signs or connects with a passphrase a person typed once, and nothing of it is in a file, a log or a message afterwards.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
