// Spec: 0001-docs FR-009, FR-010, FR-011, FR-012, FR-013, FR-014, FR-015
/**
 * The evidence the site shows beside the code (docs 0001-docs FR-009 to FR-012): CTRF results, GitHub tickets and typed issues read from files, the Quality section made from them, the lines on a requirement, a library and a
 * module, the findings for a file that cannot be read and a test that names a requirement that is not there, and, with no run recorded, nothing shown as passed.
 *
 * @module
 */
import { fs, path, proc } from "@intellectual-frontiers/system";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { report } from "../src/check.ts";
import { loadConfig } from "../src/cli.ts";
import { type EvidenceSource, resolveConfig } from "../src/config.ts";
import { parseCtrf, parseRuns, parseTickets, readEvidence, requirementsIn, standing } from "../src/evidence.ts";
import { markdownOf } from "../src/emit/markdown.ts";
import { buildSite } from "../src/site.ts";
import { ROOT } from "./helpers.ts";

const FIXTURE = path.join(ROOT, "commons/docs/suite/fixture-repo/docs.config.ts");
const EVIDENCE = path.join(ROOT, "commons/docs/suite/fixture-evidence");
const ISSUE = { id: 1, slug: "no-comma", title: "The greeting has no comma", summary: "It says Hello Ada.", severity: "high", priority: "P2", goals: ["G1"], status: { kind: "open" }, size: "s", cites: ["001-greeting FR-001", "0099-elsewhere FR-001"], evidence: [{ kind: "file", path: "src/mod.ts", line: 3 }, { kind: "spec", id: "001-greeting" }], links: [{ kind: "relates", to: 2 }], raised: "2026-11-01" };
const CLOSED = { id: 2, slug: "done", title: "A closed one", summary: "Closed.", severity: "low", priority: "P3", status: { kind: "fixed", proof: [{ kind: "commit", sha: "abcdef0123456789" }] }, raised: "2026-10-01" };

async function built(evidence: EvidenceSource | undefined) {
  const loaded = await loadConfig(FIXTURE);
  assert(loaded.kind === "ok");
  return buildSite({ ...loaded.value, evidence });
}

proves(["0001-docs FR-009"], "CTRF is read into tests with their requirements, a file that is not CTRF or not JSON is said so, and tickets of GitHub are read without pull requests and are tied to a library and requirements by label, path and words", () => {
  const text = fs.readTextFileSync(path.join(EVIDENCE, "fixture.ctrf.json"));
  const r = parseCtrf("fixture", text, "pkg/");
  assert("value" in r);
  assertEquals([r.value.tests.length, r.value.passed, r.value.failed, r.value.skipped], [4, 2, 1, 1]);
  const failing = r.value.tests.find((t) => t.status === "failed");
  assertEquals(failing?.requirements, ["001-greeting FR-002", "001-greeting FR-009"]);
  assertEquals(failing?.file, "pkg/src/greeting.test.ts");
  assertEquals(failing?.message, "expected 'Hello, Ada' to end with '.' received no full stop");
  assertEquals(failing?.risk, "high");
  assert("error" in parseCtrf("x", "{", ""), "not JSON");
  assert("error" in parseCtrf("x", '{"results":{}}', ""), "not CTRF");
  assertEquals(requirementsIn("see 0011-documentation FR-003, and 0009-sql-features FR-019 and 12-bad FR-001"), ["0009-sql-features FR-019", "0011-documentation FR-003"]);
  const t = parseTickets(fs.readTextFileSync(path.join(EVIDENCE, "github-issues.json")));
  assert("value" in t);
  assertEquals(t.value.map((x) => x.number), [7, 9]);
  assertEquals(t.value[0]?.libraries, ["fixture"]);
  assertEquals(t.value[0]?.requirements, ["001-greeting FR-001"]);
  assertEquals(t.value[1]?.libraries, ["fixture"], "a path of commons/<library>/ names the library");
  assert("error" in parseTickets("{}"), "not a list");
  assertEquals(standing([]), "none");
  assertEquals(standing(r.value.tests.filter((x) => x.requirements.includes("001-greeting FR-001"))), "proved");
  assertEquals(standing(r.value.tests.filter((x) => x.status !== "passed")), "failing");
  assertEquals(standing(r.value.tests.filter((x) => x.status === "skipped")), "partly");
});

