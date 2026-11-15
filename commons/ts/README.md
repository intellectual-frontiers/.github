# IFC TypeScript

The TypeScript part of Intellectual Frontiers Commons, specified by [`0005-typescript-runtime`](../spec-kit/specs/0005-typescript-runtime/spec.md). It rests only on
what belongs to no vendor (TypeScript 7, ECMAScript, the web standards and the `node:` modules that Deno, Node and Bun all implement), so the same code runs on each of the
three, on Linux, macOS and Windows. It is OpenTelemetry-native ([`0006-signals`](../spec-kit/specs/0006-signals/spec.md)), carries the primitives of GRC
engineering ([`0007-grc`](../spec-kit/specs/0007-grc/spec.md)) and records each test run as compliance evidence ([`0008-test-evidence`](../spec-kit/specs/0008-test-evidence/spec.md)).

| Folder                               | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                                          | May import                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| [`kernel/`](kernel/mod.ts)           | Pure code: `Result`, `absurd`, `Brand`, decoders, semantic and dotted versions, SHA-256, tar/gzip/zip writers and readers, `Link` and `Retry-After`, TypeScript literals, type-level tests; OpenTelemetry (`otel`, `otlp`, `signals`) and the console's rendering (`render`, `palette`, `width`, `vt`); GRC (`grc`, `evidence`, `assess`, `ocsf`, `oscal`, `attest`, `uuid`); test records and reports (`testRecord`, `testReport`). Runs in a browser or a Worker. | `kernel/` only                 |
| [`runtime/`](runtime/mod.ts)         | The host: `fs`, `path`, `proc`, `tty`, `net` (verified downloads with retries), `serve` (web `Request` to `Response`), typed `errors`; `otel` (OTLP export, journal, context, receiver), `terminal` (the one writer for people), `sign`, `git`, `grc`. The `Deno` names, so a conversion is a rename.                                                                                                                                                               | `node:`, `kernel/`, `runtime/` |
| [`runtime/test.ts`](runtime/test.ts) | Test registration on `node:test`, assertions on `node:assert/strict` under `@std/assert`'s names, and `proves`, which records every test as evidence; `runtime/test-run.ts` runs a suite into one record (`ifc test`).                                                                                                                                                                                                                                              | `node:`                        |
| [`tests/`](tests/)                   | The suite: examples, fast-check properties for every law and round trip, type-level tests, and the rules above as tests.                                                                                                                                                                                                                                                                                                                                            | anything here, and fast-check  |

## Work here

One core dependency, TypeScript 7; every other tool is Bun, pinned in commons' pins (`BUN_VERSION` in [`pins.auto.env`](../generated/pins.auto.env)).

```sh
cd commons/ts
bun install --frozen-lockfile         # TypeScript 7, @types/node and fast-check, exactly as bun.lock pins them
bun run check                         # tsc 7, the type checker of record: everything, then the kernel with no host types
bun fmt --check                       # the formatter (bunfig.toml [fmt])
bun lint --type-aware --max-warnings 0 kernel runtime tests tools   # the linter (bunfig.toml [lint]; a Bun canary until a release has it)
bun test tests/                       # Bun
node --test "tests/**/*.test.ts"      # Node 26
deno test -A --no-check tests/        # Deno (its own checker is TypeScript 6, so tsc checks instead)
bun run pack                          # dist/intellectual-frontiers-ifc-ts-X.Y.Z.tgz and its .sha256
bun run test:evidence                 # the suite on all three runtimes into one OTLP record, its TAP, JUnit, CTRF, SARIF, OSCAL and completion reports, and the ledger
bun run smoke dist/*.tgz              # the tarball installed and used on Bun, Node and Deno, and its declarations checked by tsc 7
```

CI ([`ifc-typescript.yml`](../../.github/workflows/ifc-typescript.yml)) runs all of it on Linux, macOS and Windows.

## Use it from another repository

A release is a tag `ifc-ts-vX.Y.Z` (the version in `package.json`); [`ifc-typescript-release.yml`](../../.github/workflows/ifc-typescript-release.yml) builds JavaScript and
declarations with TypeScript 7, packs them, checks the tarball on the three runtimes and attaches it, with its SHA-256, to the GitHub release. A harness depends on the asset,
and its lockfile keeps the tarball's integrity:

```sh
bun add https://github.com/intellectual-frontiers/.github/releases/download/ifc-ts-v0.2.0/intellectual-frontiers-ifc-ts-0.2.0.tgz
```

```ts
import { andThen, ok, type Result } from "@intellectual-frontiers/ifc-ts/kernel";
import { errors, fs, proc } from "@intellectual-frontiers/ifc-ts/runtime";
import { assertEquals, proves } from "@intellectual-frontiers/ifc-ts/runtime/test";
```

## Rules

- `kernel/` imports nothing outside itself and names no host global; `runtime/` imports only `node:` builtins, `kernel/` and itself. No `Deno.*`, `Bun.*`, `jsr:`, `npm:`,
  `@std/` or URL import anywhere. `tests/boundaries.test.ts` enforces these.
- Only erasable TypeScript (`erasableSyntaxOnly`): no `enum`, `namespace` or parameter properties.
- Errors: the runtime throws typed errors (`errors.NotFound`, ...); what is an expected outcome (a parse, a download) is a `Result`.
- Every file has a JSDoc block with `@module`, and every export has JSDoc.
- New code, no compatibility shims: one name for each thing.
