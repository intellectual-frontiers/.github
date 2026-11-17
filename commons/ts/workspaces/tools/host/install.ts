/**
 * The host layer of the pinned install (commons 0023-if-workspaces FR-039, 0025-ifws FR-018): fetches ONLY the pinned URL of the catalog through the runtime's `Transport`, checks the SHA-256 of
 * the bytes against the pin before it writes anything (a hash that differs writes nothing), unpacks in memory, writes the tool into `<home>/.if-workspaces/tools/<name>/<version>/` through a
 * folder of its own that is renamed into place, writes the install record and the shims, and reads an installed tool back to find what changed since.
 *
 * @remarks
 * Only `ifws setup --apply` calls `installTool` (0025-ifws FR-017); `ifws tools` only reads (`installedTools`, `verifyTool`). The transport refuses a request that carries a credential, so a
 * pinned URL never sends one.
 *
 * @limits Every command a tool provides is shimmed to the one executable the catalog names for the tool.
 *
 * @module
 */
import { err, ok, type Result } from "../../../kernel/result.ts";
import {
  sha256File,
  chmod,
  exists,
  mkdir,
  readTextOr,
  remove,
  rename,
  walkFiles,
  writeFile,
  writeTextFile,
  listDirs,
} from "../../../runtime/fs.ts";
import type { Transport } from "../../../runtime/http-client.ts";
import { dirname, join } from "../../../runtime/path.ts";
import { type Tool, type ToolArch, type ToolOs, artifactFor, installDirOf } from "../catalog.ts";
import {
  type InstallDrift,
  type InstallError,
  type InstallRecord,
  INSTALL_RECORD,
  SHIM_DIR,
  installDrift,
  installRecordOf,
  pinProblem,
  readInstallRecord,
  shimOf,
  unpackVerified,
  writeInstallRecord,
} from "../install.ts";
import type { InstalledTool } from "../inventory.ts";

/** What an install needs from the host. */
export type InstallDeps = {
  /** The workspace's root: the tools are below `<home>/.if-workspaces/tools/`. */
  readonly home: string;
  readonly transport: Transport;
  readonly os: ToolOs;
  readonly arch: ToolArch;
  /** Also accept `http` to the loopback interface as a pin: for a test's own server only (the catalog's decoder never does). */
  readonly loopbackHttp?: boolean;
};

/** A tool that is installed. */
export type Installed = {
  readonly name: string;
  readonly version: string;
  /** Its folder. */
  readonly dir: string;
  /** The executable. */
  readonly exe: string;
  /** The shims written or found, by their path. */
  readonly shims: readonly string[];
  /** Whether it was already there, whole, so that nothing was fetched. */
  readonly already: boolean;
};

/** The folder of a tool below the home, as an absolute path. */
export function toolDir(home: string, tool: Pick<Tool, "name" | "version">): string {
  return join(home, ...installDirOf(tool).split("/"));
}

/** The folder of the shims below the home. */
export function shimDir(home: string): string {
  return join(home, ...SHIM_DIR.split("/"));
}

/** The SHA-256 of every file under a folder, by its path inside it, the install record left out. */
async function hashes(dir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const rel of await walkFiles(dir)) if (rel !== INSTALL_RECORD) out[rel] = await sha256File(join(dir, ...rel.split("/")));
  return out;
}

async function writeShims(deps: InstallDeps, tool: Tool, exe: string): Promise<Result<readonly string[], InstallError>> {
  const dir = shimDir(deps.home);
  const written: string[] = [];
  for (const command of tool.provides) {
    const shim = shimOf(deps.os, command, exe);
    if (shim.kind === "err") return err({ kind: "unpinned", tool: tool.name, reason: shim.error });
    const path = join(dir, shim.value.name);
    try {
      await mkdir(dir, { recursive: true });
      await writeTextFile(path, shim.value.text, { mode: 0o755 });
    } catch (e) {
      return err({ kind: "write", path, reason: e instanceof Error ? e.message : String(e) });
    }
    written.push(path);
  }
  return ok(written);
}

/**
 * Installs a tool of the catalog for this system: nothing is fetched where the tool is already installed whole; the pinned artifact is fetched, its hash checked, and only then is anything
 * written (a refusal leaves the folder as it was); the files go into `<name>/<version>.partial` and that folder is renamed into place, so that a failed write leaves no half-installed tool.
 */
