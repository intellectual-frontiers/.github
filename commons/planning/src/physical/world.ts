// Spec: 0005-planning-surfaces FR-005
/**
 * What the program works on (0037-planning FR-037, FR-045, plan.md Trust): the configuration file read, the store opened and the sources made from the configuration. `planning.config.ts` is TypeScript the program imports,
 * so it runs with the permissions of the person who runs `planctl`: it is read only from the root of the repository the run started in and never from a path an argument or an item names; JSON or YAML beside it is
 * not read; it holds no secret; and a configuration the person has not trusted is not run: a trust is a record in the repository's own `.git` of the SHA-256 of the file the person trusted, given by `--trust` of the
 * command line and never by a call to the tool server.
 *
 * @example
 * ```ts
 * import { loadConfig } from "./world.ts";
 * // const c = await loadConfig("/work/repo", { trust: false });
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { localStore } from "@intellectual-frontiers/anyfs/local";
import { clientFor, type GitHostClient, type RepoRef } from "@intellectual-frontiers/githost";
import { fs, path } from "@intellectual-frontiers/system";
import { type Policy, person, type PersonActor } from "@intellectual-frontiers/planning/governance";
import { type PlanningConfig, parsePlanning, type SourceConfig } from "@intellectual-frontiers/planning/logical";
import { commentsLens } from "./sources/comments.ts";
import { eventFilesLens } from "./sources/event-files.ts";
import { githostSource } from "./sources/githost.ts";
import { issuesLens } from "./sources/issues.ts";
import { markdownLens } from "./sources/markdown.ts";
import { fileSource } from "./file-source.ts";
import type { Source } from "./source.ts";
import type { PlanningStoreBackend } from "./store.ts";

/** The name of the configuration file. */
export const CONFIG_FILE = "planning.config.ts";

/** Why the configuration could not be used. */
export type LoadProblem = { readonly code: "E-CONFIG-LOAD" | "E-CONFIG-INVALID" | "E-TRUST"; readonly message: string };

const trustFile = (root: string): string => path.join(root, ".git", "planning-config-trust");

/** The configuration of the repository at `root`, or why it is not used: absent, not trusted, not importable or not valid. `trust` records the file as trusted (the command line's `--trust`). */
export async function loadConfig(root: string, options: { readonly trust: boolean }): Promise<Result<PlanningConfig, LoadProblem>> {
  const file = path.join(root, CONFIG_FILE);
  let text: string;
  try {
    text = await fs.readTextFile(file);
  } catch {
    const beside = ["planning.config.json", "planning.config.yaml", "planning.config.yml"].find((n) => fsExists(path.join(root, n)));
    return err({ code: "E-CONFIG-LOAD", message: beside === undefined ? `no ${CONFIG_FILE} at ${root}` : `no ${CONFIG_FILE} at ${root}; ${beside} is not read: a configuration is TypeScript` });
  }
  const hash = await sha256(text);
  if (fsExists(path.join(root, ".git"))) {
    const known = await fs.readTextFile(trustFile(root)).catch(() => "");
    if (known.trim() !== hash) {
      if (!options.trust) return err({ code: "E-TRUST", message: `${CONFIG_FILE} is TypeScript that would run with your permissions and you have not trusted this version of it` });
      await fs.writeTextFile(trustFile(root), `${hash}\n`);
    }
  }
  let value: unknown;
  try {
    const module: unknown = await import(`${path.toFileUrl(file).href}?v=${hash}`);
    value = typeof module === "object" && module !== null ? Reflect.get(module, "default") : undefined;
  } catch (e) {
    return err({ code: "E-CONFIG-LOAD", message: `${CONFIG_FILE} could not be loaded: ${e instanceof Error ? e.message : "an error"}` });
  }
  const parsed = parsePlanning(value);
  return parsed.kind === "ok" ? ok(parsed.value) : err({ code: "E-CONFIG-INVALID", message: `${parsed.error.path === "" ? "the configuration" : parsed.error.path}: expected ${parsed.error.expected}` });
}

function fsExists(p: string): boolean {
  try {
    return fs.statSync(p).isFile || fs.statSync(p).isDirectory;
  } catch {
    return false;
  }
}

/** What a run is given from outside. */
export type Host = {
  readonly cwd: string;
  readonly env: (name: string) => string | undefined;
  /** The wall time in milliseconds. */
  readonly now: () => number;
  /** The channel the run comes through: a person's command line or the tool server. */
  readonly channel: "cli" | "mcp";
  /** The client of a Git host for a repository: the live one reads its token from the environment; a test gives its own. */
  readonly githost?: (ref: RepoRef) => GitHostClient | undefined;
};

