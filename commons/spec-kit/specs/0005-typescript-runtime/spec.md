# Feature Specification: TypeScript runtime

**Spec ID:** 0005-typescript-runtime
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** IFC TypeScript, the TypeScript part of Intellectual Frontiers Commons: one pure kernel and one host runtime that every TypeScript harness of the company (`erga`, `stolos`) imports instead of each writing its own `Result`, decoders, version comparison, checksums, archives, file, process, terminal, download and server helpers, and instead of calling one vendor's API directly. It rests only on what does not belong to a vendor: TypeScript 7, ECMAScript, the web standards and the `node:` module surface that Bun and Node both implement, so that the code runs unchanged on Bun, the default runtime, and on Node 26, the backup, on Linux, macOS and Windows, and a runtime can be replaced without rewriting the code (Software Sovereignty: replaceable services, tested continuity). The code is treated as new: it carries no name, shape or alias for an older caller's sake. Its one core dependency is TypeScript 7; every other tool (install, format, lint, test) comes from one pinned binary, Bun, which is also the default runtime, so the work is Bun-first and Node 26 is the runtime it is tested on besides.

## Layout and boundaries

- **FR-001**: IFC TypeScript MUST live in `commons/ts/`: `kernel/` and `runtime/` (each with a `mod.ts` that re-exports its modules), `tests/`, `package.json` (`"type": "module"`), its lockfile (`bun.lock`), `bunfig.toml`, `tsconfig.json` and `tsconfig.kernel.json`, and `node/`, the JavaScript that runs it on Node from `node_modules` (FR-070). `runtime/test.ts` MUST NOT be re-exported by `runtime/mod.ts`, so that importing the runtime never loads a test runner.
- **FR-002**: The kernel MUST be pure: a file of `kernel/` MUST import only other files of `kernel/`, MUST NOT name a host global (`process`, `Buffer`, `require`, `__dirname`) and MUST type-check under `tsconfig.kernel.json`, which gives it no host types (`types: []`, the ECMAScript and DOM libraries only), so that it runs in a browser and a Cloudflare Worker as well as on the three runtimes. The kernel MUST NOT import the runtime.
- **FR-003**: The runtime is the only code that touches the host: a file of `runtime/` MUST import only `node:` builtins, files of `kernel/` and files of `runtime/`. There MUST be one implementation for all three runtimes; code for one runtime alone is allowed only for foreign functions (which stay in the harness that needs them), raw terminal mode and the HTTP listener, and only where the `node:` surface cannot do it.
- **FR-004**: No code of `commons/ts/` MUST name a member of a vendor's global (`Bun.*` and the others the lint rule `no-vendor-api` lists), import from `jsr:`, `npm:`, `@std/`, `@erga/` or a URL, or depend on a package at run time. With `types: ["node"]`, a reference to a vendor's global is also a compile error.

## The kernel

- **FR-005**: The kernel MUST take errors as values, exhaustive matching and branded types from the library `core` (`@intellectual-frontiers/core`, core 0001-core FR-001), where they are specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold them itself.
- **FR-006**: The kernel MUST take the decoders from `unknown` to typed values from the library `core` (`@intellectual-frontiers/core`, core 0001-core FR-002), where they are specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold them itself.
- **FR-007**: The kernel MUST take semantic versions from the library `formats` (`@intellectual-frontiers/formats`, formats 0001-formats FR-013), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold it itself.
- **FR-008**: The kernel MUST take SHA-256 as a branded checksum from the library `crypto` (`@intellectual-frontiers/crypto`, crypto 0001-crypto FR-001), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold it itself.
- **FR-009**: The kernel MUST take the pure text helpers (line endings, terminal escapes, argument vectors) from the library `core` (`@intellectual-frontiers/core`, core 0001-core FR-003), where they are specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold them itself.
- **FR-010**: The kernel MUST take the writing of archives from the library `formats` (`@intellectual-frontiers/formats`, formats 0001-formats FR-010), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold it itself.
- **FR-011**: The kernel MUST take the writing and reading of data as TypeScript literals from the library `formats` (`@intellectual-frontiers/formats`, formats 0001-formats FR-006), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold it itself.
- **FR-012**: The kernel MUST take HTTP headers from the library `formats` (`@intellectual-frontiers/formats`, formats 0001-formats FR-017), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold it itself.

