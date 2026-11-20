// Spec: 0005-repositories FR-008
/**
 * The repositories under the root that the manifest does not name (commons ergonex 0005-repositories FR-008, FR-009): a folder with a `.git` whose `origin` is a repository on a Git host. One that is at the path
 * its remote makes (FR-006 of 0002-workspace-model) can be adopted; one that is somewhere else is said, with the path it belongs at, and never moved. It reads folders and asks Git for `remote.origin.url`; it uses no network and changes nothing.
 *
 * @module
 */
import { readRemote, type HostKinds, cloneUrlOf } from "@intellectual-frontiers/githost";
import { lstatSync, readDirSync } from "../platform/r-fs.ts";
import { join } from "../platform/r-path.ts";
import { run } from "../platform/r-proc.ts";
import { WORKSPACE_FOLDERS, repoPathOf } from "../layout.ts";
import { foldKey } from "../portable.ts";

/** A repository found under the root that no entry of the manifest names. */
export type Unmanaged =
  | { readonly kind: "adoptable"; readonly path: string; readonly remote: string }
  | { readonly kind: "misplaced"; readonly path: string; readonly belongsAt: string }
  | { readonly kind: "no-remote"; readonly path: string }
  | { readonly kind: "not-a-host"; readonly path: string };

/** The deepest folder looked in, below the root: a host, the groups of GitLab, the repository, and room for a folder of grouping. */
const DEPTH = 8;

const SKIPPED = new Set([...WORKSPACE_FOLDERS.map((f) => f.toLowerCase()), "node_modules"]);

async function originOf(folder: string): Promise<string | undefined> {
  const r = await run(["git", "-C", folder, "config", "--get", "remote.origin.url"], {
    env: { GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" },
  }).catch(() => undefined);
  return r !== undefined && r.success && r.stdout.trim() !== "" ? r.stdout.trim() : undefined;
}

/** The repositories below `home` that `managed` (the paths of the manifest) does not hold, in the order of their paths. */
export async function findUnmanaged(home: string, managed: readonly string[], hostKinds: HostKinds): Promise<readonly Unmanaged[]> {
  const known = new Set(managed.map(foldKey));
  const found: Unmanaged[] = [];
  const walk = async (logical: string, depth: number): Promise<void> => {
    const folder = logical === "" ? home : join(home, ...logical.split("/"));
    let entries;
    try {
      entries = readDirSync(folder);
    } catch {
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    if (entries.some((e) => e.name === ".git")) {
      if (logical === "" || known.has(foldKey(logical))) return;
      const origin = await originOf(folder);
      if (origin === undefined) return void found.push({ kind: "no-remote", path: logical });
      const read = readRemote(origin, hostKinds);
      if (read.kind === "err") return void found.push({ kind: "not-a-host", path: logical });
      const there = repoPathOf(read.value.ref);
      if (there.kind === "err") return void found.push({ kind: "not-a-host", path: logical });
      if (known.has(foldKey(there.value))) return void found.push({ kind: "misplaced", path: logical, belongsAt: there.value });
      return void found.push(
        foldKey(there.value) === foldKey(logical)
          ? { kind: "adoptable", path: logical, remote: cloneUrlOf(read.value.ref) }
          : { kind: "misplaced", path: logical, belongsAt: there.value },
      );
    }
    if (depth >= DEPTH) return;
    for (const e of entries) {
      if (!e.isDirectory || e.isSymlink || SKIPPED.has(e.name.toLowerCase()) || e.name.startsWith(".")) continue;
      if (!lstatSync(join(folder, e.name)).isDirectory) continue;
      await walk(logical === "" ? e.name : `${logical}/${e.name}`, depth + 1);
    }
  };
  await walk("", 0);
  return found;
}
