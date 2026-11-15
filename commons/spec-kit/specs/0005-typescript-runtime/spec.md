# Feature Specification: TypeScript runtime

**Spec ID:** 0005-typescript-runtime
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** IFC TypeScript, the TypeScript part of Intellectual Frontiers Commons: one pure kernel and one host runtime that every TypeScript harness of the company (the machine setup, `erga`, `stolos`) imports instead of each writing its own `Result`, decoders, version comparison, checksums, archives, file, process, terminal, download and server helpers, and instead of calling one vendor's API (`Deno.*`) directly. It rests only on what does not belong to a vendor: TypeScript 7, ECMAScript, the web standards and the `node:` module surface that Deno, Node and Bun all implement, so that the code runs unchanged on each of the three, on Linux, macOS and Windows, and a runtime can be replaced without rewriting the code (Software Sovereignty: replaceable services, tested continuity). The code is treated as new: it carries no name, shape or alias for an older caller's sake, except the names of the `Deno` calls it replaces, kept on purpose so that converting a harness is a rename. Its one core dependency is TypeScript 7; every other tool (install, format, lint, test, pack) comes from one pinned binary, Bun, as Deno once gave them, so the work is Bun-first while Deno and Node stay runtimes it is tested on.

## Layout and boundaries

- **FR-001**: IFC TypeScript MUST live in `commons/ts/`: `kernel/` and `runtime/` (each with a `mod.ts` that re-exports its modules), `tests/`, `package.json` (`"type": "module"`), its lockfile (`bun.lock`), `bunfig.toml`, `tsconfig.json`, `tsconfig.kernel.json` and `tsconfig.build.json`. `runtime/test.ts` MUST NOT be re-exported by `runtime/mod.ts`, so that importing the runtime never loads a test runner.
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
- **FR-016**: The development dependencies (TypeScript 7, `@types/node`, fast-check, and nothing else) MUST be pinned to exact versions in `commons/ts/package.json`, with Bun's text lockfile `bun.lock` beside it and installed with `bun install --frozen-lockfile`; there MUST be no run-time dependency.
- **FR-017**: TypeScript 7 (`tsc`) MUST be the type-checking authority, not `deno check` (whose TypeScript is 6): `tsc -p tsconfig.json` MUST pass on every file with `strict`, `module: nodenext`, `noEmit`, `allowImportingTsExtensions`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `isolatedModules`, `types: ["node"]`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `noUnusedLocals` and `noUnusedParameters`. `erasableSyntaxOnly` keeps the code to what type stripping runs: no `enum`, no `namespace`, no parameter properties.
- **FR-018**: CI MUST, on every push and pull request that touches `commons/ts/`, run `tsc` 7 on both configurations, the formatter and the linter, and the whole suite on Deno (the pinned version), Node 26 and Bun (the pinned version), each on Linux, macOS and Windows; a test that cannot apply to one platform (file modes, symbolic links, POSIX signals on Windows) MUST say so in its code and still run the rest.

## The runtime

