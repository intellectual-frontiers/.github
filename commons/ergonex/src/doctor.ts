// Spec: 0002-workspace-model FR-012
/**
 * The checks of `ergonex doctor` as pure functions over facts a host layer probed (commons 0002-workspace-model FR-012, FR-014, FR-036, 0001-ergonex FR-014): the runtime and the tools, the portability of
 * every path (Windows' 259 characters unless long paths are on), the file system of the root (FAT, exFAT, a network share, a Windows drive under WSL, each as found by a probe and never guessed from the
 * path), and the hooks of each repository. Each check is `ok`, `suggest`, `warn` or `error`, each with what to do, and becomes a finding of the severity it names.
 *
 * @remarks
 * A message states what is wrong and what to do. A check that could not be made says so (`suggest`, with the reason) and is never a pass. The plaintext-token scan, signed commits and the tools and
 * modules outside the catalog are the policy scans' (`workspaces/scan/`), which the command adds to these through its list of extra checks.
 *
 * @module
 */
import { absurd } from "@intellectual-frontiers/core";
import { parseSemVer } from "@intellectual-frontiers/commons/ts/kernel";
import type { Finding, Severity } from "./findings.ts";
import { checkPathLength, nativePath, REPO_PATH_ROOM, repoPathLength, WINDOWS_PATH_LIMIT } from "./portable.ts";
import type { RepoPath } from "./types.ts";

/** What a check came to: the four words of `ergonex doctor`. */
export type Level = "ok" | "suggest" | "warn" | "error";

/** One check and what it found. */
export type Check = {
  /** The rule, such as `ergonex/path-too-long`. */
  readonly id: string;
  readonly level: Level;
  /** What it is about: a path, a tool, a repository. */
  readonly subject: string;
  /** What is wrong and what to do about it, or, for `ok`, what was found. */
  readonly message: string;
};

/** The severity a level becomes; `ok` is none. */
export function severityOf(level: Level): Severity | undefined {
  switch (level) {
    case "ok":
      return undefined;
    case "suggest":
      return "Informational";
    case "warn":
      return "Warning";
    case "error":
      return "Error";
    default:
      return absurd(level);
  }
}

/** The findings of a list of checks, each first seen `today`. */
export function findingsOf(checks: readonly Check[], today: string): readonly Finding[] {
  return checks.flatMap((c): Finding[] => {
    const severity = severityOf(c.level);
    return severity === undefined
      ? []
      : [
          {
            ruleId: c.id,
            severity,
            message: c.message,
            subject: c.subject,
            firstSeen: today,
          },
        ];
  });
}

/** What a probe of the root's file system found, or why it was not made. */
export type FsProbe =
  { readonly kind: "found"; readonly type: string; readonly wsl: boolean } | { readonly kind: "not-run"; readonly reason: string };

/** The kinds of file system the workspace warns about. */
export type FsKind = "ok" | "fat" | "exfat" | "network" | "wsl-windows-drive";

/** The kind of a file system by the type a probe reported (`vfat`, `exfat`, `nfs`, `9p`), and whether the system is WSL. */
export function classifyFs(type: string, wsl: boolean): FsKind {
  const t = type.toLowerCase();
  if (["msdos", "vfat", "fat", "fat32", "fat16"].includes(t)) return "fat";
  if (t === "exfat") return "exfat";
  if (["9p", "drvfs", "v9fs"].includes(t) && wsl) return "wsl-windows-drive";
  if (
    [
      "nfs",
      "nfs3",
      "nfs4",
      "cifs",
      "smb",
      "smb2",
      "smb3",
      "smbfs",
      "afpfs",
      "9p",
      "v9fs",
      "sshfs",
      "fuse.sshfs",
      "webdav",
      "ncpfs",
      "fuse.rclone",
    ].includes(t)
  )
    return "network";
  return "ok";
}

