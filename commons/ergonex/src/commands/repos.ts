// Spec: 0005-repositories FR-003
/**
 * `ergonex add`, `ergonex remove` and `ergonex adopt` (commons ergonex 0005-repositories FR-003 to FR-010): the commands that keep the list of repositories, so that a person does not edit TypeScript to hold one more.
 * `add` takes remotes as a person writes them (`github.com/owner/repo`, `owner/repo`, a page's address) and, with `--apply`, clones them; `remove` takes one out of the list and, with `--delete`, deletes its folder only
 * where it holds no work that exists nowhere else; `adopt` finds the repositories already under the root that the manifest does not name. Each decodes the whole manifest with its change before it writes, so a change
 * the manifest would refuse is refused and nothing is written.
 *
 * @module
 */
import { cloneUrlOf, describeRef, readRemote, sameRepository, type RepoRef } from "@intellectual-frontiers/commons/ts/githost";
import { absurd, err, ok } from "@intellectual-frontiers/core";
import { flag, value } from "../platform/k-args.ts";
import { exists, remove } from "../platform/r-fs.ts";
import { decodeManifest, type ManifestRepo } from "../manifest.ts";
import { holdsLocalWork } from "../state.ts";
import { observe } from "../host/observe.ts";
import { findUnmanaged } from "../host/unmanaged.ts";
import { writeRepositoryList } from "../host/repositories.ts";
import { loadWorkspace, native, readRawManifest, type Loaded } from "../host/workspace.ts";
import { foldKey } from "../portable.ts";
import { addEntries, removeEntries, type RepoEntry, withEntries } from "../repositories.ts";
import { defineCommand, GLOBAL_OPTIONS, type Context, type ErgonexModule, type Outcome } from "../modules/types.ts";
import { applyLoaded } from "./plan.ts";
import { jsonOf, withWorkspace } from "./common.ts";

/** The manifest's own answer to a list: nothing, or what is wrong with it, one sentence each. */
function problemsOf(base: unknown, list: readonly RepoEntry[]): readonly string[] {
  const d = decodeManifest(withEntries(base, list));
  return d.kind === "err" ? d.error.map((i) => `${i.path}: ${i.message}`) : [];
}

/** After a change, `ergonex apply` where the run asked for it. */
async function thenApply(ctx: Context, lines: readonly string[], data: Record<string, unknown>, apply: boolean): Promise<Outcome> {
  if (!apply) return ok({ text: lines.join("\n"), data: jsonOf(data) as never, findings: [] });
  const loaded = await loadWorkspace(ctx);
  if (loaded.kind === "err")
    return ok({
      text: [...lines, "the manifest cannot be read now; run `ergonex plan`"].join("\n"),
      data: jsonOf(data) as never,
      findings: [],
    });
  const done = await applyLoaded(ctx, loaded.value, { fetch: false, allowDestructive: false, force: false, wait: false });
  if (done.kind === "err") return done;
  return ok({
    ...done.value,
    text: [...lines, done.value.text].join("\n"),
    data: { ...(jsonOf(data) as object), ...(done.value.data as object) } as never,
  });
}

// --------------------------------------------------------------------------------------------------------------------------------------------------------------- add

