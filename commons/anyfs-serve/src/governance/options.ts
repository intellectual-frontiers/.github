// Spec: 0002-anyfs-serve-governance FR-005, FR-006, FR-007, FR-008
/**
 * The options of the server, as types: where it may listen (`Exposure`), who may ask (`Authenticator`), what it holds (`Limits`), what it does with the files a desktop makes by itself (`Junk`), whether an empty
 * collection is kept as an object (`Directories`) and how a name that is not in the normal form of Unicode is met (`Unicode`). Each has a default that is the safe one.
 *
 * @example
 * ```ts
 * import { DEFAULT_LIMITS, LOOPBACK_HOSTS } from "./options.ts";
 * DEFAULT_LIMITS.maxBody; // 67108864
 * LOOPBACK_HOSTS; // ["127.0.0.1", "localhost", "[::1]"]
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** Where the server may listen: on the loopback only, or on an address that the program names and the hosts that may be asked for. */
export type Exposure = { readonly kind: "loopback" } | { readonly kind: "exposed"; readonly hostname: string; readonly hosts: readonly string[] };

/** The loopback exposure: the default. */
export const LOOPBACK: Exposure = { kind: "loopback" };

/** The host names that reach the loopback. */
export const LOOPBACK_HOSTS: readonly string[] = ["127.0.0.1", "localhost", "[::1]"];

/** The hosts an exposure allows in the `Host` header, without ports. An exposure to a named address needs at least one host. */
export function hostsOf(exposure: Exposure): readonly string[] {
  return exposure.kind === "loopback" ? LOOPBACK_HOSTS : exposure.hosts;
}

/** An exposure to an address, or why it is not one: a name or an address, and at least one host that may be asked for. */
export function expose(hostname: string, hosts: readonly string[]): Result<Exposure, string> {
  if (hostname.trim() === "" || hostname !== hostname.trim()) return err("an address to listen on is a name or an address with nothing around it");
  if (hosts.length === 0) return err("an exposed server names at least one host it may be asked for, so that a page of another site cannot reach it");
  if (hosts.some((h) => h === "" || h.includes("/") || h.includes(" "))) return err("a host is a name, without a port or a path");
  return ok({ kind: "exposed", hostname, hosts: hosts.map((h) => h.toLowerCase()) });
}

/** What a caller sends to show who it is: a password with a user name (a desktop asks for one), or a bearer token. */
export type Credentials = { readonly scheme: "basic"; readonly user: string; readonly secret: string } | { readonly scheme: "bearer"; readonly secret: string };

/** Whether a caller may ask: what it sent, or nothing. It does not throw. */
export type Authenticator = (credentials: Credentials | undefined) => Promise<boolean>;

/** What the server holds and for how long, so that a caller cannot make it use all it has. */
export type Limits = {
  /** The most bytes of an object a PUT may carry. */
  readonly maxBody: number;
  /** The most bytes of an XML request. */
  readonly maxXml: number;
  /** The deepest an XML request nests. */
  readonly maxXmlDepth: number;
  /** The most elements, attributes and texts an XML request holds. */
  readonly maxXmlNodes: number;
  /** The longest a lock lasts, in seconds, whatever the caller asks. */
  readonly maxLockSeconds: number;
  /** The most locks at once. */
  readonly maxLocks: number;
  /** The most resources one multistatus answer holds. */
  readonly maxResources: number;
};

/** The limits: 64 MiB of an object, 1 MiB of XML nested 32 deep with 20000 parts, locks of an hour at most, 1000 of them, and 10000 resources of an answer. */
export const DEFAULT_LIMITS: Limits = { maxBody: 64 * 1024 * 1024, maxXml: 1024 * 1024, maxXmlDepth: 32, maxXmlNodes: 20000, maxLockSeconds: 3600, maxLocks: 1000, maxResources: 10000 };

/** The limits with changes, or why they make none: every one a whole number of at least 1. */
export function withLimits(base: Limits, changes: Partial<Limits>): Result<Limits, string> {
  const next = { ...base, ...changes };
  for (const [name, value] of Object.entries(next)) if (!Number.isInteger(value) || value < 1) return err(`the limit ${name} is a whole number of at least 1`);
  return ok(next);
}

/** What the server does with the files a desktop makes by itself (`.DS_Store`, `._*`, `Thumbs.db`, `desktop.ini`): lets them be, keeps them out of listings, or refuses to make them. */
export type Junk = "allow" | "hide" | "refuse";

/** Whether a name is one of those files. */
export function isJunkName(name: string): boolean {
  return name === ".DS_Store" || name.startsWith("._") || name === "Thumbs.db" || name === "desktop.ini";
}

/** Whether an empty collection is kept as an object (`markers`: a marker below it, which the listing hides) or only while an object lies below it (`virtual`: nothing is written). */
export type Directories = "markers" | "virtual";

/** What the server does with a name that is not in the normal form of Unicode (NFC): turns it into that form, or refuses it. */
export type Unicode = "nfc" | "refuse";
