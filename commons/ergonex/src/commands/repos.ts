// Spec: 0005-repositories FR-003
/**
 * `ergonex repos add|remove|delete|adopt` (commons ergonex 0005-repositories FR-003 to FR-010): the commands that keep the list of repositories, so that a person does not edit TypeScript to hold one more. `add` takes remotes as a person writes
 * them (`github.com/owner/repo`, `owner/repo`, a page's address) and puts them on the list; `remove` takes one off the list and leaves its folder; `delete` takes one off the list and deletes its folder only where it holds no work that exists
 * nowhere else; `adopt` finds the repositories already under the root that the manifest does not name and adds those that are where their remote puts them. Each decodes the whole manifest with its change before it writes, so a change the
 * manifest would refuse is refused and nothing is written, and each can preview itself with `--dry-run`. None clones anything: `ergonex apply` does.
 *
 * @module
 */
import { cloneUrlOf, describeRef, readRemote, sameRepository, type RepoRef } from "@intellectual-frontiers/githost";
import { absurd, err, ok } from "@intellectual-frontiers/core";
import { value } from "../platform/k-args.ts";
import { exists, remove } from "../platform/r-fs.ts";
import { decodeManifest, type ManifestRepo } from "../manifest.ts";
import { holdsLocalWork } from "../state.ts";
import { observe } from "../host/observe.ts";
import { findUnmanaged } from "../host/unmanaged.ts";
import { writeRepositoryList } from "../host/repositories.ts";
import { native, readRawManifest, type Loaded } from "../host/workspace.ts";
import { foldKey } from "../portable.ts";
import { addEntries, removeEntries, type RepoEntry, withEntries } from "../repositories.ts";
import type { Context, Outcome } from "../modules/types.ts";
import { jsonOf, withWorkspace } from "./common.ts";
import { defineCommand } from "./define.ts";
import { changes, destroys, HOME } from "./options.ts";

/** The manifest's own answer to a list: nothing, or what is wrong with it, one sentence each. */
function problemsOf(base: unknown, list: readonly RepoEntry[]): readonly string[] {
  const d = decodeManifest(withEntries(base, list));
  return d.kind === "err" ? d.error.map((i) => `${i.path}: ${i.message}`) : [];
}

// --------------------------------------------------------------------------------------------------------------------------------------------------------------- add

