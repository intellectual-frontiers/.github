// Spec: 0010-workload-runners FR-014; 0014-runner-github-actions FR-010; 0015-schedule-realization FR-010
/**
 * The generated artifacts of the integration runners for the fixtures of the library, from the code, in `commons/workload/artifacts/`: the script of `synthetic-bootstrap-01` for each runner (`bash`, `pwsh` and the workflow of
 * `github-actions`), the workflow of the graph `synthetic-graph-01` (a schedule, a loop and a gate that a person approves), and for the scheduled graph `synthetic-graph-02` the script of each runner and the files that start it on
 * a schedule (a cron line and a systemd timer with its service, for `bash` and `pwsh`, under `schedule/`). `bun commons/workload/tools/runners.ts` writes them and `--check` writes nothing and says which differ (a stale artifact, or one
 * edited by hand, is `E-WL-RUNNER-DRIFT`), as every generator of this repository does.
 *
 * @module
 */
import { authored, describeFinding, runnerId } from "../src/governance/mod.ts";
import { bootstrapFleet, SYNTHETIC_BOOTSTRAP_01 } from "../src/logical/forms/runbook/mod.ts";
import { graphFleet, SYNTHETIC_GRAPH_01, SYNTHETIC_GRAPH_02 } from "../src/logical/forms/graph/mod.ts";
import { type AnyWorkload, checkArtifact, checkSchedule, emitSchedule, emitWorkload } from "../src/physical/mod.ts";
import { fs, path, proc } from "@intellectual-frontiers/system";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..", "..", "..");
const FOLDER = "commons/workload/artifacts";
const INPUT = { fleet: (over: "tenants" | "hosts" | "fleets", source: string) => bootstrapFleet(over, source) ?? graphFleet(over, source) };

/** The artifacts of the fixtures: the workload, and the runners that carry it. */
export const FIXTURE_RUNNERS: readonly { readonly workload: AnyWorkload; readonly runners: readonly string[]; readonly schedule: readonly string[] }[] = [
  { workload: SYNTHETIC_BOOTSTRAP_01, runners: ["bash", "pwsh", "github-actions"], schedule: [] },
  { workload: SYNTHETIC_GRAPH_01, runners: ["github-actions"], schedule: [] },
  { workload: SYNTHETIC_GRAPH_02, runners: ["bash", "pwsh", "github-actions"], schedule: ["bash", "pwsh"] },
];

/** Every file this writes, with its text, by its path from the root of the repository. */
export async function outputs(): Promise<Readonly<Record<string, string>>> {
  const out: Record<string, string> = {};
  for (const f of FIXTURE_RUNNERS) {
    for (const r of f.runners) {
      const made = await emitWorkload(f.workload, authored(runnerId(r)), INPUT);
      if (made.kind === "err") throw new Error(made.error.map(describeFinding).join("\n"));
      out[`${FOLDER}/${made.value.path}`] = made.value.text;
    }
    for (const r of f.schedule) {
      const made = await emitSchedule(f.workload, authored(runnerId(r)), INPUT);
      if (made.kind === "err") throw new Error(made.error.map(describeFinding).join("\n"));
      for (const file of made.value.files) out[`${FOLDER}/schedule/${file.path}`] = file.text;
    }
  }
  return out;
}

if (import.meta.main) {
  const check = proc.args.includes("--check");
  const stale: string[] = [];
  const made = await outputs();
  for (const [file, text] of Object.entries(made)) {
    const full = path.join(ROOT, file);
    const have = (await fs.exists(full)) ? await fs.readTextFile(full) : undefined;
    if (have === text) continue;
    stale.push(file);
    if (!check) {
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeTextFile(full, text);
    }
  }
  if (check) {
    for (const f of FIXTURE_RUNNERS) {
      for (const r of f.runners) {
        const ext = r === "bash" ? "sh" : r === "pwsh" ? "ps1" : "yml";
        const full = path.join(ROOT, FOLDER, `${f.workload.id}.${ext}`);
        if (!(await fs.exists(full))) continue;
        for (const found of await checkArtifact(await fs.readTextFile(full), f.workload, authored(runnerId(r)), INPUT)) console.error(describeFinding(found));
      }
      for (const r of f.schedule) {
        const files: Record<string, string> = {};
        for (const ext of ["cron", "service", "timer"]) {
          const full = path.join(ROOT, FOLDER, "schedule", r, `${f.workload.id}.${ext}`);
          if (await fs.exists(full)) files[`${r}/${f.workload.id}.${ext}`] = await fs.readTextFile(full);
        }
        for (const found of await checkSchedule(files, f.workload, authored(runnerId(r)), INPUT)) console.error(describeFinding(found));
      }
    }
  }
  if (check && stale.length > 0) {
    console.error(`stale: ${stale.join(", ")}: run bun commons/workload/tools/runners.ts`);
    proc.exit(1);
  }
  console.log(check ? "the artifacts are current" : `wrote ${stale.length} files`);
}
