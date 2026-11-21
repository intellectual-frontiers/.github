// Spec: 0001-docs FR-027
/**
 * Leaves the mutation run of a library where the site reads it (docs 0001-docs FR-027): `bun tools/mutation.ts --library data [--out DIR] [--suite suite]` installs Stryker into a temporary folder, runs the library's suite against
 * each change it makes to the library's `src/` (in place, the files being put back after), and keeps the report in the small form as `<DIR>/<library>.mutation.json`. A run is slow (the suite once for each change), so CI runs it
 * for a few small libraries by the day, not by the hour. What cannot be done exits 2; a failing suite is not a failure of the tool.
 *
 * @module
 */
import { fs, path, proc } from "@intellectual-frontiers/system";
import { summariseStryker } from "../src/mutation.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "../../..");
const args = proc.args;
const flag = (name: string): string | undefined => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const library = flag("--library");
if (library === undefined) {
  console.error("usage: bun tools/mutation.ts --library NAME [--out DIR] [--suite DIR]");
  proc.exit(2);
}
const out = path.resolve(flag("--out") ?? path.join(ROOT, "_evidence"));
const folder = path.join(ROOT, "commons", library);
const suite = flag("--suite") ?? "suite";
if (!fs.existsSync(path.join(folder, suite)) || !fs.existsSync(path.join(folder, "src"))) {
  console.error(`mutation: ${library} has no src/ and ${suite}/ to run`);
  proc.exit(2);
}
await fs.ensureDir(out);
const work = await fs.makeTempDir({ prefix: "mutation-" });
try {
  await fs.writeTextFile(path.join(work, "package.json"), '{ "name": "stryker-run", "private": true }\n');
  const install = await proc.run(["npm", "install", "--no-audit", "--no-fund", "@stryker-mutator/core@9.2.0", "typescript@5.6.3"], { cwd: work });
  if (install.code !== 0) {
    console.error(`mutation: Stryker could not be installed:\n${install.stderr}`);
    proc.exit(2);
  }
  const report = path.join(work, "report.json");
  const config = {
    testRunner: "command",
    commandRunner: { command: `bun test ${suite}` },
    mutate: ["src/**/*.ts", "!src/**/*.test.ts"],
    reporters: ["json", "clear-text"],
    jsonReporter: { fileName: report },
    coverageAnalysis: "off",
    concurrency: 2,
    tempDirName: path.join(work, "tmp"),
    timeoutMS: 20000,
    disableTypeChecks: true,
    inPlace: true,
  };
  await fs.writeTextFile(path.join(work, "stryker.conf.json"), JSON.stringify(config));
  const r = await proc.run(["node", path.join(work, "node_modules/.bin/stryker"), "run", path.join(work, "stryker.conf.json")], { cwd: folder });
  process.stdout.write(r.stdout.split("\n").slice(-40).join("\n"));
  if (!fs.existsSync(report)) {
    console.error(`mutation: the run of ${library} left no report (exit ${r.code})`);
    proc.exit(2);
  }
  const s = summariseStryker(fs.readTextFileSync(report), library, `commons/${library}`);
  if ("error" in s) {
    console.error(`mutation: ${s.error}`);
    proc.exit(2);
  }
  await fs.writeTextFile(path.join(out, `${library}.mutation.json`), `${JSON.stringify(s.value, null, 1)}\n`);
  console.log(`mutation: ${library} -> ${path.join(out, `${library}.mutation.json`)}`);
} finally {
  await fs.remove(work, { recursive: true });
}
