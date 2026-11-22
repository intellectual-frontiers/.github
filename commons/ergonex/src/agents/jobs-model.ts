// Spec: 0006-agents FR-024, FR-026
/**
 * The record of a job (commons ergonex 0006-agents FR-024): its shape, its identifier, how a record is decoded, and the words of a command line without the ones that start a job. Pure; `host/jobs.ts`
 * reads and writes the records.
 *
 * @module
 */

/** The states of a job. */
export type JobState = "queued" | "running" | "succeeded" | "failed" | "abandoned";

/** The record of a job. */
export type Job = {
  readonly id: string;
  /** The command line, without any secret. */
  readonly argv: readonly string[];
  readonly state: JobState;
  readonly pid?: number;
  readonly exit?: number;
  readonly evidence?: string;
  readonly started?: string;
  readonly ended?: string;
};

/** A sortable unique identifier: the UTC time to the millisecond and a random suffix. */
export function newJobId(now: number): string {
  const r = new Uint8Array(4);
  crypto.getRandomValues(r);
  return `${new Date(now).toISOString().replace(/[-:.]/g, "")}-${[...r].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

const STATES: readonly JobState[] = ["queued", "running", "succeeded", "failed", "abandoned"];

/** The record a job file holds, or nothing where the text is not one. */
export function decodeJob(text: string): Job | undefined {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof v !== "object" || v === null) return undefined;
  const o = v as Record<string, unknown>;
  const state = STATES.find((s) => s === o["state"]);
  if (typeof o["id"] !== "string" || !Array.isArray(o["argv"]) || state === undefined) return undefined;
  return {
    id: o["id"],
    argv: o["argv"].filter((x): x is string => typeof x === "string"),
    state,
    ...(typeof o["pid"] === "number" ? { pid: o["pid"] } : {}),
    ...(typeof o["exit"] === "number" ? { exit: o["exit"] } : {}),
    ...(typeof o["evidence"] === "string" ? { evidence: o["evidence"] } : {}),
    ...(typeof o["started"] === "string" ? { started: o["started"] } : {}),
    ...(typeof o["ended"] === "string" ? { ended: o["ended"] } : {}),
  };
}

/** The words of a command line without the options that start a job (`--job`, `--plan-hash H`), which the job itself does not take. */
export function withoutJobWords(argv: readonly string[]): readonly string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const w = argv[i] ?? "";
    if (w === "--job") continue;
    if (w === "--plan-hash") {
      i++;
      continue;
    }
    if (w.startsWith("--plan-hash=")) continue;
    out.push(w);
  }
  return out;
}

/** The value of `--plan-hash` in a command line. */
export function planHashOf(argv: readonly string[]): string | undefined {
  const i = argv.indexOf("--plan-hash");
  if (i >= 0) return argv[i + 1];
  return argv.find((w) => w.startsWith("--plan-hash="))?.slice("--plan-hash=".length);
}
