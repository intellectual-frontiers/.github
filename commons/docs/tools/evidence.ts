// Spec: 0001-docs FR-012, FR-022
/**
 * Leaves the results of a library's tests where the site reads them (docs 0001-docs FR-012): `bun tools/evidence.ts --library data [--out DIR] [--suite suite]` runs the library's suite with `ifc test run` (commons `quality`, called as a
 * program: this package imports no library it shows), keeps the CTRF report as `<DIR>/<library>.ctrf.json` and writes `<DIR>/meta.json` (the commit, and when) if there is none. `--library repository` runs the tests of the repository's root
 * (`tests/`). The run is kept whether the tests pass or fail: a failure is what the site is to show, so the exit status is the tool's own (2 for what cannot be done), never the suite's. CI runs it for each library; a person
 * runs it to see the pages without CI.
 *
 * @module
 */
import { libraryDir } from "@intellectual-frontiers/libraries/libraries";
import { fs, path, proc } from "@intellectual-frontiers/system";
import { parseLcov } from "../src/coverage.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "../../..");
const args = proc.args;
const flag = (name: string): string | undefined => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const library = flag("--library");
if (library === undefined) {
  console.error("usage: bun tools/evidence.ts --library NAME|repository [--out DIR] [--suite DIR] [--coverage]");
  proc.exit(2);
}
const out = path.resolve(flag("--out") ?? path.join(ROOT, "_evidence"));
const folder = library === "repository" ? ROOT : path.join(ROOT, libraryDir(ROOT, library));
const suite = flag("--suite") ?? (library === "repository" ? "tests" : fs.existsSync(path.join(folder, "suite")) ? "suite" : "tests");
if (!fs.existsSync(path.join(folder, suite))) {
  console.error(`evidence: ${library} has no ${suite}/ to run`);
  proc.exit(2);
}
await fs.ensureDir(out);
const work = await fs.makeTempDir({ prefix: "evidence-" });
try {
  const r = await proc.run(["bun", path.join(ROOT, "commons/quality/src/test-cli.ts"), "run", "--runtime", "bun", "--out", work, "--report", "ctrf", suite], { cwd: folder });
  process.stdout.write(r.stdout);
  process.stderr.write(r.stderr);
  const ctrf = [...fs.readDirSync(work)].find((f) => f.name.endsWith(".ctrf.json"));
  if (ctrf === undefined) {
    console.error(`evidence: the run of ${library} left no CTRF report (exit ${r.code})`);
    proc.exit(2);
  }
  await fs.copyFile(path.join(work, ctrf.name), path.join(out, `${library}.ctrf.json`));
  if (args.includes("--coverage")) {
    // the suite once more, with coverage, for the lines it reaches; whatever happens here, the report above stands
    try {
      const cov = path.join(work, "coverage");
      await proc.run(["bun", "test", "--coverage", "--coverage-reporter=lcov", `--coverage-dir=${cov}`, suite], { cwd: folder });
      const lcov = path.join(cov, "lcov.info");
      if (fs.existsSync(lcov)) {
        const base = path.relative(ROOT, folder).split(path.sep).join("/");
        const files = parseLcov(fs.readTextFileSync(lcov), base).filter((f) => library === "repository" || f.path.startsWith(`${base}/`));
        await fs.writeTextFile(path.join(out, `${library}.coverage.json`), `${JSON.stringify({ library, files }, null, 1)}\n`);
      } else console.error(`evidence: the coverage run of ${library} left no lcov file`);
    } catch (e) {
      console.error(`evidence: no coverage for ${library}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const meta = path.join(out, "meta.json");
  if (!fs.existsSync(meta)) {
    const sha = (await proc.firstLine(["git", "rev-parse", "HEAD"], { cwd: ROOT })).trim();
    const server = proc.env.get("GITHUB_SERVER_URL");
    const url = server === undefined ? undefined : `${server}/${proc.env.get("GITHUB_REPOSITORY") ?? ""}/actions/runs/${proc.env.get("GITHUB_RUN_ID") ?? ""}`;
    await fs.writeTextFile(meta, `${JSON.stringify({ commit: sha === "" ? undefined : sha, at: `${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`, url }, null, 2)}\n`);
  }
  console.log(`evidence: ${library} -> ${path.join(out, `${library}.ctrf.json`)}`);
} finally {
  await fs.remove(work, { recursive: true });
}
