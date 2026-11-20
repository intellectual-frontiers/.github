// Spec: 0005-repositories FR-001
/**
 * The list of repositories that `ergonex repos add`, `remove`, `delete` and `adopt` keep (commons ergonex 0005-repositories FR-001, FR-002): the typed file `.ergonex/repositories.ts`, which exports an array of entries and is
 * rewritten whole by those commands, so that no command edits the source text of the manifest `workspace.ts`. The manifest sees the entries of both files as one list. Pure: it reads and writes no file.
 *
 * @remarks
 * An entry is what the manifest takes for a repository (`remote`, and `branch`, `group` and `worktrees` where there are any). The file is TypeScript that a person may edit too: the commands read it back as the
 * value it exports, and write it again in one form (one entry to a line, in the order they were added), so that a rewrite changes only the entries it adds or removes.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** The name of the file, inside the workspace's own folder. */
export const REPOSITORIES_FILE = "repositories.ts";

/** One repository of the list, as the manifest takes it. */
export type RepoEntry = {
  readonly remote: string;
  readonly branch?: string;
  readonly group?: string;
  readonly worktrees?: readonly string[];
};

const isRecord = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null && !Array.isArray(v);

/** The entries a file exports, or the first thing that is not an entry. */
export function entriesOf(value: unknown): Result<readonly RepoEntry[], string> {
  if (!Array.isArray(value))
    return err('repositories.ts must export an array of repositories as its default (`export default [{ remote: "..." }]`)');
  const out: RepoEntry[] = [];
  for (const [i, e] of value.entries()) {
    if (!isRecord(e) || typeof e["remote"] !== "string") return err(`repositories.ts: entry ${i} has no \`remote\` text`);
    const branch = e["branch"];
    const group = e["group"];
    const worktrees = e["worktrees"];
    if (branch !== undefined && typeof branch !== "string") return err(`repositories.ts: entry ${i}: \`branch\` is not text`);
    if (group !== undefined && typeof group !== "string") return err(`repositories.ts: entry ${i}: \`group\` is not text`);
    if (worktrees !== undefined && (!Array.isArray(worktrees) || worktrees.some((w) => typeof w !== "string")))
      return err(`repositories.ts: entry ${i}: \`worktrees\` is not a list of text`);
    out.push({
      remote: e["remote"],
      ...(branch === undefined ? {} : { branch }),
      ...(group === undefined ? {} : { group }),
      ...(worktrees === undefined ? {} : { worktrees: worktrees as readonly string[] }),
    });
  }
  return ok(out);
}

/** The manifest's value with the entries of this file added to its `repositories`; a value that is not a manifest of the shape is returned as it is, for the decoder to name. */
export function withEntries(manifest: unknown, entries: readonly RepoEntry[]): unknown {
  if (!isRecord(manifest)) return manifest;
  const own = manifest["repositories"];
  if (!Array.isArray(own)) return manifest;
  return { ...manifest, repositories: [...own, ...entries] };
}

const text = (s: string): string => JSON.stringify(s);

/** One entry as a line of the file. */
function line(e: RepoEntry): string {
  const parts = [`remote: ${text(e.remote)}`];
  if (e.branch !== undefined) parts.push(`branch: ${text(e.branch)}`);
  if (e.group !== undefined) parts.push(`group: ${text(e.group)}`);
  if (e.worktrees !== undefined && e.worktrees.length > 0) parts.push(`worktrees: [${e.worktrees.map(text).join(", ")}]`);
  return `  { ${parts.join(", ")} },`;
}

/** The text of the file for a list of entries. */
export function renderRepositories(entries: readonly RepoEntry[]): string {
  return [
    "/**",
    " * The repositories of this workspace that `ergonex add`, `ergonex remove` and `ergonex repos adopt` keep. They rewrite this file whole; you may edit it too, and the manifest `workspace.ts` can name more.",
    " * Run `ergonex plan` to see what would change and `ergonex apply` to bring the workspace to it.",
    " */",
    entries.length === 0 ? "export default [];" : ["export default [", ...entries.map(line), "];"].join("\n"),
    "",
  ].join("\n");
}

/** The entries with the new ones added after them; the remotes that are already there (by their text) are not added twice. */
export function addEntries(entries: readonly RepoEntry[], added: readonly RepoEntry[]): readonly RepoEntry[] {
  const have = new Set(entries.map((e) => e.remote));
  return [...entries, ...added.filter((e) => !have.has(e.remote))];
}

/** The entries without those whose remote text is in `remotes`. */
export function removeEntries(entries: readonly RepoEntry[], remotes: readonly string[]): readonly RepoEntry[] {
  const gone = new Set(remotes);
  return entries.filter((e) => !gone.has(e.remote));
}
