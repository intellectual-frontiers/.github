// Spec: 0005-anyfs-posix-conformance FR-003
/**
 * The reference model the suite holds a view to: a tree of files in memory that follows the rules of a file system as this library states them (a directory is where a file lies below it, an empty directory
 * is kept only by a marker, a file is renamed over a file and never over a directory, a directory is moved whole, an append and a truncate need compare-and-write). The model has no store and no
 * plan: it answers with a value or a code, so that a view over any store that gives a different answer is found, with the seed and the step.
 *
 * @example
 * ```ts
 * import { PosixModel } from "./model.ts";
 * const m = new PosixModel({ cas: true, keep: false });
 * m.writeFile("/a/b.txt", new Uint8Array([1])); // { ok: true, value: undefined }
 * m.readdir("/a"); // { ok: true, value: [{ name: "b.txt", type: "file", size: 1 }] }
 * ```
 *
 * @module
 */
import type { Errno } from "@intellectual-frontiers/anyfs-posix/governance";

/** What the model answers with: a value, or a code. */
export type Answer<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly errno: Errno };

const yes = <T>(value: T): Answer<T> => ({ ok: true, value });
const no = (errno: Errno): Answer<never> => ({ ok: false, errno });

/** What a model of a store is told: whether it compares revisions, and whether it keeps empty directories. */
export type ModelOptions = { readonly cas: boolean; readonly keep: boolean };

/** One name of a directory in the model. */
export type ModelEntry = { readonly name: string; readonly type: "file" | "dir"; readonly size?: number };

const segments = (p: string): readonly string[] => (p === "/" ? [] : p.slice(1).split("/"));
const parentsOf = (p: string): readonly string[] => segments(p).slice(0, -1).map((_, i, all) => `/${all.slice(0, i + 1).join("/")}`);
const below = (dir: string, p: string): boolean => (dir === "/" ? p !== "/" : p.startsWith(`${dir}/`));
const byName = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The model. */
export class PosixModel {
  readonly #options: ModelOptions;
  readonly #files = new Map<string, Uint8Array>();
  readonly #dirs = new Set<string>();

  constructor(options: ModelOptions) {
    this.#options = options;
  }

