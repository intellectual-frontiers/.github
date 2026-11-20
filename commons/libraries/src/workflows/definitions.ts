/**
 * The workflows of this repository, as the typed values the files under `.github/workflows/` are made from (commons 0030-generated-workflows FR-001, FR-005, FR-006): the pins and the steps they share
 * are written once, the workflow of each library of commons is made from its manifest, and the rest are written here as values. Nothing is read from a file but the manifests, and nothing is written.
 *
 * @remarks
 * `workflows()` gives every workflow, in the order of their files' names; the libraries are proved by one workflow, `ci`, whose plan reads which libraries a change affects and runs a matrix of those (the folder, the
 * name and the `verify` command of a manifest, 0027-commons-libraries FR-012, and what else the library needs from `LIBRARY_CI`, the facts of CI that a manifest does not hold: a library without a record has `verify` on Linux and nothing else).
 *
 * @limits
 * It does not run a workflow or read one; a library that registers needs no entry of `LIBRARY_CI` unless its CI is more than `verify`.
 *
 * Spec: 0001-libraries FR-004
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

/** The Node that is the backup runtime (commons 0005-typescript-practice FR-018). */
export const NODE_VERSION = "26.13.1";
/** The canary of Bun that runs the linter until a release does (commons 0005-typescript-practice FR-028). */
export const BUN_LINT_VERSION = "1.4.4-canary.20261115.1";

const checkout = (o: { readonly fetchDepth?: number; readonly comment?: string } = {}): Step =>
  use(PIN.checkout, {
    ...(o.fetchDepth === undefined ? {} : { with: { "fetch-depth": o.fetchDepth } }),
    ...(o.comment === undefined ? {} : { comment: o.comment }),
  });
const bun = (o: { readonly nodeVersion?: string } = {}): Step =>
  use(PIN.bun, o.nodeVersion === undefined ? {} : { with: { "node-version": o.nodeVersion } });
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

/** The systems other than Linux that a library's CI may ask for: only a library with code of its own for one of them (paths, processes, sockets, scheduled jobs) names it. */
export type OtherSystem = "windows-latest" | "macos-latest";

/** What a library's CI needs that its manifest does not say: Linux and `verify` are for every library, and these are the rest. */
export type LibraryCi = {
  /** The command that runs the tests on Node 26, the backup runtime, in the same job as `verify`. */
  readonly nodeTests?: string;
  /** A command that runs after `verify`, in the same job. */
  readonly after?: string;
  /** The systems besides Linux where `verify` and the tests on Node run too, because the library has code of its own for them. */
  readonly systems?: readonly OtherSystem[];
};

const NODE_TESTS = 'node --test "suite/**/*.test.ts"';
const ALL_OTHER: readonly OtherSystem[] = ["windows-latest", "macos-latest"];
const node: LibraryCi = { nodeTests: NODE_TESTS };

/** The facts of CI of the libraries that have more than `verify` on Linux, by the library's name; a library with no record has `verify` on Linux only. */
export const LIBRARY_CI: Readonly<Record<string, LibraryCi>> = {
  data: { nodeTests: NODE_TESTS, after: "bun tools/generate-dpv.ts --check" },
  core: node,
  rdf: node,
  terminal: node,
  net: { nodeTests: NODE_TESTS, systems: ALL_OTHER },
  grc: node,
  test: node,
  lint: { nodeTests: `bun x bun@${BUN_LINT_VERSION} --version && ${NODE_TESTS}` },
  githost: node,
  ontology: node,
  mizan: node,
  libraries: { nodeTests: NODE_TESTS, systems: ALL_OTHER },
  headless: { nodeTests: NODE_TESTS, systems: ALL_OTHER },
  kanon: node,
  telemetry: node,
  system: { nodeTests: NODE_TESTS, systems: ALL_OTHER },
  formats: node,
  crypto: node,
  quality: node,
  ergonex: { nodeTests: NODE_TESTS, systems: ALL_OTHER },
  "integrations-github": node,
  "integrations-fhir": node,
  "integrations-x12": node,
  integrations: node,
};

