/** The revision of some bytes, as the stores make it: for tests that write a row as an older version did. */
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { type Revision, parseRevision } from "@intellectual-frontiers/anyfs/governance";

export async function revisionOf(bytes: Uint8Array): Promise<Revision> {
  const r = parseRevision(`sha256:${await sha256(bytes)}`);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}
