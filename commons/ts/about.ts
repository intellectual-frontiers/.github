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
    "Bun runs them as they are, and Node 26 with the hook `--import @intellectual-frontiers/commons/ts/node`. There is no release and no build. A library of this repository (`commons/data`) links it by `link:../ts` and imports it by package name, with no hook (FR-074 to FR-077). " +
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
      what: "Mizan, the IF Spec Profile, as code (commons 0003-mizan): the rules it adds to the format of a specification (as plugins), the command that holds them against a baseline, the generator of its ontology's Turtle, and `integrations/` (0019-mizan-integrations): the registry, the readers of Turtle, N-Triples, JSON-LD and RDF/XML, the importers of a slice of a vocabulary, of an OSCAL control catalog and of a JSON Schema, and the exporters of SHACL, JSON Schema, SKOS and SQL are built, the other importers and exporters are specified. `changes/` and `changes.ts` (0020-ifccm) are the change-control check: the commit rules, the declaration and its phase, the chain from an issue to a run and the view of capabilities by rung, with a host layer that takes a `githost/` client as an argument; `changes.ts --capability-trace` makes the same chain offline, from commit trailers, specifications, the ontology's `mz:definedBy`, `Spec:` and `Proves:` lines and quality records, with no Git host. `versions.ts` (0026-works-versioning) judges the versions of works, and `checkVersions`, `readWorks` and `./ts/mizan/versions` give a consumer its check as data and as a command.",
      mayImport: [
        "node: builtins",
        "kernel/",
        "runtime/",
        "githost/ (its types)",
        "mizan/",
        "../ontology/ (the ontology it generates from)",
      ],
    },
    {
      path: "quality/",
      what: "IFC Quality (commons 0021-ifqs): the canonical record of a run (`not_run`, the grade E0 to E5, CTRF case bodies), its JUnit, CTRF, SARIF and TAP renderings, the evidence chain, and the append-only `quality` branch with its notes, written and verified with real `git`; Tier 1 (the ladder, freshness, the ledger of nonconformances and CAPA, objectives, the index) and Tier 2 (`attestation/`: pre-registered plans, attested samples, mutation runs, the agents' reviews; `trust/`: the Trust page and its audiences; `assessor/`: the assessor pack and its offline verifier, commons 0022-trust). `pure/` imports the kernel alone.",
      mayImport: ["node: builtins", "kernel/", "runtime/", "quality/"],
    },
    {
      path: "githost/",
      what: "The one interface to a Git host (commons 0023-if-workspaces): the types and the reading of a remote URL (pure), and the adapters for GitHub (REST v3), GitLab (REST v4, groups to any depth) and plain Git, with `clientFor`, the one place that reads a token, and only from the environment it is given.",
      mayImport: [
        "kernel/",
        "runtime/ (the adapters; the types, the table of capabilities and the remote reader import the kernel alone)",
        "githost/",
      ],
    },
    {
      path: "workspaces/",
      what: "IF Workspaces, rung 10 of the ladder (commons 0023-if-workspaces, 0024-ifws-host, 0025-ifws): the branded types, the layout from a remote to a path, the portability of paths, the manifest, the state of a repository, the plan as a pure function, the findings and the policy, the typed templates and the generated files, the state record, the module contract and its discovery, the shell snippet and its one block, and the doctor's checks, all pure; `host/` (git, files, the lock, the evidence record, discovery), `commands/` (the typed built-in modules of `ifws`) and `ifws.ts` (the controller) are the host layer, which runs the real `git`.",
      mayImport: [
        "kernel/",
        "githost/ (types, capabilities and the remote reader)",
        "workspaces/ (the pure part imports no host layer)",
        "runtime/, quality/ and mizan/changes/ (the host layer alone: host/, commands/, ifws.ts)",
      ],
    },
    {
      path: "lint/",
      what: "The lint plugin `bun lint --plugin` loads, and its rules.",
      mayImport: ["node: builtins", "kernel/", "lint/", "runtime/"],
    },
    {
      path: "node/",
      what: "The Node hook that strips the types of this package's sources under `node_modules`, and the commands `ifc` and `ifws`, in JavaScript.",
      mayImport: ["node: builtins", "tools/test.ts and workspaces/ifws.ts, once the hook is registered"],
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
    {
      run: "bun mizan/changes.ts --capability-trace --range A..B [--issues FILE] [--terms FILE] [--rungs FILE]",
      does: "Offline, with no Git host: for each capability the commits of the range serve, its requirements and, for each, the terms, code and tests on each rung and the stage where the chain ends, as a table or as JSON (`--format json`).",
    },
    { run: "bun run test:node", does: "Runs the suite under Node 26." },
    {
      run: "bun quality/quality.ts record|verify|render",
      does: "Keeps the record of a run on the append-only quality branch (a file, a signed commit, a note on the tested commit), verifies the branch and its chain, and renders a record as JUnit, CTRF, SARIF, TAP or the 29119-3 documents.",
    },
    {
      run: "bun quality/quality.ts trust|pack|verify-pack|plan|sample|mutation|agents",
      does: "Tier 2 of the quality system: writes the Trust page for an audience (public, assessor, internal) and checks it, writes the signed assessor pack and verifies one offline (the verifier is inside the pack), registers a test plan before its run, draws a sample by a seed and records a person's attestation of it, records a mutation report and shows the strength of each proof beside its grade, and judges the sampling of the agents' reviews.",
    },
    {
      run: "bun workspaces/ifws.ts <module> (or ifws, the package's bin)",
      does: "The command of IF Workspaces: init, plan, apply, status, doctor, verify, render, worktree, list, help, shell, setup (the one command that installs a pinned tool or changes the host) and tools, each a typed module, and modules registered by the workspace or named ifws-* on the PATH; it manages only Intellectual Frontiers Workspaces and does not front ifc. Exit status 0 ok, 1 findings, 2 usage, 3 environment.",
    },
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
