/**
 * The workflows of this repository, as the typed values the files under `.github/workflows/` are made from (commons 0030-generated-workflows FR-001, FR-005, FR-006): the pins and the steps they share
 * are written once, the workflow of each library of commons is made from its manifest, and the rest are written here as values. Nothing is read from a file but the manifests, and nothing is written.
 *
 * @remarks
 * `workflows(libraries)` gives every workflow, in the order of their files' names; the library workflows come from `libraryWorkflow`, which reads the folder, the name and the `verify` command of a manifest
 * (0027-commons-libraries FR-012) and what else the library's job needs from `LIBRARY_CI`, the facts of CI that a manifest does not hold (a library without a record has the job `verify` and nothing else).
 * The workflows run on the same triggers, with the same jobs and steps and the same names as the hand-written ones they replaced, so that the names of their checks do not change.
 *
 * @limits
 * It does not run a workflow or read one; a library that registers needs no entry of `LIBRARY_CI` unless its CI is more than `verify`.
 *
 * @module
 */
import { type CompositeAction, expr, job, run, type Step, use, type Workflow } from "./model.ts";

/** The versions the workflows pin (FR-005): each once. */
export const PIN = {
  checkout: "actions/checkout@v4",
  setupNode: "actions/setup-node@v4",
  cache: "actions/cache@v4",
  uploadArtifact: "actions/upload-artifact@v4",
  downloadArtifact: "actions/download-artifact@v4",
  uploadPages: "actions/upload-pages-artifact@v3",
  deployPages: "actions/deploy-pages@v4",
  bun: "./.github/actions/bun",
} as const;

/** The Node that is the backup runtime (commons 0005-typescript-runtime). */
export const NODE_VERSION = "26.13.1";
/** The canary of Bun that runs the linter until a release does (FR-028 of 0005-typescript-runtime). */
export const BUN_LINT_VERSION = "1.4.4-canary.20261115.1";

const checkout = (o: { readonly fetchDepth?: number; readonly comment?: string } = {}): Step =>
  use(PIN.checkout, {
    ...(o.fetchDepth === undefined ? {} : { with: { "fetch-depth": o.fetchDepth } }),
    ...(o.comment === undefined ? {} : { comment: o.comment }),
  });
const bun = (o: { readonly nodeVersion?: string } = {}): Step =>
  use(PIN.bun, o.nodeVersion === undefined ? {} : { with: { "node-version": o.nodeVersion } });
const setupNode = (when?: string): Step =>
  use(PIN.setupNode, { ...(when === undefined ? {} : { when }), with: { "node-version": expr("env.NODE_VERSION") } });
const tools = (workingDirectory: string, name = "The development tools, from bun.lock"): Step =>
  run("bun install --frozen-lockfile", { name, workingDirectory });

/**
 * A run that a newer push to the same branch replaces is stopped, except on main, where each commit keeps its own result.
 */
const supersedable = {
  group: `${expr("github.workflow")}-${expr("github.ref")}`,
  cancelInProgress: expr("github.ref != 'refs/heads/main'"),
} as const;

/** A script from its lines, ending with a newline as a literal block does. */
const lines = (...l: readonly string[]): string => `${l.join("\n")}\n`;

/** The files a workflow of this repository runs on a change of (a push and a pull request alike). */
const BUN_ACTION = ".github/actions/bun/**";
const own = (file: string): string => `.github/workflows/${file}.auto.yml`;

/** What a library's manifest gives its workflow (0027-commons-libraries FR-012): the folder's name, the command that proves it and the paths it reads. Another module's `Library` has more, and is accepted as it is. */
export type LibraryFacts = {
  readonly name: string;
  readonly verify: string;
  /** The paths whose change affects it, which the library's workflow runs on (0027-commons-libraries FR-022). */
  readonly paths: readonly string[];
  /** Where it is published (0027-commons-libraries FR-015 to FR-017): the registries, `github` and, where a decision says so, `npm`. */
  readonly distribution: readonly string[];
};

/** What a library's CI needs that its manifest does not say. */
export type LibraryCi = {
  /** The paragraph written under the workflow's name. */
  readonly comment: string;
  /** The steps after `verify`, in the job `verify`. */
  readonly afterVerify?: readonly Step[];
  /** The command that runs the tests on Node 26, the backup runtime, in a job of its own. */
  readonly nodeTests?: string;
  /** The systems the library's jobs run on, in order of their importance to it; the first only (Linux) where it names none. */
  readonly systems?: readonly ("windows-latest" | "macos-latest" | "ubuntu-latest")[];
};

