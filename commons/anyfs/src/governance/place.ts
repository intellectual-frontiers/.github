// Spec: 0002-anyfs-governance FR-007
/**
 * The address of a store: a place, one of ten kinds, written as a URI and made only by `parsePlace`. A place names the root of a store (a folder, a repository at a ref, a host and a folder, a bucket
 * and a prefix, a drive, a database) and never a file in it: the files are the paths of the store. `memory` and `file` are the places the library has stores for; the others parse, format and say that
 * they are planned, so that a mount can be written before the backend exists. Credentials are never part of a place.
 *
 * @example
 * ```ts
 * import { availability, formatPlace, parsePlace } from "./place.ts";
 * const p = parsePlace("github://intellectual-frontiers/fleet@main/hosts");
 * p.kind === "ok" && formatPlace(p.value); // "github://intellectual-frontiers/fleet@main/hosts"
 * p.kind === "ok" && availability(p.value.kind); // "planned"
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import { parsePrefix, type Prefix } from "./path.ts";

/** The kinds of place. */
export const PLACE_KINDS = ["memory", "file", "ssh", "git", "github", "gitlab", "s3", "onedrive", "gdrive", "sql"] as const;
/** One kind of place. */
export type PlaceKind = (typeof PLACE_KINDS)[number];

/** The address of a store. */
export type Place =
  | { readonly kind: "memory"; readonly name: string }
  | { readonly kind: "file"; readonly path: string }
  | { readonly kind: "ssh"; readonly host: string; readonly port?: number; readonly user?: string; readonly path: string }
  | { readonly kind: "git"; readonly repo: string; readonly ref?: string }
  | { readonly kind: "github"; readonly owner: string; readonly repo: string; readonly ref?: string; readonly prefix: Prefix }
  | { readonly kind: "gitlab"; readonly host: string; readonly project: string; readonly ref?: string; readonly prefix: Prefix }
  | { readonly kind: "s3"; readonly bucket: string; readonly prefix: Prefix }
  | { readonly kind: "onedrive"; readonly drive: string; readonly prefix: Prefix }
  | { readonly kind: "gdrive"; readonly folder: string }
  | { readonly kind: "sql"; readonly dialect: string; readonly target: string };

/** Whether the library has a store for a kind of place. A registry with one entry for each kind, which the compiler holds. */
export const AVAILABILITY: Readonly<Record<PlaceKind, "implemented" | "planned">> = {
  memory: "implemented",
  file: "implemented",
  ssh: "planned",
  git: "planned",
  github: "planned",
  gitlab: "planned",
  s3: "planned",
  onedrive: "planned",
  gdrive: "planned",
  sql: "planned",
};

/** Whether the library has a store for a kind of place. */
export const availability = (kind: PlaceKind): "implemented" | "planned" => AVAILABILITY[kind];

const decode = (text: string, what: string): Result<string, string> => {
  try {
    return ok(decodeURIComponent(text));
  } catch {
    return err(`${what} ${JSON.stringify(text)} is not percent-encoded text`);
  }
};
// eslint-disable-next-line no-control-regex
const BAD = /[\u0000-\u001f\u007f\\]/u;
const encodeSegment = (s: string): string => encodeURIComponent(s);
const encodeSegments = (path: string): string => path.split("/").map(encodeSegment).join("/");

/** An absolute path of a host: `/` or `/a/b`, or a drive path `C:/a`, with no `.`, no `..`, no empty segment, no backslash. */
function absolutePath(text: string, what: string): Result<string, string> {
  const d = decode(text, what);
  if (d.kind === "err") return d;
  let p = d.value;
  if (/^\/[A-Za-z]:(?:\/|$)/u.test(p)) p = p.slice(1);
  if (BAD.test(p)) return err(`${what} ${JSON.stringify(text)} holds a backslash or a control character`);
  if (p === "/") return ok(p);
  const drive = /^[A-Za-z]:/u.test(p);
  if (!drive && !p.startsWith("/")) return err(`${what} ${JSON.stringify(text)} is not an absolute path`);
  const body = drive ? p.slice(2) : p;
  const segments = body === "" ? [] : body.split("/").slice(1);
  if (body !== "" && !body.startsWith("/")) return err(`${what} ${JSON.stringify(text)} is not an absolute path`);
  if (segments.some((s) => s === "" || s === "." || s === "..")) return err(`${what} ${JSON.stringify(text)} has an empty segment or the way up`);
  return ok(p);
}

const formatAbsolute = (path: string): string => (/^[A-Za-z]:/u.test(path) ? `/${path.slice(0, 2)}${encodeSegments(path.slice(2))}` : encodeSegments(path));

const prefixOf = (text: string, what: string): Result<Prefix, string> => {
  const d = decode(text.endsWith("/") ? text.slice(0, -1) : text, what);
  return d.kind === "err" ? d : parsePrefix(d.value);
};