- **FR-019**: The runtime MUST throw typed errors for what the host refuses (`NotFound`, `AlreadyExists`, `PermissionDenied`, `IsADirectory`, `NotADirectory`, `DirectoryNotEmpty`, `AddrInUse`, `ConnectionRefused`, `BrokenPipe`, `TimedOut`, `NotSupported`, `InvalidData` and the others of `Deno.errors`), each a subclass of `RuntimeError` made from the host's error code, keeping the code, the path or address and the original error as its `cause`. A function whose failure is an expected outcome of what it is for (a download, a parse) MUST return a `Result` instead.
- **FR-020**: `runtime/fs.ts` MUST give the file calls under the names and shapes of the `Deno` calls they replace (`readTextFile`, `writeTextFile` with `append`, `create`, `createNew` and `mode`, `readFile`, `writeFile`, `remove` with `recursive`, `mkdir`, `stat`, `lstat`, `readDir`, `makeTempDir`, `makeTempFile`, `rename`, `copyFile`, `chmod`, `symlink`, `readLink`, `realPath`, `truncate`, `utime`, and the synchronous forms in use), accept a path as a string or a `file:` URL, and give the helpers the harnesses wrote over them (`exists`, `readTextOr`, `ensureDir`, `writeIfChanged` in one step, `listDirs`, `listFiles`, `walkFiles`, `sha256File`, `withTempDir`).
- **FR-021**: `runtime/path.ts` MUST give the platform's path rules from `node:path`, both platforms' rules (`posix`, `win32`), `file:` URLs both ways and a path with `/` between its segments.
- **FR-022**: `runtime/proc.ts` MUST give the environment (`env.get`, `set`, `delete`, `has`, `toObject`), the arguments, `exit`, the working folder, the platform under `Deno.build`'s names, the running runtime's name and version, `which` as `command -v` finds a program (with `PATHEXT` on Windows), and the running of a program by its argument vector and never through a shell: its input, environment and working folder given, its output kept as bytes or text or handed on line by line, a non-zero exit an outcome and not an error, a program that does not exist `NotFound`, and an abort signal stopping it with SIGTERM and then SIGKILL.
- **FR-023**: `runtime/tty.ts` MUST say whether a standard stream is a terminal and its size, turn raw mode on and off (`NotSupported` where standard input is not a terminal), and choose colour, emoji and width by a pure function of the environment and the terminal: colour only without `NO_COLOR` and only at a terminal unless `FORCE_COLOR`; `TERM=dumb` as no terminal; emoji where the locale is UTF-8, or on Windows in a terminal that says so, or on macOS with `TERM_PROGRAM`.
- **FR-024**: `runtime/net.ts` MUST download over `fetch`: classify a failure (DNS, connection, broken, timeout, TLS, certificate, an HTTP status), retry only where another try can help, waiting longer each time up to a cap or as long as the server's `Retry-After` asks (no longer than the cap), say and keep every retry, resume a `.part` file with `Range`, and keep a file only where its SHA-256 is the one expected.
- **FR-025**: `runtime/serve.ts` MUST serve HTTP on `node:http` with a handler from a web `Request` to a web `Response`, as `Deno.serve` does: streamed bodies both ways, every `set-cookie` kept, `HEAD` without a body, a handler that throws answered by `onError` (500 by default), a client that goes away aborting `request.signal`, `127.0.0.1` unless another address is asked for, `AddrInUse` where the port is taken, and a shutdown by call or by abort signal.

## Toolchain and distribution

- **FR-026**: Bun MUST be the one tool binary beside TypeScript 7: it installs the development dependencies, formats, lints, runs the tests and packs the package. It MUST be pinned in commons' pins (`BUN_VERSION`, with its SHA-256 on every platform, commons 0002-packaging FR-014) and CI MUST use that version. No other formatter, linter, test framework or package manager (npm, Prettier, ESLint, dprint, Vitest) MUST be a dependency of `commons/ts/`; Node and Deno are runtimes the code is tested on, not tools it needs.
- **FR-027**: `bun fmt --check` MUST pass on every file of `commons/ts/` that is not generated, with the settings of `bunfig.toml`'s `[fmt]` section.
- **FR-028**: `bun lint --type-aware --max-warnings 0` MUST pass on `kernel/`, `runtime/` and `tests/`, with the settings of `bunfig.toml`'s `[lint]` section, which MUST make errors of at least: `no-explicit-any`, `no-non-null-assertion`, `explicit-module-boundary-types`, `switch-exhaustiveness-check`, `no-floating-promises`, `no-misused-promises`, `consistent-type-imports`, `only-throw-error`, `no-unnecessary-type-assertion`, `ban-ts-comment` (a `@ts-expect-error` allowed only with its reason) and `eqeqeq`. Until a released Bun has `bun lint`, CI MUST run it with one exact canary version, named in the workflow, and move to the release that has it.
- **FR-029**: IFC TypeScript MUST be distributed as the package `@intellectual-frontiers/ifc-ts` in a GitHub release of this repository: a tag `ifc-ts-vX.Y.Z` whose version is `package.json`'s makes CI build JavaScript and declarations with `tsc` 7 (`tsconfig.build.json`, relative imports rewritten to `.js`), pack them with `bun pm pack` and attach the tarball and its SHA-256 to the release. The package MUST export `./kernel`, `./runtime` and `./runtime/test`, MUST carry no test, and MUST NOT be released from a version already released. A harness MUST depend on it by the release asset's URL, so that its own lockfile holds the tarball's integrity.
- **FR-030**: Before a release is made, the packed tarball MUST be installed into an empty project and its three entry points imported and used on Deno, Node and Bun; a failure stops the release.

