// Spec: 0001-system FR-016
/**
 * Files and folders watched (commons 0005-typescript-runtime FR-051), on `node:fs`'s `watch` alone, so the same code runs on Bun and
 * Node, on Linux, macOS and Windows. `watchFs` gives an async iterable of events (`create`, `modify`, `remove`,
 * `rename` with both paths), stopped by `close`, an `AbortSignal`, `using` or leaving the loop.
 *
 * What the platforms report differs (which of `rename` and `change`, how many, a name or none), so the raw reports only say where to look:
 * they are joined over `debounceMs`, and then each path they name is compared with what the watcher last knew of it (kind, inode, size and
 * times). One save is therefore one event, whether an editor writes the file in place or writes a new one and renames it over it (`modify`),
 * a file created and removed within the window is no event, and a file moved within the watched tree is one `rename` where the platform
 * gives inodes. A change that leaves the size and every time as they were (possible only on a file system with coarse times) is not seen.
 *
 * A folder is watched recursively with `recursive`, by the platform's own recursive watch where it has one, and otherwise by one watch for
 * each folder, kept as folders come and go (FR-018); a folder made inside it is read at once, so files made in it before its watch began are
 * reported too. A file is watched through its folder, so a save that replaces it keeps being seen.
 *
 * @example
 * ```ts
 * import { watchFs } from "./watch.ts";
 * using watcher = watchFs("works", { recursive: true, debounceMs: 300 });
 * for await (const e of watcher) console.log(e.kind, e.paths);
 * ```
 *
 * @module
 */
import * as nfs from "node:fs";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { hostCallSync, mapError } from "./errors.ts";

/** What happened to a path: made, changed, removed, or moved from the first path to the second. */
export type FsEventKind = "create" | "modify" | "remove" | "rename";

/** One event, after the join: a path made, changed or removed, or one moved (`paths` is then `[from, to]`). Paths are absolute. */
export type FsEvent =
  | { readonly kind: "create" | "modify" | "remove"; readonly paths: readonly [string] }
  | { readonly kind: "rename"; readonly paths: readonly [from: string, to: string] };

/** How to watch: folders with everything under them (`recursive`), the window over which reports are joined (`debounceMs`, 100), and a signal that stops it. */
export type WatchOptions = { readonly recursive?: boolean; readonly debounceMs?: number; readonly signal?: AbortSignal };

type Snap = {
  readonly dir: boolean;
  readonly dev: number;
  readonly ino: number;
  readonly size: number;
  readonly mtimeMs: number;
  readonly ctimeMs: number;
};

type Target = { readonly path: string; readonly real: string; readonly dir: boolean; readonly recursive: boolean };

const under = (path: string, root: string): boolean => path.startsWith(root.endsWith(sep) ? root : `${root}${sep}`);

function snapOf(path: string): Snap | undefined {
  try {
    const s = nfs.lstatSync(path);
    return { dir: s.isDirectory(), dev: s.dev, ino: s.ino, size: s.size, mtimeMs: s.mtimeMs, ctimeMs: s.ctimeMs };
  } catch {
    return undefined;
  }
}

function namesIn(dir: string): string[] {
  try {
    return nfs.readdirSync(dir);
  } catch {
    return [];
  }
}

const changed = (a: Snap, b: Snap): boolean =>
  a.dir !== b.dir || a.ino !== b.ino || a.size !== b.size || a.mtimeMs !== b.mtimeMs || a.ctimeMs !== b.ctimeMs;

const byPath = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * A running watch: an async iterable of {@link FsEvent}s, ended by `close`, the signal, `using`, `await using` or leaving a `for await`
 * loop. A watch that fails (other than by its folder being removed) throws from the loop as an error of `./errors.ts`. Made by {@link watchFs}.
 */
export class FsWatcher implements AsyncIterableIterator<FsEvent>, Disposable, AsyncDisposable {
  readonly #targets: readonly Target[];
  readonly #debounceMs: number;
  readonly #signal: AbortSignal | undefined;
  readonly #known = new Map<string, Snap>();
  readonly #pending = new Set<string>();
  readonly #dirty = new Set<string>();
  readonly #handles = new Map<string, nfs.FSWatcher>();
  readonly #perFolder = new Set<string>();
  readonly #queue: FsEvent[] = [];
  readonly #waiting: { readonly resolve: (r: IteratorResult<FsEvent>) => void; readonly reject: (e: Error) => void }[] = [];
  #error: Error | undefined;
  #closed = false;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #firstAt = 0;
  readonly #onAbort = (): void => this.close();