const REF = /^[A-Za-z0-9._/-]+$/u;
const refOf = (text: string): Result<string, string> => {
  const d = decode(text, "the ref");
  if (d.kind === "err") return d;
  return REF.test(d.value) && !d.value.includes("..") && !d.value.startsWith("/") && !d.value.endsWith("/") ? ok(d.value) : err(`the ref ${JSON.stringify(d.value)} is not a name of a branch, tag or commit`);
};

const withPrefix = (prefix: Prefix): string => (prefix === "" ? "" : `/${encodeSegments(prefix)}`);
const withRef = (ref: string | undefined): string => (ref === undefined ? "" : `@${encodeURIComponent(ref).replaceAll("%2F", "/")}`);

/** A place from text, or the part that is wrong with it. */
export function parsePlace(text: string): Result<Place, string> {
  const m = /^([a-z][a-z0-9+.-]*):([\s\S]*)$/u.exec(text);
  if (m === null) return err(`${JSON.stringify(text)} is not a place: it has no scheme (${PLACE_KINDS.join(", ")})`);
  const scheme = m[1] ?? "";
  const rest = m[2] ?? "";
  const authority = (what: string): Result<{ readonly head: string; readonly tail: string }, string> => {
    if (!rest.startsWith("//")) return err(`a ${what} place is written ${scheme}://…`);
    const body = rest.slice(2);
    const i = body.indexOf("/");
    return ok(i < 0 ? { head: body, tail: "" } : { head: body.slice(0, i), tail: body.slice(i) });
  };
  switch (scheme) {
    case "memory": {
      return /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/u.test(rest) ? ok({ kind: "memory", name: rest }) : err(`a memory place is memory:<name>, a name of letters, digits, dots, hyphens and underscores`);
    }
    case "file": {
      const a = authority("file");
      if (a.kind === "err") return a;
      if (a.value.head !== "" && a.value.head !== "localhost") return err(`a file place names no host: file:///path (the host ${JSON.stringify(a.value.head)} is not this one)`);
      const p = absolutePath(a.value.tail === "" ? "/" : a.value.tail, "the path");
      return p.kind === "err" ? p : ok({ kind: "file", path: p.value });
    }
    case "ssh": {
      const a = authority("ssh");
      if (a.kind === "err") return a;
      const h = /^(?:([A-Za-z0-9._-]+)@)?(\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?)(?::(\d{1,5}))?$/u.exec(a.value.head);
      if (h === null) return err(`${JSON.stringify(a.value.head)} is not [user@]host[:port]`);
      const port = h[3] === undefined ? undefined : Number(h[3]);
      if (port !== undefined && (port < 1 || port > 65535)) return err(`the port ${port} is not between 1 and 65535`);
      const p = absolutePath(a.value.tail === "" ? "/" : a.value.tail, "the path");
      if (p.kind === "err") return p;
      return ok({ kind: "ssh", host: h[2] ?? "", ...(port === undefined ? {} : { port }), ...(h[1] === undefined ? {} : { user: h[1] }), path: p.value });
    }
    case "git+file": {
      const a = authority("git");
      if (a.kind === "err") return a;
      if (a.value.head !== "") return err(`a git place names no host: git+file:///path`);
      const hash = a.value.tail.indexOf("#");
      const pathText = hash < 0 ? a.value.tail : a.value.tail.slice(0, hash);
      const p = absolutePath(pathText === "" ? "/" : pathText, "the repository path");
      if (p.kind === "err") return p;
      if (hash < 0) return ok({ kind: "git", repo: p.value });
      const ref = refOf(a.value.tail.slice(hash + 1));
      return ref.kind === "err" ? ref : ok({ kind: "git", repo: p.value, ref: ref.value });
    }
    case "github": {
      const a = authority("github");
      if (a.kind === "err") return a;
      const parts = `${a.value.head}${a.value.tail}`.split("/");
      const owner = parts[0] ?? "";
      const second = parts[1] ?? "";
      if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/u.test(owner)) return err(`${JSON.stringify(owner)} is not the owner of a GitHub repository`);
      const at = second.indexOf("@");
      const repo = at < 0 ? second : second.slice(0, at);
      if (!/^[A-Za-z0-9._-]{1,100}$/u.test(repo)) return err(`${JSON.stringify(repo)} is not the name of a GitHub repository`);
      const ref = at < 0 ? undefined : refOf(second.slice(at + 1));
      if (ref !== undefined && ref.kind === "err") return ref;
      const prefix = prefixOf(parts.slice(2).join("/"), "the prefix");
      if (prefix.kind === "err") return prefix;
      return ok({ kind: "github", owner, repo, ...(ref === undefined ? {} : { ref: ref.value }), prefix: prefix.value });
    }
    case "gitlab": {
      const a = authority("gitlab");
      if (a.kind === "err") return a;
      const host = a.value.head;
      if (!/^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?(?::\d{1,5})?$/u.test(host)) return err(`${JSON.stringify(host)} is not the host of a GitLab server`);
      const segments = a.value.tail.split("/").slice(1);
      const withAt = segments.findIndex((s) => s.includes("@"));
      const projectSegments = withAt < 0 ? segments : segments.slice(0, withAt + 1);
      const last = projectSegments[projectSegments.length - 1] ?? "";
      const lastAt = last.indexOf("@");
      const names = projectSegments.map((s, i) => (i === projectSegments.length - 1 && lastAt >= 0 ? s.slice(0, lastAt) : s));
      if (names.length < 2 || names.some((s) => !/^[A-Za-z0-9._-]+$/u.test(s))) return err(`a GitLab project is group/project, with subgroups between: gitlab://host/group/project`);
      const ref = lastAt < 0 ? undefined : refOf(last.slice(lastAt + 1));
      if (ref !== undefined && ref.kind === "err") return ref;
      const prefix = prefixOf(withAt < 0 ? "" : segments.slice(withAt + 1).join("/"), "the prefix");
      if (prefix.kind === "err") return prefix;
      return ok({ kind: "gitlab", host, project: names.join("/"), ...(ref === undefined ? {} : { ref: ref.value }), prefix: prefix.value });
    }
    case "s3": {
      const a = authority("s3");
      if (a.kind === "err") return a;
      if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u.test(a.value.head)) return err(`${JSON.stringify(a.value.head)} is not the name of a bucket`);
      const prefix = prefixOf(a.value.tail.slice(1), "the prefix");
      return prefix.kind === "err" ? prefix : ok({ kind: "s3", bucket: a.value.head, prefix: prefix.value });
    }
    case "onedrive": {
      const a = authority("onedrive");
      if (a.kind === "err") return a;
      if (!/^[A-Za-z0-9!_.-]{1,200}$/u.test(a.value.head)) return err(`${JSON.stringify(a.value.head)} is not the id of a drive`);
      const prefix = prefixOf(a.value.tail.slice(1), "the prefix");
      return prefix.kind === "err" ? prefix : ok({ kind: "onedrive", drive: a.value.head, prefix: prefix.value });
    }
    case "gdrive": {
      const a = authority("gdrive");
      if (a.kind === "err") return a;
      return a.value.tail === "" && /^[A-Za-z0-9_-]{1,100}$/u.test(a.value.head) ? ok({ kind: "gdrive", folder: a.value.head }) : err(`a gdrive place is gdrive://<folder id>`);
    }
    case "sql": {
      const a = authority("sql");
      if (a.kind === "err") return a;
      if (!/^[a-z][a-z0-9]*$/u.test(a.value.head)) return err(`${JSON.stringify(a.value.head)} is not the name of a SQL dialect`);
      const target = decode(a.value.tail.slice(1), "the target");
      if (target.kind === "err") return target;
      return target.value === "" || BAD.test(target.value) || target.value.length > 2048 ? err(`a sql place is sql://<dialect>/<target>, a target of text with no control character`) : ok({ kind: "sql", dialect: a.value.head, target: target.value });
    }
    default:
      return err(`${JSON.stringify(scheme)} is not a scheme of a place (${PLACE_KINDS.join(", ")})`);
  }
}

