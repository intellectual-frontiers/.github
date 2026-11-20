// Spec: 0003-host FR-001
/**
 * Reading the workspace from disk (commons 0003-host FR-001, FR-002, FR-009, 0002-workspace-model FR-021, FR-022): the manifest `<home>/.ergonex/workspace.ts` is loaded and decoded once, the
 * templates run on it, the state record is read, and what is on disk is observed, so that the pure `plan` can be made from what the manifest wants and what was found. Nothing here changes anything.
 *
 * @remarks
 * `workspace.ts` is a TypeScript module whose default export is the manifest as a value; it is imported by its file URL (with its size and time in the query, so that a changed file is read again
 * within one process), and what it exports is data the decoder checks, never trusted. A manifest that does not decode is reported as `ergonex:Error` findings naming each field and stops the run before
 * anything is changed. A repository is observed with the real `git` by `host/observe.ts`; its local configuration is read for the keys the policy sets; a generated file's hash is that of its bytes.
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import { type Sha256, sha256 } from "@intellectual-frontiers/crypto";
import { existsSync, readDirSync, readTextFile, sha256File, statSync } from "../platform/r-fs.ts";
import { join, sep, toFileUrl } from "../platform/r-path.ts";
import { run } from "../platform/r-proc.ts";
import { desiredOf } from "../desired.ts";
import { movedPath, type Places } from "../places.ts";
import type { Finding } from "../findings.ts";
import { decodeManifest, issueFinding, type Manifest } from "../manifest.ts";
import { nativePath } from "../portable.ts";
import { entriesOf, REPOSITORIES_FILE, type RepoEntry, withEntries } from "../repositories.ts";
import { type Desired, type Observed, type ObservedFile, type ObservedRepo, plan, type Plan, planDigest } from "../plan.ts";
import { describeGenerateError, type GeneratedFile, type GenerateError } from "../render.ts";
import type { RepoState } from "../state.ts";
import { decodeStateRecord, EMPTY_RECORD, STATE_RECORD_PATH, type StateRecord } from "../state-record.ts";
import { renderAll, type TemplateData } from "../templates/mod.ts";
import type { RepoPath } from "../types.ts";
import type { Context, Outcome } from "../modules/types.ts";
import { direnvFound } from "./probe.ts";
import { type ObserveError, observe } from "./observe.ts";

/** Everything read of the workspace before anything is observed. */
export type Loaded = Site & {
  /** The root, as the system writes it. */
  readonly home: string;
  readonly manifest: Manifest;
  readonly data: TemplateData;
  /** The generated files the templates give. */
  readonly files: readonly GeneratedFile[];
  /** The state record, or an empty one where there is none yet. */
  readonly record: StateRecord;
  /** The hash of the record's text, where there is a record on disk. */
  readonly recordSha: Sha256 | undefined;
};

/** Why the workspace could not be loaded. */
export type LoadFailure =
  | { readonly kind: "no-home" }
  | { readonly kind: "no-places" }
  | { readonly kind: "no-root"; readonly home: string }
  | { readonly kind: "no-manifest"; readonly path: string }
  | { readonly kind: "manifest"; readonly findings: readonly Finding[] }
  | { readonly kind: "generate"; readonly errors: readonly GenerateError[] }
  | { readonly kind: "record"; readonly reason: string };

/** Where a run reads and writes: the root, which holds the repositories and the files that sit beside them, and the folders of Ergonex's own files (0031-install-locations). */
export type Site = { readonly home: string; readonly places: Places };

/** The workspace's own folder, below the root: the manifest and what is generated for tools to read. */
export const AREA = ".ergonex";

/** The folder of a path of the workspace, as the system writes it: what Ergonex remembers or installs is in the state or the data folder (0031-install-locations), any other path is below the root. */
export function native(site: Site, path: string): string {
  const moved = movedPath(site.places, path);
  if (moved !== undefined) return moved;
  return nativePath(site.home, path as RepoPath, sep === "\\" ? "\\" : "/"); // a path of the workspace is made only of portable segments
}

/**
 * Whether a run may pin an artifact on `http` to the loopback interface: only where the environment says so (`ERGONEX_ALLOW_LOOPBACK_HTTP=1`), for a person's own local mirror or a test's own server.
 *
 * @remarks
 * A stopgap until a test certificate authority replaces it (0002-workspace-model Assumptions): while it is on, every command that honors it says so (`LOOPBACK_NOTICE`) and the run's report holds `loopbackFinding`.
 */
export function loopbackAllowed(env: Readonly<Record<string, string | undefined>>): boolean {
  return env["ERGONEX_ALLOW_LOOPBACK_HTTP"] === "1";
}

/** The one line a command that honors `ERGONEX_ALLOW_LOOPBACK_HTTP` writes on standard error while it is set (0002-workspace-model FR-037). */
export const LOOPBACK_NOTICE =
  "ergonex: ERGONEX_ALLOW_LOOPBACK_HTTP is set: http to the loopback interface is accepted (the SHA-256 is still checked)";

