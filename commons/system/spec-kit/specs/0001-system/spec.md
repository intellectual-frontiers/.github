# Feature Specification: System

**Spec ID:** 0001-system
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The host as one typed library, in a package of its own that depends on nothing but Core, Formats and Crypto: files and paths, the folders a program keeps its files in, processes and the programs they run, Git, a program built into one binary, one run at a time, file watching, scheduled jobs and the terminal's streams, the same on Bun and on Node 26 and on Windows, macOS and Linux. It was the runtime's files, process, path, lock, watch, discover, git, compile, schedule, tty and stdio modules and the kernel's job planning, and it keeps the requirements that commons 0005, 0007 and 0031 made of them.

## Files, paths and errors

- **FR-001**: System MUST throw typed errors for what the host refuses (`NotFound`, `AlreadyExists`, `PermissionDenied`, `IsADirectory`, `NotADirectory`, `DirectoryNotEmpty`, `AddrInUse`, `ConnectionRefused`, `BrokenPipe`, `TimedOut`, `NotSupported`, `InvalidData` and the like), each a subclass of `RuntimeError` made from the host's error code, keeping the code, the path or address and the original error as its `cause`. A function whose failure is an expected outcome of what it is for (a download, a parse) MUST return a `Result` instead.
- **FR-002**: `fs` MUST give the file calls under short plain names and shapes (`readTextFile`, `writeTextFile` with `append`, `create`, `createNew` and `mode`, `readFile`, `writeFile`, `remove` with `recursive`, `mkdir`, `stat`, `lstat`, `readDir`, `makeTempDir`, `makeTempFile`, `rename`, `copyFile`, `chmod`, `symlink`, `readLink`, `realPath`, `truncate`, `utime`, and the synchronous forms in use), accept a path as a string or a `file:` URL, and give the helpers the harnesses wrote over them (`exists`, `readTextOr`, `ensureDir`, `writeIfChanged` in one step, `listDirs`, `listFiles`, `walkFiles`, `sha256File`, `withTempDir`).
- **FR-003**: `path` MUST give the platform's path rules from `node:path`, both platforms' rules (`posix`, `win32`), `file:` URLs both ways and a path with `/` between its segments.
- **FR-004**: `fs.readDir` MUST list a folder asynchronously (an async iterable of entries, usable with `Array.fromAsync`), and `fs` MUST give `chown` and `symlinkSync`.
- **FR-005**: `fs.open` (and `openSync`) MUST give a file handle (`read`, `write`, `create`, `createNew`, `append`, `truncate`, `mode`): reading and writing at its position, `seek` from the start, the position or the end, `truncate`, `stat`, `sync`, a web `ReadableStream` and `WritableStream` of its bytes, and `close`, also by `using` and `await using`. A handle MUST NOT give a file lock: one run at a time is `lock` (commons 0001-system FR-015) on every runtime, and a program that needs a lock uses it.
- **FR-006**: `fs.copy` MUST copy a file or a folder recursively (refusing to overwrite unless asked, keeping modes, copying a symbolic link as a link), and `fs.walk` MUST walk a folder as `@std/fs`'s `walk` does (`maxDepth`, `includeFiles`, `includeDirs`, `includeSymlinks`, `followSymlinks`, `exts`, `match`, `skip`), in the byte order of the names at each level, so a walk is the same every time.
- **FR-007**: `fs.symlink` and `fs.symlinkSync` MUST take the type `junction` for a folder: on Windows a directory junction, which any account may make (a symbolic link needs administrator rights or Developer Mode there), its target made absolute as Windows requires; on Linux and macOS an ordinary symbolic link. A harness that links a folder for its own use (a scratch tree sharing `node_modules`) MUST use it, so it works for a person without administrator rights.
- **FR-008**: The module `dirs` MUST give, for a program's name, a system and an environment, its config, data, state, cache and runtime folders and its binary folder: on Linux and macOS `$XDG_CONFIG_HOME`, `$XDG_DATA_HOME`, `$XDG_STATE_HOME`, `$XDG_CACHE_HOME` and `$XDG_RUNTIME_DIR` with the program's name below each, else `~/.config`, `~/.local/share`, `~/.local/state`, `~/.cache` (and no runtime folder), and `~/.local/bin`; and on Windows `%APPDATA%\<name>` for config and `%LOCALAPPDATA%\<name>`, `%LOCALAPPDATA%\<name>\state` and `%LOCALAPPDATA%\<name>\cache` for the others, with no binary folder. A value of an `XDG_*` variable MUST be honored on every system where it is set to an absolute path, Windows included, and MUST be ignored where it is not an absolute path. macOS MUST use the same folders as Linux, and MUST NOT use `~/Library`, because `git` and `gh`, which this work stands on, do not. A folder MUST be undefined, and never guessed, where no home folder can be found and no variable names it.

