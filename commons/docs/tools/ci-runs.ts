// Spec: 0001-docs FR-013
/**
 * Leaves the recent runs of the repository's workflows where the site reads them (docs 0001-docs FR-013): `bun tools/ci-runs.ts --out FILE [--per 30] [--jobs 6]` asks the GitHub API (through `gh`, with `GITHUB_REPOSITORY` and a token
 * in the environment) for the last runs of each workflow on `main`, and, for the most recent failed ones of each, which jobs failed and at which step, and writes them as `runs.json`. It keeps what the API says and adds no time of its
 * own, so the same answers give the same file. Where the API cannot be reached it writes a file that says so, and exits 0: the site is made whatever happens here.
 *
 * @module
 */
import { fs, path, proc } from "@intellectual-frontiers/system";

const args = proc.args;
const flag = (name: string): string | undefined => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const out = flag("--out");
const per = Number(flag("--per") ?? 30);
const jobsOf = Number(flag("--jobs") ?? 6);
const timed = Number(flag("--timing") ?? 6);
const repo = proc.env.get("GITHUB_REPOSITORY");
if (out === undefined) {
  console.error("usage: bun tools/ci-runs.ts --out FILE [--per 30] [--jobs 6]");
  proc.exit(2);
}

const gh = async (endpoint: string): Promise<unknown> => {
  const r = await proc.run(["gh", "api", "-X", "GET", endpoint]);
  if (!r.success) throw new Error(`gh api ${endpoint}: ${r.stderr.trim().slice(0, 200)}`);
  return JSON.parse(r.stdout) as unknown;
};
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const pick = (o: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

let result: Record<string, unknown>;
try {
  if (repo === undefined) throw new Error("GITHUB_REPOSITORY is not set");
  const list = await gh(`repos/${repo}/actions/workflows?per_page=100`);
  const workflows = isRecord(list) && Array.isArray(list["workflows"]) ? list["workflows"].filter(isRecord) : [];
  const out2: unknown[] = [];
  // the workflows are asked about at the same time (each answer is several calls of `gh`, one after the other), and the file keeps their order (0001-docs FR-013)
  const handle = async (w: Record<string, unknown>): Promise<unknown> => {
    if (typeof w["path"] !== "string" || !w["path"].endsWith(".auto.yml")) return undefined;
    const r = await gh(`repos/${repo}/actions/workflows/${String(w["id"])}/runs?branch=main&per_page=${per}`);
    const runs = (isRecord(r) && Array.isArray(r["workflow_runs"]) ? r["workflow_runs"] : []).filter(isRecord).map((x) => pick(x, ["id", "run_number", "event", "status", "conclusion", "head_sha", "display_title", "html_url", "created_at", "run_started_at", "updated_at"]));
    const failed: unknown[] = [];
    for (const run of runs.filter((x) => x["conclusion"] === "failure").slice(0, jobsOf)) {
      try {
        const j = await gh(`repos/${repo}/actions/runs/${String(run["id"])}/jobs?per_page=100`);
        const jobs = (isRecord(j) && Array.isArray(j["jobs"]) ? j["jobs"] : []).filter(isRecord).filter((x) => x["conclusion"] === "failure").map((x) => ({
          name: x["name"],
          url: x["html_url"],
          step: (Array.isArray(x["steps"]) ? x["steps"].filter(isRecord).find((s) => s["conclusion"] === "failure")?.["name"] : undefined) ?? null,
        }));
        failed.push({ run: run["id"], jobs });
      } catch {
        failed.push({ run: run["id"], jobs: [] });
      }
    }
    // how long the jobs and their steps took in the latest runs that passed (docs 0001-docs FR-047): the page of build time reads them
    const timing: unknown[] = [];
    const seconds = (a: unknown, b: unknown): number => (typeof a === "string" && typeof b === "string" ? Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 1000)) : 0);
    for (const run of runs.filter((x) => x["conclusion"] === "success").slice(0, timed)) {
      try {
        const rows: Record<string, unknown>[] = [];
        for (let page = 1; page <= 3; page++) {
          const j = await gh(`repos/${repo}/actions/runs/${String(run["id"])}/jobs?per_page=100&page=${page}`);
          const got = (isRecord(j) && Array.isArray(j["jobs"]) ? j["jobs"] : []).filter(isRecord);
          rows.push(...got);
          if (got.length < 100) break;
        }
        timing.push({
          run: run["id"],
          jobs: rows
            .filter((x) => x["conclusion"] === "success" && typeof x["started_at"] === "string")
            .map((x) => ({
              name: x["name"],
              seconds: seconds(x["started_at"], x["completed_at"]),
              steps: (Array.isArray(x["steps"]) ? x["steps"].filter(isRecord) : [])
                .map((s) => ({ name: s["name"], seconds: seconds(s["started_at"], s["completed_at"]) }))
                .sort((a, b) => b.seconds - a.seconds)
                .slice(0, 3),
            })),
        });
      } catch {
        // a run whose jobs cannot be read is left out
      }
    }
    return { name: w["name"], path: w["path"], runs, failed, timing };
  };
  for (const r of await Promise.all(workflows.sort((a, b) => (String(a["path"]) < String(b["path"]) ? -1 : 1)).map(handle))) if (r !== undefined) out2.push(r);
  result = { repository: repo, workflows: out2 };
} catch (thrown) {
  result = { repository: repo ?? null, workflows: [], error: thrown instanceof Error ? thrown.message : String(thrown) };
}
await fs.ensureDir(path.dirname(path.resolve(out)));
await fs.writeTextFile(path.resolve(out), `${JSON.stringify(result, null, 2)}\n`);
console.log(`ci-runs: ${(result["workflows"] as unknown[]).length} workflows${result["error"] === undefined ? "" : `; ${String(result["error"])}`} -> ${out}`);
