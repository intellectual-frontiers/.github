/**
 * The generated files as the disk has them (commons 0024-ifws-host FR-009 to FR-012): for each path the templates make, the record holds or a file named `*.auto.*` in the places a generated file
 * lives, the SHA-256 of its bytes on disk, the one the record holds and the one the templates give now, which `verify` judges and `render` acts on. Nothing here changes anything.
 *
 * @module
 */
import { existsSync, readDirSync, sha256File } from "../../runtime/fs.ts";
import { type Sha256, sha256 } from "../../kernel/sha256.ts";
import { HOOKS_FOLDER, isAutoName } from "../render.ts";
import { type FileFacts, STATE_RECORD_PATH } from "../state-record.ts";
import { AREA, type Loaded, native } from "./workspace.ts";

/** The generated files on disk that are in none of the places the templates and the record name: `*.auto.*` at the root and in the workspace's own area, besides the state record itself. */
export function strayAutoFiles(home: string): readonly string[] {
  const out: string[] = [];
  for (const folder of ["", AREA, HOOKS_FOLDER]) {
    const dir = folder === "" ? home : native(home, folder);
    if (!existsSync(dir)) continue;
    for (const e of readDirSync(dir)) {
      if (!e.isFile) continue;
      const path = folder === "" ? e.name : `${folder}/${e.name}`;
      if (path === STATE_RECORD_PATH) continue;
      if (isAutoName(e.name) || folder === HOOKS_FOLDER) out.push(path);
    }
  }
  return out.sort();
}

/** The facts of every generated file: what the templates make, what the record holds and what is on disk where it should not be. */
export async function fileFacts(loaded: Loaded): Promise<readonly FileFacts[]> {
  const wanted = new Map<string, Sha256>();
  for (const f of loaded.files) wanted.set(f.path, await sha256(f.content));
  const paths = new Set<string>([...wanted.keys(), ...Object.keys(loaded.record.files), ...strayAutoFiles(loaded.home)]);
  const out: FileFacts[] = [];
  for (const path of [...paths].sort()) {
    const disk = native(loaded.home, path);
    out.push({
      path,
      onDisk: existsSync(disk) ? await sha256File(disk) : undefined,
      recorded: loaded.record.files[path]?.sha256,
      wanted: wanted.get(path),
    });
  }
  return out;
}