## Processes and programs

- **FR-009**: `proc` MUST give the environment (`env.get`, `set`, `delete`, `has`, `toObject`), the arguments, `exit`, the working folder, the platform (`build.os`, `build.arch`, `build.target`), the running runtime's name and version, `which` as `command -v` finds a program (with `PATHEXT` on Windows), and the running of a program by its argument vector and never through a shell: its input, environment and working folder given, its output kept as bytes or text or handed on line by line, a non-zero exit an outcome and not an error, a program that does not exist `NotFound`, and an abort signal stopping it with SIGTERM and then SIGKILL.
- **FR-010**: `proc.spawn` MUST start a program by its argument vector and give a handle while it runs: its process id, its standard input as a web `WritableStream` and its output and errors as web `ReadableStream`s where they are piped, `kill` with a signal, `status` (a promise of its exit status and signal), `output()` (its whole output once it ends), `ref` and `unref`, and an abort signal and `await using` that stop it with SIGTERM and then SIGKILL; a program that does not exist MUST be `NotFound`, as for `output` (commons 0001-system FR-009).
- **FR-011**: `proc` MUST give `ppid`, `build.target` (the target triple, such as `x86_64-unknown-linux-gnu`), `unrefTimer` (a timer that never keeps the process alive), and `selfCommand()`: the argument vector that runs the running program again with other arguments, on Bun and Node and from a binary that Bun compiled, so that a program that runs itself has one way to do it.
- **FR-012**: `discover` MUST find every program whose name begins with a given prefix on a search path, as Git finds `git-<word>`: each folder of the path in order, the first program of a name winning over a later one of the same name; a directory and a file that may not be run skipped and each kept with why it was skipped; on Windows, a name found by each extension `PATHEXT` lists (compared without regard to case, `.EXE;.CMD;.BAT;.COM` where it is not set), the extension left out of the name. The search path, the extensions and the platform MUST be able to be given rather than read from the process, so that Windows' rules are proven on any system, and the separator between the path's folders MUST come from that platform's rules (`path.win32` or `path.posix`) and a folder and a name be joined by the running system's, never a hard-coded `:` or `/`.
- **FR-013**: `compile` MUST build a program into one binary with the pinned Bun (`bun build --compile`) for a target given (`linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`, `windows-x64`) or for this computer, with the files it embeds, and give the binary's path and SHA-256; CI MUST build a small program for this computer on each system and run it.
- **FR-014**: `git` MUST read a repository by running `git` with an argument vector: the commit at `HEAD`, whether the tree is clean, the paths changed between two revisions, and a file as it is at a revision; each a `Result`, a repository that is not there an `Err`.

## Runs, watching and the terminal

