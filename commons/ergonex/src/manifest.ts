// Spec: 0003-host FR-001
/**
 * The workspace's manifest, the source state (commons 0003-host FR-001, 0002-workspace-model FR-006, FR-011, FR-019, FR-020): the repositories it names, the self-managed GitLab hosts, the
 * policy and the identity, decoded once at the boundary by the kernel's decoder and then checked as a whole, so that every field that is wrong is reported with its place and none is guessed.
 *
 * @remarks
 * Two stages. The shape is the kernel decoder's: the first field that is not what is expected stops that stage, named by its path. The meaning is this module's and reports all it finds: a remote that
 * is not a remote of a host, a path that is not portable or is named like a folder of the workspace, a path deeper than the host's manager offers, two repositories or worktrees whose paths
 * are one after Unicode normalization and case folding (both are named, on every file system), a branch that is not a branch name, and a repository on a host the policy does not allow.
 * An issue is a finding of severity `Error` (`issueFinding`); a manifest with one is not used.
 *
 * @limits It does not read the file: `workspace.ts` is a TypeScript module the host layer loads and hands over as a value. The tool catalog is decoded by `tools/catalog.ts` (0002-workspace-model FR-037).
 *
 * @module
 */
import { array, boolean, formatDecodeError, integer, object, string, unknownValue } from "@intellectual-frontiers/commons/ts/kernel";
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import { sha256Of } from "@intellectual-frontiers/commons/ts/kernel";
import { describeRemoteError, hostKindOf, type HostKinds, readRemote, cloneUrlOf } from "@intellectual-frontiers/commons/ts/githost";
import type { RepoRef } from "@intellectual-frontiers/commons/ts/githost";
import type { Finding } from "./findings.ts";
import { describeLayoutError, repoPathOf, worktreePathOf } from "./layout.ts";
import { describeNameError, moduleName } from "./modules/name.ts";
import { collisions } from "./portable.ts";
import { decodeCatalog, type ToolCatalog } from "./tools/catalog.ts";
import { type Policy, hostAllowed, policyOf } from "./policy.ts";
import { branchName, describeBrandError, gitHost, type BranchName, type RepoPath } from "./types.ts";

const repositoryShape = object({ remote: string }, { branch: string, group: string, worktrees: array(string) });
const manifestShape = object(
  { repositories: array(repositoryShape) },
  {
    gitlabHosts: array(string),
    policy: object(
      {},
      {
        requiresSignedCommits: boolean,
        regulatedDomain: array(string),
        unapprovedGraceDays: integer,
        allowedGitHost: array(string),
      },
    ),
    identity: object({ name: string, email: string }),
    signing: object({ format: string }, { key: string }),
    direnv: boolean,
    tools: unknownValue,
    modules: array(object({ name: string, program: string }, { sha256: string, summary: string })),
  },
);

/** A worktree the manifest asks for. */
export type ManifestWorktree = {
  readonly branch: BranchName;
  readonly path: RepoPath;
};

/** A repository the manifest names, with where it goes. */
export type ManifestRepo = {
  /** The remote as the manifest wrote it, normalized to the HTTPS URL it is cloned from. */
  readonly cloneUrl: string;
  readonly ref: RepoRef;
  readonly path: RepoPath;
  readonly branch?: BranchName | undefined;
  /** The group of repositories it belongs to (one `<group>.auto.code-workspace` file each). */
  readonly group?: string | undefined;
  readonly worktrees: readonly ManifestWorktree[];
};

/** A module the workspace registers (0001-ergonex FR-011): its name, the program that runs it and, where given, the SHA-256 that program must have. */
export type ManifestModule = {
  readonly name: string;
  readonly program: string;
  readonly sha256?: string | undefined;
  readonly summary?: string | undefined;
};

/** How commits are signed in a managed repository (0003-host FR-013): `openpgp` or `ssh`, and the key the manifest names, if it names one. */
export type ManifestSigning = {
  readonly format: "openpgp" | "ssh";
  readonly key?: string | undefined;
};

