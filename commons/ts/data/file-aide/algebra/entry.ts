/**
 * Entries and layouts: a path pattern with what its files hold, and a union of entries under a root that refuses two entries that match the
 * same path and gives every path one entry and its key, or `unmatched` (commons 0010-file-aide FR-009, FR-010, FR-011).
 *
 * @module
 */
import { err, type Json, ok, parseJson5, type Result, toJson5 } from "../../../kernel/mod.ts";
import { type MatchError, type Pattern, under } from "./path.ts";
import { type RelPath, relPath } from "./names.ts";

/** How the bytes of a file are read as a value and written from one. */
export interface Codec<T> {
  /** What it reads: bytes, UTF-8 text, JSON5, or the caller's own. */
  readonly kind: "bytes" | "text" | "json5" | "custom";
  /** Reads bytes as a value, or says why they are not one. */
  decode(bytes: Uint8Array): Result<T, string>;
  /** Writes a value as bytes. */
  encode(value: T): Uint8Array;
}

/** The bytes as they are. */
export const bytes: Codec<Uint8Array> = { kind: "bytes", decode: (b) => ok(b), encode: (b) => b };

/** UTF-8 text, refused where the bytes are not UTF-8. */
export const text: Codec<string> = {
  kind: "text",
  decode: (b) => {
    try {
      return ok(new TextDecoder("utf-8", { fatal: true }).decode(b));
    } catch {
      return err("the bytes are not UTF-8");
    }
  },
  encode: (t) => new TextEncoder().encode(t),
};

/** JSON5, read and written by the kernel. */
export const json5: Codec<Json> = {
  kind: "json5",
  decode: (b) => {
    const t = text.decode(b);
    if (t.kind === "err") return t;
    const r = parseJson5(t.value);
    return r.kind === "ok" ? r : err(`line ${r.error.line}, column ${r.error.column}: ${r.error.message}`);
  },
  encode: (v) => text.encode(toJson5(v)),
};

/**
 * A codec of the caller's own (FR-009): the library carries none beyond bytes, text and JSON5.
 *
 * @param decode - reads bytes as a value
 * @param encode - writes a value as bytes
 */
export function codec<T>(decode: (bytes: Uint8Array) => Result<T, string>, encode: (value: T) => Uint8Array): Codec<T> {
  return { kind: "custom", decode, encode };
}

/** A kind of file in a layout: a path pattern, what its files hold, what it is and who answers for it. */
export interface Entry<N extends string, K, T> {
  /** Its name, unique in its layout. */
  readonly name: N;
  /** Where its files are. */
  readonly pattern: Pattern<K>;
  /** What its files hold. */
  readonly codec: Codec<T>;
  /** What it is, for a person. */
  readonly description: string;
  /** Who answers for it. */
  readonly owner: string;
}

/** The key type of an entry. */
export type KeyOfEntry<E> = E extends Entry<string, infer K, unknown> ? K : never;
/** The type an entry's files hold. */
export type ValueOfEntry<E> = E extends Entry<string, object, infer T> ? T : never;

/**
 * Makes an entry.
 *
 * @param name - its name, unique in its layout
 * @param pattern - where its files are
 * @param spec - its codec, description and owner
 */
export function entry<const N extends string, K, T>(
  name: N,
  pattern: Pattern<K>,
  spec: { readonly codec: Codec<T>; readonly description: string; readonly owner: string },
): Entry<N, K, T> {
  return { name, pattern, codec: spec.codec, description: spec.description, owner: spec.owner };
}

/**
 * The entries of a layout, each below a literal prefix: a layout mounted under another (FR-010).
 *
 * @param prefix - the names before each entry's pattern, joined by `/`
 * @param entries - the entries
 */
export function mount<const E extends readonly Entry<string, object, unknown>[]>(prefix: string, entries: E): E {
  // the same entries with the same keys and contents: only the text before each pattern changes
  return entries.map((e) => ({ ...e, pattern: under(prefix, e.pattern) })) as unknown as E;
}

/** A path matched by a layout: the entry and its key, or no entry. */
export type Match<E extends readonly Entry<string, object, unknown>[]> =
  | {
      [I in keyof E]: { readonly kind: "matched"; readonly path: RelPath; readonly entry: E[I]["name"]; readonly key: KeyOfEntry<E[I]> };
    }[number]
  | { readonly kind: "unmatched"; readonly path: string; readonly why: string };

/** Why a layout could not be made. */
export type LayoutError =
  | { readonly kind: "empty" }
  | { readonly kind: "named-twice"; readonly name: string }
  | { readonly kind: "bad-pattern"; readonly entry: string; readonly problems: readonly string[] }
  | { readonly kind: "ambiguous"; readonly entries: readonly [string, string]; readonly path: string };

/** A union of entries under a root. */
export interface Layout<E extends readonly Entry<string, object, unknown>[]> {
  /** Its entries, in the order given. */
  readonly entries: E;
  /** The entry that matches a path, and its key; or `unmatched` (FR-010, FR-011). A path is put in normalization form C first. */
  match(path: string): Match<E>;
}

/** Says a layout error in one sentence. */
export function formatLayoutError(e: LayoutError): string {
  switch (e.kind) {
    case "empty":
      return "a layout needs at least one entry";
    case "named-twice":
      return `two entries are named ${e.name}`;
    case "bad-pattern":
      return `the pattern of ${e.entry} is not valid: ${e.problems.join("; ")}`;
    case "ambiguous":
      return `${e.entries[0]} and ${e.entries[1]} both match ${e.path}`;
  }
}

/**
 * Makes a layout, or says why not: no entries, two of one name, a pattern with a problem, or a path formatted from one entry's witnesses
 * that another entry also matches (FR-010).
 *
 * @param entries - the entries
 */
export function layout<const E extends readonly Entry<string, object, unknown>[]>(entries: E): Result<Layout<E>, LayoutError> {
  if (entries.length === 0) return err({ kind: "empty" });
  const names = new Set<string>();
  for (const e of entries) {
    if (names.has(e.name)) return err({ kind: "named-twice", name: e.name });
    names.add(e.name);
    if (e.pattern.problems.length > 0) return err({ kind: "bad-pattern", entry: e.name, problems: e.pattern.problems });
  }
  for (const a of entries) {
    for (const w of a.pattern.witnesses()) {
      for (const b of entries) {
        if (a !== b && b.pattern.parse(w).kind === "ok") return err({ kind: "ambiguous", entries: [a.name, b.name], path: w });
      }
    }
  }
  const match = (given: string): Match<E> => {
    const p = relPath(given);
    if (p.kind === "err") return { kind: "unmatched", path: given, why: p.error.why };
    const found: { name: string; key: unknown }[] = [];
    const whys: string[] = [];
    for (const e of entries) {
      const r: Result<unknown, MatchError> = e.pattern.parse(p.value);
      if (r.kind === "ok") found.push({ name: e.name, key: r.value });
      else whys.push(`${e.name}: ${r.error.why}`);
    }
    const [one, two] = found;
    if (one !== undefined && two === undefined) {
      // the entry named and the key its own pattern read
      return { kind: "matched", path: p.value, entry: one.name, key: one.key } as Match<E>;
    }
    if (one !== undefined && two !== undefined)
      return { kind: "unmatched", path: p.value, why: `${one.name} and ${two.name} both match it` };
    return { kind: "unmatched", path: p.value, why: whys.join("; ") };
  };
  return ok({ entries, match });
}