proves(["0001-docs FR-009"], "a configuration's evidence is checked, and a folder that is missing is no run, and a file that cannot be read is a finding", async () => {
  const base = { name: "N", repository: "https://github.com/example/n", home: { dir: ".", about: { title: "N", summary: "n." } }, packages: [], citations: { prefix: "n", digits: 3 } };
  const bad = resolveConfig({ ...base, evidence: { results: 3, issues: [{ library: "x" }, { library: "y", issues: [{ id: "one" }] }] } }, "/x/docs.config.ts");
  assert(bad.kind === "err");
  for (const said of ["evidence.results", "evidence.issues[0]", "evidence.issues[1].issues[0]"]) assertStringIncludes(bad.error.join("\n"), said);
  const none = readEvidence(ROOT, { results: "commons/docs/suite/nowhere" }, []);
  assertEquals([none.recorded, none.results.size], [false, 0]);
  const dir = await fs.makeTempDir({ prefix: "ifc-docs-evidence-" });
  try {
    await fs.writeTextFile(path.join(dir, "broken.ctrf.json"), "{ not json");
    await fs.writeTextFile(path.join(dir, "meta.json"), "[");
    await fs.writeTextFile(path.join(dir, "issues.json"), '"no"');
    const found: Parameters<typeof readEvidence>[2] = [];
    const ev = readEvidence(dir, { results: ".", github: "issues.json" }, found);
    assertEquals(ev.recorded, false);
    assertEquals(report(found).length, 3);
    assert(report(found).every((l) => l.includes("cannot be read as evidence")), report(found).join("\n"));
  } finally {
    await fs.remove(dir, { recursive: true });
  }
});

proves(["0001-docs FR-010", "0001-docs FR-011"], "with a run recorded, the site has the Quality section, a line on each requirement, library and module, a finding for a test of a requirement that is not there, and the numbers in quality.json", async () => {
  const b = await built({ results: EVIDENCE, github: `${EVIDENCE}/github-issues.json`, issues: [{ library: "fixture", issues: [ISSUE, CLOSED] }] });
  const pages = new Map(b.pages.map((p) => [p.path, p] as const));
  // a test names FR-009, which 001-greeting does not have
  assertEquals(report(b.found).map((l) => l.replace(/^[^:]*: /, "")), ["holds a test, \"a greeting ends with a full stop\", that proves 001-greeting FR-009, which is not a requirement of the spec kits"]);
  assertEquals(b.found.filter((f) => f.problem.kind === "test-requirement-unknown").length, 1);
  for (const p of ["quality/index.html", "quality/fixture.html", "quality/issues/index.html", "quality/issues/fixture-00001.html", "quality/issues/fixture-00002.html"]) assert(pages.has(p), `${p} is a page`);
  const dashboard = markdownOf(pages.get("quality/index.html") as never);
  assertStringIncludes(dashboard, "Tests are failing");
  assertStringIncludes(dashboard, "4 tests in 1 library: 2 passed, 1 failed, 1 skipped or planned.");
  assertStringIncludes(dashboard, "0123456789");
  const lib = markdownOf(pages.get("quality/fixture.html") as never);
  for (const said of ["### Failing", "a greeting ends with a full stop", "expected 'Hello, Ada' to end with '.' received no full stop", "### Skipped or planned", "a helper that no requirement names", "3 requirements: 1 proved, 0 partly (a test skipped or planned), 1 failing, 1 with no test recorded.", "The greeting has no comma", "#7: Greeting forgets the comma"]) assertStringIncludes(lib, said);
  // a requirement: its tests with their results, the badge, and the open issue and ticket that name it
  const spec = pages.get("specs/001-greeting.html");
  const entries = (spec?.blocks ?? []).filter((x) => x.kind === "entry");
  const fr1 = entries.find((x) => x.kind === "entry" && x.name === "FR-001");
  const fr2 = entries.find((x) => x.kind === "entry" && x.name === "FR-002");
  assert(fr1?.kind === "entry" && fr1.badges.some((x) => x.text === "passing" && x.tone === "good"), "FR-001 is passing");
  assert(fr2?.kind === "entry" && fr2.badges.some((x) => x.text === "failing" && x.tone === "warn"), "FR-002 is failing");
  assertStringIncludes(JSON.stringify(fr1), "The greeting has no comma");
  assertStringIncludes(JSON.stringify(fr1), "ticket #7");
  assertStringIncludes(JSON.stringify(fr1), "a greeting names the person");
  // the library's page and the module's page
  assertStringIncludes(markdownOf(pages.get("overview/fixture.html") as never), "4 tests: 2 passed, 1 failed, 1 skipped, 1 of 3 requirements proved, 1 open issue, 1 open ticket.");
  // an issue: its facts, the requirement that is a link and the one of another repository that is only code, its evidence and its related issue
  const issue = markdownOf(pages.get("quality/issues/fixture-00001.html") as never);
  for (const said of ["| Severity | high |", "[`001-greeting FR-001`](../../specs/001-greeting.md#fr-001)", "`0099-elsewhere FR-001`", "[`src/mod.ts:3`]", "relates: [00002: A closed one]"]) assertStringIncludes(issue, said);
  assert(!issue.includes("](../../specs/0099"), "a requirement of another repository is not a link");
  const data = JSON.parse(b.files.find((f) => f.path === "quality.json")?.text ?? "{}") as { recorded: boolean; libraries: { library: string; tests: { failed: number } | null; openIssues: unknown[]; failing: { name: string }[] }[] };
  const row = data.libraries.find((l) => l.library === "fixture");
  assertEquals([data.recorded, row?.tests?.failed, row?.openIssues.length, row?.failing[0]?.name], [true, 1, 1, "001-greeting FR-002, 001-greeting FR-009: a greeting ends with a full stop"]);
});

