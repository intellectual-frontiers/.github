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
import { classify } from "../ci/inventory.ts";
import { gatherJob, keepJob, wrapWorkflow } from "../ci/wrap.ts";
import { isWrapped } from "../ci/inventory.ts";
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
  /** The number of cells the tests of the library are split among (0001-libraries FR-034), where one cell takes too long. */
  readonly shards?: number;
};

const NODE_TESTS = 'node --test "suite/**/*.test.ts"';
const ALL_OTHER: readonly OtherSystem[] = ["windows-latest", "macos-latest"];
const node: LibraryCi = { nodeTests: NODE_TESTS };
/** The tests of a sharded library, on Node 26: the files of the cell's shard (0001-libraries FR-034). */
const SHARDED_NODE_TESTS = "bun ../libraries/src/shard.ts --node suite";

/** The facts of CI of the libraries that have more than `verify` on Linux, by the library's name; a library with no record has `verify` on Linux only. */
export const LIBRARY_CI: Readonly<Record<string, LibraryCi>> = {
  data: { nodeTests: SHARDED_NODE_TESTS, after: "bun tools/generate-dpv.ts --check", shards: 4 },
  "anyfs-sql": { shards: 3 },
  docs: { shards: 4 },
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
  "integrations-github": node,
  "integrations-fhir": node,
  "integrations-x12": node,
  integrations: node,
};

/** A cell of the matrix of a job of `ci`: a library, and where it runs where it is not on Linux. */
export type Cell = {
  readonly name: string;
  /** The library, whatever shard the cell is (0001-libraries FR-035). */
  readonly library: string;
  /** A name for a file or an artifact: the cell's name with no space or slash, `data-1-of-4` (0001-libraries FR-035). */
  readonly slug: string;
  readonly folder: string;
  readonly verify: string;
  /** The command that runs the tests on Node 26, or the empty string. */
  readonly node: string;
  /** The command that runs after `verify`, or the empty string. */
  readonly after: string;
  /** Whether the packing is checked in this cell: the library changed its `exports` (or the packer changed), or the run is of everything. A push does not pack otherwise; the release does. */
  readonly pack: boolean;
  /** The place of this cell among the shards of the library, `k/N`, or the empty string where its tests are not split (0001-libraries FR-034). */
  readonly shard: string;
  /** The runner, for a cell that is not on Linux. */
  readonly os?: OtherSystem;
};

