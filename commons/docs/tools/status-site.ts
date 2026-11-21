// Spec: 0001-docs FR-014
/**
 * The emergency page (docs 0001-docs FR-014): `bun tools/status-site.ts --evidence DIR --log FILE --out DIR` writes one self-contained page, `index.html`, from the evidence alone, for a build of the site that failed. It says that the build
 * failed and why (the end of its log), which commit and when, how the tests stand library by library, why a library has no run, and how the workflows' latest runs ended. It reads CTRF and JSON as files and uses no part of the
 * generator, so it works when the generator does not; and it exits 0 whatever is missing, because a site that says little is better than none.
 *
 * @module
 */
import { fs, path, proc } from "@intellectual-frontiers/system";

const args = proc.args;
const flag = (name: string): string | undefined => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const evidence = flag("--evidence");
const log = flag("--log");
const out = flag("--out");
if (out === undefined) {
  console.error("usage: bun tools/status-site.ts [--evidence DIR] [--log FILE] --out DIR");
  proc.exit(2);
}
const escape = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const read = (p: string): string => {
  try {
    return fs.existsSync(p) ? fs.readTextFileSync(p) : "";
  } catch {
    return "";
  }
};
const json = (p: string): unknown => {
  try {
    const t = read(p);
    return t === "" ? undefined : (JSON.parse(t) as unknown);
  } catch {
    return undefined;
  }
};

const libraries: { name: string; tests: number; passed: number; failed: number; skipped: number; failing: string[] }[] = [];
const reasons: string[] = [];
if (evidence !== undefined && fs.existsSync(evidence)) {
  for (const e of [...fs.readDirSync(evidence)].sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (e.name.endsWith(".ctrf.json")) {
      const d = json(path.join(evidence, e.name));
      const tests = isRecord(d) && isRecord(d["results"]) && Array.isArray(d["results"]["tests"]) ? d["results"]["tests"].filter(isRecord) : [];
      const count = (s: string): number => tests.filter((t) => t["status"] === s).length;
      libraries.push({ name: e.name.slice(0, -".ctrf.json".length), tests: tests.length, passed: count("passed"), failed: count("failed"), skipped: count("skipped") + count("pending") + count("other"), failing: tests.filter((t) => t["status"] === "failed").map((t) => String(t["name"])).slice(0, 20) });
    } else if (e.name.startsWith("status-") && e.name.endsWith(".json")) {
      const d = json(path.join(evidence, e.name));
      if (isRecord(d) && d["reported"] === false) reasons.push(`${String(d["library"])}: no report (packages ${String(d["install"])}, runner ${String(d["runner"])}, tests ${String(d["tests"])})`);
    }
  }
}
const meta = evidence === undefined ? undefined : json(path.join(evidence, "meta.json"));
const build = evidence === undefined ? undefined : json(path.join(evidence, "build.json"));
const runs = evidence === undefined ? undefined : json(path.join(evidence, "runs.json"));
const tail = (log === undefined ? "" : read(log)).split("\n").slice(-60).join("\n");
const workflowRows = isRecord(runs) && Array.isArray(runs["workflows"])
  ? runs["workflows"].filter(isRecord).map((w) => {
    const latest = Array.isArray(w["runs"]) ? w["runs"].filter(isRecord)[0] : undefined;
    return `<tr><td>${escape(String(w["name"]))}</td><td>${latest === undefined ? "" : `<a href="${escape(String(latest["html_url"]))}">${escape(String(latest["conclusion"] ?? latest["status"]))}</a>`}</td><td>${latest === undefined ? "" : escape(String(latest["created_at"]))}</td></tr>`;
  }).join("")
  : "";
const at = (o: unknown, k: string): string => (isRecord(o) && typeof o[k] === "string" ? (o[k] as string) : "");
const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Documentation build failed · IF Commons</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:60rem;margin:2rem auto;padding:0 1rem;color:#1f2328;background:#fff}@media(prefers-color-scheme:dark){body{color:#e6edf3;background:#0d1117}a{color:#58a6ff}}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #8884;padding:.3rem .5rem;text-align:left}pre{overflow:auto;background:#8881;padding:.7rem;border-radius:6px}.warn{border-left:4px solid #d1242f;padding:.5rem 1rem;background:#d1242f14}</style></head><body>
<h1>IF Commons: the documentation build failed</h1>
<div class="warn"><strong>This is an emergency page.</strong> The documentation generator failed in the build of commit <code>${escape(at(build, "commit").slice(0, 10))}</code>${at(build, "at") === "" ? "" : ` at ${escape(at(build, "at"))}`}${at(build, "url") === "" ? "" : ` (<a href="${escape(at(build, "url"))}">the run</a>)`}, so the full site could not be made. What the evidence says is below; the site is made again by the next push.</div>
<h2>Why it failed</h2><pre>${escape(tail === "" ? "the log of the build is not here" : tail)}</pre>
<h2>The tests</h2>${libraries.length === 0 ? "<p>No test report is kept.</p>" : `<p>Tests as of ${escape(at(meta, "at"))}${at(meta, "commit") === "" ? "" : `, commit <code>${escape(at(meta, "commit").slice(0, 10))}</code>`}.</p><table><tr><th>Library</th><th>Tests</th><th>Passed</th><th>Failed</th><th>Skipped</th></tr>${libraries.map((l) => `<tr><td>${escape(l.name)}</td><td>${l.tests}</td><td>${l.passed}</td><td>${l.failed}</td><td>${l.skipped}</td></tr>`).join("")}</table>`}
${libraries.some((l) => l.failed > 0) ? `<h3>Failing</h3><ul>${libraries.flatMap((l) => l.failing.map((f) => `<li><code>${escape(l.name)}</code>: ${escape(f)}</li>`)).join("")}</ul>` : ""}
${reasons.length === 0 ? "" : `<h3>No report</h3><ul>${reasons.map((r) => `<li>${escape(r)}</li>`).join("")}</ul>`}
${workflowRows === "" ? "" : `<h2>The workflows</h2><table><tr><th>Workflow</th><th>Latest run</th><th>When</th></tr>${workflowRows}</table>`}
<p><a href="https://github.com/intellectual-frontiers/.github">The repository</a></p></body></html>
`;
await fs.ensureDir(path.resolve(out));
await fs.writeTextFile(path.join(path.resolve(out), "index.html"), page);
await fs.writeTextFile(path.join(path.resolve(out), ".nojekyll"), "");
console.log(`status-site: wrote ${path.join(out, "index.html")}`);
