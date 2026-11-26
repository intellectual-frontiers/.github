// Spec: 0006-anyfs-documents FR-007, FR-008, FR-009, FR-010, FR-011
/**
 * A collection: a typed set of documents under a prefix of a store, whose keys have paths by a layout written as code and whose bytes are made by a codec. Every document comes with the revision it was read
 * at, and every write states what it expects, as the store does. What a collection may do is in its type: a collection of a store that cannot `write` has no `put`, and `update`, the read-modify-write that
 * retries where another writer got there first, needs a store with `cas`. A listing reads the objects lazily, and an object that is not a good document is a finding beside the others.
 *
 * @remarks
 * The one cast of the module is in `collection`: it builds the object with every method and gives it the type its capabilities say, as `makeStore` does for a store. The methods that need a capability the
 * store does not have refuse at run time through the store, and `update` refuses before it reads.
 *
 * @example
 * ```ts
 * import { collection, jsonTree, byId, parseExtension, defineSchema } from "@intellectual-frontiers/anyfs/docs";
 * // const docs = collection(store, { prefix, layout: byId(ext), codec: versioned(jsonTree, schema) });
 * // const doc = await docs.get(key);          // ok { value, rev }
 * // await docs.update(key, (d) => ({ kind: "put", value: next(d?.value) }));
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import {
  type Capability,
  type Cursor,
  type Expect,
  type ExpectFor,
  expectAbsent,
  expectRev,
  type Path,
  type Prefix,
  type Problem,
  type Revision,
  below,
  relativeTo,
} from "@intellectual-frontiers/anyfs/governance";
import type { Done, Handler, Store } from "@intellectual-frontiers/anyfs/logical";
import type { Codec } from "./codec.ts";
import type { Layout } from "./layout.ts";
import { type DocProblem, type Finding, storeProblem } from "./problem.ts";

/** A document with the key it is kept under, the path, the revision it was read at and whether it was written at an older version than the current. */
export type Doc<T, K> = { readonly key: K; readonly path: Path; readonly value: T; readonly rev: Revision; readonly modified?: string };
/** What a put made. */
export type Saved<K> = { readonly key: K; readonly path: Path; readonly rev: Revision; readonly created: boolean };
/** One page of a listing: the good documents and the findings in the order of the paths, and where the next page begins where there is one. */
export type Page<T, K> = { readonly docs: readonly Doc<T, K>[]; readonly findings: readonly Finding[]; readonly next?: Cursor };
/** One item of a scan. */
export type Item<T, K> = { readonly kind: "doc"; readonly doc: Doc<T, K> } | { readonly kind: "finding"; readonly finding: Finding };

/** What an update does with the document it is given: write a value, remove it (only where the store can delete), or leave it. */
export type Update<T, C extends Capability = Capability> = { readonly kind: "put"; readonly value: T } | { readonly kind: "keep" } | ("delete" extends C ? { readonly kind: "delete" } : never);
/** What an update ended with, and in how many attempts. */
export type Updated<T, K> =
  | { readonly kind: "put"; readonly doc: Doc<T, K>; readonly created: boolean; readonly attempts: number }
  | { readonly kind: "deleted"; readonly attempts: number }
  | { readonly kind: "kept"; readonly doc?: Doc<T, K>; readonly attempts: number };
/** What a collection is made from. */
export type CollectionConfig<T, K> = {
  /** Where the documents are in the store. */
  readonly prefix: Prefix;
  readonly layout: Layout<K>;
  readonly codec: Codec<T>;
  /** The attempts of an update where another writer changed the document first; 5 where not given. */
  readonly attempts?: number;
  /** How many documents a page lists and reads; 100 where not given. */
  readonly pageSize?: number;
  /** How many documents are read at once in a page; 8 where not given. */
  readonly readers?: number;
  /** What an update waits for between attempts, given the attempt that failed: it does not wait where not given. */
  readonly pause?: (attempt: number) => Promise<void>;
};

type Gate<C extends Capability, Needs extends Capability, M> = [Needs] extends [C] ? M : unknown;

/** What every collection has. */
export type CollectionBase<K> = {
  /** The path of a key, or why it has none. */
  pathOf(key: K): Result<Path, DocProblem>;
};

