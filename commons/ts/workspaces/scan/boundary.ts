/**
 * The boundary of the root (commons 0023-if-workspaces FR-003, 0024-ifws-host FR-020): IFWS reads and writes only inside the workspace's root, and never reads a private key, a credential store or
 * a file of `~/.ssh`. A relative path that a manifest, a generated-file list or a module gave is resolved against the root by `resolveInside`, which refuses what would leave it (an absolute path,
 * a drive, `..`, a backslash, a home-folder shortcut, a NUL), and `forbiddenRead` names the files that are never read, whatever the root.
 *
 * @remarks
 * Pure and by text: the host layer (`host/inside.ts`) adds the check that a link inside the root does not lead outside it (the real path of what is read must still be inside).
 *
 * @module
 */
import { err, ok, type Result } from "../../kernel/result.ts";

/** Why a path is refused. */
export type BoundaryError =
  | { readonly kind: "outside"; readonly path: string; readonly reason: string }
  | { readonly kind: "forbidden"; readonly path: string; readonly reason: string };

/** A boundary error as one sentence. */
export function describeBoundaryError(e: BoundaryError): string {
  return e.kind === "outside"
    ? `${JSON.stringify(e.path)} is outside the root: ${e.reason}`
    : `${JSON.stringify(e.path)} is never read: ${e.reason}`;
}

/** Joins the parts of a path with `/` and removes a final one: the root as the workspace states it, in the form of a prefix. */
function prefixOf(root: string): string {
  return root.replaceAll("\\", "/").replace(/\/+$/, "");
}

/**
 * The path of a file below the root, as `<root>/<relative>` with `/` between parts, or why it would leave the root. `relative` must be relative, hold no `..` or `.` part, no empty part, no
 * backslash, no drive letter, no `~` start and no NUL; so that no spelling of a path reaches a file the root does not hold.
 */
export function resolveInside(root: string, relative: string): Result<string, BoundaryError> {
  const bad = (reason: string): Result<string, BoundaryError> => err({ kind: "outside", path: relative, reason });
  if (relative === "") return bad("it is empty");
  if (relative.includes("\0")) return bad("it holds a NUL");
  if (relative.includes("\\")) return bad("it holds a backslash (write paths with `/`)");
  if (relative.startsWith("/")) return bad("it is absolute");
  if (/^[A-Za-z]:/.test(relative)) return bad("it names a drive");
  if (relative === "~" || relative.startsWith("~/")) return bad("it names the home folder");
  for (const part of relative.split("/")) {
    if (part === "") return bad("it holds an empty part");
    if (part === "." || part === "..") return bad("it holds a `.` or `..` part");
  }
  return ok(`${prefixOf(root)}/${relative}`);
}

/** Whether a path (in either slash form) lies inside a root: a prefix check on whole parts, after the parts `.` and `..` are resolved; the root's own path is inside. */
export function isInside(root: string, path: string): boolean {
  const parts = (p: string): readonly string[] => {
    const out: string[] = [];
    for (const s of p.replaceAll("\\", "/").split("/")) {
      if (s === "" || s === ".") continue;
      if (s === "..") out.pop();
      else out.push(s);
    }
    return out;
  };
  const r = parts(root);
  const p = parts(path);
  return p.length >= r.length && r.every((s, i) => s === p[i]);
}

const SSH = /(?:^|\/)\.ssh(?:\/|$)/;
const STORES = [
  /(?:^|\/)\.git-credentials$/,
  /(?:^|\/)\.netrc$/,
  /(?:^|\/)_netrc$/,
  /(?:^|\/)\.gnupg(?:\/|$)/,
  /(?:^|\/)\.aws\/credentials$/,
  /(?:^|\/)\.docker\/config\.json$/,
  /(?:^|\/)\.config\/gh\/hosts\.yml$/,
  /(?:^|\/)Library\/Keychains(?:\/|$)/,
  /(?:^|\/)\.local\/share\/keyrings(?:\/|$)/,
];
const KEY_FILES = /(?:^|\/)(?:id_(?:rsa|dsa|ecdsa|ed25519)(?:_sk)?|[^/]+\.(?:pem|key|p12|pfx|ppk|asc))$/i;

/** Why a file is never read (a file of `~/.ssh`, a credential store, a private key by its name), or undefined where it is not forbidden. */
export function forbiddenRead(path: string): string | undefined {
  const p = path.replaceAll("\\", "/");
  if (SSH.test(p)) return "it is in ~/.ssh";
  if (STORES.some((s) => s.test(p))) return "it is a credential store";
  if (KEY_FILES.test(p)) return "it is named like a private key";
  return undefined;
}

/** A path to read: inside the root and not forbidden, as the path to open, or the refusal. */
export function readablePath(root: string, relative: string): Result<string, BoundaryError> {
  const inside = resolveInside(root, relative);
  if (inside.kind === "err") return inside;
  const why = forbiddenRead(inside.value);
  return why === undefined ? inside : err({ kind: "forbidden", path: relative, reason: why });
}
