/**
 * Files and folders (commons 0005-typescript-runtime FR-020), on `node:fs` alone, so the same code runs on Deno, Node and Bun. The functions
 * the three codebases call on `Deno` keep their names and shapes (`readTextFile`, `writeTextFile`, `remove`, `mkdir`, `stat`, `readDir`,
 * `makeTempDir`, ...), so a conversion is a rename; every failure is thrown as an error of `./errors.ts` (`NotFound`, `AlreadyExists`, ...).
 * The helpers Stolos wrote over them (`exists`, `readTextOr`, `ensureDir`, `writeIfChanged`, `listDirs`, `listFiles`, `walkFiles`) and the
 * setup's `sha256File` are here too.
 *
 * @example
 * ```ts
 * import { makeTempDir, readTextFile, remove, writeTextFile } from "./fs.ts";
 * const dir = await makeTempDir({ prefix: "example-" });
 * await writeTextFile(`${dir}/a.txt`, "hello");
 * await readTextFile(`${dir}/a.txt`); // "hello"
 * await remove(dir, { recursive: true });
 * ```
 *
 * @module
 */
import { createHash } from "node:crypto";
import * as nfs from "node:fs";
import * as fsp from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import type { Sha256 } from "../kernel/sha256.ts";
import { hostCall, hostCallSync, NotFound } from "./errors.ts";

/** A path, as a string or a `file:` URL. */
export type PathLike = string | URL;

const p = (path: PathLike): string => (typeof path === "string" ? path : fileURLToPath(path));

/** What `stat` knows of a file, by `Deno.FileInfo`'s names. A time the file system does not keep is `null`. */
export type FileInfo = {
  readonly isFile: boolean;
  readonly isDirectory: boolean;
  readonly isSymlink: boolean;
  readonly size: number;
  readonly mtime: Date | null;
  readonly atime: Date | null;
  readonly birthtime: Date | null;
  readonly ctime: Date | null;
  readonly mode: number | null;
  readonly uid: number | null;
  readonly gid: number | null;
  readonly dev: number;
  readonly ino: number | null;
  readonly nlink: number | null;
};

const time = (ms: number): Date | null => (Number.isFinite(ms) && ms > 0 ? new Date(ms) : null);

function info(s: nfs.Stats): FileInfo {
  return {
    isFile: s.isFile(),
    isDirectory: s.isDirectory(),
    isSymlink: s.isSymbolicLink(),
    size: s.size,
    mtime: time(s.mtimeMs),
    atime: time(s.atimeMs),
    birthtime: time(s.birthtimeMs),
    ctime: time(s.ctimeMs),
    mode: process.platform === "win32" ? null : s.mode,
    uid: process.platform === "win32" ? null : s.uid,
    gid: process.platform === "win32" ? null : s.gid,
    dev: s.dev,
    ino: process.platform === "win32" ? null : s.ino,
    nlink: process.platform === "win32" ? null : s.nlink,
  };
}

/** One entry of a folder, by `Deno.DirEntry`'s names. */
export type DirEntry = { readonly name: string; readonly isFile: boolean; readonly isDirectory: boolean; readonly isSymlink: boolean };

const entry = (d: nfs.Dirent): DirEntry => ({
  name: d.name,
  isFile: d.isFile(),
  isDirectory: d.isDirectory(),
  isSymlink: d.isSymbolicLink(),
});

/** How to write a file: append instead of replacing, refuse to make it (`create: false`), refuse where it exists (`createNew`), its mode. */
export type WriteFileOptions = {
  readonly append?: boolean;
  readonly create?: boolean;
  readonly createNew?: boolean;
  readonly mode?: number;
};

function flag(o: WriteFileOptions): string {
  if (o.createNew === true) return o.append === true ? "ax" : "wx";
  return o.append === true ? "a" : "w";
}

const modeOf = (o: WriteFileOptions): { mode?: number } => (o.mode === undefined ? {} : { mode: o.mode });

async function write(path: PathLike, data: string | Uint8Array, o: WriteFileOptions): Promise<void> {
  const file = p(path);
  await hostCall(file, async () => {
    if (o.create === false) await fsp.access(file);
    await fsp.writeFile(file, data, { flag: flag(o), ...modeOf(o) });
    if (o.mode !== undefined && process.platform !== "win32") await fsp.chmod(file, o.mode);
  });
}