/** A place as text: what `parsePlace` reads back as the same place. */
export function formatPlace(place: Place): string {
  switch (place.kind) {
    case "memory":
      return `memory:${place.name}`;
    case "file":
      return `file://${formatAbsolute(place.path)}`;
    case "ssh":
      return `ssh://${place.user === undefined ? "" : `${place.user}@`}${place.host}${place.port === undefined ? "" : `:${place.port}`}${formatAbsolute(place.path)}`;
    case "git":
      return `git+file://${formatAbsolute(place.repo)}${place.ref === undefined ? "" : `#${encodeURIComponent(place.ref).replaceAll("%2F", "/")}`}`;
    case "github":
      return `github://${place.owner}/${place.repo}${withRef(place.ref)}${withPrefix(place.prefix)}`;
    case "gitlab":
      return `gitlab://${place.host}/${place.project}${withRef(place.ref)}${withPrefix(place.prefix)}`;
    case "s3":
      return `s3://${place.bucket}${withPrefix(place.prefix)}`;
    case "onedrive":
      return `onedrive://${place.drive}${withPrefix(place.prefix)}`;
    case "gdrive":
      return `gdrive://${place.folder}`;
    case "sql":
      return `sql://${place.dialect}/${encodeURIComponent(place.target)}`;
    default:
      return absurd(place);
  }
}
