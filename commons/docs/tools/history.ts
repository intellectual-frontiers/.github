// Spec: 0001-docs FR-016
/**
 * Adds one run to the history of the evidence (docs 0001-docs FR-016): `bun tools/history.ts --evidence DIR --history DIR [--keep 120]` reads the CTRF reports and the statuses in `DIR` and writes a small summary of the run,
 * `<history>/runs/<time>-<run>.json` (for each library the counts of its tests, how long they took, and the identity and name of each test that failed; and the libraries that left no report), so that the site can show
 * trends, what began to fail, what was fixed and what flaps, without keeping every test of every run. It keeps the newest `--keep` runs and removes the rest; a run that is already there is not added twice. It is a function of the files
 * it is given and the names it writes are those of the run, so the same run gives the same file.
 *
 * @module
 */
import { fs, path, proc } from "@intellectual-frontiers/system";

const args = proc.args;
const flag = (name: string): string | undefined => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const evidence = flag("--evidence");
const history = flag("--history");
const keep = Number(flag("--keep") ?? 120);
if (evidence === undefined || history === undefined) {
  console.error("usage: bun tools/history.ts --evidence DIR --history DIR [--keep 120]");
  proc.exit(2);
}
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const json = (p: string): unknown => {
  try {
    return JSON.parse(fs.readTextFileSync(p)) as unknown;
  } catch {
    return undefined;
  }
};
const hash = (s: string): string => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, "0");
};

const meta = json(path.join(evidence, "meta.json"));
const at = isRecord(meta) && typeof meta["at"] === "string" ? meta["at"] : "";
const url = isRecord(meta) && typeof meta["url"] === "string" ? meta["url"] : "";
const commit = isRecord(meta) && typeof meta["commit"] === "string" ? meta["commit"] : "";
const stamp = at.replace(/[^0-9]/g, "").slice(0, 12);
const run = url.split("/").pop() ?? "";
if (stamp === "" || run === "") {
  console.error("history: meta.json has no time or no run: nothing is added");
  proc.exit(2);
}
const libraries: Record<string, unknown> = {};
const missing: string[] = [];
for (const e of [...fs.readDirSync(evidence)].sort((a, b) => (a.name < b.name ? -1 : 1))) {
  if (e.name.endsWith(".ctrf.json")) {
    const d = json(path.join(evidence, e.name));
    const tests = isRecord(d) && isRecord(d["results"]) && Array.isArray(d["results"]["tests"]) ? d["results"]["tests"].filter(isRecord) : [];
    const count = (s: string): number => tests.filter((t) => t["status"] === s).length;
    const lib = e.name.slice(0, -".ctrf.json".length);
    libraries[lib] = {
      tests: tests.length,
      passed: count("passed"),
      failed: count("failed"),
      skipped: tests.length - count("passed") - count("failed"),
      durationMs: Math.round(tests.reduce((n, t) => n + (typeof t["duration"] === "number" ? t["duration"] : 0), 0)),
      failing: tests.filter((t) => t["status"] === "failed").map((t) => ({ id: hash(`${String(t["filePath"])}\u0000${String(t["name"])}`), name: String(t["name"]).slice(0, 160) })).sort((a, b) => (a.id < b.id ? -1 : 1)),
    };
  } else if (e.name.startsWith("status-") && e.name.endsWith(".json")) {
    const d = json(path.join(evidence, e.name));
    if (isRecord(d) && d["reported"] === false && typeof d["library"] === "string") missing.push(d["library"]);
  }
}
const dir = path.join(history, "runs");
await fs.ensureDir(dir);
const file = path.join(dir, `${stamp}-${run}.json`);
if (!fs.existsSync(file)) await fs.writeTextFile(file, `${JSON.stringify({ at, commit, url, libraries, missing: missing.sort() }, null, 2)}\n`);
const all = [...fs.readDirSync(dir)].filter((e) => e.name.endsWith(".json")).map((e) => e.name).sort();
for (const old of all.slice(0, Math.max(0, all.length - keep))) await fs.remove(path.join(dir, old));
console.log(`history: ${Object.keys(libraries).length} libraries -> ${file}; ${Math.min(all.length, keep)} runs kept`);