const add = defineCommand({
  name: "add",
  summary: "Add repositories to the list of the workspace: `ergonex repos add github.com/owner/repo`; `ergonex apply` clones them.",
  options: {
    ...HOME,
    branch: value<never>({ help: "The branch to keep checked out (a page's address, `.../tree/dev`, names it too).", valueName: "BRANCH" }),
    group: value<never>({ help: "A name that groups repositories together.", valueName: "GROUP" }),
  },
  operands: [
    {
      name: "REMOTE",
      help: "A repository as you write it: `github.com/owner/repo`, `owner/repo` (GitHub), `gitlab:group/sub/repo`, `git@host:path.git` or an https address, with or without the scheme.",
      arity: "many",
    },
  ],
  examples: [
    { args: ["github.com/owner/repo"], says: "Put a repository on the list." },
    { args: ["owner/repo", "--branch", "dev", "--group", "core"], says: "Put a GitHub repository on the list, on a branch, in a group." },
  ],
  action: changes({ idempotent: true, dryRun: true }),
  run: (ctx, args) =>
    withWorkspace(ctx, async (loaded) => {
      if (args.positionals.length === 0)
        return err({ kind: "usage", message: "name a repository to add, for example `ergonex repos add github.com/owner/repo`" });
      const raw = await readRawManifest(loaded.home);
      if (raw.kind === "err") return err({ kind: "environment", message: raw.error });
      const bad: string[] = [];
      const wanted: { readonly ref: RepoRef; readonly branch: string | undefined }[] = [];
      for (const word of args.positionals) {
        const r = readRemote(word, loaded.manifest.hostKinds);
        if (r.kind === "err") {
          bad.push(
            `${word}: not a repository on a Git host (${r.error.kind === "local-path" ? "a path on this computer is not a remote" : r.error.kind})`,
          );
          continue;
        }
        wanted.push({ ref: r.value.ref, branch: args.options.branch ?? r.value.branch });
      }
      if (bad.length > 0) return err({ kind: "usage", message: bad.join("\n") });
      const entries: RepoEntry[] = [];
      const lines: string[] = [];
      for (const w of wanted) {
        const name = describeRef(w.ref);
        const have = loaded.manifest.repositories.find((r: ManifestRepo) => sameRepository(r.ref, w.ref));
        if (have !== undefined || entries.some((e) => foldKey(e.remote) === foldKey(cloneUrlOf(w.ref)))) {
          lines.push(`  already in the manifest: ${name}`);
          continue;
        }
        entries.push({
          remote: cloneUrlOf(w.ref),
          ...(w.branch === undefined ? {} : { branch: w.branch }),
          ...(args.options.group === undefined ? {} : { group: args.options.group }),
        });
        lines.push(`  ${ctx.mode === "dry-run" ? "would add" : "added"} ${name} (${cloneUrlOf(w.ref)}${w.branch === undefined ? "" : `, branch ${w.branch}`})`);
      }
      if (entries.length === 0)
        return ok({ text: ["nothing to add:", ...lines].join("\n"), data: { added: [] }, findings: [], title: "Already in the manifest" });
      const next = addEntries(raw.value.list, entries);
      const problems = problemsOf(raw.value.base, next);
      if (problems.length > 0)
        return err({ kind: "usage", message: `nothing was added; the manifest would not accept it:\n${problems.join("\n")}` });
      if (ctx.mode === "dry-run")
        return ok({
          text: [`would add ${entries.length} to .ergonex/repositories.ts:`, ...lines].join("\n"),
          data: { added: [], wouldAdd: entries.map((e) => e.remote) },
          findings: [],
          noEvidence: true,
        });
      await writeRepositoryList(loaded.home, next);
      return ok({
        text: [`added ${entries.length} to .ergonex/repositories.ts:`, ...lines].join("\n"),
        data: { added: entries.map((e) => e.remote) },
        findings: [],
        title: `Added ${entries.length}`,
        next: ["ergonex apply"],
      });
    }),
});

// ------------------------------------------------------------------------------------------------------------------------------------------------------------ remove

/** The repository of the manifest a word names: a remote as written, its path in the workspace, or its name where only one has it. */
function resolveWord(repos: readonly ManifestRepo[], word: string, loaded: Loaded): ManifestRepo | string {
  const read = readRemote(word, loaded.manifest.hostKinds);
  if (read.kind === "ok") {
    const hit = repos.find((r) => sameRepository(r.ref, read.value.ref));
    if (hit !== undefined) return hit;
  }
  const key = foldKey(word);
  const exact = repos.filter((r) => foldKey(r.path) === key);
  const found = exact.length > 0 ? exact : repos.filter((r) => foldKey(r.path.split("/").at(-1) ?? "") === key);
  const [only, ...more] = found;
  if (only === undefined) return `${word} is not a repository of the manifest`;
  if (more.length > 0) return `${word} names more than one repository (${found.map((r) => r.path).join(", ")}); give its whole path`;
  return only;
}

