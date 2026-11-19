// Spec: 0002-workspace-model FR-005
/**
 * Where Ergonex keeps what it remembers and installs, as values (commons 0031-install-locations FR-001 to FR-005): what a person edits or other tools read stays with the workspace, in its `.ergonex/` folder beside the
 * repositories, as `.vscode/` does (the manifest, the generated Git configuration, the hooks, the lists of tools and modules); what Ergonex only remembers is in the state folder (the state record, the evidence of
 * every run, its lock); what it installs is in the data folder (the tools) and their shims are in `~/.local/bin` (on Windows, in the tools folder, which the shell snippet puts on the path).
 *
 * @remarks
 * The plan, the state record and the generated files name a file of Ergonex's by a logical path that begins `.ergonex/`. `movedPath` is the one place that says which of them are kept elsewhere than in the workspace
 * and where; any other path is below the root as it always was. Pure: `host/locations.ts` makes the folders from the environment.
 *
 * @example
 * ```ts
 * import { movedPath, type Places } from "./places.ts";
 * const p: Places = { os: "linux", data: "/d", state: "/s", cache: "/c", tools: "/d/tools", shims: "/h/.local/bin" };
 * movedPath(p, ".ergonex/evidence/2026/11/19/x.json"); // "/s/evidence/2026/11/19/x.json"
 * ```
 *
 * @module
 */

/** The workspace's own folder, beside the repositories, and the logical name of the files in it. */
export const APP = ".ergonex";

/** The folders Ergonex keeps what it remembers and installs in. */
export type Places = {
  readonly os: "linux" | "darwin" | "windows";
  readonly data: string;
  readonly state: string;
  readonly cache: string;
  /** The tools Ergonex installs: `<data>/tools`. */
  readonly tools: string;
  /** Where the shims of the tools it installs are: `~/.local/bin` on Linux and macOS, `<data>/tools/bin` on Windows. */
  readonly shims: string;
};

/** Which of Ergonex's own files are kept elsewhere than in the workspace, from the path below `.ergonex/`: the state record, the evidence and the lock (state), and the installed tools (data). */
export function movedKind(rest: string): "state" | "tools" | undefined {
  if (rest === "state.auto.json" || rest === "ergonex.lock" || rest === "evidence" || rest.startsWith("evidence/")) return "state";
  if (rest === "tools" || rest.startsWith("tools/")) return "tools";
  return undefined;
}

/** Where a path of Ergonex's is kept where it is not in the workspace: the state folder or the data folder, as the system writes it; undefined for a path that is below the root. */
export function movedPath(places: Places, path: string): string | undefined {
  if (path !== APP && !path.startsWith(`${APP}/`)) return undefined;
  const rest = path === APP ? "" : path.slice(APP.length + 1);
  const sep = places.os === "windows" ? "\\" : "/";
  const under = (base: string, parts: readonly string[]): string => [base.replace(/[\\/]+$/, ""), ...parts].join(sep);
  const kind = movedKind(rest);
  if (kind === "state") return under(places.state, rest.split("/"));
  if (kind === "tools") return under(places.tools, rest.split("/").slice(1));
  return undefined;
}