/** The decoded manifest. */
export type Manifest = {
  readonly repositories: readonly ManifestRepo[];
  /** The hosts that are not plain Git, by name: the self-managed GitLab hosts the manifest names (and never one guessed from a URL). */
  readonly hostKinds: HostKinds;
  readonly policy: Policy;
  readonly identity?: { readonly name: string; readonly email: string } | undefined;
  /** The signing the policy requires, where the manifest names a format. */
  readonly signing?: ManifestSigning | undefined;
  /** Whether `direnv` is wanted (0003-host FR-023): `.envrc.auto` is generated only where it is wanted and a probe finds it. */
  readonly direnv: boolean;
  /** The modules the workspace registers, written to `modules.auto.json`. */
  readonly modules: readonly ManifestModule[];
  /** The tool catalog (0002-workspace-model FR-037): empty where the manifest names none. */
  readonly catalog: ToolCatalog;
};

/** One thing wrong in the manifest, with where. */
export type ManifestIssue = {
  /** The rule that found it: `ergonex/manifest-shape`, `ergonex/manifest-remote`, `ergonex/manifest-path`, `ergonex/manifest-branch`, `ergonex/manifest-host`, `ergonex/manifest-signing`, `ergonex/manifest-module`, `ergonex/catalog-shape`, `ergonex/catalog-tool`, `ergonex/path-collision`, `ergonex/host-not-allowed`. */
  readonly rule: string;
  /** The field, as `$.repositories[2].remote`. */
  readonly path: string;
  readonly message: string;
};

/** An issue as a finding of the severity `Error`, first seen `today`. */
export function issueFinding(issue: ManifestIssue, today: string): Finding {
  return {
    ruleId: issue.rule,
    severity: "Error",
    message: issue.message,
    subject: issue.path,
    firstSeen: today,
  };
}