/** The check of the file system of the root. */
export function fsCheck(probe: FsProbe, home: string): Check {
  if (probe.kind === "not-run")
    return {
      id: "ergonex/filesystem",
      level: "suggest",
      subject: home,
      message: `the file system of the root was not probed: ${probe.reason}`,
    };
  const kind = classifyFs(probe.type, probe.wsl);
  const at = (level: Level, message: string): Check => ({
    id: "ergonex/filesystem",
    level,
    subject: home,
    message,
  });
  switch (kind) {
    case "ok":
      return at("ok", `the root is on a file system of type ${probe.type}`);
    case "fat":
      return at(
        "warn",
        `the root is on a FAT file system (${probe.type}): it has no execute bit and a two-second time resolution, so hooks may not run; move the root to NTFS, APFS or ext4`,
      );
    case "exfat":
      return at(
        "warn",
        "the root is on an exFAT file system: it has no execute bit and a two-second time resolution, so hooks may not run; move the root to NTFS, APFS or ext4",
      );
    case "network":
      return at(
        "warn",
        `the root is on a network share (${probe.type}): its locks are not reliable, so two runs may write at once; move the root to a local disk`,
      );
    case "wsl-windows-drive":
      return at(
        "warn",
        "the root is on a Windows drive seen from WSL (/mnt/c): it is slow and case-insensitive; keep the root in the Linux file system, or run ergonex from Windows",
      );
    default:
      return absurd(kind);
  }
}

/** What is known of the version of a tool. */
export type ToolProbe = {
  readonly name: string;
  readonly version: string | undefined;
};

/** The oldest Node `ergonex` runs on (Node 26 is the backup runtime). */
export const MIN_NODE_MAJOR = 26;

/** The checks of the runtime and of the tools: git must be there; the runtime must be Bun, or Node 26 or later; the other runtime, where it is missing, is a suggestion. */
export function runtimeChecks(
  runtime: { readonly name: "bun" | "node"; readonly version: string },
  tools: readonly ToolProbe[],
): readonly Check[] {
  const out: Check[] = [];
  const major = parseSemVer(runtime.version.replace(/^v/, ""));
  if (runtime.name === "node" && major.kind === "ok" && major.value.major < MIN_NODE_MAJOR)
    out.push({
      id: "ergonex/runtime",
      level: "error",
      subject: "node",
      message: `ergonex runs on Node ${MIN_NODE_MAJOR} or later, and this is Node ${runtime.version}; install Node ${MIN_NODE_MAJOR} or run ergonex with Bun`,
    });
  else
    out.push({
      id: "ergonex/runtime",
      level: "ok",
      subject: runtime.name,
      message: `running on ${runtime.name} ${runtime.version}`,
    });
  for (const t of tools) {
    if (t.version === undefined) {
      const needed = t.name === "git";
      const isRuntime = t.name === runtime.name;
      out.push({
        id: "ergonex/tool",
        level: needed ? "error" : isRuntime ? "ok" : "suggest",
        subject: t.name,
        message: needed
          ? `git is not installed or not on the PATH; ergonex needs it, and does not install it: install git from your system's package manager`
          : `${t.name} was not found on the PATH; ${t.name === "bun" ? "Bun is the default runtime" : `Node ${MIN_NODE_MAJOR} is the backup runtime`}, and ergonex does not install it: install it to have both`,
      });
    } else
      out.push({
        id: "ergonex/tool",
        level: "ok",
        subject: t.name,
        message: `${t.name} ${t.version}`,
      });
  }
  return out;
}

/** What the long-path setting of Windows is. */
export type LongPaths = "enabled" | "disabled" | "unknown";

/** What the path checks are given. */
export type PathFacts = {
  readonly home: string;
  readonly windows: boolean;
  readonly longPaths: LongPaths;
  /** Every path of the workspace the manifest and the templates name: repositories, worktrees, generated files. */
  readonly paths: readonly RepoPath[];
};

/**
 * The checks of path length (0002-workspace-model FR-012, FR-036): on Windows while long paths are off, a path longer than 259 characters is an error naming it and saying that `ergonex setup` can turn
 * long paths on; and that long paths are not enabled is informational while no path exceeds the limit. Elsewhere the limit does not apply.
 */
