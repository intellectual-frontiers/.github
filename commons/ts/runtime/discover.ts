/**
 * Programs found by the prefix of their name on a search path, as Git finds `git-<word>` (commons 0005-typescript-runtime FR-071): each
 * folder of the path in order, the first program of a name winning; a directory, a file that may not be run and a program shadowed by an
 * earlier one of the same name each kept with why it was not taken. On Windows a program is a file whose extension `PATHEXT` lists,
 * compared without regard to case, and its name is given without that extension.
 *
 * @remarks
 * The search path, the extensions and the platform can be given rather than read from this process, so that Windows' rules are proven on
 * any system; the separator between folders is that platform's (`path.win32` or `path.posix`), and a folder and a name are joined by the
 * running system's rules, since the files are this system's.
 * A folder of the path that cannot be read is passed over, as a shell passes it over.
 *
 * @example
 * ```ts
 * import { discoverPrograms } from "./discover.ts";
 * const { found } = await discoverPrograms("git-");
 * found.map((p) => p.name); // ["lfs", ...]: the words `git` would take as commands
 * ```
 *
 * @module
 */
import { readdir, stat } from "node:fs/promises";
import { join, posix, win32 } from "node:path";
import process from "node:process";
import { absurd } from "@intellectual-frontiers/core";

/** The rules a search follows: Windows' (`;`, `\`, PATHEXT) or POSIX's (`:`, `/`, the mode's execute bits). */
export type SearchPlatform = "windows" | "posix";

/** What a search is given; each is read from this process where it is not. */
export type DiscoverOptions = {
  /** The search path, `PATH` by default. */
  readonly path?: string;
  /** The extensions of programs on Windows, `PATHEXT` by default, `.EXE;.CMD;.BAT;.COM` where that is not set. */
  readonly pathext?: string;
  /** The platform whose rules apply, this one's by default. */
  readonly platform?: SearchPlatform;
};

/** A program found: its name after the prefix (on Windows without its extension) and its file. */
export type FoundProgram = { readonly name: string; readonly file: string };

/** Why a file whose name begins with the prefix was not taken. */
export type SkipReason =
  { readonly kind: "directory" } | { readonly kind: "not-executable" } | { readonly kind: "shadowed"; readonly by: string };

/** A file passed over, and why. */
export type SkippedProgram = { readonly file: string; readonly why: SkipReason };

/** What a search found, in the order of the path and then of the names in each folder. */
export type Discovered = { readonly found: readonly FoundProgram[]; readonly skipped: readonly SkippedProgram[] };

/** The platform this process runs on, as the search names it. */
export function searchPlatform(): SearchPlatform {
  return process.platform === "win32" ? "windows" : "posix";
}

/** The extensions of PATHEXT, upper case, in their order. */
export function pathExtensions(pathext: string | undefined): readonly string[] {
  return (pathext ?? ".EXE;.CMD;.BAT;.COM")
    .split(";")
    .map((e) => e.trim().toUpperCase())
    .filter((e) => e !== "");
}

/** A reason as words, for a `--verbose` line. */
export function skipReasonText(why: SkipReason): string {
  switch (why.kind) {
    case "directory":
      return "a directory";
    case "not-executable":
      return "not a program this account may run";
    case "shadowed":
      return `shadowed by ${why.by}`;
    default:
      return absurd(why);
  }
}

/** Every program on the search path whose name begins with `prefix`, and every file of that name passed over. */
export async function discoverPrograms(prefix: string, options: DiscoverOptions = {}): Promise<Discovered> {
  const platform = options.platform ?? searchPlatform();
  const rules = platform === "windows" ? win32 : posix;
  const search = options.path ?? process.env["PATH"] ?? "";
  const exts = pathExtensions(options.pathext ?? process.env["PATHEXT"]);
  const found: FoundProgram[] = [];
  const skipped: SkippedProgram[] = [];
  const byName = new Map<string, string>();
  const folders = search.split(rules.delimiter).filter((d) => d !== "");
  for (const folder of folders) {
    let names: string[];
    try {
      names = (await readdir(folder)).filter((n) => n.startsWith(prefix));
      // In a folder, Windows takes a name's extensions in PATHEXT's order; elsewhere names are taken in byte order.
      const rank = (n: string): number => {
        const i = exts.indexOf(rules.extname(n).toUpperCase());
        return i < 0 ? exts.length : i;
      };
      const stem = (n: string): string => (platform === "windows" ? n.slice(0, n.length - rules.extname(n).length).toLowerCase() : n);
      names.sort((a, b) => (stem(a) < stem(b) ? -1 : stem(a) > stem(b) ? 1 : platform === "windows" ? rank(a) - rank(b) : 0));
    } catch {
      continue;
    }
    for (const entry of names) {
      const file = join(folder, entry);
      let isDir: boolean;
      let mode: number;
      try {
        const s = await stat(file);
        isDir = s.isDirectory();
        mode = s.mode;
      } catch {
        continue;
      }
      if (isDir) {
        skipped.push({ file, why: { kind: "directory" } });
        continue;
      }
      let name = entry.slice(prefix.length);
      if (platform === "windows") {
        const ext = rules.extname(entry).toUpperCase();
        if (ext === "" || !exts.includes(ext)) {
          skipped.push({ file, why: { kind: "not-executable" } });
          continue;
        }
        name = name.slice(0, name.length - ext.length);
      } else if ((mode & 0o111) === 0) {
        skipped.push({ file, why: { kind: "not-executable" } });
        continue;
      }
      if (name === "") continue;
      const key = platform === "windows" ? name.toLowerCase() : name;
      const first = byName.get(key);
      if (first !== undefined) {
        skipped.push({ file, why: { kind: "shadowed", by: first } });
        continue;
      }
      byName.set(key, file);
      found.push({ name, file });
    }
  }
  return { found, skipped };
}