/** A cell of the matrix of a job of `ci`: a library, and where it runs where it is not on Linux. */
export type Cell = {
  readonly name: string;
  readonly folder: string;
  readonly verify: string;
  /** The command that runs the tests on Node 26, or the empty string. */
  readonly node: string;
  /** The command that runs after `verify`, or the empty string. */
  readonly after: string;
  /** Whether the packing is checked in this cell: the library changed its `exports` (or the packer changed), or the run is of everything. A push does not pack otherwise; the release does. */
  readonly pack: boolean;
  /** The runner, for a cell that is not on Linux. */
  readonly os?: OtherSystem;
};

/** The cell of a library on a system (`ubuntu-latest`, where it names none), from its manifest and its record of CI; `pack` says whether the packing is checked in it. */
export function cellOf(l: { readonly name: string; readonly folder: string; readonly verify: string }, os?: OtherSystem, pack = false): Cell {
  const ci = LIBRARY_CI[l.name];
  return {
    name: l.name,
    folder: l.folder,
    verify: l.verify,
    pack,
    node: ci?.nodeTests ?? "",
    after: ci?.after ?? "",
    ...(os === undefined ? {} : { os }),
  };
}

/** The paths a push or a pull request is run for by `ci`: the libraries and what they share. What a change affects within them is the plan's to say (0001-libraries FR-012), not a filter's. */
const CI_PATHS = ["commons/**", "package.json", "bun.lock", BUN_ACTION, own("ci")];

/** The steps that prove one library of a cell: install its tools, `verify`, what comes after, and its tests on Node 26. */
const cellSteps = (): readonly [Step, ...Step[]] => [
  checkout(),
  bun(),
  tools(expr("matrix.folder"), "The development tools, from bun.lock (the libraries it imports are linked)"),
  run(expr("matrix.verify"), { name: "verify (its packing is checked where the exports changed, and by the release)", workingDirectory: expr("matrix.folder"), env: { IFC_SKIP_PACK: expr("matrix.pack == false && '1' || ''") } }),
  run(expr("matrix.after"), { name: "After verify", when: "matrix.after != ''", workingDirectory: expr("matrix.folder"), shell: "bash" }),
  run(expr("matrix.node"), { name: "The tests on Node 26", when: "matrix.node != ''", workingDirectory: expr("matrix.folder"), shell: "bash" }),
];

/**
 * The one workflow that proves the libraries (0001-libraries FR-012): a job `plan` asks `plan.ts` which libraries the push or the pull request affects (the code of the `affected` command, from the commit the
 * change starts at), and a matrix of those libraries and nothing else runs `verify` and the tests on Node 26 on Linux. A library whose record says it has code of its own for Windows or macOS runs there too;
 * the others are not run there. The job `ci` is the one result to require: it fails where a job it needs failed, and passes where nothing was affected. A push to main has a group of its own for each commit, so that no commit's
 * run is replaced by a later one: each plan starts at the commit main was at, and a replaced run would leave what it was to prove unproved.
 */
