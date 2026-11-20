/**
 * The typed facts of Lint, an independent library of commons (commons 0027-commons-libraries): the lint plugin of Intellectual Frontiers. Its specification is in its own spec kit (`spec-kit/`, `0001-lint`); this
 * repository knows it as one requirement of 0027-commons-libraries, proved by `bun run verify` in this folder, and as a library by concern (0032-libraries-by-concern).
 *
 * Spec: 0001-lint FR-010
 *
 * @module
 */
import type { About } from "@intellectual-frontiers/core/about";

/** Lint. */
export const about: About = {
  title: "Lint",
  summary:
    "The lint plugin of Intellectual Frontiers, in the ESLint plugin format that `bun lint --plugin` loads, named `ifc`: the rules every harness wants (no vendor API, no registry or URL import, a relative import that stays in its package, a module block " +
    "in every file, `absurd` in every switch over a union, no write to the terminal outside a list), each taking its lists from its options, the typed way to define a rule of a harness's own (`defineRule`) and the way to prove a rule against the " +
    "real linter (`lintFiles`). It depends on core, formats and system. Published to npm as compiled modules with their declarations.",
  folders: [
    { path: "spec-kit/", what: "The library's own specifications, numbered from 0001.", mayImport: ["nothing: Markdown and TSV"] },
    {
      path: "src/",
      what: "`plugin.ts`, the plugin, `rule.ts`, the typed way to define a rule, `test-rule.ts`, the way to run a rule against code in a test, and `rules/`, the rules.",
      mayImport: ["node: builtins", "src/", "core, formats and system, by package name"],
    },
    {
      path: "suite/",
      what: "The tests of the library, each rule against code it must refuse and code it must accept, run by the real `bun lint`.",
      mayImport: ["src/", "core, system and test, by package name"],
    },
    {
      path: "tools/",
      what: "The trace check and the packer `bun run verify` runs.",
      mayImport: ["the kernel, the runtime and the packer of commons, by package name"],
    },
  ],
};