/** The facts of CI of the libraries that have more than `verify`, by the library's name. */
export const LIBRARY_CI: Readonly<Record<string, LibraryCi>> = {
  data: {
    comment: lines(
      "IFC data, an independent library of commons (commons 0027-commons-libraries FR-010): its own `verify` (the compiler, the specification checker and the rules on its own",
      "spec kit, and its tests) on Bun, and its tests on Node 26, the backup runtime (commons 0005-typescript-runtime). It runs when its folder changes or what it imports does:",
      "the kernel and the runtime, the specification tools, and the Bun action.",
    ).trimEnd(),
    afterVerify: [
      run("bun tools/generate-dpv.ts --check", {
        name: "The terms of DPV, as the vocabulary's CSV makes them (a fetch, so not in verify)",
        workingDirectory: "commons/data",
      }),
    ],
    nodeTests: 'node --test "suite/**/*.test.ts"',
  },
  core: {
    comment: lines(
      "Core, the foundation of commons, the first library lifted out of `commons/ts` (commons 0032-lifting-libraries): its own `verify` (the compiler, the specification checker, the trace, its tests and the packing of its",
      "package with the inspection of its declarations) on Bun and its tests on Node 26, on Windows, macOS and Linux, because the package runs on all three.",
    ).trimEnd(),
    nodeTests: 'node --test "suite/**/*.test.ts"',
    systems: ["windows-latest", "macos-latest", "ubuntu-latest"],
  },
  rdf: {
    comment: lines(
      "RDF, typed RDF and its writers, a library lifted out of `commons/ts` (commons 0032-lifting-libraries): its own `verify` (the compiler, the specification checker, the trace, its tests and the",
      "package with the inspection of its declarations) on Bun and its tests on Node 26, on Windows, macOS and Linux, because the package runs on all three.",
    ).trimEnd(),
    nodeTests: 'node --test "suite/**/*.test.ts"',
    systems: ["windows-latest", "macos-latest", "ubuntu-latest"],
  },
  terminal: {
    comment: lines(
      "Terminal, the command line and the console as pure code, a library lifted out of `commons/ts` (commons 0032-lifting-libraries): its own `verify` (the compiler, the specification checker, the trace, its tests and the",
      "package with the inspection of its declarations) on Bun and its tests on Node 26, on Windows, macOS and Linux, because the package runs on all three.",
    ).trimEnd(),
    nodeTests: 'node --test "suite/**/*.test.ts"',
    systems: ["windows-latest", "macos-latest", "ubuntu-latest"],
  },
  ergonex: {
    comment: lines(
      "Ergonex, the workspaces management of Intellectual Frontiers, a library of commons (commons 0027-commons-libraries FR-010): its own `verify` on Bun and its tests on Node 26, the backup runtime,",
      "on Windows first, then macOS and Linux (ergonex 0004-onboarding): a person on any of them installs the command from npm and runs it.",
    ).trimEnd(),
    nodeTests: 'node --test "suite/**/*.test.ts"',
    systems: ["windows-latest", "macos-latest", "ubuntu-latest"],
  },
};

/** The workflow of a library of commons, made from its manifest (FR-006): its `verify` on Bun when its folder or what it imports changes, and its tests on Node where its record says so. */
export function libraryWorkflow(l: LibraryFacts): Workflow {
  const folder = `commons/${l.name}`;
  const ci = LIBRARY_CI[l.name];
  const paths = l.paths;
  const systems = ci?.systems;
  const onSystems =
    systems === undefined
      ? { runsOn: "ubuntu-latest" as const }
      : { runsOn: expr("matrix.os"), strategy: { failFast: false, matrix: { os: systems } } };
  const verify = job({
    ...onSystems,
    timeoutMinutes: 15,
    steps: [
      checkout(),
      bun(),
      tools(folder, "The development tools, from bun.lock (the kernel is linked from commons/ts)"),
      run(l.verify, { name: "verify", workingDirectory: folder }),
      ...(ci?.afterVerify ?? []),
    ],
  });
  const node =
    ci?.nodeTests === undefined
      ? {}
      : {
          node: job({
            ...onSystems,
            timeoutMinutes: 15,
            steps: [
              checkout(),
              bun(),
              setupNode(),
              tools(folder),
              run(ci.nodeTests, { name: "The tests on Node 26", workingDirectory: folder }),
            ],
          }),
        };
  return {
    file: l.name,
    name: l.name,
    ...(ci === undefined ? {} : { comment: ci.comment }),
    on: { push: { paths }, pullRequest: { paths } },
    permissions: { contents: "read" },
    env: { NODE_VERSION },
    concurrency: supersedable,
    jobs: { verify, ...node },
  };
}

const ifcTypescriptPaths = [
  "commons/ts/**",
  "commons/docs/**",
  "commons/generated/pins.auto.env",
  "package.json",
  "bun.lock",
  BUN_ACTION,
  own("ifc-typescript"),
];