  #kind(p: string): "file" | "dir" | "none" {
    if (p === "/") return "dir";
    if (this.#files.has(p)) return "file";
    for (const f of this.#files.keys()) if (below(p, f)) return "dir";
    for (const d of this.#dirs) if (d === p || below(p, d)) return "dir";
    return "none";
  }

  #ancestorIsFile(p: string): boolean {
    return parentsOf(p).some((a) => this.#files.has(a));
  }

  /** The kind of a name: for a comparison of the whole tree. */
  kindOf(p: string): "file" | "dir" | "none" {
    return this.#kind(p);
  }

  stat(p: string): Answer<{ readonly type: "file" | "dir"; readonly size: number }> {
    const k = this.#kind(p);
    if (k === "none") return no("ENOENT");
    return yes({ type: k, size: k === "file" ? (this.#files.get(p)?.length ?? 0) : 0 });
  }

  readdir(p: string): Answer<readonly ModelEntry[]> {
    const k = this.#kind(p);
    if (k === "file") return no("ENOTDIR");
    if (k === "none") return no("ENOENT");
    const slots = new Map<string, ModelEntry>();
    for (const [f, data] of this.#files) {
      if (!below(p, f)) continue;
      const rel = p === "/" ? f.slice(1) : f.slice(p.length + 1);
      const slash = rel.indexOf("/");
      if (slash < 0) slots.set(rel, { name: rel, type: "file", size: data.length });
      else if (!slots.has(rel.slice(0, slash))) slots.set(rel.slice(0, slash), { name: rel.slice(0, slash), type: "dir" });
    }
    for (const d of this.#dirs) {
      if (!below(p, d)) continue;
      const rel = p === "/" ? d.slice(1) : d.slice(p.length + 1);
      const name = rel.split("/")[0] ?? rel;
      if (!slots.has(name)) slots.set(name, { name, type: "dir" });
    }
    return yes([...slots.values()].sort((a, b) => byName(a.name, b.name)));
  }

  readFile(p: string): Answer<Uint8Array> {
    const k = this.#kind(p);
    if (k === "dir") return no("EISDIR");
    const data = this.#files.get(p);
    return k === "none" || data === undefined ? no("ENOENT") : yes(data.slice());
  }

  writeFile(p: string, data: Uint8Array, exclusive = false): Answer<undefined> {
    const k = this.#kind(p);
    if (k === "dir") return no("EISDIR");
    if (k === "file") {
      if (exclusive) return no("EEXIST");
    } else if (this.#ancestorIsFile(p)) return no("ENOTDIR");
    this.#files.set(p, data.slice());
    return yes(undefined);
  }

  touch(p: string): Answer<undefined> {
    const k = this.#kind(p);
    if (k === "dir") return no("EISDIR");
    if (k === "file") return yes(undefined);
    if (this.#ancestorIsFile(p)) return no("ENOTDIR");
    this.#files.set(p, new Uint8Array());
    return yes(undefined);
  }

  mkdir(p: string, parents = false): Answer<undefined> {
    if (p === "/") return no("EEXIST");
    const k = this.#kind(p);
    if (k === "file") return no("EEXIST");
    if (k === "dir") return parents ? yes(undefined) : no("EEXIST");
    if (this.#ancestorIsFile(p)) return no("ENOTDIR");
    if (!this.#options.keep) return yes(undefined);
    const ps = parentsOf(p);
    const parent = ps.at(-1);
    if (!parents && parent !== undefined && this.#kind(parent) !== "dir") return no("ENOENT");
    this.#dirs.add(p);
    return yes(undefined);
  }

  rmdir(p: string): Answer<undefined> {
    if (p === "/") return no("EINVAL");
    const k = this.#kind(p);
    if (k === "file") return no("ENOTDIR");
    if (k === "none") return no("ENOENT");
    for (const f of this.#files.keys()) if (below(p, f)) return no("ENOTEMPTY");
    for (const d of this.#dirs) if (below(p, d)) return no("ENOTEMPTY");
    if (!this.#dirs.delete(p)) return no("ENOENT");
    return yes(undefined);
  }

  unlink(p: string): Answer<undefined> {
    const k = this.#kind(p);
    if (k === "dir") return no("EISDIR");
    if (k === "none") return no("ENOENT");
    this.#files.delete(p);
    return yes(undefined);
  }

  rename(from: string, to: string): Answer<undefined> {
    if (from === "/") return no("EINVAL");
    const sk = this.#kind(from);
    if (sk === "none") return no("ENOENT");
    if (from === to) return yes(undefined);
    if (sk === "dir" && below(from, to)) return no("EINVAL");
    if (to === "/") return no(sk === "file" ? "EISDIR" : "EEXIST");
    const dk = this.#kind(to);
    if (sk === "file") {
      if (dk === "dir") return no("EISDIR");
      if (dk === "none" && this.#ancestorIsFile(to)) return no("ENOTDIR");
      const data = this.#files.get(from) ?? new Uint8Array();
      this.#files.delete(from);
      this.#files.set(to, data);
      return yes(undefined);
    }
    if (dk === "file") return no("ENOTDIR");
    if (dk === "dir") return no("EEXIST");
    if (this.#ancestorIsFile(to)) return no("ENOTDIR");
    for (const [f, data] of [...this.#files]) {
      if (!below(from, f)) continue;
      this.#files.delete(f);
      this.#files.set(`${to}${f.slice(from.length)}`, data);
    }
    for (const d of [...this.#dirs]) {
      if (d !== from && !below(from, d)) continue;
      this.#dirs.delete(d);
      this.#dirs.add(`${to}${d.slice(from.length)}`);
    }
    return yes(undefined);
  }

  truncate(p: string, length: number): Answer<undefined> {
    if (!this.#options.cas) return no("ENOTSUP");
    const k = this.#kind(p);
    if (k === "dir") return no("EISDIR");
    const data = this.#files.get(p);
    if (k === "none" || data === undefined) return no("ENOENT");
    const out = new Uint8Array(length);
    out.set(data.subarray(0, Math.min(length, data.length)));
    this.#files.set(p, out);
    return yes(undefined);
  }

  appendFile(p: string, more: Uint8Array): Answer<undefined> {
    if (!this.#options.cas) return no("ENOTSUP");
    const k = this.#kind(p);
    if (k === "dir") return no("EISDIR");
    const data = this.#files.get(p);
    if (k === "none" || data === undefined) {
      if (this.#ancestorIsFile(p)) return no("ENOTDIR");
      this.#files.set(p, more.slice());
      return yes(undefined);
    }
    const out = new Uint8Array(data.length + more.length);
    out.set(data);
    out.set(more, data.length);
    this.#files.set(p, out);
    return yes(undefined);
  }

  removeAll(p: string): Answer<number> {
    if (p === "/") return no("EINVAL");
    const k = this.#kind(p);
    if (k === "none") return no("ENOENT");
    let count = 0;
    for (const f of [...this.#files.keys()]) {
      if (f === p || below(p, f)) {
        this.#files.delete(f);
        count++;
      }
    }
    for (const d of [...this.#dirs]) {
      if (d === p || below(p, d)) {
        this.#dirs.delete(d);
        count++;
      }
    }
    return yes(count);
  }
}
