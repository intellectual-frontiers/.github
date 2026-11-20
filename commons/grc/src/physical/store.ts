// Spec: 0006-grc-evidence FR-001, FR-003
/**
 * The evidence store port (0006-grc-evidence): content-addressed storage of what was observed, with the `grc.evidence` document that describes each object. The registry holds stores by id; the
 * stores are units of their own. Retention is decided by pure functions here, and a store never deletes by itself.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { addDuration, createRegistry, type EvidencePolicy, instantMs, provenanceOf, type Registry } from "@intellectual-frontiers/grc/governance";
import type { Evidence } from "@intellectual-frontiers/grc/logical";

/** What a store is told about bytes it is given. */
export type EvidenceMeta = { readonly subject: string; readonly type: string; readonly mediaType: string; readonly observedAt: string; readonly producer?: string };

/** Why a store did not do what it was asked. */
export type StoreProblem = { readonly kind: "missing" | "tampered" | "failed"; readonly digest: string; readonly message: string };

/** What `list` is asked for. */
export type EvidenceFilter = { readonly subject?: string; readonly type?: string };

/** A store of evidence. */
export type EvidenceStore = {
  readonly id: string;
  /** Keeps the bytes under their SHA-256 and gives the evidence that describes them; the same bytes twice are one object. */
  put(bytes: Uint8Array, meta: EvidenceMeta): Promise<Result<Evidence, StoreProblem>>;
  /** The bytes of a digest, verified: a missing digest, or bytes that do not match it, is a problem. */
  get(digest: string): Promise<Result<Uint8Array, StoreProblem>>;
  has(digest: string): Promise<boolean>;
  /** The evidence, in the order of their digests. */
  list(filter?: EvidenceFilter): Promise<readonly Evidence[]>;
};

/** A registry of stores. */
export type Stores = Registry<EvidenceStore>;

/** A registry of stores, empty. */
export function createStores(): Stores {
  return createRegistry<EvidenceStore>("evidence store");
}

/** The evidence document of bytes. */
export async function evidenceOf(bytes: Uint8Array, meta: EvidenceMeta, store: string): Promise<Evidence> {
  const digest = await sha256(bytes);
  return {
    kind: "grc.evidence",
    schema: "1",
    id: `evidence:${digest}`,
    createdAt: meta.observedAt,
    provenance: provenanceOf([], meta.producer),
    subject: meta.subject,
    type: meta.type,
    digest,
    mediaType: meta.mediaType,
    size: bytes.length,
    observedAt: meta.observedAt,
    store,
    ...(meta.producer === undefined ? {} : { producer: meta.producer }),
  };
}

/** Bytes read back, held to their digest. */
export async function verified(digest: string, bytes: Uint8Array): Promise<Result<Uint8Array, StoreProblem>> {
  return (await sha256(bytes)) === digest ? ok(bytes) : err({ kind: "tampered", digest, message: `the bytes do not have the digest ${digest}` });
}

/** Whether an item is still to be kept at `now`: its retention (from the evidence policy) has not passed since it was observed. */
export function retained(e: Evidence, policy: EvidencePolicy, now: string): boolean {
  const until = addDuration(e.observedAt, policy.retention);
  const t = instantMs(now);
  const u = until.kind === "ok" ? instantMs(until.value) : undefined;
  return t === undefined || u === undefined ? true : t < u;
}

/** The items whose retention has passed: the caller decides whether to delete them. */
export function expired(items: readonly Evidence[], policy: EvidencePolicy, now: string): readonly Evidence[] {
  return items.filter((e) => !retained(e, policy, now));
}
