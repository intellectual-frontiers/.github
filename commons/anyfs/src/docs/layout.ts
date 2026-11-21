// Spec: 0006-anyfs-documents FR-005
/**
 * Where the documents of a collection are, as code: a layout is a pair of functions between a typed key and a path below the collection, and the second is the inverse of the first, so that a listing can
 * name the key of every object it finds and name the objects that are none of the collection's. The keys are made by smart constructors: an identifier is a safe name of one segment, a date is a day of
 * the calendar. Three layouts are here (by identifier, by identifier below a shard of its first characters, by day); another is a value of the same type.
 *
 * @example
 * ```ts
 * import { byId, parseDocId, parseExtension } from "./layout.ts";
 * const ext = parseExtension(".json");
 * const id = parseDocId("olympia");
 * if (ext.kind === "ok" && id.kind === "ok") byId(ext.value).path(id.value); // ok "olympia.json"
 * ```
 *
 * @module
 */
import { type Brand, err, ok, type Result } from "@intellectual-frontiers/core";
import { type Path, parsePath } from "@intellectual-frontiers/anyfs/governance";

/** What a layout does: a key to a path below the collection, and the path back to its key, or why the path is not a document of the layout. */
export type Layout<K> = {
  readonly name: string;
  path(key: K): Result<Path, string>;
  key(path: Path): Result<K, string>;
};

/** The name of one document: one segment of letters, digits and `. _ ~ @ + = -`, beginning with a letter or digit, of at most 128 characters. Made only by `parseDocId`. */
export type DocId = Brand<string, "anyfs doc id">;
/** The end of a file name that says its format: a dot and one to sixteen lower-case letters or digits. Made only by `parseExtension`. */
export type Extension = Brand<string, "anyfs extension">;
/** A day of the calendar, as `YYYY-MM-DD`. Made only by `parseIsoDate`. */
export type IsoDate = Brand<string, "anyfs iso date">;

/** An identifier from text, or why the text is not one. */
export function parseDocId(text: string): Result<DocId, string> {
  return /^[A-Za-z0-9][A-Za-z0-9._~@+=-]{0,127}$/.test(text) ? ok(text as DocId) : err(`${JSON.stringify(text.slice(0, 40))} is not an identifier: one segment of letters, digits and . _ ~ @ + = -, from a letter or digit, of at most 128 characters`);
}

/** An extension from text, or why the text is not one. */
export function parseExtension(text: string): Result<Extension, string> {
  return /^\.[a-z0-9]{1,16}$/.test(text) ? ok(text as Extension) : err(`${JSON.stringify(text)} is not an extension: a dot and one to sixteen lower-case letters or digits`);
}

/** A day from text, or why the text is not one: the year, month and day are numbers and the day exists in the calendar. */
export function parseIsoDate(text: string): Result<IsoDate, string> {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (m === null) return err(`${JSON.stringify(text)} is not a day: YYYY-MM-DD`);
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day ? ok(text as IsoDate) : err(`${text} is not a day of the calendar`);
}

const withoutExtension = (file: string, extension: Extension): Result<string, string> =>
  file.endsWith(extension) && file.length > extension.length ? ok(file.slice(0, file.length - extension.length)) : err(`${JSON.stringify(file)} does not end in ${extension}`);

/** The layout with one file for each identifier, directly below the collection: `<id><extension>`. */
export function byId(extension: Extension): Layout<DocId> {
  return {
    name: `by-id${extension}`,
    path: (key) => parsePath(`${key}${extension}`),
    key: (path) => {
      if (path.includes("/")) return err(`${path} is below a folder, and the layout keeps its files directly below the collection`);
      const stem = withoutExtension(path, extension);
      return stem.kind === "err" ? stem : parseDocId(stem.value);
    },
  };
}

/** The layout with the files below a folder of the first `width` characters of the identifier (one to four): `<shard>/<id><extension>`, so that no folder holds all of them. */
export function sharded(extension: Extension, width = 2): Result<Layout<DocId>, string> {
  if (!Number.isInteger(width) || width < 1 || width > 4) return err("the width of a shard is one to four characters");
  return ok({
    name: `sharded-${width}${extension}`,
    path: (key) => (key.length < width ? err(`${key} is shorter than the shard width of ${width}`) : parsePath(`${key.slice(0, width)}/${key}${extension}`)),
    key: (path) => {
      const parts = path.split("/");
      if (parts.length !== 2) return err(`${path} is not <shard>/<file>`);
      const stem = withoutExtension(parts[1] as string, extension);
      if (stem.kind === "err") return stem;
      const id = parseDocId(stem.value);
      if (id.kind === "err") return id;
      return parts[0] === id.value.slice(0, width) ? id : err(`${path} is in the folder ${parts[0]}, which is not the first ${width} characters of ${id.value}`);
    },
  });
}

/** The key of a document kept by day. */
export type DatedKey = { readonly date: IsoDate; readonly id: DocId };

/** The layout with the files below the year, month and day: `YYYY/MM/DD/<id><extension>`. */
export function byDate(extension: Extension): Layout<DatedKey> {
  return {
    name: `by-date${extension}`,
    path: (key) => parsePath(`${key.date.slice(0, 4)}/${key.date.slice(5, 7)}/${key.date.slice(8, 10)}/${key.id}${extension}`),
    key: (path) => {
      const parts = path.split("/");
      if (parts.length !== 4) return err(`${path} is not YYYY/MM/DD/<file>`);
      const date = parseIsoDate(`${parts[0]}-${parts[1]}-${parts[2]}`);
      if (date.kind === "err") return date;
      const stem = withoutExtension(parts[3] as string, extension);
      if (stem.kind === "err") return stem;
      const id = parseDocId(stem.value);
      return id.kind === "err" ? id : ok({ date: date.value, id: id.value });
    },
  };
}

/** What is wrong with a layout over some keys: where the path of a key is refused, or does not give the key back. Nothing wrong is the empty list. */
export function layoutFindings<K>(layout: Layout<K>, keys: readonly K[], same: (a: K, b: K) => boolean): readonly string[] {
  const found: string[] = [];
  for (const key of keys) {
    const p = layout.path(key);
    if (p.kind === "err") {
      found.push(`${layout.name}: ${JSON.stringify(key)} has no path: ${p.error}`);
      continue;
    }
    const back = layout.key(p.value);
    if (back.kind === "err") found.push(`${layout.name}: ${p.value} does not give a key back: ${back.error}`);
    else if (!same(back.value, key)) found.push(`${layout.name}: ${p.value} gives ${JSON.stringify(back.value)} and not ${JSON.stringify(key)}`);
  }
  return found;
}
