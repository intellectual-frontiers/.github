// Spec: 0001-docs FR-033
/**
 * Where the release of a build is read (docs 0001-docs FR-033): the version of the package's own `package.json`, the commit the build is of and the commits since the commit that made the release record, read from the repository with `git`; what it finds goes to `resolveRelease`, which decides which version the site shows.
 *
 * @module
 */
import { fs, path, proc } from "@intellectual-frontiers/system";
import type { Config } from "./config.ts";
import type { Evidence } from "./evidence.ts";
import { type Release, resolveRelease } from "./published.ts";

async function git(cwd: string, args: readonly string[]): Promise<string | undefined> {
  try {
    const r = await proc.run(["git", ...args], { cwd });
    return r.success ? r.stdout.trim() : undefined;
  } catch {
    return undefined;
  }
}

/** The release a site shows, or `undefined` where the configuration names no package. */
export async function readRelease(config: Config, evidence: Evidence): Promise<Release | undefined> {
  const source = config.release;
  if (source === undefined) return undefined;
  let local: string | undefined;
  try {
    const v = (JSON.parse(fs.readTextFileSync(path.join(config.root, source.package))) as { readonly version?: unknown }).version;
    local = typeof v === "string" ? v : undefined;
  } catch {
    local = undefined;
  }
  const top = await git(config.root, ["rev-parse", "--show-toplevel"]);
  const commit = top === undefined ? undefined : await git(top, ["rev-parse", "--short=8", "HEAD"]);
  let recorded: string | undefined;
  let ahead: number | undefined;
  if (source.record !== undefined) {
    try {
      const record = JSON.parse(fs.readTextFileSync(path.join(config.root, source.record))) as { readonly releases?: readonly { readonly package?: unknown; readonly version?: unknown }[] };
      const name = (JSON.parse(fs.readTextFileSync(path.join(config.root, source.package))) as { readonly name?: unknown }).name;
      const entry = record.releases?.find((r) => r.package === name);
      recorded = typeof entry?.version === "string" ? entry.version : undefined;
    } catch {
      recorded = undefined;
    }
    if (top !== undefined && recorded !== undefined && (await git(top, ["rev-parse", "--is-shallow-repository"])) === "false") {
      const abs = path.join(config.root, source.record);
      const made = await git(top, ["log", "-1", "--format=%H", "--", abs]);
      const n = made === undefined || made === "" ? undefined : await git(top, ["rev-list", "--count", `${made}..HEAD`]);
      ahead = n === undefined ? undefined : Number(n);
    }
  }
  return resolveRelease({ registry: evidence.registry, local, commit, recorded, ahead });
}
