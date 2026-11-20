// Spec: 0003-native-pinned-store FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
/**
 * The store of the dialect, the host half of an install: a folder of the user's own with a short path, a download kept only where it is the pinned one, one lock for each tool, and an install that is
 * unpacked in a temporary folder inside the store and switched into its place by a rename that is retried where Windows refuses it (an antivirus program or a sync client holds a file). Nothing is
 * written outside the store and no administrator rights are used.
 *
 * @remarks
 * The switch moves an existing copy aside first and removes it only when the new one is in place, so that a switch that fails leaves the old copy as it was. A rename refused with `EPERM`, `EBUSY`
 * or `EACCES` is retried with a pause that grows; any other error ends it at once.
 *
 * @example
 * ```ts
 * import { toolFolder } from "./store.ts";
 * // toolFolder(store, "bun", "1.4.4") is <store>/bun/1.4.4, with no platform in the path
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { downloadVerified, type Retries } from "@intellectual-frontiers/net/net";
import { dirsOf, type Env } from "@intellectual-frontiers/system/dirs";
import * as fs from "@intellectual-frontiers/system/fs";
import { acquireLock } from "@intellectual-frontiers/system/lock";
import * as path from "@intellectual-frontiers/system/path";
import * as proc from "@intellectual-frontiers/system/proc";
import { INSTALL_RECORD, installRecordOf, programFile, readInstallRecord, shimOf, unpackVerified, writeInstallRecord, type InstallError, type InstallRecord, type InstallSpec, type Os, describeInstallError } from "./install.ts";

/** The store: its root folder and the system it is on. */
export type Store = { readonly root: string; readonly os: Os };

/** The operating system this process runs on, as the store names it. */
export function osHere(): Os {
  return proc.build.os === "windows" ? "windows" : proc.build.os === "darwin" ? "macos" : "linux";
}

/** The platform this process runs on, named as the packaging ontology names it (`linux-x64`, `macos-arm64`, `windows-x64`), or nothing for one it has no name for. */
export function platformHere(): string | undefined {
  const arch = proc.build.arch === "x86_64" ? "x64" : proc.build.arch === "aarch64" ? "arm64" : undefined;
  return arch === undefined ? undefined : `${osHere()}-${arch}`;
}

/** The store of a user, from the environment: the data folder of the program `archon` with `tools`; nothing where no home can be found. */
export function storeOf(env: Env, os: Os): Store | undefined {
  const dirs = dirsOf("archon", env, os === "macos" ? "darwin" : os);
  return dirs.data === undefined ? undefined : { root: path.join(dirs.data, "tools"), os };
}

/** The folder of a tool at a version: `<store>/<name>/<version>`, with no platform in it, so that the path stays short. */
export function toolFolder(store: Store, name: string, version: string): string {
  return path.join(store.root, name, version);
}

/** The folder of the shims of the store. */
export function shimFolder(store: Store): string {
  return path.join(store.root, "bin");
}

/** What the switch does to the file system; a test passes one that fails as Windows does. */
export type FsOps = {
  readonly rename: (from: string, to: string) => Promise<void>;
  readonly remove: (target: string) => Promise<void>;
  readonly exists: (target: string) => Promise<boolean>;
  readonly pause: (ms: number) => Promise<void>;
};

/** The real file system. */
export const realFs: FsOps = {
  rename: (a, b) => fs.rename(a, b),
  remove: (p) => fs.remove(p, { recursive: true }),
  exists: (p) => fs.exists(p),
  pause: (ms) => proc.sleep(ms),
};

const RETRYABLE: readonly string[] = ["EPERM", "EBUSY", "EACCES"];