## Formats and graphs

- **FR-031**: The kernel MUST read JSON5 1.0 (comments, trailing commas, unquoted ECMAScript keys, single-quoted and continued strings, hexadecimal, `Infinity`, `NaN`, a leading `+`, a leading or trailing decimal point) into a typed `Json` value, or say the line and column where the text stops being JSON5; MUST read every JSON text as `JSON.parse` does; MUST define a key named `__proto__` as a member, never as the prototype; and MUST write a value as a person edits it (a `//` comment at its head, bare keys where they can be, two spaces of indent, a comma after every member, a short list of plain values on one line) that it reads back as the same value, `-0`, `NaN` and the infinities included.
- **FR-032**: The kernel MUST write XML from a typed tree with every value escaped and the characters XML 1.0 forbids removed, and MUST read XML (elements, attributes in either quote, the five named entities and character references, CDATA, comments, processing instructions, the declaration) into the same tree, checking that each element is closed by its own name and each attribute is given once, saying the line and column of what is wrong, and refusing a document type with an internal subset so that no entity is ever expanded.
- **FR-033**: The kernel MUST order a graph so that each node comes after the nodes it needs, the same way every time, or name a cycle; and MUST run a graph's nodes each the moment the nodes it needs are done, no more at once than asked, skipping (and saying) a node whose needed node failed or was skipped, and holding back nothing else.
- **FR-034**: The kernel MUST hash a password as glibc's SHA-512 crypt (`$6$`, Drepper's algorithm, rounds written where they are given and clamped as glibc clamps them, the salt cut to 16 characters) on Web Crypto alone, giving the bytes glibc's `crypt(3)` gives, and verify a password against such a hash. The salt MUST be given (made from random bytes by the caller), so the kernel has no effect.