/** A collection of the capabilities `C` of its store: it has the methods that `C` can do, and no other. */
export type Collection<T, K, C extends Capability> = CollectionBase<K> &
  Gate<C, "read", { get(key: K): Promise<Result<Doc<T, K>, DocProblem>> }> &
  Gate<C, "write", { put(key: K, value: T, expect: ExpectFor<C>): Promise<Result<Saved<K>, DocProblem>> }> &
  Gate<C, "delete", { delete(key: K, expect: ExpectFor<C>): Promise<Result<{ readonly existed: boolean }, DocProblem>> }> &
  Gate<
    C,
    "list" | "read",
    {
      list(options?: { readonly after?: Cursor }): Promise<Result<Page<T, K>, DocProblem>>;
      scan(): AsyncGenerator<Item<T, K>, void, undefined>;
    }
  > &
  Gate<C, "read" | "write" | "cas", { update(key: K, f: (current: Doc<T, K> | undefined) => Update<T, C> | Promise<Update<T, C>>): Promise<Result<Updated<T, K>, DocProblem>> }>;

const mapLimit = async <A, B>(items: readonly A[], limit: number, f: (a: A) => Promise<B>): Promise<B[]> => {
  const out: B[] = new Array<B>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await f(items[i] as A);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
};

type Call<V extends Done["op"]> = Promise<Result<Extract<Done, { op: V }>["value"], Problem>>;

