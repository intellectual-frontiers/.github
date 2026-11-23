// Spec: 0004-native-pinned-dialect FR-003
/**
 * The plan file: the generated list of tools the program of the dialect checks or applies. It says it is generated, holds for each tool what the program needs (its name, version, program, other
 * names, scope, minimum and source) and the policy it decides by, and holds no secret. The program reads it back and refuses what is not one.
 *
 * @example
 * ```ts
 * import { readPlanFile } from "./plan-file.ts";
 * readPlanFile("{}").kind; // "err"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { GENERATED_MARK } from "@intellectual-frontiers/archon/dialect";

/** Where a tool comes from, as the plan file says: a download a pin gave, or a pin with no download and the reason. */
export type JobSource =
  | { readonly kind: "download"; readonly pin: string; readonly version: string; readonly downloadUrl: string; readonly sha256: string; readonly archiveFormat: "zip" | "tar" | "file"; readonly binPath: string }
  | { readonly kind: "unpinned"; readonly pin: string; readonly reason: string };

/** One tool of a plan file. */
export type ToolJob = {
  readonly tool: string;
  /** The version it is carried out at; none where nothing pins one. */
  readonly version: string | null;
  readonly program: string;
  readonly alsoNamed: readonly string[];
  readonly versionArgs: readonly string[];
  readonly minimum: string | null;
  readonly source: JobSource;
};

/** What the program decides by. */
export type Policy = { readonly systemCopy: "minimum" | "never"; readonly integrity: "rolling" | "release-line" | "exact-hashed" };

/** A plan file. */
export type PlanFile = { readonly format: "native-pinned-plan/1"; readonly platform: string; readonly policy: Policy; readonly jobs: readonly ToolJob[] };

/** The text of a plan file: JSON that says it is generated, with its keys in a fixed order. */
export function planFileText(p: PlanFile): string {
  const body = {
    format: p.format,
    platform: p.platform,
    policy: { systemCopy: p.policy.systemCopy, integrity: p.policy.integrity },
    jobs: p.jobs.map((j) => ({
      tool: j.tool,
      version: j.version,
      program: j.program,
      alsoNamed: [...j.alsoNamed],
      versionArgs: [...j.versionArgs],
      minimum: j.minimum,
      source: j.source.kind === "download"
        ? { kind: j.source.kind, pin: j.source.pin, version: j.source.version, downloadUrl: j.source.downloadUrl, sha256: j.source.sha256, archiveFormat: j.source.archiveFormat, binPath: j.source.binPath }
        : { kind: j.source.kind, pin: j.source.pin, reason: j.source.reason },
    })),
  };
  return JSON.stringify({ _generated: GENERATED_MARK, ...body }, null, 2) + "\n";
}

function isRecord(v: unknown): v is Readonly<Record<string, unknown>> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function strings(v: unknown): readonly string[] | undefined {
  return Array.isArray(v) && v.every((x) => typeof x === "string") ? v.map(String) : undefined;
}

function jobOf(v: unknown, at: string): Result<ToolJob, string> {
  if (!isRecord(v)) return err(`${at} is not an object`);
  const { tool, version, program, alsoNamed, versionArgs, minimum, source } = v;
  if (typeof tool !== "string" || typeof program !== "string") return err(`${at} names no tool and program`);
  if (version !== null && typeof version !== "string") return err(`${at}: the version is a text or null`);
  if (minimum !== null && typeof minimum !== "string") return err(`${at}: the minimum is a text or null`);
  const names = strings(alsoNamed);
  const args = strings(versionArgs);
  if (names === undefined || args === undefined) return err(`${at}: the other names and the version arguments are lists of text`);
  if (!isRecord(source)) return err(`${at}: it has no source`);
  const kind = source["kind"];
  const pin = source["pin"];
  if (typeof pin !== "string") return err(`${at}: its source names no pin`);
  if (kind === "unpinned") {
    const reason = source["reason"];
    return typeof reason === "string" ? ok({ tool, version, program, alsoNamed: names, versionArgs: args, minimum, source: { kind, pin, reason } }) : err(`${at}: an unpinned source gives its reason`);
  }
  if (kind !== "download") return err(`${at}: a source is a download or unpinned`);
  const { version: sv, downloadUrl, sha256, archiveFormat, binPath } = source;
  if (typeof sv !== "string" || typeof downloadUrl !== "string" || typeof sha256 !== "string" || typeof binPath !== "string") return err(`${at}: a download names its version, address, SHA-256 and folder`);
  if (archiveFormat !== "zip" && archiveFormat !== "tar" && archiveFormat !== "file") return err(`${at}: the format of a download is zip, tar or file`);
  return ok({ tool, version, program, alsoNamed: names, versionArgs: args, minimum, source: { kind, pin, version: sv, downloadUrl, sha256, archiveFormat, binPath } });
}

/** A plan file from its text, or why it is not one. */
export function readPlanFile(text: string): Result<PlanFile, string> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return err("the plan file is not JSON");
  }
  if (!isRecord(raw)) return err("the plan file is not an object");
  if (raw["format"] !== "native-pinned-plan/1") return err("the plan file is not of the format native-pinned-plan/1");
  const platform = raw["platform"];
  const policy = raw["policy"];
  if (typeof platform !== "string") return err("the plan file names no platform");
  if (!isRecord(policy)) return err("the plan file has no policy");
  const systemCopy = policy["systemCopy"];
  const integrity = policy["integrity"];
  if (systemCopy !== "minimum" && systemCopy !== "never") return err("the policy systemCopy is minimum or never");
  if (integrity !== "rolling" && integrity !== "release-line" && integrity !== "exact-hashed") return err("the policy integrity is rolling, release-line or exact-hashed");
  const list = raw["jobs"];
  if (!Array.isArray(list)) return err("the plan file has no list of jobs");
  const jobs: ToolJob[] = [];
  for (const [i, j] of list.entries()) {
    const r = jobOf(j, `job ${i + 1}`);
    if (r.kind === "err") return r;
    jobs.push(r.value);
  }
  return ok({ format: "native-pinned-plan/1", platform, policy: { systemCopy, integrity }, jobs });
}