/** The informational finding that records, in the report of the run, that the loopback switch was on. */
export function loopbackFinding(today: string): Finding {
  return {
    ruleId: "ergonex/loopback-http",
    severity: "Informational",
    message:
      "ERGONEX_ALLOW_LOOPBACK_HTTP is set: http to the loopback interface was accepted for pinned artifacts (the SHA-256 is still checked)",
    subject: "ERGONEX_ALLOW_LOOPBACK_HTTP",
    firstSeen: today,
  };
}

/** Where the manifest is. */
export function manifestPath(home: string): string {
  return join(home, AREA, "workspace.ts");
}

/** The value a file of the workspace's folder exports as its default, or why it cannot be had. */
async function importDefault(path: string, name: string, shape: string): Promise<Result<unknown, string>> {
  try {
    const s = statSync(path);
    const url = `${toFileUrl(path).href}?v=${s.size}-${s.mtime?.getTime() ?? 0}`;
    const mod: unknown = await import(url);
    const value: unknown = typeof mod === "object" && mod !== null ? Reflect.get(mod, "default") : undefined;
    if (value === undefined) return err(`${name} has no default export; it exports ${shape} as its default`);
    return ok(value);
  } catch (e) {
    return err(`${name} could not be loaded: ${e instanceof Error ? e.message : String(e)}`);
  }
}

const importManifest = (path: string): Promise<Result<unknown, string>> =>
  importDefault(path, "workspace.ts", "the manifest (`export default { repositories: [...] }`)");

/** Where the list of repositories that `ergonex repos add` keeps is (0005-repositories FR-001). */
export function repositoriesPath(home: string): string {
  return join(home, AREA, REPOSITORIES_FILE);
}

/** The entries of `.ergonex/repositories.ts`: none where there is no file, or why the file cannot be read. */
export async function readRepositoryList(home: string): Promise<Result<readonly RepoEntry[], string>> {
  const path = repositoriesPath(home);
  if (!existsSync(path)) return ok([]);
  const imported = await importDefault(path, "repositories.ts", "an array of repositories");
  return imported.kind === "err" ? imported : entriesOf(imported.value);
}

/** The manifest value `workspace.ts` exports, as it is, and the entries of the list beside it. */
export async function readRawManifest(
  home: string,
): Promise<Result<{ readonly base: unknown; readonly list: readonly RepoEntry[] }, string>> {
  const imported = await importManifest(manifestPath(home));
  if (imported.kind === "err") return imported;
  const list = await readRepositoryList(home);
  return list.kind === "err" ? list : ok({ base: imported.value, list: list.value });
}

/** Reads and decodes the manifest of a root, or says why it cannot be had: absent, or findings that name each field. */
export async function readManifest(home: string, today: string, loopbackHttp = false): Promise<Result<Manifest, LoadFailure>> {
  const path = manifestPath(home);
  if (!existsSync(path)) return err({ kind: "no-manifest", path });
  const imported = await readRawManifest(home);
  if (imported.kind === "err")
    return err({
      kind: "manifest",
      findings: [
        {
          ruleId: "ergonex/manifest-shape",
          severity: "Error",
          message: imported.error,
          subject: "$",
          firstSeen: today,
        },
      ],
    });
  const decoded = decodeManifest(withEntries(imported.value.base, imported.value.list), { loopbackHttp });
  if (decoded.kind === "err")
    return err({
      kind: "manifest",
      findings: decoded.error.map((i) => issueFinding(i, today)),
    });
  return ok(decoded.value);
}

/** Reads the root: its manifest, the generated files and the state record. */
export async function loadWorkspace(ctx: Context): Promise<Result<Loaded, LoadFailure>> {
  const home = ctx.home;
  const places = ctx.places;
  if (home === undefined) return err({ kind: "no-home" });
  if (places === undefined) return err({ kind: "no-places" });
  if (!existsSync(home)) return err({ kind: "no-root", home });
  const read = await readManifest(home, ctx.today, loopbackAllowed(ctx.env));
  if (read.kind === "err") return read;
  const manifest = read.value;
  const data: TemplateData = {
    manifest,
    direnv: manifest.direnv && direnvFound(ctx.env["PATH"]),
    tools: manifest.catalog.tools,
  };
  const rendered = renderAll(data);
  if (rendered.kind === "err") return err({ kind: "generate", errors: rendered.error });
  let record: StateRecord = EMPTY_RECORD;
  let recordSha: Sha256 | undefined;
  const recordPath = native({ home, places }, STATE_RECORD_PATH);
  if (existsSync(recordPath)) {
    const text = await readTextFile(recordPath);
    const read = decodeStateRecord(text);
    if (read.kind === "err") return err({ kind: "record", reason: read.error });
    record = read.value;
    recordSha = await sha256(text);
  }
  return ok({
    home,
    places,
    manifest,
    data,
    files: rendered.value,
    record,
    recordSha,
  });
}

