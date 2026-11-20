// Spec: 0006-grc-evidence FR-001, FR-002
/**
 * The `object` store (0006-grc-evidence FR-002): evidence in object storage, through a client of the shape `{ put(key, bytes), get(key), head(key), list(prefix) }` that the host gives; it names no
 * vendor and imports no client. Objects are keyed `objects/<digest>` and their evidence documents `evidence/<digest>.json`.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { type EvidenceStore, evidenceOf, verified } from "@intellectual-frontiers/grc/physical";
import type { Evidence } from "@intellectual-frontiers/grc/logical";

/** What the host gives. */
export type ObjectClient = {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | undefined>;
  head(key: string): Promise<boolean>;
  list(prefix: string): Promise<readonly string[]>;
};

/** A store over an object-storage client; `id` is the store's id in a registry. */
export function objectStore(client: ObjectClient, id = "object"): EvidenceStore {
  return {
    id,
    async put(bytes, meta) {
      const e = await evidenceOf(bytes, meta, id);
      try {
        if (!(await client.head(`objects/${e.digest}`))) {
          await client.put(`objects/${e.digest}`, bytes);
          await client.put(`evidence/${e.digest}.json`, new TextEncoder().encode(JSON.stringify(e)));
        }
        return ok(e);
      } catch (x) {
        return err({ kind: "failed", digest: e.digest, message: x instanceof Error ? x.message : String(x) });
      }
    },
    async get(digest) {
      const bytes = await client.get(`objects/${digest}`);
      return bytes === undefined ? err({ kind: "missing", digest, message: `no object ${digest}` }) : verified(digest, bytes);
    },
    has: (digest) => client.head(`objects/${digest}`),
    async list(filter) {
      const out: Evidence[] = [];
      for (const key of await client.list("evidence/")) {
        const bytes = await client.get(key);
        if (bytes === undefined) continue;
        const e = JSON.parse(new TextDecoder().decode(bytes)) as Evidence;
        if ((filter?.subject === undefined || e.subject === filter.subject) && (filter?.type === undefined || e.type === filter.type)) out.push(e);
      }
      return out.sort((a, b) => (a.digest < b.digest ? -1 : 1));
    },
  };
}
