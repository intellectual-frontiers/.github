// Spec: 0002-anyfs-s3-store FR-002
/**
 * The keys of a bucket and the paths of a store. A store lives below a prefix of a bucket: the key of a path is the prefix, a `/` and the path, and the path of a key is the key below the prefix. The key is
 * written in a URL by encoding each segment as RFC 3986 says and keeping the `/`. A key that is not the key of a path (one that parses to another text, as text not in normalization form C does, or to none) is a
 * finding and never an object of the store, and so is a key whose name begins with `.anyfs-`, which the store keeps for itself.
 *
 * @example
 * ```ts
 * import { keyOf, pathOfKey } from "./keys.ts";
 * import { parsePath, parsePrefix } from "@intellectual-frontiers/anyfs/governance";
 * const base = parsePrefix("fleet");
 * const p = parsePath("hosts/alpha.json");
 * base.kind === "ok" && p.kind === "ok" && keyOf(base.value, p.value); // "fleet/hosts/alpha.json"
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import { uriEncode } from "@intellectual-frontiers/crypto/sigv4";
import { MAX_PATH_BYTES, parsePath, type Path, type Prefix } from "@intellectual-frontiers/anyfs/governance";

/** The names the store keeps for itself: it makes none below a prefix and shows none. */
export const OWN = ".anyfs-" as const;

/** Why a key is not a path of the store. */
export type KeyFinding =
  | { readonly kind: "outside"; readonly key: string }
  | { readonly kind: "not-a-path"; readonly key: string; readonly why: string }
  | { readonly kind: "not-normalized"; readonly key: string }
  | { readonly kind: "own"; readonly key: string };

/** A finding in one sentence. */
export function describeFinding(f: KeyFinding): string {
  switch (f.kind) {
    case "outside":
      return `${JSON.stringify(f.key)} is not below the prefix of the store`;
    case "not-a-path":
      return `${JSON.stringify(f.key)} is not a path of a store: ${f.why}`;
    case "not-normalized":
      return `${JSON.stringify(f.key)} is not in normalization form C, so no path of a store is it`;
    case "own":
      return `${JSON.stringify(f.key)} is a name the store keeps for itself`;
    default:
      return absurd(f);
  }
}

/** The text a key begins with for everything below a prefix: nothing for the root, the prefix and a `/` for any other. */
export function basePrefix(prefix: Prefix): string {
  return prefix === "" ? "" : `${prefix}/`;
}

/** The key of a path below a prefix of the bucket, or why it is too long for a key. */
export function keyOf(prefix: Prefix, path: Path): Result<string, string> {
  const key = `${basePrefix(prefix)}${path}`;
  return new TextEncoder().encode(key).length > MAX_PATH_BYTES + 1024 ? err(`${JSON.stringify(key.slice(0, 40))}… is more than a key can be`) : ok(key);
}

/** Whether a path has a segment that begins with the names the store keeps for itself. */
export const isOwn = (path: string): boolean => path.split("/").some((s) => s.startsWith(OWN));

/** The path of a key below a prefix, or the finding that says why the key is not one. */
export function pathOfKey(prefix: Prefix, key: string): Result<Path, KeyFinding> {
  const base = basePrefix(prefix);
  if (!key.startsWith(base) || key.length === base.length) return err({ kind: "outside", key });
  const rest = key.slice(base.length);
  const parsed = parsePath(rest);
  if (parsed.kind === "err") return err({ kind: "not-a-path", key, why: parsed.error });
  if (parsed.value !== rest) return err({ kind: "not-normalized", key });
  if (isOwn(rest)) return err({ kind: "own", key });
  return ok(parsed.value);
}

/** The key written in the path of a URL: each segment encoded as RFC 3986 says, the `/` kept. */
export function encodeKey(key: string): string {
  return key.split("/").map(uriEncode).join("/");
}

/** What a key listed with `encoding-type=url` says: `+` is a space and each `%XX` is a byte of UTF-8. The reason it is not that where it is not. */
export function decodeListedKey(text: string): Result<string, string> {
  try {
    return ok(decodeURIComponent(text.replaceAll("+", " ")));
  } catch {
    return err(`${JSON.stringify(text.slice(0, 40))} is not an encoded key`);
  }
}
