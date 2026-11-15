# Feature Specification: TypeScript runtime

**Spec ID:** 0005-typescript-runtime
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** IFC TypeScript, the TypeScript part of Intellectual Frontiers Commons: one pure kernel and one host runtime that every TypeScript harness of the company (the machine setup, `erga`, `stolos`) imports instead of each writing its own `Result`, decoders, version comparison, checksums, archives, file, process, terminal, download and server helpers, and instead of calling one vendor's API (`Deno.*`) directly. It rests only on what does not belong to a vendor: TypeScript 7, ECMAScript, the web standards and the `node:` module surface that Deno, Node and Bun all implement, so that the code runs unchanged on each of the three, on Linux, macOS and Windows, and a runtime can be replaced without rewriting the code (Software Sovereignty: replaceable services, tested continuity). The code is treated as new: it carries no name, shape or alias for an older caller's sake, except the names of the `Deno` calls it replaces, kept on purpose so that converting a harness is a rename.

## Layout and boundaries

- **FR-001**: IFC TypeScript MUST live in `commons/ts/`: `kernel/` and `runtime/` (each with a `mod.ts` that re-exports its modules), `tests/`, `package.json` (`"type": "module"`), its lockfile, `tsconfig.json` and `tsconfig.kernel.json`. `runtime/test.ts` MUST NOT be re-exported by `runtime/mod.ts`, so that importing the runtime never loads a test runner.
- **FR-002**: The kernel MUST be pure: a file of `kernel/` MUST import only other files of `kernel/`, MUST NOT name a host global (`process`, `Buffer`, `require`, `__dirname`) and MUST type-check under `tsconfig.kernel.json`, which gives it no host types (`types: []`, the ECMAScript and DOM libraries only), so that it runs in a browser and a Cloudflare Worker as well as on the three runtimes. The kernel MUST NOT import the runtime.
- **FR-003**: The runtime is the only code that touches the host: a file of `runtime/` MUST import only `node:` builtins, files of `kernel/` and files of `runtime/`. There MUST be one implementation for all three runtimes; code for one runtime alone is allowed only for foreign functions (which stay in the harness that needs them), raw terminal mode and the HTTP listener, and only where the `node:` surface cannot do it.
- **FR-004**: No code of `commons/ts/` MUST name `Deno.*` or `Bun.*`, import from `jsr:`, `npm:`, `@std/`, `@erga/` or a URL, or depend on a package at run time. With `types: ["node"]`, a `Deno.` or `Bun.` reference is also a compile error.

## The kernel

- **FR-005**: The kernel MUST give errors as values (`Result<T, E>`, a union of `Ok` and `Err` told apart by `kind`, with `ok`, `err`, `map`, `mapErr`, `andThen`, `orElse`, `all`, `match`, `unwrapOr`, `attempt`, `settle`), exhaustive matching (`absurd(value: never)`) and branded types (`Brand<T, B>`), one name for each.
- **FR-006**: The kernel MUST give decoders from `unknown` to typed values (`string`, `number`, `integer`, `boolean`, `literal`, `nullable`, `array`, `tuple`, `record`, `object` with optional fields, `tagged` unions by `kind`, `oneOf`, `refine` to a brand, `json`), each failure naming the path of the value, what was expected and what was found. Type assertions that decoding needs MUST be confined to `kernel/decode.ts`.
- **FR-007**: The kernel MUST parse, print, order and bump semantic versions by semver.org 2.0.0 (§11 precedence, the build ignored, a leading `v` accepted) and compare the dotted versions programs print, part by part (`compareDotted`, `atLeast`, `versionIn`).
- **FR-008**: The kernel MUST give SHA-256 through Web Crypto as a branded `Sha256` (64 lower-case hexadecimal digits), made only by `sha256` or the validating `sha256Of`, with hexadecimal conversion and the reading of `SHASUMS256` files.
- **FR-009**: The kernel MUST give the pure text helpers more than one harness wrote: line endings made LF, terminal escapes removed, a command line split into its argument vector without a shell, and an argument vector quoted for a POSIX shell.
- **FR-010**: The kernel MUST write archives byte for byte from the files alone (a ustar tar, a gzip of stored blocks, a zip of stored entries, in the byte order of their paths, with fixed times and modes) and read them (tar with pax and GNU long names, gzip and zip entries stored or deflated through `DecompressionStream`), checking each header checksum, CRC-32 and size, and refusing every path that is absolute, has a `..`, `.` or empty segment, a backslash, a drive letter or a NUL.
- **FR-011**: The kernel MUST write data as TypeScript object literals and read back exactly that subset without running it, as a `Result`.
- **FR-012**: The kernel MUST read the `Link` header (RFC 8288) into its links and find a `rel`, read `Retry-After` as seconds or an HTTP date, and say which methods are safe (RFC 9110 §9.2.1).

