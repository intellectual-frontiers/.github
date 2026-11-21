// Spec: 0001-docs FR-009, FR-010, FR-011, FR-012, FR-013, FR-014, FR-015, FR-016, FR-017, FR-020, FR-022, FR-023, FR-024
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
import { causeOf, deliveryOf } from "../src/pages/quality.ts";
import { movementsOf, parseHistoryRun, runsOf } from "../src/history.ts";
import { sparkText } from "../src/emit/html.ts";
import { busFactor, lastChanged, libraryOfPath, parseLog } from "../src/pages/git.ts";
import { document } from "../src/emit/html.ts";
import { type EvidenceSource, resolveConfig } from "../src/config.ts";
import { importedNames, importIndex, testsImporting } from "../src/exercise.ts";
import { parseCoverage, parseLcov, percent } from "../src/coverage.ts";
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
  assertStringIncludes(page, "| ci | 4 | 50% | 10 | 60 min |", "the share that passed, the median minutes, the median time to recover");
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

proves(["0001-docs FR-016"], "the history says how a library's tests moved over its runs: what began to fail, what was fixed, what keeps failing and what flaps, with trends, causes and the range of commits", async () => {
  const b = await built({ results: EVIDENCE });
  const ev = readEvidence(ROOT, { results: EVIDENCE }, []);
  assertEquals(ev.history.length, 5);
  assertEquals(runsOf(ev, "fixture").length, 5);
  const m = movementsOf(ev, "fixture");
  assertEquals(m.newlyFailing.map((x) => x.id), ["c3"]);
  assertEquals(m.fixed.map((x) => x.id), ["d4"]);
  assertEquals(m.persistent.map((x) => x.id), ["b2"]);
  assertEquals(m.flaky.map((x) => [x.id, x.episodes]), [["e5", 2]], "a test that failed once is not flaky; one that failed in two separate stretches is");
  assertEquals([m.from, m.to], ["dddd000".repeat(6) + "0000", "eeee000".repeat(6) + "0000"]);
  const page = markdownOf(b.pages.find((p) => p.path === "quality/fixture.html") as never);
  for (const said of ["## History", "*Tests: ", "*Pass rate: ", "*Time: ", "### Began to fail in the latest run (1)", "C is new", "### Fixed since the run before (1)", "D went away", "### Flapping: failed more than once, passing in the latest run (1)", "E comes and goes (failed in 2 separate stretches)", "https://github.com/example/fixture/compare/"]) assertStringIncludes(page, said);
  const dash = markdownOf(b.pages.find((p) => p.path === "quality/index.html") as never);
  assertStringIncludes(dash, "| Pass rate | Coverage | Flaky |");
  assert(/`[▁-█]{5}`/.test(dash), "a trend of the pass rate in the row");
  const q = JSON.parse(b.files.find((f) => f.path === "quality.json")?.text ?? "{}") as { libraries: { library: string; flaky: string[]; newlyFailing: string[] }[] };
  assertEquals(q.libraries.find((l) => l.library === "fixture")?.flaky, ["001-greeting FR-001: E comes and goes"]);
  // the line, in the page itself
  const html = document(b.pages.find((p) => p.path === "quality/fixture.html") as never, { name: "N", repository: "r", pages: b.pages });
  assertStringIncludes(html, '<figure class="trend"><svg viewBox="0 0 120 28"');
  assertStringIncludes(html, "Pass rate: ");
  assertEquals(sparkText([1, 2, 3, 4, 5, 6, 7, 8]), "▁▂▃▄▅▆▇█");
  assertEquals(sparkText([5, 5]), "▄▄");
  assertEquals(sparkText([]), "");
  assert("error" in parseHistoryRun("{") && "error" in parseHistoryRun("{}"), "a file that is not a run is said so");
  assertEquals(causeOf("expected 'Hello, Ada' to end with '.' at /home/x/y/z.ts:12"), "expected '…' to end with '…' at <path>:N");
  assertEquals(causeOf(undefined), "no message");
});

proves(["0001-docs FR-016"], "the history tool adds a run once, keeps the newest, and refuses evidence with no time", async () => {
  const dir = await fs.makeTempDir({ prefix: "ifc-docs-history-" });
  try {
    const ev = path.join(dir, "evidence");
    const hist = path.join(dir, "history");
    await fs.ensureDir(ev);
    await fs.writeTextFile(path.join(ev, "fixture.ctrf.json"), fs.readTextFileSync(path.join(EVIDENCE, "fixture.ctrf.json")));
    await fs.writeTextFile(path.join(ev, "status-grc.json"), '{ "library": "grc", "reported": false }');
    const cwd = path.join(ROOT, "commons/docs");
    const run = (...a: string[]) => proc.run(["bun", "tools/history.ts", ...a], { cwd });
    assertEquals((await run("--evidence", ev, "--history", hist)).code, 2, "no time, no run");
    for (const n of [1, 2, 3]) {
      await fs.writeTextFile(path.join(ev, "meta.json"), JSON.stringify({ at: `2026-11-21 0${n}:00 UTC`, commit: `c${n}`, url: `https://x/runs/${n}` }));
      assertEquals((await run("--evidence", ev, "--history", hist, "--keep", "2")).code, 0);
    }
    assertEquals((await run("--evidence", ev, "--history", hist, "--keep", "2")).code, 0, "the same run again");
    const files = [...fs.readDirSync(path.join(hist, "runs"))].map((e) => e.name).sort();
    assertEquals(files, ["202611210200-2.json", "202611210300-3.json"]);
    const r = parseHistoryRun(fs.readTextFileSync(path.join(hist, "runs", files[1] as string)));
    assert("value" in r && r.value.missing[0] === "grc" && r.value.libraries["fixture"]?.failed === 1 && r.value.libraries["fixture"].failing[0]?.id.length === 8, JSON.stringify(r));
  } finally {
    await fs.remove(dir, { recursive: true });
  }
}, { timeout: 120_000 });

