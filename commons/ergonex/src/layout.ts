// Spec: 0002-workspace-model FR-001
/**
 * Where things are in the workspace (commons 0002-workspace-model FR-001, FR-006 to FR-008, FR-019, FR-020): a repository is at `<home>/<git-host>/<path...>/<repo>`, which mirrors its remote; a
 * worktree is at `<home>/.worktrees/<git-host>/<path...>/<repo>/<branch-slug>`; the path of a remote and the remote of a path are each made from the other; and a name or a depth that would not
 * be valid is refused naming it.
 *
 * @remarks
 * Pure: the root is a value the caller gives (`homeOf` reads the variable from an environment it is handed, never its own). A host or a segment of a remote named like a folder of the workspace
 * (`.worktrees`, `.ergonex`, `.git`, in any case) is refused (FR-008). A path deeper than two segments below a host without `NestedGroups` (GitHub, plain Git) is refused with the manager and the path named (FR-020).
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import { maxDepth } from "@intellectual-frontiers/githost";
import { hostKindOf, type HostKinds } from "@intellectual-frontiers/githost";
import type { HostKind, RepoRef } from "@intellectual-frontiers/githost";
import { describePortableError, foldKey, isDeviceName, type PortableError, repoPath, segment } from "./portable.ts";
import {
  describeBrandError,
  gitHost,
  type BrandError,
  type BranchName,
  type GitHost,
  type PortableSegment,
  type RepoPath,
} from "./types.ts";

/** The folders that belong to the workspace itself, which no host and no segment of a remote may be named like. */
export const WORKSPACE_FOLDERS: readonly string[] = [".worktrees", ".ergonex", ".git"];

/** Why a reference or a branch has no place in the workspace. */
export type LayoutError =
  | { readonly kind: "portable"; readonly cause: PortableError }
  | { readonly kind: "host"; readonly cause: BrandError }
  | { readonly kind: "workspace-folder"; readonly segment: string }
  | {
      readonly kind: "too-deep";
      readonly manager: HostKind;
      readonly path: readonly string[];
      readonly limit: number;
    }
  | { readonly kind: "too-shallow"; readonly path: readonly string[] }
  | { readonly kind: "not-in-layout"; readonly path: string };

/** A refusal as one sentence that names the manager, the path or the name. */
export function describeLayoutError(e: LayoutError): string {
  switch (e.kind) {
    case "portable":
      return describePortableError(e.cause);
    case "host":
      return describeBrandError(e.cause);
    case "workspace-folder":
      return `${JSON.stringify(e.segment)} is named like a folder of the workspace (${WORKSPACE_FOLDERS.join(", ")}), which a remote may not be`;
    case "too-deep":
      return `${e.path.join("/")} has ${e.path.length} segments, and ${e.manager} offers no nested groups: at most ${e.limit} (an owner and a repository)`;
    case "too-shallow":
      return `${e.path.join("/")} is not an owner and a repository`;
    case "not-in-layout":
      return `${e.path} is not a repository path of the workspace`;
    default:
      return absurd(e);
  }
}

const portable = (cause: PortableError): LayoutError => ({
  kind: "portable",
  cause,
});

/** A name checked against the folders of the workspace, in any case. */
function notWorkspaceFolder(name: string): Result<string, LayoutError> {
  return WORKSPACE_FOLDERS.some((f) => foldKey(f) === foldKey(name)) ? err({ kind: "workspace-folder", segment: name }) : ok(name);
}

/** The Git host of a reference as the first folder of its path: lower case, portable, and not named like a folder of the workspace. */
export function gitHostOf(ref: RepoRef): Result<GitHost, LayoutError> {
  const h = gitHost(ref.host);
  if (h.kind === "err") return err({ kind: "host", cause: h.error });
  const free = notWorkspaceFolder(h.value);
  if (free.kind === "err") return free;
  const s = segment(h.value);
  return s.kind === "err" ? err(portable(s.error)) : h;
}

/** The segments of a reference below the root: the host, then its path. Refuses a path deeper than the manager offers (FR-020) and every name that is not portable. */
function segmentsOfRef(ref: RepoRef): Result<readonly string[], LayoutError> {
  if (ref.path.length < 2) return err({ kind: "too-shallow", path: ref.path });
  const limit = maxDepth(ref.kind);
  if (ref.path.length > limit) return err({ kind: "too-deep", manager: ref.kind, path: ref.path, limit });
  const host = gitHostOf(ref);
  if (host.kind === "err") return host;
  for (const s of ref.path) {
    const free = notWorkspaceFolder(s);
    if (free.kind === "err") return free;
  }
  return ok([host.value, ...ref.path]);
}

