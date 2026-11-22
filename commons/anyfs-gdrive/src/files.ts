// Spec: 0002-anyfs-gdrive-store FR-003, FR-007
/**
 * The files the Drive API answers with, read strictly: a file has an identifier, a name, a type (a folder is the type `application/vnd.google-apps.folder`; the other types of Google, documents, sheets, slides and
 * shortcuts, have no bytes of their own to keep), a creation time and, for a blob, a size and the digest of its contents; a list has the files and, where there are more, a token for the next page. Everything is read from
 * JSON that is checked, never cast, and a field of another type is a reason and not a guess.
 *
 * @example
 * ```ts
 * import { parseFile } from "./files.ts";
 * const f = parseFile({ id: "1", name: "a.txt", mimeType: "text/plain", size: "3", createdTime: "2026-01-01T00:00:00.000Z" });
 * f.kind === "ok" && f.value.kind; // "blob"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** The type of a folder. */
export const FOLDER_TYPE = "application/vnd.google-apps.folder";

/** What a file of Drive is, with what the store needs of it. */
export type DriveFile =
  | { readonly kind: "blob"; readonly id: string; readonly name: string; readonly size: number; readonly created: number; readonly modified?: string; readonly sha256?: string }
  | { readonly kind: "folder"; readonly id: string; readonly name: string; readonly created: number }
  | { readonly kind: "other"; readonly id: string; readonly name: string; readonly created: number };

/** The fields the store asks for. */
export const FIELDS = "id,name,mimeType,size,sha256Checksum,createdTime,modifiedTime,trashed";

const record = (x: unknown): Record<string, unknown> | undefined => (typeof x === "object" && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : undefined);

/** A file from parsed JSON, or why it is not one. A file in the trash is not a file of the store. */
export function parseFile(json: unknown): Result<DriveFile & { readonly trashed: boolean }, string> {
  const o = record(json);
  if (o === undefined) return err("a file of Drive is an object");
  const id = o["id"];
  const name = o["name"];
  const mime = o["mimeType"];
  if (typeof id !== "string" || id === "") return err("a file of Drive has an identifier");
  if (typeof name !== "string") return err("a file of Drive has a name");
  if (typeof mime !== "string") return err("a file of Drive has a type");
  const made = typeof o["createdTime"] === "string" ? Date.parse(o["createdTime"]) : Number.NaN;
  const created = Number.isNaN(made) ? 0 : made;
  const trashed = o["trashed"] === true;
  if (mime === FOLDER_TYPE) return ok({ kind: "folder", id, name, created, trashed });
  if (mime.startsWith("application/vnd.google-apps.")) return ok({ kind: "other", id, name, created, trashed });
  const sizeText = o["size"];
  const size = typeof sizeText === "string" ? Number(sizeText) : typeof sizeText === "number" ? sizeText : Number.NaN;
  if (!Number.isSafeInteger(size) || size < 0) return err("a blob has a size");
  const sha = o["sha256Checksum"];
  const stamp = typeof o["modifiedTime"] === "string" ? Date.parse(o["modifiedTime"]) : Number.NaN;
  return ok({
    kind: "blob",
    id,
    name,
    size,
    created,
    trashed,
    ...(Number.isNaN(stamp) ? {} : { modified: new Date(stamp).toISOString() }),
    ...(typeof sha === "string" && /^[0-9a-fA-F]{64}$/u.test(sha) ? { sha256: sha.toLowerCase() } : {}),
  });
}

/** A page of a list of files: the files and the token of the next page where there is one. */
export type Page = { readonly files: readonly (DriveFile & { readonly trashed: boolean })[]; readonly next?: string };

/** A page from parsed JSON, or why it is not one. */
export function parsePage(json: unknown): Result<Page, string> {
  const o = record(json);
  if (o === undefined) return err("a list of files is an object");
  const list = o["files"];
  if (!Array.isArray(list)) return err("a list of files has a list of files");
  const files: (DriveFile & { readonly trashed: boolean })[] = [];
  for (const raw of list as unknown[]) {
    const f = parseFile(raw);
    if (f.kind === "err") return f;
    files.push(f.value);
  }
  const next = o["nextPageToken"];
  if (next !== undefined && typeof next !== "string") return err("the token of the next page is text");
  return ok(next === undefined ? { files } : { files, next });
}

/** Orders files as the store means them where a name is held more than once: the oldest first, then by identifier. */
export const byAge = (a: DriveFile, b: DriveFile): number => (a.created !== b.created ? a.created - b.created : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** A text as a string of a query of Drive: in single quotes, with the backslash and the quote escaped. */
export const quoted = (text: string): string => `'${text.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
