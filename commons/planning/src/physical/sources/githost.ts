// Spec: 0004-planning-sources FR-010
/**
 * The source for a Git host (0037-planning FR-028): the issues of a repository and the references of its commits, read through a client of the Git host contract of `githost` and never one of its own. The contract reads
 * one issue by its number, so the issues read are the ones the configuration names and the ones the commits name: the line `Refs #N` that `repoctl commit` writes (a convention of this repository, which Git does not
 * read as a trailer) and the closing keywords of the host (`close`, `closes`, `closed`, `fix`, `fixes`, `fixed`, `resolve`, `resolves`, `resolved`, then `#N` or `OWNER/REPOSITORY#N`). The source is read only: it declares
 * only `read`, so every patch for it waits in the outbox, and what the contract does not hold (the close reason, the assignees, the comments, the events) is unexpressed with that reason.
 *
 * @remarks
 * The commits that name an issue are carried in the issue's observation (its record as read and its `evidence`), and not as an observation of their own: `reconcile` matches one observation to an item in a run, so a
 * second observation of the same issue in the same source would be a new item. A closed issue is read as closed as completed, which is the host's default and the one reason the contract can neither confirm nor deny.
 *
 * @example
 * ```ts
 * import { commitReferences } from "./githost.ts";
 * commitReferences("Fix the thing\n\nRefs #12\nCloses #13", ["owner", "repo"]); // [{ number: 12, how: "refs" }, { number: 13, how: "closes" }]
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { describeFailure, type GitHostClient, type IssueInfo, type RepoRef } from "@intellectual-frontiers/githost";
import { externalId, type Observation } from "@intellectual-frontiers/planning/governance";
import { canonical } from "@intellectual-frontiers/planning/logical";
import { output } from "@intellectual-frontiers/system/proc";
import { type Acquired, defineSource, type DefineProblem, type Source, type SourceFinding, type SourceProblem } from "../source.ts";

/** How a commit names an issue. */
export type CommitReference = { readonly number: number; readonly how: "refs" | "closes" };

const KEYWORD = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?):?\s+(?:(?<repo>[\w.-]+\/[\w.-]+))?#(?<n>\d+)\b/giu;
const REFS = /^Refs\s+#(?<n>\d+)\s*$/gmu;

/** The issues a commit message names: its `Refs #N` lines and its closing keywords, in order of appearance, each issue once; an `OWNER/REPOSITORY#N` of another repository than `path` is not this one's. */
export function commitReferences(message: string, path: readonly string[]): readonly CommitReference[] {
  const found: (CommitReference & { readonly at: number })[] = [];
  for (const m of message.matchAll(REFS)) found.push({ number: Number(m.groups?.["n"]), how: "refs", at: m.index ?? 0 });
  for (const m of message.matchAll(KEYWORD)) {
    const repo = m.groups?.["repo"];
    if (repo !== undefined && repo.toLowerCase() !== path.join("/").toLowerCase()) continue;
    found.push({ number: Number(m.groups?.["n"]), how: "closes", at: m.index ?? 0 });
  }
  const seen = new Set<number>();
  return found
    .sort((a, b) => a.at - b.at)
    .filter((f) => (seen.has(f.number) ? false : (seen.add(f.number), true)))
    .map(({ number, how }) => ({ number, how }));
}

/** What a configuration of the Git host source says. */
export type GithostConfig = {
  readonly client: GitHostClient;
  readonly ref: RepoRef;
  /** The numbers of issues to read besides those the commits name. */
  readonly issues?: readonly number[];
  /** A local clone whose commits are read for references; none where it is left out. */
  readonly repo?: string;
  /** How many commits to read (500 where none is said). */
  readonly maxCommits?: number;
};

const repoKey = (ref: RepoRef): string => `${ref.host}/${ref.path.join("/")}`;

/** The commits of a clone as messages with their ids, newest first, or why they cannot be read. */
async function commitsOf(repo: string, max: number): Promise<Result<readonly { readonly sha: string; readonly message: string }[], string>> {
  try {
    const r = await output(["git", "-C", repo, "-c", "core.pager=cat", "log", `-n${max}`, "--format=%H%x1f%B%x1e"], { env: { GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0", LC_ALL: "C" } });
    if (!r.success) return err(`git log failed (${r.code}): ${new TextDecoder().decode(r.stderr).trim()}`);
    return ok(
      new TextDecoder()
        .decode(r.stdout)
        .split("\x1e")
        .map((c) => c.replace(/^\n/u, ""))
        .filter((c) => c.trim() !== "")
        .map((c) => {
          const [sha, ...rest] = c.split("\x1f");
          return { sha: (sha ?? "").trim(), message: rest.join("\x1f") };
        }),
    );
  } catch (e) {
    return err(e instanceof Error ? e.message : "git could not be run");
  }
}

async function observe(ref: RepoRef, info: IssueInfo, commits: readonly { readonly sha: string; readonly how: string }[]): Promise<Observation> {
  const key = repoKey(ref);
  const ext = externalId("githost", `${ref.path.join("/")}#${info.number}`);
  const parent = info.parent === undefined ? undefined : await sha256(`githost\u0000${key}\u0000${info.parent}`);
  return {
    source: "githost",
    locator: { kind: "url", url: info.url },
    contentHash: await sha256(canonical({ info, commits })),
    fingerprint: await sha256(`githost\u0000${key}\u0000${info.number}`),
    content: {
      kind: "issue",
      title: info.title,
      body: info.body,
      labels: info.labels,
      assignees: [],
      state: info.state === "open" ? { kind: "open" } : { kind: "closed", reason: "completed" },
      origin: "declared",
      external: ext.kind === "ok" ? [ext.value] : [],
      ...(parent === undefined ? {} : { parent }),
      ...(commits.length === 0 ? {} : { evidence: commits.map((c) => `commit ${c.sha} (${c.how})`) }),
    },
    raw: { number: info.number, url: info.url, state: info.state, parent: info.parent ?? null, children: [...info.children], labels: [...info.labels], hierarchy: info.hierarchy ?? "known", commits: commits.map((c) => ({ sha: c.sha, how: c.how })) },
  };
}

/** The source for the issues and commit references of a repository on a Git host; read only. */
export function githostSource(config: GithostConfig): Result<Source, DefineProblem> {
  const place = repoKey(config.ref);
  const acquire = async (): Promise<Result<Acquired, SourceProblem>> => {
    const findings: SourceFinding[] = [];
    const named = new Map<number, { sha: string; how: string }[]>();
    for (const n of config.issues ?? []) named.set(n, named.get(n) ?? []);
    if (config.repo !== undefined) {
      const commits = await commitsOf(config.repo, config.maxCommits ?? 500);
      if (commits.kind === "err") findings.push({ path: config.repo, message: commits.error });
      else for (const c of commits.value) for (const r of commitReferences(c.message, config.ref.path)) named.set(r.number, [...(named.get(r.number) ?? []), { sha: c.sha, how: r.how }]);
    }
    const observations: Observation[] = [];
    for (const [number, commits] of [...named.entries()].sort(([a], [b]) => a - b)) {
      const got = await config.client.issue(config.ref, number);
      if (got.kind === "err") {
        findings.push({ path: `#${number}`, message: describeFailure(got.error) });
        continue;
      }
      if (got.value.hierarchy === "unavailable") findings.push({ path: `#${number}`, message: "the host's API gives no parent and child issues, so the hierarchy is unexpressed" });
      observations.push(await observe(config.ref, got.value, commits));
    }
    return ok({ observations, findings });
  };
  return defineSource({ name: "githost", place, capabilities: ["read"], acquire });
}
