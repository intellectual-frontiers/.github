// Spec: 0006-agents FR-024, FR-026
/**
 * The jobs of an agent (commons ergonex 0006-agents FR-024 to FR-026): a long run that outlives the SSH session that started it, with a record under `<workspace area>/jobs/<id>/`.
 *
 * @module
 */
import { mkdir, readTextOr, writeTextFile, rename, listDirs } from "../../platform/r-fs.ts";
import { join } from "../../platform/r-path.ts";
import { AREA } from "../../host/workspace.ts";
import { decodeJob, type Job } from "../jobs-model.ts";

export { type Job, type JobState, newJobId, planHashOf, withoutJobWords } from "../jobs-model.ts";


/** The folder of the jobs. */
export const jobsFolder = (home: string): string => join(home, AREA, "jobs");



/** Whether a process is alive (a signal of 0 only asks). */
export function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e instanceof Error && "code" in e && e.code === "EPERM";
  }
}


/** Writes the record whole beside the old one and renames it over. */
export async function writeJob(home: string, job: Job): Promise<void> {
  const folder = join(jobsFolder(home), job.id);
  await mkdir(folder, { recursive: true });
  const side = join(folder, `job.json.${process.pid}`);
  await writeTextFile(side, `${JSON.stringify(job, null, 2)}\n`);
  await rename(side, join(folder, "job.json"));
}

/** One job as it is now: where it says `running` or `queued` and its process is not alive, it is `abandoned`; the record and its evidence stay as they are (FR-026). */
export async function readJob(home: string, id: string): Promise<Job | undefined> {
  const text = await readTextOr(join(jobsFolder(home), id, "job.json"), undefined);
  const job = text === undefined ? undefined : decodeJob(text);
  if (job === undefined) return undefined;
  if ((job.state === "running" || job.state === "queued") && (job.pid === undefined || !alive(job.pid))) return { ...job, state: "abandoned" };
  return job;
}

/** Every job, in the order of their identifiers. */
export async function jobsOf(home: string): Promise<readonly Job[]> {
  const folder = jobsFolder(home);
  let ids: string[] = [];
  try {
    ids = [...(await listDirs(folder))];
  } catch {
    return [];
  }
  const out: Job[] = [];
  for (const id of ids.sort()) {
    const j = await readJob(home, id);
    if (j !== undefined) out.push(j);
  }
  return out;
}