const ifcTypescript: Workflow = {
  file: "ifc-typescript",
  name: "ifc-typescript",
  comment: lines(
    "IFC TypeScript (commons 0005-typescript-runtime FR-017, FR-018, FR-026 to FR-030, FR-070). TypeScript 7 checks; Bun, pinned in commons' pins, installs, formats",
    "and lints; the same tests run unchanged on Bun, the default runtime, and Node 26, the backup, on Linux, macOS and Windows; and the commit is installed as a Git dependency of an empty project,",
    "as a consumer installs it, and used there on Bun and Node 26 (through the hook), IFC Docs too (0011-documentation FR-021, FR-022). Nothing is released.",
  ).trimEnd(),
  on: { push: { paths: ifcTypescriptPaths }, pullRequest: { paths: ifcTypescriptPaths } },
  permissions: { contents: "read" },
  env: { NODE_VERSION, BUN_LINT_VERSION },
  concurrency: supersedable,
  jobs: {
    check: job({
      runsOn: "ubuntu-latest",
      timeoutMinutes: 10,
      steps: [
        checkout(),
        bun(),
        tools("commons/ts"),
        run("bun x tsc --version && bun run check", {
          name: "TypeScript 7 on everything, then the kernel with no host types",
          workingDirectory: "commons/ts",
        }),
        run("bun fmt --check", { name: "The formatter", workingDirectory: "commons/ts" }),
        run('bun x "bun@$BUN_LINT_VERSION" lint --type-aware --max-warnings 0 kernel runtime lint tests tools', {
          name: "The linter, type-aware, no warning allowed",
          workingDirectory: "commons/ts",
        }),
      ],
    }),
    test: job({
      runsOn: expr("matrix.os"),
      timeoutMinutes: 15,
      strategy: { failFast: false, matrix: { os: ["ubuntu-latest", "macos-latest", "windows-latest"], runtime: ["bun", "node"] } },
      steps: [
        checkout(),
        bun(),
        tools("commons/ts"),
        setupNode("matrix.runtime == 'node'"),
        run('bun x "bun@$BUN_LINT_VERSION" --version', {
          name: "The linter's canary, so the lint plugin's tests run rather than skip",
          shell: "bash",
        }),
        run(
          lines(
            `grep -E '^000[5-8]-' ../spec-kit/enforcement.tsv >"$RUNNER_TEMP/requirements.tsv"`,
            "bun tools/test.ts run --runtime ${{ matrix.runtime }} --out test-results \\",
            "  --report tap,junit,ctrf,sarif,md,html,oscal \\",
            '  --requirements "$RUNNER_TEMP/requirements.tsv" --reviewed ci-reviewed.tsv \\',
            "  --ledger test-results/ledger.jsonl tests",
          ),
          {
            name: "The suite on ${{ matrix.runtime }}, recorded as evidence (commons 0008-test-evidence FR-014)",
            comment: "A hang ends here, so the record of what ran is still kept below.",
            timeoutMinutes: 10,
            workingDirectory: "commons/ts",
            shell: "bash",
          },
        ),
        use(PIN.uploadArtifact, {
          name: "The record, its reports and the ledger, kept with the run",
          when: "always()",
          with: {
            name: "test-evidence-${{ matrix.os }}-${{ matrix.runtime }}",
            path: "commons/ts/test-results/",
            "if-no-files-found": "error",
          },
        }),
      ],
    }),
    "otel-conformance": job({
      comment:
        "commons 0006-signals FR-020: the suite's OTLP sent to the pinned OpenTelemetry Collector, read back from its file exporter.",
      runsOn: "ubuntu-latest",
      timeoutMinutes: 10,
      steps: [
        checkout(),
        bun(),
        tools("commons/ts"),
        run(
          lines(
            "v=$(sed -n 's/^OTELCOL_CONTRIB_VERSION=//p' commons/generated/pins.auto.env)",
            "sum=$(sed -n 's/^OTELCOL_CONTRIB_SHA256_X86_64=//p' commons/generated/pins.auto.env)",
            'dir="$RUNNER_TEMP/otelcol"',
            'mkdir -p "$dir"',
            'curl -fsSL -o "$dir/otelcol.tar.gz" "https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v$v/otelcol-contrib_${v}_linux_amd64.tar.gz"',
            'echo "$sum  $dir/otelcol.tar.gz" | sha256sum -c -',
            'tar -xzf "$dir/otelcol.tar.gz" -C "$dir" otelcol-contrib',
            'echo "IFC_OTELCOL=$dir/otelcol-contrib" >>"$GITHUB_ENV"',
          ),
          { name: "The OpenTelemetry Collector, verified against commons' pins", shell: "bash" },
        ),
        run(lines("bun test tests/runtime/otel-conformance.test.ts", "node --test tests/runtime/otel-conformance.test.ts"), {
          name: "The conformance test, on Bun and on Node",
          workingDirectory: "commons/ts",
        }),
      ],
    }),
    compile: job({
      comment:
        "commons 0005-typescript-runtime FR-062: a program built into one binary by the pinned Bun on each system, then run; and Windows built from Linux.",
      runsOn: expr("matrix.os"),
      timeoutMinutes: 10,
      strategy: { failFast: false, matrix: { os: ["ubuntu-latest", "macos-latest", "windows-latest"] } },
      steps: [
        checkout(),
        bun(),
        tools("commons/ts"),
        run("bun test tests/runtime/compile.test.ts", {
          name: "Built for this computer, with an embedded file, and run",
          workingDirectory: "commons/ts",
          shell: "bash",
        }),
        run(
          lines(
            "v=$(sed -n 's/^BUN_VERSION=//p' ../generated/pins.auto.env)",
            'mkdir -p "$RUNNER_TEMP/cross"',
            `printf 'console.log("ok");\\n' >"$RUNNER_TEMP/cross/hello.ts"`,
            "bun -e '",
            '  import { compile, describeCompileError } from "./runtime/compile.ts";',
            '  const r = await compile({ entry: process.argv[1], outfile: process.argv[2], target: "windows-x64", bunVersion: process.argv[3] });',
            '  if (r.kind === "err") { console.error(describeCompileError(r.error)); process.exit(1); }',
            "  console.log(r.value.path, r.value.sha256);",
            `' "$RUNNER_TEMP/cross/hello.ts" "$RUNNER_TEMP/cross/hello" "$v"`,
            'test -f "$RUNNER_TEMP/cross/hello.exe"',
          ),
          {
            name: "Built for Windows from Linux, by the pinned Bun alone",
            when: "runner.os == 'Linux'",
            workingDirectory: "commons/ts",
            shell: "bash",
          },
        ),
      ],
    }),
    "git-dependency": job({
      comment: lines(
        "commons 0005-typescript-runtime FR-030 and 0011-documentation FR-022: the commit checked, installed into an empty project by a",
        "git+file: URL of this checkout, as a consumer installs it by github:intellectual-frontiers/.github#<commit>, and used there.",
      ).trimEnd(),
      runsOn: expr("matrix.os"),
      timeoutMinutes: 15,
      strategy: { failFast: false, matrix: { os: ["ubuntu-latest", "macos-latest", "windows-latest"] } },
      steps: [
        checkout({
          fetchDepth: 0,
          comment: "Bun clones the checkout as a Git repository; a whole one, so that nothing depends on how a shallow clone is cloned.",
        }),
        bun({ nodeVersion: expr("env.NODE_VERSION") }),
        run("bun install --frozen-lockfile", {
          name: "The root package's lockfile, which the consumer does not read but this repository keeps",
        }),
        run(
          lines("bun install --frozen-lockfile", "node --version", 'bun tools/smoke.ts --repo "$GITHUB_WORKSPACE" --commit "$GITHUB_SHA"'),
          {
            name: "IFC TypeScript as a Git dependency, on Bun and Node 26, with ifc test and tsc 7",
            workingDirectory: "commons/ts",
            shell: "bash",
          },
        ),
        run(lines("bun install --frozen-lockfile", 'bun tools/smoke.ts --repo "$GITHUB_WORKSPACE" --commit "$GITHUB_SHA"'), {
          name: "IFC Docs as a Git dependency, ifc-docs check and build on a fixture repository on Bun and Node 26",
          workingDirectory: "commons/docs",
          shell: "bash",
        }),
      ],
    }),
  },
};

