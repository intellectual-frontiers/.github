// Spec: 0002-anyfs-ssh-helper FR-003, FR-004
/**
 * The protocol between the store and the helper, as pure functions: the argument vector of a call (the helper is carried in the call or kept on the host), the answer of the helper as a closed union
 * (its exit status and its standard output, read once), and the lines the helper writes for each command. Nothing here runs a program.
 *
 * @example
 * ```ts
 * import { callOf, replyOf } from "./protocol.ts";
 * import { helperOf, POSIX } from "./dialect.ts";
 * callOf(helperOf(POSIX), { kind: "installed", path: "/home/a/.local/state/anyfs/helper-x.sh" }, "stat", "/srv/fleet", ["a.json"]).slice(2); // ["stat", "/srv/fleet", "a.json"]
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import { type Found, parseRevision, type Revision } from "@intellectual-frontiers/anyfs/governance";
import type { Output } from "@intellectual-frontiers/headless/logical";
import type { Helper } from "./dialect.ts";

/** How the helper reaches the host: kept there at a path (verified once by its hash), or carried in each call as the argument of `sh -c`. */
export type Transport = { readonly kind: "installed"; readonly path: string } | { readonly kind: "carried" };

/** The commands of the helper. */
export type Command = "probe" | "install" | "read" | "stat" | "statmany" | "list" | "write" | "delete" | "rename";

/** The argument vector of a call: every word is one word, quoted by the executor, never joined here. */
export function callOf(helper: Helper, transport: Transport, command: Command, root: string, args: readonly string[]): readonly string[] {
  switch (transport.kind) {
    case "installed":
      return [helper.shell, transport.path, command, root, ...args];
    case "carried":
      return [helper.shell, "-c", helper.text, "anyfs-helper", command, root, ...args];
    default:
      return absurd(transport);
  }
}

/** What the helper answered: a closed union. */
export type Reply =
  | { readonly kind: "done"; readonly stdout: Uint8Array }
  | { readonly kind: "missing" }
  | { readonly kind: "conflict"; readonly found: Found; readonly at: "path" | "to" }
  | { readonly kind: "refused"; readonly reason: string }
  | { readonly kind: "locked" }
  | { readonly kind: "too-large" }
  | { readonly kind: "no-root" }
  | { readonly kind: "no-hash" }
  | { readonly kind: "bad-hash"; readonly got: string }
  | { readonly kind: "failed"; readonly detail: string }
  | { readonly kind: "lost"; readonly detail: string };

const decoder = new TextDecoder();
/** The text of some bytes. */
export const textOf = (bytes: Uint8Array): string => decoder.decode(bytes);

/** What the found part of a conflict says: `absent` or a revision. */
function foundOf(text: string): Found | undefined {
  if (text === "absent") return { kind: "absent" };
  const r = parseRevision(text);
  return r.kind === "ok" ? { kind: "rev", rev: r.value } : undefined;
}

/** The answer of the helper to one call, from how its program ended. */
export function replyOf(out: Output): Reply {
  const said = textOf(out.stderr).trim();
  if (out.signal !== null) return { kind: "lost", detail: `the call ended by the signal ${out.signal}${said === "" ? "" : `: ${said}`}` };
  const first = textOf(out.stdout).split("\n")[0] ?? "";
  switch (out.code) {
    case 0:
      return { kind: "done", stdout: out.stdout };
    case 10:
      return { kind: "missing" };
    case 11: {
      const m = /^found (\S+)( at to)?$/.exec(first);
      const found = m === null ? undefined : foundOf(m[1] ?? "");
      return found === undefined ? { kind: "failed", detail: `the helper reported a conflict it did not describe: ${JSON.stringify(first)}` } : { kind: "conflict", found, at: m?.[2] === undefined ? "path" : "to" };
    }
    case 12:
      return { kind: "refused", reason: first };
    case 13:
      return { kind: "locked" };
    case 14:
      return { kind: "too-large" };
    case 21:
      return { kind: "no-hash" };
    case 22:
      return { kind: "no-root" };
    case 30:
      return { kind: "bad-hash", got: first.replace(/^hash /, "") };
    case 127:
      return { kind: "failed", detail: `the host has no shell by the name the helper is run with${said === "" ? "" : `: ${said}`}` };
    case 255:
      return { kind: "lost", detail: `the connection to the host failed${said === "" ? "" : `: ${said}`}` };
    default:
      return { kind: "failed", detail: `the helper ended with ${out.code}${said === "" ? "" : `: ${said}`}` };
  }
}

