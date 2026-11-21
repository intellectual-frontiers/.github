// Spec: 0002-anyfs-githost-store FR-007
/**
 * What a revision is made of and what a blob of Git is: the revision of some bytes is `sha256:` and their digest (the same text as in every other store of AnyFS, so a bridge compares across stores), and
 * the name of a blob in Git is the SHA-1 of `blob <size>` and a NUL before its bytes, which is what lets a store tell that a host gave the bytes the name stands for. The revisions are kept by the name
 * of the blob: what a name stands for never changes, so a digest kept for a name (in `store.ts`) is always right.
 *
 * @module
 */
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { parseRevision, type Revision } from "@intellectual-frontiers/anyfs/governance";

/** The revision of some bytes: `sha256:` and their digest. */
export async function revisionOf(bytes: Uint8Array): Promise<Revision> {
  const r = parseRevision(`sha256:${await sha256(bytes)}`);
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

const hex = (b: ArrayBuffer): string => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

/** The name Git gives a blob of these bytes (SHA-1), which is the name a host gives it in a repository of the usual kind. */
export async function gitBlobId(bytes: Uint8Array): Promise<string> {
  const head = new TextEncoder().encode(`blob ${bytes.length}\0`);
  const all = new Uint8Array(head.length + bytes.length);
  all.set(head, 0);
  all.set(bytes, head.length);
  return hex(await crypto.subtle.digest("SHA-1", all));
}

/** Whether bytes are what a blob name stands for: true where the name is of another kind (a repository of SHA-256 names) and so cannot be told. */
export async function isBlob(id: string, bytes: Uint8Array): Promise<boolean> {
  return id.length !== 40 ? true : (await gitBlobId(bytes)) === id;
}
