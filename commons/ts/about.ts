/**
 * The typed facts of IFC TypeScript, the TypeScript part of Intellectual Frontiers Commons (commons 0005-typescript-runtime), as its
 * documentation shows them (commons 0011-documentation FR-005): its folders and what each may import, the commands that work on it and
 * the rules it keeps, each with what enforces it. What each part is and does is the TSDoc of its modules.
 *
 * @module
 */
import type { About } from "./kernel/mod.ts";

/** IFC TypeScript: a pure kernel and one host runtime, the same code on Bun and Node. */
export const about: About = {
  title: "IFC TypeScript",
  summary:
    "The TypeScript part of Intellectual Frontiers Commons. It rests only on what belongs to no vendor (TypeScript 7, ECMAScript, the web " +
    "standards and the `node:` modules that Bun and Node both implement), so the same code runs on Bun, the default runtime, and on Node 26, the backup, on Linux, macOS and " +
    "Windows. It is OpenTelemetry-native (commons 0006-signals), carries the primitives of GRC engineering (commons 0007-grc) and records each " +
    "test run as compliance evidence (commons 0008-test-evidence). A harness depends on this repository's root package, " +
    "`@intellectual-frontiers/commons`, by Git at a commit its lockfile holds, and imports the `.ts` sources (`@intellectual-frontiers/commons/ts/kernel`): " +
    "Bun runs them as they are, and Node 26 with the hook `--import @intellectual-frontiers/commons/ts/node`. There is no release and no build. " +
    "It has one core dependency, " +
    "TypeScript 7; every other tool is Bun, pinned in commons' pins (`BUN_VERSION`), and CI (`ifc-typescript.yml`) runs every command " +
    "below on Linux, macOS and Windows.",
  spec: { repo: "commons", id: "0005-typescript-runtime" },
  folders: [
    {
      path: "kernel/",
      what: "Pure code that has no effect on the host and runs in a browser or a Worker.",
      mayImport: ["kernel/ only"],
    },
    {
      path: "runtime/",
      what: "The host: files, paths, processes, the network, serving, typed errors, OpenTelemetry export, the terminal, signing, Git and GRC.",
      mayImport: ["node: builtins", "kernel/", "runtime/"],
    },
    {
      path: "runtime/test.ts",
      what: "Test registration on `node:test`, assertions under `@std/assert`'s names, and `proves`, which records every test as evidence.",
      mayImport: ["node: builtins"],
    },
    {
      path: "mizan/",
      what: "Mizan, the IF Spec Profile, as code (commons 0003-mizan): the rules it adds to the format of a specification (as plugins), the command that holds them against a baseline, the generator of its ontology's Turtle, and `integrations/` (0019-mizan-integrations): the registry, the reader of Turtle and N-Triples, the importer of a slice of a vocabulary and the exporters of SHACL, JSON Schema, SKOS and SQL are built, the other importers and exporters are specified.",
      mayImport: ["node: builtins", "kernel/", "runtime/", "mizan/", "../ontology/ (the ontology it generates from)"],
    },
    {
      path: "lint/",
      what: "The lint plugin `bun lint --plugin` loads, and its rules.",
      mayImport: ["node: builtins", "kernel/", "lint/", "runtime/"],
    },
    {
      path: "node/",
      what: "The Node hook that strips the types of this package's sources under `node_modules`, and the command `ifc`, in JavaScript.",
      mayImport: ["node: builtins", "tools/test.ts, once the hook is registered"],
    },
    {
      path: "tools/",
      what: "The smoke test of the Git dependency, the evidence runner (`ifc test`) and the pins, run by Bun.",
      mayImport: ["kernel/", "runtime/", "tools/"],
    },
    {
      path: "tests/",
      what: "The suite: examples, fast-check properties for every law and round trip, type-level tests, and these rules as tests.",
      mayImport: ["anything here", "fast-check"],
    },
  ],
  commands: [
    { run: "bun install --frozen-lockfile", does: "Installs TypeScript 7, @types/node and fast-check, exactly as bun.lock pins them." },
    { run: "bun run check", does: "Runs tsc 7, the type checker of record: everything, then the kernel with no host types." },
    { run: "bun fmt --check", does: "Runs the formatter (bunfig.toml [fmt])." },
    {
      run: "bun lint --type-aware --max-warnings 0 kernel runtime tests tools",
      does: "Runs the linter with the ifc rules (bunfig.toml [lint]).",
    },
    { run: "bun run test", does: "Runs the suite under Bun." },
    { run: "bun run test:node", does: "Runs the suite under Node 26." },
    {
      run: "bun run test:evidence",
      does: "Runs the suite on Bun and Node into one OTLP record, its TAP, JUnit, CTRF, SARIF, OSCAL and completion reports, and the ledger.",
    },
    {
      run: "bun run smoke",
      does: "Installs the checkout's HEAD as a Git dependency into an empty project, uses it and runs ifc test on Bun and Node 26, and checks a consumer with tsc 7.",
    },
    {
      run: "bun tools/ocsf-gen.ts --check",
      does: "Checks that kernel/ocsf-types.auto.ts is what the pinned OCSF 1.9.0 schema gives (needs the network; run by hand).",
    },
  ],
  rules: [
    {
      rule: "`kernel/` imports nothing outside itself and names no host global; `runtime/` imports only `node:` builtins, `kernel/` and itself.",
      enforcedBy: [
        { kind: "test", file: "tests/boundaries.test.ts" },
        { kind: "lint", rule: "import-boundary" },
      ],
    },
    {
      rule: "No vendor global (`Bun.*` and the like), `jsr:`, `npm:`, `@std/` or URL import anywhere.",
      enforcedBy: [
        { kind: "test", file: "tests/boundaries.test.ts" },
        { kind: "lint", rule: "no-vendor-api" },
        { kind: "lint", rule: "no-registry-import" },
      ],
    },
    {
      rule: "Only erasable TypeScript: no `enum`, `namespace` or parameter properties.",
      enforcedBy: [{ kind: "compiler", option: "erasableSyntaxOnly" }],
    },
    {
      rule: "The runtime throws typed errors (`errors.NotFound`, ...); an expected outcome (a parse, a download) is a `Result`.",
      enforcedBy: [{ kind: "review" }],
    },
    {
      rule: "A `switch` over a union ends in `absurd`, so that an alternative left out does not compile.",
      enforcedBy: [{ kind: "lint", rule: "switch-absurd" }],
    },
    {
      rule: "Every file has a TSDoc block with `@module`, and every export has TSDoc.",
      enforcedBy: [
        { kind: "lint", rule: "module-doc" },
        { kind: "test", file: "tests/boundaries.test.ts" },
      ],
    },
    { rule: "New code, no compatibility shims: one name for each thing.", enforcedBy: [{ kind: "review" }] },
  ],
  areas: [
    { title: "Kernel", slug: "kernel", entryPoints: ["kernel/mod.ts"] },
    { title: "Runtime", slug: "runtime", entryPoints: ["runtime/mod.ts", "runtime/test.ts", "runtime/test-run.ts"] },
    { title: "Lint plugin", slug: "lint", entryPoints: ["lint/plugin.ts", "lint/rule.ts", "lint/test-rule.ts"] },
  ],
  examples: [{ file: "examples/use.ts", what: "What a harness imports once it depends on commons by Git." }],
};
