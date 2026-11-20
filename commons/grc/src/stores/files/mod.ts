// Spec: 0006-grc-evidence FR-001, FR-002
/**
 * The `files` store (0006-grc-evidence FR-002): a folder of objects named by their SHA-256 and the evidence document that describes each, written by renaming a temporary file so that a partial
 * object is never read.
 *
 * @module
 */
import { directoryStore, type EvidenceStore } from "@intellectual-frontiers/grc/physical";

/** A store in the folder `dir`, made if it is not there. */
export function filesStore(dir: string): EvidenceStore {
  return directoryStore(dir, "files");
}