proves(["0001-docs FR-010", "0001-docs FR-011"], "with no run recorded, no requirement is shown as passing, the pages say so, and a build with no evidence configured has no Quality section", async () => {
  const b = await built({ issues: [{ library: "fixture", issues: [ISSUE] }] });
  const spec = b.pages.find((p) => p.path === "specs/001-greeting.html");
  assert(!JSON.stringify(spec).includes("passing") && !JSON.stringify(spec).includes("no test run"), "no badge of a result");
  assertStringIncludes(markdownOf(b.pages.find((p) => p.path === "quality/index.html") as never), "No test run is recorded for this build of the site, so no test is shown as passed.");
  assertEquals(b.files.map((f) => f.path).includes("quality.json"), true);
  const none = await built(undefined);
  assert(!none.pages.some((p) => p.section === "quality"), "no evidence, no section");
  assertEquals(none.files.some((f) => f.path === "quality.json"), false);
});

proves(["0001-docs FR-012"], "the evidence tool runs a library's suite into CTRF the site reads, leaves meta.json, and refuses a library with no suite", async () => {
  const out = await fs.makeTempDir({ prefix: "ifc-docs-evidence-tool-" });
  try {
    const run = (...a: string[]) => proc.run(["bun", "tools/evidence.ts", ...a], { cwd: path.join(ROOT, "commons/docs") });
    const ok = await run("--library", "test", "--out", out);
    assertEquals(ok.code, 0, ok.stderr);
    const parsed = parseCtrf("test", fs.readTextFileSync(path.join(out, "test.ctrf.json")), "commons/test/");
    assert("value" in parsed && parsed.value.tests.length > 5 && parsed.value.failed === 0, "the suite of the test library ran, with tests");
    assert(parsed.value.tests.some((t) => t.file.startsWith("commons/test/suite/")), "its files are paths from the root");
    const meta = JSON.parse(fs.readTextFileSync(path.join(out, "meta.json"))) as { commit?: string; at?: string };
    assert(/^[0-9a-f]{40}$/.test(meta.commit ?? "") && (meta.at ?? "").endsWith("UTC"), "the commit and when");
    assertEquals((await run("--library", "nowhere", "--out", out)).code, 2);
    assertEquals((await run("--out", out)).code, 2);
  } finally {
    await fs.remove(out, { recursive: true });
  }
}, { timeout: 180_000 });