function codeOf(e: unknown): string {
  return typeof e === "object" && e !== null && "code" in e && typeof e.code === "string" ? e.code : "";
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** A rename, tried again where it is refused as a busy or guarded file is (`EPERM`, `EBUSY`, `EACCES`), with a pause that grows; any other error ends it. */
export async function renameRetrying(ops: FsOps, from: string, to: string, tries = 6): Promise<Result<void, string>> {
  for (let attempt = 1; ; attempt++) {
    try {
      await ops.rename(from, to);
      return ok(undefined);
    } catch (e) {
      if (!RETRYABLE.includes(codeOf(e)) || attempt >= tries) return err(`${messageOf(e)} (after ${attempt} ${attempt === 1 ? "try" : "tries"})`);
      await ops.pause(100 * attempt);
    }
  }
}

/** Puts `temp` in place of `target`: an existing target is moved aside first and removed once the new one is in place, and where the switch fails the old copy is put back and `temp` is removed. */
export async function switchInto(ops: FsOps, temp: string, target: string, aside: string): Promise<Result<void, string>> {
  const had = await ops.exists(target);
  if (had) {
    const moved = await renameRetrying(ops, target, aside);
    if (moved.kind === "err") {
      await ops.remove(temp).catch(() => undefined);
      return err(`the old copy could not be moved aside: ${moved.error}`);
    }
  }
  const put = await renameRetrying(ops, temp, target);
  if (put.kind === "err") {
    if (had) await renameRetrying(ops, aside, target);
    await ops.remove(temp).catch(() => undefined);
    return err(`the new copy could not be put in place: ${put.error}`);
  }
  if (had) await ops.remove(aside).catch(() => undefined);
  return ok(undefined);
}

/** The steps of an install, as a failure names them. */
export type Step = "lock" | "download" | "checksum" | "unpack" | "switch";

/** A failure: the tool, the step, what the step saw and the one action that is next. */
export type InstallFailure = { readonly tool: string; readonly step: Step; readonly saw: string; readonly next: string };

/** A failure as one sentence. */
export function describeFailure(f: InstallFailure): string {
  return `${f.tool}: ${f.step} failed: ${f.saw}. Next: ${f.next}`;
}

/** What an install is done with. */
export type InstallOptions = {
  readonly retries: Retries;
  readonly ops?: FsOps;
  /** A word that makes a temporary name unique. */
  readonly unique?: () => string;
  /** How long to wait for another run that installs the same tool. */
  readonly lockTimeoutMs?: number;
};

/** Where a tool is. */
export type Installed = { readonly folder: string; readonly program: string; readonly record: InstallRecord; readonly fresh: boolean };

/** The record of a tool at a version in the store, where its program is there too. */
export async function readInstalled(store: Store, name: string, version: string, os: Os = store.os): Promise<Installed | undefined> {
  const folder = toolFolder(store, name, version);
  const text = await fs.readTextOr(path.join(folder, INSTALL_RECORD));
  if (text === undefined) return undefined;
  const record = readInstallRecord(text);
  if (record.kind === "err") return undefined;
  const program = path.join(folder, ...record.value.program.split("/"));
  void os;
  return (await fs.exists(program)) ? { folder, program, record: record.value, fresh: false } : undefined;
}

const fail = (tool: string, step: Step, saw: string, next: string): Result<never, InstallFailure> => err({ tool, step, saw, next });

function failureOf(spec: InstallSpec, e: InstallError): InstallFailure {
  const saw = describeInstallError(e);
  switch (e.kind) {
    case "hash-mismatch":
      return { tool: spec.tool, step: "checksum", saw, next: "check the pin in the packaging ontology against the publisher's own checksum, and do not install until they agree" };
    case "unpack":
    case "duplicate-path":
    case "link":
    case "missing-program":
      return { tool: spec.tool, step: "unpack", saw, next: "check that the pin names the right artifact, folder and program for this platform" };
  }
}

/** Installs a tool in the store: under its lock, from the cache or a verified download, unpacked beside its place and switched in; and a copy that is there and as pinned is answered with no network and no write. */
export async function installTool(store: Store, spec: InstallSpec, o: InstallOptions): Promise<Result<Installed, InstallFailure>> {
  const ops = o.ops ?? realFs;
  await fs.mkdir(path.join(store.root, ".locks"), { recursive: true });
  const held = await acquireLock(path.join(store.root, ".locks", spec.tool), { wait: true, command: "archon tool ensure", timeoutMs: o.lockTimeoutMs ?? 600_000 });
  if (held === undefined) return fail(spec.tool, "lock", `another run holds the lock of ${spec.tool} and did not finish in time`, `wait for it, or remove ${path.join(store.root, ".locks", spec.tool)} if no run is going`);
  try {
    const there = await readInstalled(store, spec.tool, spec.version, spec.os);
    if (there !== undefined && there.record.artifactSha256 === spec.sha256) return ok(there);

    const got = await downloadVerified(o.retries, spec.downloadUrl, spec.sha256, path.join(store.root, ".cache"));
    if (got.kind === "err") {
      const checksum = got.error.includes("not the one expected");
      return fail(spec.tool, checksum ? "checksum" : "download", got.error, checksum ? "check the pin in the packaging ontology against the publisher's own checksum" : "check the network and run again; a part of the download is kept and resumed");
    }
    const bytes = await fs.readFile(got.value);
    const files = await unpackVerified(spec, bytes);
    if (files.kind === "err") return err(failureOf(spec, files.error));

    const unique = (o.unique ?? (() => `${proc.pid}-${Date.now().toString(36)}`))();
    const temp = path.join(store.root, `.unpack-${unique}`);
    const folder = toolFolder(store, spec.tool, spec.version);
    await fs.mkdir(path.join(store.root, spec.tool), { recursive: true });
    await ops.remove(temp).catch(() => undefined);
    for (const [p, data] of files.value) {
      const target = path.join(temp, ...p.split("/"));
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, data);
      if (store.os !== "windows" && (p === programFile(spec) || path.dirname(p) === (spec.binPath === "" ? "." : spec.binPath))) await fs.chmod(target, 0o755);
    }
    await fs.writeTextFile(path.join(temp, INSTALL_RECORD), writeInstallRecord(await installRecordOf(spec, files.value)));

    const switched = await switchInto(ops, temp, folder, `${folder}.old-${unique}`);
    if (switched.kind === "err") return fail(spec.tool, "switch", switched.error, "close the programs that use the tool, pause the antivirus or sync client on the store folder, and run again");

    const program = path.join(folder, ...programFile(spec).split("/"));
    const shim = shimOf(store.os, spec.program, program);
    if (shim.kind === "ok") {
      await fs.mkdir(shimFolder(store), { recursive: true });
      const shimPath = path.join(shimFolder(store), shim.value.name);
      await fs.writeTextFile(shimPath, shim.value.text);
      if (store.os !== "windows") await fs.chmod(shimPath, 0o755);
    }
    const record = readInstallRecord(await fs.readTextFile(path.join(folder, INSTALL_RECORD)));
    return record.kind === "ok" ? ok({ folder, program, record: record.value, fresh: true }) : fail(spec.tool, "switch", `the install record was not readable after the switch: ${record.error}`, "run again");
  } finally {
    held.release();
  }
}

