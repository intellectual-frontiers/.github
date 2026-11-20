/**
 * A Git remote URL read as a repository on a host (commons 0020-ifccm FR-039, FR-019): the https, `git://`, `ssh://` and scp-like (`git@host:owner/repo`) forms give the same
 * `RepoRef`, whichever way the remote is written, so that a clone made over SSH is the repository the manifest names over HTTPS.
 *
 * @remarks
 * A credential in the URL (`https://user:token@host/...`) is dropped: no result, no error and no message holds it. The host name is lower-cased and its port is dropped (an SSH port and
 * an HTTPS port say how to reach a host, not which repository it is); the path is kept as the host writes it, without `.git` and without a trailing slash. The kind of host is GitHub for
 * `github.com`, GitLab for `gitlab.com` and for a host a map names, and plain Git for every other: a self-managed GitLab is named, never guessed from a URL (FR-019).
 *
 * @limits It reads no file and asks no host. A local path or a `file:` URL is not a remote of a host and is an error.
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import type { HostKind, RepoRef } from "./types.ts";

/** Why a text is not a remote URL of a repository on a host. Never holds the URL, which may hold a credential. */
export type RemoteError =
  | { readonly kind: "empty" }
  | { readonly kind: "local-path" }
  | { readonly kind: "unsupported-scheme"; readonly scheme: string }
  | { readonly kind: "no-host" }
  | { readonly kind: "no-path" }
  | { readonly kind: "bad-segment"; readonly reason: string };

/** A remote error as one sentence. */
export function describeRemoteError(e: RemoteError): string {
  switch (e.kind) {
    case "empty":
      return "the remote is empty";
    case "local-path":
      return "the remote is a path on this computer, not a repository on a Git host";
    case "unsupported-scheme":
      return `the remote's scheme ${e.scheme}: is not https, http, git or ssh`;
    case "no-host":
      return "the remote names no host";
    case "no-path":
      return "the remote names no owner and repository";
    case "bad-segment":
      return `the remote's path is not valid: ${e.reason}`;
    default:
      return absurd(e);
  }
}

/** The hosts that are not plain Git, by name: a map from a lower-case host name to its kind, as the manifest names them (a self-managed GitLab, or GitHub Enterprise Server). */
export type HostKinds = Readonly<Record<string, HostKind>>;

/** The kind of a host: GitHub for `github.com`, GitLab for `gitlab.com`, what the map says for a host it names, and plain Git for every other (0020-ifccm FR-043). */
export function hostKindOf(host: string, hostKinds: HostKinds = {}): HostKind {
  const h = host.toLowerCase();
  if (h === "github.com") return "Github";
  if (h === "gitlab.com") return "Gitlab";
  const named = Object.hasOwn(hostKinds, h) ? hostKinds[h] : undefined;
  return named ?? "Git";
}

function safeDecode(segment: string): string | undefined {
  try {
    return decodeURIComponent(segment);
  } catch {
    return undefined;
  }
}