function writeSync(path: PathLike, data: string | Uint8Array, o: WriteFileOptions): void {
  const file = p(path);
  hostCallSync(file, () => {
    if (o.create === false) nfs.accessSync(file);
    nfs.writeFileSync(file, data, { flag: flag(o), ...modeOf(o) });
    if (o.mode !== undefined && process.platform !== "win32") nfs.chmodSync(file, o.mode);
  });
}

/** A file's text, read as UTF-8. */
export function readTextFile(path: PathLike): Promise<string> {
  return hostCall(p(path), () => fsp.readFile(p(path), "utf8"));
}

/** A file's text, read as UTF-8, without waiting. */
export function readTextFileSync(path: PathLike): string {
  return hostCallSync(p(path), () => nfs.readFileSync(p(path), "utf8"));
}

/** A file's bytes. */
export async function readFile(path: PathLike): Promise<Uint8Array> {
  const b = await hostCall(p(path), () => fsp.readFile(p(path)));
  return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
}

/** A file's bytes, without waiting. */
export function readFileSync(path: PathLike): Uint8Array {
  const b = hostCallSync(p(path), () => nfs.readFileSync(p(path)));
  return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
}

/** Text written to a file as UTF-8, replacing it unless `append`. */
export function writeTextFile(path: PathLike, data: string, options: WriteFileOptions = {}): Promise<void> {
  return write(path, data, options);
}

/** Text written to a file as UTF-8, without waiting. */
export function writeTextFileSync(path: PathLike, data: string, options: WriteFileOptions = {}): void {
  writeSync(path, data, options);
}

/** Bytes written to a file, replacing it unless `append`. */
export function writeFile(path: PathLike, data: Uint8Array, options: WriteFileOptions = {}): Promise<void> {
  return write(path, data, options);
}

/** Bytes written to a file, without waiting. */
export function writeFileSync(path: PathLike, data: Uint8Array, options: WriteFileOptions = {}): void {
  writeSync(path, data, options);
}

/** How to remove: a folder and everything in it only with `recursive`. */
export type RemoveOptions = { readonly recursive?: boolean };

/** A file, a link or an empty folder removed; with `recursive`, a folder and everything in it. `NotFound` where nothing is there, as Deno throws it. */
export async function remove(path: PathLike, options: RemoveOptions = {}): Promise<void> {
  const file = p(path);
  await hostCall(file, async () => {
    const s = await fsp.lstat(file);
    if (s.isDirectory()) await (options.recursive === true ? fsp.rm(file, { recursive: true }) : fsp.rmdir(file));
    else await fsp.unlink(file);
  });
}

/** The same, without waiting. */
export function removeSync(path: PathLike, options: RemoveOptions = {}): void {
  const file = p(path);
  hostCallSync(file, () => {
    const s = nfs.lstatSync(file);
    if (s.isDirectory()) {
      if (options.recursive === true) nfs.rmSync(file, { recursive: true });
      else nfs.rmdirSync(file);
    } else nfs.unlinkSync(file);
  });
}

/** How to make a folder: its parents too (and no error where it exists) with `recursive`, and its mode. */
export type MkdirOptions = { readonly recursive?: boolean; readonly mode?: number };

/** A folder made. */
export async function mkdir(path: PathLike, options: MkdirOptions = {}): Promise<void> {
  const file = p(path);
  await hostCall(file, () =>
    fsp.mkdir(file, { recursive: options.recursive === true, ...(options.mode === undefined ? {} : { mode: options.mode }) }),
  );
}

/** A folder made, without waiting. */
export function mkdirSync(path: PathLike, options: MkdirOptions = {}): void {
  const file = p(path);
  hostCallSync(file, () =>
    nfs.mkdirSync(file, { recursive: options.recursive === true, ...(options.mode === undefined ? {} : { mode: options.mode }) }),
  );
}

/** What is at a path, following links. */
export async function stat(path: PathLike): Promise<FileInfo> {
  return info(await hostCall(p(path), () => fsp.stat(p(path))));
}

/** What is at a path, following links, without waiting. */
export function statSync(path: PathLike): FileInfo {
  return info(hostCallSync(p(path), () => nfs.statSync(p(path))));
}