/** The policy a configuration says. */
export function policyOf(config: PlanningConfig): Policy {
  return { authority: config.authority ?? {}, confirmers: config.confirmers ?? "any-person" };
}

/** The store of events of the repository, a folder, made where it is not. */
export async function openPlanningStore(root: string, config: PlanningConfig): Promise<Result<PlanningStoreBackend, string>> {
  const dir = path.resolve(root, config.store.place);
  const rel = path.relative(root, dir);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return err(`the store ${config.store.place} is not inside the repository`);
  await fs.mkdir(dir, { recursive: true });
  return localStore(dir, { create: true });
}

function repoRefOf(place: string): RepoRef | undefined {
  const parts = place.split("/").filter((p) => p !== "");
  const [host, ...rest] = parts;
  if (host === undefined || rest.length < 2) return undefined;
  return { kind: host === "github.com" ? "Github" : host.startsWith("gitlab") ? "Gitlab" : "Git", host, path: rest };
}

/** The sources a configuration names, made over the repository at `root`. */
export async function openSources(root: string, config: PlanningConfig, host: Host): Promise<Result<readonly Source[], string>> {
  const rootStore = await localStore(root);
  if (rootStore.kind === "err") return err(rootStore.error);
  const agents: { [id: string]: { readonly actsFor: PersonActor } } = {};
  for (const [id, a] of Object.entries(config.agents ?? {})) {
    const p = person(a.actsFor, a.actsFor);
    if (p.kind === "ok") agents[id] = { actsFor: p.value };
  }
  const made: Source[] = [];
  for (const spec of config.sources) {
    const s = await sourceOf(spec, rootStore.value, root, host, agents);
    if (s.kind === "err") return s;
    made.push(s.value);
  }
  return ok(made);
}

async function sourceOf(spec: SourceConfig, store: PlanningStoreBackend, root: string, host: Host, agents: { [id: string]: { readonly actsFor: PersonActor } }): Promise<Result<Source, string>> {
  const wrap = (r: Result<Source, { readonly message: string }>): Result<Source, string> => (r.kind === "ok" ? r : err(r.error.message));
  switch (spec.name) {
    case "markdown":
      return wrap(fileSource(store, markdownLens(), spec.place));
    case "comments": {
      const anchors = spec.anchors ?? [];
      return wrap(fileSource(store, commentsLens({ ...(spec.markers === undefined ? {} : { markers: spec.markers }), anchorFiles: (p) => anchors.some((a) => p.startsWith(a.replace(/^\.\//u, ""))) }), spec.place));
    }
    case "issues":
      return wrap(fileSource(store, issuesLens({ scope: spec.scope }), spec.place));
    case "event-files":
      return wrap(fileSource(store, eventFilesLens({ agents }), spec.place));
    case "githost": {
      const ref = repoRefOf(spec.place);
      if (ref === undefined) return err(`the place of the githost source is host/owner/repository, and ${spec.place} is not`);
      const tokens: { [name: string]: string | undefined } = {};
      for (const n of ["GITHUB_TOKEN", "GH_TOKEN", "GITLAB_TOKEN", "CI_JOB_TOKEN"]) tokens[n] = host.env(n);
      const client = host.githost === undefined ? clientFor(ref, { env: tokens }) : host.githost(ref);
      if (client === undefined) return err(`no client of the Git host ${spec.place}`);
      return wrap(githostSource({ client, ref, ...(spec.issues === undefined ? {} : { issues: spec.issues }), repo: spec.repo === undefined ? root : path.resolve(root, spec.repo) }));
    }
    default: {
      const never: never = spec;
      return never;
    }
  }
}

/** The agent of an event of the tool server: its id from the environment, `agent` where there is none. */
export function agentIdOf(env: (name: string) => string | undefined): string {
  const id = env("PLANCTL_AGENT");
  return id === undefined || id === "" ? "agent" : id;
}

/** The person a text names, as `id` or `id:Name`. */
export function personOfText(text: string | undefined): PersonActor | undefined {
  if (text === undefined || text === "") return undefined;
  const [id, ...name] = text.split(":");
  const p = person(id ?? "", name.length === 0 ? (id ?? "") : name.join(":"));
  return p.kind === "ok" ? p.value : undefined;
}