export function pathChecks(f: PathFacts): readonly Check[] {
  if (!f.windows)
    return [
      {
        id: "ergonex/path-length",
        level: "ok",
        subject: f.home,
        message: "the 259-character limit of Windows does not apply on this system",
      },
    ];
  const long = f.longPaths === "enabled";
  const tooLong = f.paths.flatMap((p) => {
    const native = nativePath(f.home, p, "\\");
    const r = checkPathLength(native, long);
    return r.kind === "err" ? [r.error] : [];
  });
  const out: Check[] = tooLong.map((e) => ({
    id: "ergonex/path-too-long",
    level: "error",
    subject: e.path,
    message: `${e.path} is ${e.length} characters, over the ${WINDOWS_PATH_LIMIT} Windows allows while long paths are off; run \`ergonex setup\` to turn long paths on, or move the root to a shorter path`,
  }));
  if (!long && tooLong.length === 0)
    out.push({
      id: "ergonex/windows-long-paths",
      level: "suggest",
      subject: f.home,
      message:
        f.longPaths === "unknown"
          ? "Windows long paths are not known to be enabled (the setting could not be read); no path of the workspace exceeds 259 characters yet; run `ergonex setup` to turn them on"
          : "Windows long paths not enabled; no path of the workspace exceeds 259 characters yet; run `ergonex setup` to turn them on",
    });
  if (long)
    out.push({
      id: "ergonex/windows-long-paths",
      level: "ok",
      subject: f.home,
      message: "Windows long paths are enabled",
    });
  return out;
}

/**
 * The checks of the length of each repository's own path (0002-workspace-model FR-048), on every system: over 150 characters is informational (it leaves little room for the files inside the repository),
 * over 259 an error whether or not long paths are enabled. A repository whose path fits has no check of its own.
 */
export function repoPathChecks(f: {
  readonly home: string;
  readonly windows: boolean;
  readonly repositories: readonly RepoPath[];
}): readonly Check[] {
  const out: Check[] = [];
  for (const repo of f.repositories) {
    const native = nativePath(f.home, repo, f.windows ? "\\" : "/");
    const r = repoPathLength(f.home, repo, f.windows ? "\\" : "/");
    switch (r.kind) {
      case "fits":
        break;
      case "no-room":
        out.push({
          id: "ergonex/repo-path-room",
          level: "suggest",
          subject: native,
          message: `${native} is ${r.length} characters, over ${REPO_PATH_ROOM}: that leaves little room for the files inside the repository; move the root to a shorter path`,
        });
        break;
      case "too-long":
        out.push({
          id: "ergonex/repo-path-too-long",
          level: "error",
          subject: native,
          message: `${native} is ${r.length} characters, over ${WINDOWS_PATH_LIMIT}, which is too long for a repository whether or not long paths are enabled; move the root to a shorter path or shorten the repository's path in the manifest`,
        });
        break;
      default:
        return absurd(r);
    }
  }
  return out;
}

/** What is known of a repository's hooks. */
export type HookFacts = {
  readonly repo: RepoPath;
  /** The repository is on disk (its state is not `Missing`). */
  readonly present: boolean;
  /** The repository's local `core.hooksPath`, if it sets one. */
  readonly hooksPath: string | undefined;
};

/** The checks of the hooks: a repository on disk whose local `core.hooksPath` is not the workspace's is a warning that says to run `ergonex apply`. */
export function hookChecks(facts: readonly HookFacts[], wantedHooksPath: string): readonly Check[] {
  return facts
    .filter((f) => f.present)
    .map((f) =>
      f.hooksPath === wantedHooksPath
        ? {
            id: "ergonex/hooks",
            level: "ok" as const,
            subject: f.repo,
            message: "the workspace's hooks are set",
          }
        : {
            id: "ergonex/hooks",
            level: "warn" as const,
            subject: f.repo,
            message:
              f.hooksPath === undefined
                ? `${f.repo} does not use the workspace's hooks (core.hooksPath is not set in its local configuration); run \`ergonex apply\``
                : `${f.repo} uses other hooks than the workspace's (its core.hooksPath is elsewhere); run \`ergonex apply\` to replace it`,
          },
    );
}