  /** A watch of the paths; use {@link watchFs}. */
  constructor(paths: readonly string[], options: WatchOptions) {
    this.#debounceMs = Math.max(0, options.debounceMs ?? 100);
    this.#signal = options.signal;
    this.#targets = paths.map((path) => {
      const s = hostCallSync(path, () => nfs.statSync(path));
      return { path, real: hostCallSync(path, () => nfs.realpathSync(path)), dir: s.isDirectory(), recursive: options.recursive === true };
    });
    for (const t of this.#targets) this.#scan(t.path, t.dir ? (t.recursive ? "all" : "children") : "self");
    try {
      for (const t of this.#targets) this.#start(t);
    } catch (e) {
      this.close();
      throw mapError(e);
    }
    if (this.#signal?.aborted === true) this.close();
    else this.#signal?.addEventListener("abort", this.#onAbort, { once: true });
  }

  #start(t: Target): void {
    if (!t.dir) return this.#listen(dirname(t.path), false);
    if (!t.recursive) return this.#listen(t.path, false);
    try {
      this.#listen(t.path, true);
    } catch {
      // No recursive watch on this platform and runtime (FR-018): one watch for each folder, kept up to date in #flush.
      this.#perFolder.add(t.path);
      for (const [path, s] of this.#known) if (s.dir && (path === t.path || under(path, t.path))) this.#listen(path, false);
    }
  }

  #listen(dir: string, recursive: boolean): void {
    if (this.#handles.has(dir)) return;
    const w = nfs.watch(dir, { recursive, persistent: true }, (_type, name) => this.#raw(dir, name));
    w.on("error", (e: unknown) => this.#failed(dir, e));
    this.#handles.set(dir, w);
  }

  #unlisten(dir: string): void {
    this.#handles.get(dir)?.close();
    this.#handles.delete(dir);
  }

  #failed(dir: string, e: unknown): void {
    this.#unlisten(dir);
    if (snapOf(dir) === undefined) {
      // The folder was removed (Windows reports it as an error): what was in it is removed, and the watch of it is over.
      this.#dirty.add(dir);
      this.#schedule();
      return;
    }
    this.#error = mapError(e, dir);
    for (const w of this.#waiting.splice(0)) w.reject(this.#error);
    this.close();
  }

  /** A raw report: a name in a watched folder, or none (the folder is then read again). */
  #raw(dir: string, name: string | null): void {
    if (this.#closed) return;
    if (name === null || name === "") this.#dirty.add(dir);
    else if (isAbsolute(name)) this.#pending.add(this.#unreal(name));
    else this.#pending.add(join(dir, name));
    this.#schedule();
  }

  /** A path a platform gave absolute, by its real path (`/private/var` for `/var` on macOS), put back under the target's path. */
  #unreal(path: string): string {
    for (const t of this.#targets) {
      if (path === t.real) return t.path;
      if (under(path, t.real)) return join(t.path, path.slice(t.real.length));
    }
    return path;
  }

  #schedule(): void {
    const now = Date.now();
    if (this.#timer === undefined) this.#firstAt = now;
    else clearTimeout(this.#timer);
    // Reports that never stop are still flushed, at least once in ten windows (and once a second).
    const late = now - this.#firstAt >= Math.max(1000, 10 * this.#debounceMs);
    this.#timer = setTimeout(() => this.#flush(), late ? 0 : this.#debounceMs);
  }

  #inScope(path: string): boolean {
    return this.#targets.some((t) =>
      !t.dir ? path === t.path : path === t.path || (t.recursive ? under(path, t.path) : dirname(path) === t.path),
    );
  }

  #deep(path: string): boolean {
    return this.#targets.some((t) => t.dir && t.recursive && (path === t.path || under(path, t.path)));
  }

  /** What is at `path` now, recorded as known: the path itself, its children, or everything under it. */
  #scan(path: string, how: "self" | "children" | "all"): void {
    const s = snapOf(path);
    if (s === undefined) return;
    this.#known.set(path, s);
    if (!s.dir || how === "self") return;
    for (const name of namesIn(path)) {
      const child = join(path, name);
      if (how === "all") this.#scan(child, "all");
      else {
        const c = snapOf(child);
        if (c !== undefined) this.#known.set(child, c);
      }
    }
  }

  /** Every path under `dir` as it is now. */
  #present(dir: string, into: Set<string>): void {
    for (const name of namesIn(dir)) {
      const child = join(dir, name);
      into.add(child);
      if (snapOf(child)?.dir === true) this.#present(child, into);
    }
  }

  #flush(): void {
    this.#timer = undefined;
    if (this.#closed) return;
    const look = new Set(this.#pending);
    this.#pending.clear();
    for (const dir of this.#dirty) {
      look.add(dir);
      for (const k of this.#known.keys()) if (dirname(k) === dir) look.add(k);
      for (const name of namesIn(dir)) look.add(join(dir, name));
    }
    this.#dirty.clear();
    // A folder removed takes what was in it; a folder made (or moved in) brings what is in it now.
    for (const path of [...look]) {
      const before = this.#known.get(path);
      const now = snapOf(path);
      if (before?.dir === true && now?.dir !== true) for (const k of this.#known.keys()) if (under(k, path)) look.add(k);
      if (now?.dir === true && before?.dir !== true && this.#deep(path)) this.#present(path, look);
    }
    const created: string[] = [];
    const removed: { readonly path: string; readonly snap: Snap }[] = [];
    const events: FsEvent[] = [];
    for (const path of [...look].filter((x) => this.#inScope(x)).sort(byPath)) {
      const before = this.#known.get(path);
      const now = snapOf(path);
      if (before === undefined && now === undefined) continue;
      if (now === undefined) {
        if (before !== undefined) removed.push({ path, snap: before });
        this.#known.delete(path);
      } else {
        this.#known.set(path, now);
        if (before === undefined) created.push(path);
        else if (changed(before, now) && !(before.dir && now.dir)) events.push({ kind: "modify", paths: [path] });
      }
    }
    // A path removed and one made with the same inode, in the same window, is a move; what was under a moved folder moved with it.
    const moved = new Set<string>();
    for (const r of removed) {
      if (r.snap.ino === 0 || [...moved].some((m) => under(r.path, m))) continue;
      const to = created.find((c) => !moved.has(c) && this.#known.get(c)?.ino === r.snap.ino && this.#known.get(c)?.dev === r.snap.dev);
      if (to === undefined) continue;
      moved.add(r.path).add(to);
      events.push({ kind: "rename", paths: [r.path, to] });
    }
    const inMoved = (path: string): boolean => [...moved].some((m) => path === m || under(path, m));
    for (const r of removed) if (!inMoved(r.path)) events.push({ kind: "remove", paths: [r.path] });
    for (const c of created) if (!inMoved(c)) events.push({ kind: "create", paths: [c] });
    // Per-folder watches follow the folders.
    if (this.#perFolder.size > 0) {
      for (const r of removed) if (this.#handles.has(r.path)) this.#unlisten(r.path);
      for (const c of created) {
        if (this.#known.get(c)?.dir === true && [...this.#perFolder].some((root) => under(c, root))) {
          try {
            this.#listen(c, false);
          } catch {
            // The folder went again before its watch began; the next report of its parent says so.
          }
        }
      }
    }
    const first = (e: FsEvent): string => (e.kind === "rename" ? e.paths[1] : e.paths[0]);
    events.sort((a, b) => byPath(first(a), first(b)));
    for (const e of events) {
      const w = this.#waiting.shift();
      if (w === undefined) this.#queue.push(e);
      else w.resolve({ value: e, done: false });
    }
  }

  /** The next event, waiting for one; done once the watch is closed. */
  next(): Promise<IteratorResult<FsEvent>> {
    const e = this.#queue.shift();
    if (e !== undefined) return Promise.resolve({ value: e, done: false });
    if (this.#error !== undefined) return Promise.reject(this.#error);
    if (this.#closed) return Promise.resolve({ value: undefined, done: true });
    return new Promise((resolve, reject) => this.#waiting.push({ resolve, reject }));
  }

  /** The watch closed, as leaving a `for await` loop does. */
  return(): Promise<IteratorResult<FsEvent>> {
    this.close();
    return Promise.resolve({ value: undefined, done: true });
  }

  /** The watch itself, to iterate. */
  [Symbol.asyncIterator](): FsWatcher {
    return this;
  }

  /** The watch stopped: no more events; a loop over it ends. Closing it again does nothing. */
  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#signal?.removeEventListener("abort", this.#onAbort);
    for (const dir of [...this.#handles.keys()]) this.#unlisten(dir);
    this.#queue.length = 0;
    for (const w of this.#waiting.splice(0)) w.resolve({ value: undefined, done: true });
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

/**
 * Files and folders watched, (see the module's documentation): each path a file, or a folder whose entries
 * (with `recursive`, everything under it) are watched. `NotFound` where a path is not there.
 */
export function watchFs(paths: string | URL | readonly (string | URL)[], options: WatchOptions = {}): FsWatcher {
  const list = typeof paths === "string" || paths instanceof URL ? [paths] : paths;
  return new FsWatcher(
    list.map((x) => resolve(typeof x === "string" ? x : fileURLToPath(x))),
    options,
  );
}