proves(["0001-docs FR-017"], "each library is held to the gate of the configuration, shown and enforced nowhere, and the requirements page says how each specification stands", async () => {
  const b = await built({ results: EVIDENCE, issues: [{ library: "fixture", issues: [ISSUE] }], gate: [{ id: "ran" }, { id: "tests-pass" }, { id: "no-blocking-issues" }, { id: "requirements-proved", min: 50 }] });
  const lib = markdownOf(b.pages.find((p) => p.path === "quality/fixture.html") as never);
  for (const said of ["## Quality gate", "The library does not hold 3 conditions of the gate. The gate is shown and enforces nothing", "| its tests were in the run | yes |", "| no test failed | no | 1 test failed |", "| no open issue of severity high or critical | no | 1 open issue of severity high or critical |", "| its requirements are proved (50%) | no | 33% of the requirements are proved, 50% are wanted |"]) assertStringIncludes(lib, said);
  assertStringIncludes(markdownOf(b.pages.find((p) => p.path === "quality/index.html") as never), "| Library | Gate |");
  const reqs = markdownOf(b.pages.find((p) => p.path === "quality/requirements.html") as never);
  assertStringIncludes(reqs, "3 requirements of 2 specifications: 1 proved (33%), 0 partly, 1 failing, 1 with no test recorded.");
  assertStringIncludes(reqs, "| [001-greeting](../specs/001-greeting.md) |");
  const clean = await built({ results: EVIDENCE });
  assertStringIncludes(markdownOf(clean.pages.find((p) => p.path === "quality/fixture.html") as never), "The library does not hold 1 condition of the gate");
  const json = JSON.parse(clean.files.find((f) => f.path === "quality/fixture.json")?.text ?? "{}") as { gate: { condition: string; holds: boolean }[]; requirements: { proved: number; notProved: string[] }; history: unknown[] };
  assertEquals(json.gate.map((g) => [g.condition, g.holds]), [["ran", true], ["tests-pass", false], ["no-blocking-issues", true]]);
  assertEquals([json.requirements.proved, json.requirements.notProved.length, json.history.length], [1, 2, 5]);
  const bad = resolveConfig({ name: "N", repository: "https://github.com/e/n", home: { dir: ".", about: { title: "N", summary: "n." } }, packages: [], citations: { prefix: "n", digits: 3 }, evidence: { gate: [{ id: "luck" }, { id: "requirements-proved", min: 200 }] } }, "/x/docs.config.ts");
  assert(bad.kind === "err" && bad.error.join().includes("evidence.gate[0].id") && bad.error.join().includes("evidence.gate[1].min"));
});

proves(["0001-docs FR-020"], "the log of git is read into commits, the bus factor is how few authors made half of the commits, a file's last change is its newest commit, and a repository with no history is said to have none", async () => {
  const log = ["\u00012026-11-20\u0001a|a@x\n\ncommons/core/src/a.ts\ncommons/core/spec-kit/specs/0001-core/spec.md\n", "\u00012026-11-10\u0001a|a@x\n\ncommons/core/src/a.ts\n", "\u00012026-10-01\u0001b|b@x\n\ncommons/data/src/d.ts\n"].join("");
  const commits = parseLog(log);
  assertEquals(commits.map((c) => [c.day, c.who, c.files.length]), [["2026-11-20", "a|a@x", 2], ["2026-11-10", "a|a@x", 1], ["2026-10-01", "b|b@x", 1]]);
  assertEquals(busFactor(commits), 1, "one author made two thirds");
  assertEquals(busFactor([{ who: "a" }, { who: "b" }, { who: "c" }, { who: "d" }]), 2);
  assertEquals(busFactor([]), 0);
  assertEquals([...lastChanged(commits)], [["commons/core/src/a.ts", "2026-11-20"], ["commons/core/spec-kit/specs/0001-core/spec.md", "2026-11-20"], ["commons/data/src/d.ts", "2026-10-01"]]);
  assertEquals([libraryOfPath("commons/core/src/a.ts"), libraryOfPath("tests/x.test.ts"), libraryOfPath("README.md")], ["core", "repository", ""]);
  const b = await built({ results: EVIDENCE });
  assert(b.pages.some((p) => p.path === "quality/hotspots.html"), "the page is made, with a history or without");
  const page = markdownOf(b.pages.find((p) => p.path === "quality/hotspots.html") as never);
  assert(page.includes("Where the work is") || page.includes("The history of the repository is not available"), page.slice(0, 200));
});