/** The manifest from a value of unknown shape, or every issue found in it. Pure: nothing is read, and nothing in the value is kept that is not decoded. */
export function decodeManifest(
  input: unknown,
  options: { readonly loopbackHttp?: boolean } = {},
): Result<Manifest, readonly ManifestIssue[]> {
  const shaped = manifestShape(input);
  if (shaped.kind === "err") {
    return err([
      {
        rule: "ergonex/manifest-shape",
        path: shaped.error.path,
        message: `the manifest is not what is expected: ${formatDecodeError(shaped.error)}`,
      },
    ]);
  }
  const raw = shaped.value;
  const issues: ManifestIssue[] = [];

  const hostKinds: Record<string, "Gitlab"> = {};
  for (const [i, h] of (raw.gitlabHosts ?? []).entries()) {
    const host = gitHost(h);
    if (host.kind === "err")
      issues.push({
        rule: "ergonex/manifest-host",
        path: `$.gitlabHosts[${i}]`,
        message: describeBrandError(host.error),
      });
    else if (host.value === "github.com")
      issues.push({
        rule: "ergonex/manifest-host",
        path: `$.gitlabHosts[${i}]`,
        message: "github.com is GitHub, not GitLab",
      });
    else hostKinds[host.value] = "Gitlab";
  }

  let signing: ManifestSigning | undefined;
  if (raw.signing !== undefined) {
    if (raw.signing.format === "openpgp" || raw.signing.format === "ssh") signing = { format: raw.signing.format, key: raw.signing.key };
    else
      issues.push({
        rule: "ergonex/manifest-signing",
        path: "$.signing.format",
        message: `the signing format is ${JSON.stringify(raw.signing.format)}; Git signs with openpgp or ssh`,
      });
  }
  const modules: ManifestModule[] = [];
  const seenModules = new Set<string>();
  for (const [i, m] of (raw.modules ?? []).entries()) {
    const at = `$.modules[${i}]`;
    const name = moduleName(m.name);
    if (name.kind === "err")
      issues.push({
        rule: "ergonex/manifest-module",
        path: `${at}.name`,
        message: describeNameError(name.error),
      });
    else if (seenModules.has(name.value))
      issues.push({
        rule: "ergonex/manifest-module",
        path: `${at}.name`,
        message: `the module ${name.value} is registered twice`,
      });
    else seenModules.add(name.value);
    if (m.sha256 !== undefined && sha256Of(m.sha256) === undefined)
      issues.push({
        rule: "ergonex/manifest-module",
        path: `${at}.sha256`,
        message: "the SHA-256 of a module's program is 64 hexadecimal digits",
      });
    modules.push({
      name: m.name,
      program: m.program,
      sha256: m.sha256,
      summary: m.summary,
    });
  }

  let catalog: ToolCatalog = { tools: [] };
  if (raw.tools !== undefined) {
    const c = decodeCatalog(raw.tools, options.loopbackHttp === true);
    if (c.kind === "ok") catalog = c.value;
    else for (const i of c.error) issues.push({ rule: i.rule, path: i.path, message: i.message });
  }

  const policy = policyOf(raw.policy);
  const repositories: ManifestRepo[] = [];
  const named: { id: string; path: string }[] = [];
  for (const [i, entry] of raw.repositories.entries()) {
    const at = `$.repositories[${i}]`;
    const remote = readRemote(entry.remote, hostKinds);
    if (remote.kind === "err") {
      issues.push({
        rule: "ergonex/manifest-remote",
        path: `${at}.remote`,
        message: `the remote is not a repository on a Git host: ${describeRemoteError(remote.error)}`,
      });
      continue;
    }
    const ref = remote.value.ref;
    // GitHub is `github.com` alone (FR-019): a host the manifest names as GitLab is read as GitLab by `parseRemote`, so no other kind is possible here
    const path = repoPathOf(ref);
    if (path.kind === "err") {
      issues.push({
        rule: "ergonex/manifest-path",
        path: `${at}.remote`,
        message: describeLayoutError(path.error),
      });
      continue;
    }
    if (!hostAllowed(policy, ref.host)) {
      issues.push({
        rule: "ergonex/host-not-allowed",
        path: `${at}.remote`,
        message: `the host ${ref.host} is not one of the policy's allowed Git hosts (${policy.allowedGitHost.join(", ")})`,
      });
    }
    let branch: BranchName | undefined;
    const wantedBranch = entry.branch ?? remote.value.branch; // a page's address (`.../tree/main`) names the branch
    if (wantedBranch !== undefined) {
      const b = branchName(wantedBranch);
      if (b.kind === "err")
        issues.push({
          rule: "ergonex/manifest-branch",
          path: `${at}.branch`,
          message: describeBrandError(b.error),
        });
      else branch = b.value;
    }
    const worktrees: { branch: BranchName; path: RepoPath }[] = [];
    for (const [j, w] of (entry.worktrees ?? []).entries()) {
      const b = branchName(w);
      if (b.kind === "err") {
        issues.push({
          rule: "ergonex/manifest-branch",
          path: `${at}.worktrees[${j}]`,
          message: describeBrandError(b.error),
        });
        continue;
      }
      const wp = worktreePathOf(ref, b.value);
      if (wp.kind === "err") {
        issues.push({
          rule: "ergonex/manifest-path",
          path: `${at}.worktrees[${j}]`,
          message: describeLayoutError(wp.error),
        });
        continue;
      }
      worktrees.push({ branch: b.value, path: wp.value });
      named.push({ id: `${at}.worktrees[${j}]`, path: wp.value });
    }
    named.push({ id: `${at}.remote`, path: path.value });
    repositories.push({
      cloneUrl: cloneUrlOf(ref),
      ref,
      path: path.value,
      branch,
      group: entry.group,
      worktrees,
    });
  }

  // two paths that are one after NFC and case folding are both refused, each naming the other (0002-workspace-model FR-011)
  for (const c of collisions(named)) {
    for (const m of c.members) {
      const others = c.members.filter((o) => o.id !== m.id).map((o) => `${o.path} (${o.id})`);
      issues.push({
        rule: "ergonex/path-collision",
        path: m.id,
        message: `${m.path} is the same path as ${others.join(" and ")} after Unicode normalization and case folding, which a case-insensitive file system cannot hold apart; both are refused`,
      });
    }
  }

  if (issues.length > 0) return err(issues);
  return ok({
    repositories,
    hostKinds,
    policy,
    ...(raw.identity === undefined ? {} : { identity: raw.identity }),
    ...(signing === undefined ? {} : { signing }),
    direnv: raw.direnv === true,
    modules,
    catalog,
  });
}

/** The kind of host of a name under a manifest: GitHub for `github.com`, GitLab for `gitlab.com` and the hosts it names, plain Git for the rest (0002-workspace-model FR-019). */
export function hostKindIn(manifest: Manifest, host: string): "Github" | "Gitlab" | "Git" {
  return hostKindOf(host, manifest.hostKinds);
}
