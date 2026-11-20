/**
 * The kernel of IFC TypeScript (commons 0005-typescript-runtime): pure code that imports nothing outside this folder, has no effect on the
 * host and runs wherever ECMAScript and the web standards do (Bun, Node, a browser, a Cloudflare Worker). Errors as values,
 * exhaustive matching, branded identifiers, decoders at the boundary; versions, SHA-256, SHA-512 crypt, base64, ASN.1 DER (as `der`), CMS
 * encryption (as `cms`), signed in-toto statements (as `dsse`) and AWS Signature Version 4 (as `sigv4`); CBOR (as `cbor`), COSE keys (as `cose`)
 * and WebAuthn verification for a relying party (as `webauthn`); PNG and ICO pictures (as `png`);
 * archives, JSON5, TOML, YAML, CSV, XML and TypeScript literals; HTTP headers and media types; graphs; command-line arguments (as `args`) and command trees (as `commands`);
 * the trace of requirements and the layers of a ladder (as `trace` and `layers`, commons 0015-trace);
 * and type-level tests.
 *
 * @example
 * ```ts
 * import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
 * type Stage = { readonly kind: "intake" } | { readonly kind: "review" };
 * function next(s: Stage): Result<Stage, string> {
 *   switch (s.kind) {
 *     case "intake": return ok({ kind: "review" });
 *     case "review": return err("review is the last stage");
 *     default: return absurd(s);
 *   }
 * }
 * ```
 *
 * @remarks
 * A library of this repository (`commons/data`, commons 0027-commons-libraries) reaches the kernel by package name, not by a relative path, through a
 * path link in its `devDependencies`: `"@intellectual-frontiers/commons": "link:../ts"` (commons 0005-typescript-runtime FR-074 to FR-077). The findings,
 * run by `tests/node/linked-library.test.ts` so that no one repeats them:
 *
 * - `link:` makes a symbolic link to `commons/ts`; `file:` makes a copy under `node_modules`, which Node 26 refuses
 *   (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`) and which does not follow the source. Use `link:`.
 * - Node resolves a link to its real path, so a linked `.ts` runs on Node 26 with no `--import` of the hook, on Bun and under the TypeScript 7 compiler
 *   (`nodenext`). The hook (`node/register.mjs`) is for a consumer that installs a copy.
 * - A library imports its own modules by its own package name through its `exports` (one entry for each public surface); a file `exports` does not name
 *   cannot be imported, by the runtimes or by the compiler, so `exports` is the library's boundary.
 * - `layers.ts` reads relative imports only, so an import by package name is never one of its findings: a library checks its own layers, by resolving
 *   each specifier through its `exports`.
 *
 * @module
 */
export * as layers from "./layers.ts";
export * as testReport from "./test-report.ts";
export * as trace from "./trace.ts";
export type {
  About,
  AboutArea,
  AboutCommand,
  AboutEnforcer,
  AboutExample,
  AboutFolder,
  AboutPhase,
  AboutPhaseState,
  AboutRule,
  AboutSpec,
} from "./documentation.ts";