const sqlAidePaths = ["commons/ts/**", "commons/spec-kit/**", own("sql-aide"), BUN_ACTION];

const sqlAide: Workflow = {
  file: "sql-aide",
  name: "sql-aide",
  comment: lines(
    "IFC SQL Aide and the libraries that accept it, Arca and Data Vault (commons 0009-sql-aide): checked by the TypeScript 7 compiler and tested under Bun and under",
    "Node, on SQLite, DuckDB, PGlite and a PostgreSQL server that exists only for this run (the runner's own, with pgTAP; its password is the runner's and guards",
    "nothing). The formatter is run on all of commons/ts by ifc-typescript.",
  ).trimEnd(),
  on: { push: { paths: sqlAidePaths }, pullRequest: { paths: sqlAidePaths } },
  permissions: { contents: "read" },
  concurrency: supersedable,
  jobs: {
    data: job({
      runsOn: "ubuntu-24.04",
      timeoutMinutes: 20,
      steps: [
        checkout(),
        bun(),
        run(
          lines(
            "sudo apt-get update -qq && sudo apt-get install -y -qq postgresql postgresql-16-pgtap",
            "sudo systemctl start postgresql",
            `sudo -u postgres psql -qc "alter user postgres password 'postgres'"`,
            'echo "IFCSQL_PG_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres" >>"$GITHUB_ENV"',
          ),
          { name: "A PostgreSQL for the run, with pgTAP" },
        ),
        run(
          lines(
            "sqlite3 --version",
            'curl --fail --silent --show-error --location --retry 3 -o "$RUNNER_TEMP/duckdb.tar.gz" https://install.duckdb.org/v2.0.0/duckdb-cli-linux-amd64.tar.gz',
            'echo "c6507206baf7793c6013dbd82368469a45f20dc0e17a6f92f204602f652ed2bc  $RUNNER_TEMP/duckdb.tar.gz" | sha256sum --check',
            'mkdir -p "$RUNNER_TEMP/duckdb" && tar -xzf "$RUNNER_TEMP/duckdb.tar.gz" -C "$RUNNER_TEMP/duckdb"',
            'echo "$RUNNER_TEMP/duckdb" >>"$GITHUB_PATH"',
          ),
          {
            name: "The engines' own clients, for the databases made from .auto.sql (sqlite3 is the runner's; the duckdb client is pinned and checked)",
          },
        ),
        run(lines("bun install --frozen-lockfile", "cd data && bun install --frozen-lockfile"), {
          name: "What IFC TypeScript and the data libraries install for checking and testing",
          workingDirectory: "commons/ts",
        }),
        run("bun run verify", {
          name: "The TypeScript 7 compiler, the documentation maps, then every test under Bun",
          workingDirectory: "commons/ts/data",
        }),
        run("bun run test:node", { name: "The same tests under Node", workingDirectory: "commons/ts/data" }),
      ],
    }),
  },
};