const add = defineCommand({
  name: "add",
  summary: "Add repositories to the workspace: `ergonex add github.com/owner/repo`; --apply clones them.",
  options: {
    ...GLOBAL_OPTIONS,
    apply: flag({ help: "Then carry out the plan, as `ergonex apply` does: clone what is not there yet." }),
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
  run: (ctx, args) =>
    withWorkspace(ctx, async (loaded) => {
      if (args.positionals.length === 0)
        return err({ kind: "usage", message: "name a repository to add, for example `ergonex add github.com/owner/repo`" });
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
        lines.push(`  added ${name} (${cloneUrlOf(w.ref)}${w.branch === undefined ? "" : `, branch ${w.branch}`})`);
      }
      if (entries.length === 0) return ok({ text: ["nothing to add:", ...lines].join("\n"), data: { added: [] }, findings: [] });
      const next = addEntries(raw.value.list, entries);
      const problems = problemsOf(raw.value.base, next);
      if (problems.length > 0)
        return err({ kind: "usage", message: `nothing was added; the manifest would not accept it:\n${problems.join("\n")}` });
      await writeRepositoryList(loaded.home, next);
      const head = [`added ${entries.length} to .ergonex/repositories.ts:`, ...lines];
      const tail = args.options.apply
        ? []
        : ["next: `ergonex plan` shows what would change, `ergonex apply` clones them (or add --apply next time)"];
      return thenApply(ctx, [...head, ...tail], { added: entries.map((e) => e.remote) }, args.options.apply);
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

const removeCommand = defineCommand({
  name: "remove",
  summary: "Take repositories out of the list; --delete also deletes the folder of one that holds no work that exists nowhere else.",
  options: {
    ...GLOBAL_OPTIONS,
    delete: flag({
      help: "Also delete the repository's folder, only where it is clean, fully pushed and has no worktree; otherwise nothing is removed.",
    }),
  },
  operands: [
    {
      name: "REPOSITORY",
      help: "A repository as you wrote it when you added it, its path in the workspace, or its name where that is only one.",
      arity: "many",
    },
  ],
  run: (ctx, args) =>
    withWorkspace(ctx, async (loaded) => {
      if (args.positionals.length === 0)
        return err({ kind: "usage", message: "name a repository to remove, for example `ergonex remove github.com/owner/repo`" });
      const raw = await readRawManifest(loaded.home);
      if (raw.kind === "err") return err({ kind: "environment", message: raw.error });
      const mine = new Map<string, RepoEntry>();
      for (const e of raw.value.list) {
        const r = readRemote(e.remote, loaded.manifest.hostKinds);
        if (r.kind === "ok") mine.set(describeRef(r.value.ref).toLowerCase(), e);
      }
      const problems: string[] = [];
      const targets: { readonly repo: ManifestRepo; readonly entry: RepoEntry }[] = [];
      for (const word of args.positionals) {
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
      if (args.options.delete) {
        for (const t of targets) {
          const folder = native(site, t.repo.path);
          const state = await observe(folder, t.repo.ref);
          if (state.kind === "err") {
            problems.push(`${t.repo.path}: cannot be looked at (${state.error.program} is not installed or not on the PATH)`);
            continue;
          }
          if (holdsLocalWork(state.value.kind)) {
            problems.push(
              `${t.repo.path} holds work that exists nowhere else (${state.value.kind}): commit and push it, or remove it by hand`,
            );
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
      await writeRepositoryList(
        loaded.home,
        removeEntries(
          raw.value.list,
          targets.map((t) => t.entry.remote),
        ),
      );
      for (const f of folders) await remove(f, { recursive: true });
      const lines = targets.map((t) =>
        args.options.delete && folders.includes(native(site, t.repo.path))
          ? `  removed ${t.repo.path} and deleted its folder`
          : args.options.delete
            ? `  removed ${t.repo.path} (it was not cloned)`
            : `  removed ${t.repo.path}; its folder stays on disk and is now unmanaged (give --delete to delete a clean one)`,
      );
      return ok({
        text: [`removed ${targets.length} from .ergonex/repositories.ts:`, ...lines].join("\n"),
        data: { removed: targets.map((t) => t.repo.path), deleted: folders.length },
        findings: [],
      });
    }),
});

// ------------------------------------------------------------------------------------------------------------------------------------------------------------- adopt

const adopt = defineCommand({
  name: "adopt",
  summary:
    "Find the repositories under the root that the manifest does not name; --apply adds those that are where their remote puts them.",
  options: { ...GLOBAL_OPTIONS, apply: flag({ help: "Add the adoptable repositories to the list." }) },
  run: (ctx, args) =>
    withWorkspace(ctx, async (loaded) => {
      const found = await findUnmanaged(
        loaded.home,
        loaded.manifest.repositories.map((r) => r.path),
        loaded.manifest.hostKinds,
      );
      if (found.length === 0) return ok({ text: "every repository under the root is in the manifest", data: { found: [] }, findings: [] });
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
      if (!args.options.apply || adoptable.length === 0) {
        const tail = adoptable.length > 0 ? ["give --apply to add the ones that can be adopted"] : [];
        return ok({
          text: [`${found.length} not in the manifest:`, ...lines, ...tail].join("\n"),
          data: jsonOf({ found }) as never,
          findings: [],
        });
      }
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
      });
    }),
});

/** The module `ergonex add`. */
export const addModule: ErgonexModule = { name: "add", summary: add.summary, commands: [add] };
/** The module `ergonex remove`. */
export const removeModule: ErgonexModule = { name: "remove", summary: removeCommand.summary, commands: [removeCommand] };
/** The module `ergonex adopt`. */
export const adoptModule: ErgonexModule = { name: "adopt", summary: adopt.summary, commands: [adopt] };
