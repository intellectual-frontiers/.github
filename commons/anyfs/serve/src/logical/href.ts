// Spec: 0003-anyfs-serve-logical FR-003
/**
 * The address of a resource and the path it stands for, in both directions. An address is read one segment at a time, so that an encoded slash is never a separator, and a segment that is empty after decoding,
 * is `.` or `..`, holds a control character, a NUL or a backslash is refused: nothing is resolved, so nothing climbs out of the root. A name that is not in the normal form of Unicode is turned into it, or
 * refused, as the program says.
 *
 * @example
 * ```ts
 * import { pathOfUrl, hrefOf } from "./href.ts";
 * const r = pathOfUrl(new URL("http://127.0.0.1/fleet/synthetic-server-01%20one.json"), "/", "nfc");
 * hrefOf(r.kind === "ok" ? r.value.path : undefined, false, "/"); // "/fleet/synthetic-server-01%20one.json"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { parseAbsolute, type PosixPath, ROOT_PATH } from "@intellectual-frontiers/anyfs-posix/governance";
import type { Unicode } from "@intellectual-frontiers/anyfs-serve/governance";

/** What an address is: the path and whether the address ended in a slash. */
export type Addressed = { readonly path: PosixPath; readonly collection: boolean };

/** Why an address is not a path of the store. */
export type AddressProblem = { readonly kind: "outside"; readonly message: string } | { readonly kind: "malformed"; readonly message: string } | { readonly kind: "unicode"; readonly message: string };

const hasForbidden = (s: string): boolean => {
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 0x20 || c === 0x7f || ch === "\\") return true;
  }
  return false;
};

/** The base of an address: `/` or a path with no trailing slash, which the server answers below. */
export function normalBase(base: string): string {
  const trimmed = base.replace(/\/+$/u, "");
  return trimmed === "" ? "/" : trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/** The path an address names, below a base. */
export function pathOfUrl(url: URL, base: string, unicode: Unicode): Result<Addressed, AddressProblem> {
  const b = normalBase(base);
  const raw = url.pathname;
  let rest: string;
  if (b === "/") rest = raw;
  else if (raw === b || raw.startsWith(`${b}/`)) rest = raw.slice(b.length) === "" ? "/" : raw.slice(b.length);
  else return err({ kind: "outside", message: `the address is not below ${b}` });
  const collection = rest.endsWith("/");
  const segments: string[] = [];
  for (const seg of rest.split("/")) {
    if (seg === "") continue;
    let decoded: string;
    try {
      decoded = decodeURIComponent(seg);
    } catch {
      return err({ kind: "malformed", message: "a segment is not valid percent-encoding" });
    }
    if (decoded.includes("/")) return err({ kind: "malformed", message: "an encoded slash is not a separator and is not accepted" });
    if (decoded === "." || decoded === "..") return err({ kind: "malformed", message: "a segment of dots is not accepted" });
    if (hasForbidden(decoded)) return err({ kind: "malformed", message: "a segment holds a control character, a NUL or a backslash" });
    const normal = decoded.normalize("NFC");
    if (normal !== decoded && unicode === "refuse") return err({ kind: "unicode", message: "a name is not in the normal form of Unicode (NFC)" });
    segments.push(normal);
  }
  if (segments.length === 0) return ok({ path: ROOT_PATH, collection: true });
  const p = parseAbsolute(`/${segments.join("/")}`);
  if (p.kind === "err") return err({ kind: "malformed", message: p.error });
  return ok({ path: p.value, collection });
}

const encodeSegment = (s: string): string => encodeURIComponent(s).replaceAll("'", "%27").replaceAll("(", "%28").replaceAll(")", "%29").replaceAll("*", "%2A");

/** The address of a path below a base; a collection ends in a slash. The root of the store is the base itself. */
export function hrefOf(path: PosixPath | undefined, collection: boolean, base: string): string {
  const b = normalBase(base);
  const prefix = b === "/" ? "" : b;
  if (path === undefined || path === ROOT_PATH) return `${prefix}/`;
  const encoded = path
    .split("/")
    .filter((s) => s !== "")
    .map(encodeSegment)
    .join("/");
  return `${prefix}/${encoded}${collection ? "/" : ""}`;
}

/** The path a `Destination` names: an absolute address on the same host, or an absolute path, below the base. */
export function pathOfDestination(value: string, hostOfRequest: string, base: string, unicode: Unicode): Result<Addressed, AddressProblem | { readonly kind: "other-host"; readonly message: string }> {
  let url: URL;
  try {
    url = new URL(value, `http://${hostOfRequest}`);
  } catch {
    return err({ kind: "malformed", message: "the Destination is not an address" });
  }
  if (url.host.toLowerCase() !== hostOfRequest.toLowerCase()) return err({ kind: "other-host", message: "the Destination is on another host" });
  return pathOfUrl(url, base, unicode);
}
