/**
 * Windows long paths (commons 0023-if-workspaces FR-012, FR-036, 0025-ifws FR-019): the finding `ifws doctor` makes of them, and the steps `ifws setup` takes. While long paths are not enabled a
 * path longer than 259 characters is an `ifws:Error` naming the path; the message "Windows long paths not enabled" is an `ifws:Informational` finding while no path exceeds the limit and an
 * `ifws:Error` once one does, and names `ifws setup` as the way.
 *
 * @remarks
 * Pure: the facts (the system, whether long paths are on, whether the process is elevated, the paths) are arguments. `setup` sets `core.longpaths` in each managed repository's local configuration
 * and, where the process is elevated, the system setting; where it is not elevated it does NOT try to elevate itself and returns the exact steps to print (`LONG_PATH_STEPS`), and the run ends with
 * `ifws:Findings`.
 *
 * @module
 */
import { type Finding } from "../findings.ts";
import { WINDOWS_PATH_LIMIT, checkPathLength } from "../portable.ts";

/** The message that Windows long paths are not enabled. */
export const LONG_PATHS_OFF = "Windows long paths not enabled";

/** The rule of the long-path findings. */
export const LONG_PATHS_RULE = "ifws/windows-long-paths";

/** The rule of one path that is too long. */
export const PATH_TOO_LONG_RULE = "ifws/path-too-long";

/** The facts of a Windows host that the finding needs. */
export type LongPathFacts = {
  /** `windows` or another system: nothing is said off Windows. */
  readonly os: "linux" | "macos" | "windows";
  /** Whether `LongPathsEnabled` is 1 for the system. */
  readonly longPathsEnabled: boolean;
  /** The workspace's paths as Windows writes them (the repositories' and the worktrees'), with their backslashes. */
  readonly paths: readonly string[];
};

/**
 * The findings of `ifws doctor` for long paths: nothing off Windows or where they are enabled; where they are not, an error for each path of more than 259 characters (naming the path), and
 * the one message `Windows long paths not enabled`, informational while no path is too long and an error once one is, naming `ifws setup`.
 */
export function longPathFindings(facts: LongPathFacts, today: string): readonly Finding[] {
  if (facts.os !== "windows" || facts.longPathsEnabled) return [];
  const out: Finding[] = [];
  for (const p of facts.paths) {
    const r = checkPathLength(p, false);
    if (r.kind === "err") {
      out.push({
        ruleId: PATH_TOO_LONG_RULE,
        severity: "Error",
        message: `${p} is ${r.error.length} characters long and Windows allows ${WINDOWS_PATH_LIMIT} while long paths are off; run \`ifws setup\` to turn long paths on, or choose a shorter root`,
        subject: p,
        firstSeen: today,
      });
    }
  }
  const anyTooLong = out.length > 0;
  out.push({
    ruleId: LONG_PATHS_RULE,
    severity: anyTooLong ? "Error" : "Informational",
    message: `${LONG_PATHS_OFF}: ${anyTooLong ? "a path of the workspace is over the limit" : "no path of the workspace is over the limit yet"}; \`ifws setup\` turns them on (it sets core.longpaths in each repository and, from an elevated shell, the system setting)`,
    subject: "windows",
    firstSeen: today,
  });
  return out;
}

/** The registry value that turns long paths on for the system (`ifws setup` runs it only where the process is elevated). */
export const LONG_PATHS_REGISTRY = {
  key: "HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem",
  name: "LongPathsEnabled",
  type: "REG_DWORD",
  data: "1",
} as const;

/** The command that turns long paths on: an argument vector, never a shell line. */
export function longPathsCommand(): readonly string[] {
  const r = LONG_PATHS_REGISTRY;
  return ["reg", "add", r.key, "/v", r.name, "/t", r.type, "/d", r.data, "/f"];
}

/** The exact steps to print where the process is not elevated (IFWS does not try to elevate itself). */
export const LONG_PATH_STEPS: readonly string[] = [
  "Open PowerShell as Administrator (right-click it and choose Run as administrator).",
  `Run: reg add "${LONG_PATHS_REGISTRY.key}" /v ${LONG_PATHS_REGISTRY.name} /t ${LONG_PATHS_REGISTRY.type} /d ${LONG_PATHS_REGISTRY.data} /f`,
  "Close and reopen your terminal and your editor so that they read the setting.",
  "Run `ifws setup --apply` again (the repositories keep `core.longpaths` either way).",
];

/** The local Git configuration `ifws setup` sets in each managed repository on Windows: an argument vector for `git -C <repo>`. */
export function repoLongPathsCommand(): readonly string[] {
  return ["config", "--local", "core.longpaths", "true"];
}
