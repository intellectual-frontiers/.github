/**
 * The `memory` driver: a store held in a map, for tests and for work that never touches a disk (commons 0010-file-aide FR-017). It keeps
 * every condition atomically, since nothing else reaches its map between a check and a write.
 *
 * @module
 */
import { err, ok, type Result } from "../../../kernel/mod.ts";
import type { RelPath } from "../algebra/names.ts";
import {
  type ByteRange,
  checkCondition,
  type Condition,
  type FileMeta,
  type ListRequest,
  type Page,
  pageOf,
  type Store,
  type StoreError,
  storeError,
} from "./store.ts";

/** What the memory driver can do. */
export type MemoryCapability = "write-if-absent" | "write-if-match" | "range" | "server-copy" | "delimiter" | "modified";

const CAPABILITIES: readonly MemoryCapability[] = ["write-if-absent", "write-if-match", "range", "server-copy", "delimiter", "modified"];

type Held = { readonly bytes: Uint8Array; readonly meta: FileMeta };

/**
 * A store in memory.
 *
 * @param options - its name, a clock, and files to begin with
 */
export function memoryStore(
  options: { readonly name?: string; readonly now?: () => Date; readonly files?: Iterable<readonly [RelPath, Uint8Array]> } = {},
): Store<MemoryCapability> {
  const name = options.name ?? "memory";
  const now = options.now ?? (() => new Date());
  const held = new Map<string, Held>();
  let written = 0;
  const notFound = (p: string): StoreError => storeError("not-found", name, p, "no file is there");
  const self = { name, capabilities: CAPABILITIES };

  const write = (path: RelPath, bytes: Uint8Array, condition: Condition): Result<FileMeta, StoreError> => {
    const allowed = checkCondition(self, path, condition);
    if (allowed.kind === "err") return allowed;
    const there = held.get(path);
    if (condition.kind === "if-absent" && there !== undefined) return err(storeError("conflict", name, path, "a file is already there"));
    if (condition.kind === "if-match" && there?.meta.version !== condition.version)
      return err(storeError("conflict", name, path, there === undefined ? "no file is there" : "the file is at another version"));
    written += 1;
    const meta: FileMeta = { path, size: bytes.length, modified: now(), version: `m${written}` };
    held.set(path, { bytes: bytes.slice(), meta });
    return ok(meta);
  };

  for (const [p, b] of options.files ?? []) write(p, b, { kind: "none" });

  return {
    ...self,
    head: (path) => {
      const h = held.get(path);
      return Promise.resolve(h === undefined ? err(notFound(path)) : ok(h.meta));
    },
    get: (path: RelPath, range?: ByteRange) => {
      const h = held.get(path);
      if (h === undefined) return Promise.resolve(err(notFound(path)));
      return Promise.resolve(ok(range === undefined ? h.bytes.slice() : h.bytes.slice(range.start, range.end)));
    },
    put: (path, bytes, condition = { kind: "none" }) => Promise.resolve(write(path, bytes, condition)),
    delete: (path) => {
      held.delete(path);
      return Promise.resolve(ok(undefined));
    },
    copy: (from, to, condition = { kind: "none" }) => {
      const h = held.get(from);
      return Promise.resolve(h === undefined ? err(notFound(from)) : write(to, h.bytes, condition));
    },
    list: (request?: ListRequest): Promise<Result<Page, StoreError>> =>
      Promise.resolve(
        ok(
          pageOf(
            [...held.values()].map((h) => h.meta),
            request,
          ),
        ),
      ),
  };
}