/** The cell of a library on a system (`ubuntu-latest`, where it names none), from its manifest and its record of CI; `pack` says whether the packing is checked in it. */
export function cellOf(l: { readonly name: string; readonly folder: string; readonly verify: string }, os?: OtherSystem, pack = false): Cell {
  const ci = LIBRARY_CI[l.name];
  return {
    name: l.name,
    library: l.name,
    slug: l.name,
    folder: l.folder,
    verify: l.verify,
    pack,
    shard: "",
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
  run(expr("matrix.verify"), { name: "verify (its packing is checked where the exports changed, and by the release)", workingDirectory: expr("matrix.folder"), env: { IFC_SKIP_PACK: expr("matrix.pack == false && '1' || ''"), IFC_SHARD: expr("matrix.shard") } }),
  run(expr("matrix.after"), { name: "After verify", when: "matrix.after != ''", workingDirectory: expr("matrix.folder"), shell: "bash" }),
  run(expr("matrix.node"), { name: "The tests on Node 26", when: "matrix.node != ''", workingDirectory: expr("matrix.folder"), shell: "bash", env: { IFC_SHARD: expr("matrix.shard") } }),
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

const docsPaths = ["commons/**", "package.json", "bun.lock", own("site"), BUN_ACTION];
/** A push to main, a run by hand on main, or the night's run: where the evidence is gathered and the site published. */
/** Not a pull request, on main; where the event is the end of another workflow, that workflow's run was of main and was not cancelled (a workflow_run event carries the ref of the default branch whatever branch the run was of). */
const onMainOrSchedule =
  "github.event_name != 'pull_request' && github.ref == 'refs/heads/main' && (github.event_name != 'workflow_run' || (github.event.workflow_run.head_branch == 'main' && github.event.workflow_run.conclusion != 'cancelled'))";

/**
 * The evidence of quality (commons 0011-documentation FR-042): the tests of every library and of the repository's own `tests/`, one job for each, kept whether they pass, fail or cannot be run, and gathered into one artifact
 * that the site reads. It runs by the hour and by hand, never on a push: a push to main comes every minute or two and a run of every suite takes a quarter of an hour, so a run for each push would never finish, and the site
 * would wait for it. The site is built on every push from the newest evidence there is, and says how old it is.
 */
/** The night's run, which adds the mutation score of a few small libraries to the evidence. */
const MUTATION_CRON = "43 3 * * *";
/** The libraries whose mutation score is kept: small ones, since a run makes the suite run once for each change to the code (docs 0001-docs FR-027). */
const MUTATION_LIBRARIES = ["integrations-github", "catalog-nist-csf-2", "archon-dns", "catalog-nist-sp800", "integrations-x12", "lab"];
const evidence: Workflow = {
  file: "evidence",
  name: "evidence",
  comment: lines(
    "The evidence of quality for the documentation site (commons 0011-documentation FR-042): the tests of every library and of the repository's own `tests/`, one job for each, each kept as a CTRF report with a status file that says why",
    "there is none (the packages could not be installed, there is no suite, the run timed out). By the hour and by hand, never on a push. The jobs `tests` and `repository` never fail the workflow for what they find: a failed test is what the",
    "site is to show. The job `collect` gathers every report into the artifact `evidence`, which the workflow `site` downloads on each push.",
  ).trimEnd(),
  on: { workflowDispatch: true, schedule: ["17 * * * *", MUTATION_CRON] },
  permissions: { contents: "read" },
  concurrency: { group: "evidence", cancelInProgress: false },
  jobs: {
    plan: job({
      comment: "every library the plan knows, as a matrix",
      runsOn: "ubuntu-24.04",
      timeoutMinutes: 10,
      outputs: { linux: expr("steps.plan.outputs.linux") },
      steps: [
        checkout({ fetchDepth: 0 }),
        bun(),
        run("bun install --frozen-lockfile", { name: "The packages the plan reads, from the root's bun.lock" }),
        run("bun commons/libraries/src/link.ts", { name: "The libraries, linked by name before any of them is imported (the root's packages are old copies from npm)" }),
        run('bun commons/libraries/src/plan.ts --all --github-output "$GITHUB_OUTPUT"', { name: "Every library, as a matrix", id: "plan", shell: "bash" }),
      ],
    }),
    tests: job({
      name: "tests (${{ matrix.name }})",
      comment: "the tests of one library, whose result is kept whether they pass, fail or cannot be run",
      needs: ["plan"],
      runsOn: "ubuntu-24.04",
      timeoutMinutes: 25,
      strategy: { failFast: false, matrix: expr("fromJSON(needs.plan.outputs.linux)") },
      steps: [
        checkout(),
        bun(),
        { ...tools(expr("matrix.folder"), "The development tools, from bun.lock (the libraries it imports are linked)"), id: "install", continueOnError: true },
        { ...tools("commons/quality", "The test runner's own packages (commons quality)"), id: "runner", continueOnError: true },
        { ...tools("commons/docs", "The packages of the tool that keeps the report (commons docs)"), continueOnError: true },
        run('bun commons/docs/tools/evidence.ts --library "${{ matrix.library }}" --coverage --out "$RUNNER_TEMP/evidence"', { name: "The tests, once, kept as a CTRF report and their line coverage (the files of this cell's shard where the library is split)", id: "tests", continueOnError: true, shell: "bash", env: { IFC_SHARD: expr("matrix.shard") } }),
        run(
          lines(
            "mkdir -p \"$RUNNER_TEMP/evidence\"",
            "printf '{ \"library\": \"%s\", \"shard\": \"%s\", \"install\": \"%s\", \"runner\": \"%s\", \"tests\": \"%s\", \"reported\": %s }\\n' \"${{ matrix.library }}\" \"${{ matrix.shard }}\" \"${{ steps.install.outputs.outcome }}\" \"${{ steps.runner.outputs.outcome }}\" \"${{ steps.tests.outputs.outcome }}\" \"$(ls \"$RUNNER_TEMP/evidence/\"*.ctrf.json >/dev/null 2>&1 && echo true || echo false)\" > \"$RUNNER_TEMP/evidence/status-${{ matrix.slug }}.json\"",
          ),
          { name: "Why there is a report, or none", when: "always()", shell: "bash" },
        ),
        use(PIN.uploadArtifact, { name: "The report and its status, kept for the site", when: "always()", with: { name: "evidence-${{ matrix.slug }}", path: "${{ runner.temp }}/evidence/*.json", "if-no-files-found": "ignore", "retention-days": 7 } }),
      ],
    }),
    repository: job({
      name: "tests (repository ${{ matrix.part }}/3)",
      comment: "the tests of the repository's own files (`tests/`)",
      runsOn: "ubuntu-24.04",
      timeoutMinutes: 25,
      strategy: { failFast: false, matrix: { part: ["1", "2", "3"] } },
      steps: [
        checkout({ fetchDepth: 0 }),
        bun(),
        { ...tools(".", "The root's development tools, from bun.lock"), id: "install", continueOnError: true },
        { ...tools("commons/docs", "The documentation generator's dependencies, which the tests of the root import"), continueOnError: true },
        { ...tools("commons/quality", "The test runner's own packages (commons quality)"), id: "runner", continueOnError: true },
        run("bun commons/libraries/src/link.ts", { name: "The libraries, linked by name", continueOnError: true }),
        run('bun commons/docs/tools/evidence.ts --library repository --coverage --out "$RUNNER_TEMP/evidence"', { name: "The tests, once, kept as a CTRF report and their line coverage (the files of this cell's shard)", id: "tests", continueOnError: true, shell: "bash", env: { IFC_SHARD: "${{ matrix.part }}/3" } }),
        run(
          lines(
            "mkdir -p \"$RUNNER_TEMP/evidence\"",
            "printf '{ \"library\": \"repository\", \"shard\": \"%s\", \"install\": \"%s\", \"runner\": \"%s\", \"tests\": \"%s\", \"reported\": %s }\\n' \"${{ matrix.part }}/3\" \"${{ steps.install.outputs.outcome }}\" \"${{ steps.runner.outputs.outcome }}\" \"${{ steps.tests.outputs.outcome }}\" \"$(ls \"$RUNNER_TEMP/evidence/\"*.ctrf.json >/dev/null 2>&1 && echo true || echo false)\" > \"$RUNNER_TEMP/evidence/status-repository-${{ matrix.part }}-of-3.json\"",
          ),
          { name: "Why there is a report, or none", when: "always()", shell: "bash" },
        ),
        use(PIN.uploadArtifact, { name: "The report and its status, kept for the site", when: "always()", with: { name: "evidence-repository-${{ matrix.part }}-of-3", path: "${{ runner.temp }}/evidence/*.json", "if-no-files-found": "ignore", "retention-days": 7 } }),
      ],
    }),
    mutation: job({
      name: "mutation (${{ matrix.library }})",
      comment: "the mutation score of a small library, by the night and by hand: the suite is run once for each change made to the library's code, so it is slow; where it cannot be done the score of the night before stays",
      when: `github.event_name == 'workflow_dispatch' || github.event.schedule == '${MUTATION_CRON}'`,
      runsOn: "ubuntu-24.04",
      timeoutMinutes: 40,
      strategy: { failFast: false, matrix: { library: MUTATION_LIBRARIES } },
      steps: [
        checkout(),
        bun(),
        { ...tools(expr("format('commons/{0}', matrix.library)"), "The development tools, from bun.lock (the libraries it imports are linked)"), continueOnError: true },
        { ...tools("commons/docs", "The packages of the tool that keeps the report (commons docs)"), continueOnError: true },
        use(PIN.cache, {
          name: "What the run before learned of this library's mutants, kept between nights (docs 0001-docs FR-050)",
          with: { path: "${{ runner.temp }}/mutation-incremental", key: "mutation-${{ matrix.library }}-${{ github.run_id }}", "restore-keys": "mutation-${{ matrix.library }}-" },
        }),
        run('bun commons/docs/tools/mutation.ts --library "${{ matrix.library }}" --out "$RUNNER_TEMP/evidence" --incremental "$RUNNER_TEMP/mutation-incremental/${{ matrix.library }}.json"', { name: "The mutation run, kept as a small report: only the changes that a change since the night before reaches are tried again", continueOnError: true, shell: "bash" }),
        use(PIN.uploadArtifact, { name: "The score, kept for the site", when: "always()", with: { name: "evidence-mutation-${{ matrix.library }}", path: "${{ runner.temp }}/evidence/*.mutation.json", "if-no-files-found": "ignore", "retention-days": 7 } }),
      ],
    }),
    collect: job({
      comment: "every report in one artifact, whatever happened to the jobs that made them, with the run added to the history that the artifact of the run before carried",
      needs: ["tests", "repository", "mutation"],
      when: "always()",
      runsOn: "ubuntu-24.04",
      timeoutMinutes: 10,
      permissions: { contents: "read", actions: "read" },
      steps: [
        checkout(),
        bun(),
        { ...tools("commons/docs", "The packages of the tool that keeps the history (commons docs)"), continueOnError: true },
        use(PIN.downloadArtifact, { name: "The reports of the tests", with: { pattern: "evidence-*", path: "_evidence", "merge-multiple": true } }),
        run("bun commons/docs/tools/merge-shards.ts --evidence _evidence || echo 'the shards could not be put together'", { name: "The shards of a library, put together again (docs 0001-docs FR-049)", shell: "bash", continueOnError: true }),
        run(
          lines(
            "mkdir -p _evidence",
            "printf '{ \"commit\": \"%s\", \"at\": \"%s\", \"url\": \"%s\" }\\n' \"$GITHUB_SHA\" \"$(date -u '+%Y-%m-%d %H:%M UTC')\" \"$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID\" > _evidence/meta.json",
            "ls -l _evidence | sed -n '1,200p'",
          ),
          { name: "Which run this is", shell: "bash" },
        ),
        run(
          lines(
            "# the history travels from one run's artifact to the next: this run adds itself to the one the run before kept (it is cut to the newest 120)",
            "mkdir -p _history _prev",
            "gh run download --name evidence --dir _prev || echo 'no earlier evidence: the history begins here'",
            "if [ -d _prev/history ]; then cp -r _prev/history/. _history/; fi",
            "# the mutation scores are made by the night; the hours between keep the ones the run before had",
            "for f in _prev/*.mutation.json; do if [ -e \"$f\" ] && [ ! -e \"_evidence/$(basename \"$f\")\" ]; then cp \"$f\" _evidence/; fi; done",
            "bun commons/docs/tools/history.ts --evidence _evidence --history _history || echo 'the history could not be kept'",
            "mkdir -p _evidence/history && cp -r _history/runs _evidence/history/ 2>/dev/null || true",
          ),
          { name: "The run, added to the history", shell: "bash", continueOnError: true, env: { GH_TOKEN: expr("github.token") } },
        ),
        use(PIN.uploadArtifact, { name: "The evidence, kept for the site", with: { name: "evidence", path: "_evidence", "retention-days": 7 } }),
      ],
    }),
  },
};

/**
 * The documentation site of commons (commons 0011-documentation FR-020, FR-041, FR-042): built on every push to main in a few minutes from the sources and the newest evidence there is, and published whatever happened to
 * anything else. The site is how a failure is seen, so nothing that fails may keep it from being published: the generator's own check, a library's tests, the evidence run, even the generator itself, for which an emergency
 * page is made from the evidence alone.
 */
const site: Workflow = {
  file: "site",
  name: "site",
  comment: lines(
    "The documentation site of commons (commons 0011-documentation FR-020, FR-041, FR-042): made by commons/docs, from commons' TypeScript and spec kit and, beside them, the evidence of quality. Every pull request and push that",
    "touches commons tests the generator and checks the site (no finding, every link and anchor resolves): that gates a pull request and nothing else. A push to main builds the site in a few minutes from the newest evidence the",
    "workflow `evidence` has kept (the tests of every library, with how old they are), the open issues and the runs of the workflows, and publishes it to GitHub Pages with GitHub's own actions WHATEVER failed: the generator's check, a",
    "library's tests, the evidence run, even the build, for which an emergency page is made from the evidence alone. The site is how a failure is seen. It is never committed.",
  ).trimEnd(),
  // one build for each push to main (0011-documentation FR-020): the workflow `ci` finishing is the one event of it; a push that touches only this workflow builds directly, `evidence` and `release` refresh the site, and so does the night
  on: { push: { paths: [own("site")] }, pullRequest: { paths: docsPaths }, workflowDispatch: true, workflowRun: { workflows: ["evidence", "ci", "release"] }, schedule: ["41 4 * * *"] },
  permissions: { contents: "read" },
  // on main a run in progress is finished and only the newest waiting one is kept, so that a busy main still publishes
  concurrency: { group: "site-${{ github.ref }}", cancelInProgress: expr("github.ref != 'refs/heads/main'") },
  jobs: {
    check: job({
      comment: "gates a pull request; on main its result is shown on the site and stops nothing. A refresh of the site after a workflow, or by the night, does not run it.",
      when: "github.event_name == 'push' || github.event_name == 'pull_request' || github.event_name == 'workflow_dispatch'",
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
      ],
    }),
    site: job({
      comment: "the site, built from the sources and the evidence, whatever else failed; where the build itself fails, a page made from the evidence alone",
      needs: ["check"],
      when: `always() && ${onMainOrSchedule}`,
      runsOn: "ubuntu-24.04",
      timeoutMinutes: 20,
      permissions: { contents: "read", issues: "read", actions: "read", packages: "read" },
      steps: [
        checkout({ fetchDepth: 0, comment: "the whole history, for the page of hotspots and owners" }),
        bun(),
        { ...tools("commons/docs", "TypeScript 7.1 (beta), Shiki, beautiful-mermaid and @types/node, exactly as bun.lock pins them"), continueOnError: true },
        { ...tools("commons/commons", "The packages of the one package's own tools (commons commons)"), continueOnError: true },
        run(
          lines(
            "mkdir -p _evidence/findings-history",
            "gather_reports() {",
            "# the newest evidence the workflow `evidence` kept, whatever its result; none is a site that says no run is recorded",
            "gh run download --name evidence --dir _evidence || echo 'no evidence has been kept yet'",
            "}",
            "gather_history() {",
            "# the findings of the runs, which the workflows keep on the branch findings-history, laid out for the page of build findings (0038-build-policy FR-012), and the accepted risks as data",
            "git fetch -q origin findings-history:refs/remotes/origin/findings-history || echo 'no findings history has been kept yet'",
            "git archive --format=tar refs/remotes/origin/findings-history runs 2>/dev/null | tar -x -C _evidence/findings-history || echo 'no findings history to lay out'",
            "bun commons/libraries/src/ci/accepted.ts --json _evidence/accepted-findings.json || echo 'the accepted risks could not be read'",
            "}",
            "gather_issues() {",
            "# each page of the answer is an array: the pages are made one; the issues and the runs are asked for at the same time (0011-documentation FR-020)",
            "(gh api --paginate -X GET \"repos/$GITHUB_REPOSITORY/issues\" -f state=all -f per_page=100 --jq '.[]' | jq -s '.' > _evidence/github-issues.json || echo '[]' > _evidence/github-issues.json) &",
            "(bun commons/docs/tools/ci-runs.ts --out _evidence/runs.json || echo 'the runs of the workflows could not be read') &",
            "wait",
            "}",
            "gather_registry() {",
            "# the versions the package registry holds, with their days: the version in the heading of every page (docs 0001-docs FR-033, FR-039). A registry that cannot be read is a file that says why, which the site shows as a finding, never a stop.",
            "set -o pipefail",
            "if gh api --paginate -X GET \"/orgs/$GITHUB_REPOSITORY_OWNER/packages/npm/commons/versions\" -f per_page=100 --jq '.[]' | jq -s '{ versions: [ .[] | { version: .name, createdAt: .created_at } ] }' > _evidence/registry.json.new; then mv _evidence/registry.json.new _evidence/registry.json; else rm -f _evidence/registry.json.new; printf '{ \"error\": \"the package registry could not be read with the token of this job\" }\\n' > _evidence/registry.json; fi",
            "cat _evidence/registry.json | head -c 600",
            "}",
            "gather_package() {",
            "# what the packer says of the package at this commit, for the pages of the package (docs 0001-docs FR-032, FR-034, FR-039); where it cannot be made, no file is kept and the pages say nothing was measured",
            "bun install --frozen-lockfile",
            "bun commons/libraries/src/link.ts",
            "(cd commons/commons && bun tools/pack.ts --size > \"$RUNNER_TEMP/pack.log\" 2>&1; tail -n 5 \"$RUNNER_TEMP/pack.log\")",
            "cp commons/commons/dist/package-report.json _evidence/package.report.json || echo 'the package could not be measured'",
            "}",
            "# the five are independent of one another and most of their time is spent waiting for a network, so they are done at the same time (docs 0001-docs FR-051); each says what it did in its own log, shown in order",
            "for g in reports history issues registry package; do (gather_$g > \"$RUNNER_TEMP/gather-$g.log\" 2>&1 || true) & done",
            "wait",
            "for g in reports history issues registry package; do echo \"::group::$g\"; cat \"$RUNNER_TEMP/gather-$g.log\"; echo \"::endgroup::\"; done",
            "printf '{ \"commit\": \"%s\", \"at\": \"%s\", \"url\": \"%s\", \"check\": \"%s\" }\\n' \"$GITHUB_SHA\" \"$(date -u '+%Y-%m-%d %H:%M UTC')\" \"$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID\" \"${{ needs.check.result }}\" > _evidence/build.json",
            "ls -l _evidence | sed -n '1,80p'",
          ),
          { name: "The evidence the build reads: the test reports, the findings, the issues and runs, the registry and the package, gathered at the same time", shell: "bash", continueOnError: true, env: { GH_TOKEN: expr("github.token") } },
        ),
        run('set -o pipefail; bun src/main.ts build --out "$GITHUB_WORKSPACE/_site" 2>&1 | tee "$RUNNER_TEMP/build.log"', { name: "The site, built", id: "build", continueOnError: true, shell: "bash", workingDirectory: "commons/docs" }),
        run('bun tools/status-site.ts --evidence "$GITHUB_WORKSPACE/_evidence" --log "$RUNNER_TEMP/build.log" --out "$GITHUB_WORKSPACE/_site"', {
          name: "The emergency page, where the build failed",
          when: "steps.build.outputs.outcome != 'success'",
          shell: "bash",
          workingDirectory: "commons/docs",
        }),
        use(PIN.uploadPages, { name: "The site, kept for Pages", with: { path: "_site" } }),
      ],
    }),
    publish: job({
      comment: "always(): whatever failed before is an ancestor that failed, and would otherwise skip the publication of a site that was built",
      needs: ["site"],
      when: `always() && needs.site.result == 'success' && ${onMainOrSchedule}`,
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
      strategy: { failFast: false, matrix: { os: ["ubuntu-latest"], runtime: ["bun", "node"] } },
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
        run(
          lines(
            "for f in tests/*.test.ts; do",
            '  echo "$f:"',
            '  timeout 5m bun test "$f" || true',
            "done",
          ),
          {
            name: "The tests on Bun, each file by itself so that one that hangs or fails hides no other (tests/release/ is the release's: it packs, installs and type-checks every library)",
          when: "matrix.runtime == 'bun'",
        }),
        run('node --test "tests/*.test.ts"', { name: "The tests on Node 26", when: "matrix.runtime == 'node'" }),
      ],
    }),
    installers: job({
      comment: "the one test of the root that has code of its own for macOS (the one-command installers of agora); the others run on Linux alone (0038-build-policy: a system is run only for code that is its own)",
      runsOn: "macos-latest",
      timeoutMinutes: 15,
      steps: [
        checkout(),
        bun(),
        tools(".", "The root's development tools, from bun.lock"),
        run("timeout 5m bun test tests/agora-install.test.ts", { name: "The installers of agora on macOS" }),
      ],
    }),
    workflows: job({
      comment: "the workflow files are what the model makes and what GitHub's schema accepts (0038-build-policy FR-002): a fault of the pipeline's own configuration, the one thing here that ends a run red",
      runsOn: "ubuntu-latest",
      timeoutMinutes: 10,
      steps: [
        checkout(),
        bun(),
        run(lines("bun commons/libraries/src/generate-workflows.ts --check", "node commons/libraries/src/generate-workflows.ts --check"), { name: "The workflow files are what the model makes, on Bun and on Node 26", shell: "bash" }),
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
    "and to the GitHub package registry, and makes the tag of each; the registries of an entry are those its record names (in `single` distribution the one package goes to the GitHub package registry alone, 0036-distribution FR-028).",
    "A version that is on a registry is skipped and a tag that is there is kept, so a run again continues where one stopped.",
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
      strategy: { failFast: false, matrix: expr("fromJSON(needs.plan.outputs.build)") },
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
      when: "always() && inputs.publish && needs.plan.outputs.has-build == 'true' && needs.plan.result == 'success'",
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
        run("bun commons/libraries/src/ci/release-gate.ts --history refs/remotes/origin/findings-history", { name: "The release policy of the day, and the findings that are open (commons 0038-build-policy FR-010)", shell: "bash" }),
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

/** The housekeeping of the release (commons 0030-generated-workflows FR-012): by hand only; it cleans the package registry and makes a tag, each by the one input that says which. */
const maintenance: Workflow = {
  file: "maintenance",
  name: "maintenance",
  comment: lines(
    "The housekeeping of the release (commons 0030-generated-workflows FR-012): by hand only, from main. With an empty `tag` the job `package-clean` lists the versions of the package on the GitHub package registry, plans with",
    "`commons/libraries/src/registry-clean.ts` which to delete (the newest `keep` plain versions stay) and deletes them only where `dry-run` is false. With a `tag` the job `tag` makes that tag at `sha`, which must be on main, by",
    "`git push` or by the refs API, and says the registry's own words if it refuses. A tag that is there is kept; nothing is ever force-pushed.",
  ).trimEnd(),
  on: {
    workflowDispatch: {
      inputs: {
        keep: { description: "package-clean: how many of the newest plain versions to keep (at least 1)", type: "string", default: "1" },
        "dry-run": { description: "package-clean: only print the plan; delete nothing", type: "boolean", default: true },
        tag: { description: "tag: the tag to make, commons-v<major>.<minor>.<patch>; empty runs package-clean instead", type: "string", default: "" },
        sha: { description: "tag: the commit to tag, 40 hexadecimal digits, on main", type: "string", default: "" },
        method: { description: "tag: git-push or refs-api", type: "string", default: "git-push" },
      },
    },
  },
  permissions: { contents: "read" },
  concurrency: { group: "maintenance", cancelInProgress: false },
  jobs: {
    "package-clean": job({
      when: "inputs.tag == ''",
      runsOn: "ubuntu-latest",
      timeoutMinutes: 15,
      permissions: { contents: "read", packages: "write" },
      steps: [
        checkout(),
        bun(),
        run("bun install --frozen-lockfile", { name: "The packages the planner reads, from the root's bun.lock" }),
        run("bun commons/libraries/src/link.ts", { name: "The libraries, linked by name before any of them is imported" }),
        run(
          lines(
            "set -eu",
            String.raw`gh api --paginate "/orgs/$GITHUB_REPOSITORY_OWNER/packages/npm/commons/versions?per_page=100" --jq '.[] | {id: .id, name: .name}' > versions.jsonl`,
            String.raw`bun commons/libraries/src/registry-clean.ts --keep "$KEEP" < versions.jsonl | tee plan.txt`,
            'if [ "$DRY_RUN" = "true" ]; then echo "dry run: nothing is deleted"; exit 0; fi',
            String.raw`for id in $(tail -n 1 plan.txt | jq -r ".delete[]"); do`,
            '  echo "deleting version id $id"',
            '  gh api -X DELETE "/orgs/${GITHUB_REPOSITORY_OWNER}/packages/npm/commons/versions/$id"',
            "done",
          ),
          { name: "The versions the registry lists, the plan, and (only where dry-run is false) the deletion of what the plan names", shell: "bash", env: { GH_TOKEN: expr("secrets.GITHUB_TOKEN"), KEEP: expr("inputs.keep"), DRY_RUN: expr("inputs.dry-run") } },
        ),
      ],
    }),
    tag: job({
      when: "inputs.tag != ''",
      runsOn: "ubuntu-latest",
      timeoutMinutes: 10,
      permissions: { contents: "write" },
      steps: [
        checkout({ fetchDepth: 0, comment: "main and the tags: the commit must be on main and a tag that is there is kept" }),
        run(
          lines(
            "set -u",
            String.raw`echo "$TAG" | grep -Eq '^commons-v[0-9]+\.[0-9]+\.[0-9]+$' || { echo "the tag $TAG is not commons-v<major>.<minor>.<patch>"; exit 1; }`,
            String.raw`echo "$SHA" | grep -Eq '^[0-9a-f]{40}$' || { echo "the sha is not 40 hexadecimal digits"; exit 1; }`,
            'git merge-base --is-ancestor "$SHA" origin/main || { echo "$SHA is not on main"; exit 1; }',
            'if git rev-parse -q --verify "refs/tags/$TAG" > /dev/null; then echo "the tag $TAG is there: kept"; exit 0; fi',
            'case "$METHOD" in',
            "  git-push)",
            '    git tag "$TAG" "$SHA"',
            String.raw`    git push origin "refs/tags/$TAG" 2>&1 || { echo "git push of $TAG was refused (the text above is the remote's own)"; exit 1; } ;;`,
            "  refs-api)",
            '    gh api -X POST "repos/${GITHUB_REPOSITORY}/git/refs" -f ref="refs/tags/$TAG" -f sha="$SHA" 2>&1 || { echo "the refs API refused $TAG (the text above is its own)"; exit 1; } ;;',
            '  *) echo "method is git-push or refs-api"; exit 1 ;;',
            "esac",
            'echo "the tag $TAG is made at $SHA"',
          ),
          { name: "The tag, made at a commit on main, and the text of a refusal if there is one", shell: "bash", env: { GH_TOKEN: expr("secrets.GITHUB_TOKEN"), TAG: expr("inputs.tag"), SHA: expr("inputs.sha"), METHOD: expr("inputs.method") } },
        ),
      ],
    }),
  },
};

/** The script of the job that gathers the findings of a workflow: the sound-pipeline check for the cells that ran, then `collect.ts` (0038-build-policy FR-005). */
function gatherScript(w: Workflow): string {
  const planGuard = "plan" in w.jobs ? ['if [ "$PLAN_RESULT" != "success" ]; then echo "the plan could not be made (the red cause plan-unavailable)"; exit 2; fi'] : [];
  const expects: string[] = [];
  const counts: string[] = [];
  if (w.file === "ci") {
    counts.push('n_linux=$(jq \'[(.include // [])[].name] | unique | length\' <<<"${PLAN_LINUX:-$empty}")', 'n_systems=$(jq \'[(.include // [])[].name] | unique | length\' <<<"${PLAN_SYSTEMS:-$empty}")');
    expects.push('--expect "verify:$n_linux"', '--expect "systems:$n_systems"');
  }
  if (w.file === "evidence") {
    counts.push('n_tests=$(jq \'[(.include // [])[].name] | unique | length\' <<<"${PLAN_LINUX:-$empty}")');
    expects.push('--expect "tests:$n_tests"', "--expect repository:1");
  }
  const review = w.file === "ci" ? " --policy-review" : "";
  return lines("set -u", "empty='{}'", ...planGuard, ...counts, `bun commons/libraries/src/ci/collect.ts --dir _findings --out _findings-out --workflow ${w.file} ${expects.join(" ")}${review} --check-run`);
}

/** A workflow under the build policy (0038-build-policy): every step has its policy, the steps of findings run through the wrapper, and the job that gathers the findings ends the run. */
function underPolicy(w: Workflow): Workflow {
  const wrapped = wrapWorkflow(classify(w));
  const makers = Object.entries(wrapped.jobs).filter(([, j]) => j.steps.some((st) => isWrapped(st))).map(([id]) => id);
  if (makers.length === 0) return wrapped;
  const all = Object.keys(wrapped.jobs);
  const id = w.file === "ci" ? "ci" : "findings";
  const gather = { ...gatherJob(wrapped, all, gatherScript(wrapped)), name: w.file === "ci" ? "ci" : "findings" };
  const planResults = "plan" in wrapped.jobs ? { PLAN_RESULT: expr("needs.plan.result"), PLAN_LINUX: expr("needs.plan.outputs.linux"), ...(w.file === "ci" ? { PLAN_SYSTEMS: expr("needs.plan.outputs.systems") } : {}) } : {};
  const steps = gather.steps.map((st) => (st.kind === "run" && st.env?.["WORKFLOW"] !== undefined ? { ...st, env: { ...st.env, ...planResults } } : st)) as unknown as typeof gather.steps;
  return { ...wrapped, jobs: { ...wrapped.jobs, [id]: { ...gather, steps }, "keep-findings": keepJob(wrapped, id) } };
}

/** Every workflow, the libraries' made from their manifests, in the order of their files' names, under the build policy. */
export function workflows(): readonly Workflow[] {
  return [
    ci,
    evidence,
    release,
    site,
    conformance,
    tests,
    maintenance,
  ].map(underPolicy).sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
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
      run("bun install --frozen-lockfile", { name: "Install shared tooling from the root lockfile", shell: "bash" }),
    ],
  },
];