/** What a failure to load is as the outcome of a command: a host that cannot do it (3), or findings that stop the run (1). */
export function loadFailureOutcome(f: LoadFailure, ctx: Context): Outcome {
  switch (f.kind) {
    case "no-home":
      return err({
        kind: "environment",
        message: "no root can be found: set ERGONEX_HOME, or HOME (USERPROFILE on Windows), or give --home",
      });
    case "no-places":
      return err({
        kind: "environment",
        message:
          "no folder can be found to keep what ergonex remembers and installs: set HOME (USERPROFILE on Windows), or XDG_DATA_HOME and XDG_STATE_HOME",
      });
    case "no-root":
      return err({
        kind: "environment",
        message: `the root ${f.home} does not exist; run \`ergonex init --home ${f.home}\` to make it`,
      });
    case "no-manifest":
      return err({
        kind: "environment",
        message: `there is no manifest at ${f.path}; run \`ergonex init\` to write a starter`,
      });
    case "manifest":
      return ok({
        text: f.findings.map((x) => `error ${x.subject}: ${x.message}`).join("\n"),
        data: { stopped: "the manifest does not decode; nothing was changed" },
        findings: f.findings,
        status: "Findings",
      });
    case "generate": {
      const findings: Finding[] = f.errors.map((e) => ({
        ruleId: "ergonex/generated-path",
        severity: "Error",
        message: describeGenerateError(e),
        subject: "templates",
        firstSeen: ctx.today,
      }));
      return ok({
        text: findings.map((x) => `error ${x.subject}: ${x.message}`).join("\n"),
        data: {
          stopped: "a template made a file that is refused; nothing was written",
        },
        findings,
        status: "Findings",
      });
    }
    case "record": {
      const findings: Finding[] = [
        {
          ruleId: "ergonex/state-record",
          severity: "Error",
          message: `the state record ${STATE_RECORD_PATH} cannot be read (${f.reason}); fix it by hand or remove it, and run \`ergonex render\``,
          subject: STATE_RECORD_PATH,
          firstSeen: ctx.today,
        },
      ];
      return ok({
        text: `error ${findings[0]?.message ?? ""}`,
        data: { stopped: "the state record is damaged; nothing was changed" },
        findings,
        status: "Findings",
      });
    }
    default:
      return absurd(f);
  }
}

/** Everything the plan is made from. */
export type Situation = {
  readonly loaded: Loaded;
  readonly desired: Desired;
  readonly observed: Observed;
  readonly plan: Plan;
  readonly planSha: Sha256;
};

/** The local configuration of a repository, for the keys given. */
async function configOf(folder: string, keys: readonly string[]): Promise<Readonly<Record<string, string>>> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const r = await run(["git", "-C", folder, "config", "--local", "--get", key], { env: { GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" } });
    if (r.success) out[key] = r.stdout.trim();
  }
  return out;
}

/** Whether a repository has another worktree than its own checkout: another worker may be on it. */
async function busy(folder: string): Promise<boolean> {
  const r = await run(["git", "-C", folder, "worktree", "list", "--porcelain"], { env: { GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" } });
  return r.success && r.stdout.split("\n").filter((l) => l.startsWith("worktree ")).length > 1;
}

/** Observes the workspace against what the manifest wants and makes the plan. `fetch` updates the remote-tracking references first (the one thing that uses the network). */
export async function situate(
  ctx: Context,
  loaded: Loaded,
  options: { readonly fetch: boolean },
): Promise<Result<Situation, ObserveError>> {
  const homePosix = loaded.home.replaceAll("\\", "/");
  const desired = await desiredOf(loaded.manifest, loaded.files, {
    homePosix,
    windows: ctx.platform.windows,
  });
  const repos: Record<string, ObservedRepo> = {};
  for (const r of desired.repos) {
    const folder = native(loaded, r.path);
    const state = await observe(folder, r.ref, { fetch: options.fetch });
    if (state.kind === "err") return state;
    const present = state.value.kind !== "Missing" && state.value.kind !== "NotARepo" && state.value.kind !== "WrongRemote";
    repos[r.path] = {
      state: state.value,
      config: present ? await configOf(folder, Object.keys(r.settings)) : {},
      busy: present ? await busy(folder) : false,
    };
  }
  const worktrees: Record<string, RepoState> = {};
  for (const w of desired.worktrees) {
    const folder = native(loaded, w.path);
    worktrees[w.path] = existsSync(folder) && readDirSync(folder).length > 0 ? { kind: "Clean" } : { kind: "Missing" };
  }
  const files: Record<string, ObservedFile> = {};
  const paths = new Set([...desired.files.map((f) => f.path as string), ...Object.keys(loaded.record.files)]);
  for (const p of paths) {
    const disk = native(loaded, p);
    files[p] = {
      onDisk: existsSync(disk) ? await sha256File(disk) : undefined,
      recorded: loaded.record.files[p]?.sha256,
    };
  }
  const observed: Observed = { repos, worktrees, files };
  const made = plan(desired, observed);
  return ok({
    loaded,
    desired,
    observed,
    plan: made,
    planSha: await planDigest(made),
  });
}