- **FR-035**: The kernel MUST read TOML 1.0.0 whole (bare, quoted and dotted keys; tables, arrays of tables and inline tables; the four kinds of string; decimal, hexadecimal, octal and binary integers; floats with `inf` and `nan`; the four kinds of date and time, kept as their text with their kind) and hold to its rules (no key or table defined twice, no inline table or static array extended, no table made by dotted keys reopened by a header), refusing an integer JavaScript cannot hold exactly rather than rounding it and saying the line and column of what is wrong; and MUST write a table as TOML it reads back as the same table.
- **FR-036**: The kernel MUST read and write CSV by RFC 4180 (any one-character separator, quoted fields with doubled quotes and line breaks, CRLF or LF), refuse a quote in an unquoted field and a quoted field left open with the line and column, give records by a header's names (refusing a record of another length), and read back what it writes.
- **FR-037**: The kernel MUST give the media type of a path or an extension from one table of the types the harnesses serve and publish, `charset=UTF-8` with every textual type, and `application/octet-stream` where the extension is not known.
- **FR-038**: The kernel MUST read YAML 1.2 as data: block mappings and sequences (a sequence at its key's indentation, a mapping begun on a dash), flow collections over lines, plain scalars folded over lines, single- and double-quoted scalars with every YAML 1.2 escape, literal and folded block scalars with their indicators, comments and one document; resolve plain scalars by the core schema or, asked, the failsafe one; refuse, with the line, column and reason, anchors and aliases, tags, complex keys, directives, a second document, a key given twice and a tab for indentation; and write a value as block YAML it reads back as the same value.
- **FR-039**: The runtime MUST give one run at a time by a lock file made only where none exists, holding its holder (process, command, since when, a token): a run that waits polls, says once whom it waits for and may give up after a time; a lock whose holder no longer runs, or whose file cannot be read, is taken over; a child may inherit its parent's lock through an environment variable; and release removes the file only where it still holds the releasing holder's token, on exit too.
- **FR-040**: The runtime MUST give typed HTTP clients a transport, live over `fetch` or recorded (answering by method and URL, and naming a request it has no exchange for), that refuses a request carrying a credential before it is sent unless made to allow credentials; a read-only guard; backoff on 429 and 503 that waits as long as `Retry-After` asks, up to a cap; a JSON read decoded at the boundary whose failures are typed (refused, network, denied for 401 and 403, another status, a decode) and are said without any header or body; every item of a list paged by `Link` or by a cursor; and the JSON5 text a recorded exchange is kept in, read back as the same exchange.
- **FR-041**: The kernel MUST encode ASN.1 DER (X.690) in its one form (minimal lengths and two's complement integers, negative ones too; OIDs; SEQUENCE; a SET OF sorted; strings, booleans, NULL, explicit and implicit tags) and read it as a `Result` that says the byte where the input stops being DER (an indefinite or non-minimal length, a high tag number, content past the end, a non-minimal integer or OID arc), reading back integers, OIDs and nested structures as written.
- **FR-042**: The kernel MUST encode and decode base64 and base64url by RFC 4648 (base64url written without padding and read with or without it), refuse rather than skip what is not of the alphabet asked for, and read back what it writes.
- **FR-043**: The kernel MUST read PNG of every colour type and bit depth PNG defines (palette with `tRNS`, greyscale and RGB with `tRNS`, 16-bit samples), with every filter type, into 8-bit RGBA; check every chunk's CRC; refuse, by a typed error, a wrong signature, truncation, malformed headers, an out-of-range palette index, an unknown critical chunk and interlacing; refuse a picture of more than 2^24 pixels before allocating or inflating anything, and stop inflating at the size the header declares; write 8-bit RGB and RGBA PNG that it reads back as the same pixels; and give ICO files of PNG frames, resizing (Lanczos, on premultiplied alpha), compositing, thumbnail sizes, colour parsing and WCAG luminance.
- **FR-044**: The kernel MUST encrypt content as CMS AuthEnvelopedData (RFC 5652, RFC 5083): AES-256-GCM with a 16-byte tag (RFC 5084), the content key encrypted to each recipient's RSA key with RSAES-OAEP, SHA-256 and MGF1 with SHA-256 (RFC 8017, RFC 4055) in a KeyTransRecipientInfo naming the certificate by issuer and serial number; open it with a recipient's private key, accepting SHA-256 parameters written as NULL or absent, and refusing a changed message, a wrong key and a certificate it was not encrypted to with a typed error; read and write PEM; and read an X.509 certificate (RFC 5280) for its issuer, serial, key, addresses, validity and key usage, saying why it cannot encrypt to an address now. The content key and nonce MUST come from the caller.
- **FR-045**: The kernel MUST build in-toto Statements v1 generic in their predicate (subjects named, with their digests) and DSSE envelopes: the pre-authentication encoding with lengths in bytes, signing with keys the caller imported (Ed25519; ECDSA on P-256, P-384 and P-521 with signatures in ASN.1 DER; RSA-PSS and RSASSA-PKCS1-v1_5), and verification against a threshold of distinct keys that checks the payload type first and refuses, by a typed error, a malformed envelope, a key that cannot verify, and too few valid signatures.
- **FR-047**: The kernel MUST parse an argument vector against options declared once as data (flags, negatable flags, single values, repeatable values, each decoded by a parser or a kernel decoder, with defaults or required), inferring the parsed value's type from the declaration and refusing at compile time a short letter declared twice, a dashed key and the key `help`; take `--name VALUE`, `--name=VALUE`, `-x VALUE` and bundled short flags, end options at `--`, and treat help as a result of its own that wins over every error; refuse, by a typed error that says one sentence with a suggestion for a near name, an undeclared option, a missing, unexpected or attached value, an invalid value, an option given twice, a required option missing and an undeclared argument; and write help text from the same declaration.

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
- A file whose lines are not as `bun fmt` writes them: the format check fails, per FR-027.
- `const x: any`, `value!.field` or a `switch` that misses a member of a union with no `default`: the linter fails, per FR-028.
- `{"__proto__": {"polluted": true}}` read as JSON5: a member named `__proto__`, and `Object.prototype` untouched, per FR-031.
- `<!DOCTYPE a [<!ENTITY e "x">]>`: refused before any entity is read, per FR-032.
- A graph where `a` needs `b` and `b` needs `a`: the order names the cycle `a, b, a`, and the schedule rejects, per FR-033.
- A salt of 20 characters, or rounds of 10: the salt is cut to 16 and the rounds raised to 1000, as glibc does, per FR-034.
- `x = 9007199254740993` in TOML: refused at its column, never rounded, per FR-035.
- `a.b = 1` then `[a]` in TOML: refused, as TOML 1.0 refuses it, per FR-035.
- A CSV field `a"b`: refused at the quote, per FR-036.
- `notes.unknownext`: `application/octet-stream`, per FR-037.
- `a: &x 1` and `b: *x` in YAML: refused at the anchor, so nothing is ever repeated or expanded, per FR-038.
- `on: yes` in YAML 1.2: the text `yes`, not a boolean, per FR-038.
- A lock left by a process that crashed: taken over by the next run, per FR-039.
- A request with an `Authorization` header to a transport that refuses credentials: refused, and the header's value never said, per FR-040.
- DER whose length `0x81 0x05` could be one byte: refused as not the shortest form, per FR-041.
- `Zm9v!` given as base64: refused, never read as `foo`, per FR-042.
- A PNG whose header declares 100000 by 100000 pixels: refused before any memory is taken, per FR-043.
- A message encrypted by `openssl cms -encrypt -aes-256-gcm` with OAEP and SHA-256: opened, though OpenSSL writes SHA-256's parameters as absent, per FR-044.
- An EC certificate given as a recipient: refused as unsupported, never encrypted to, per FR-044.
- A DSSE envelope whose payload was changed after signing: refused as having no valid signature, per FR-045.
- `--jsn` given where `--json` is declared: refused, saying `did you mean --json?`, per FR-047.
- `--verbose --verbose`: refused as repeated, never silently taken once, per FR-047.
- A tag `ifc-ts-v0.2.0` while `package.json` says 0.1.0: the release job stops before building, per FR-029.
- A packed tarball that holds `.ts` files only (which Node will not strip under `node_modules`): the install check fails on Node, per FR-029 and FR-030.
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
- **OQ-3**: Whether the package should also be published to a registry (npm under an owned scope, or GitHub Packages) once a harness outside this organization needs it; the release asset is enough for `erga` and `stolos` (owner, November 15).
- **OQ-4**: Whether `bun check` (Bun's own TypeScript 7 checker) can replace `tsc` in CI once both are shown to report the same errors here; until then `tsc` 7 is the authority (FR-017).
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

- **SC-001**: `bun x tsc -p tsconfig.json` and `bun x tsc -p tsconfig.kernel.json` (TypeScript 7), `bun fmt --check` and `bun lint --type-aware --max-warnings 0` pass in `commons/ts/`.
- **SC-002**: `deno test -A --no-check tests/`, `node --test "tests/**/*.test.ts"` and `bun test tests/` pass in `commons/ts/` with the same test files.
- **SC-003**: Every requirement of this specification is proven by a test named for it, or by the CI job that runs it.
- **SC-004**: When the machine setup, `erga` and `stolos` are converted, none of them keeps its own `Result`, decoder, version comparison, checksum, archive, file, process, download or server helper that this folder gives.
- **SC-005**: `erga` and `stolos` depend on IFC TypeScript by a release's tarball URL and keep no copy of its code.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
