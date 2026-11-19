// Spec: 0002-workspace-model FR-021
/**
 * What the manifest wants, as the plan reads it (commons 0002-workspace-model FR-021, 0003-host FR-013): the repositories with the settings of their own local Git configuration, the worktrees,
 * and the generated files with the SHA-256 of their bytes. The target state of the source state.
 *
 * @remarks
 * The settings are only ever those of a repository's local configuration, never the global or the system's: `core.hooksPath` (the absolute path of `<home>/.ergonex/hooks`, with `/` between
 * segments), the commit signing the policy requires (`commit.gpgsign`, `gpg.format`, `user.signingkey`), `user.name` and `user.email` where the manifest names them, and on Windows `core.longpaths`.
 * Pure: the root and the platform are arguments.
 *
 * @module
 */
import { type Sha256 } from "@intellectual-frontiers/commons/ts/kernel";
import type { Manifest } from "./manifest.ts";
import type { Desired, DesiredFile, DesiredRepo, DesiredWorktree } from "./plan.ts";
import { fileDigest, type GeneratedFile } from "./render.ts";

/** What the settings depend on besides the manifest. */
export type DesiredFacts = {
  /** The root, as an absolute path with `/` between segments (`C:/Users/a/workspaces` on Windows). */
  readonly homePosix: string;
  readonly windows: boolean;
};

/** The settings of every managed repository's local configuration, key to value. */
export function settingsOf(manifest: Manifest, facts: DesiredFacts): Readonly<Record<string, string>> {
  const settings: Record<string, string> = {
    "core.hooksPath": `${facts.homePosix.replace(/\/+$/, "")}/.ergonex/hooks`,
  };
  if (manifest.policy.requiresSignedCommits) {
    settings["commit.gpgsign"] = "true";
    if (manifest.signing !== undefined) {
      settings["gpg.format"] = manifest.signing.format;
      if (manifest.signing.key !== undefined) settings["user.signingkey"] = manifest.signing.key;
    }
  }
  if (manifest.identity !== undefined) {
    settings["user.name"] = manifest.identity.name;
    settings["user.email"] = manifest.identity.email;
  }
  if (facts.windows) settings["core.longpaths"] = "true";
  return settings;
}

/** What the manifest and its generated files want. */
export async function desiredOf(manifest: Manifest, files: readonly GeneratedFile[], facts: DesiredFacts): Promise<Desired> {
  const settings = settingsOf(manifest, facts);
  const repos: DesiredRepo[] = manifest.repositories.map((r) => ({
    path: r.path,
    ref: r.ref,
    cloneUrl: r.cloneUrl,
    branch: r.branch,
    settings,
  }));
  const worktrees: DesiredWorktree[] = manifest.repositories.flatMap((r) =>
    r.worktrees.map((w) => ({ path: w.path, repo: r.path, branch: w.branch })),
  );
  const desiredFiles: DesiredFile[] = [];
  for (const f of files) desiredFiles.push({ path: f.path, sha256: await fileDigest(f) });
  return { repos, worktrees, files: desiredFiles, hostChanges: [] };
}

/** The digest of a set of files by path, which `verify` and `render` compare with the disk and the record. */
export async function digestsOf(files: readonly GeneratedFile[]): Promise<ReadonlyMap<string, Sha256>> {
  const out = new Map<string, Sha256>();
  for (const f of files) out.set(f.path, await fileDigest(f));
  return out;
}