/** What `clean` removed. */
export type Cleaned = { readonly what: string; readonly path: string; readonly bytes: number };

async function sizeOf(folder: string): Promise<number> {
  let total = 0;
  for (const rel of await fs.walkFiles(folder)) {
    try {
      total += (await fs.stat(path.join(folder, rel))).size;
    } catch {
      // a file that went while it was counted does not count
    }
  }
  return total;
}

/** Removes what can be got again, each with its size: the cache, the leftover temporary folders and, where asked, the programs of the store. */
export async function cleanStore(store: Store, o: { readonly programs: boolean }): Promise<readonly Cleaned[]> {
  const out: Cleaned[] = [];
  const take = async (what: string, target: string): Promise<void> => {
    if (!(await fs.exists(target))) return;
    out.push({ what, path: target, bytes: await sizeOf(target) });
    await fs.remove(target, { recursive: true });
  };
  await take("the downloads kept", path.join(store.root, ".cache"));
  if (await fs.exists(store.root)) {
    for (const d of await fs.listDirs(store.root)) {
      if (d.startsWith(".unpack-")) await take("a leftover unpack", path.join(store.root, d));
    }
  }
  if (o.programs && (await fs.exists(store.root))) {
    for (const d of await fs.listDirs(store.root)) {
      if (!d.startsWith(".") && d !== "bin") await take("the programs of a tool", path.join(store.root, d));
    }
    await take("the shims", shimFolder(store));
  }
  return out;
}