## Tests and checking

- **FR-013**: Tests MUST register through `runtime/test.ts`, which MUST run on `node:test` and assert with `node:assert/strict` under short plain names (`assert`, `assertEquals`, `assertStringIncludes`, ...); `proves(requirements, name, fn)` MUST name each test for the requirements it proves and keep them for a report. The same test files MUST pass unchanged under `bun test` and `node --test`.
- **FR-014**: The kernel MUST take the tests of types with no framework from the library `core` (`@intellectual-frontiers/core`, core 0001-core FR-004), where they are specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold them itself.
- **FR-015**: Every file of `kernel/`, `runtime/` and `tests/` MUST begin with a JSDoc block that says `@module`, and every declaration a file of `kernel/` or `runtime/` exports MUST carry JSDoc, so that a harness that requires documentation (Stolos) can take the code as it is.
- **FR-016**: The development dependencies (TypeScript 7, `@types/node`, fast-check, and nothing else) MUST be pinned to exact versions in `commons/ts/package.json`, with Bun's text lockfile `bun.lock` beside it and installed with `bun install --frozen-lockfile`; there MUST be no run-time dependency.
- **FR-017**: TypeScript 7 (`tsc`) MUST be the type-checking authority: `tsc -p tsconfig.json` MUST pass on every file with `strict`, `module: nodenext`, `noEmit`, `allowImportingTsExtensions`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `isolatedModules`, `types: ["node"]`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `noUnusedLocals` and `noUnusedParameters`. `erasableSyntaxOnly` keeps the code to what type stripping runs: no `enum`, no `namespace`, no parameter properties.
- **FR-018**: CI MUST, on every push and pull request that touches `commons/ts/`, run `tsc` 7 on both configurations, the formatter and the linter, and the whole suite on Bun (the pinned version, the default runtime) and Node 26 (the backup), each on Linux, macOS and Windows; a test that cannot apply to one platform (file modes, symbolic links, POSIX signals on Windows) MUST say so in its code and still run the rest.

## The runtime

- **FR-019**: The runtime MUST take typed errors from the library `system` (`@intellectual-frontiers/system`, system FR-001), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-020**: The runtime MUST take the file calls from the library `system` (`@intellectual-frontiers/system`, system FR-002), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-021**: The runtime MUST take paths from the library `system` (`@intellectual-frontiers/system`, system FR-003), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-022**: The runtime MUST take the environment and the platform from the library `system` (`@intellectual-frontiers/system`, system FR-009), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-023**: The runtime MUST take the terminal's state from the library `system` (`@intellectual-frontiers/system`, system FR-018), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-024**: `runtime/net.ts` MUST download over `fetch`: classify a failure (DNS, connection, broken, timeout, TLS, certificate, an HTTP status), retry only where another try can help, waiting longer each time up to a cap or as long as the server's `Retry-After` asks (no longer than the cap), say and keep every retry, resume a `.part` file with `Range`, and keep a file only where its SHA-256 is the one expected.
- **FR-025**: `runtime/serve.ts` MUST serve HTTP on `node:http` with a handler from a web `Request` to a web `Response`: streamed bodies both ways, every `set-cookie` kept, `HEAD` without a body, a handler that throws answered by `onError` (500 by default), a client that goes away aborting `request.signal`, `127.0.0.1` unless another address is asked for, `AddrInUse` where the port is taken, and a shutdown by call or by abort signal.

## Toolchain and distribution