export async function installTool(deps: InstallDeps, tool: Tool): Promise<Result<Installed, InstallError>> {
  const artifact = artifactFor(tool, deps.os, deps.arch);
  if (artifact === undefined) return err({ kind: "no-artifact", tool: tool.name, system: `${deps.os} ${deps.arch}` });
  const problem = pinProblem(tool, artifact, deps.loopbackHttp === true);
  if (problem !== undefined) return err({ kind: "unpinned", tool: tool.name, reason: problem });
  const dir = toolDir(deps.home, tool);
  const exe = join(dir, ...artifact.bin.split("/"));

  const before = await verifyTool(deps.home, tool, deps.os, deps.arch);
  if (before.kind === "ok" && before.value.length === 0) {
    const shims = await writeShims(deps, tool, exe);
    return shims.kind === "err" ? shims : ok({ name: tool.name, version: tool.version, dir, exe, shims: shims.value, already: true });
  }

  const answer = await deps.transport.send({ method: "GET", url: artifact.url, headers: {}, binary: true });
  if (answer.kind === "err") return err({ kind: "fetch", url: artifact.url, reason: answer.error.message });
  if (answer.value.status !== 200) return err({ kind: "fetch", url: artifact.url, reason: `the host answered ${answer.value.status}` });
  const bytes = answer.value.bytes;
  if (bytes === undefined) return err({ kind: "fetch", url: artifact.url, reason: "the transport gave no bytes" });

  const files = await unpackVerified(artifact, bytes);
  if (files.kind === "err") return files;
  const record = await installRecordOf(tool, artifact, files.value);

  const partial = `${dir}.partial`;
  try {
    await remove(partial, { recursive: true });
  } catch {
    // nothing left over from an earlier run
  }
  try {
    for (const [path, data] of files.value) {
      const target = join(partial, ...path.split("/"));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, data);
    }
    await chmod(join(partial, ...artifact.bin.split("/")), 0o755);
    await writeTextFile(join(partial, INSTALL_RECORD), writeInstallRecord(record));
    if (await exists(dir)) await remove(dir, { recursive: true });
    await rename(partial, dir);
  } catch (e) {
    try {
      await remove(partial, { recursive: true });
    } catch {
      // the partial folder is already gone
    }
    return err({ kind: "write", path: dir, reason: e instanceof Error ? e.message : String(e) });
  }
  const shims = await writeShims(deps, tool, exe);
  return shims.kind === "err" ? shims : ok({ name: tool.name, version: tool.version, dir, exe, shims: shims.value, already: false });
}

/** What reading an installed tool says: the differences from its record (none where it is whole), or that it is not installed. */
export type Verified = Result<readonly InstallDrift[], "not-installed" | "no-record">;

/** Reads an installed tool back: the SHA-256 of each of its files against its install record, and the record against the catalog's pin for this system. */
export async function verifyTool(home: string, tool: Tool, os: ToolOs, arch: ToolArch): Promise<Verified> {
  const dir = toolDir(home, tool);
  if (!(await exists(dir))) return err("not-installed");
  const text = await readTextOr(join(dir, INSTALL_RECORD));
  if (text === undefined) return err("no-record");
  const record = readInstallRecord(text);
  if (record.kind === "err") return err("no-record");
  return ok(installDrift(record.value, await hashes(dir), artifactFor(tool, os, arch)));
}

/** The install record of a tool's folder, or undefined. */
export async function installRecordOfDir(dir: string): Promise<InstallRecord | undefined> {
  const text = await readTextOr(join(dir, INSTALL_RECORD));
  if (text === undefined) return undefined;
  const r = readInstallRecord(text);
  return r.kind === "ok" ? r.value : undefined;
}

/** Every tool installed below the home, by its install record (a folder with none is not listed). */
export async function installedTools(home: string): Promise<readonly InstalledTool[]> {
  const root = join(home, ".if-workspaces", "tools");
  const out: InstalledTool[] = [];
  for (const name of await listDirs(root)) {
    for (const version of await listDirs(join(root, name))) {
      if (version.endsWith(".partial")) continue;
      const r = await installRecordOfDir(join(root, name, version));
      if (r !== undefined && (r.os === "linux" || r.os === "macos" || r.os === "windows") && (r.arch === "x64" || r.arch === "arm64"))
        out.push({ name: r.name, version: r.version, os: r.os, arch: r.arch, url: r.url, sha256: r.artifactSha256 });
    }
  }
  return out;
}
