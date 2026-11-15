/**
 * A layout's entries reached through a store: a file read and decoded by its entry's key, a value encoded and written there, and a store
 * listed with every file matched to its entry or given as unmatched with its metadata (commons 0010-file-aide FR-009, FR-011, FR-014).
 *
 * @module
 */
import { err, ok, type Result } from "../../../kernel/mod.ts";
import type { Entry, Layout, Match } from "../algebra/entry.ts";
import type { MatchError } from "../algebra/path.ts";
import { type ConditionFor, type Capability, type FileMeta, listAll, type Store, type StoreError } from "./store.ts";

/** Why a file of an entry could not be read or written: its key, the store, or its bytes. */
export type EntryError =
  | { readonly kind: "key"; readonly error: MatchError }
  | { readonly kind: "store"; readonly error: StoreError }
  | { readonly kind: "decode"; readonly path: string; readonly why: string };

/**
 * Reads the file of an entry at a key and decodes it with the entry's codec.
 *
 * @param store - the store
 * @param entry - the entry
 * @param key - the key, which the entry's pattern writes as a path
 */
export async function readEntry<C extends Capability, K, T>(
  store: Store<C>,
  entry: Entry<string, K, T>,
  key: K,
): Promise<Result<T, EntryError>> {
  const p = entry.pattern.format(key);
  if (p.kind === "err") return err({ kind: "key", error: p.error });
  const bytes = await store.get(p.value);
  if (bytes.kind === "err") return err({ kind: "store", error: bytes.error });
  const value = entry.codec.decode(bytes.value);
  return value.kind === "ok" ? value : err({ kind: "decode", path: p.value, why: value.error });
}

/**
 * Encodes a value with the entry's codec and writes it at the entry's key, on a condition.
 *
 * @param store - the store
 * @param entry - the entry
 * @param key - the key
 * @param value - the value
 * @param condition - the condition, which the store's capabilities allow
 */
export async function writeEntry<C extends Capability, K, T>(
  store: Store<C>,
  entry: Entry<string, K, T>,
  key: K,
  value: T,
  condition?: ConditionFor<C>,
): Promise<Result<FileMeta, EntryError>> {
  const p = entry.pattern.format(key);
  if (p.kind === "err") return err({ kind: "key", error: p.error });
  const put = await store.put(p.value, entry.codec.encode(value), condition);
  return put.kind === "ok" ? ok(put.value) : err({ kind: "store", error: put.error });
}

/** A file of a store and what the layout makes of it: its entry and key, or unmatched (FR-011). */
export type Cataloged<E extends readonly Entry<string, object, unknown>[]> = { readonly match: Match<E>; readonly meta: FileMeta };

/**
 * Every file of a store under a prefix, each with its entry and key or as unmatched, never left out (FR-011).
 *
 * @param layout - the layout
 * @param store - the store
 * @param prefix - where to begin
 */
export async function* catalog<C extends Capability, E extends readonly Entry<string, object, unknown>[]>(
  layout: Layout<E>,
  store: Store<C>,
  prefix = "",
): AsyncIterable<Result<Cataloged<E>, StoreError>> {
  for await (const f of listAll(store, prefix)) {
    if (f.kind === "err") {
      yield f;
      return;
    }
    yield ok({ match: layout.match(f.value.path), meta: f.value });
  }
}