/** The path of a repository: `<git-host>/<path...>/<repo>` (FR-006). */
export function repoPathOf(ref: RepoRef): Result<RepoPath, LayoutError> {
  const segments = segmentsOfRef(ref);
  if (segments.kind === "err") return segments;
  const p = repoPath(segments.value);
  return p.kind === "err" ? err(portable(p.error)) : p;
}

/**
 * A branch as one path segment for its worktree: each character Windows would refuse, and `/`, becomes `-`, repeated `-` become one, a trailing dot or space and the dashes at either end are
 * dropped, and a device name gets an underscore after it. `feature/x.` is `feature-x` and `a:b` is `a-b`; a name that has nothing left is refused.
 */
export function slugOf(text: string): Result<PortableSegment, PortableError> {
  // eslint-disable-next-line no-control-regex
  const replaced = text.normalize("NFC").replace(/[\u0000-\u001f\u007f<>:"/\\|?*~^[\]\s]+/g, "-");
  let slug = replaced
    .replace(/-{2,}/g, "-")
    .replace(/[-. ]+$/, "")
    .replace(/^[-.]+/, "");
  if (isDeviceName(slug)) {
    const dot = slug.indexOf(".");
    slug = dot < 0 ? `${slug}_` : `${slug.slice(0, dot)}_${slug.slice(dot)}`;
  }
  return segment(slug);
}

/** The path of a worktree of a repository for a branch: `.worktrees/<git-host>/<path...>/<repo>/<branch-slug>` (FR-007). */
export function worktreePathOf(ref: RepoRef, branch: BranchName | string): Result<RepoPath, LayoutError> {
  const segments = segmentsOfRef(ref);
  if (segments.kind === "err") return segments;
  const slug = slugOf(branch);
  if (slug.kind === "err") return err(portable(slug.error));
  const p = repoPath([".worktrees", ...segments.value, slug.value]);
  return p.kind === "err" ? err(portable(p.error)) : p;
}

/**
 * The reference a path of the workspace mirrors, the reverse of `repoPathOf`: its first segment is the host and the kind of host is the manifest's (`hostKinds`), GitHub for `github.com` and
 * GitLab for `gitlab.com`. A path under `.worktrees` or `.ergonex`, or of fewer than three segments, is not a repository's.
 */
export function refOfPath(path: RepoPath, hostKinds: HostKinds = {}): Result<RepoRef, LayoutError> {
  const [host, ...rest] = path.split("/");
  if (host === undefined || rest.length < 2 || WORKSPACE_FOLDERS.some((f) => foldKey(f) === foldKey(host)))
    return err({ kind: "not-in-layout", path });
  return ok({ kind: hostKindOf(host, hostKinds), host, path: rest });
}

/** What the environment gives of where the workspace is. */
export type HomeFacts = {
  /** `ERGONEX_HOME`, if set. */
  readonly workspacesHome?: string | undefined;
  /** `HOME` on Linux and macOS, `USERPROFILE` on Windows. */
  readonly home?: string | undefined;
  readonly windows: boolean;
  /** `--home` of this run. */
  readonly override?: string | undefined;
};

/** Why no root could be found. */
export type HomeError = { readonly kind: "no-home" };

/** The root of the workspace: `--home`, else `$ERGONEX_HOME`, else `$HOME/workspaces` (`%USERPROFILE%\workspaces` on Windows) (FR-001). */
export function homeOf(facts: HomeFacts): Result<string, HomeError> {
  const nonEmpty = (s: string | undefined): string | undefined => (s === undefined || s.trim() === "" ? undefined : s);
  const explicit = nonEmpty(facts.override) ?? nonEmpty(facts.workspacesHome);
  if (explicit !== undefined) return ok(explicit);
  const home = nonEmpty(facts.home);
  if (home === undefined) return err({ kind: "no-home" });
  return ok(`${home.replace(/[\\/]+$/, "")}${facts.windows ? "\\" : "/"}workspaces`);
}

/** What is known of a repository's checkout when a worktree is asked for. */
export type WorktreeFacts = {
  /** The checkout has uncommitted changes (work that a branch change would disturb). */
  readonly uncommittedWork: boolean;
  /** Another person or agent is working in the repository (its own checkout, or another worktree, is in use). */
  readonly otherWorker: boolean;
};

/** Whether a worktree is to be made: only where another person or agent, or uncommitted work, is on the repository; otherwise the repository's own checkout is the place to work (FR-007). */
export function worktreeWanted(facts: WorktreeFacts): boolean {
  return facts.uncommittedWork || facts.otherWorker;
}