/** What `remove` and `delete` share: the repositories the words name, taken off the list, and where `deleteFolders` is given their clean folders deleted (only where nothing is lost); in a preview nothing is written. */
async function takeOff(ctx: Context, loaded: Loaded, words: readonly string[], deleteFolders: boolean, verb: string): Promise<Outcome> {
  if (words.length === 0)
    return err({ kind: "usage", message: `name a repository to ${verb}, for example \`ergonex repos ${verb} github.com/owner/repo\`` });
  const raw = await readRawManifest(loaded.home);
  if (raw.kind === "err") return err({ kind: "environment", message: raw.error });
  const mine = new Map<string, RepoEntry>();
  for (const e of raw.value.list) {
    const r = readRemote(e.remote, loaded.manifest.hostKinds);
    if (r.kind === "ok") mine.set(describeRef(r.value.ref).toLowerCase(), e);
  }
  const problems: string[] = [];
  const targets: { readonly repo: ManifestRepo; readonly entry: RepoEntry }[] = [];
  for (const word of words) {
    const hit = resolveWord(loaded.manifest.repositories, word, loaded);
    if (typeof hit === "string") {
      problems.push(hit);
      continue;
    }
    const entry = mine.get(describeRef(hit.ref).toLowerCase());
    if (entry === undefined) {
      problems.push(`${hit.path} is named in workspace.ts, which ergonex does not edit: remove its line there`);
      continue;
    }
    if (!targets.some((t) => t.repo.path === hit.path)) targets.push({ repo: hit, entry });
  }
  const site = { home: loaded.home, places: loaded.places };
  const folders: string[] = [];
  if (deleteFolders) {
    for (const t of targets) {
      const folder = native(site, t.repo.path);
      const state = await observe(folder, t.repo.ref);
      if (state.kind === "err") {
        problems.push(`${t.repo.path}: cannot be looked at (${state.error.program} is not installed or not on the PATH)`);
        continue;
      }
      if (holdsLocalWork(state.value.kind)) {
        problems.push(`${t.repo.path} holds work that exists nowhere else (${state.value.kind}): commit and push it, or remove it by hand`);
        continue;
      }
      if (await exists(native(site, `.worktrees/${t.repo.path}`))) {
        problems.push(`${t.repo.path} has worktrees: \`ergonex worktree prune\` first`);
        continue;
      }
      if (state.value.kind !== "Missing") folders.push(folder);
    }
  }
  if (problems.length > 0) return err({ kind: "usage", message: `nothing was removed:\n${problems.join("\n")}` });
  const preview = ctx.mode === "dry-run";
  if (!preview) {
    await writeRepositoryList(
      loaded.home,
      removeEntries(
        raw.value.list,
        targets.map((t) => t.entry.remote),
      ),
    );
    for (const f of folders) await remove(f, { recursive: true });
  }
  const lines = targets.map((t) => {
    const gone = deleteFolders && folders.includes(native(site, t.repo.path));
    if (preview)
      return deleteFolders
        ? `  would remove ${t.repo.path}${gone ? " and delete its folder" : " (it is not cloned)"}`
        : `  would remove ${t.repo.path}; its folder would stay on disk and be unmanaged`;
    return gone
      ? `  removed ${t.repo.path} and deleted its folder`
      : deleteFolders
        ? `  removed ${t.repo.path} (it was not cloned)`
        : `  removed ${t.repo.path}; its folder stays on disk and is now unmanaged (\`ergonex repos delete\` deletes a clean one)`;
  });
  return ok({
    text: [`${preview ? "would remove" : "removed"} ${targets.length} from .ergonex/repositories.ts:`, ...lines].join("\n"),
    data: { removed: preview ? [] : targets.map((t) => t.repo.path), wouldRemove: preview ? targets.map((t) => t.repo.path) : [], deleted: preview ? 0 : folders.length },
    findings: [],
    ...(preview ? { noEvidence: true } : { title: `Removed ${targets.length}` }),
  });
}

const removeCommand = defineCommand({
  name: "remove",
  summary: "Take repositories off the list; their folders stay on disk and become unmanaged.",
  options: { ...HOME },
  operands: [
    {
      name: "REPOSITORY",
      help: "A repository as you wrote it when you added it, its path in the workspace, or its name where that is only one.",
      arity: "many",
    },
  ],
  examples: [{ args: ["tool"], says: "Take the repository named tool off the list and leave its folder." }],
  action: changes({ idempotent: false, dryRun: true }),
  run: (ctx, args) => withWorkspace(ctx, (loaded) => takeOff(ctx, loaded, args.positionals, false, "remove")),
});

