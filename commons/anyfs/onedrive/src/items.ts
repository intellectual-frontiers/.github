// Spec: 0002-anyfs-onedrive-store FR-003, FR-006
/**
 * The items Graph answers with, read strictly: a drive item has an id, a name, a size, an entity tag and a time, and is a file (with the hashes of its contents where Graph keeps them), a folder, or something that is
 * neither (a package such as a OneNote notebook, a shortcut); a page of children has the items and, where there are more, the address of the next page. Everything is read from JSON that is checked, never cast,
 * and a field of another type is a reason and not a guess.
 *
 * @example
 * ```ts
 * import { parseItem } from "./items.ts";
 * const item = parseItem({ id: "1", name: "a.txt", size: 3, eTag: "\"{X},1\"", file: { hashes: { sha256Hash: "AB" } } });
 * item.kind === "ok" && item.value.kind; // "file"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** What an item is. */
export type Item =
  | { readonly kind: "file"; readonly id: string; readonly name: string; readonly size: number; readonly eTag: string; readonly modified?: string; readonly sha256?: string }
  | { readonly kind: "folder"; readonly id: string; readonly name: string }
  | { readonly kind: "other"; readonly id: string; readonly name: string };

const record = (x: unknown): Record<string, unknown> | undefined => (typeof x === "object" && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : undefined);

/** An item from parsed JSON, or why it is not one. */
export function parseItem(json: unknown): Result<Item, string> {
  const o = record(json);
  if (o === undefined) return err("a drive item is an object");
  const id = o["id"];
  const name = o["name"];
  if (typeof id !== "string" || id === "") return err("a drive item has an id");
  if (typeof name !== "string") return err("a drive item has a name");
  if (o["folder"] !== undefined) return ok({ kind: "folder", id, name });
  const file = record(o["file"]);
  if (file === undefined || o["package"] !== undefined || o["remoteItem"] !== undefined) return ok({ kind: "other", id, name });
  const size = o["size"];
  if (typeof size !== "number" || !Number.isSafeInteger(size) || size < 0) return err("a file has a size");
  const eTag = typeof o["eTag"] === "string" ? o["eTag"] : "";
  const hashes = record(file["hashes"]);
  const sha = hashes === undefined ? undefined : hashes["sha256Hash"];
  const stamp = typeof o["lastModifiedDateTime"] === "string" ? Date.parse(o["lastModifiedDateTime"]) : Number.NaN;
  return ok({
    kind: "file",
    id,
    name,
    size,
    eTag,
    ...(Number.isNaN(stamp) ? {} : { modified: new Date(stamp).toISOString() }),
    ...(typeof sha === "string" && /^[0-9a-fA-F]{64}$/u.test(sha) ? { sha256: sha.toLowerCase() } : {}),
  });
}

/** A page of the children of a folder: its items, and the address of the next page where there is one. */
export type Page = { readonly items: readonly Item[]; readonly next?: string };

/** A page from parsed JSON, or why it is not one. */
export function parsePage(json: unknown): Result<Page, string> {
  const o = record(json);
  if (o === undefined) return err("a page of children is an object");
  const value = o["value"];
  if (!Array.isArray(value)) return err("a page of children has a list of items");
  const items: Item[] = [];
  for (const raw of value as unknown[]) {
    const item = parseItem(raw);
    if (item.kind === "err") return item;
    items.push(item.value);
  }
  const next = o["@odata.nextLink"];
  if (next !== undefined && typeof next !== "string") return err("the link to the next page is text");
  return ok(next === undefined ? { items } : { items, next });
}
