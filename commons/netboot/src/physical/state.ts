// Spec: 0004-netboot-physical FR-001
/**
 * The state of the boot server kept in a file, so that an arming survives the server and a person can arm a host while the server runs. A write is a new file moved over the old one, so that a reader never sees half of it.
 *
 * @example
 * ```ts
 * import { readState } from "./state.ts";
 * // (await readState("/var/lib/netboot/state.json")).armed
 * ```
 *
 * @module
 */
import { fs, path } from "@intellectual-frontiers/system";
import { emptyState, type BootState } from "@intellectual-frontiers/netboot/logical";

/** The state in a file (the empty state where there is no file or it is not readable as state). */
export async function readState(file: string): Promise<BootState> {
  try {
    const v = JSON.parse(await fs.readTextFile(file)) as Partial<BootState>;
    return { armed: v.armed ?? {}, installed: v.installed ?? {}, progress: v.progress ?? [] };
  } catch {
    return emptyState();
  }
}

/** Writes the state, replacing the file whole. */
export async function writeState(file: string, state: BootState): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${crypto.randomUUID()}.tmp`;
  await fs.writeTextFile(tmp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(tmp, file);
}

/** The change in progress: each change waits for the one before it. */
let chain: Promise<unknown> = Promise.resolve();

/** Reads the state, changes it with `f` and writes it back, one change at a time. */
export function updateState<T>(file: string, f: (s: BootState) => { readonly state: BootState; readonly value: T }): Promise<T> {
  const run = chain.then(async () => {
    const r = f(await readState(file));
    await writeState(file, r.state);
    return r.value;
  });
  chain = run.catch(() => undefined);
  return run;
}