## Tests and checking

- **FR-013**: Tests MUST register through `runtime/test.ts`, which MUST run on `node:test` and assert with `node:assert/strict` under the names of `@std/assert`; `proves(requirements, name, fn)` MUST name each test for the requirements it proves and keep them for a report. The same test files MUST pass unchanged under `deno test -A`, `node --test` and `bun test`.
- **FR-014**: Types MUST be tested by the compiler with no framework: `expectType<Equal<A, B>>()` for what a type is, and `// @ts-expect-error` above what must not compile, each kind of check with a negative control. Algebraic laws MUST be property-tested with fast-check: the functor and monad laws of `Result`, round trips (decode of encode, parse of print, read of write for every archive and literal format, split of quote) and the laws of every order (reflexive, antisymmetric, transitive, total).
- **FR-015**: Every file of `kernel/`, `runtime/` and `tests/` MUST begin with a JSDoc block that says `@module`, and every declaration a file of `kernel/` or `runtime/` exports MUST carry JSDoc, so that a harness that requires documentation (Stolos) can take the code as it is.
- **FR-016**: The development dependencies (TypeScript 7, `@types/node`, fast-check, and nothing else) MUST be pinned to exact versions in `commons/ts/package.json`, with `package-lock.json` beside it; there MUST be no run-time dependency.
- **FR-017**: TypeScript 7 (`tsc`) MUST be the type-checking authority, not `deno check` (whose TypeScript is 6): `tsc -p tsconfig.json` MUST pass on every file with `strict`, `module: nodenext`, `noEmit`, `allowImportingTsExtensions`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `isolatedModules`, `types: ["node"]`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `noUnusedLocals` and `noUnusedParameters`. `erasableSyntaxOnly` keeps the code to what type stripping runs: no `enum`, no `namespace`, no parameter properties.
- **FR-018**: CI MUST, on every push and pull request that touches `commons/ts/`, run `tsc` 7 on both configurations and the whole suite on Deno (the pinned version), Node 26 and Bun, each on Linux, macOS and Windows; a test that cannot apply to one platform (file modes, symbolic links, POSIX signals on Windows) MUST say so in its code and still run the rest.

## The runtime