const docsPaths = ["commons/**", "package.json", own("docs"), BUN_ACTION];
const onMainPush = "github.event_name != 'pull_request' && github.ref == 'refs/heads/main'";

const docs: Workflow = {
  file: "docs",
  name: "docs",
  comment: lines(
    "The documentation site of commons (commons 0011-documentation FR-020): made by commons/docs, from commons' TypeScript and spec kit alone,",
    "as commons' configuration (commons/docs.config.ts) says. Every pull request and push that touches commons tests the generator and checks",
    "the site (no finding, every link and anchor resolves); a push to main builds the site and publishes it to GitHub Pages with GitHub's own",
    "actions. The site is never committed.",
  ).trimEnd(),
  on: { push: { paths: docsPaths }, pullRequest: { paths: docsPaths }, workflowDispatch: true },
  permissions: { contents: "read" },
  concurrency: { group: "docs-${{ github.ref }}", cancelInProgress: true },
  jobs: {
    check: job({
      runsOn: "ubuntu-24.04",
      timeoutMinutes: 15,
      steps: [
        checkout(),
        bun(),
        tools(
          "commons/docs",
          "TypeScript 7.1 (beta), Mermaid and @types/node, exactly as bun.lock pins them (IFC TypeScript is ../ts, by relative path)",
        ),
        run("bun run verify", { name: "The compiler, the generator's tests, then check on commons", workingDirectory: "commons/docs" }),
        run('bun main.ts build --out "$GITHUB_WORKSPACE/_site"', {
          name: "The site, built",
          when: onMainPush,
          workingDirectory: "commons/docs",
        }),
        use(PIN.uploadPages, { name: "The site, kept for Pages", when: onMainPush, with: { path: "_site" } }),
      ],
    }),
    publish: job({
      needs: ["check"],
      when: onMainPush,
      runsOn: "ubuntu-24.04",
      timeoutMinutes: 10,
      permissions: { pages: "write", "id-token": "write" },
      environment: { name: "github-pages", url: "${{ steps.deployment.outputs.page_url }}" },
      steps: [use(PIN.deployPages, { name: "Published to GitHub Pages", id: "deployment" })],
    }),
  },
};

const checkScripts = (shellOnly: boolean): readonly string[] => {
  const common = [
    "commons/tools/generate-packaging.ts --check",
    "commons/tools/mizan-check.ts",
    "commons/ts/mizan/generate-ontology.ts --check",
    "commons/ts/mizan/check.ts",
  ];
  const more = [
    "commons/ts/mizan/libraries.ts --check",
    "commons/ts/tools/generate-workflows.ts --check",
    "commons/ts/mizan/versions.ts check",
    "commons/ts/mizan/versions.ts ledger",
    "commons/ts/mizan/integrations/host/import.ts commons/ts/mizan/imports/schema-org.import.ts --check --fetch",
    "commons/ts/mizan/integrations/host/import.ts commons/ts/mizan/imports/nist-sp-800-53.import.ts --check --fetch",
  ];
  const all = shellOnly ? common : [...common, ...more];
  return [...all.map((c) => `bun ${c}`), ...all.map((c) => `node ${c}`)];
};