/** What is at a path; a link is described, not followed. */
export async function lstat(path: PathLike): Promise<FileInfo> {
  return info(await hostCall(p(path), () => fsp.lstat(p(path))));
}

/** What is at a path; a link is described, not followed; without waiting. */
export function lstatSync(path: PathLike): FileInfo {
  return info(hostCallSync(p(path), () => nfs.lstatSync(p(path))));
}

/** The entries of a folder, in the order the file system gives them. */
export async function* readDir(path: PathLike): AsyncIterable<DirEntry> {
  const dir = p(path);
  const entries = await hostCall(dir, () => fsp.readdir(dir, { withFileTypes: true }));
  for (const d of entries) yield entry(d);
}

/** The entries of a folder, without waiting. */
export function readDirSync(path: PathLike): DirEntry[] {
  const dir = p(path);
  return hostCallSync(dir, () => nfs.readdirSync(dir, { withFileTypes: true })).map(entry);
}

/** Where and how a temporary file or folder is named: in `dir` (the system's by default), with a `prefix` and `suffix`. */
export type MakeTempOptions = { readonly dir?: string; readonly prefix?: string; readonly suffix?: string };

/** What `mkdtemp` is given: the folder with a separator, then the prefix, so that the random part is added inside the folder and not to its name. */
const tempBase = (options: MakeTempOptions): string => {
  const dir = options.dir ?? tmpdir();
  return `${dir.endsWith(sep) ? dir : `${dir}${sep}`}${options.prefix ?? ""}`;
};

/** A new, empty, private folder, and its path. */
export async function makeTempDir(options: MakeTempOptions = {}): Promise<string> {
  const base = tempBase(options);
  const made = await hostCall(base, () => fsp.mkdtemp(base));
  if (options.suffix === undefined || options.suffix === "") return made;
  await hostCall(made, () => fsp.rename(made, `${made}${options.suffix}`));
  return `${made}${options.suffix}`;
}

/** A new, empty, private folder, without waiting. */
export function makeTempDirSync(options: MakeTempOptions = {}): string {
  const base = tempBase(options);
  return hostCallSync(base, () => nfs.mkdtempSync(base));
}

/** A new, empty, private file, and its path. */
export async function makeTempFile(options: MakeTempOptions = {}): Promise<string> {
  const dir = options.dir ?? tmpdir();
  for (let i = 0; i < 100; i++) {
    const name = join(dir, `${options.prefix ?? ""}${crypto.randomUUID().slice(0, 12)}${options.suffix ?? ""}`);
    try {
      await hostCall(name, () => fsp.writeFile(name, "", { flag: "wx", mode: 0o600 }));
      return name;
    } catch (e) {
      if (!(e instanceof Error && "code" in e && e.code === "EEXIST")) throw e;
    }
  }
  throw new Error(`no free temporary file name in ${dir}`);
}

/** A file or folder moved to a new path, replacing a file there. */
export function rename(from: PathLike, to: PathLike): Promise<void> {
  return hostCall(p(from), () => fsp.rename(p(from), p(to)));
}

/** The same, without waiting. */
export function renameSync(from: PathLike, to: PathLike): void {
  hostCallSync(p(from), () => nfs.renameSync(p(from), p(to)));
}

/** A file's bytes copied to a new path, replacing a file there. */
export function copyFile(from: PathLike, to: PathLike): Promise<void> {
  return hostCall(p(from), () => fsp.copyFile(p(from), p(to)));
}

/** A file's mode changed (ignored on Windows, which has none). */
export async function chmod(path: PathLike, mode: number): Promise<void> {
  if (process.platform === "win32") return;
  await hostCall(p(path), () => fsp.chmod(p(path), mode));
}

/** A link at `path` that points at `target`; `type` matters on Windows only. */
export function symlink(target: PathLike, path: PathLike, options: { readonly type?: "file" | "dir" } = {}): Promise<void> {
  return hostCall(p(path), () => fsp.symlink(p(target), p(path), options.type));
}

/** Where a link points, as it was written. */
export function readLink(path: PathLike): Promise<string> {
  return hostCall(p(path), () => fsp.readlink(p(path)));
}

/** The absolute path with every link followed. */
export function realPath(path: PathLike): Promise<string> {
  return hostCall(p(path), () => fsp.realpath(p(path)));
}

