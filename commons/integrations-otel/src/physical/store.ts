// Spec: 0002-otel-connector FR-008
/**
 * What touches the world for the OTel connector (0002-otel-connector FR-008): the read port of the folder in which the controller's receiver keeps its batches, one JSON document for each batch named by its sequence number (`<seq>.json`). The port reads that folder and no other, never writes
 * to it, and gives the batches whose sequence number is above the watermark in the query `since`, in order. A file that is not a batch is left out.
 *
 * @module
 */
import { err, ok } from "@intellectual-frontiers/core";
import type { Json, ReadFailure, ReadPort } from "@intellectual-frontiers/integrations/logical";
import { fs, path } from "@intellectual-frontiers/system";

/** The read port of a receiver store at `folder`. */
export function receiverStorePort(folder: string): ReadPort {
  return {
    get: () => Promise.resolve(err<ReadFailure>({ kind: "not-found", subject: "receiver-store" })),
    pages: async function* (target) {
      const since = Number(new URL(target, "file:///").searchParams.get("since") ?? "0");
      const names: string[] = [];
      try {
        for await (const e of fs.readDir(folder)) names.push(e.name);
      } catch {
        return err<ReadFailure>({ kind: "not-found", subject: "receiver-store" });
      }
      const seqs = names.flatMap((n) => (/^[0-9]{1,15}\.json$/u.test(n) ? [Number(n.slice(0, -5))] : [])).filter((s) => s > since).sort((a, b) => a - b);
      for (const s of seqs) {
        try {
          yield JSON.parse(await fs.readTextFile(path.join(folder, `${s}.json`))) as Json;
        } catch {
          continue;
        }
      }
      return ok(seqs.length);
    },
  };
}
