// Spec: 0002-report-site FR-007
/**
 * Writing a site to a folder (0002-report-site FR-007): each file to its place, the folder made where it is not there, and a file that is already there replaced only by the same path of the same site, so that a report is made again and never merged into another's folder.
 *
 * @example
 * ```ts
 * import { writeSite } from "./site.ts";
 * typeof writeSite; // "function"
 * ```
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import type { Site } from "@intellectual-frontiers/posture-report/governance";

/** Writes the files of a site under a folder, and returns the paths written in order. */
export async function writeSite(dir: string, site: Site): Promise<readonly string[]> {
  const written: string[] = [];
  for (const [name, text] of [...site].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (name.startsWith("/") || name.split("/").includes("..")) throw new Error(`${name} is not a path inside the site`);
    const target = path.join(dir, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeTextFile(target, text);
    written.push(name);
  }
  return written;
}