/** A file cut (or extended with zeros) to `length` bytes, 0 by default. */
export function truncate(path: PathLike, length = 0): Promise<void> {
  return hostCall(p(path), () => fsp.truncate(p(path), length));
}

/** A file's access and modification times set. */
export function utime(path: PathLike, atime: Date | number, mtime: Date | number): Promise<void> {
  return hostCall(p(path), () => fsp.utimes(p(path), atime, mtime));
}

/** Whether something is at `path` (a file, folder or link; a broken link counts). An error other than `NotFound` is thrown. */
export async function exists(path: PathLike): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (e) {
    if (e instanceof NotFound) return false;
    throw e;
  }
}

/** The same, without waiting. */
export function existsSync(path: PathLike): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (e) {
    if (e instanceof NotFound) return false;
    throw e;
  }
}

/** A text file's content, or `fallback` (undefined unless given) where nothing is there. Other errors are thrown. */
export async function readTextOr<F extends string | undefined = undefined>(path: PathLike, fallback?: F): Promise<string | F> {
  try {
    return await readTextFile(path);
  } catch (e) {
    if (e instanceof NotFound) return fallback as F;
    throw e;
  }
}

/** A folder and its parents made, where missing. */
export function ensureDir(path: PathLike): Promise<void> {
  return mkdir(path, { recursive: true });
}

/**
 * A text file written only where its content changed, in one step (a file beside it renamed over it, so a reader never sees half of it),
 * its folder made where missing. Whether it was written.
 */
export async function writeIfChanged(path: PathLike, content: string): Promise<boolean> {
  const file = p(path);
  if ((await readTextOr(file)) === content) return false;
  await ensureDir(dirname(file));
  const tmp = `${file}.${crypto.randomUUID().slice(0, 8)}.tmp`;
  await writeTextFile(tmp, content);
  try {
    await rename(tmp, file);
  } catch (e) {
    await remove(tmp).catch(() => {});
    throw e;
  }
  return true;
}

async function namesIn(path: PathLike, keep: (e: DirEntry) => boolean): Promise<string[]> {
  const out: string[] = [];
  try {
    for await (const e of readDir(path)) if (keep(e)) out.push(e.name);
  } catch (e) {
    if (!(e instanceof NotFound)) throw e;
  }
  return out.sort();
}

/** The names of the folders directly in `path`, sorted; none where it does not exist. */
export function listDirs(path: PathLike): Promise<string[]> {
  return namesIn(path, (e) => e.isDirectory);
}

/** The names of the files directly in `path` that end in `suffix`, sorted; none where it does not exist. */
export function listFiles(path: PathLike, suffix = ""): Promise<string[]> {
  return namesIn(path, (e) => e.isFile && e.name.endsWith(suffix));
}

/** Every file under a folder (links included, not followed), by its path relative to it with `/` between parts, sorted; none where it does not exist. */
export async function walkFiles(root: PathLike, rel = ""): Promise<string[]> {
  const out: string[] = [];
  const base = p(root);
  try {
    for await (const e of readDir(rel === "" ? base : join(base, rel))) {
      const r = rel === "" ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory) out.push(...(await walkFiles(base, r)));
      else out.push(r);
    }
  } catch (e) {
    if (!(e instanceof NotFound)) throw e;
  }
  return out.sort();
}

/** The SHA-256 of a file, read as a stream so a large file is not held in memory. */
export async function sha256File(path: PathLike): Promise<Sha256> {
  const file = p(path);
  return await hostCall(
    file,
    () =>
      new Promise<Sha256>((resolve, reject) => {
        const hash = createHash("sha256");
        nfs
          .createReadStream(file)
          .on("error", reject)
          .on("data", (chunk) => hash.update(chunk))
          .on("end", () => resolve(hash.digest("hex") as Sha256));
      }),
  );
}

/** A temporary folder for the length of `f`, removed with everything in it afterwards, whatever `f` does. */
export async function withTempDir<T>(f: (dir: string) => Promise<T>, options: MakeTempOptions = {}): Promise<T> {
  const dir = await makeTempDir(options);
  try {
    return await f(dir);
  } finally {
    await remove(dir, { recursive: true }).catch(() => {});
  }
}
