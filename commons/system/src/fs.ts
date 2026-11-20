// Spec: 0001-system FR-002
/**
 * Files and folders (commons 0005-typescript-runtime FR-020), on `node:fs` alone, so the same code runs on Bun and Node. The functions
 * have short, plain names and shapes (`readTextFile`, `writeTextFile`, `remove`, `mkdir`, `stat`, `readDir`,
 * `makeTempDir`, ...); every failure is thrown as an error of `./errors.ts` (`NotFound`, `AlreadyExists`, ...).
 * The helpers Stolos wrote over them (`exists`, `readTextOr`, `ensureDir`, `writeIfChanged`, `listDirs`, `listFiles`, `walkFiles`) and the
 * setup's `sha256File` are here too.
 *
 * `readDir` is an async iterable, with `chown` and `symlinkSync` (FR-048); `open` and `openSync` give an `FsFile`
 * with no lock, which is `./lock.ts`'s (FR-049); `copy` and `walk` are `@std/fs`'s (FR-050), and `expandGlob` gives the
 * entries a glob of `../kernel/glob.ts` matches, in byte order (FR-058).
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
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import * as nfs from "node:fs";
import * as fsp from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { absurd } from "@intellectual-frontiers/core";
import { formatGlobError, globRoot, globToRegExp, type GlobOptions } from "@intellectual-frontiers/formats/glob";
import type { Sha256 } from "@intellectual-frontiers/crypto/sha256";
import { AlreadyExists, hostCall, hostCallSync, InvalidData, NotADirectory, NotFound } from "./errors.ts";

/** A path, as a string or a `file:` URL. */
export type PathLike = string | URL;

const p = (path: PathLike): string => (typeof path === "string" ? path : fileURLToPath(path));

/** What `stat` knows of a file, by these names. A time the file system does not keep is `null`. */
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

/** One entry of a folder, by these names. */
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

/** A file, a link or an empty folder removed; with `recursive`, a folder and everything in it. `NotFound` where nothing is there; the error is of `./errors.ts`. */
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

/** The entries of a folder, in the order the file system gives them (FR-048); `NotFound` at the first step where it is not there. */
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

/** A second name, `to`, for the file at `from` (a hard link), refused with `AlreadyExists` where `to` is taken: a file put in place whole, or not at all. */
export function link(from: PathLike, to: PathLike): Promise<void> {
  return hostCall(p(to), () => fsp.link(p(from), p(to)));
}

/**
 * A link at `path` that points at `target`; `type` matters on Windows only. `junction` (a folder, FR-073) is the Windows link any account
 * may make (a symbolic link needs administrator rights or Developer Mode there): its target is made absolute, as Windows requires; on
 * Linux and macOS it is an ordinary symbolic link.
 */