- **FR-026**: Bun MUST be the one tool binary beside TypeScript 7: it installs the development dependencies, formats, lints and runs the tests. It MUST be pinned in commons' pins (`BUN_VERSION`, with its SHA-256 on every platform, commons 0002-packaging FR-014) and CI MUST use that version. No other formatter, linter, test framework or package manager (npm, Prettier, ESLint, dprint, Vitest) MUST be a dependency of `commons/ts/`; Node 26, the backup runtime, is a runtime the code is tested on, not a tool it needs.
- **FR-027**: `bun fmt --check` MUST pass on every file of `commons/ts/` that is not generated, with the settings of `bunfig.toml`'s `[fmt]` section.
- **FR-028**: `bun lint --type-aware --max-warnings 0` MUST pass on `kernel/`, `runtime/` and `tests/`, with the settings of `bunfig.toml`'s `[lint]` section, which MUST make errors of at least: `no-explicit-any`, `no-non-null-assertion`, `explicit-module-boundary-types`, `switch-exhaustiveness-check`, `no-floating-promises`, `no-misused-promises`, `consistent-type-imports`, `only-throw-error`, `no-unnecessary-type-assertion`, `ban-ts-comment` (a `@ts-expect-error` allowed only with its reason) and `eqeqeq`. Until a released Bun has `bun lint`, CI MUST run it with one exact canary version, named in the workflow, and move to the release that has it.
- **FR-029**: IFC TypeScript MUST be consumed as a Git dependency of this repository's root package, `@intellectual-frontiers/commons` (the root `package.json`, `"type": "module"`, private, published to no registry), pinned by a commit (`"@intellectual-frontiers/commons": "github:intellectual-frontiers/.github#<commit>"`, or a tag of the repository where a consumer prefers one), so that the consumer's lockfile holds the commit. There MUST be no GitHub release of it, no tarball, no SHA-256 asset and no build: the entry points are the `.ts` sources, and nothing runs when it is installed (Bun runs a Git dependency's lifecycle scripts only where the consumer trusts it). The root package MUST export `./ts/kernel`, `./ts/runtime`, `./ts/runtime/test`, `./ts/runtime/test-run` (0008-test-evidence), `./ts/lint`, `./ts/lint/rule`, `./ts/lint/test-rule` and `./ts/mizan` and `./ts/mizan/integrations` (0003-mizan, 0019-mizan-integrations: Mizan's code) and `./ts/mizan/changes`, `./ts/mizan/check`, `./ts/mizan/oscal-register` and `./ts/mizan/versions` (the commands of 0020-ifccm, 0003-mizan and 0026-works-versioning, each also a module a consumer imports by name; amended 2026-11-18) from `commons/ts/`, `./ts/node` (FR-070) and the shared ontology of Mizan, `./ontology/mizan` (from `commons/ontology/mizan/`, 0016-ladder, so that a harness states its ladder as instances of it); it MUST have the command `ifc` (`ifc test`, 0008-test-evidence); and its `dependencies` MUST be exactly those IFC Docs needs when it runs (0011-documentation FR-001), pinned exactly, with Bun's `bun.lock` beside it. `commons/ts/package.json`, which is for the development of this folder, MUST bear the same name and export the same `./ts/...` entry points from its own folder, so that its examples import it by the name a consumer writes.
- **FR-030**: CI MUST install the commit it checks as a Git dependency (a `git+file:` URL of the checkout, with the commit) into an empty project, on Linux, macOS and Windows, and there, on Bun and on Node 26 (through FR-070's hook), import and use the kernel, the runtime and the test registration by the package's name, and run `ifc test run` on a small suite; and type-check a consumer with TypeScript 7 against the sources. `bun tools/smoke.ts [--repo DIR] [--commit SHA]` in `commons/ts/` does it (by default, the checkout it is in at its `HEAD`), and any failure, or a runtime that is not on `PATH`, ends with status 1.
- **FR-031**: The kernel MUST take the reading and writing of JSON5 from the library `formats` (`@intellectual-frontiers/formats`, formats 0001-formats FR-001), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold it itself.
- **FR-032**: The kernel MUST take the reading and writing of XML from the library `formats` (`@intellectual-frontiers/formats`, formats 0001-formats FR-004), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold it itself.
- **FR-033**: The kernel MUST take the ordering and scheduling of graphs of work from the library `core` (`@intellectual-frontiers/core`, core 0001-core FR-005), where they are specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold them itself.
- **FR-034**: The kernel MUST take SHA-512 crypt from the library `crypto` (`@intellectual-frontiers/crypto`, crypto 0001-crypto FR-003), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold it itself.

- **FR-035**: The kernel MUST take the reading and writing of TOML from the library `formats` (`@intellectual-frontiers/formats`, formats 0001-formats FR-003), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold it itself.
- **FR-036**: The kernel MUST take the reading and writing of CSV from the library `formats` (`@intellectual-frontiers/formats`, formats 0001-formats FR-005), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold it itself.
- **FR-037**: The kernel MUST take media types from the library `formats` (`@intellectual-frontiers/formats`, formats 0001-formats FR-016), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold it itself.
- **FR-038**: The kernel MUST take the reading of YAML from the library `formats` (`@intellectual-frontiers/formats`, formats 0001-formats FR-002), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold it itself.
- **FR-039**: The runtime MUST take one run at a time from the library `system` (`@intellectual-frontiers/system`, system FR-015), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-040**: The runtime MUST give typed HTTP clients a transport, live over `fetch` or recorded (answering by method and URL, and naming a request it has no exchange for), that refuses a request carrying a credential before it is sent unless made to allow credentials; a read-only guard; backoff on 429 and 503 that waits as long as `Retry-After` asks, up to a cap; a JSON read decoded at the boundary whose failures are typed (refused, network, denied for 401 and 403, another status, a decode) and are said without any header or body; every item of a list paged by `Link` or by a cursor; and the JSON5 text a recorded exchange is kept in, read back as the same exchange.
- **FR-041**: The kernel MUST take ASN.1 DER from the library `formats` (`@intellectual-frontiers/formats`, formats 0001-formats FR-009), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold it itself.
- **FR-042**: The kernel MUST take base64 and base64url from the library `formats` (`@intellectual-frontiers/formats`, formats 0001-formats FR-008), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold it itself.
- **FR-043**: The kernel MUST take the reading of PNG from the library `formats` (`@intellectual-frontiers/formats`, formats 0001-formats FR-012), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold it itself.
- **FR-044**: The kernel MUST take CMS encrypted content from the library `crypto` (`@intellectual-frontiers/crypto`, crypto 0001-crypto FR-005), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold it itself.
- **FR-045**: The kernel MUST take in-toto statements and DSSE envelopes from the library `crypto` (`@intellectual-frontiers/crypto`, crypto 0001-crypto FR-006), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold it itself.
- **FR-046**: The runtime MUST take scheduled jobs from the library `system` (`@intellectual-frontiers/system`, system FR-017), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-047**: The kernel MUST take a typed command-line parser (options declared once as data, inferred types, typed errors, help) from the library `terminal` (`@intellectual-frontiers/terminal`, terminal 0001-terminal FR-001), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold it itself.

## Everything else the harnesses take from the runtime

What `erga` and `stolos` call on a runtime or on `@std/*` that the sections above do not give, taken here so that neither harness needs more than Bun and Node; Bun is the runtime of record and the one that builds binaries.

- **FR-048**: The runtime MUST take reading a folder, chown and symlinkSync from the library `system` (`@intellectual-frontiers/system`, system FR-004), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-049**: The runtime MUST take file handles from the library `system` (`@intellectual-frontiers/system`, system FR-005), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-050**: The runtime MUST take copying and walking from the library `system` (`@intellectual-frontiers/system`, system FR-006), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-051**: The runtime MUST take watching from the library `system` (`@intellectual-frontiers/system`, system FR-016), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-052**: The runtime MUST take starting a program from the library `system` (`@intellectual-frontiers/system`, system FR-010), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-053**: The runtime MUST take ppid, targets and selfCommand from the library `system` (`@intellectual-frontiers/system`, system FR-011), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-054**: The runtime MUST take the standard streams from the library `system` (`@intellectual-frontiers/system`, system FR-019), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-055**: `runtime/tcp.ts` MUST listen for and make TCP connections, plain and over TLS: a listener on an address (port 0 for a free one) that gives its address and its connections as an async iterable and closes by call, abort signal or `using`; a connection with its local and remote addresses, a web `ReadableStream` and `WritableStream`, and `close`; a TLS listener from a certificate and key in PEM, and a TLS connection that checks the server's certificate against the system's roots or the ones given.
- **FR-056**: `runtime/dns.ts` MUST resolve `A`, `AAAA`, `CNAME`, `MX`, `NS`, `TXT` and `SRV` records, each a `Result` whose error says whether the name does not exist, has no such record, or could not be asked; and `proc.networkInterfaces()` MUST give each interface's name, family, address, netmask and whether it is internal.
- **FR-057**: The kernel MUST take MD5 from the library `crypto` (`@intellectual-frontiers/crypto`, crypto 0001-crypto FR-002), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold it itself.
- **FR-058**: The kernel MUST take path globs from the library `formats` (`@intellectual-frontiers/formats`, formats 0001-formats FR-015), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold it itself.
- **FR-059**: The kernel MUST take the reading of a tar as a stream from the library `formats` (`@intellectual-frontiers/formats`, formats 0001-formats FR-011), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold it itself.
- **FR-060**: `runtime/test.ts` MUST give `only` (a test run alone where any test is marked so: `node --test --test-only` runs it of itself, and on `bun test` the other tests of the file skip themselves), steps (`t.step(name, fn)` as subtests of `node:test`, recorded in the test's evidence as 0008-test-evidence records a test), and `assertAlmostEquals`, `assertNotMatch` and `assertNotStrictEquals`. Resource sanitizers and per-test permissions MUST NOT be given, as Node and Bun have neither: a test closes what it opens, by `using` and `await using`.
- **FR-061**: IFC TypeScript MUST give a lint plugin in the ESLint plugin format, which `bun lint --plugin` loads (`commons/ts/lint/`), with a typed way to define a rule, a way to run a rule against code in a test, and the rules every harness wants: no vendor API (a member of a vendor's global, `Bun.*` among them) outside a list of files with their reasons; no `npm:`, `jsr:` or URL import; a relative import that leaves its package refused; every file's `@module` block; a `switch` over a union with `absurd` in its `default`; and no write to the terminal outside a list of files with their reasons. Each rule MUST take its lists from its options, so that a harness keeps its own lists and adds its own rules.
- **FR-062**: The runtime MUST take a program built into one binary from the library `system` (`@intellectual-frontiers/system`, system FR-013), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.

## What the ports of the harnesses found

What converting a harness (Stolos first) showed it still wrote for itself, taken here so that the next harness does not.

- **FR-063**: The kernel MUST take the typing of `tsLiteral` from the library `formats` (`@intellectual-frontiers/formats`, formats 0001-formats FR-007), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold it itself.
- **FR-064**: The kernel MUST take `compact`, objects made for `exactOptionalPropertyTypes` from the library `core` (`@intellectual-frontiers/core`, core 0001-core FR-006), where they are specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold them itself.
- **FR-065**: `runtime/test.ts` MUST give `the(value, message?)`, which fails as `assertExists` does where the value is `null` or `undefined` and otherwise gives the value back narrowed to `NonNullable`, so that a test reads `the(map.get(k)).name`; `assertExists` MUST keep its form as an assertion.
- **FR-066**: The read-only guard of FR-040 MUST take, besides the token endpoints, a predicate over a whole `POST` request (method, URL, headers and body) that says it only reads (a GraphQL query, a search, a JSON API's `Describe` and `Get` actions), and MUST let through only those; `PUT`, `PATCH` and `DELETE`, and every other `POST`, MUST still be refused without being sent.
- **FR-067**: The kernel MUST take npm version ranges from the library `formats` (`@intellectual-frontiers/formats`, formats 0001-formats FR-014), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold it itself.
- **FR-068**: The kernel MUST take AWS Signature Version 4 from the library `crypto` (`@intellectual-frontiers/crypto`, crypto 0001-crypto FR-004), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold it itself.
- **FR-069**: The runtime's HTTP clients MUST be able to sign each request of a transport by FR-068 (`withSigV4`), with the time read when the request is sent; a request it signed carries a credential, so the live transport MUST still refuse it unless made to allow credentials (FR-040).
- **FR-070**: `commons/ts/node/register.mjs`, the package's `./ts/node`, MUST register a Node load hook (`module.registerHooks`) that strips the types of a `.ts`, `.mts` or `.cts` file under `node_modules`, which Node 26 refuses to strip itself, with Node's own `stripTypeScriptTypes`, and hands every other module on unchanged. It MUST tell such a file by the segments of its `file:` URL's path, so that it holds on Windows, MUST do nothing on Bun, and MUST be JavaScript, since it is loaded before any TypeScript can be. A consumer runs the package on Bun directly and on Node 26 as `node --import @intellectual-frontiers/commons/ts/node app.ts`; each command of the package (`ifc`, `ifc-docs`) MUST be a `.mjs` file that registers the hook and then imports its `.ts` entry, so that the same command runs on both; and `ifc test run` MUST give `node --test` the hook, so that a consumer's tests run on Node too.
- **FR-071**: The runtime MUST take programs found by prefix from the library `system` (`@intellectual-frontiers/system`, system FR-012), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.
- **FR-072**: The kernel MUST take command trees declared once as data from the library `terminal` (`@intellectual-frontiers/terminal`, terminal 0001-terminal FR-002), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT hold it itself.
- **FR-073**: The runtime MUST take junctions from the library `system` (`@intellectual-frontiers/system`, system FR-007), where it is specified and proved (0032-lifting-libraries FR-010), and MUST NOT specify it here.

## A library of commons that uses IFC TypeScript

What the first library of commons (`commons/data`, 0027-commons-libraries) found when it took the kernel by package name; recorded here so that no one runs the experiment again.

- **FR-074**: A library of commons in this repository MUST reach IFC TypeScript by package name (`@intellectual-frontiers/commons/ts/kernel` and the other entry points of FR-029) through a path link in its `devDependencies`, `"@intellectual-frontiers/commons": "link:../ts"`, which Bun installs as a symbolic link to `commons/ts` and writes to its `bun.lock`, so that `bun install --frozen-lockfile` makes the same link; it MUST NOT use a `file:` dependency, which Bun installs as a copy under `node_modules` that Node 26 refuses (FR-070) and that does not follow the source.
- **FR-075**: Node resolves a module to its real path, so a `.ts` of a linked package is not under `node_modules`: Node 26 MUST run it with no `--import` of the hook and no flag, Bun MUST run it, and the TypeScript 7 compiler MUST check it under `module` and `moduleResolution` of `nodenext`; the hook (FR-070) is for a consumer that installs a copy (FR-029).
- **FR-076**: A library's own modules MUST import one another by the library's package name through the `exports` of its `package.json`, one entry for each public surface (a package names itself); a file that `exports` does not name MUST NOT be importable by that name, on Node, on Bun and for the compiler, so that `exports` is the boundary of the library's public surface.
- **FR-077**: The layers check (`kernel/layers.ts`, 0015-trace FR-010) reads relative imports only, so an import by package name is never a finding; a library that imports its own layers by package name MUST check their order itself, by resolving each specifier through the `exports` of its package.

## Out of scope

- Converting `erga` or `stolos` to IFC TypeScript: each is a later, one-pass change of its own, after this one is reviewed (issue #7).
- Foreign functions (Stolos's PAM binding): they stay in the harness behind its own interface; with Node having no stable FFI, Stolos binds PAM with `bun:ffi` in the one file allowed to, so PAM's own policy (account checks, lockouts) still holds.
- The pinned tool store: it needs a design of its own first. The OpenTelemetry exporter and the terminal palette are 0006-signals; GRC primitives are 0007-grc; test records and reports are 0008-test-evidence.
- How `stolos` loads its engine (a verified tarball with the SHA-256 of each file, instead of an import by URL): `stolos`'s own specification; the kernel's archive reader is what it will use.

## Edge cases

- A kernel file that imports `node:fs`, or names `process`: the boundary test names the file and line, and `tsc -p tsconfig.kernel.json` fails, per FR-002.
- A runtime file that imports `jsr:@std/path` or writes a member of a vendor's global: the boundary test names it, and `tsc` fails on the global, per FR-003 and FR-004.
- A vendor global's member named in a JSDoc comment: comments are not code and are allowed, per FR-004.
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
- A test that runs under Bun but not under Node (or the reverse): the CI job of that runtime fails, per FR-013 and FR-018.
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
- An argument holding a line break, to be run by systemd: refused, never split into two lines of a unit, per FR-046.
- `--jsn` given where `--json` is declared: refused, saying `did you mean --json?`, per FR-047.
- `--verbose --verbose`: refused as repeated, never silently taken once, per FR-047.
- A consumer that pins a tag (`#v1`) rather than a commit: its lockfile holds the commit the tag named when it installed, per FR-029.
- A consumer that names the dependency otherwise (`"ifc": "github:intellectual-frontiers/.github#<commit>"`): Bun installs it under that name and it is imported by it (`ifc/ts/kernel`), per FR-029.
- `node app.ts` that imports `@intellectual-frontiers/commons/ts/kernel` without the hook: Node refuses the `.ts` under `node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`); with `--import @intellectual-frontiers/commons/ts/node` it runs, per FR-070 and FR-030.
- A file at `file:///C:/w/node_modules/x/mod.ts`, or a `.ts` file outside `node_modules`: the first is stripped by the hook, the second left to Node, per FR-070.
- A library that depends on `"file:../ts"`: Bun copies `commons/ts` into its `node_modules`, Node 26 refuses the copy, and the copy is not the source, per FR-074.
- A library that depends on `"link:../ts"`: a symbolic link, resolved to `commons/ts` by Node, which runs the kernel with no hook, per FR-074 and FR-075.
- `import "@intellectual-frontiers/data/engine/internal"` where `exports` names `./engine` only: refused on Node, Bun and by the compiler, per FR-076.
- A file of rung 1 that imports a file of rung 5 by package name: no finding of `layers/above`, the library's own check finds it, per FR-077.
- `fs.remove` on a folder that is not empty without `recursive`: `DirectoryNotEmpty` (or `AlreadyExists`, which some systems give), per FR-019 and FR-020.
- `fs.readTextFile` on a `file:` URL on Windows: the URL is turned into a Windows path, per FR-020.
- A program that does not exist: `NotFound` with code `ENOENT`, never a status of 127 that a caller could mistake for the program's own, per FR-019 and FR-022.
- A program that ignores SIGTERM: SIGKILL after `killAfterMs`, per FR-022.
- A server that answers 503 with `Retry-After: 120` when the cap is 30 seconds: the wait is 30 seconds, per FR-024.
- A download whose SHA-256 is not the one expected: the `.part` file is removed and nothing is kept, per FR-024.
- Port 0: the system picks a free port, and `addr` gives it, per FR-025.
- `Array.fromAsync(fs.readDir(dir))` on a folder that does not exist: `NotFound`, per FR-048.
- A file opened with `append` and written twice from two handles: both writes kept, each at the end, per FR-049.
- Code that took `FsFile.lock`: has no lock to take, and uses `runtime/lock`, per FR-049.
- `fs.copy` onto a folder that exists, without `overwrite`: `AlreadyExists`, and nothing copied, per FR-050.
- An editor that saves a file by writing a new one and renaming it: one `modify` (or `rename`) event after the join, not three, per FR-051.
- A spawned `gzip -dc` fed a stream and read as one: the bytes out are the bytes in, unzipped, per FR-052.
- `selfCommand()` in a binary Bun compiled: the binary alone, with no script path, per FR-053.
- `JSON.stringify(result)` written by `stdio.stdout.write` while the console shows progress on standard error: the JSON is whole, with no escape sequence in it, per FR-054.
- A TLS connection to a server whose certificate a given root did not sign: refused, per FR-055.
- `resolveDns("nonexistent.example", "MX")`: an `Err` saying the name does not exist, per FR-056.
- `md5("")`: `d41d8cd98f00b204e9800998ecf8427e`, per FR-057.
- `src/**/*.ts` against `src/a/b/c.ts`: a match; against `srcx/a.ts`: none, per FR-058.
- A tar of 2 GB read with `untarStream`: read entry by entry, never held whole, per FR-059.
- One test marked `only` among a hundred: that one runs, on each of the three runners, per FR-060.
- A vendor global's member (`Bun.file`) in a harness file not on the plugin's list: the linter names the file and line, per FR-061.
- `compile` asked for `windows-x64` on Linux: an `.exe` built, its SHA-256 given, per FR-062.
- `tsLiteral({ when: new Date() })`, or a value of an interface with a method: does not compile; an interface `{ name: string; tags?: readonly string[] }` with no index signature: compiles, per FR-063.
- `compact({ a: 1, b: maybe })` where `maybe` is `string | undefined`: the type `{ a: number; b?: string }`, and no `b` key at all where `maybe` is `undefined`, per FR-064.
- `the(undefined)`: fails with the message given, per FR-065.
- A `POST` to a GraphQL endpoint holding a `mutation`, where the predicate lets through only `query`: refused, never sent, per FR-066.
- `satisfies("1.2.4-beta", "^1.2.3")`: false, as the pre-release is of another patch; `satisfies("1.2.3-beta.4", "^1.2.3-beta.2")`: true, per FR-067.
- `^0.0.3`: `0.0.3` alone (and its builds), as `>=0.0.3 <0.0.4-0`, per FR-067.
- `>=1.2.3 <`: an error naming the range, never a range that holds every version, per FR-067.
- AWS's `get-vanilla` example (`AKIDEXAMPLE`, `us-east-1`, service `service`, `20150830T123600Z`): signature `5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31`, per FR-068.
- A path `/a//b/../c` given as text and signed for a service other than S3: signed as `/a/c`; for S3, as given, per FR-068.
- A signed request sent by the live transport made with its default options: refused, the `Authorization` header named and its value never said, per FR-040 and FR-069.
- `PATH` of two folders that both hold `tool-hello`: the first one's is found, and the second's is not a second program, per FR-071.
- A folder named `tool-x` on the path, or a file `tool-y` that may not be run: neither is found, and each is given back as skipped with why, per FR-071.
- On Windows (given as the platform), `PATH` `C:\a;C:\b` with `C:\a\tool-hello.CMD` and `PATHEXT` `.EXE;.CMD`: the program `hello` at that path, per FR-071.
- `tool wrk build` where the tree has the group `work`: an error naming `wrk` at the top level, with `work` as the suggestion, per FR-072.
- `tool work build --help`: the verb's help, and its handler never called, per FR-072.

## Assumptions

- Node 26 and Bun 1.4 each implement `node:fs`, `node:child_process`, `node:http`, `node:test` and `node:assert/strict` well enough for this suite; where one does not, the suite shows it and the gap is written here before it is worked around.
- TypeScript 7.0 ships no compiler API, so a type tester that needs one (TSTyche) waits for 7.1; the compiler itself is enough for the type-level tests here.
- Per-test permissions and resource sanitizers are not needed: tests close what they open (FR-060).
- Bun 1.4 installs a `file:` dependency on a folder as a copy and a `link:` dependency on a folder as a symbolic link; if a later Bun changes either, the test of FR-074 says so first.
- `node:sqlite` is in Node 26 and Bun 1.4, so a harness's SQLite code needs nothing of its own here.

## Open questions

- **OQ-1**: Whether to adopt TSTyche (or another dedicated type tester) once TypeScript 7.1 ships its API.
- **OQ-2**: How every `@example` in this code is made to compile (Stolos requires it).
- **OQ-3**: Whether the package should also be published to a registry (npm under an owned scope, or GitHub Packages) once a harness outside this organization needs it; a Git dependency pinned by commit is enough for `erga` and `stolos` (owner, November 16).
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
- **SC-002**: `bun test tests/` and `node --test "tests/**/*.test.ts"` pass in `commons/ts/` with the same test files.
- **SC-003**: Every requirement of this specification is proven by a test named for it, or by the CI job that runs it.
- **SC-004**: When `erga` and `stolos` are converted, none of them keeps its own `Result`, decoder, version comparison, checksum, archive, file, process, download or server helper that this folder gives.
- **SC-005**: `erga` and `stolos` depend on commons as a Git dependency pinned by commit, and keep no copy of its code.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