const ci: Workflow = {
  file: "ci",
  name: "ci",
  comment: lines(
    "The libraries of commons (commons 0001-libraries FR-012, 0027-commons-libraries FR-019 to FR-022): one workflow for every library. The job `plan` reads what the push or pull request changed, from the commit it starts at,",
    "and the libraries that change affects (their folders, what they import and what depends on them); `verify` and the tests on Node 26 run for those libraries on Linux, and on Windows and macOS only for the libraries whose",
    "record of CI (`LIBRARY_CI`) names them, because they have code of their own for those systems. Nothing else is run. The job `ci` is the one result to require.",
  ).trimEnd(),
  on: { push: { paths: CI_PATHS }, pullRequest: { paths: CI_PATHS }, workflowDispatch: true, schedule: ["17 3 * * *"] },
  permissions: { contents: "read" },
  env: { NODE_VERSION },
  concurrency: {
    group: `${expr("github.workflow")}-${expr("github.ref == 'refs/heads/main' && github.sha || github.ref")}`,
    cancelInProgress: expr("github.ref != 'refs/heads/main'"),
  },
  jobs: {
    plan: job({
      runsOn: "ubuntu-latest",
      timeoutMinutes: 10,
      outputs: {
        "has-linux": expr("steps.plan.outputs.has-linux"),
        linux: expr("steps.plan.outputs.linux"),
        "has-systems": expr("steps.plan.outputs.has-systems"),
        systems: expr("steps.plan.outputs.systems"),
      },
      steps: [
        checkout({ fetchDepth: 0, comment: "the whole history: the plan compares the head with the commit the change starts at" }),
        bun(),
        run("bun install --frozen-lockfile", { name: "The packages the plan reads, from the root's bun.lock" }),
        run("bun commons/libraries/src/link.ts", { name: "The libraries, linked by name before any of them is imported (the root's packages are old copies from npm)" }),
        run(
          lines(
            "# a pull request starts at its base; a push to main at the commit main was at; any other branch at main, so a push that replaced a run that was stopped still carries what that run was to prove",
            'if [ "$GITHUB_EVENT_NAME" = pull_request ]; then base="${{ github.event.pull_request.base.sha }}"',
            'elif [ "$GITHUB_REF" = refs/heads/main ]; then base="${{ github.event.before }}"',
            "else base=origin/main; fi",
            'case "$base" in ""|0000000000000000000000000000000000000000) base=origin/main ;; esac',
            'if [ "$GITHUB_EVENT_NAME" = workflow_dispatch ] || [ "$GITHUB_EVENT_NAME" = schedule ]; then scope=--all; else scope="--base $base"; fi',
            'bun commons/libraries/src/plan.ts $scope --github-output "$GITHUB_OUTPUT"',
            "# the proof plan of the same change (commons repoctl 0008-repoctl-prove), written to the summary of the run: what a person would run, and why each skipped proof is safe; it gates nothing, the matrices above do",
            "{ echo '### Proof plan'; echo '```'; bun commons/repoctl/src/repoctl.ts prove --tier 6 --why $scope 2>&1 || true; echo '```'; } >> \"$GITHUB_STEP_SUMMARY\"",
          ),
          { name: "The libraries this change affects, and the systems each runs on", id: "plan", shell: "bash" },
        ),
      ],
    }),
    verify: job({
      name: "verify (${{ matrix.name }})",
      needs: ["plan"],
      when: "needs.plan.outputs.has-linux == 'true'",
      runsOn: "ubuntu-latest",
      timeoutMinutes: 20,
      strategy: { failFast: false, matrix: expr("fromJSON(needs.plan.outputs.linux)") },
      steps: cellSteps(),
    }),
    systems: job({
      name: "verify (${{ matrix.name }}, ${{ matrix.os }})",
      needs: ["plan"],
      when: "needs.plan.outputs.has-systems == 'true'",
      runsOn: expr("matrix.os"),
      timeoutMinutes: 20,
      strategy: { failFast: false, matrix: expr("fromJSON(needs.plan.outputs.systems)") },
      steps: cellSteps(),
    }),
    ci: job({
      comment: "The one result to require: every job it needs passed or had nothing to run.",
      needs: ["plan", "verify", "systems"],
      when: "always()",
      runsOn: "ubuntu-latest",
      timeoutMinutes: 5,
      steps: [
        run(
          lines(
            'for r in "${{ needs.plan.result }}" "${{ needs.verify.result }}" "${{ needs.systems.result }}"; do',
            '  case "$r" in success|skipped) ;; *) echo "a job of ci ended $r"; exit 1 ;; esac',
            "done",
          ),
          { name: "No job failed", shell: "bash" },
        ),
      ],
    }),
  },
};

const conformancePaths = ["commons/telemetry/**", "commons/system/**", "commons/generated/pins.auto.env", BUN_ACTION, own("conformance")];