export function symlink(target: PathLike, path: PathLike, options: { readonly type?: "file" | "dir" | "junction" } = {}): Promise<void> {
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

// FR-048: the rest of the folder calls.

/** A file's owner and group changed; `null` keeps one as it is. Ignored on Windows, which has no POSIX owners (FR-018). */
export async function chown(path: PathLike, uid: number | null, gid: number | null): Promise<void> {
  if (process.platform === "win32") return;
  await hostCall(p(path), () => fsp.chown(p(path), uid ?? -1, gid ?? -1));
}

/** A link at `path` that points at `target`, without waiting; `type` matters on Windows only (`junction`: see `symlink`). */
export function symlinkSync(target: PathLike, path: PathLike, options: { readonly type?: "file" | "dir" | "junction" } = {}): void {
  hostCallSync(p(path), () => nfs.symlinkSync(p(target), p(path), options.type));
}

// FR-049: a file handle.

/** How to open a file, by these names: `read` alone where none is given. `append` writes at the end and implies `write`. */
export type OpenOptions = {
  readonly read?: boolean;
  readonly write?: boolean;
  readonly append?: boolean;
  readonly truncate?: boolean;
  readonly create?: boolean;
  readonly createNew?: boolean;
  readonly mode?: number;
};

/** Where `seek` counts from: the start of the file, the handle's position, or the end (`start`, `current`, `end`). */
export type SeekWhence = "start" | "current" | "end";

function openFlags(path: string, o: OpenOptions): number {
  const c = nfs.constants;
  const write = o.write === true || o.append === true;
  if (o.read !== true && !write) throw new InvalidData(`open ${path}: none of read, write and append was asked for`, "EINVAL", path);
  if ((o.create === true || o.createNew === true) && !write)
    throw new InvalidData(`open ${path}: create needs write or append`, "EINVAL", path);
  if (o.truncate === true && o.write !== true) throw new InvalidData(`open ${path}: truncate needs write`, "EINVAL", path);
  let f = o.read === true && write ? c.O_RDWR : write ? c.O_WRONLY : c.O_RDONLY;
  if (o.append === true) f |= c.O_APPEND;
  if (o.create === true || o.createNew === true) f |= c.O_CREAT;
  if (o.createNew === true) f |= c.O_EXCL;
  // No O_TRUNC: Bun on Windows refuses O_TRUNC without O_CREAT with EINVAL, so `truncate` cuts the file once it is open (see `cutIfAsked`),
  // the same on every runtime and system.
  return f;
}

/** The file just opened cut to nothing where `truncate` was asked: what O_TRUNC does, done after the open (see {@link openFlags}). */
async function cutIfAsked(fd: number, path: string, o: OpenOptions): Promise<void> {
  if (o.truncate !== true) return;
  try {
    await hostCall(path, () => new Promise<void>((res, rej) => nfs.ftruncate(fd, 0, (e) => (e === null ? res() : rej(e)))));
  } catch (e) {
    nfs.closeSync(fd);
    throw e;
  }
}

/** The same, without waiting. */
function cutIfAskedSync(fd: number, path: string, o: OpenOptions): void {
  if (o.truncate !== true) return;
  try {
    hostCallSync(path, () => nfs.ftruncateSync(fd, 0));
  } catch (e) {
    nfs.closeSync(fd);
    throw e;
  }
}

const CHUNK = 64 * 1024;

/**
 * An open file: it reads and writes at its position (a handle opened with `append` always writes at the end), `seek`s,
 * `truncate`s, `stat`s and `sync`s, gives its bytes as a web `ReadableStream` and takes them as a `WritableStream` (each closes the file
 * when it ends), and is closed by `close`, `using` or `await using`. It has no lock: one run at a time is `./lock.ts` (FR-039, FR-049).
 * Made by {@link open} and {@link openSync}.
 */
export class FsFile implements Disposable, AsyncDisposable {
  readonly #fd: number;
  readonly #path: string;
  readonly #append: boolean;
  #pos = 0;
  #closed = false;
  #readable: ReadableStream<Uint8Array> | undefined;
  #writable: WritableStream<Uint8Array> | undefined;

  /** A handle over an open descriptor; use {@link open} or {@link openSync}. */
  constructor(fd: number, path: string, append: boolean) {
    this.#fd = fd;
    this.#path = path;
    this.#append = append;
  }

  #fdOpen(): number {
    if (this.#closed) throw new InvalidData(`${this.#path}: the file is closed`, "EBADF", this.#path);
    return this.#fd;
  }

  /** Bytes read into `buffer` from the position, which moves past them: how many, or `null` at the end of the file. */
  async read(buffer: Uint8Array): Promise<number | null> {
    const fd = this.#fdOpen();
    if (buffer.byteLength === 0) return 0;
    const at = this.#pos;
    const n = await hostCall(
      this.#path,
      () => new Promise<number>((res, rej) => nfs.read(fd, buffer, 0, buffer.byteLength, at, (e, got) => (e === null ? res(got) : rej(e)))),
    );
    if (n === 0) return null;
    this.#pos = at + n;
    return n;
  }

  /** The same, without waiting. */
  readSync(buffer: Uint8Array): number | null {
    const fd = this.#fdOpen();
    if (buffer.byteLength === 0) return 0;
    const n = hostCallSync(this.#path, () => nfs.readSync(fd, buffer, 0, buffer.byteLength, this.#pos));
    if (n === 0) return null;
    this.#pos += n;
    return n;
  }

  /** Bytes written at the position (at the end with `append`), which moves past them: how many, which may be fewer than given. */
  async write(data: Uint8Array): Promise<number> {
    const fd = this.#fdOpen();
    // With `append`, no position is given: Linux ignores one on an append handle, but Windows would write there (FR-018).
    const at = this.#append ? null : this.#pos;
    const n = await hostCall(
      this.#path,
      () => new Promise<number>((res, rej) => nfs.write(fd, data, 0, data.byteLength, at, (e, put) => (e === null ? res(put) : rej(e)))),
    );
    this.#pos =
      at === null
        ? (await hostCall(this.#path, () => new Promise<nfs.Stats>((res, rej) => nfs.fstat(fd, (e, s) => (e === null ? res(s) : rej(e))))))
            .size
        : at + n;
    return n;
  }

  /** The same, without waiting. */
  writeSync(data: Uint8Array): number {
    const fd = this.#fdOpen();
    const at = this.#append ? null : this.#pos;
    const n = hostCallSync(this.#path, () => nfs.writeSync(fd, data, 0, data.byteLength, at));
    this.#pos = at === null ? hostCallSync(this.#path, () => nfs.fstatSync(fd)).size : at + n;
    return n;
  }

  #seekTo(offset: number, base: number): number {
    const to = base + offset;
    if (!Number.isSafeInteger(to) || to < 0) throw new InvalidData(`${this.#path}: cannot seek to ${String(to)}`, "EINVAL", this.#path);
    this.#pos = to;
    return to;
  }

  /** The position moved by `offset` from the start, the position or the end; the new position, from the start. */
  async seek(offset: number, whence: SeekWhence = "start"): Promise<number> {
    const fd = this.#fdOpen();
    if (whence !== "end") return this.seekSync(offset, whence);
    const s = await hostCall(
      this.#path,
      () => new Promise<nfs.Stats>((res, rej) => nfs.fstat(fd, (e, st) => (e === null ? res(st) : rej(e)))),
    );
    return this.#seekTo(offset, s.size);
  }

  /** The same, without waiting. */
  seekSync(offset: number, whence: SeekWhence = "start"): number {
    const fd = this.#fdOpen();
    switch (whence) {
      case "start":
        return this.#seekTo(offset, 0);
      case "current":
        return this.#seekTo(offset, this.#pos);
      case "end":
        return this.#seekTo(offset, hostCallSync(this.#path, () => nfs.fstatSync(fd)).size);
      default:
        return absurd(whence);
    }
  }

  /** The file cut (or extended with zeros) to `length` bytes, 0 by default; the position is kept. */
  async truncate(length = 0): Promise<void> {
    const fd = this.#fdOpen();
    await hostCall(this.#path, () => new Promise<void>((res, rej) => nfs.ftruncate(fd, length, (e) => (e === null ? res() : rej(e)))));
  }

  /** The same, without waiting. */
  truncateSync(length = 0): void {
    const fd = this.#fdOpen();
    hostCallSync(this.#path, () => nfs.ftruncateSync(fd, length));
  }

  /** What the open file is. */
  async stat(): Promise<FileInfo> {
    const fd = this.#fdOpen();
    return info(
      await hostCall(this.#path, () => new Promise<nfs.Stats>((res, rej) => nfs.fstat(fd, (e, s) => (e === null ? res(s) : rej(e))))),
    );
  }

  /** The same, without waiting. */
  statSync(): FileInfo {
    const fd = this.#fdOpen();
    return info(hostCallSync(this.#path, () => nfs.fstatSync(fd)));
  }

  /** The file's data and metadata written through to the disk. */
  async sync(): Promise<void> {
    const fd = this.#fdOpen();
    await hostCall(this.#path, () => new Promise<void>((res, rej) => nfs.fsync(fd, (e) => (e === null ? res() : rej(e)))));
  }

  /** The same, without waiting. */
  syncSync(): void {
    const fd = this.#fdOpen();
    hostCallSync(this.#path, () => nfs.fsyncSync(fd));
  }

  /** The file's bytes from the position to the end, as a stream that closes the file when it ends or is cancelled. */
  get readable(): ReadableStream<Uint8Array> {
    this.#readable ??= new ReadableStream<Uint8Array>({
      pull: async (controller): Promise<void> => {
        const buffer = new Uint8Array(CHUNK);
        const n = await this.read(buffer);
        if (n === null) {
          this.close();
          controller.close();
        } else controller.enqueue(buffer.subarray(0, n));
      },
      cancel: (): void => this.close(),
    });
    return this.#readable;
  }

  /** A stream whose chunks are written whole at the position, closing the file when it is closed or aborted. */
  get writable(): WritableStream<Uint8Array> {
    this.#writable ??= new WritableStream<Uint8Array>({
      write: async (chunk): Promise<void> => {
        for (let done = 0; done < chunk.byteLength;) done += await this.write(chunk.subarray(done));
      },
      close: (): void => this.close(),
      abort: (): void => this.close(),
    });
    return this.#writable;
  }

  /** The file closed; closing it again does nothing. */
  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    hostCallSync(this.#path, () => nfs.closeSync(this.#fd));
  }

  /** Closed at the end of a `using` block. */
  [Symbol.dispose](): void {
    this.close();
  }

  /** Closed at the end of an `await using` block. */
  [Symbol.asyncDispose](): Promise<void> {
    this.close();
    return Promise.resolve();
  }
}

const modeArg = (o: OpenOptions): number => (o.mode === undefined ? 0o666 : o.mode);

/** A file opened for reading where no options are given. `AlreadyExists` with `createNew`, `NotFound` without `create`. */
export async function open(path: PathLike, options: OpenOptions = { read: true }): Promise<FsFile> {
  const file = p(path);
  const flags = openFlags(file, options);
  const fd = await hostCall(
    file,
    () => new Promise<number>((res, rej) => nfs.open(file, flags, modeArg(options), (e, d) => (e === null ? res(d) : rej(e)))),
  );
  await cutIfAsked(fd, file, options);
  return new FsFile(fd, file, options.append === true);
}

/** The same, without waiting. */
export function openSync(path: PathLike, options: OpenOptions = { read: true }): FsFile {
  const file = p(path);
  const flags = openFlags(file, options);
  const fd = hostCallSync(file, () => nfs.openSync(file, flags, modeArg(options)));
  cutIfAskedSync(fd, file, options);
  return new FsFile(fd, file, options.append === true);
}

// FR-050: copy and walk.

/** Names in the byte order of their UTF-8, so that an order is the same on every platform and runtime. */
const byBytes = (a: string, b: string): number => Buffer.compare(Buffer.from(a), Buffer.from(b));

/** How to copy: replace what is at the destination (`overwrite`), keep the access and modification times (`preserveTimestamps`). */
export type CopyOptions = { readonly overwrite?: boolean; readonly preserveTimestamps?: boolean };

const lstatOr = async (path: string): Promise<nfs.Stats | undefined> => {
  try {
    return await hostCall(path, () => fsp.lstat(path));
  } catch (e) {
    if (e instanceof NotFound) return undefined;
    throw e;
  }
};

async function copyAny(from: string, to: string, s: nfs.Stats, o: CopyOptions): Promise<void> {
  const there = await lstatOr(to);
  if (there !== undefined && o.overwrite !== true) throw new AlreadyExists(`copy: ${to} already exists`, "EEXIST", to);
  if (s.isDirectory()) {
    if (there !== undefined && !there.isDirectory()) throw new NotADirectory(`copy: ${to} is not a folder, and ${from} is`, "ENOTDIR", to);
    if (there === undefined) await hostCall(to, () => fsp.mkdir(to));
    const names = (await hostCall(from, () => fsp.readdir(from))).sort(byBytes);
    for (const name of names) {
      const child = join(from, name);
      await copyAny(child, join(to, name), await hostCall(child, () => fsp.lstat(child)), o);
    }
  } else if (s.isSymbolicLink()) {
    if (there !== undefined) await hostCall(to, () => fsp.rm(to, { recursive: true }));
    const target = await hostCall(from, () => fsp.readlink(from));
    // Windows makes a link to a folder and to a file differently; elsewhere the type is ignored (FR-018).
    const pointsAtDir = await fsp.stat(from).then(
      (t) => t.isDirectory(),
      () => false,
    );
    await hostCall(to, () => fsp.symlink(target, to, pointsAtDir ? "dir" : "file"));
    if (o.preserveTimestamps === true) await hostCall(to, () => fsp.lutimes(to, s.atime, s.mtime));
    return;
  } else {
    if (there?.isSymbolicLink() === true) await hostCall(to, () => fsp.unlink(to));
    await hostCall(from, () => fsp.copyFile(from, to));
  }
  if (process.platform !== "win32") await hostCall(to, () => fsp.chmod(to, s.mode & 0o7777));
  if (o.preserveTimestamps === true) await hostCall(to, () => fsp.utimes(to, s.atime, s.mtime));
}

/**
 * A file, a link or a folder with everything in it copied, as `@std/fs`'s `copy` does: a link is copied as a link, modes are kept (not on
 * Windows, FR-018), and what is at the destination is `AlreadyExists` unless `overwrite`. A folder cannot be copied into itself.
 */
export async function copy(from: PathLike, to: PathLike, options: CopyOptions = {}): Promise<void> {
  const src = resolve(p(from));
  const dest = resolve(p(to));
  if (src === dest) throw new InvalidData(`copy: ${src} is both the source and the destination`, "EINVAL", src);
  const s = await hostCall(src, () => fsp.lstat(src));
  const rel = relative(src, dest);
  if (s.isDirectory() && rel !== "" && !rel.startsWith("..") && !isAbsolute(rel)) {
    throw new InvalidData(`copy: ${dest} is inside ${src}`, "EINVAL", dest);
  }
  await copyAny(src, dest, s, options);
}

/** One entry of a walk: what `readDir` gives, with its path (the root's joined with the names, by the platform's separator). */
export type WalkEntry = DirEntry & { readonly path: string };

/**
 * What a walk gives, as `@std/fs`'s `walk` takes it: how deep (`maxDepth`, the root being 0), which kinds (`includeFiles`, `includeDirs`,
 * `includeSymlinks`, all true by default), whether links are followed (`followSymlinks`, false) and then given by their real path
 * (`canonicalize`, true), and which paths: ending in one of `exts`, matching one of `match`, matching none of `skip`. The expressions are
 * tested against the path with `/` between its parts on every platform, so one expression serves Windows too.
 */
export type WalkOptions = {
  readonly maxDepth?: number;
  readonly includeFiles?: boolean;
  readonly includeDirs?: boolean;
  readonly includeSymlinks?: boolean;
  readonly followSymlinks?: boolean;
  readonly canonicalize?: boolean;
  readonly exts?: readonly string[];
  readonly match?: readonly RegExp[];
  readonly skip?: readonly RegExp[];
};

const slashed = (path: string): string => (sep === "/" ? path : path.split(sep).join("/"));

function included(
  path: string,
  exts: readonly string[] | undefined,
  match: readonly RegExp[] | undefined,
  skip: readonly RegExp[] | undefined,
): boolean {
  const s = slashed(path);
  if (exts !== undefined && !exts.some((e) => s.endsWith(e))) return false;
  if (match !== undefined && !match.some((r) => s.match(r) !== null)) return false;
  return !(skip !== undefined && skip.some((r) => s.match(r) !== null));
}

async function* walkIn(
  root: string,
  depth: number,
  o: WalkOptions,
  exts: readonly string[] | undefined,
  seen: ReadonlySet<string>,
): AsyncGenerator<WalkEntry> {
  const maxDepth = o.maxDepth ?? Number.POSITIVE_INFINITY;
  if (depth > maxDepth) return;
  if (o.includeDirs !== false && included(root, exts, o.match, o.skip)) {
    const s = await hostCall(root, () => fsp.stat(root));
    yield { path: root, name: basename(root), isFile: s.isFile(), isDirectory: s.isDirectory(), isSymlink: false };
  }
  if (depth >= maxDepth || !included(root, undefined, undefined, o.skip)) return;
  const entries = (await hostCall(root, () => fsp.readdir(root, { withFileTypes: true }))).sort((a, b) => byBytes(a.name, b.name));
  for (const d of entries) {
    let path = join(root, d.name);
    let isDirectory = d.isDirectory();
    let isFile = d.isFile();
    let inner = seen;
    if (d.isSymbolicLink()) {
      if (o.followSymlinks !== true) {
        if (o.includeSymlinks !== false && included(path, exts, o.match, o.skip)) yield { path, ...entry(d) };
        continue;
      }
      const real = await hostCall(path, () => fsp.realpath(path));
      // A link back to a folder the walk is inside of would never end; it is given, not entered.
      if (seen.has(real)) {
        if (o.includeSymlinks !== false && included(path, exts, o.match, o.skip)) yield { path, ...entry(d) };
        continue;
      }
      if (o.canonicalize !== false) path = real;
      const t = await hostCall(real, () => fsp.stat(real));
      isDirectory = t.isDirectory();
      isFile = t.isFile();
      if (isDirectory) inner = new Set([...seen, real]);
    } else if (isDirectory && o.followSymlinks === true) inner = new Set([...seen, await hostCall(path, () => fsp.realpath(path))]);
    if (isDirectory) yield* walkIn(path, depth + 1, o, exts, inner);
    else if (o.includeFiles !== false && included(path, exts, o.match, o.skip)) {
      yield { path, name: d.name, isFile, isDirectory, isSymlink: d.isSymbolicLink() };
    }
  }
}

/**
 * Every entry under a folder, as `@std/fs`'s `walk` gives them (see {@link WalkOptions}), depth first and in the byte order of the names at
 * each level, so a walk is the same every time; the root first, where folders are included; a file as the root is the walk's one entry.
 * `NotFound` where the root is not there.
 */
export async function* walk(root: PathLike, options: WalkOptions = {}): AsyncGenerator<WalkEntry> {
  const exts = options.exts?.map((e) => (e.startsWith(".") ? e : `.${e}`));
  const base = p(root);
  const s = await hostCall(base, () => fsp.stat(base));
  if (!s.isDirectory()) {
    // A file as the root is itself the walk.
    if (options.includeFiles !== false && included(base, exts, options.match, options.skip)) {
      yield { path: base, name: basename(base), isFile: s.isFile(), isDirectory: false, isSymlink: false };
    }
    return;
  }
  const seen = options.followSymlinks === true ? new Set([await hostCall(base, () => fsp.realpath(base))]) : new Set<string>();
  yield* walkIn(base, 0, options, exts, seen);
}

// FR-058: the entries a glob matches.

/**
 * How `expandGlob` reads its glob: the folder it is relative to (`root`, the working folder by default), globs whose matches (and all under
 * them) are left out (`exclude`), whether folders are given (`includeDirs`, true) and links followed (`followSymlinks`, false), and the
 * glob's own options (`extended`, `globstar`, `caseInsensitive`).
 */
export type ExpandGlobOptions = GlobOptions & {
  readonly root?: PathLike;
  readonly exclude?: readonly string[];
  readonly includeDirs?: boolean;
  readonly followSymlinks?: boolean;
};

const regExpOf = (glob: string, o: GlobOptions): RegExp => {
  const r = globToRegExp(glob, o);
  if (r.kind === "err") throw new InvalidData(formatGlobError(r.error), "EINVAL");
  return r.value;
};

/**
 * The entries a glob matches (`src/**\/*.ts`; see `../kernel/glob.ts`), as `@std/fs`'s `expandGlob` gives them, sorted in the byte order of
 * their paths so the result is the same every time. A glob is written with `/`, also on Windows, and may be absolute (`/srv/*.log`,
 * `C:/x/*`); a relative one is read from `root`. Entries are matched by their path relative to where the glob starts. A glob that begins
 * with `!` is refused as `InvalidData`; a folder that is not there has no entries.
 */
export async function* expandGlob(glob: string, options: ExpandGlobOptions = {}): AsyncGenerator<WalkEntry> {
  const g: GlobOptions = {
    ...(options.extended === undefined ? {} : { extended: options.extended }),
    ...(options.globstar === undefined ? {} : { globstar: options.globstar }),
    ...(options.caseInsensitive === undefined ? {} : { caseInsensitive: options.caseInsensitive }),
  };
  const absolute = isAbsolute(glob);
  const base = absolute ? parse(glob).root : resolve(p(options.root ?? process.cwd()));
  const pattern = absolute ? glob.slice(parse(glob).root.length) : glob;
  const re = regExpOf(pattern, g);
  const excluded = (options.exclude ?? []).map((x) => regExpOf(x, g));
  const start = resolve(base, globRoot(pattern));
  const rest = slashed(relative(base, start))
    .split("/")
    .filter((s) => s !== "").length;
  const segments = pattern.split("/").filter((s) => s !== "");
  const deep = segments.some((s) => s.includes("**")) || pattern.includes("{");
  const out: { readonly rel: string; readonly e: WalkEntry }[] = [];
  const walkOptions: WalkOptions = {
    includeDirs: options.includeDirs !== false,
    followSymlinks: options.followSymlinks === true,
    canonicalize: false,
    ...(deep ? {} : { maxDepth: Math.max(0, segments.length - rest) }),
  };
  try {
    for await (const e of walk(start, walkOptions)) {
      const rel = slashed(relative(base, e.path));
      if (rel === "" || !re.test(rel)) continue;
      const parts = rel.split("/");
      if (excluded.some((x) => parts.some((_, i) => x.test(parts.slice(0, i + 1).join("/"))))) continue;
      out.push({ rel, e });
    }
  } catch (e) {
    if (!(e instanceof NotFound)) throw e;
  }
  for (const x of out.sort((a, b) => byBytes(a.rel, b.rel))) yield x.e;
}
