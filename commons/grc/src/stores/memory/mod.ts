// Spec: 0006-grc-evidence FR-001, FR-002
/**
 * The `memory` store (0006-grc-evidence FR-002): evidence in a map, content-addressed. It is the reference implementation of the store port and what tests and short runs use.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import { type EvidenceStore, evidenceOf, verified } from "@intellectual-frontiers/grc/physical";
import type { Evidence } from "@intellectual-frontiers/grc/logical";

/** A store in memory; `corrupt` is for tests that tamper with an object. */
export function memoryStore(): EvidenceStore & { corrupt(digest: string): void } {
  const objects = new Map<string, Uint8Array>();
  const documents = new Map<string, Evidence>();
  return {
    id: "memory",
    async put(bytes, meta) {
      const e = await evidenceOf(bytes, meta, "memory");
      if (!objects.has(e.digest)) {
        objects.set(e.digest, new Uint8Array(bytes));
        documents.set(e.digest, e);
      }
      return ok(documents.get(e.digest) ?? e);
    },
    async get(digest) {
      const bytes = objects.get(digest);
      return bytes === undefined ? err({ kind: "missing", digest, message: `no object ${digest}` }) : verified(digest, bytes);
    },
    has: (digest) => Promise.resolve(objects.has(digest)),
    list(filter) {
      return Promise.resolve(
        [...documents.values()]
          .filter((e) => (filter?.subject === undefined || e.subject === filter.subject) && (filter?.type === undefined || e.type === filter.type))
          .sort((a, b) => (a.digest < b.digest ? -1 : 1)),
      );
    },
    corrupt(digest) {
      const b = objects.get(digest);
      if (b !== undefined) objects.set(digest, new Uint8Array([...b, 0]));
    },
  };
}