/** A revision in hex of the helper's `sha256:` form, or why it is not one. */
export function revisionOfHex(hex: string): Result<Revision, string> {
  return /^[0-9a-f]{64}$/.test(hex) ? parseRevision(`sha256:${hex}`) : err(`${JSON.stringify(hex)} is not a SHA-256 in hex`);
}

/** What a write told: whether it made the object, and the revision. */
export type Written = { readonly rev: Revision; readonly created: boolean };

/** The answer of a write: `created sha256:HEX` or `updated sha256:HEX`. */
export function writtenOf(stdout: Uint8Array): Result<Written, string> {
  const m = /^(created|updated) (sha256:[0-9a-f]{64})\s*$/.exec(textOf(stdout));
  if (m === null) return err(`the helper said ${JSON.stringify(textOf(stdout).slice(0, 80))} to a write`);
  const rev = parseRevision(m[2] ?? "");
  return rev.kind === "ok" ? ok({ rev: rev.value, created: m[1] === "created" }) : rev;
}

/** What the helper says of an object. */
export type Facts = { readonly size: number; readonly rev: Revision; readonly modified?: string };

function modifiedOf(seconds: string): string | undefined {
  if (!/^\d+$/.test(seconds)) return undefined;
  const date = new Date(Number(seconds) * 1000);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** One line of `stat` (size, time, hash, tab apart) or of `statmany` (the path in front). */
export function factsOf(fields: readonly string[]): Result<Facts, string> {
  const [size, time, hash] = fields;
  if (size === undefined || time === undefined || hash === undefined || !/^\d+$/.test(size)) return err(`the helper said ${JSON.stringify(fields.join("\t").slice(0, 80))} of an object`);
  const rev = revisionOfHex(hash);
  if (rev.kind === "err") return rev;
  const modified = modifiedOf(time);
  return ok({ size: Number(size), rev: rev.value, ...(modified === undefined ? {} : { modified }) });
}

/** The lines of some output, without the empty one at its end. */
export function linesOf(stdout: Uint8Array): readonly string[] {
  const text = textOf(stdout);
  return text === "" ? [] : text.replace(/\n$/, "").split("\n");
}

/** What a host is: what the probe of the helper said, as a closed record. */
export type HostFacts = {
  readonly dialect: "posix";
  readonly hash: "sha256sum" | "shasum" | "openssl" | "sha256" | "none";
  readonly stat: "gnu" | "bsd" | "none";
  readonly caseSensitive: boolean | undefined;
};

const HASHES = ["sha256sum", "shasum", "openssl", "sha256", "none"] as const;
const STATS = ["gnu", "bsd", "none"] as const;

/** The facts of a host from the answer to `probe`, or why the answer is not one the library knows. */
export function hostFactsOf(stdout: Uint8Array): Result<HostFacts, string> {
  const facts = new Map<string, string>();
  for (const line of linesOf(stdout)) {
    const i = line.indexOf("=");
    if (i > 0) facts.set(line.slice(0, i), line.slice(i + 1));
  }
  if (facts.get("protocol") !== "1") return err(`the helper speaks protocol ${JSON.stringify(facts.get("protocol"))}, and this library speaks 1`);
  if (facts.get("dialect") !== "posix") return err(`the helper is of the dialect ${JSON.stringify(facts.get("dialect"))}, not posix`);
  const hash = HASHES.find((h) => h === facts.get("hash"));
  const stat = STATS.find((s) => s === facts.get("stat"));
  if (hash === undefined || stat === undefined) return err("the helper did not say which tools the host has");
  const kase = facts.get("case");
  return ok({ dialect: "posix", hash, stat, caseSensitive: kase === "sensitive" ? true : kase === "insensitive" ? false : undefined });
}