const conformance: Workflow = {
  file: "conformance",
  name: "conformance",
  comment: lines(
    "What a library's own tests cannot run alone: the OTLP of the telemetry library sent to the pinned OpenTelemetry Collector and read back from its file exporter (telemetry 0001-telemetry FR-020),",
    "and a program built into one binary by the pinned Bun on each system, then run, and Windows built from Linux (system 0001-system FR-013). Nothing is released.",
  ).trimEnd(),
  on: { push: { paths: conformancePaths }, pullRequest: { paths: conformancePaths } },
  permissions: { contents: "read" },
  env: { NODE_VERSION },
  concurrency: supersedable,
  jobs: {
    "otel-conformance": job({
      comment:
        "commons 0006-signals FR-020: the suite's OTLP sent to the pinned OpenTelemetry Collector, read back from its file exporter.",
      runsOn: "ubuntu-latest",
      timeoutMinutes: 10,
      steps: [
        checkout(),
        bun(),
        tools("commons/telemetry"),
        run(
          lines(
            "url=$(sed -n 's/^OTELCOL_CONTRIB_URL_X86_64=//p' commons/generated/pins.auto.env)",
            "sum=$(sed -n 's/^OTELCOL_CONTRIB_SHA256_X86_64=//p' commons/generated/pins.auto.env)",
            'dir="$RUNNER_TEMP/otelcol"',
            'mkdir -p "$dir"',
            'curl -fsSL -o "$dir/otelcol.tar.gz" "$url"',
            'echo "$sum  $dir/otelcol.tar.gz" | sha256sum -c -',
            'tar -xzf "$dir/otelcol.tar.gz" -C "$dir" otelcol-contrib',
            'echo "IFC_OTELCOL=$dir/otelcol-contrib" >>"$GITHUB_ENV"',
          ),
          { name: "The OpenTelemetry Collector, verified against commons' pins", shell: "bash" },
        ),
        run(lines("bun test suite/otel-conformance.test.ts", "node --test suite/otel-conformance.test.ts"), {
          name: "The conformance test, on Bun and on Node",
          workingDirectory: "commons/telemetry",
        }),
      ],
    }),
    compile: job({
      comment:
        "commons system 0001-system FR-013: a program built into one binary by the pinned Bun on each system, then run; and Windows built from Linux.",
      runsOn: expr("matrix.os"),
      timeoutMinutes: 10,
      strategy: { failFast: false, matrix: { os: ["ubuntu-latest", "macos-latest", "windows-latest"] } },
      steps: [
        checkout(),
        bun(),
        tools("commons/system"),
        run("bun test suite/compile.test.ts", {
          name: "Built for this computer, with an embedded file, and run",
          workingDirectory: "commons/system",
          shell: "bash",
        }),
        run(
          lines(
            "v=$(sed -n 's/^BUN_VERSION=//p' ../generated/pins.auto.env)",
            'mkdir -p "$RUNNER_TEMP/cross"',
            `printf 'console.log("ok");\\n' >"$RUNNER_TEMP/cross/hello.ts"`,
            "bun -e '",
            '  import { compile, describeCompileError } from "./src/compile.ts";',
            '  const r = await compile({ entry: process.argv[1], outfile: process.argv[2], target: "windows-x64", bunVersion: process.argv[3] });',
            '  if (r.kind === "err") { console.error(describeCompileError(r.error)); process.exit(1); }',
            "  console.log(r.value.path, r.value.sha256);",
            `' "$RUNNER_TEMP/cross/hello.ts" "$RUNNER_TEMP/cross/hello" "$v"`,
            'test -f "$RUNNER_TEMP/cross/hello.exe"',
          ),
          {
            name: "Built for Windows from Linux, by the pinned Bun alone",
            when: "runner.os == 'Linux'",
            workingDirectory: "commons/system",
            shell: "bash",
          },
        ),
      ],
    }),
  },
};

const docsPaths = ["commons/**", "package.json", own("site"), BUN_ACTION];
const onMainPush = "github.event_name != 'pull_request' && github.ref == 'refs/heads/main'";