const tests: Workflow = {
  file: "tests",
  name: "tests",
  comment: lines(
    "The tests of the repository's own files (`tests/`: the one-command installers of agora, commons' packaging tools and specification checker, the layout of the repository),",
    "on IFC TypeScript: Bun, the default runtime, and Node 26, the backup. Bun comes at the version commons pins (the `.github/actions/bun` action), Node 26 from",
    "`actions/setup-node`. The tests run the real programs (real `sh`, real `git`, the real tools), never stand-ins; GitHub CLI's sign-in needs an account and a browser,",
    "and is not run.",
  ).trimEnd(),
  on: { push: { branches: ["main"] }, pullRequest: {} },
  permissions: { contents: "read" },
  env: { NODE_VERSION, BUN_LINT_VERSION },
  concurrency: supersedable,
  jobs: {
    check: job({
      runsOn: "ubuntu-latest",
      timeoutMinutes: 15,
      steps: [
        checkout({
          fetchDepth: 0,
          comment:
            "the whole history and its tags: `versions check` compares each work with the merge base, and its ledger reads the tags (commons 0026-works-versioning FR-022, FR-035)",
        }),
        bun(),
        tools("commons/ts"),
        run("bun run check", { name: "TypeScript 7 on commons' tools and on these tests", workingDirectory: "commons/ts" }),
        run("bun fmt --check . ../tools ../../tests", { name: "The formatter", workingDirectory: "commons/ts" }),
        run(
          'bun x "bun@$BUN_LINT_VERSION" lint --type-aware --max-warnings 0 ../tools ../../tests mizan ../ontology/mizan ../ontology/audit',
          {
            name: "The linter, type-aware, no warning allowed",
            workingDirectory: "commons/ts",
          },
        ),
        run(lines(...checkScripts(false)), {
          name: "Commons' generated files and specifications, as a person checks them, on Bun and on Node 26",
        }),
      ],
    }),
    tests: job({
      runsOn: expr("matrix.os"),
      timeoutMinutes: 15,
      strategy: { failFast: false, matrix: { os: ["ubuntu-latest", "macos-latest"], runtime: ["bun", "node"] } },
      steps: [
        checkout(),
        bun(),
        tools("commons/ts"),
        run("sudo apt-get update -qq && sudo apt-get install -y -qq shellcheck", {
          name: "ShellCheck, which the packaging test uses where it is installed",
          when: "runner.os == 'Linux'",
        }),
        run(
          lines(
            'python3 -m venv "$RUNNER_TEMP/venv"',
            '"$RUNNER_TEMP/venv/bin/pip" install -q rdflib==7.6.0 pyshacl==0.40.2 jsonschema==4.26.0 pyyaml==6.0.3',
            'echo "$RUNNER_TEMP/venv/bin" >> "$GITHUB_PATH"',
          ),
          {
            name: "Independent validators of the exports (rdflib, pySHACL, jsonschema), which the Mizan test uses where they are installed",
          },
        ),
        run("bun test ./tests/", { name: "The tests on Bun", when: "matrix.runtime == 'bun'" }),
        run('node --test "tests/*.test.ts"', { name: "The tests on Node 26", when: "matrix.runtime == 'node'" }),
      ],
    }),
    windows: job({
      comment: lines(
        "Windows: what has no shell in it. The generator and the specification checker run on both runtimes; the installers' tests need a POSIX `sh` and a Unix PATH, and",
        "`agora-install.ps1` is read by its test on the other systems and is not run by any test (it needs a sign-in to GitHub).",
      ).trimEnd(),
      runsOn: "windows-latest",
      timeoutMinutes: 15,
      steps: [
        checkout(),
        bun(),
        run(lines(...checkScripts(true)), { name: "Commons' generated files and specifications, on Bun and on Node 26", shell: "bash" }),
      ],
    }),
    robot: job({
      comment: lines(
        "ROBOT (the OBO Foundry's ontology tool) reads the generated OWL as a second, independent OWL reader and reports its quality; it must read it, convert it and find it",
        "consistent, and its report must have no error. The jar is pinned by version and SHA-256.",
      ).trimEnd(),
      runsOn: "ubuntu-latest",
      timeoutMinutes: 10,
      env: { ROBOT_VERSION: "1.9.11", ROBOT_SHA256: "53cd275c8e4c0dad1fc2c1c34174876795cd7d6b6926e1444adcbb0cb3c7ab26" },
      steps: [
        checkout(),
        run(
          lines(
            'curl -fsSL -o "$RUNNER_TEMP/robot.jar" "https://github.com/ontodev/robot/releases/download/v${ROBOT_VERSION}/robot.jar"',
            'echo "${ROBOT_SHA256}  $RUNNER_TEMP/robot.jar" | sha256sum -c -',
          ),
          { name: "ROBOT, pinned" },
        ),
        run(
          lines(
            "for n in mizan ifccm ifqs ifr; do",
            '  java -jar "$RUNNER_TEMP/robot.jar" convert --input "commons/generated/$n.auto.ofn" --format owl --output "$RUNNER_TEMP/$n.owl"',
            '  java -jar "$RUNNER_TEMP/robot.jar" convert --input "commons/generated/$n.auto.ttl" --format ofn --output "$RUNNER_TEMP/$n-from-ttl.ofn"',
            '  java -jar "$RUNNER_TEMP/robot.jar" reason --reasoner ELK --input "commons/generated/$n.auto.ofn"',
            '  java -jar "$RUNNER_TEMP/robot.jar" report --input "commons/generated/$n.auto.ofn" --fail-on ERROR --output "$RUNNER_TEMP/$n-report.tsv"',
            "done",
          ),
          { name: "Convert, reason and report, for each ontology" },
        ),
      ],
    }),
  },
};