const deleteCommand = defineCommand({
  name: "delete",
  summary: "Take repositories off the list and delete their folders, only where a folder is clean, fully pushed and has no worktree.",
  options: { ...HOME },
  operands: [
    {
      name: "REPOSITORY",
      help: "A repository as you wrote it when you added it, its path in the workspace, or its name where that is only one.",
      arity: "many",
    },
  ],
  examples: [
    { args: ["tool", "--dry-run"], says: "Show what would be removed, and change nothing." },
    { args: ["tool", "--yes"], says: "Remove it and delete its folder without asking." },
  ],
  action: destroys(),
  run: (ctx, args) => withWorkspace(ctx, (loaded) => takeOff(ctx, loaded, args.positionals, true, "delete")),
});

// ------------------------------------------------------------------------------------------------------------------------------------------------------------- adopt

const adopt = defineCommand({
  name: "adopt",
  summary: "Find the repositories under the root that the manifest does not name, and add those that are where their remote puts them.",
  options: { ...HOME },
  examples: [
    { args: ["--dry-run"], says: "Name the repositories that are not on the list, and add none." },
    { args: [], says: "Add the ones that are where their remote puts them." },
  ],
  action: changes({ idempotent: true, dryRun: true }),
  run: (ctx, args) =>
    withWorkspace(ctx, async (loaded) => {
      void args;
      const found = await findUnmanaged(
        loaded.home,
        loaded.manifest.repositories.map((r) => r.path),
        loaded.manifest.hostKinds,
      );
      if (found.length === 0)
        return ok({ text: "every repository under the root is in the manifest", data: { found: [] }, findings: [], title: "Nothing to adopt" });
      const lines = found.map((f) => {
        switch (f.kind) {
          case "adoptable":
            return `  ${f.path}: can be adopted (${f.remote})`;
          case "misplaced":
            return `  ${f.path}: is at the wrong path; its remote puts it at ${f.belongsAt} (move it there, ergonex never moves a repository)`;
          case "no-remote":
            return `  ${f.path}: has no remote called origin`;
          case "not-a-host":
            return `  ${f.path}: its origin is not a repository on a Git host`;
          default:
            return absurd(f);
        }
      });
      const adoptable = found.flatMap((f) => (f.kind === "adoptable" ? [f] : []));
      if (ctx.mode === "dry-run" || adoptable.length === 0)
        return ok({
          text: [`${found.length} not in the manifest:`, ...lines].join("\n"),
          data: jsonOf({ found }) as never,
          findings: [],
          noEvidence: ctx.mode === "dry-run",
        });
      const raw = await readRawManifest(loaded.home);
      if (raw.kind === "err") return err({ kind: "environment", message: raw.error });
      const next = addEntries(
        raw.value.list,
        adoptable.map((a) => ({ remote: a.remote })),
      );
      const problems = problemsOf(raw.value.base, next);
      if (problems.length > 0)
        return err({ kind: "usage", message: `nothing was adopted; the manifest would not accept it:\n${problems.join("\n")}` });
      await writeRepositoryList(loaded.home, next);
      return ok({
        text: [`adopted ${adoptable.length} into .ergonex/repositories.ts; the others are not changed:`, ...lines].join("\n"),
        data: jsonOf({ adopted: adoptable.map((a) => a.path), found }) as never,
        findings: [],
        title: `Adopted ${adoptable.length}`,
      });
    }),
});

/** The command `ergonex repos add`. */
export const addCommand = add;
/** The command `ergonex repos remove`. */
export const removeRepoCommand = removeCommand;
/** The command `ergonex repos delete`. */
export const deleteRepoCommand = deleteCommand;
/** The command `ergonex repos adopt`. */
export const adoptCommand = adopt;
