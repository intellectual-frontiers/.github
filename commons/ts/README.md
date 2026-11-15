# IFC TypeScript

The TypeScript part of Intellectual Frontiers Commons, specified by [`0005-typescript-runtime`](../spec-kit/specs/0005-typescript-runtime/spec.md). It rests only on
what belongs to no vendor (TypeScript 7, ECMAScript, the web standards and the `node:` modules that Deno, Node and Bun all implement), so the same code runs on each of the
three, on Linux, macOS and Windows.

| Folder | What it is | May import |
|---|---|---|
| [`kernel/`](kernel/mod.ts) | Pure code: `Result`, `absurd`, `Brand`, decoders, semantic and dotted versions, SHA-256, tar/gzip/zip writers and readers, `Link` and `Retry-After`, TypeScript literals, type-level tests. Runs in a browser or a Worker. | `kernel/` only |
| [`runtime/`](runtime/mod.ts) | The host: `fs`, `path`, `proc`, `tty`, `net` (verified downloads with retries), `serve` (web `Request` to `Response`), typed `errors`. The `Deno` names, so a conversion is a rename. | `node:`, `kernel/`, `runtime/` |
| [`runtime/test.ts`](runtime/test.ts) | Test registration on `node:test`, assertions on `node:assert/strict` under `@std/assert`'s names, and `proves`. | `node:` |
| [`tests/`](tests/) | The suite: examples, fast-check properties for every law and round trip, type-level tests, and the rules above as tests. | anything here, and fast-check |

## Work here

```sh
cd commons/ts
npm ci                                # TypeScript 7, @types/node and fast-check, exactly as package-lock.json pins them
npx tsc -p tsconfig.json              # the type checker of record (TypeScript 7), on everything
npx tsc -p tsconfig.kernel.json       # the kernel with no host types at all
node --test "tests/**/*.test.ts"      # Node 26
deno test -A --no-check tests/        # Deno (its own checker is TypeScript 6, so tsc checks instead)
bun test tests/                       # Bun
```

CI ([`ifc-typescript.yml`](../../.github/workflows/ifc-typescript.yml)) runs all of it on Linux, macOS and Windows.

## Rules

- `kernel/` imports nothing outside itself and names no host global; `runtime/` imports only `node:` builtins, `kernel/` and itself. No `Deno.*`, `Bun.*`, `jsr:`, `npm:`,
  `@std/` or URL import anywhere. `tests/boundaries.test.ts` enforces these.
- Only erasable TypeScript (`erasableSyntaxOnly`): no `enum`, `namespace` or parameter properties.
- Errors: the runtime throws typed errors (`errors.NotFound`, ...); what is an expected outcome (a parse, a download) is a `Result`.
- Every file has a JSDoc block with `@module`, and every export has JSDoc.
- New code, no compatibility shims: one name for each thing.