proves(["0001-docs FR-013", "0001-docs FR-011"], "the runs of the workflows are read from runs.json, and the Workflows page says how each ended, the last runs as marks, how long a run takes, which jobs failed, and what flaps", async () => {
  const r = parseRuns(fs.readTextFileSync(path.join(EVIDENCE, "runs.json")));
  assert("workflows" in r && r.workflows.length === 2 && r.workflows[0]?.runs.length === 5 && r.workflows[0].failed[0]?.jobs[0]?.step === "verify (its packing is checked)");
  assert("error" in parseRuns("{}") && "error" in parseRuns("["), "a file that is not the runs is said so");
  const b = await built({ results: EVIDENCE });
  const page = markdownOf(b.pages.find((p) => p.path === "quality/ci.html") as never);
  assertStringIncludes(page, "Workflows are failing");
  assertStringIncludes(page, "The latest run of ci failed.");
  assertStringIncludes(page, "✗ ✓ ✗ ✓ –");
  assertStringIncludes(page, "| 12 |", "the latest run took 12 minutes");
  assertStringIncludes(page, "flapping (3 flips in 4 runs)");
  assertStringIncludes(page, "verify (grc)");
  assertStringIncludes(page, "… |", "a run in progress is a mark");
  const none = markdownOf((await built({ issues: [] })).pages.find((p) => p.path === "quality/ci.html") as never);
  assertStringIncludes(none, "The runs of the workflows are not recorded for this build of the site.");
});

proves(["0001-docs FR-011"], "the dashboard says which build this is and how the generator's own check ended, and a library with no report says why from what its job says", async () => {
  const dir = await fs.makeTempDir({ prefix: "ifc-docs-status-" });
  try {
    await fs.writeTextFile(path.join(dir, "meta.json"), '{ "commit": "abc", "at": "2026-11-21 09:00 UTC" }');
    await fs.writeTextFile(path.join(dir, "build.json"), fs.readTextFileSync(path.join(EVIDENCE, "build.json")));
    await fs.writeTextFile(path.join(dir, "status-fixture.json"), '{ "library": "fixture", "install": "failure", "runner": "success", "tests": "skipped", "reported": false }');
    await fs.writeTextFile(path.join(dir, "other.ctrf.json"), fs.readTextFileSync(path.join(EVIDENCE, "fixture.ctrf.json")));
    const b = await built({ results: dir });
    const dash = markdownOf(b.pages.find((p) => p.path === "quality/index.html") as never);
    assertStringIncludes(dash, "from the commit [`fedcba9876`]");
    assertStringIncludes(dash, "the generator's own tests and check failure");
    assertStringIncludes(dash, "| no run |");
    const lib = markdownOf(b.pages.find((p) => p.path === "quality/fixture.html") as never);
    assertStringIncludes(lib, "No test report of the library is in the run these pages show: its packages could not be installed.");
    for (const [status, why] of [['{ "library": "fixture", "install": "success", "runner": "failure", "tests": "skipped" }', "the test runner could not be installed"], ['{ "library": "fixture", "install": "success", "runner": "success", "tests": "cancelled" }', "its job was cancelled or timed out"], ['{ "library": "fixture", "install": "success", "runner": "success", "tests": "failure" }', "it has no suite, or the runner failed"]] as const) {
      await fs.writeTextFile(path.join(dir, "status-fixture.json"), status);
      assertStringIncludes(markdownOf((await built({ results: dir })).pages.find((p) => p.path === "quality/fixture.html") as never), why);
    }
  } finally {
    await fs.remove(dir, { recursive: true });
  }
});

