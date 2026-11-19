// Spec: 0002-workspace-model FR-033
/**
 * The days a tool or a module outside the catalog was first seen (commons 0002-workspace-model FR-033, 0003-host FR-009): the state record keeps them in `firstSeen`, and a later run never restarts
 * a clock: a name already there keeps its day, a new name gets today's. Writing is under the workspace's one lock where it is free, and is skipped (with the record as it was) where another run
 * holds it, because the next run will see the same thing again.
 *
 * @module
 */
import { existsSync, readTextFile } from "../platform/r-fs.ts";
import { acquireLock } from "../platform/r-lock.ts";
import { join } from "../platform/r-path.ts";
import { decodeStateRecord, EMPTY_RECORD, encodeStateRecord, STATE_RECORD_PATH } from "../state-record.ts";
import { writeAtomic } from "./apply.ts";
import { AREA, native } from "./workspace.ts";

/** The first-seen days of a record with `seen` added: an existing day is kept, a day that is not a day is replaced. */
export function mergeSeen(
  before: Readonly<Record<string, string>>,
  seen: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  return { ...seen, ...before };
}

/** Writes the days to the state record of the root. Returns whether the record changed. A damaged record is left as it is. */
export async function rememberSeen(home: string, seen: Readonly<Record<string, string>>): Promise<boolean> {
  if (Object.keys(seen).length === 0 || !existsSync(join(home, AREA))) return false;
  const held = await acquireLock(join(home, AREA, "ergonex.lock"), {
    wait: false,
    command: "ergonex (first seen)",
  });
  if (held === undefined) return false;
  try {
    const path = native(home, STATE_RECORD_PATH);
    const text = existsSync(path) ? await readTextFile(path) : undefined;
    const read = text === undefined ? { kind: "ok" as const, value: EMPTY_RECORD } : decodeStateRecord(text);
    if (read.kind === "err") return false;
    const merged = mergeSeen(read.value.firstSeen, seen);
    if (Object.keys(merged).length === Object.keys(read.value.firstSeen).length) return false;
    await writeAtomic(path, encodeStateRecord({ ...read.value, firstSeen: merged }), "0644");
    return true;
  } finally {
    held.release();
  }
}
