/**
 * The places the tests of the sources use: files in an AnyFS store in memory (and, for the backends test, in a folder), the harness the lens laws are checked against, and the context that builds patches.
 *
 * @module
 */
import { expectAny, parsePath } from "@intellectual-frontiers/anyfs/governance";
import { memoryStore, type MemoryStore } from "@intellectual-frontiers/anyfs/memory";
import { type LensContext, type LensHarness, fileSource, type FileLens } from "@intellectual-frontiers/planning/physical";
import { parseInstant } from "@intellectual-frontiers/planning/governance";
import { ADA, eventIds, itemId, must } from "./support.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** A store in memory holding the files. */
export async function storeWith(files: Readonly<Record<string, string>>): Promise<MemoryStore> {
  const store = memoryStore({ name: "files", clock: () => 1_700_000_000_000 });
  for (const [path, text] of Object.entries(files)) must(await store.write(must(parsePath(path)), encoder.encode(text), expectAny));
  return store;
}

/** Every file of a store as text. */
export async function snapshotOf(store: MemoryStore): Promise<Readonly<Record<string, string>>> {
  const out: Record<string, string> = {};
  const listing = must(await store.list(must((await import("@intellectual-frontiers/anyfs/governance")).parsePrefix(""))));
  for (const e of listing.entries) out[e.path] = decoder.decode(must(await store.read(e.path)).bytes);
  return out;
}

/** The harness of a lens over files: a fresh store each time. */
export function harnessOf(lens: () => FileLens, files: Readonly<Record<string, string>>, place = "."): () => Promise<LensHarness> {
  return async () => {
    const store = await storeWith(files);
    return { source: must(fileSource(store, lens(), place)), snapshot: () => snapshotOf(store) };
  };
}

/** The context that builds patches for the laws. */
export function lensContext(): LensContext {
  // ids and times after every one a fixture holds, so that a change made by a patch is the last of its item
  const ids = eventIds(200, undefined, 1_800_000_000_000);
  let n = 0;
  return { item: itemId(7), ids: () => ids[n++ % ids.length] as typeof ids[number], actor: ADA, at: must(parseInstant("2027-01-15T08:00:00Z")) };
}