proves(["0001-docs FR-011"], "the findings page says what the generator found while it made the site, by library, and that it found nothing where it did", async () => {
  const b = await built({ results: EVIDENCE });
  const page = markdownOf(b.pages.find((p) => p.path === "quality/findings.html") as never);
  assertStringIncludes(page, "1 finding: 1 test-requirement-unknown.");
  assertStringIncludes(page, "proves 001-greeting FR-009");
  const clean = await built({ issues: [] });
  assertStringIncludes(markdownOf(clean.pages.find((p) => p.path === "quality/findings.html") as never), "The generator found nothing wrong while it made this site");
});

proves(["0001-docs FR-015"], "a configuration's problems and a lens that throws are findings and the site is made without them", async () => {
  const loaded = await loadConfig(FIXTURE);
  assert(loaded.kind === "ok");
  const broken = { name: "broken", read: async () => { throw new Error("the lens could not read its library"); } };
  const throwsPages = { name: "pages", read: async () => () => { throw new Error("its pages could not be made"); } };
  const throwsFiles = { name: "files", read: async () => (_b: unknown, n: number) => n, files: () => { throw new Error("its files could not be made"); } };
  const b = await buildSite({ ...loaded.value, problems: [{ where: "commons/grc", error: "Cannot find package 'x'" }], lenses: [broken, throwsPages, throwsFiles] as never });
  const said = report(b.found);
  for (const want of ["commons/grc: the module could not be imported: Cannot find package", "lens broken: the module could not be imported: the lens could not read", "a lens's pages: the module could not be imported: its pages", "lens files: the module could not be imported: its files"]) assert(said.some((l) => l.startsWith(want) || l.includes(want)), `${want} in ${said.join(" | ")}`);
  assert(b.pages.length > 5, "the site is made");
  assertEquals(resolveConfig({ name: "N", repository: "https://github.com/e/n", home: { dir: ".", about: { title: "N", summary: "n." } }, packages: [], citations: { prefix: "n", digits: 3 }, problems: [{ where: "x", error: "y" }, 3] }, "/x/docs.config.ts").kind, "ok");
});

proves(["0001-docs FR-013", "0001-docs FR-014"], "the tool that reads the runs writes a file that says so where the API cannot be reached, and the emergency page is made from the evidence alone", async () => {
  const out = await fs.makeTempDir({ prefix: "ifc-docs-tools-" });
  try {
    const cwd = path.join(ROOT, "commons/docs");
    const runs = await proc.run(["bun", "tools/ci-runs.ts", "--out", path.join(out, "runs.json")], { cwd, env: { GITHUB_REPOSITORY: "", PATH: proc.env.get("PATH") ?? "" } });
    assertEquals(runs.code, 0, runs.stderr);
    const written = JSON.parse(fs.readTextFileSync(path.join(out, "runs.json"))) as { workflows: unknown[]; error?: string };
    assertEquals([written.workflows.length, typeof written.error], [0, "string"]);
    assert("workflows" in parseRuns(fs.readTextFileSync(path.join(out, "runs.json"))), "the file is a valid runs file");
    await fs.writeTextFile(path.join(out, "build.log"), "Error: the build broke\n    at somewhere\n");
    const site = path.join(out, "site");
    const emergency = await proc.run(["bun", "tools/status-site.ts", "--evidence", EVIDENCE, "--log", path.join(out, "build.log"), "--out", site], { cwd });
    assertEquals(emergency.code, 0, emergency.stderr);
    const html = fs.readTextFileSync(path.join(site, "index.html"));
    for (const said of ["the documentation build failed", "Error: the build broke", "fedcba9876", "<td>fixture</td><td>4</td><td>2</td><td>1</td><td>1</td>", "001-greeting FR-002", ">failure</a>"]) assertStringIncludes(html, said);
    const bare = await proc.run(["bun", "tools/status-site.ts", "--out", path.join(out, "bare")], { cwd });
    assertEquals(bare.code, 0, "with nothing at all it still writes a page");
    assertStringIncludes(fs.readTextFileSync(path.join(out, "bare/index.html")), "No test report is kept.");
    assertEquals((await proc.run(["bun", "tools/status-site.ts"], { cwd })).code, 2);
  } finally {
    await fs.remove(out, { recursive: true });
  }
}, { timeout: 120_000 });