function refOf(host: string, rawPath: string, hostKinds: HostKinds): Result<RepoRef, RemoteError> {
  const hostName = host.toLowerCase();
  if (hostName === "") return err({ kind: "no-host" });
  const trimmed = rawPath.replace(/[?#].*$/s, "").replace(/\/+$/, "");
  const segments: string[] = [];
  for (const raw of trimmed.split("/")) {
    if (raw === "") continue;
    const s = safeDecode(raw);
    if (s === undefined) return err({ kind: "bad-segment", reason: "a percent escape is not valid" });
    if (s.includes("/") || s.includes("\\")) return err({ kind: "bad-segment", reason: "a segment holds a separator" });
    segments.push(s);
  }
  const last = segments.at(-1);
  if (last === undefined) return err({ kind: "no-path" });
  segments[segments.length - 1] = last.replace(/\.git$/i, "");
  if (segments.length < 2 || segments.some((s) => s === "")) return err({ kind: "no-path" });
  return ok({ kind: hostKindOf(hostName, hostKinds), host: hostName, path: segments });
}

/** The host name of an authority (`user:secret@host:port`, `[::1]:22`): after the last `@`, before the port. */
function hostOfAuthority(authority: string): string {
  const afterAt = authority.slice(authority.lastIndexOf("@") + 1);
  if (afterAt.startsWith("[")) return afterAt.slice(0, afterAt.indexOf("]") + 1);
  const colon = afterAt.indexOf(":");
  return colon < 0 ? afterAt : afterAt.slice(0, colon);
}

/**
 * A remote URL as the repository it names. The forms: `https://host/path(.git)`, `http://`, `git://`, `ssh://[user@]host[:port]/path(.git)` and `[user@]host:path(.git)`. A credential in
 * the URL is dropped; `hostKinds` names the hosts that are not plain Git.
 */
export function parseRemote(url: string, hostKinds: HostKinds = {}): Result<RepoRef, RemoteError> {
  const text = url.trim();
  if (text === "") return err({ kind: "empty" });
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):\/\//.exec(text);
  if (scheme !== null) {
    const name = (scheme[1] ?? "").toLowerCase();
    if (name === "file") return err({ kind: "local-path" });
    if (!["https", "http", "git", "ssh", "git+ssh", "ssh+git"].includes(name)) return err({ kind: "unsupported-scheme", scheme: name });
    const rest = text.slice(scheme[0].length);
    const slash = rest.indexOf("/");
    const authority = slash < 0 ? rest : rest.slice(0, slash);
    return refOf(hostOfAuthority(authority), slash < 0 ? "" : rest.slice(slash), hostKinds);
  }
  // The scp-like form: `[user@]host:path`. A Windows drive (`C:\x`) and a path with a slash before its colon are local.
  if (/^[A-Za-z]:[\\/]/.test(text) || text.startsWith("/") || text.startsWith(".") || text.startsWith("~"))
    return err({ kind: "local-path" });
  const colon = text.indexOf(":");
  const slash = text.indexOf("/");
  if (colon < 0 || (slash >= 0 && slash < colon)) return err({ kind: "local-path" });
  return refOf(hostOfAuthority(text.slice(0, colon)), text.slice(colon + 1), hostKinds);
}

/** A remote as a person writes it: the repository, and the branch where the text is the address of a branch's page. */
export type ReadRemote = { readonly ref: RepoRef; readonly branch?: string };

const HOSTNAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+(?::\d+)?$/;

/** The page of a repository's branch or file on a host's web site (`/tree/main`, `/blob/main/x`, GitLab's `/-/tree/main`): the path of the repository, and the branch. */
function webPage(path: string): { readonly path: string; readonly branch?: string } {
  const m = /^(.*?)\/(?:-\/)?(?:tree|blob|commits|raw)\/([^/?#]+)(?:[/?#].*)?$/s.exec(path);
  if (m === null) return { path };
  const branch = safeDecode(m[2] ?? "");
  return branch === undefined ? { path } : { path: m[1] ?? path, branch };
}

/**
 * A remote as a person writes it, where the domain says the rest: `github.com/owner/repo` and `gitlab.example.com/group/sub/repo` need no `https://`, `owner/repo` is a repository of GitHub,
 * `github:owner/repo` and `gitlab:group/sub/repo` name the host's kind, and the address of a branch's page (`.../tree/main`) is the repository and that branch. Every form `parseRemote` reads is read as it does.
 * A text that begins with `/`, `.` or `~`, a Windows drive or a `file:` URL is a path on this computer and an error, as it is there.
 */
export function readRemote(input: string, hostKinds: HostKinds = {}): Result<ReadRemote, RemoteError> {
  const text = input.trim();
  const strict = parseRemote(text, hostKinds);
  const asIs = (): Result<ReadRemote, RemoteError> => (strict.kind === "err" ? strict : ok({ ref: strict.value }));
  const viaPage = (origin: string, path: string): Result<ReadRemote, RemoteError> => {
    const page = webPage(path);
    const r = parseRemote(`${origin}${page.path}`, hostKinds);
    return r.kind === "err" ? r : ok(page.branch === undefined ? { ref: r.value } : { ref: r.value, branch: page.branch });
  };
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):\/\/([^/]*)(\/.*)?$/.exec(text);
  if (scheme !== null)
    return strict.kind === "err" && scheme[1]?.toLowerCase() === "file" ? strict : viaPage(`${scheme[1]}://${scheme[2]}`, scheme[3] ?? "");
  if (text === "" || /^[A-Za-z]:[\\/]/.test(text) || /^[/.~]/.test(text)) return asIs();
  const named = /^(github|gitlab):([^/].*)$/i.exec(text);
  if (named !== null) return viaPage(`https://${(named[1] ?? "").toLowerCase()}.com/`, named[2] ?? "");
  const colon = text.indexOf(":");
  const slash = text.indexOf("/");
  if (colon >= 0 && (slash < 0 || colon < slash)) return asIs(); // the scp-like form
  const first = slash < 0 ? text : text.slice(0, slash);
  if (slash >= 0 && HOSTNAME.test(first)) return viaPage(`https://${first}`, text.slice(slash));
  if (/^[^/\s]+\/[^/\s]+$/.test(text)) return viaPage("https://github.com/", text);
  return asIs();
}

/** The HTTPS URL a repository is cloned from, with no credential in it. */
export function cloneUrlOf(ref: RepoRef): string {
  return `https://${ref.host}/${ref.path.map(encodeURIComponent).join("/")}.git`;
}

/** A repository as `host/owner/repo`: the name used in messages, never a URL with a credential. */
export function describeRef(ref: RepoRef): string {
  return `${ref.host}/${ref.path.join("/")}`;
}

/** Whether two references name the same repository: the same host, and paths equal by their case (GitHub and GitLab paths are not case-sensitive). */
export function sameRepository(a: RepoRef, b: RepoRef): boolean {
  return (
    a.host.toLowerCase() === b.host.toLowerCase() &&
    a.path.length === b.path.length &&
    a.path.every((s, i) => s.toLowerCase() === (b.path[i] ?? "").toLowerCase())
  );
}