- **FR-019**: The runtime MUST throw typed errors for what the host refuses (`NotFound`, `AlreadyExists`, `PermissionDenied`, `IsADirectory`, `NotADirectory`, `DirectoryNotEmpty`, `AddrInUse`, `ConnectionRefused`, `BrokenPipe`, `TimedOut`, `NotSupported`, `InvalidData` and the others of `Deno.errors`), each a subclass of `RuntimeError` made from the host's error code, keeping the code, the path or address and the original error as its `cause`. A function whose failure is an expected outcome of what it is for (a download, a parse) MUST return a `Result` instead.
- **FR-020**: `runtime/fs.ts` MUST give the file calls under the names and shapes of the `Deno` calls they replace (`readTextFile`, `writeTextFile` with `append`, `create`, `createNew` and `mode`, `readFile`, `writeFile`, `remove` with `recursive`, `mkdir`, `stat`, `lstat`, `readDir`, `makeTempDir`, `makeTempFile`, `rename`, `copyFile`, `chmod`, `symlink`, `readLink`, `realPath`, `truncate`, `utime`, and the synchronous forms in use), accept a path as a string or a `file:` URL, and give the helpers the harnesses wrote over them (`exists`, `readTextOr`, `ensureDir`, `writeIfChanged` in one step, `listDirs`, `listFiles`, `walkFiles`, `sha256File`, `withTempDir`).
- **FR-021**: `runtime/path.ts` MUST give the platform's path rules from `node:path`, both platforms' rules (`posix`, `win32`), `file:` URLs both ways and a path with `/` between its segments.
- **FR-022**: `runtime/proc.ts` MUST give the environment (`env.get`, `set`, `delete`, `has`, `toObject`), the arguments, `exit`, the working folder, the platform under `Deno.build`'s names, the running runtime's name and version, `which` as `command -v` finds a program (with `PATHEXT` on Windows), and the running of a program by its argument vector and never through a shell: its input, environment and working folder given, its output kept as bytes or text or handed on line by line, a non-zero exit an outcome and not an error, a program that does not exist `NotFound`, and an abort signal stopping it with SIGTERM and then SIGKILL.
- **FR-023**: `runtime/tty.ts` MUST say whether a standard stream is a terminal and its size, turn raw mode on and off (`NotSupported` where standard input is not a terminal), and choose colour, emoji and width by a pure function of the environment and the terminal: colour only without `NO_COLOR` and only at a terminal unless `FORCE_COLOR`; `TERM=dumb` as no terminal; emoji where the locale is UTF-8, or on Windows in a terminal that says so, or on macOS with `TERM_PROGRAM`.
- **FR-024**: `runtime/net.ts` MUST download over `fetch`: classify a failure (DNS, connection, broken, timeout, TLS, certificate, an HTTP status), retry only where another try can help, waiting longer each time up to a cap or as long as the server's `Retry-After` asks (no longer than the cap), say and keep every retry, resume a `.part` file with `Range`, and keep a file only where its SHA-256 is the one expected.
- **FR-025**: `runtime/serve.ts` MUST serve HTTP on `node:http` with a handler from a web `Request` to a web `Response`, as `Deno.serve` does: streamed bodies both ways, every `set-cookie` kept, `HEAD` without a body, a handler that throws answered by `onError` (500 by default), a client that goes away aborting `request.signal`, `127.0.0.1` unless another address is asked for, `AddrInUse` where the port is taken, and a shutdown by call or by abort signal.

## Out of scope

