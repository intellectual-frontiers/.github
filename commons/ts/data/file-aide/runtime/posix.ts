/**
 * The `posix` driver: a folder of the computer as a store, reached through IFC TypeScript's runtime (commons 0010-file-aide FR-017). A
 * file is written to a temporary file in its own folder and then renamed into place, or linked into place where nothing may be there, so
 * that no reader sees part of a file; no folder is written for its own sake, and a delete removes the folders it leaves empty, up to the
 * root. A networked file system mounted on the computer is reached the same way.
 *
 * @limits
 * The `posix` driver reads a whole folder to give one page of a listing, and a whole file to give a range; it skips symbolic links, and
 * does not claim a write on a version, which it cannot make atomic. A name on disk that is not in normalization form C is listed in form C
 * and is then reached only where the file system treats the two forms as one (as APFS does).
 *
 * @module
 */
import { err, ok, type Result } from "../../../kernel/mod.ts";
import { errors, fs, path as host } from "../../../runtime/mod.ts";
import { type RelPath, relPath } from "../algebra/names.ts";
import {
  type ByteRange,
  checkCondition,
  type Condition,
  type FileMeta,
  type ListItem,
  type ListRequest,
  type Page,
  pageOfItems,
  type Store,
  type StoreError,
  storeError,
} from "../store/store.ts";

/** What the posix driver can do: it cannot write on a version atomically, so it does not claim to (FR-016). */
export type PosixCapability = "write-if-absent" | "range" | "rename" | "delimiter" | "modified";

const CAPABILITIES: readonly PosixCapability[] = ["write-if-absent", "range", "rename", "delimiter", "modified"];

/** The beginning of the name of a file being written, which a listing never shows. */
export const TEMPORARY = ".fa-tmp-";

/**
 * A folder of the computer as a store.
 *
 * @param root - the folder
 * @param options - its name, and whether it refuses every write
 */
export function posixStore(root: string, options: { readonly name?: string; readonly readOnly?: boolean } = {}): Store<PosixCapability> {
  const name = options.name ?? `posix:${root}`;
  const self = { name, capabilities: CAPABILITIES };
  const at = (p: string): string => host.join(root, ...p.split("/").filter((n) => n !== ""));
  const failed = (p: string, thrown: unknown): StoreError => {
    const why = thrown instanceof Error ? thrown.message : String(thrown);
    if (thrown instanceof errors.NotFound) return storeError("not-found", name, p, "no file is there");
    if (thrown instanceof errors.AlreadyExists) return storeError("conflict", name, p, "a file is already there");
    if (thrown instanceof errors.PermissionDenied) return storeError("refused", name, p, why);
    if (thrown instanceof errors.IsADirectory || thrown instanceof errors.NotADirectory) return storeError("invalid", name, p, why);
    return storeError("unavailable", name, p, why);
  };
  const attempt = async <T>(p: string, f: () => Promise<T>): Promise<Result<T, StoreError>> => {
    try {
      return ok(await f());
    } catch (thrown) {
      return err(failed(p, thrown));
    }
  };
  const metaOf = async (p: RelPath): Promise<FileMeta> => {
    const info = await fs.stat(at(p));
    if (!info.isFile) throw new errors.NotFound(`${p} is not a file`, "ENOENT", p);
    return { path: p, size: info.size, modified: info.mtime, version: `${info.ino ?? 0}-${info.mtime?.getTime() ?? 0}-${info.size}` };
  };
  const readOnly = (p: string): Result<never, StoreError> => err(storeError("refused", name, p, "the store is read only"));

  const write = async (p: RelPath, bytes: Uint8Array, condition: Condition): Promise<Result<FileMeta, StoreError>> => {
    if (options.readOnly === true) return readOnly(p);
    const allowed = checkCondition(self, p, condition);
    if (allowed.kind === "err") return allowed;
    const target = at(p);
    const dir = host.dirname(target);
    const temp = host.join(dir, `${TEMPORARY}${crypto.randomUUID()}`);
    return attempt(p, async () => {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(temp, bytes, { createNew: true });
      try {
        if (condition.kind === "if-absent") await fs.link(temp, target);
        else await fs.rename(temp, target);
      } finally {
        await fs.remove(temp).catch(() => undefined);
      }
      return metaOf(p);
    });
  };

  /** The files below a folder of the store, at every depth, or only directly in it with its folders that hold a file. */
  const walk = async (dir: string, deep: boolean, items: ListItem[]): Promise<void> => {
    let entries: readonly fs.DirEntry[];
    try {
      const found: fs.DirEntry[] = [];
      for await (const e of fs.readDir(at(dir))) found.push(e);
      entries = found;
    } catch (thrown) {
      if (thrown instanceof errors.NotFound || thrown instanceof errors.NotADirectory) return;
      throw thrown;
    }
    for (const e of entries) {
      if (e.isSymlink || e.name.startsWith(TEMPORARY)) continue;
      const r = relPath(dir === "" ? e.name : `${dir}/${e.name}`);
      if (r.kind === "err") continue;
      if (e.isDirectory) {
        if (deep) await walk(r.value, true, items);
        else if (await holdsFile(r.value)) items.push({ kind: "folder", prefix: `${r.value}/` });
      } else if (e.isFile) items.push({ kind: "file", meta: await metaOf(r.value) });
    }
  };
  const holdsFile = async (dir: string): Promise<boolean> => {
    for await (const e of fs.readDir(at(dir))) {
      if (e.isSymlink || e.name.startsWith(TEMPORARY)) continue;
      if (e.isFile) return true;
      if (e.isDirectory && (await holdsFile(`${dir}/${e.name}`))) return true;
    }
    return false;
  };

  return {
    ...self,
    head: (p) => attempt(p, () => metaOf(p)),
    get: (p: RelPath, range?: ByteRange) =>
      attempt(p, async () => {
        const bytes = await fs.readFile(at(p));
        return range === undefined ? bytes : bytes.slice(range.start, range.end);
      }),
    put: (p, bytes, condition = { kind: "none" }) => write(p, bytes, condition),
    delete: async (p) => {
      if (options.readOnly === true) return readOnly(p);
      const removed = await attempt(p, () => fs.remove(at(p)));
      if (removed.kind === "err" && removed.error.kind !== "not-found") return removed;
      const names = p.split("/").slice(0, -1);
      while (names.length > 0) {
        const gone = await fs.remove(at(names.join("/"))).then(
          () => true,
          () => false,
        );
        if (!gone) break;
        names.pop();
      }
      return ok(undefined);
    },
    copy: async (from, to, condition = { kind: "none" }) => {
      const bytes = await attempt(from, () => fs.readFile(at(from)));
      return bytes.kind === "err" ? bytes : write(to, bytes.value, condition);
    },
    list: (request: ListRequest = {}): Promise<Result<Page, StoreError>> => {
      const prefix = request.prefix ?? "";
      const cut = prefix.lastIndexOf("/");
      const dir = cut < 0 ? "" : prefix.slice(0, cut);
      return attempt(prefix, async () => {
        const items: ListItem[] = [];
        await walk(dir, request.delimiter !== "/", items);
        const under = items.filter((i) => (i.kind === "file" ? i.meta.path : i.prefix).startsWith(prefix));
        return pageOfItems(under, request);
      });
    },
  };
}