proves(["0001-docs FR-022"], "line coverage is read from the lcov of bun, left to the library's source files, shown as a percent on the dashboard and as the least covered files on the library's page", async () => {
  const lcov = ["TN:", "SF:../core/src/a.ts", "LF:4", "LH:3", "end_of_record", "SF:../core/suite/a.test.ts", "LF:9", "LH:9", "end_of_record", "SF:../core/src/empty.ts", "LF:0", "LH:0", "end_of_record", ""].join("\n");
  const files = parseLcov(lcov, "commons/data");
  assertEquals(files, [{ path: "commons/core/src/a.ts", found: 4, hit: 3 }], "tests and files with no lines are left out, and paths are from the root");
  assertEquals([percent(files), percent([])], [75, undefined]);
  assert("error" in parseCoverage("{"));
  assert("error" in parseCoverage("{}"));
  const b = await built({ results: EVIDENCE });
  const found: never[] = [];
  const ev = readEvidence(path.join(ROOT, "commons/docs/suite"), { results: "fixture-evidence" }, found);
  assertEquals(percent(ev.coverage.get("fixture")?.files ?? []), 33.3);
  const page = markdownOf(b.pages.find((p) => p.path === "quality/fixture.html") as never);
  assertStringIncludes(page, "Line coverage");
  assertStringIncludes(page, "commons/fixture/src/rare.ts");
  assertStringIncludes(markdownOf(b.pages.find((p) => p.path === "quality/index.html") as never), "33.3%");
});

proves(["0001-docs FR-023"], "the four measures of DORA are taken from the runs of the publishing workflow: publishes a day, the median minutes of a successful run, the share of runs that failed and the minutes from a failure to the next pass, and fewer than two runs give none", () => {
  const run = (n: number, at: string, end: string, conclusion: string) => ({ id: n, number: n, event: "push", status: "completed", conclusion, sha: "", title: "", url: "", createdAt: at, startedAt: at, updatedAt: end });
  const runs = [
    run(4, "2026-11-02T00:00:00Z", "2026-11-02T00:06:00Z", "success"),
    run(3, "2026-11-01T12:00:00Z", "2026-11-01T12:04:00Z", "failure"),
    run(2, "2026-11-01T06:00:00Z", "2026-11-01T06:08:00Z", "cancelled"),
    run(1, "2026-11-01T00:00:00Z", "2026-11-01T00:02:00Z", "success"),
  ];
  assertEquals(deliveryOf(runs), { runs: 3, days: 1, perDay: 2, leadMinutes: 6, failureRate: 33, restoreMinutes: 720 });
  assertEquals(deliveryOf(runs.slice(0, 1)), undefined);
});

proves(["0001-docs FR-024"], "the tests that exercise an export are those of its package whose files import it, by the name it is exported under, and the API page of an export says how many there are and whether any fails", async () => {
  const names = importedNames(['import { a, b as c, type D } from "./x.ts";', 'import type { E } from "../src/y.ts";', 'import { F } from "@intellectual-frontiers/core";', 'import { G } from "node:fs";', 'import { H } from "left-pad";'].join("\n"));
  assertEquals([...names].sort(), ["E", "F", "a", "b"].concat(["D"]).sort());
  const t = (name: string, file: string, status: "passed" | "failed") => ({ name, status, durationMs: 1, file, requirements: [], risk: "", runtime: "", retries: 0, message: undefined });
  const files: Record<string, string> = { "commons/p/suite/a.test.ts": 'import { greet } from "../src/mod.ts";', "commons/p/suite/b.test.ts": 'import { greet, fs } from "../src/mod.ts";', "commons/q/suite/c.test.ts": 'import { greet } from "../../p/src/mod.ts";' };
  const stub = {
    evidence: { results: new Map([["p", { library: "p", tests: [t("1: a", "commons/p/suite/a.test.ts", "passed"), t("2: b", "commons/p/suite/b.test.ts", "failed")] }], ["q", { library: "q", tests: [t("3: c", "commons/q/suite/c.test.ts", "passed")] }]]) },
    exists: (f: string) => f in files,
    read: (f: string) => files[f] ?? "",
  };
  const index = importIndex(stub as never);
  assertEquals(testsImporting(index, "commons/p", "greet").map((x) => [x.test.name, x.library]), [["1: a", "p"], ["2: b", "p"]], "the tests of the package, not of another that imports it too");
  assertEquals(testsImporting(index, "commons/p", "fs.readTextFile").map((x) => x.test.name), ["2: b"], "a namespace's member is found by the namespace");
  assertEquals(testsImporting(index, "commons/p", "nothing"), []);
  const b = await built({ results: EVIDENCE });
  const api = markdownOf(b.pages.find((p) => p.path.startsWith("api/greeting/")) as never);
  assertStringIncludes(api, "greet");
});