- Converting the machine setup (`bin/setup/`), `erga` or `stolos` to IFC TypeScript: each is a later, one-pass change of its own, after this one is reviewed (issue #7).
- Foreign functions (Stolos's PAM binding): they stay in the harness, per runtime, behind its own interface.
- The pinned tool store, an OpenTelemetry exporter over `fetch`, and a shared terminal palette: each needs a design of its own first.
- How `stolos` loads its engine (a verified tarball with the SHA-256 of each file, instead of an import by URL): `stolos`'s own specification; the kernel's archive reader is what it will use.

## Edge cases

- A kernel file that imports `node:fs`, or names `process`: the boundary test names the file and line, and `tsc -p tsconfig.kernel.json` fails, per FR-002.
- A runtime file that imports `jsr:@std/path` or writes `Deno.readTextFile`: the boundary test names it, and `tsc` fails on `Deno`, per FR-003 and FR-004.
- `Deno.readTextFile` named in a JSDoc comment to say what a function replaces: comments are not code and are allowed, per FR-004.
- A switch that leaves out an alternative before `absurd`: it does not compile, per FR-005.
- A plain string assigned where a `Sha256` or another brand is wanted: it does not compile, per FR-005 and FR-008.
- A JSON value with an `integer` field holding `1.5`: the decoder names `$.age`, an integer, and number 1.5, per FR-006.
- `1.0.0-beta.11` against `1.0.0-beta.2`: numeric identifiers compare as numbers, so 11 is later, per FR-007.
- `2.9` against `2.9.0`: the missing part counts as 0, so they are equal, per FR-007.
- A zip entry named `../evil` or `C:/x`, or a tar entry with an absolute path: refused before anything is unpacked, per FR-010.
- A tar header with one byte changed, or a zip entry whose bytes do not match its CRC-32: refused as damaged, per FR-010.
- A GitHub tarball, which begins with a pax global header and may carry pax paths: read, per FR-010.
- A `Link` header with a relative target, several `rel` values or a quoted parameter holding a comma: read, per FR-012.
- `Retry-After` as an HTTP date already passed: a wait of 0, never negative, per FR-012.
- A test that runs under Deno but not under Bun (or the reverse): the CI job of that runtime fails, per FR-013 and FR-018.
- A dependency written `^7.0.2`: the boundary test names it, per FR-016.
- `fs.remove` on a folder that is not empty without `recursive`: `DirectoryNotEmpty` (or `AlreadyExists`, which some systems give), per FR-019 and FR-020.
- `fs.readTextFile` on a `file:` URL on Windows: the URL is turned into a Windows path, per FR-020.
- A program that does not exist: `NotFound` with code `ENOENT`, never a status of 127 that a caller could mistake for the program's own, per FR-019 and FR-022.
- A program that ignores SIGTERM: SIGKILL after `killAfterMs`, per FR-022.
- A server that answers 503 with `Retry-After: 120` when the cap is 30 seconds: the wait is 30 seconds, per FR-024.
- A download whose SHA-256 is not the one expected: the `.part` file is removed and nothing is kept, per FR-024.
- Port 0: the system picks a free port, and `addr` gives it, per FR-025.

## Assumptions

- Deno 2.9, Node 26 and Bun 1.4 each implement `node:fs`, `node:child_process`, `node:http`, `node:test` and `node:assert/strict` well enough for this suite; where one does not, the suite shows it and the gap is written here before it is worked around.
- TypeScript 7.0 ships no compiler API, so a type tester that needs one (TSTyche) waits for 7.1; the compiler itself is enough for the type-level tests here.
- What is lost by leaving `deno test` (per-test permissions, the resource sanitizers) is not needed by these tests.

## Open questions

- **OQ-1**: Whether to adopt TSTyche (or another dedicated type tester) once TypeScript 7.1 ships its API.
- **OQ-2**: What replaces `deno check --doc`, so that every `@example` in this code compiles (Stolos requires it).
- **OQ-3**: Which formatter and linter replace `deno fmt` and `deno lint` for this folder (dprint, a lint tool).
- **OQ-4**: Whether IFC TypeScript is published as a package (and where), or the harnesses copy or vendor a pinned commit of it, verified by SHA-256.
- **OQ-5**: How a harness gives the runtime's errors back as `Result` values at its own boundary: one helper here, or each harness its own.

## Key entities

- **Kernel** - pure code: no import outside itself, no effect on the host, no host type.
- **Runtime** - the one part that touches the host, on `node:` builtins.
- **Result** - a success with its value or a failure with its typed error, told apart by `kind`.
- **Brand** - a type that the compiler keeps apart from its underlying type, made only by the function that validates it.
- **Decoder** - a function from `unknown` to a `Result` of a typed value.
- **Runtime error** - an error the runtime throws, of a class named for what went wrong, with the host's code.
- **Proof** - a test named for the requirements it proves.

## Success criteria

- **SC-001**: `npx tsc -p tsconfig.json` and `npx tsc -p tsconfig.kernel.json` (TypeScript 7) pass in `commons/ts/`.
- **SC-002**: `deno test -A --no-check tests/`, `node --test "tests/**/*.test.ts"` and `bun test tests/` pass in `commons/ts/` with the same test files.
- **SC-003**: Every requirement of this specification is proven by a test named for it, or by the CI job that runs it.
- **SC-004**: When the machine setup, `erga` and `stolos` are converted, none of them keeps its own `Result`, decoder, version comparison, checksum, archive, file, process, download or server helper that this folder gives.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
