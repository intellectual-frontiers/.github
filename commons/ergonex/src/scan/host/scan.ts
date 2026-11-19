// Spec: 0002-workspace-model FR-003
/**
 * The host layer of the policy scans (commons 0002-workspace-model FR-003, FR-031, FR-032): reads inside the root and only there (a path that would leave it, a link that leads out of it, a file of
 * `~/.ssh` or a credential store is refused and said), hands the text of the generated files, the manifest and each repository's local Git configuration to the secrets scanner, reads the
 * signature letters of the commits of a managed repository with real `git`, and finds the `ergonex-*` executables on the `PATH`.
 *
 * @remarks
 * It never prints or returns the text of a line: only the findings of `secrets.ts`. A file larger than a mebibyte is not read as text and is reported as a note, never skipped silently.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import { readDirSync, readTextFile, realPath, lstat } from "../../platform/r-fs.ts";
import { isInside, readablePath, resolveInside, type BoundaryError } from "../boundary.ts";
import { type Finding } from "../../findings.ts";
import { output } from "../../platform/r-proc.ts";
import { NotFound } from "../../platform/r-errors.ts";
import { delimiter, join } from "../../platform/r-path.ts";
import { type CommitSignature, type FoundModule, isModuleName, signatureLetter } from "../policy-scans.ts";
import { scanText, secretFinding } from "../secrets.ts";

/** The largest file the scan reads as text. */
export const MAX_SCAN_BYTES = 1024 * 1024;

/** Why a read inside the root failed. */
export type ReadError =
  | BoundaryError
  | {
      readonly kind: "unreadable";
      readonly path: string;
      readonly reason: string;
    };

/** A file's text, read from inside the root: the path is resolved against the root, refused where it would leave it or is forbidden, and the real path (after links) must still be inside. */
export async function readInside(root: string, relative: string): Promise<Result<string | undefined, ReadError>> {
  const path = readablePath(root, relative);
  if (path.kind === "err") return path;
  try {
    const info = await lstat(path.value);
    if (info.isSymlink) {
      const real = await realPath(path.value);
      const rootReal = await realPath(root);
      if (!isInside(rootReal, real))
        return err({
          kind: "outside",
          path: relative,
          reason: "it is a link that leads out of the root",
        });
    }
    if (info.size > MAX_SCAN_BYTES)
      return err({
        kind: "unreadable",
        path: relative,
        reason: "it is larger than the scan reads as text",
      });
    return ok(await readTextFile(path.value));
  } catch (e) {
    if (e instanceof NotFound) return ok(undefined);
    return err({
      kind: "unreadable",
      path: relative,
      reason: e instanceof Error ? e.message : String(e),
    });
  }
}

/** What a scan of the files found. */
export type ScanReport = {
  readonly findings: readonly Finding[];
  /** The files that were read. */
  readonly scanned: readonly string[];
  /** The files that were asked for and refused, each with why: a path outside the root, a forbidden file, one too large. */
  readonly refused: readonly {
    readonly path: string;
    readonly reason: string;
  }[];
};

/**
 * Scans the files (paths relative to the root, with `/` between parts) for plaintext secrets: a missing file is not an error (the manifest of a workspace that has none yet), a refused file
 * is told, and every finding names the file and the line and never the secret (0002-workspace-model FR-031).
 */
export async function scanRoot(root: string, files: readonly string[], today: string): Promise<ScanReport> {
  const findings: Finding[] = [];
  const scanned: string[] = [];
  const refused: { path: string; reason: string }[] = [];
  for (const f of files) {
    const text = await readInside(root, f);
    if (text.kind === "err") {
      refused.push({
        path: f,
        reason: text.error.kind === "unreadable" ? text.error.reason : text.error.reason,
      });
      continue;
    }
    if (text.value === undefined) continue;
    scanned.push(f);
    for (const hit of scanText(f, text.value)) findings.push(secretFinding(hit, today));
  }
  return { findings, scanned, refused };
}

/** The files of a managed repository that hold local Git configuration, relative to the root: `<repo>/.git/config` (and `config.worktree` beside it where a worktree is used). */
export function gitConfigFilesOf(repoPath: string): readonly string[] {
  return [`${repoPath}/.git/config`, `${repoPath}/.git/config.worktree`];
}

/** The signature letters of the last commits of a repository (`git log --format=%H %G?`), newest first, or why git could not say. `range` is a revision range (`HEAD` by default). */
export async function commitSignatures(repo: string, range = "HEAD", limit = 50): Promise<Result<readonly CommitSignature[], string>> {
  try {
    // the commit, Git's signature letter, the committer's address and the key's fingerprint and id, separated by the unit separator (an address has no space, a fingerprint may be empty)
    const out = await output(["git", "-C", repo, "log", `--max-count=${limit}`, "--format=%H%x1f%G?%x1f%ce%x1f%GF%x1f%GK", range, "--"], {
      stdout: "piped",
      stderr: "piped",
    });
    if (!out.success) return err(new TextDecoder().decode(out.stderr).trim().split("\n")[0] ?? "git log failed");
    const commits: CommitSignature[] = [];
    for (const line of new TextDecoder().decode(out.stdout).split("\n")) {
      const [commit, said, account, fingerprint, keyId] = line.trim().split("\x1f");
      const letter = said === undefined ? undefined : signatureLetter(said);
      const keys = [fingerprint, keyId].filter((k): k is string => k !== undefined && k !== "");
      if (commit !== undefined && commit !== "" && letter !== undefined)
        commits.push({
          repo,
          commit,
          letter,
          ...(account === undefined || account === "" ? {} : { account }),
          ...(keys.length === 0 ? {} : { keys }),
        });
    }
    return ok(commits);
  } catch (e) {
    return err(e instanceof NotFound ? "git is not on the path" : e instanceof Error ? e.message : String(e));
  }
}

/** The `ergonex-*` executables on a `PATH` (the first of each name), with the day first seen from the state record where there is one (else `today`). */
export function modulesOnPath(
  pathVar: string,
  firstSeen: Readonly<Record<string, string>>,
  today: string,
  isWindows = false,
): readonly FoundModule[] {
  const seen = new Set<string>();
  const out: FoundModule[] = [];
  for (const dir of pathVar.split(delimiter)) {
    if (dir === "") continue;
    let names: string[];
    try {
      names = readDirSync(dir)
        .filter((e) => e.isFile || e.isSymlink)
        .map((e) => e.name);
    } catch {
      continue;
    }
    for (const raw of names.sort()) {
      const name = isWindows ? raw.replace(/\.(?:exe|cmd|bat|ps1)$/i, "") : raw;
      if (!isModuleName(name) || seen.has(name)) continue;
      seen.add(name);
      out.push({
        name,
        source: "path",
        firstSeen: Object.hasOwn(firstSeen, name) ? (firstSeen[name] ?? today) : today,
      });
    }
  }
  return out;
}

/** The path of a file below the root, for a caller that writes: refused where it would leave the root (the writing itself is the caller's, through the one-writer lock). */
export function writablePath(root: string, relative: string): Result<string, BoundaryError> {
  return resolveInside(root, relative);
}

/** Where a path of the root is on the file system (a convenience for the callers that join a root and a relative path with the platform's separator). */
export function onDisk(root: string, relative: string): string {
  return join(root, ...relative.split("/"));
}