/** A collection over a store: see the module. */
export function collection<T, K, C extends Capability>(store: Store<C>, config: CollectionConfig<T, K>): Collection<T, K, C> {
  const handle: Handler = store.handle;
  const attempts = Math.max(1, config.attempts ?? 5);
  const pageSize = Math.max(1, config.pageSize ?? 100);
  const readers = Math.max(1, config.readers ?? 8);

  const pathOf = (key: K): Result<Path, DocProblem> => {
    const rel = config.layout.path(key);
    if (rel.kind === "err") return err({ kind: "bad-key", detail: rel.error });
    const full = below(config.prefix, rel.value);
    return full.kind === "err" ? err({ kind: "bad-key", detail: full.error }) : ok(full.value);
  };
  const keyOf = (path: Path): Result<K, string> => {
    const rel = relativeTo(config.prefix, path);
    return rel === undefined ? err(`${path} is not below ${config.prefix}`) : config.layout.key(rel);
  };

  const read = async (path: Path): Call<"read"> => {
    const done = await handle({ op: "read", path });
    return done.kind === "err" ? done : done.value.op === "read" ? ok(done.value.value) : err({ kind: "unavailable", detail: `the backend answered ${done.value.op} to read`, retryable: false });
  };

  const decode = (key: K, path: Path, bytes: Uint8Array, rev: Revision, modified: string | undefined): Result<Doc<T, K>, DocProblem> => {
    const decoded = config.codec.decode(bytes);
    if (decoded.kind === "err") return err({ kind: "undecodable", path, reason: decoded.error.reason, detail: decoded.error.detail });
    return ok({ key, path, value: decoded.value.value, rev, ...(modified === undefined ? {} : { modified }) });
  };

  const get = async (key: K): Promise<Result<Doc<T, K>, DocProblem>> => {
    const path = pathOf(key);
    if (path.kind === "err") return path;
    const r = await read(path.value);
    if (r.kind === "err") return err(storeProblem(r.error));
    return decode(key, path.value, r.value.bytes, r.value.rev, r.value.modified);
  };

  const write = async (key: K, value: T, expect: Expect): Promise<Result<Saved<K>, DocProblem>> => {
    const path = pathOf(key);
    if (path.kind === "err") return path;
    const bytes = config.codec.encode(value);
    if (bytes.kind === "err") return err({ kind: "unencodable", detail: bytes.error.detail });
    const done = await handle({ op: "write", path: path.value, bytes: bytes.value, expect });
    if (done.kind === "err") return err(storeProblem(done.error));
    return done.value.op === "write" ? ok({ key, path: path.value, rev: done.value.value.rev, created: done.value.value.created }) : err({ kind: "store", problem: { kind: "unavailable", detail: `the backend answered ${done.value.op} to write`, retryable: false } });
  };

  const remove = async (key: K, expect: Expect): Promise<Result<{ readonly existed: boolean }, DocProblem>> => {
    const path = pathOf(key);
    if (path.kind === "err") return path;
    const done = await handle({ op: "delete", path: path.value, expect });
    if (done.kind === "err") return err(storeProblem(done.error));
    return done.value.op === "delete" ? ok({ existed: done.value.value.existed }) : err({ kind: "store", problem: { kind: "unavailable", detail: `the backend answered ${done.value.op} to delete`, retryable: false } });
  };

  const list = async (options?: { readonly after?: Cursor }): Promise<Result<Page<T, K>, DocProblem>> => {
    const done = await handle({ op: "list", prefix: config.prefix, limit: pageSize, ...(options?.after === undefined ? {} : { after: options.after }) });
    if (done.kind === "err") return err(storeProblem(done.error));
    if (done.value.op !== "list") return err({ kind: "store", problem: { kind: "unavailable", detail: `the backend answered ${done.value.op} to list`, retryable: false } });
    const listing = done.value.value;
    const outcomes = await mapLimit(listing.entries, readers, async (entry): Promise<Doc<T, K> | Finding | undefined> => {
      const key = keyOf(entry.path);
      if (key.kind === "err") return { kind: "foreign", path: entry.path, detail: key.error };
      const r = await read(entry.path);
      if (r.kind === "err") return r.error.kind === "missing" ? undefined : { kind: "unreadable", path: entry.path, problem: r.error };
      const doc = decode(key.value, entry.path, r.value.bytes, r.value.rev, r.value.modified);
      return doc.kind === "ok" ? doc.value : doc.error.kind === "undecodable" ? { kind: "undecodable", path: doc.error.path, reason: doc.error.reason, detail: doc.error.detail } : undefined;
    });
    const docs: Doc<T, K>[] = [];
    const findings: Finding[] = [];
    for (const o of outcomes) {
      if (o === undefined) continue;
      if ("value" in o) docs.push(o);
      else findings.push(o);
    }
    return ok({ docs, findings, ...(listing.next === undefined ? {} : { next: listing.next }) });
  };

  async function* scan(): AsyncGenerator<Item<T, K>, void, undefined> {
    let after: Cursor | undefined;
    for (;;) {
      const page = await list(after === undefined ? undefined : { after });
      if (page.kind === "err") {
        yield { kind: "finding", finding: { kind: "unreadable", path: config.prefix as unknown as Path, problem: page.error.kind === "store" ? page.error.problem : { kind: "unavailable", detail: "the listing failed", retryable: false } } };
        return;
      }
      for (const doc of page.value.docs) yield { kind: "doc", doc };
      for (const finding of page.value.findings) yield { kind: "finding", finding };
      if (page.value.next === undefined) return;
      after = page.value.next;
    }
  }

  const update = async (key: K, f: (current: Doc<T, K> | undefined) => Update<T> | Promise<Update<T>>): Promise<Result<Updated<T, K>, DocProblem>> => {
    if (!store.capabilities.has("cas")) return err({ kind: "refused", detail: "an update needs a store with cas, and this store has none" });
    const path = pathOf(key);
    if (path.kind === "err") return path;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const current = await get(key);
      let doc: Doc<T, K> | undefined;
      if (current.kind === "ok") doc = current.value;
      else if (!(current.error.kind === "store" && current.error.problem.kind === "missing")) return current;
      const step = await f(doc);
      if (step.kind === "keep") return ok({ kind: "kept", ...(doc === undefined ? {} : { doc }), attempts: attempt });
      const expect: Expect = doc === undefined ? expectAbsent : expectRev(doc.rev);
      if (step.kind === "delete") {
        if (doc === undefined) return ok({ kind: "deleted", attempts: attempt });
        if (!store.capabilities.has("delete")) return err({ kind: "refused", detail: "this store cannot delete" });
        const gone = await remove(key, expect);
        if (gone.kind === "ok") return ok({ kind: "deleted", attempts: attempt });
        if (!(gone.error.kind === "store" && gone.error.problem.kind === "conflict")) return gone;
      } else {
        const saved = await write(key, step.value, expect);
        if (saved.kind === "ok") return ok({ kind: "put", doc: { key, path: path.value, value: step.value, rev: saved.value.rev }, created: saved.value.created, attempts: attempt });
        if (!(saved.error.kind === "store" && saved.error.problem.kind === "conflict")) return saved;
      }
      if (config.pause !== undefined) await config.pause(attempt);
    }
    return err({ kind: "exhausted", path: path.value, attempts });
  };

  // The one cast: the object has every method, and its type says which of them its capabilities allow.
  return { pathOf, get, put: write, delete: remove, list, scan, update } as unknown as Collection<T, K, C>;
}