- **FR-015**: System MUST give one run at a time by a lock file made only where none exists, holding its holder (process, command, since when, a token): a run that waits polls, says once whom it waits for and may give up after a time; a lock whose holder no longer runs, or whose file cannot be read, is taken over; a child may inherit its parent's lock through an environment variable; and release removes the file only where it still holds the releasing holder's token, on exit too.
- **FR-016**: `watch` MUST watch files and folders (recursively where asked) as an async iterable of events (`create`, `modify`, `remove`, `rename`, with the paths), joined over a given number of milliseconds so that one save is one event, on Linux, macOS and Windows, stopped by an abort signal or by `using`.
- **FR-017**: System MUST plan an operating system's own scheduled job from a generic description (a validated name, an owner's reverse-DNS domain and folder, an argument vector, a working folder, environment, an optional log, and a schedule of every N minutes, hourly, daily, weekly or monthly): a systemd user service and timer on Linux, a LaunchAgent on macOS and a Task Scheduler task running a `.cmd` file on Windows, with the commands that install and remove it; quote every argument for systemd and for `cmd.exe` so it reaches the program unchanged, and refuse, by a typed error naming the field, what cannot be (a line break, a quote in a `cmd` argument, a relative folder). System MUST install and remove a plan, writing its files and running its steps through a runner that tests replace, so no test touches a real scheduler.
- **FR-018**: `tty` MUST say whether a standard stream is a terminal and its size, turn raw mode on and off (`NotSupported` where standard input is not a terminal), and choose colour, emoji and width by a pure function of the environment and the terminal: colour only without `NO_COLOR` and only at a terminal unless `FORCE_COLOR`; `TERM=dumb` as no terminal; emoji where the locale is UTF-8, or on Windows in a terminal that says so, or on macOS with `TERM_PROGRAM`.
- **FR-019**: `stdio` MUST give standard input as a web `ReadableStream`, a `read` into a buffer, and the whole of it as bytes or text; and standard output and standard error as `write` (bytes or text), `writeSync` and a web `WritableStream`, for output read by programs (JSON, a protocol on standard input and output). It and `console` MUST be the only files of the runtime that write to standard output or standard error: what a person reads goes through the console, what a program reads through `stdio`.

## The package

- **FR-020**: System MUST depend on Core, Formats and Crypto alone, MUST import no telemetry and no network (the telemetry of commons installs, by `proc.setProcessTracer`, the function that makes each program a `process` span, so that a program is run with nothing added where none is installed), MUST name no vendor's global, and MUST be published as compiled modules with their declarations as `@intellectual-frontiers/system` (commons 0032-libraries-by-concern FR-005), with an entry for the package and one for each module.

## Acceptance scenarios

1. **Given** a folder that is not there, **When** a file in it is read, **Then** `NotFound` is thrown with the path and the cause, per FR-001 and FR-002.
2. **Given** a Windows path and a POSIX path, **When** they are joined with each platform's rules, **Then** each follows its own, per FR-003.
3. **Given** a program that prints to both streams and exits 3, **When** it is run by its argument vector, **Then** the outcome holds both outputs and the code and nothing is thrown, per FR-009 and FR-010.
4. **Given** two programs of one name on a search path, **When** programs are found by prefix, **Then** the first wins and the shadowed one is kept with why it was not taken, per FR-012.
5. **Given** a lock file made by a run that is still going, **When** a second run asks for it, **Then** it says whom it waits for, per FR-015.
6. **Given** the packed package installed under `node_modules`, **When** Node 26 and Bun import each entry, **Then** both give the same answer, per FR-020.

## Out of scope

- The network, the servers and the clients (the library `net`), the OpenTelemetry pipeline and the console that renders it (the library `telemetry`), and the test harness (the library `test`).

## Edge cases

- A program that cannot be found: `NotFound` with its name, never a shell's message, per FR-010.
- A folder linked as a junction on Windows without administrator rights: read through it, per FR-007.
- No home and no variable: the folders of a program are undefined, per FR-008.
- No telemetry loaded: a program is run with nothing added to its environment, per FR-020.

## Assumptions

- Node 26 and Bun implement the `node:` builtins that this library names; a `git` is on the path where Git is read.

## Open questions

- None.

## Key entities

- **Run outcome** - the status, the code and the outputs of a program that ran, never an exception for a non-zero exit.
- **Lock** - one run at a time, made of a lock file that holds its holder.
- **Process tracer** - the function the telemetry installs so that a program is a span.

## Success criteria

- **SC-001**: A program written against this library behaves the same on Bun and Node 26 on the three systems.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
