/**
 * Stores: one small interface every driver implements, what each can do as a type, conditions on a write, typed failures, and the paging of
 * a listing that every driver shares (commons 0010-file-aide FR-014, FR-015, FR-016, FR-018).
 *
 * @module
 */
import { err, ok, type Result } from "../../../kernel/mod.ts";
import type { RelPath } from "../algebra/names.ts";

/** What a store can do beyond reading, writing, deleting, copying and listing (FR-015). */
export type Capability =
  "write-if-absent" | "write-if-match" | "range" | "rename" | "versions" | "server-copy" | "delimiter" | "modified" | "presign";

/** A condition on a write (FR-016): none, only where nothing is there, or only where the file is at a version given. */
export type Condition =
  { readonly kind: "none" } | { readonly kind: "if-absent" } | { readonly kind: "if-match"; readonly version: string };

/** The conditions a store of capabilities `C` takes: the compiler refuses one it cannot keep (FR-015). */
export type ConditionFor<C extends Capability> =
  | { readonly kind: "none" }
  | ("write-if-absent" extends C ? { readonly kind: "if-absent" } : never)
  | ("write-if-match" extends C ? { readonly kind: "if-match"; readonly version: string } : never);

/** A range of bytes: from `start`, up to but not including `end`, or to the end of the file. */
export type ByteRange = { readonly start: number; readonly end?: number };

/** What a store knows of a file. */
export type FileMeta = {
  /** Its path from the store's root. */
  readonly path: RelPath;
  /** Its size in bytes. */
  readonly size: number;
  /** When it was last written, where the store keeps it. */
  readonly modified: Date | null;
  /** A tag that changes whenever its bytes are written again. */
  readonly version: string;
};

/** A request for one page of a listing (FR-014). */
export type ListRequest = {
  /** Only paths that begin with this text; not necessarily a whole name. */
  readonly prefix?: string;
  /** With `/`, the names below the prefix are given once each as folders instead of their files. */
  readonly delimiter?: "/";
  /** Only paths after this one, in the store's order. */
  readonly after?: string;
  /** The most files and folders the page holds; 1,000 where not given. */
  readonly limit?: number;
  /** Where the page before this one ended. */
  readonly continuation?: string;
};

/** One page of a listing: files and folders in the store's order, and where to go on from, until there is no more. */
export type Page = {
  /** The files. */
  readonly files: readonly FileMeta[];
  /** The folders, each a prefix ending with `/`, where the request named a delimiter. */
  readonly folders: readonly string[];
  /** Where the next page begins; none after the last. */
  readonly continuation: string | undefined;
};

/** Why an operation failed (FR-018). It names the store and the path, and never holds a credential, a signature or a signed address. */
export type StoreError = {
  /** Which failure: nothing there, another writer was first, a request the store refuses, a store that cannot be reached, or a bad request. */
  readonly kind: "not-found" | "conflict" | "refused" | "unavailable" | "invalid";
  /** The store's name. */
  readonly store: string;
  /** The path asked for. */
  readonly path: string;
  /** Why, for a person. */
  readonly why: string;
};

/**
 * A store of files (FR-014). Every operation returns a `Result`; an expected failure is never thrown.
 *
 * @typeParam C - what the store can do, which the compiler holds a caller to
 */
export interface Store<C extends Capability = Capability> {
  /** Its name, in a failure. */
  readonly name: string;
  /** What it can do, at run time. */
  readonly capabilities: readonly C[];
  /** What the store knows of a file. */
  head(path: RelPath): Promise<Result<FileMeta, StoreError>>;
  /** A file's bytes, or a range of them. */
  get(path: RelPath, range?: "range" extends C ? ByteRange : never): Promise<Result<Uint8Array, StoreError>>;
  /** Writes a file whole, on a condition (FR-016). */
  put(path: RelPath, bytes: Uint8Array, condition?: ConditionFor<C>): Promise<Result<FileMeta, StoreError>>;
  /** Removes a file; removing one that is not there is not a failure. */
  delete(path: RelPath): Promise<Result<void, StoreError>>;
  /** Copies a file to another path, on a condition. */
  copy(from: RelPath, to: RelPath, condition?: ConditionFor<C>): Promise<Result<FileMeta, StoreError>>;
  /** One page of the files under a prefix. */
  list(request?: ListRequest): Promise<Result<Page, StoreError>>;
}

/**
 * A store as one that may be asked anything: what it cannot do it refuses at run time, as a value (FR-015). This is how code that serves
 * every driver holds a store whose capabilities it does not know.
 *
 * @param store - the store
 */
export function widen<C extends Capability>(store: Store<C>): Store {
  // each driver checks every condition and range it is given against its own capabilities (`checkCondition`), so asking more is safe
  return store as unknown as Store;
}

