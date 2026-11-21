/**
 * The file system (commons lang-sql 0011-acceptance FR-003): an interface of a walk of entries, the real one over a directory (sorted, never following a link, reporting what it cannot read, with a limit of depth), and one over a list in
 * memory, so that a query has the same rows over a disk and over a table.
 *
 * Spec: 0011-acceptance FR-003
 *
 * @module
 */
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Entry, entryOf } from "./language.ts";

/** What a walk may be asked. */
export interface WalkOptions {
  /** Whether to go into a directory; a walk never skips an entry for it, only what is below one. */
  readonly descend?: (dir: Entry) => boolean;
  /** The deepest level to read (1 is the root's entries). */
  readonly maxDepth?: number;
  /** Told what could not be read. */
  readonly warn?: (message: string) => void;
}

/** A file system: its entries, parents before their children. */
export interface FileSystem {
  walk(options?: WalkOptions): AsyncIterable<Entry>;
}

let owners: Map<number, string> | undefined;

/** The name of a user by number, as the system says it, or the number. */
export function ownerName(uid: number): string {
  if (owners === undefined) {
    owners = new Map();
    try {
      for (const line of readFileSync("/etc/passwd", "utf8").split("\n")) {
        const f = line.split(":");
        if (f.length > 2 && f[0] !== undefined && f[2] !== undefined && !owners.has(Number(f[2]))) owners.set(Number(f[2]), f[0]);
      }
    } catch {
      // no table of users: the number is the name
    }
  }
  return owners.get(uid) ?? String(uid);
}

/** The entry of a path under a root, from `lstat`; `undefined` where it cannot be read. */
export function statEntry(root: string, rel: string): Entry | undefined {
  try {
    const st = lstatSync(join(root, rel));
    const kind = st.isSymbolicLink() ? "l" : st.isDirectory() ? "d" : st.isFile() ? "f" : "o";
    return entryOf(rel, kind, st.size, Math.floor(st.mtimeMs / 1000), st.mode & 0o7777, ownerName(st.uid));
  } catch {
    return undefined;
  }
}

/** Whether the system has a user of this name. */
export function knownOwner(name: string): boolean {
  ownerName(-1);
  return [...(owners ?? new Map<number, string>()).values()].includes(name);
}

/** The entries under a directory of the disk, sorted by name, links not followed. */
export function diskFs(root: string): FileSystem {
  return {
    async *walk(options = {}) {
      const maxDepth = options.maxDepth ?? 64;
      function* level(dir: string, rel: string, depth: number): Generator<Entry> {
        let names: string[];
        try {
          names = readdirSync(dir).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        } catch (e) {
          options.warn?.(`cannot read ${rel === "" ? "." : rel}: ${e instanceof Error ? e.message : "error"}`);
          return;
        }
        for (const n of names) {
          const full = join(dir, n);
          const path = rel === "" ? n : `${rel}/${n}`;
          let st;
          try {
            st = lstatSync(full);
          } catch (e) {
            options.warn?.(`cannot read ${path}: ${e instanceof Error ? e.message : "error"}`);
            continue;
          }
          const kind = st.isSymbolicLink() ? "l" : st.isDirectory() ? "d" : st.isFile() ? "f" : "o";
          const entry = entryOf(path, kind, st.size, Math.floor(st.mtimeMs / 1000), st.mode & 0o7777, ownerName(st.uid));
          yield entry;
          if (kind === "d" && depth < maxDepth && (options.descend === undefined || options.descend(entry))) yield* level(full, path, depth + 1);
        }
      }
      yield* level(root, "", 1);
    },
  };
}

/** A list of entries as a file system: they are given as they are, parents before children, and what `descend` refuses hides what is below. */
export function memoryFs(entries: readonly Entry[]): FileSystem {
  return {
    async *walk(options = {}) {
      const hidden: string[] = [];
      const maxDepth = options.maxDepth ?? 64;
      for (const e of entries) {
        if (e.depth > maxDepth || hidden.some((h) => e.path.startsWith(`${h}/`))) continue;
        yield e;
        if (e.kind === "d" && options.descend !== undefined && !options.descend(e)) hidden.push(e.path);
      }
    },
  };
}
