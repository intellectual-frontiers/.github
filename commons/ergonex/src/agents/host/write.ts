// Spec: 0006-agents FR-012
/**
 * Writing a file whole beside the old one and renaming it over (commons ergonex 0006-agents FR-012): a reader never sees half of it.
 *
 * @module
 */
import { mkdir, readTextOr, rename, writeTextFile } from "../../platform/r-fs.ts";
import { dirname } from "../../platform/r-path.ts";

/** Writes a file whole beside the old one and renames it over, making the folder where there is none; returns whether it changed. */
export async function writeBeside(path: string, text: string): Promise<boolean> {
  const old = await readTextOr(path, undefined);
  if (old === text) return false;
  await mkdir(dirname(path), { recursive: true });
  const side = `${path}.ergonex-${Date.now().toString(36)}`;
  await writeTextFile(side, text);
  await rename(side, path);
  return true;
}
