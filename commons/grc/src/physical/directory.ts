// Spec: 0006-grc-evidence FR-001, FR-002
/**
 * A store kept in a folder (0006-grc-evidence FR-002), which the units `files` and `git` are made of: a folder of objects named by their SHA-256 (`objects/<digest>`) and the evidence document that describes each (`evidence/<digest>.json`). An object
 * is written to a temporary name and renamed, so that a partial object is never read, and a temporary file is never listed.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { fs, path } from "@intellectual-frontiers/system";
import { type EvidenceStore, evidenceOf, verified } from "./store.ts";
import type { Evidence } from "@intellectual-frontiers/grc/logical";

async function write(file: string, bytes: Uint8Array): Promise<void> {
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await fs.writeFile(tmp, bytes);
  await fs.rename(tmp, file);
}

/** A store in the folder `dir`, made if it is not there; `id` is the store's id in a registry. */
export function directoryStore(dir: string, id: string): EvidenceStore {
  const objects = path.join(dir, "objects");
  const documents = path.join(dir, "evidence");
  const ready = async (): Promise<void> => {
    await fs.mkdir(objects, { recursive: true });
    await fs.mkdir(documents, { recursive: true });
  };
  return {
    id,
    async put(bytes, meta) {
      try {
        await ready();
        const e = await evidenceOf(bytes, meta, id);
        const object = path.join(objects, e.digest);
        if (!(await fs.exists(object))) {
          await write(object, bytes);
          await write(path.join(documents, `${e.digest}.json`), new TextEncoder().encode(JSON.stringify(e)));
        }
        return ok(e);
      } catch (e) {
        return err({ kind: "failed", digest: "", message: e instanceof Error ? e.message : String(e) });
      }
    },
    async get(digest) {
      if (!/^[0-9a-f]{64}$/.test(digest)) return err({ kind: "missing", digest, message: `${digest} is not a digest` });
      const object = path.join(objects, digest);
      if (!(await fs.exists(object))) return err({ kind: "missing", digest, message: `no object ${digest}` });
      return verified(digest, await fs.readFile(object));
    },
    has: (digest) => (/^[0-9a-f]{64}$/.test(digest) ? fs.exists(path.join(objects, digest)) : Promise.resolve(false)),
    async list(filter) {
      if (!(await fs.exists(documents))) return [];
      const out: Evidence[] = [];
      for await (const entry of fs.readDir(documents)) {
        if (!entry.isFile || !entry.name.endsWith(".json")) continue;
        const e = JSON.parse(await fs.readTextFile(path.join(documents, entry.name))) as Evidence;
        if ((filter?.subject === undefined || e.subject === filter.subject) && (filter?.type === undefined || e.type === filter.type)) out.push(e);
      }
      return out.sort((a, b) => (a.digest < b.digest ? -1 : 1));
    },
  };
}