/** Reads the name and version of the tarball in the working folder and says on the step's output whether that version is already on the registry (a re-run, or a first publish made by hand, never fails on a duplicate). */
const HAVE = (registry: string): string =>
  lines(
    `pkg=$(tar -xzOf ./*.tgz package/package.json)`,
    `name=$(printf '%s' "$pkg" | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).name")`,
    `version=$(printf '%s' "$pkg" | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).version")`,
    `if npm view "$name@$version" version${registry} >/dev/null 2>&1; then`,
    '  echo "$name@$version is already there"',
    '  echo "have=true" >> "$GITHUB_OUTPUT"',
    "else",
    '  echo "have=false" >> "$GITHUB_OUTPUT"',
    "fi",
  );
const HAVE_NPM = HAVE("");
const HAVE_GITHUB = HAVE(" --registry https://npm.pkg.github.com");

/**
 * The workflow that publishes a library to the registries its manifest names (0030-generated-workflows FR-009): on a tag `<name>-v<version>` it checks the tag is the version, proves the library, packs it
 * with its `tools/pack.ts` and sends the tarball to npm, with provenance and no token (npm's trusted publishing), and to the GitHub package registry with the workflow's own token.
 */
export function publishWorkflow(l: LibraryFacts): Workflow {
  const folder = `commons/${l.name}`;
  const tarball = 'npm publish "$(ls ./*.tgz)"';
  const sendNpm = l.distribution.includes("npm");
  return {
    file: `${l.name}-publish`,
    name: `${l.name}-publish`,
    comment: lines(
      `Publishes ${l.name} (commons 0027-commons-libraries FR-015, FR-016): a tag \`${l.name}-v<version>\` (made by \`versions tag\`, commons 0026-works-versioning), or a run by hand from main, is checked against the package's version, the library is proved and packed by its own`,
      "tools/pack.ts, and the tarball goes to the registries its manifest names: npm with provenance and no token (trusted publishing, which the owner of the npm scope sets up once for this workflow's file), and",
      "the GitHub package registry with this workflow's own token.",
    ).trimEnd(),
    on: { push: { tags: [`${l.name}-v*`] }, workflowDispatch: true },
    permissions: { contents: "read" },
    jobs: {
      build: job({
        runsOn: "ubuntu-latest",
        timeoutMinutes: 15,
        steps: [
          checkout(),
          bun(),
          setupNode(),
          tools(folder),
          run(
            lines(
              `version=$(node -p "require('./package.json').version")`,
              `if [ "$GITHUB_REF_TYPE" = tag ]; then`,
              `  test "$GITHUB_REF_NAME" = "${l.name}-v$version" || { echo "the tag $GITHUB_REF_NAME is not ${l.name}-v$version"; exit 1; }`,
              `else`,
              `  test "$GITHUB_REF" = refs/heads/main || { echo "a run by hand publishes only from main, not $GITHUB_REF"; exit 1; }`,
              `fi`,
            ),
            {
              name: "The tag, or main for a run by hand, is the version of the package",
              workingDirectory: folder,
              shell: "bash",
            },
          ),
          run("bun run verify", { name: "verify", workingDirectory: folder }),
          run("bun tools/pack.ts", { name: "The package that is published", workingDirectory: folder }),
          use(PIN.uploadArtifact, {
            name: "The tarball, kept for the jobs that publish it",
            with: { name: `${l.name}-package`, path: `${folder}/dist/*.tgz`, "if-no-files-found": "error" },
          }),
        ],
      }),
      ...(sendNpm
        ? {
            "publish-npm": job({
              needs: ["build"],
              runsOn: "ubuntu-latest",
              timeoutMinutes: 10,
              permissions: { contents: "read", "id-token": "write" },
              environment: { name: "npm" },
              steps: [
                use(PIN.downloadArtifact, { name: "The tarball", with: { name: `${l.name}-package`, path: "package" } }),
                use(PIN.setupNode, { with: { "node-version": expr("env.NODE_VERSION"), "registry-url": "https://registry.npmjs.org" } }),
                run(HAVE_NPM, {
                  name: "Is the version already on npm (published by hand, or by an earlier run)?",
                  id: "have",
                  shell: "bash",
                  workingDirectory: "package",
                }),
                run(tarball + " --access public --provenance", {
                  name: "Published to npm, with provenance and no token",
                  when: "steps.have.outputs.have != 'true'",
                  workingDirectory: "package",
                  shell: "bash",
                }),
              ],
            }),
          }
        : {}),
      "publish-github": job({
        needs: ["build"],
        runsOn: "ubuntu-latest",
        timeoutMinutes: 10,
        permissions: { contents: "read", packages: "write" },
        steps: [
          use(PIN.downloadArtifact, { name: "The tarball", with: { name: `${l.name}-package`, path: "package" } }),
          use(PIN.setupNode, {
            with: {
              "node-version": expr("env.NODE_VERSION"),
              "registry-url": "https://npm.pkg.github.com",
              scope: "@intellectual-frontiers",
            },
          }),
          run(HAVE_GITHUB, {
            name: "Is the version already on the GitHub package registry?",
            id: "have",
            shell: "bash",
            workingDirectory: "package",
            env: { NODE_AUTH_TOKEN: expr("secrets.GITHUB_TOKEN") },
          }),
          run(tarball, {
            name: "Published to the GitHub package registry",
            when: "steps.have.outputs.have != 'true'",
            workingDirectory: "package",
            shell: "bash",
            env: { NODE_AUTH_TOKEN: expr("secrets.GITHUB_TOKEN") },
          }),
        ],
      }),
      // a run by hand from main makes the tag that a push of one would have, where the runner's token may and a person's sandbox may not; it tags a version that is on its registry,
      // however it got there (this workflow's jobs, or a person's first publish of a package that has no trusted publisher yet), and never fails on a tag that is there
      tag: job({
        needs: ["build", ...(sendNpm ? ["publish-npm"] : []), "publish-github"],
        when: "always() && needs.build.result == 'success' && github.ref_type == 'branch'",
        runsOn: "ubuntu-latest",
        timeoutMinutes: 5,
        permissions: { contents: "write" },
        steps: [
          checkout(),
          use(PIN.setupNode, {
            with: {
              "node-version": expr("env.NODE_VERSION"),
              ...(sendNpm ? {} : { "registry-url": "https://npm.pkg.github.com", scope: "@intellectual-frontiers" }),
            },
          }),
          run(
            lines(
              `version=$(node -p "require('./package.json').version")`,
              `tag="${l.name}-v$version"`,
              sendNpm
                ? `npm view "@intellectual-frontiers/${l.name}@$version" version >/dev/null 2>&1 || { echo "$version is not on npm: no tag"; exit 1; }`
                : `npm view "@intellectual-frontiers/${l.name}@$version" version >/dev/null 2>&1 || { echo "$version is not on the GitHub package registry: no tag"; exit 1; }`,
              'if gh api "repos/$GITHUB_REPOSITORY/git/ref/tags/$tag" >/dev/null 2>&1; then',
              '  echo "$tag is already there"',
              "else",
              '  gh api "repos/$GITHUB_REPOSITORY/git/refs" -f "ref=refs/tags/$tag" -f "sha=$GITHUB_SHA"',
              "fi",
            ),
            {
              name: "The tag of the version that is published, made once",
              shell: "bash",
              workingDirectory: folder,
              env: { GH_TOKEN: expr("secrets.GITHUB_TOKEN"), ...(sendNpm ? {} : { NODE_AUTH_TOKEN: expr("secrets.GITHUB_TOKEN") }) },
            },
          ),
        ],
      }),
    },
    env: { NODE_VERSION },
  };
}

