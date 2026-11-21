// Spec: 0002-native-pinned-install FR-007, FR-008
/**
 * The links of an archive, checked and resolved as pure functions (commons 0002-native-pinned-install FR-007, FR-008): a symbolic link is kept only where its target is a relative path that stays inside
 * the folder the archive is unpacked into, names something the archive holds, and passes through no other link; a hard link is kept as a copy of the file it names, which the archive holds before it;
 * and no file, folder or link is written below a link. Nothing here reads a file or makes a link: the result says which links to make, and a system that cannot make links is given copies.
 *
 * @remarks
 * Every refusal names the path of the link and one reason from a closed list, and refuses the whole archive: a tool with one link that cannot be trusted is not installed at all, as a path that leaves
 * the folder refuses it. The paths are the archive's own (`isSafePath` has held each), so a target is resolved against the folder of the link as text, with `..` taking one part away and never
 * reaching above the root of the folder.
 *
 * @example
 * ```ts
 * import { resolveLinks } from "./links.ts";
 * // a Node release: bin/npm -> ../lib/node_modules/npm/bin/npm-cli.js stays inside, so it is a link to make
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import type { Files, TarEntry } from "@intellectual-frontiers/formats/archive";

/** Why a link is refused. */
export type LinkProblem =
  | "absolute"
  | "escapes"
  | "dangling"
  | "loops"
  | "through-link"
  | "collides"
  | "written-through"
  | "hardlink-target"
  | "directory-on-windows";

/** A link refused, with its path and why. */
export type LinkRefusal = { readonly kind: "link"; readonly path: string; readonly why: LinkProblem };

/** A symbolic link to make: its path and its target, as the archive names it. */
export type SymbolicLink = { readonly path: string; readonly target: string };

/** What an archive unpacks to: its files, the paths of those the archive marks as executable (any execute bit of their mode), and the symbolic links to make once they are written. */
export type Unpacked = { readonly files: Files; readonly executable: ReadonlySet<string>; readonly links: readonly SymbolicLink[] };

/** A refusal as one sentence that says what is wrong and that nothing was written. */
export function describeLinkRefusal(e: LinkRefusal): string {
  const at = `the artifact holds a link at ${e.path}`;
  switch (e.why) {
    case "absolute":
      return `${at} to an absolute path, which cannot be installed safely; it is refused and nothing was written`;
    case "escapes":
      return `${at} whose target leaves the folder it is installed into; it is refused and nothing was written`;
    case "dangling":
      return `${at} whose target is not in the artifact; it is refused and nothing was written`;
    case "loops":
      return `${at} whose target is the folder it is in, or one above it, so that the folder would contain itself; it is refused and nothing was written`;
    case "through-link":
      return `${at} whose target passes through another link; it is refused and nothing was written`;
    case "collides":
      return `${at} that is also the path of a file, a folder or another link; it is refused and nothing was written`;
    case "written-through":
      return `${at} and something is written below it; it is refused and nothing was written`;
    case "hardlink-target":
      return `${at} to a path that is not a file the artifact holds before it; it is refused and nothing was written`;
    case "directory-on-windows":
      return `${at} to a folder, which a system without links cannot install; it is refused and nothing was written`;
    default:
      return absurd(e.why);
  }
}

const refuse = (path: string, why: LinkProblem): Result<never, LinkRefusal> => err({ kind: "link", path, why });

/** The parts of a path, and every folder above it: `a/b/c` gives `a` and `a/b`. */
function ancestors(path: string): readonly string[] {
  const parts = path.split("/");
  const out: string[] = [];
  for (let i = 1; i < parts.length; i++) out.push(parts.slice(0, i).join("/"));
  return out;
}

/** The path a target names from the folder of a link as parts, or why it names none inside the folder. */
function resolveTarget(linkPath: string, target: string): Result<string, LinkProblem> {
  if (target === "" || target.includes("\0") || target.includes("\\")) return err("absolute");
  if (target.startsWith("/") || /^[A-Za-z]:/.test(target)) return err("absolute");
  const stack = linkPath.split("/").slice(0, -1);
  for (const part of target.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (stack.length === 0) return err("escapes");
      stack.pop();
    } else {
      stack.push(part);
    }
  }
  if (stack.length === 0) return err("loops");
  return ok(stack.join("/"));
}

/**
 * The files and the symbolic links of the entries of a tar, where `windows` is true on a system that cannot make links: there a link to a file becomes a copy of the file and a link to a folder is refused.
 * A hard link is a copy of the file it names on every system. The `files` of the result hold no link and the `links` are in the order of their paths.
 */
export function resolveLinks(entries: readonly TarEntry[], windows: boolean): Result<Unpacked, LinkRefusal | { readonly kind: "duplicate-path"; readonly path: string }> {
  const files = new Map<string, Uint8Array>();
  const executable = new Set<string>();
  const folders = new Set<string>();
  const symlinks: { readonly path: string; readonly target: string }[] = [];
  const claimed = new Set<string>();
  const claim = (path: string): boolean => {
    if (claimed.has(path)) return false;
    claimed.add(path);
    return true;
  };
  for (const e of entries) {
    switch (e.kind) {
      case "file":
        if (!claim(e.path)) return err({ kind: "duplicate-path", path: e.path });
        files.set(e.path, e.data);
        if ((e.mode & 0o111) !== 0) executable.add(e.path);
        break;
      case "directory":
        folders.add(e.path);
        break;
      case "symlink":
        if (!claim(e.path)) return refuse(e.path, "collides");
        symlinks.push({ path: e.path, target: e.linkName });
        break;
      case "hardlink": {
        const source = files.get(e.linkName);
        if (source === undefined) return refuse(e.path, "hardlink-target");
        if (!claim(e.path)) return err({ kind: "duplicate-path", path: e.path });
        files.set(e.path, source);
        if ((e.mode & 0o111) !== 0 || executable.has(e.linkName)) executable.add(e.path);
        break;
      }
      default:
        return absurd(e.kind);
    }
  }
  const linkPaths = new Set(symlinks.map((l) => l.path));
  for (const path of [...files.keys(), ...folders, ...linkPaths]) {
    for (const above of ancestors(path)) if (linkPaths.has(above)) return refuse(above, "written-through");
  }
  for (const folder of folders) if (linkPaths.has(folder) || files.has(folder)) return refuse(folder, "collides");
  const known = new Set<string>(folders);
  for (const path of [...files.keys(), ...linkPaths]) for (const above of ancestors(path)) known.add(above);
  const links: SymbolicLink[] = [];
  const copies = new Map(files);
  for (const l of [...symlinks].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    if (known.has(l.path)) return refuse(l.path, "collides");
    const resolved = resolveTarget(l.path, l.target);
    if (resolved.kind === "err") return refuse(l.path, resolved.error);
    const target = resolved.value;
    if (ancestors(l.path).includes(target)) return refuse(l.path, "loops");
    for (const part of [target, ...ancestors(target)]) if (linkPaths.has(part)) return refuse(l.path, "through-link");
    const isFile = files.has(target);
    if (!isFile && !known.has(target)) return refuse(l.path, "dangling");
    if (windows) {
      const bytes = files.get(target);
      if (bytes === undefined) return refuse(l.path, "directory-on-windows");
      copies.set(l.path, bytes);
    } else {
      links.push({ path: l.path, target: l.target });
    }
  }
  return ok({ files: windows ? copies : files, executable, links });
}