const site: Workflow = {
  file: "site",
  name: "site",
  comment: lines(
    "The documentation site of commons (commons 0011-documentation FR-020): made by commons/docs, from commons' TypeScript and spec kit alone,",
    "as commons' configuration (commons/docs.config.ts) says. Every pull request and push that touches commons tests the generator and checks",
    "the site (no finding, every link and anchor resolves); a push to main builds the site and publishes it to GitHub Pages with GitHub's own",
    "actions. The site is never committed.",
  ).trimEnd(),
  on: { push: { paths: docsPaths }, pullRequest: { paths: docsPaths }, workflowDispatch: true },
  permissions: { contents: "read" },
  concurrency: { group: "site-${{ github.ref }}", cancelInProgress: true },
  jobs: {
    check: job({
      runsOn: "ubuntu-24.04",
      timeoutMinutes: 15,
      steps: [
        checkout(),
        bun(),
        tools(
          "commons/docs",
          "TypeScript 7.1 (beta), Shiki, beautiful-mermaid and @types/node, exactly as bun.lock pins them",
        ),
        run("bun run verify", { name: "The compiler, the generator's tests, then check on commons", workingDirectory: "commons/docs" }),
        run('bun src/main.ts build --out "$GITHUB_WORKSPACE/_site"', {
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
    "commons/libraries/src/generate-ontology.ts --check",
    "commons/libraries/src/check.ts",
  ];
  const more = [
    "commons/libraries/src/libraries.ts --check",
    "commons/libraries/src/generate-workflows.ts --check",
    "commons/libraries/src/versions.ts check",
    "commons/libraries/src/versions.ts ledger",
    "commons/mizan/src/integrations/host/import.ts commons/libraries/src/imports/schema-org.import.ts --check --fetch",
    "commons/mizan/src/integrations/host/import.ts commons/libraries/src/imports/nist-sp-800-53.import.ts --check --fetch",
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
        tools(".", "The root's development tools, from bun.lock"),
        tools("commons/docs", "The documentation generator's dependencies, which the tests of the root import"),
        run("bun commons/libraries/src/link.ts && bun x tsc -p tests/tsconfig.json && bun x tsc -p commons/tools/tsconfig.json", {
          name: "TypeScript 7 on the tests of the root and on commons' tools",
        }),
        run("bun fmt --check commons/tools tests", { name: "The formatter" }),
        run('bun x "bun@$BUN_LINT_VERSION" lint --type-aware --max-warnings 0 commons/tools tests', {
          name: "The linter, type-aware, no warning allowed",
        }),
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
        tools(".", "The root's development tools, from bun.lock"),
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
        run("bun test ./tests/*.test.ts", {
          name: "The tests on Bun (tests/release/ is the release's: it packs, installs and type-checks every library)",
          when: "matrix.runtime == 'bun'",
        }),
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

/** The folder of a library's package that the release workflow packs: the cell of the matrix, `matrix.folder`. */
const PUBLISH_COMMAND = "bun commons/libraries/src/releasing.ts publish --dir package";

/**
 * The one workflow that releases (0001-libraries FR-014, FR-015): run by hand from main, never by a push. It reads the release record that `release apply` wrote (`commons/generated/release.auto.json`: the libraries
 * whose version is to be published and tagged, in dependency order), proves and packs each of them in a matrix, and, where the run is asked to publish, sends them in that order to npm (trusted publishing with provenance, or
 * the token `INFRO_NPMJS_TOKEN` where the repository has one) and to the GitHub package registry, and makes the tag of each with the runner's token. A run that is not asked to publish stops after the packing.
 */
const release: Workflow = {
  file: "release",
  name: "release",
  comment: lines(
    "The release of the libraries (commons 0001-libraries FR-014, FR-015): by hand, from main, after `bun run release apply` (commons/libraries/src/releasing.ts) has written the versions and the record `commons/generated/release.auto.json` and they are pushed.",
    "`plan` reads the record and leaves out what is tagged; `build` proves and packs each library (`verify`, `tools/pack.ts`); `publish`, where asked, sends the tarballs in dependency order to npm with provenance, by npm's trusted",
    "publishing (the owner sets a trusted publisher once for each package on npmjs.com: this repository, this workflow's file, the environment `npm`) or, where the repository has the secret INFRO_NPMJS_TOKEN, by that token,",
    "and to the GitHub package registry, and makes the tag of each. A version that is on a registry is skipped and a tag that is there is kept, so a run again continues where one stopped.",
  ).trimEnd(),
  on: {
    workflowDispatch: {
      inputs: { publish: { description: "Publish and tag; without it the run only plans, proves and packs", type: "boolean", default: false } },
    },
  },
  permissions: { contents: "read" },
  env: { NODE_VERSION },
  concurrency: { group: "release", cancelInProgress: false },
  jobs: {
    plan: job({
      runsOn: "ubuntu-latest",
      timeoutMinutes: 10,
      outputs: {
        "has-build": expr("steps.plan.outputs.has-build"),
        build: expr("steps.plan.outputs.build"),
        sequence: expr("steps.plan.outputs.sequence"),
      },
      steps: [
        checkout({ fetchDepth: 0, comment: "the whole history and its tags: the plan leaves out what is tagged" }),
        bun(),
        run("bun install --frozen-lockfile", { name: "The packages the plan reads, from the root's bun.lock" }),
        run("bun commons/libraries/src/link.ts", { name: "The libraries, linked by name before any of them is imported (the root's packages are old copies from npm)" }),
        run(
          lines(
            'test "$GITHUB_REF" = refs/heads/main || { echo "a release is made from main, not $GITHUB_REF"; exit 1; }',
            'bun commons/libraries/src/releasing.ts matrix --github-output "$GITHUB_OUTPUT"',
          ),
          { name: "The libraries to release, in dependency order, from the record", id: "plan", shell: "bash" },
        ),
      ],
    }),
    build: job({
      name: "build (${{ matrix.slug }} ${{ matrix.version }})",
      needs: ["plan"],
      when: "needs.plan.outputs.has-build == 'true'",
      runsOn: "ubuntu-latest",
      timeoutMinutes: 20,
      strategy: { failFast: true, matrix: expr("fromJSON(needs.plan.outputs.build)") },
      steps: [
        checkout(),
        bun(),
        tools(expr("matrix.folder")),
        run("bun run verify", { name: "verify, which includes the packing", workingDirectory: expr("matrix.folder") }),
        run("bun tools/pack.ts", { name: "The package that is published", workingDirectory: expr("matrix.folder") }),
        use(PIN.uploadArtifact, {
          name: "The tarball, kept for the job that publishes it",
          with: { name: "package-${{ matrix.slug }}", path: "${{ matrix.folder }}/dist/*.tgz", "if-no-files-found": "error" },
        }),
      ],
    }),
    publish: job({
      needs: ["plan", "build"],
      when: "inputs.publish && needs.plan.outputs.has-build == 'true'",
      runsOn: "ubuntu-latest",
      timeoutMinutes: 60,
      permissions: { contents: "write", "id-token": "write", packages: "write" },
      environment: { name: "npm" },
      steps: [
        checkout({ fetchDepth: 0, comment: "the tags: what is tagged is left out" }),
        bun(),
        run("bun install --frozen-lockfile", { name: "The packages the command reads, from the root's bun.lock" }),
        run("bun commons/libraries/src/link.ts", { name: "The libraries, linked by name before any of them is imported" }),
        use(PIN.setupNode, { with: { "node-version": expr("env.NODE_VERSION"), "registry-url": "https://registry.npmjs.org" } }),
        use(PIN.downloadArtifact, { name: "The tarballs", with: { pattern: "package-*", path: "package" } }),
        run(PUBLISH_COMMAND, {
          name: "Published in dependency order to npm and to the GitHub package registry, and tagged: each release by itself, a version already on npm is only tagged",
          shell: "bash",
          env: {
            NPM_TOKEN: expr("secrets.INFRO_NPMJS_TOKEN"),
            GITHUB_TOKEN: expr("secrets.GITHUB_TOKEN"),
            GH_TOKEN: expr("secrets.GITHUB_TOKEN"),
          },
        }),
      ],
    }),
  },
};

/** Every workflow, the libraries'' made from their manifests, in the order of their files' names. */
export function workflows(): readonly Workflow[] {
  return [
    ci,
    release,
    site,
    conformance,
    tests,
  ].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
}

/** The composite actions of `.github/actions/`: the pinned Bun, which every workflow uses. */
export const ACTIONS: readonly CompositeAction[] = [
  {
    folder: "bun",
    name: "Pinned Bun",
    description:
      "Bun at the version commons pins (commons/generated/pins.auto.env, commons 0005-typescript-practice FR-026), fetched with retries, kept only where its SHA-256 is the pinned one, unpacked by IFC TypeScript's own zip reader (commons/libraries/src/install-bun.ts, run by Node) and put on the PATH. Linux, macOS and Windows; no shell script, no Python, no unzip.",
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
        "node -e \"const fs=require('fs'),p=require('path'),d='commons/node_modules/@intellectual-frontiers';fs.mkdirSync(d,{recursive:true});for(const n of fs.readdirSync('commons')){const f=p.join('commons',n,'package.json');if(fs.existsSync(f)&&JSON.parse(fs.readFileSync(f,'utf8')).name==='@intellectual-frontiers/'+n)fs.symlinkSync(p.resolve('commons',n),p.join(d,n),'junction')}\"",
        {
          name: "The libraries of commons, linked in one place that every file of commons finds them (the installer runs before any package is installed; Bun links them again later)",
          shell: "bash",
        },
      ),
      run('node commons/libraries/src/install-bun.ts "$RUNNER_TEMP/bun"', { name: "Bun, pinned and checked", shell: "bash" }),
    ],
  },
];