/** Every workflow, the libraries'' made from their manifests, in the order of their files' names. */
export function workflows(libraries: readonly LibraryFacts[]): readonly Workflow[] {
  return [
    ...libraries.map(libraryWorkflow),
    ...libraries.filter((l) => l.distribution.includes("npm")).map(publishWorkflow),
    docs,
    ifcTypescript,
    sqlAide,
    tests,
  ].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
}

/** The composite actions of `.github/actions/`: the pinned Bun, which every workflow uses. */
export const ACTIONS: readonly CompositeAction[] = [
  {
    folder: "bun",
    name: "Pinned Bun",
    description:
      "Bun at the version commons pins (commons/generated/pins.auto.env, commons 0005-typescript-runtime FR-026), fetched with retries, kept only where its SHA-256 is the pinned one, unpacked by IFC TypeScript's own zip reader (commons/ts/tools/install-bun.ts, run by Node) and put on the PATH. Linux, macOS and Windows; no shell script, no Python, no unzip.",
    inputs: { "node-version": { description: "The Node that runs the installer.", default: NODE_VERSION } },
    steps: [
      use(PIN.setupNode, { with: { "node-version": expr("inputs.node-version") } }),
      use(PIN.cache, {
        name: "The pinned Bun's download, kept between runs (the installer checks its SHA-256 whatever the cache holds)",
        with: {
          path: `${expr("runner.temp")}/bun/cache`,
          key: `${expr("runner.os")}-${expr("runner.arch")}-bun-${expr("hashFiles('commons/generated/pins.auto.env')")}`,
        },
      }),
      run(
        "node -e \"const fs=require('fs'),p=require('path');fs.mkdirSync('commons/ts/node_modules/@intellectual-frontiers',{recursive:true});const L=['core','rdf','terminal'];for(const n of L)fs.symlinkSync(p.resolve('commons/'+n),'commons/ts/node_modules/@intellectual-frontiers/'+n,'junction');for(const n of L.slice(1)){fs.mkdirSync('commons/'+n+'/node_modules/@intellectual-frontiers',{recursive:true});fs.symlinkSync(p.resolve('commons/core'),'commons/'+n+'/node_modules/@intellectual-frontiers/core','junction')}\"",
        {
          name: "The libraries lifted out of the kernel, linked where the kernel looks for them (the installer runs before any package is installed, and a library's compiler reads the kernel; Bun links them again later)",
          shell: "bash",
        },
      ),
      run('node commons/ts/tools/install-bun.ts "$RUNNER_TEMP/bun"', { name: "Bun, pinned and checked", shell: "bash" }),
    ],
  },
];