/** Whether a store can do something, asked of a store whose capabilities the compiler may not know. */
export const can = <C extends Capability>(store: Pick<Store<C>, "capabilities">, capability: Capability): boolean =>
  store.capabilities.some((c) => c === capability);

/** A failure of a store. */
export const storeError = (kind: StoreError["kind"], store: string, path: string, why: string): StoreError => ({ kind, store, path, why });

/**
 * Refuses, as a value, a condition a store cannot keep: for a store whose capabilities the compiler did not know (FR-015).
 *
 * @param store - the store's name and capabilities
 * @param path - the path written
 * @param condition - the condition asked for
 */
export function checkCondition<C extends Capability>(
  store: Pick<Store<C>, "name" | "capabilities">,
  path: string,
  condition: Condition,
): Result<void, StoreError> {
  const need: Capability | undefined =
    condition.kind === "if-absent" ? "write-if-absent" : condition.kind === "if-match" ? "write-if-match" : undefined;
  if (need === undefined || can(store, need)) return ok(undefined);
  return err(storeError("refused", store.name, path, `the store cannot keep ${need}`));
}

/** Compares two paths in the order of their Unicode code points, which is the byte order of their UTF-8 (FR-024). */
export function compareKeys(a: string, b: string): number {
  if (a === b) return 0;
  const ia = a[Symbol.iterator]();
  const ib = b[Symbol.iterator]();
  for (;;) {
    const x = ia.next();
    const y = ib.next();
    if (x.done === true) return y.done === true ? 0 : -1;
    if (y.done === true) return 1;
    const cx = x.value.codePointAt(0) ?? 0;
    const cy = y.value.codePointAt(0) ?? 0;
    if (cx !== cy) return cx < cy ? -1 : 1;
  }
}

/** One item of a listing: a file, or a folder given once for the files below it. */
export type ListItem = { readonly kind: "file"; readonly meta: FileMeta } | { readonly kind: "folder"; readonly prefix: string };

const itemKey = (i: ListItem): string => (i.kind === "file" ? i.meta.path : i.prefix);

/**
 * One page of items already chosen for a request (under its prefix, grouped by its delimiter): sorted by `compareKeys`, after `after` and
 * the continuation, and at most `limit` of them, folders and files counted together as S3 counts them (FR-014).
 *
 * @param items - the items, in any order, each once
 * @param request - the request
 */
export function pageOfItems(items: readonly ListItem[], request: ListRequest = {}): Page {
  const limit = Math.max(1, request.limit ?? 1000);
  const from = [request.after, request.continuation]
    .filter((x): x is string => x !== undefined)
    .sort(compareKeys)
    .at(-1);
  const sorted = items
    .filter((i) => from === undefined || compareKeys(itemKey(i), from) > 0)
    .sort((a, b) => compareKeys(itemKey(a), itemKey(b)));
  const chosen = sorted.slice(0, limit);
  const last = chosen.at(-1);
  return {
    files: chosen.flatMap((i) => (i.kind === "file" ? [i.meta] : [])),
    folders: chosen.flatMap((i) => (i.kind === "folder" ? [i.prefix] : [])),
    continuation: sorted.length > limit && last !== undefined ? itemKey(last) : undefined,
  };
}

/**
 * One page of a listing over every file of a store: what `list` gives for a driver that holds or reads all its keys (FR-014).
 *
 * @param files - every file of the store, in any order
 * @param request - the request
 */
export function pageOf(files: readonly FileMeta[], request: ListRequest = {}): Page {
  const prefix = request.prefix ?? "";
  const items: ListItem[] = [];
  const folders = new Set<string>();
  for (const f of files) {
    if (!f.path.startsWith(prefix)) continue;
    const cut = request.delimiter === "/" ? f.path.indexOf("/", prefix.length) : -1;
    if (cut < 0) items.push({ kind: "file", meta: f });
    else folders.add(f.path.slice(0, cut + 1));
  }
  for (const prefix of folders) items.push({ kind: "folder", prefix });
  return pageOfItems(items, request);
}

/**
 * Every file under a prefix, page after page, until the store has no more.
 *
 * @param store - the store
 * @param prefix - the prefix
 * @param pageSize - how many a page asks for
 */
export async function* listAll<C extends Capability>(
  store: Store<C>,
  prefix = "",
  pageSize = 1000,
): AsyncIterable<Result<FileMeta, StoreError>> {
  let continuation: string | undefined;
  do {
    const page = await store.list({ prefix, limit: pageSize, ...(continuation === undefined ? {} : { continuation }) });
    if (page.kind === "err") {
      yield page;
      return;
    }
    for (const f of page.value.files) yield ok(f);
    continuation = page.value.continuation;
  } while (continuation !== undefined);
}
