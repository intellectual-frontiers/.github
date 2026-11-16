/**
 * IFC TypeScript's lint plugin in the ESLint plugin format (commons 0005-typescript-runtime FR-061), named `ifc`, which `bun lint`
 * loads from this file as it is (TypeScript, no build): `bun lint --plugin=<path to lint/plugin.ts> --rule '{"ifc/no-vendor-api":
 * ["error", {...}]}'` for one run, or in `bunfig.toml`:
 *
 * ```toml
 * [lint]
 * plugins = ["./lint/plugin.ts"] # relative to bunfig.toml
 *
 * [lint.rules]
 * "ifc/no-vendor-api" = ["error", { allow = [{ files = "src/host/**", reason = "the one module that wraps the vendor's API" }] }]
 * "ifc/terminal-writers" = ["error", { allow = [{ files = "src/console.ts", reason = "the renderer, the one writer for a person" }] }]
 * ```
 *
 * The rules every harness wants, each taking its lists from its options so that a harness keeps its own lists and adds its own rules
 * (as its own plugin, with `defineRule` of `./rule.ts`):
 * - `no-vendor-api`: no member of a vendor's global (`Bun.*` and the like) outside the files listed with their reasons;
 * - `no-registry-import`: no `npm:`, `jsr:` or URL specifier;
 * - `import-boundary`: a relative import that leaves its package (the option `roots`) is refused;
 * - `module-doc`: every file begins with a JSDoc block that says `@module`;
 * - `switch-absurd`: a `switch` on a union's `kind` ends in `default` calling `absurd`;
 * - `terminal-writers`: no write to the terminal outside the files listed with their reasons.
 *
 * @module
 */
import type { Plugin } from "./rule.ts";
import { importBoundary } from "./rules/import-boundary.ts";
import { moduleDoc } from "./rules/module-doc.ts";
import { noRegistryImport } from "./rules/no-registry-import.ts";
import { noVendorApi } from "./rules/no-vendor-api.ts";
import { switchAbsurd } from "./rules/switch-absurd.ts";
import { terminalWriters } from "./rules/terminal-writers.ts";

/** The plugin: `ifc`, the prefix of its rules' ids, and its rules. */
const plugin: Plugin = {
  meta: { name: "ifc", version: "0.4.0" },
  rules: {
    "no-vendor-api": noVendorApi,
    "no-registry-import": noRegistryImport,
    "import-boundary": importBoundary,
    "module-doc": moduleDoc,
    "switch-absurd": switchAbsurd,
    "terminal-writers": terminalWriters,
  },
};

export default plugin;
